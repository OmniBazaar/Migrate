import { WebSocketServer } from 'ws';
import { VirtualWitnessNode } from '../virtual_witness_node';
import { Config } from '../config';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock data
const mockAccounts = [
    {
        id: '1.2.0',
        name: 'testuser',
        owner_key: 'test_owner_key',
        active_key: 'test_active_key',
        memo_key: 'test_memo_key'
    }
];

const mockBalances = [
    {
        account_id: '1.2.0',
        asset_id: '1.3.0',
        amount: 1000.0,
        owner: '1.2.0',
        last_claim_date: '2024-02-20T00:00:00Z'
    }
];

const mockAssets = [
    {
        id: '1.3.0',
        symbol: 'OMNI',
        precision: 5,
        issuer: '1.2.0',
        options: {},
        dynamic_asset_data_id: '2.3.0'
    }
];

// Mock fs.readFileSync
jest.mock('fs', () => ({
    readFileSync: jest.fn()
}));

describe('VirtualWitnessNode', () => {
    let node: VirtualWitnessNode;
    let config: Config;
    let wsServer: WebSocketServer;

    beforeEach(() => {
        // Mock config
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

        // Mock file reads
        (readFileSync as jest.Mock).mockImplementation((path: string) => {
            if (path === config.data.accountsPath) {
                return JSON.stringify(mockAccounts);
            }
            if (path === config.data.balancesPath) {
                return JSON.stringify(mockBalances);
            }
            if (path === config.data.assetsPath) {
                return JSON.stringify(mockAssets);
            }
            throw new Error('File not found');
        });

        node = new VirtualWitnessNode(config);
    });

    afterEach(() => {
        if (wsServer) {
            wsServer.close();
        }
    });

    test('should initialize with correct data', () => {
        expect(node).toBeDefined();
        expect(node['accounts'].size).toBe(1);
        expect(node['balances'].size).toBe(1);
        expect(node['assets'].size).toBe(1);
    });

    test('should handle get_account_by_name request', async () => {
        const response = await node['handleRequest']({
            id: 1,
            method: 'get_account_by_name',
            params: ['testuser']
        });

        expect(response).toEqual({
            id: 1,
            result: mockAccounts[0]
        });
    });

    test('should handle get_account_balances request', async () => {
        const response = await node['handleRequest']({
            id: 1,
            method: 'get_account_balances',
            params: ['1.2.0']
        });

        expect(response).toEqual({
            id: 1,
            result: mockBalances
        });
    });

    test('should handle get_balance request', async () => {
        const response = await node['handleRequest']({
            id: 1,
            method: 'get_balance',
            params: ['1.2.0', '1.3.0']
        });

        expect(response).toEqual({
            id: 1,
            result: mockBalances[0]
        });
    });

    test('should handle invalid method', async () => {
        const response = await node['handleRequest']({
            id: 1,
            method: 'invalid_method',
            params: []
        });

        expect(response).toEqual({
            id: 1,
            error: {
                code: -32601,
                message: 'Method not found'
            }
        });
    });

    test('should handle invalid parameters', async () => {
        const response = await node['handleRequest']({
            id: 1,
            method: 'get_account_by_name',
            params: []
        });

        expect(response).toEqual({
            id: 1,
            error: {
                code: -32602,
                message: 'Invalid params'
            }
        });
    });

    test('should handle file read errors', () => {
        (readFileSync as jest.Mock).mockImplementationOnce(() => {
            throw new Error('File read error');
        });

        expect(() => new VirtualWitnessNode(config)).toThrow('Failed to load accounts data');
    });
}); 