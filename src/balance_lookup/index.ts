import { createLogger, format, transports } from 'winston';
import { VirtualWitnessNode } from '../virtual_witness_node';
import { Config } from '../config';
import { Account, Balance, Asset } from '../types';

interface BalanceInfo {
    asset: string;
    amount: number;
    formatted_amount: string;
    asset_precision: number;
    asset_symbol: string;
    account_id: string;
    last_claim_date?: string;
}

interface BalanceSummary {
    total_assets: number;
    balances: BalanceInfo[];
    account: Account | null;
}

export class BalanceLookup {
    private witnessNode: VirtualWitnessNode;
    private config: Config;
    private logger: ReturnType<typeof createLogger>;
    private assetCache: Map<string, Asset> = new Map();

    constructor(witnessNode: VirtualWitnessNode, config?: Config) {
        this.witnessNode = witnessNode;
        this.config = config || this.getDefaultConfig();

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

        this.logger.info('BalanceLookup module initialized');
    }

    private getDefaultConfig(): Config {
        return {
            server: { port: 8090, host: 'localhost', wsPath: '/ws' },
            data: {
                accountsPath: 'data/accounts.json',
                balancesPath: 'data/balances.json',
                assetsPath: 'data/assets.json',
                walletPath: 'wallet.json'
            },
            logging: { level: 'info', errorLogPath: 'error.log', combinedLogPath: 'combined.log', console: false },
            security: { maxLoginAttempts: 3, sessionTimeout: 3600000, rateLimit: { windowMs: 60000, maxRequests: 100 } }
        };
    }

    /**
     * Get balance information for a user by username
     */
    public async getBalance(username: string): Promise<BalanceInfo | null> {
        try {
            this.logger.info(`Looking up balance for user: ${username}`);

            // Get account information
            const account = await this.getAccountByName(username);
            if (!account) {
                this.logger.warn(`Account not found for username: ${username}`);
                return null;
            }

            // Get account balances
            const balances = await this.getAccountBalances(account.id);
            if (balances.length === 0) {
                this.logger.info(`No balances found for account: ${account.id}`);
                return null;
            }

            // Return the primary balance (usually OmniCoin)
            const primaryBalance = balances.find(b => b.asset_id === '1.3.0') || balances[0];
            const balanceInfo = await this.formatBalance(primaryBalance);

            this.logger.info(`Balance retrieved for ${username}: ${balanceInfo.formatted_amount} ${balanceInfo.asset_symbol}`);
            return balanceInfo;

        } catch (error) {
            this.logger.error(`Failed to get balance for ${username}:`, error);
            return null;
        }
    }

    /**
     * Get comprehensive balance summary for a user
     */
    public async getBalanceSummary(username: string): Promise<BalanceSummary | null> {
        try {
            this.logger.info(`Getting balance summary for user: ${username}`);

            // Get account information
            const account = await this.getAccountByName(username);
            if (!account) {
                return null;
            }

            // Get all account balances
            const balances = await this.getAccountBalances(account.id);
            
            // Format all balances
            const formattedBalances: BalanceInfo[] = [];
            for (const balance of balances) {
                const balanceInfo = await this.formatBalance(balance);
                formattedBalances.push(balanceInfo);
            }

            const summary: BalanceSummary = {
                total_assets: formattedBalances.length,
                balances: formattedBalances,
                account
            };

            this.logger.info(`Balance summary retrieved for ${username}: ${summary.total_assets} assets`);
            return summary;

        } catch (error) {
            this.logger.error(`Failed to get balance summary for ${username}:`, error);
            return null;
        }
    }

    /**
     * Get balance for a specific asset
     */
    public async getAssetBalance(username: string, assetSymbol: string): Promise<BalanceInfo | null> {
        try {
            const account = await this.getAccountByName(username);
            if (!account) {
                return null;
            }

            // Find asset by symbol
            const asset = await this.getAssetBySymbol(assetSymbol);
            if (!asset) {
                this.logger.warn(`Asset not found: ${assetSymbol}`);
                return null;
            }

            // Get specific balance
            const balance = await this.getSpecificBalance(account.id, asset.id);
            if (!balance) {
                this.logger.info(`No balance found for ${username} in asset ${assetSymbol}`);
                return null;
            }

            return await this.formatBalance(balance);

        } catch (error) {
            this.logger.error(`Failed to get asset balance for ${username} (${assetSymbol}):`, error);
            return null;
        }
    }

    /**
     * Check if user has sufficient balance for a transaction
     */
    public async hasSufficientBalance(username: string, assetSymbol: string, requiredAmount: number): Promise<boolean> {
        try {
            const balance = await this.getAssetBalance(username, assetSymbol);
            if (!balance) {
                return false;
            }

            return balance.amount >= requiredAmount;

        } catch (error) {
            this.logger.error(`Failed to check sufficient balance for ${username}:`, error);
            return false;
        }
    }

    /**
     * Get vesting balance for a user
     */
    public async getVestingBalance(username: string): Promise<BalanceInfo | null> {
        try {
            const account = await this.getAccountByName(username);
            if (!account) {
                return null;
            }

            const vestingBalance = await this.getVestingBalanceForAccount(account.id);
            if (!vestingBalance) {
                return null;
            }

            return await this.formatBalance(vestingBalance);

        } catch (error) {
            this.logger.error(`Failed to get vesting balance for ${username}:`, error);
            return null;
        }
    }

    /**
     * Helper method to get account by name using witness node
     */
    private async getAccountByName(username: string): Promise<Account | null> {
        try {
            // In a real implementation, this would make an API call to the witness node
            // For now, we'll simulate the request
            const request = {
                id: Date.now(),
                method: 'get_account_by_name',
                params: [username]
            };

            // Simulate witness node response
            const response = await (this.witnessNode as any).handleRequest(request);
            return response.result;

        } catch (error) {
            this.logger.error(`Failed to get account by name: ${username}`, error);
            return null;
        }
    }

    /**
     * Helper method to get account balances using witness node
     */
    private async getAccountBalances(accountId: string): Promise<Balance[]> {
        try {
            const request = {
                id: Date.now(),
                method: 'get_account_balances',
                params: [accountId]
            };

            const response = await (this.witnessNode as any).handleRequest(request);
            return response.result || [];

        } catch (error) {
            this.logger.error(`Failed to get account balances for: ${accountId}`, error);
            return [];
        }
    }

    /**
     * Helper method to get specific balance using witness node
     */
    private async getSpecificBalance(accountId: string, assetId: string): Promise<Balance | null> {
        try {
            const request = {
                id: Date.now(),
                method: 'get_balance',
                params: [accountId, assetId]
            };

            const response = await (this.witnessNode as any).handleRequest(request);
            return response.result;

        } catch (error) {
            this.logger.error(`Failed to get specific balance for: ${accountId}, ${assetId}`, error);
            return null;
        }
    }

    /**
     * Helper method to get vesting balance using witness node
     */
    private async getVestingBalanceForAccount(accountId: string): Promise<Balance | null> {
        try {
            const request = {
                id: Date.now(),
                method: 'get_vesting_balance',
                params: [accountId]
            };

            const response = await (this.witnessNode as any).handleRequest(request);
            return response.result;

        } catch (error) {
            this.logger.error(`Failed to get vesting balance for: ${accountId}`, error);
            return null;
        }
    }

    /**
     * Format balance with asset information
     */
    private async formatBalance(balance: Balance): Promise<BalanceInfo> {
        const asset = await this.getAsset(balance.asset_id);
        const precision = asset?.precision || 5;
        const symbol = asset?.symbol || 'UNKNOWN';
        
        const formattedAmount = (balance.amount / Math.pow(10, precision)).toFixed(precision);

        return {
            asset: balance.asset_id,
            amount: balance.amount,
            formatted_amount: formattedAmount,
            asset_precision: precision,
            asset_symbol: symbol,
            account_id: balance.account_id,
            last_claim_date: balance.last_claim_date
        };
    }

    /**
     * Get asset information (with caching)
     */
    private async getAsset(assetId: string): Promise<Asset | null> {
        // Check cache first
        if (this.assetCache.has(assetId)) {
            return this.assetCache.get(assetId)!;
        }

        try {
            // Load asset from witness node or data source
            // For now, we'll use hardcoded asset data
            const asset = this.getHardcodedAsset(assetId);
            if (asset) {
                this.assetCache.set(assetId, asset);
            }
            return asset;

        } catch (error) {
            this.logger.error(`Failed to get asset: ${assetId}`, error);
            return null;
        }
    }

    /**
     * Get asset by symbol
     */
    private async getAssetBySymbol(symbol: string): Promise<Asset | null> {
        // In a real implementation, this would query the witness node
        const assetMap: { [symbol: string]: string } = {
            'OMNI': '1.3.0',
            'BTC': '1.3.1',
            'ETH': '1.3.2'
        };

        const assetId = assetMap[symbol];
        if (!assetId) {
            return null;
        }

        return await this.getAsset(assetId);
    }

    /**
     * Hardcoded asset data for testing
     */
    private getHardcodedAsset(assetId: string): Asset | null {
        const assets: { [id: string]: Asset } = {
            '1.3.0': {
                id: '1.3.0',
                symbol: 'OMNI',
                precision: 5,
                issuer: '1.2.0',
                options: {},
                dynamic_asset_data_id: '2.3.0'
            },
            '1.3.1': {
                id: '1.3.1',
                symbol: 'BTC',
                precision: 8,
                issuer: '1.2.0',
                options: {},
                dynamic_asset_data_id: '2.3.1'
            },
            '1.3.2': {
                id: '1.3.2',
                symbol: 'ETH',
                precision: 18,
                issuer: '1.2.0',
                options: {},
                dynamic_asset_data_id: '2.3.2'
            }
        };

        return assets[assetId] || null;
    }

    /**
     * Clear asset cache
     */
    public clearAssetCache(): void {
        this.assetCache.clear();
        this.logger.info('Asset cache cleared');
    }
} 