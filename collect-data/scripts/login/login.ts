import {launchBrowser} from "../common/helpers";
import * as path from "path";
import * as fs from "fs";
import {performanceTimingMetrics, processPerformanceTiming} from "../common/metrics";
import {Page, PredefinedNetworkConditions} from 'puppeteer';

const lighthouse = require('lighthouse/core/index.cjs');


const slow3G = PredefinedNetworkConditions['Slow 3G'];
const fast3G = PredefinedNetworkConditions['Fast 3G'];

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
        "metrics": lhr.audits['metrics'],
        "resource-summary": lhr.audits['resource-summary']
    };

};

const performTest = async (conditionName: NetworkConditionKey, appType: string, appUrl: string) => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    // Increase the default navigation timeout
    page.setDefaultNavigationTimeout(1200000);

    // Load environment variables
    const loginUrl = `${appUrl}login` ?? '';
    const username = process.env.DOCTOR_USERNAME ?? '';
    const password = process.env.PASSWORD ?? '';

    console.log(`Navigating to: ${loginUrl}`);
    console.log(`Using credentials: ${username} / ${password}`);

    try {
        // Apply network conditions
        await client.send('Network.enable');
        // Simulated network throttling
        await simulateNetworkConditions(page, conditionName);

        // Start performance analysis
        await client.send('Performance.enable');

        // Navigate to login page
        await page.goto(loginUrl, {waitUntil: 'networkidle2'});

        const puppeter_metrics = await page.metrics();

        // Gather initial performance metrics
        const initialPerformanceTiming = await performanceTimingMetrics(page);
        const processedBrowserMetrics = processPerformanceTiming(initialPerformanceTiming);

        // Perform login
        await page.type('#email-input', username);
        await page.type('#password-input', password);
        await page.click('#submit-btn');

        // Wait for navigation after login
        try {
            await page.waitForNavigation({waitUntil: 'networkidle2', timeout: 1200000});
        } catch (error) {
            console.error('Navigation to home page after login failed:', error);
        }

        // Verify login by checking the URL or a specific element on the home page
        let loginSuccessful = false;
        const hero = await page.$('#hero');
        if (hero) {
            loginSuccessful = true;
            console.log('Login successful');
        } else {
            console.log('Login failed');
        }

        // Collect Lighthouse metrics
        const wsEndpoint = new URL(browser.wsEndpoint());
        const port = parseInt(wsEndpoint.port, 10);
        const {lhr} = await lighthouse(page.url(), {port}, null);
        const lighthouseMetrics = extractLighthouseMetrics(lhr);

        // Save metrics to a file
        const metrics = {
            browserPerformanceTiming: processedBrowserMetrics,
            puppeterMetrics: puppeter_metrics,
            lighthouseMetrics: lighthouseMetrics,
            loginSuccessful
        };
        const metricsFilePath = path.resolve(__dirname, `../../../results/login/metrics/${appType}-${conditionName}-metrics.json`);
        fs.writeFileSync(metricsFilePath, JSON.stringify(metrics, null, 2));
        console.log(`Metrics saved for ${conditionName}: ${metricsFilePath}`);

    } catch (error) {
        console.error(`Error during metrics collection for condition ${conditionName}:`, error);
    }

    await browser.close();
};

// Perform login and collect metrics under different network conditions
(async () => {
    const apps = [
        {
            "url": process.env.ANGULAR_APP_URL,
            "type": "angular"
        },
        {
            "url": process.env.VUE_APP_URL,
            "type": "vue"
        },
        {
            "url": process.env.REACT_APP_URL,
            "type": "react"
        }
    ]

    for (const app of apps) {
        for (const condition in networkConditions) {
            if (condition in networkConditions && app.url) {
                await performTest(condition as NetworkConditionKey, app.type, app.url);
            }
        }
    }
})();