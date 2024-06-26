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
    fast3G,
    slow3G
};

type NetworkConditionKey = keyof typeof networkConditions;

const simulateNetworkConditions = async (page: Page, condition?: NetworkConditionKey) => {
    if (condition && networkConditions[condition]) {
        await page.emulateNetworkConditions(networkConditions[condition]);
    }
};

const extractLighthouseMetrics = (lhr: any) => {
    return {
        metrics: lhr.audits['metrics']?.details.items[0],
        resourceSummary: lhr.audits['resource-summary']?.details.items
    };
};

const performTest = async (appType: string, appUrl: string, conditionName?: NetworkConditionKey, cpuSlowdown?: CPUConditionKey) => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    // Increase the default navigation timeout
    const timeout = conditionName ? 300000 : 120000; // 5 minutes for throttled, 2 minutes for normal
    page.setDefaultNavigationTimeout(timeout);

    // Set a consistent viewport size and disable mobile emulation
    await page.setViewport({width: 1920, height: 1080, isMobile: false});
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Load environment variables
    const loginUrl = `${appUrl}login`;
    const username = process.env.DOCTOR_USERNAME ?? '';
    const password = process.env.PASSWORD ?? '';

    console.log(`Navigating to: ${loginUrl}`);
    console.log(`Using credentials: ${username} / ${password}`);

    try {
        // Apply network conditions
        await client.send('Network.enable');
        await client.send('DOM.enable');
        await simulateNetworkConditions(page, conditionName);

        if (cpuSlowdown) {
            await page.emulateCPUThrottling(cpuSlowdowns[cpuSlowdown]);
        }

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

        // Save metrics to a file
        const conditionLabel = cpuSlowdown ? `${cpuSlowdown}-cpu` : (conditionName ? conditionName.replace(/_/g, '-').toLowerCase() : 'no-throttling');
        const metricsFilePath = path.resolve(__dirname, `../../../results/login/metrics/custom/${appType}_${conditionLabel}_metrics.json`);
        fs.writeFileSync(metricsFilePath, JSON.stringify(metrics, null, 2));
        console.log(`Metrics saved for ${conditionLabel}: ${metricsFilePath}`);

    } catch (error) {
        console.error(`Error during metrics collection for condition ${conditionName}:`, error);
    }

    await browser.close();
};

const collectLighthouseMetrics = async (appType: string, appUrl: string, conditionName?: NetworkConditionKey, cpuSlowdown?: CPUConditionKey) => {
    const browser = await launchBrowser();
    const page = await browser.newPage();

    // Increase the default navigation timeout
    page.setDefaultNavigationTimeout(1200000);

    // Set a consistent viewport size and disable mobile emulation
    await page.setViewport({width: 1920, height: 1080, isMobile: false});

    // Apply network conditions if specified
    if (conditionName) {
        await simulateNetworkConditions(page, conditionName);
    }

    // Apply CPU throttling if specified
    if (cpuSlowdown) {
        const client = await page.target().createCDPSession();
        await client.send('Emulation.setCPUThrottlingRate', {rate: cpuSlowdowns[cpuSlowdown]});
    }

    // Navigate to the login page
    const loginUrl = `${appUrl}login`;
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
            throttling: getThrottlingSettings(conditionName, cpuSlowdown),
        };
        const {lhr} = await lighthouse(page.url(), options, null);
        const lighthouseMetrics = extractLighthouseMetrics(lhr);

        // Generate a clearer file name
        let conditionLabel = 'no-throttling';
        if (cpuSlowdown) {
            conditionLabel = `${cpuSlowdown}-cpu`;
        } else if (conditionName) {
            conditionLabel = conditionName.replace(/_/g, '-').toLowerCase();
        }

        const lighthouseFilePath = path.resolve(__dirname, `../../../results/login/metrics/lighthouse/${appType}_${conditionLabel}_lighthouse_metrics.json`);
        fs.writeFileSync(lighthouseFilePath, JSON.stringify(lighthouseMetrics, null, 2));
        console.log(`Lighthouse metrics saved for ${appType} with ${conditionLabel}: ${lighthouseFilePath}`);

    } catch (error) {
        console.error(`Error during Lighthouse metrics collection for appType ${appType}:`, error);
    }

    await browser.close();
};

const getThrottlingSettings = (conditionName?: NetworkConditionKey, cpuSlowdown?: CPUConditionKey) => {
    const cpuSlowdownMultiplier = cpuSlowdown ? cpuSlowdowns[cpuSlowdown] : 1;

    const networkSettings = {
        fast3G: {
            rttMs: 150,
            throughputKbps: 1600,
            requestLatencyMs: 0,
            downloadThroughputKbps: 1600,
            uploadThroughputKbps: 750,
        },
        slow3G: {
            rttMs: 400,
            throughputKbps: 500,
            requestLatencyMs: 0,
            downloadThroughputKbps: 500,
            uploadThroughputKbps: 500,
        },
        noThrottling: {
            rttMs: 0,
            throughputKbps: 0,
            requestLatencyMs: 0,
            downloadThroughputKbps: 0,
            uploadThroughputKbps: 0,
        }
    };

    const networkThrottling = conditionName ? networkSettings[conditionName] : networkSettings.noThrottling;

    return {
        cpuSlowdownMultiplier,
        ...networkThrottling,
    };
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
        if (app.url) {
            // Network condition tests
            for (const condition in networkConditions) {
                await performTest(app.type, app.url, condition as NetworkConditionKey);
                await collectLighthouseMetrics(app.type, app.url, condition as NetworkConditionKey);
            }

            // CPU condition tests
            for (const cpuSlowdown in cpuSlowdowns) {
                await performTest(app.type, app.url, undefined, cpuSlowdown as CPUConditionKey);
                await collectLighthouseMetrics(app.type, app.url, undefined, cpuSlowdown as CPUConditionKey);
            }

            // No throttling test (only once)
            await performTest(app.type, app.url);
            await collectLighthouseMetrics(app.type, app.url);
        }
    }
})();
