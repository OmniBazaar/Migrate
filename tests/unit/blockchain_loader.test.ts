import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { BlockchainLoader } from '../../src/blockchain_loader';
import { Config } from '../../src/config';

describe('BlockchainLoader', () => {
    let blockchainLoader: BlockchainLoader;
    let config: Config;

    beforeEach(() => {
        config = {
            server: { port: 8090, host: 'localhost', wsPath: '/ws' },
            data: {
                accountsPath: 'data/accounts.json',
                balancesPath: 'data/balances.json',
                assetsPath: 'data/assets.json',
                walletPath: 'wallet.json'
            },
            logging: { level: 'error', errorLogPath: 'test_error.log', combinedLogPath: 'test_combined.log', console: false },
            security: { maxLoginAttempts: 3, sessionTimeout: 3600000, rateLimit: { windowMs: 60000, maxRequests: 100 } }
        };

        blockchainLoader = new BlockchainLoader({ type: 'memory', path: ':memory:' }, config);
    });

    describe('Initialization', () => {
        it('should create BlockchainLoader instance', () => {
            expect(blockchainLoader).to.be.instanceOf(BlockchainLoader);
        });

        it('should initialize with correct state', () => {
            expect(blockchainLoader.isDataLoaded()).to.equal(false);
            expect(blockchainLoader.getBlockCount()).to.equal(0);
        });
    });

    describe('Data Loading', () => {
        it('should load test data successfully', async () => {
            const result = await blockchainLoader.load();
            expect(result).to.equal(true);
            expect(blockchainLoader.isDataLoaded()).to.equal(true);
        });

        it('should have accounts after loading', async () => {
            await blockchainLoader.load();
            const accounts = blockchainLoader.getAccounts();
            expect(Array.isArray(accounts)).to.equal(true);
            expect(accounts.length).to.be.greaterThan(0);
        });

        it('should have balances after loading', async () => {
            await blockchainLoader.load();
            const balances = blockchainLoader.getBalances();
            expect(Array.isArray(balances)).to.equal(true);
            expect(balances.length).to.be.greaterThan(0);
        });

        it('should have assets after loading', async () => {
            await blockchainLoader.load();
            const assets = blockchainLoader.getAssets();
            expect(Array.isArray(assets)).to.equal(true);
            expect(assets.length).to.be.greaterThan(0);
        });

        it('should generate mock blocks', async () => {
            await blockchainLoader.load();
            const blocks = blockchainLoader.getBlocks();
            expect(Array.isArray(blocks)).to.equal(true);
            expect(blocks.length).to.be.greaterThan(0);
            expect(blockchainLoader.getBlockCount()).to.be.greaterThan(0);
        });
    });

    describe('Data Validation', () => {
        it('should validate loaded data successfully', async () => {
            await blockchainLoader.load();
            const isValid = await blockchainLoader.validate();
            expect(isValid).to.equal(true);
        });

        it('should fail validation when data not loaded', async () => {
            const isValid = await blockchainLoader.validate();
            expect(isValid).to.equal(false);
        });
    });

    describe('Data Access Methods', () => {
        beforeEach(async () => {
            await blockchainLoader.load();
        });

        it('should find account by ID', () => {
            const account = blockchainLoader.getAccountById('1.2.0');
            expect(account).to.not.be.null;
            if (account) {
                expect(account.id).to.equal('1.2.0');
            }
        });

        it('should find account by name', () => {
            const account = blockchainLoader.getAccountByName('testuser');
            expect(account).to.not.be.null;
            if (account) {
                expect(account.name).to.equal('testuser');
            }
        });

        it('should get balances for specific account', () => {
            const balances = blockchainLoader.getAccountBalances('1.2.0');
            expect(Array.isArray(balances)).to.equal(true);
        });

        it('should find asset by ID', () => {
            const asset = blockchainLoader.getAssetById('1.3.0');
            expect(asset).to.not.be.null;
            if (asset) {
                expect(asset.id).to.equal('1.3.0');
                expect(asset.symbol).to.equal('OMNI');
            }
        });

        it('should return null for non-existent account', () => {
            const account = blockchainLoader.getAccountById('999.999.999');
            expect(account).to.be.null;
        });

        it('should return null for non-existent asset', () => {
            const asset = blockchainLoader.getAssetById('999.999.999');
            expect(asset).to.be.null;
        });
    });

    describe('Reload Functionality', () => {
        it('should reload data successfully', async () => {
            await blockchainLoader.load();
            expect(blockchainLoader.isDataLoaded()).to.equal(true);
            
            const result = await blockchainLoader.reload();
            expect(result).to.equal(true);
            expect(blockchainLoader.isDataLoaded()).to.equal(true);
        });
    });
}); 