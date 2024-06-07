import { configureAppUrl } from "../common/setup";
import { launchBrowser } from "../common/helpers";
import * as path from "path";
import * as fs from "fs";
import { performanceTimingMetrics, processMetrics } from "../common/metrics";

configureAppUrl(); // Set up environment variables

interface LighthouseResult {
    artifacts?: any;
    [key: string]: any;
}

const networkConditions = {
    fast3G: {
        offline: false,
        downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
        uploadThroughput: (750 * 1024) / 8, // 750 Kbps
        latency: 150 // 150 ms
    },
    slow3G: {
        offline: false,
        downloadThroughput: (500 * 1024) / 8, // 500 Kbps
        uploadThroughput: (500 * 1024) / 8, // 500 Kbps
        latency: 400 // 400 ms
    },
    noThrottling: {
        offline: false,
        downloadThroughput: -1,
        uploadThroughput: -1,
        latency: 0
    }
};

type NetworkConditionKey = keyof typeof networkConditions;

const simulateNetworkConditions = async (client: any, conditions: any) => {
    await client.send('Network.emulateNetworkConditions', conditions);
};

(async () => {
    const browser = await launchBrowser();
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();

    // Load environment variables
    const loginUrl = `${process.env.APP_URL}login` ?? '';
    const username = process.env.DOCTOR_USERNAME ?? '';
    const password = process.env.PASSWORD ?? '';
    const appType = process.argv[2] as NetworkConditionKey; // Get the app type from command line arguments

    console.log(`Navigating to: ${loginUrl}`);
    console.log(`Using credentials: ${username} / ${password}`);

    // Function to perform login and collect metrics
    const performLoginAndCollectMetrics = async (conditionName: NetworkConditionKey) => {
        // Apply network conditions
        await simulateNetworkConditions(client, networkConditions[conditionName]);

        // Navigate to login page
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        // Perform login
        await page.type('#email-input', username);
        await page.type('#password-input', password);
        await page.click('#submit-btn');

        // Wait for navigation after login
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
        } catch (error) {
            console.error('Navigation to home page after login failed:', error);
        }

        // Verify login by checking the URL or a specific element on the home page
        if (page.url() === process.env.APP_URL) {
            console.log('Login successful');
        } else {
            console.log('Login failed');
        }

        // Gather PerformanceTiming metrics
        const rawMetrics = await performanceTimingMetrics(page);
        const processedMetrics = processMetrics(rawMetrics);

        // Save PerformanceTiming metrics
        const outputFilePath = path.resolve(__dirname, `../../../results/login/${appType}-${conditionName}-metrics.json`);
        fs.writeFileSync(outputFilePath, JSON.stringify(processedMetrics, null, 2));
        console.log(`PerformanceTiming metrics saved for ${conditionName}: ${outputFilePath}`);

        // Dynamically import Lighthouse as an ES Module
        const lighthouse = require('lighthouse/core/index.cjs');
        const wsEndpoint = new URL(browser.wsEndpoint());
        const port = parseInt(wsEndpoint.port, 10);
        const lighthouseResult: any = await lighthouse(page.url(), { port }, undefined);
        delete lighthouseResult.artifacts;

        // Save Lighthouse metrics
        const lighthouseFilePath = path.resolve(__dirname, `../../../results/login/${appType}-${conditionName}-lighthouse.json`);
        fs.writeFileSync(lighthouseFilePath, JSON.stringify(lighthouseResult, null, 2));
        console.log(`Lighthouse metrics saved for ${conditionName}: ${lighthouseFilePath}`);
    };

    // Perform login and collect metrics under different network conditions
    for (const condition in networkConditions) {
        await performLoginAndCollectMetrics(condition as NetworkConditionKey);
    }

    await browser.close();
})();
