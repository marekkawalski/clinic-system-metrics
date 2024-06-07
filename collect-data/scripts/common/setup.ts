import dotenv from 'dotenv';

dotenv.config();

export function configureAppUrl() {
    const appType = process.argv[2]; // Get the app type from command line arguments

    if (!appType) {
        throw new Error('App type is not specified. Use "vue", "angular", or "react".');
    }

    let loginUrl: string;

    if (appType === 'vue') {
        loginUrl = process.env.VUE_APP_URL ?? '';
    } else if (appType === 'angular') {
        loginUrl = process.env.ANGULAR_APP_URL ?? '';
    } else if (appType === 'react') {
        loginUrl = process.env.REACT_APP_URL ?? '';
    } else {
        throw new Error('Invalid app type. Use "vue", "angular", or "react".');
    }

    if (!loginUrl) {
        throw new Error(`No URL found for APP_ENV=${appType}`);
    }

    // Set the APP_URL environment variable
    process.env.APP_URL = loginUrl;
}
