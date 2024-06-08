import { configureAppUrl } from "../common/setup";
import { launchBrowser } from "../common/helpers";
import * as path from "path";
import * as fs from "fs";
import {performanceTimingMetrics, processPerformanceTiming} from "../common/metrics";
import { LHResult } from "lighthouse/report/generator/report-generator";
import puppeteer, { Page, PredefinedNetworkConditions } from 'puppeteer';

const lighthouse = require('lighthouse/core/index.cjs');

configureAppUrl(); // Set up environment variables

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
        "metrics" : lhr.audits['metrics'],
        "resource-summary": lhr.audits['resource-summary']};

};

const performTest = async (conditionName: NetworkConditionKey) => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    // Increase the default navigation timeout
    page.setDefaultNavigationTimeout(1200000); // 2 minutes

    // Load environment variables
    const loginUrl = `${process.env.APP_URL}login` ?? '';
    const username = process.env.DOCTOR_USERNAME ?? '';
    const password = process.env.PASSWORD ?? '';
    const appType = process.argv[2] as NetworkConditionKey; // Get the app type from command line arguments

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
            await page.goto(loginUrl, { waitUntil: 'networkidle2' });

            const puppeter_metrics = await page.metrics();

            // Gather initial performance metrics
            const initialPerformanceTiming = await performanceTimingMetrics(page);
            const processedInitialMetrics = processPerformanceTiming(initialPerformanceTiming);

            // Perform login
            await page.type('#email-input', username);
            await page.type('#password-input', password);
            await page.click('#submit-btn');

            // Wait for navigation after login
            try {
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 1200000 });
            } catch (error) {
                console.error('Navigation to home page after login failed:', error);
            }

            // Verify login by checking the URL or a specific element on the home page
            let loginSuccessful = false;
            if (page.url() === process.env.APP_URL) {
                loginSuccessful = true;
                console.log('Login successful');
            } else {
                console.log('Login failed');
            }

            // Save metrics to a file
            const metrics = {
                initialPerformanceTiming: processedInitialMetrics,
                puppeter_metrics:puppeter_metrics,
                loginSuccessful
            };
            const metricsFilePath = path.resolve(__dirname, `../../../results/login/${appType}-${conditionName}-metrics.json`);
            fs.writeFileSync(metricsFilePath, JSON.stringify(metrics, null, 2));
            console.log(`Metrics saved for ${conditionName}: ${metricsFilePath}`);

            // Collect Lighthouse metrics
            const wsEndpoint = new URL(browser.wsEndpoint());
            const port = parseInt(wsEndpoint.port, 10);
            const { lhr } = await lighthouse(page.url(), { port }, null);
            const lighthouseMetrics = extractLighthouseMetrics(lhr);

            // Save Lighthouse metrics
            const lighthouseFilePath = path.resolve(__dirname, `../../../results/login/${appType}-${conditionName}-lighthouse.json`);
            fs.writeFileSync(lighthouseFilePath, JSON.stringify(lighthouseMetrics, null, 2));
            console.log(`Lighthouse metrics saved for ${conditionName}: ${lighthouseFilePath}`);
        } catch (error) {
            console.error(`Error during metrics collection for condition ${conditionName}:`, error);
        }

    await browser.close();
};

// Perform login and collect metrics under different network conditions
(async() => {
    for (const condition in networkConditions) {
    if (condition in networkConditions) {
        await performTest(condition as NetworkConditionKey);
    }
}
})();