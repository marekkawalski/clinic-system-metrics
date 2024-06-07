import puppeteer, { Page, Browser } from 'puppeteer';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
export const launchBrowser = async (): Promise<Browser> => {
    return await puppeteer.launch({ headless: true });
};


export const runPerformanceTest = async (page: Page, url: string, outputFilePath: string): Promise<void> => {
    const client = await page.target().createCDPSession();
    await client.send('Performance.enable');
    await client.send('Network.enable');
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    const performanceMetrics: any[] = [];
    client.on('Performance.metrics', (metrics) => {
        performanceMetrics.push(metrics);
    });

    const networkRequests: any[] = [];
    const networkResponses: any[] = [];
    client.on('Network.requestWillBeSent', (request) => {
        networkRequests.push(request);
    });
    client.on('Network.responseReceived', (response) => {
        networkResponses.push(response);
    });

    const domEvents: any[] = [];
    client.on('DOM.documentUpdated', () => {
        domEvents.push({ type: 'documentUpdated', timestamp: Date.now() });
    });
    client.on('DOM.childNodeInserted', (event) => {
        domEvents.push({ type: 'childNodeInserted', nodeId: event.node.nodeId, timestamp: Date.now() });
    });
    client.on('DOM.childNodeRemoved', (event) => {
        domEvents.push({ type: 'childNodeRemoved', nodeId: event.nodeId, timestamp: Date.now() });
    });

    const cpuUsage: number[] = [];
    const memoryUsage: number[] = [];
    const jsExecutionTimes: number[] = [];
    const layoutTimes: number[] = [];
    const styleRecalcTimes: number[] = [];
    const eventListenerCounts: number[] = [];
    const domNodeCounts: number[] = [];
    const ttfbMetrics: number[] = [];

    const interval = setInterval(async () => {
        const metrics = await client.send('Performance.getMetrics');
        const cpuMetric = metrics.metrics.find((m: any) => m.name === 'TaskDuration');
        if (cpuMetric) {
            cpuUsage.push(cpuMetric.value);
        }

        const memoryMetrics = await client.send('Runtime.getHeapUsage');
        memoryUsage.push(memoryMetrics.usedSize);

        const jsExecMetric = metrics.metrics.find((m: any) => m.name === 'ScriptDuration');
        if (jsExecMetric) {
            jsExecutionTimes.push(jsExecMetric.value);
        }

        const layoutMetric = metrics.metrics.find((m: any) => m.name === 'LayoutDuration');
        if (layoutMetric) {
            layoutTimes.push(layoutMetric.value);
        }

        const styleRecalcMetric = metrics.metrics.find((m: any) => m.name === 'RecalcStyleDuration');
        if (styleRecalcMetric) {
            styleRecalcTimes.push(styleRecalcMetric.value);
        }

        const eventListeners = await page.evaluate(() => Object.keys(window).filter(key => key.startsWith('on')).length);
        eventListenerCounts.push(eventListeners);

        const domNodes = await page.evaluate(() => document.getElementsByTagName('*').length);
        domNodeCounts.push(domNodes);
    }, 100);

    await page.tracing.start({ path: outputFilePath, screenshots: true });
    await page.goto(url, { waitUntil: 'networkidle0' });

    const ttfb = await page.evaluate(() => performance.timing.responseStart - performance.timing.requestStart);
    ttfbMetrics.push(ttfb);

    await page.tracing.stop();

    clearInterval(interval);

    const metrics = await client.send('Performance.getMetrics');

    const results = {
        metrics,
        networkRequests,
        networkResponses,
        performanceMetrics,
        cpuUsage,
        memoryUsage,
        jsExecutionTimes,
        layoutTimes,
        styleRecalcTimes,
        eventListenerCounts,
        domNodeCounts,
        ttfbMetrics,
        domEvents
    };

    fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2));
};
