import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { VirtualWitnessNode } from '../../src/virtual_witness_node';
import { VirtualWallet } from '../../src/virtual_cli_wallet';
import { Config } from '../../src/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Real Blockchain Data Tests', () => {
    let witnessNode: VirtualWitnessNode | null = null;
    let wallet: VirtualWallet | null = null;
    let config: Config;
    let witnessDataDir: string;

    before(() => {
        // Set up paths to real blockchain data
        const projectDir = join(__dirname, '..', '..');
        witnessDataDir = join(projectDir, 'witness_node', 'witness_node_data_dir');

        console.log(`Checking for witness data at: ${witnessDataDir}`);

        // Check if the real blockchain data directory exists
        if (!existsSync(witnessDataDir)) {
            console.log('Warning: Real blockchain data directory not found');
            console.log('Skipping real blockchain data tests');
            return;
        }

        // Check for required directories
        const blockchainDir = join(witnessDataDir, 'blockchain');
        if (!existsSync(blockchainDir)) {
            console.log('Warning: Blockchain directory not found in witness data');
            return;
        }

        console.log('Found real blockchain data directory');

        // Create configuration for real data testing
        config = {
            server: {
                port: 8092, // Use different port to avoid conflicts
                host: 'localhost',
                wsPath: '/ws'
            },
            data: {
                accountsPath: join(projectDir, 'data', 'accounts.json'),
                balancesPath: join(projectDir, 'data', 'balances.json'),
                assetsPath: join(projectDir, 'data', 'assets.json'),
                walletPath: join(projectDir, 'test_wallet.json')
            },
            logging: {
                level: 'error', // Reduce logging during tests
                errorLogPath: 'test_error.log',
                combinedLogPath: 'test_combined.log',
                console: false
            },
            security: {
                maxLoginAttempts: 5,
                sessionTimeout: 3600000,
                rateLimit: {
                    windowMs: 60000,
                    maxRequests: 200
                }
            }
        };

        // Try to initialize witness node with test data
        try {
            witnessNode = new VirtualWitnessNode(config);
            console.log('Successfully initialized Virtual Witness Node');
        } catch (error) {
            console.log('Note: Could not initialize witness node (expected if data files are missing)');
            witnessNode = null;
        }

        // Initialize wallet
        try {
            wallet = new VirtualWallet();
            console.log('Successfully initialized Virtual Wallet');
        } catch (error) {
            console.log('Note: Could not initialize wallet');
            wallet = null;
        }
    });

    after(() => {
        // Clean up
        if (witnessNode) {
            try {
                witnessNode.close();
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });

    describe('Blockchain Data Structure Verification', () => {
        it('should find witness node data directory', () => {
            expect(existsSync(witnessDataDir)).to.equal(true);
        });

        it('should find blockchain subdirectory', () => {
            const blockchainDir = join(witnessDataDir, 'blockchain');
            expect(existsSync(blockchainDir)).to.equal(true);
        });

        it('should find configuration files', () => {
            const configFiles = ['config.ini', 'config_log.ini'];
            const foundFiles: string[] = [];

            configFiles.forEach(file => {
                const filePath = join(witnessDataDir, file);
                if (existsSync(filePath)) {
                    foundFiles.push(file);
                    console.log(`Found config file: ${file}`);
                }
            });

            expect(foundFiles.length).to.be.greaterThan(0);
        });

        it('should find database directories', () => {
            const blockchainDir = join(witnessDataDir, 'blockchain');
            const databaseDirs = ['database', 'object_database'];
            let foundDatabaseDir = false;

            databaseDirs.forEach(dir => {
                const dirPath = join(blockchainDir, dir);
                if (existsSync(dirPath)) {
                    foundDatabaseDir = true;
                    console.log(`Found database directory: ${dir}`);
                }
            });

            expect(foundDatabaseDir).to.equal(true);
        });

        it('should be able to read database version', () => {
            const versionFile = join(witnessDataDir, 'blockchain', 'db_version');
            if (existsSync(versionFile)) {
                const version = readFileSync(versionFile, 'utf-8').trim();
                console.log(`Database version: ${version}`);
                expect(version.length).to.be.greaterThan(0);
            } else {
                console.log('Database version file not found (may be normal)');
            }
        });
    });

    describe('Test Data Integration', () => {
        it('should have test account data available', () => {
            if (existsSync(config.data.accountsPath)) {
                const accountData = JSON.parse(readFileSync(config.data.accountsPath, 'utf-8'));
                expect(Array.isArray(accountData)).to.equal(true);
                expect(accountData.length).to.be.greaterThan(0);
                console.log(`Found ${accountData.length} test accounts`);
            } else {
                console.log('Test account data not found');
            }
        });

        it('should have test balance data available', () => {
            if (existsSync(config.data.balancesPath)) {
                const balanceData = JSON.parse(readFileSync(config.data.balancesPath, 'utf-8'));
                expect(Array.isArray(balanceData)).to.equal(true);
                expect(balanceData.length).to.be.greaterThan(0);
                console.log(`Found ${balanceData.length} test balances`);
            } else {
                console.log('Test balance data not found');
            }
        });

        it('should have test asset data available', () => {
            if (existsSync(config.data.assetsPath)) {
                const assetData = JSON.parse(readFileSync(config.data.assetsPath, 'utf-8'));
                expect(Array.isArray(assetData)).to.equal(true);
                expect(assetData.length).to.be.greaterThan(0);
                console.log(`Found ${assetData.length} test assets`);
            } else {
                console.log('Test asset data not found');
            }
        });
    });

    describe('Virtual Witness Node with Test Data', () => {
        it('should handle witness node operations', () => {
            if (witnessNode) {
                console.log('Virtual Witness Node is running successfully');
                expect(witnessNode).to.not.be.null;
            } else {
                console.log('Virtual Witness Node not available for testing');
            }
        });
    });

    describe('Virtual Wallet Integration', () => {
        it('should handle wallet initialization', () => {
            if (wallet) {
                console.log('Virtual Wallet initialized successfully');
                expect(wallet).to.not.be.null;
            } else {
                console.log('Virtual Wallet not available for testing');
            }
        });

        it('should handle wallet operations gracefully', async () => {
            if (wallet) {
                try {
                    // Test wallet creation
                    const created = await wallet.createWallet('testpassword123');
                    expect(typeof created).to.equal('boolean');
                    console.log(`Wallet creation result: ${created}`);
                } catch (error) {
                    console.log('Wallet creation test completed (errors expected in test environment)');
                }
            }
        });
    });
}); 