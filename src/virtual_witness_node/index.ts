import WebSocket from 'ws';
import { createLogger, format, transports } from 'winston';
import { readFileSync } from 'fs';
import { Config } from '../../config';

interface Account {
    id: string;
    name: string;
    owner_key: string;
    active_key: string;
    memo_key: string;
}

interface Balance {
    account_id: string;
    asset_id: string;
    amount: number;
    owner: string;
    last_claim_date: string;
}

interface Asset {
    id: string;
    symbol: string;
    precision: number;
    issuer: string;
    options: Record<string, unknown>;
    dynamic_asset_data_id: string;
}

interface Request {
    id: number;
    method: string;
    params: any[];
}

interface Response {
    id: number;
    result?: any;
    error?: {
        code: number;
        message: string;
    };
}

export class VirtualWitnessNode {
    private wsServer: WebSocket.Server;
    private accounts: Map<string, Account>;
    private balances: Map<string, Balance[]>;
    private assets: Map<string, Asset>;
    private logger: ReturnType<typeof createLogger>;
    private config: Config;
    private loginAttempts: Map<string, number>;
    private lastRequestTime: Map<string, number[]>;

    constructor(config: Config) {
        this.config = config;
        this.accounts = new Map();
        this.balances = new Map();
        this.assets = new Map();
        this.loginAttempts = new Map();
        this.lastRequestTime = new Map();

        // Configure logger
        this.logger = createLogger({
            level: config.logging.level,
            format: format.combine(
                format.timestamp(),
                format.json()
            ),
            transports: [
                new transports.File({ filename: config.logging.errorLogPath, level: 'error' }),
                new transports.File({ filename: config.logging.combinedLogPath }),
                ...(config.logging.console ? [new transports.Console({
                    format: format.combine(
                        format.colorize(),
                        format.simple()
                    )
                })] : [])
            ]
        });

        // Load data
        this.loadData();

        // Start WebSocket server
        this.wsServer = new WebSocket.Server({
            port: config.server.port,
            host: config.server.host,
            path: config.server.wsPath
        });

        this.wsServer.on('connection', this.handleConnection.bind(this));
        this.wsServer.on('error', (error: Error) => {
            this.logger.error('WebSocket server error:', error);
        });

        this.logger.info(`Virtual witness node started on ws://${config.server.host}:${config.server.port}${config.server.wsPath}`);
    }

    private loadData(): void {
        try {
            const accountsData = JSON.parse(readFileSync(this.config.data.accountsPath, 'utf-8')) as Account[];
            const balancesData = JSON.parse(readFileSync(this.config.data.balancesPath, 'utf-8')) as Balance[];
            const assetsData = JSON.parse(readFileSync(this.config.data.assetsPath, 'utf-8')) as Asset[];

            accountsData.forEach(account => {
                this.accounts.set(account.id, account);
            });

            balancesData.forEach(balance => {
                const accountBalances = this.balances.get(balance.account_id) || [];
                accountBalances.push(balance);
                this.balances.set(balance.account_id, accountBalances);
            });

            assetsData.forEach(asset => {
                this.assets.set(asset.id, asset);
            });

            this.logger.info(`Loaded ${this.accounts.size} accounts, ${this.balances.size} balance records, and ${this.assets.size} assets`);
        } catch (error) {
            this.logger.error('Failed to load data:', error);
            throw new Error('Failed to load accounts data');
        }
    }

    private handleConnection(ws: WebSocket): void {
        this.logger.info('New client connected');

        ws.on('message', async (data: string) => {
            try {
                const request = JSON.parse(data) as Request;
                const response = await this.handleRequest(request);
                ws.send(JSON.stringify(response));
            } catch (error) {
                this.logger.error('Error handling message:', error);
                ws.send(JSON.stringify({
                    id: 0,
                    error: {
                        code: -32603,
                        message: 'Internal error'
                    }
                }));
            }
        });

        ws.on('close', () => {
            this.logger.info('Client disconnected');
        });

        ws.on('error', (error: Error) => {
            this.logger.error('WebSocket error:', error);
        });
    }

    private async handleRequest(request: Request): Promise<Response> {
        // Rate limiting
        const clientId = request.id.toString();
        const now = Date.now();
        const clientRequests = this.lastRequestTime.get(clientId) || [];
        const windowStart = now - this.config.security.rateLimit.windowMs;
        
        // Remove old requests outside the window
        const recentRequests = clientRequests.filter(time => time > windowStart);
        recentRequests.push(now);
        this.lastRequestTime.set(clientId, recentRequests);

        if (recentRequests.length > this.config.security.rateLimit.maxRequests) {
            return {
                id: request.id,
                error: {
                    code: -32000,
                    message: 'Rate limit exceeded'
                }
            };
        }

        // Method handling
        switch (request.method) {
            case 'login':
                return this.handleLogin(request);
            case 'get_account_by_name':
                return this.handleGetAccountByName(request);
            case 'get_account_balances':
                return this.handleGetAccountBalances(request);
            case 'get_balance':
                return this.handleGetBalance(request);
            case 'get_vesting_balance':
                return this.handleGetVestingBalance(request);
            default:
                return {
                    id: request.id,
                    error: {
                        code: -32601,
                        message: 'Method not found'
                    }
                };
        }
    }

    private handleLogin(request: Request): Response {
        const [username, password] = request.params;
        
        if (!username || !password) {
            return {
                id: request.id,
                error: {
                    code: -32602,
                    message: 'Invalid params'
                }
            };
        }

        const attempts = this.loginAttempts.get(username) || 0;
        if (attempts >= this.config.security.maxLoginAttempts) {
            return {
                id: request.id,
                error: {
                    code: -32001,
                    message: 'Too many login attempts'
                }
            };
        }

        // In a real implementation, you would validate the credentials
        // For now, we'll just check if the account exists
        const account = Array.from(this.accounts.values()).find(a => a.name === username);
        if (!account) {
            this.loginAttempts.set(username, attempts + 1);
            return {
                id: request.id,
                result: false
            };
        }

        this.loginAttempts.delete(username);
        return {
            id: request.id,
            result: true
        };
    }

    private handleGetAccountByName(request: Request): Response {
        const [name] = request.params;
        
        if (!name) {
            return {
                id: request.id,
                error: {
                    code: -32602,
                    message: 'Invalid params'
                }
            };
        }

        const account = Array.from(this.accounts.values()).find(a => a.name === name);
        if (!account) {
            return {
                id: request.id,
                result: null
            };
        }

        return {
            id: request.id,
            result: account
        };
    }

    private handleGetAccountBalances(request: Request): Response {
        const [accountId] = request.params;
        
        if (!accountId) {
            return {
                id: request.id,
                error: {
                    code: -32602,
                    message: 'Invalid params'
                }
            };
        }

        const balances = this.balances.get(accountId) || [];
        return {
            id: request.id,
            result: balances
        };
    }

    private handleGetBalance(request: Request): Response {
        const [accountId, assetId] = request.params;
        
        if (!accountId || !assetId) {
            return {
                id: request.id,
                error: {
                    code: -32602,
                    message: 'Invalid params'
                }
            };
        }

        const balances = this.balances.get(accountId) || [];
        const balance = balances.find(b => b.asset_id === assetId);
        
        if (!balance) {
            return {
                id: request.id,
                result: null
            };
        }

        return {
            id: request.id,
            result: balance
        };
    }

    private handleGetVestingBalance(request: Request): Response {
        const [accountId] = request.params;
        
        if (!accountId) {
            return {
                id: request.id,
                error: {
                    code: -32602,
                    message: 'Invalid params'
                }
            };
        }

        const balances = this.balances.get(accountId) || [];
        const vestingBalance = balances.find(b => b.asset_id === '1.3.0'); // Assuming 1.3.0 is the vesting asset
        
        if (!vestingBalance) {
            return {
                id: request.id,
                result: null
            };
        }

        return {
            id: request.id,
            result: vestingBalance
        };
    }

    public close(): void {
        this.wsServer.close();
        this.logger.info('Virtual witness node stopped');
    }
} 