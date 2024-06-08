import {Page} from 'puppeteer';


export const performanceTimingMetrics = async (page: Page) => {
    return page.evaluate(() => JSON.stringify(window.performance.timing));
};

export const processPerformanceTiming = (rawMetrics: string) => {
    const metrics = JSON.parse(rawMetrics);

    return {
        navigationStart: metrics.navigationStart,
        request: metrics.responseStart - metrics.requestStart, // Time to first byte
        response: metrics.responseEnd - metrics.responseStart, // Response time
        domInteractive: metrics.domInteractive - metrics.navigationStart, // DOM interactive time
        domContentLoaded: metrics.domContentLoadedEventEnd - metrics.navigationStart, // DOM content loaded time
        domComplete: metrics.domComplete - metrics.navigationStart, // DOM complete time
    };
};
