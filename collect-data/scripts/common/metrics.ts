import { Page } from 'puppeteer';

export const performanceTimingMetrics = async (page: Page) => {
    return page.evaluate(() => JSON.stringify(window.performance.timing));
};

export const processMetrics = (rawMetrics: string) => {
    const metrics = JSON.parse(rawMetrics);
    return {
        dnsLookup: metrics.domainLookupEnd - metrics.domainLookupStart,
        tcpConnect: metrics.connectEnd - metrics.connectStart,
        request: metrics.responseStart - metrics.requestStart,
        response: metrics.responseEnd - metrics.responseStart,
        domLoaded: metrics.domContentLoadedEventEnd - metrics.navigationStart,
        domInteractive: metrics.domInteractive - metrics.navigationStart,
        pageLoad: metrics.loadEventEnd - metrics.navigationStart,
        fullTime: metrics.loadEventEnd - metrics.navigationStart
    };
};
