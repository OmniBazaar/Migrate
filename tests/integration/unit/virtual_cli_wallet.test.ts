import { VirtualWallet } from '../virtual_cli_wallet';
import { Config } from '../config';
import { readFileSync, writeFileSync } from 'fs';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn()
    }));
});

// Mock fs functions
jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFileSync: jest.fn()
}));

describe('VirtualWallet', () => {
    let wallet: VirtualWallet;
    let config: Config;

    beforeEach(() => {
        config = {
            server: {
                port: 8090,
                host: 'localhost',
                wsPath: '/ws'
            },
            data: {
                accountsPath: 'accounts.json',
                balancesPath: 'balances.json',
                assetsPath: 'assets.json',
                walletPath: 'wallet.json'
            },
            logging: {
                level: 'info',
                errorLogPath: 'error.log',
                combinedLogPath: 'combined.log',
                console: true
            },
            security: {
                maxLoginAttempts: 3,
                sessionTimeout: 3600000,
                rateLimit: {
                    windowMs: 60000,
                    maxRequests: 100
                }
            }
        };

        // Mock WebSocket message handler
        const mockWs = new WebSocket('ws://localhost:8090');
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
        
        // Mock successful responses
        messageHandler(JSON.stringify({
            id: 1,
            result: true
        }));

        wallet = new VirtualWallet();
    });

    test('should create wallet successfully', async () => {
        const result = await wallet.createWallet('testpassword');
        expect(result).toBe(true);
        expect(writeFileSync).toHaveBeenCalled();
    });

    test('should handle login successfully', async () => {
        const result = await wallet.login('testuser', 'testpassword');
        expect(result).toBe(true);
    });

    test('should get account by name', async () => {
        const account = await wallet.getAccountByName('testuser');
        expect(account).toBeDefined();
    });

    test('should get account balances', async () => {
        const balances = await wallet.getAccountBalances('1.2.0');
        expect(Array.isArray(balances)).toBe(true);
    });

    test('should get specific balance', async () => {
        const balance = await wallet.getBalance('1.2.0', '1.3.0');
        expect(balance).toBeDefined();
    });

    test('should handle WebSocket connection error', async () => {
        const mockWs = new WebSocket('ws://localhost:8090');
        const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error')[1];
        
        errorHandler(new Error('Connection failed'));
        
        await expect(wallet.login('testuser', 'testpassword'))
            .rejects
            .toThrow('Not connected to witness node');
    });

    test('should handle invalid credentials', async () => {
        const mockWs = new WebSocket('ws://localhost:8090');
        const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];
        
        // Mock failed login response
        messageHandler(JSON.stringify({
            id: 1,
            result: false
        }));

        const result = await wallet.login('testuser', 'wrongpassword');
        expect(result).toBe(false);
    });

    test('should handle wallet file read error', () => {
        (readFileSync as jest.Mock).mockImplementationOnce(() => {
            throw new Error('File read error');
        });

        expect(() => new VirtualWallet()).not.toThrow();
    });

    test('should handle wallet file write error', async () => {
        (writeFileSync as jest.Mock).mockImplementationOnce(() => {
            throw new Error('File write error');
        });

        const result = await wallet.createWallet('testpassword');
        expect(result).toBe(false);
    });
}); 