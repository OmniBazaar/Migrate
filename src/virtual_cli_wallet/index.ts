import WebSocket from 'ws';
import { createLogger, format, transports } from 'winston';
import { createInterface } from 'readline';
import { readFileSync, writeFileSync } from 'fs';
import { Config, loadConfig } from './config';

interface WalletData {
    chain_id: string;
    cipher_keys: string;
    ws_server: string;
    ws_user: string;
    ws_password: string;
}

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

export class VirtualWallet {
    private ws: WebSocket;
    private connected: boolean;
    private messageQueue: Map<number, (response: any) => void>;
    private messageId: number;
    private config: Config;
    private logger: ReturnType<typeof createLogger>;
    private walletData: WalletData | null;

    constructor(configPath?: string) {
        this.config = loadConfig(configPath);
        this.connected = false;
        this.messageQueue = new Map();
        this.messageId = 1;
        this.walletData = null;

        // Configure logger
        this.logger = createLogger({
            level: this.config.logging.level,
            format: format.combine(
                format.timestamp(),
                format.json()
            ),
            transports: [
                new transports.File({ filename: this.config.logging.errorLogPath, level: 'error' }),
                new transports.File({ filename: this.config.logging.combinedLogPath }),
                ...(this.config.logging.console ? [new transports.Console({
                    format: format.combine(
                        format.colorize(),
                        format.simple()
                    )
                })] : [])
            ]
        });

        this.connect();
        this.loadWallet();
    }

    private connect(): void {
        const wsUrl = `ws://${this.config.server.host}:${this.config.server.port}${this.config.server.wsPath}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            this.logger.info('Connected to virtual witness node');
            this.connected = true;
        });

        this.ws.on('close', () => {
            this.logger.info('Disconnected from virtual witness node');
            this.connected = false;
        });

        this.ws.on('message', (data: string) => {
            try {
                const response = JSON.parse(data);
                const callback = this.messageQueue.get(response.id);
                if (callback) {
                    callback(response);
                    this.messageQueue.delete(response.id);
                }
            } catch (error) {
                this.logger.error('Error handling message:', error);
            }
        });

        this.ws.on('error', (error: Error) => {
            this.logger.error('WebSocket error:', error);
        });
    }

    private loadWallet(): void {
        try {
            const data = readFileSync(this.config.data.walletPath, 'utf-8');
            this.walletData = JSON.parse(data);
            this.logger.info('Wallet loaded successfully');
        } catch (error) {
            this.logger.warn('No wallet file found or error loading wallet');
            this.walletData = null;
        }
    }

    private saveWallet(): void {
        try {
            if (this.walletData) {
                writeFileSync(this.config.data.walletPath, JSON.stringify(this.walletData, null, 2));
                this.logger.info('Wallet saved successfully');
            }
        } catch (error) {
            this.logger.error('Error saving wallet:', error);
        }
    }

    private async sendRequest(method: string, params: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('Not connected to witness node'));
                return;
            }

            const id = this.messageId++;
            const request = {
                id,
                method,
                params
            };

            this.messageQueue.set(id, (response) => {
                if (response.error) {
                    reject(new Error(response.error.message));
                } else {
                    resolve(response.result);
                }
            });

            this.ws.send(JSON.stringify(request));
        });
    }

    public async createWallet(password: string): Promise<boolean> {
        try {
            this.walletData = {
                chain_id: '1.3.0', // OmniCoin chain ID
                cipher_keys: '', // Will be encrypted with password
                ws_server: `ws://${this.config.server.host}:${this.config.server.port}${this.config.server.wsPath}`,
                ws_user: '',
                ws_password: ''
            };
            this.saveWallet();
            this.logger.info('Wallet created successfully');
            return true;
        } catch (error) {
            this.logger.error('Failed to create wallet:', error);
            return false;
        }
    }

    public async login(username: string, password: string): Promise<boolean> {
        try {
            const isValid = await this.sendRequest('login', [username, password]);
            if (isValid) {
                this.logger.info(`User ${username} logged in successfully`);
            } else {
                this.logger.warn(`Failed to login user ${username}`);
            }
            return isValid;
        } catch (error) {
            this.logger.error('Login failed:', error);
            return false;
        }
    }

    public async getAccountByName(name: string): Promise<Account | null> {
        try {
            const account = await this.sendRequest('get_account_by_name', [name]);
            if (account) {
                this.logger.info(`Retrieved account: ${name}`);
            } else {
                this.logger.warn(`Account not found: ${name}`);
            }
            return account;
        } catch (error) {
            this.logger.error('Failed to get account:', error);
            return null;
        }
    }

    public async getAccountBalances(accountId: string): Promise<Balance[]> {
        try {
            const balances = await this.sendRequest('get_account_balances', [accountId]);
            this.logger.info(`Retrieved ${balances.length} balances for account ${accountId}`);
            return balances;
        } catch (error) {
            this.logger.error('Failed to get account balances:', error);
            return [];
        }
    }

    public async getBalance(accountId: string, assetId: string): Promise<Balance | null> {
        try {
            const balance = await this.sendRequest('get_balance', [accountId, assetId]);
            if (balance) {
                this.logger.info(`Retrieved balance for account ${accountId}, asset ${assetId}`);
            } else {
                this.logger.warn(`Balance not found for account ${accountId}, asset ${assetId}`);
            }
            return balance;
        } catch (error) {
            this.logger.error('Failed to get balance:', error);
            return null;
        }
    }

    public async getVestingBalance(accountId: string): Promise<Balance | null> {
        try {
            const balance = await this.sendRequest('get_vesting_balance', [accountId]);
            if (balance) {
                this.logger.info(`Retrieved vesting balance for account ${accountId}`);
            } else {
                this.logger.warn(`Vesting balance not found for account ${accountId}`);
            }
            return balance;
        } catch (error) {
            this.logger.error('Failed to get vesting balance:', error);
            return null;
        }
    }

    public async validateCredentials(username: string, password: string): Promise<boolean> {
        const account = await this.getAccountByName(username);
        if (!account) {
            this.logger.warn(`Account not found: ${username}`);
            return false;
        }

        return await this.login(username, password);
    }

    public async getAccountBalance(username: string, password: string): Promise<Balance[]> {
        const isValid = await this.validateCredentials(username, password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        const account = await this.getAccountByName(username);
        if (!account) {
            throw new Error('Account not found');
        }

        return await this.getAccountBalances(account.id);
    }
}

async function main() {
    const wallet = new VirtualWallet();
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query: string): Promise<string> => {
        return new Promise((resolve) => {
            rl.question(query, resolve);
        });
    };

    try {
        const username = await question('Username: ');
        const password = await question('Password: ');

        const balances = await wallet.getAccountBalance(username, password);
        console.log('\nAccount Balances:');
        balances.forEach(balance => {
            console.log(`Asset ${balance.asset_id}: ${balance.amount}`);
        });
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        } else {
            console.error('Unknown error occurred');
        }
    } finally {
        rl.close();
    }
}

if (require.main === module) {
    main().catch(console.error);
} 