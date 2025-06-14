import { readFileSync } from 'fs';
import { join } from 'path';

export interface Config {
    server: {
        port: number;
        host: string;
        wsPath: string;
    };
    data: {
        accountsPath: string;
        balancesPath: string;
        assetsPath: string;
        walletPath: string;
    };
    logging: {
        level: 'error' | 'warn' | 'info' | 'debug';
        errorLogPath: string;
        combinedLogPath: string;
        console: boolean;
    };
    security: {
        maxLoginAttempts: number;
        sessionTimeout: number;
        rateLimit: {
            windowMs: number;
            maxRequests: number;
        };
    };
}

const defaultConfig: Config = {
    server: {
        port: 8090,
        host: 'localhost',
        wsPath: '/ws'
    },
    data: {
        accountsPath: join(process.cwd(), 'data', 'accounts.json'),
        balancesPath: join(process.cwd(), 'data', 'balances.json'),
        assetsPath: join(process.cwd(), 'data', 'assets.json'),
        walletPath: join(process.cwd(), 'wallet.json')
    },
    logging: {
        level: 'info',
        errorLogPath: 'error.log',
        combinedLogPath: 'combined.log',
        console: true
    },
    security: {
        maxLoginAttempts: 3,
        sessionTimeout: 3600000, // 1 hour in milliseconds
        rateLimit: {
            windowMs: 60000, // 1 minute
            maxRequests: 100
        }
    }
};

export function loadConfig(configPath?: string): Config {
    try {
        if (configPath) {
            const configData = readFileSync(configPath, 'utf-8');
            return { ...defaultConfig, ...JSON.parse(configData) };
        }
        return defaultConfig;
    } catch (error) {
        console.warn('Failed to load config file, using defaults:', error);
        return defaultConfig;
    }
} 