import {launchBrowser} from "../common/helpers";
import * as path from "path";
import * as fs from "fs";
import {performanceTimingMetrics, processPerformanceTiming} from "../common/metrics";
import {Page, PredefinedNetworkConditions} from 'puppeteer';

const lighthouse = require('lighthouse/core/index.cjs');

const slow3G = PredefinedNetworkConditions['Slow 3G'];
const fast3G = PredefinedNetworkConditions['Fast 3G'];

const mediumCPUSlowdown = 4;
const slowCPUSlowdown = 6;

const cpuSlowdowns = {
    medium: mediumCPUSlowdown,
    slow: slowCPUSlowdown
};

type CPUConditionKey = keyof typeof cpuSlowdowns;

const networkConditions = {
    noThrottling: 'noThrottling',
    fast3G,
    slow3G
};

type NetworkConditionKey = keyof typeof networkConditions;

const simulateNetworkConditions = async (page: Page, condition: NetworkConditionKey) => {
    if (condition !== 'noThrottling' && networkConditions[condition]) {
        await page.emulateNetworkConditions(networkConditions[condition]);
    }
};

const extractLighthouseMetrics = (lhr: any) => {
    return {
        metrics: lhr.audits['metrics']?.details.items[0],
        resourceSummary: lhr.audits['resource-summary']?.details.items
    };
};

const performTest = async (conditionName: NetworkConditionKey, appType: string, appUrl: string, cpuSlowdown?: CPUConditionKey) => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    // Increase the default navigation timeout
    const timeout = conditionName !== 'noThrottling' ? 300000 : 120000; // 5 minutes for throttled, 2 minutes for normal
    page.setDefaultNavigationTimeout(timeout);

    // Set a consistent viewport size and disable mobile emulation
    await page.setViewport({width: 1920, height: 1080, isMobile: false});
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Load environment variables
    const loginUrl = `${appUrl}login` ?? '';
    const username = process.env.DOCTOR_USERNAME ?? '';
    const password = process.env.PASSWORD ?? '';

    console.log(`Navigating to: ${loginUrl}`);
    console.log(`Using credentials: ${username} / ${password}`);

    try {
        // Apply network conditions
        await client.send('Network.enable');
        await client.send('DOM.enable');
        await simulateNetworkConditions(page, conditionName);

        if (cpuSlowdown)
            await page.emulateCPUThrottling(cpuSlowdowns[cpuSlowdown]);

        // Start performance analysis
        await client.send('Performance.enable');

        // Navigate to login page
        await page.goto(loginUrl, {waitUntil: 'load'});

        const puppeteerMetrics = await page.metrics();
        const initialPerformanceTiming = await performanceTimingMetrics(page);
        const processedBrowserMetrics = processPerformanceTiming(initialPerformanceTiming);

        // Log detailed performance timing
        console.log('Performance timing metrics:', processedBrowserMetrics);

        // Measure form submission time
        const formStart = Date.now();

        // Perform login
        await page.type('#email-input', username);
        await page.type('#password-input', password);
        await page.click('#submit-btn');

        // Wait for navigation after login
        try {
            await page.waitForNavigation({waitUntil: 'load', timeout});
        } catch (error) {
            console.error('Navigation to home page after login failed:', error);
        }

        const formEnd = Date.now();
        const formSubmissionTime = formEnd - formStart;

        // Verify login by checking the URL or a specific element on the home page
        let loginSuccessful = false;
        const hero = await page.$('#hero');
        if (hero) {
            loginSuccessful = true;
            console.log('Login successful');
        } else {
            console.log('Login failed');
        }

        // Save metrics to a file
        const metrics = {
            browserPerformanceTiming: processedBrowserMetrics,
            puppeteerMetrics,
            formSubmissionTime, // Added form submission time
            loginSuccessful
        };

        if (cpuSlowdown) {
            const metricsFilePath = path.resolve(__dirname, `../../../results/login/metrics/custom/${appType}-${cpuSlowdown}-cpu-metrics.json`);
            fs.writeFileSync(metricsFilePath, JSON.stringify(metrics, null, 2));
            console.log(`Metrics saved for ${cpuSlowdown} cpu: ${metricsFilePath}`);
        } else {

            const metricsFilePath = path.resolve(__dirname, `../../../results/login/metrics/custom/${appType}-${conditionName}-metrics.json`);
            fs.writeFileSync(metricsFilePath, JSON.stringify(metrics, null, 2));
            console.log(`Metrics saved for ${conditionName}: ${metricsFilePath}`);
        }

    } catch (error) {
        console.error(`Error during metrics collection for condition ${conditionName}:`, error);
    }

    await browser.close();
};

const collectLighthouseMetrics = async (appType: string, appUrl: string) => {
    const browser = await launchBrowser();
    const page = await browser.newPage();

    // Increase the default navigation timeout
    page.setDefaultNavigationTimeout(1200000);

    // Set a consistent viewport size and disable mobile emulation
    await page.setViewport({width: 1920, height: 1080, isMobile: false});

    // Navigate to the login page
    const loginUrl = `${appUrl}login` ?? '';
    await page.goto(loginUrl, {waitUntil: 'load'});

    try {
        // Collect Lighthouse metrics for login page with desktop configuration
        const wsEndpoint = new URL(browser.wsEndpoint());
        const port = parseInt(wsEndpoint.port, 10);
        const options = {
            port,
            formFactor: 'desktop',
            screenEmulation: {
                mobile: false,
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
                disabled: false
            },

        };
        const {lhr} = await lighthouse(page.url(), options, null);
        const lighthouseMetrics = extractLighthouseMetrics(lhr);

        // Save Lighthouse metrics to a separate file
        const lighthouseFilePath = path.resolve(__dirname, `../../../results/login/metrics/lighthouse/${appType}-lighthouse-metrics.json`);
        fs.writeFileSync(lighthouseFilePath, JSON.stringify(lighthouseMetrics, null, 2));
        console.log(`Lighthouse metrics saved for ${appType}: ${lighthouseFilePath}`);


    } catch (error) {
        console.error(`Error during Lighthouse metrics collection for appType ${appType}:`, error);
    }

    await browser.close();
};

// Perform login and collect metrics under different network conditions
(async () => {
    const apps = [
        {
            url: process.env.ANGULAR_APP_URL,
            type: "angular"
        },
        {
            url: process.env.VUE_APP_URL,
            type: "vue"
        },
        {
            url: process.env.REACT_APP_URL,
            type: "react"
        }
    ];

    for (const app of apps) {
        for (const condition in networkConditions) {
            if (condition in networkConditions && app.url) {
                await performTest(condition as NetworkConditionKey, app.type, app.url);
            }
        }

        for (const cpuSlowdown in cpuSlowdowns) {
            if (cpuSlowdown in cpuSlowdowns && app.url) {
                await performTest('noThrottling' as NetworkConditionKey, app.type, app.url, cpuSlowdown as CPUConditionKey);
            }
        }

        if (app.url)
            await collectLighthouseMetrics(app.type, app.url);

    }
})();
