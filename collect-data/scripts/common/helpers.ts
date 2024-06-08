import puppeteer, {Browser} from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();
export const launchBrowser = async (): Promise<Browser> => {
    return await puppeteer.launch({headless: true});
};
