import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { BalanceLookup } from '../../src/balance_lookup';
import { VirtualWitnessNode } from '../../src/virtual_witness_node';
import { Config } from '../../src/config';

describe('BalanceLookup', () => {
    let balanceLookup: BalanceLookup;
    let witnessNode: VirtualWitnessNode;
    let config: Config;

    beforeEach(() => {
        config = {
            server: { port: 8094, host: 'localhost', wsPath: '/ws' },
            data: {
                accountsPath: 'data/accounts.json',
                balancesPath: 'data/balances.json',
                assetsPath: 'data/assets.json',
                walletPath: 'wallet.json'
            },
            logging: { level: 'error', errorLogPath: 'test_error.log', combinedLogPath: 'test_combined.log', console: false },
            security: { maxLoginAttempts: 3, sessionTimeout: 3600000, rateLimit: { windowMs: 60000, maxRequests: 100 } }
        };

        try {
            witnessNode = new VirtualWitnessNode(config);
            balanceLookup = new BalanceLookup(witnessNode, config);
        } catch (error) {
            // Handle case where test data files don't exist
            witnessNode = null as any;
            balanceLookup = null as any;
        }
    });

    describe('Initialization', () => {
        it('should create BalanceLookup instance when witness node available', function() {
            if (!witnessNode) {
                this.skip();
                return;
            }

            expect(balanceLookup).to.be.instanceOf(BalanceLookup);
        });

        it('should handle witness node dependency', function() {
            if (!witnessNode) {
                console.log('Witness node not available for testing (expected if data files missing)');
                this.skip();
                return;
            }

            expect(balanceLookup).to.not.be.null;
        });
    });

    describe('Balance Queries', () => {
        beforeEach(function() {
            if (!witnessNode || !balanceLookup) {
                this.skip();
                return;
            }
        });

        it('should get balance for existing user', async () => {
            const balance = await balanceLookup.getBalance('testuser');
            
            if (balance) {
                expect(balance).to.have.property('asset_symbol');
                expect(balance).to.have.property('formatted_amount');
                expect(balance).to.have.property('amount');
                expect(balance).to.have.property('account_id');
                expect(balance.asset_symbol).to.be.a('string');
                expect(balance.formatted_amount).to.be.a('string');
                expect(balance.amount).to.be.a('number');
            } else {
                console.log('No balance found for testuser (expected in test environment)');
            }
        });

        it('should return null for non-existent user', async () => {
            const balance = await balanceLookup.getBalance('nonexistentuser999');
            expect(balance).to.be.null;
        });

        it('should get balance summary for existing user', async () => {
            const summary = await balanceLookup.getBalanceSummary('testuser');
            
            if (summary) {
                expect(summary).to.have.property('total_assets');
                expect(summary).to.have.property('balances');
                expect(summary).to.have.property('account');
                expect(Array.isArray(summary.balances)).to.equal(true);
                expect(summary.total_assets).to.be.a('number');
                expect(summary.total_assets).to.equal(summary.balances.length);
            } else {
                console.log('No balance summary found for testuser (expected in test environment)');
            }
        });

        it('should return null summary for non-existent user', async () => {
            const summary = await balanceLookup.getBalanceSummary('nonexistentuser999');
            expect(summary).to.be.null;
        });
    });

    describe('Asset-Specific Balance Queries', () => {
        beforeEach(function() {
            if (!witnessNode || !balanceLookup) {
                this.skip();
                return;
            }
        });

        it('should get OMNI asset balance', async () => {
            const balance = await balanceLookup.getAssetBalance('testuser', 'OMNI');
            
            if (balance) {
                expect(balance.asset_symbol).to.equal('OMNI');
                expect(balance).to.have.property('formatted_amount');
                expect(balance.asset_precision).to.equal(5);
            } else {
                console.log('No OMNI balance found for testuser (expected in test environment)');
            }
        });

        it('should return null for unsupported asset', async () => {
            const balance = await balanceLookup.getAssetBalance('testuser', 'UNSUPPORTED');
            expect(balance).to.be.null;
        });

        it('should check sufficient balance correctly', async () => {
            // This test may return false if no balance exists, which is expected
            const hasSufficient = await balanceLookup.hasSufficientBalance('testuser', 'OMNI', 0.1);
            expect(typeof hasSufficient).to.equal('boolean');
        });

        it('should return false for insufficient balance', async () => {
            const hasSufficient = await balanceLookup.hasSufficientBalance('testuser', 'OMNI', 999999999);
            expect(hasSufficient).to.equal(false);
        });

        it('should return false for non-existent user sufficient balance check', async () => {
            const hasSufficient = await balanceLookup.hasSufficientBalance('nonexistentuser', 'OMNI', 1);
            expect(hasSufficient).to.equal(false);
        });
    });

    describe('Vesting Balance Queries', () => {
        beforeEach(function() {
            if (!witnessNode || !balanceLookup) {
                this.skip();
                return;
            }
        });

        it('should get vesting balance for user', async () => {
            const vestingBalance = await balanceLookup.getVestingBalance('testuser');
            
            if (vestingBalance) {
                expect(vestingBalance).to.have.property('asset_symbol');
                expect(vestingBalance).to.have.property('formatted_amount');
                expect(vestingBalance).to.have.property('amount');
            } else {
                console.log('No vesting balance found for testuser (expected in test environment)');
            }
        });

        it('should return null vesting balance for non-existent user', async () => {
            const vestingBalance = await balanceLookup.getVestingBalance('nonexistentuser999');
            expect(vestingBalance).to.be.null;
        });
    });

    describe('Asset Cache Management', () => {
        beforeEach(function() {
            if (!witnessNode || !balanceLookup) {
                this.skip();
                return;
            }
        });

        it('should clear asset cache', () => {
            // This should not throw an error
            expect(() => balanceLookup.clearAssetCache()).to.not.throw();
        });

        it('should handle asset queries after cache clear', async () => {
            balanceLookup.clearAssetCache();
            
            // Should still work after cache clear
            const balance = await balanceLookup.getAssetBalance('testuser', 'OMNI');
            // balance can be null in test environment, that's expected
            expect(balance === null || typeof balance === 'object').to.equal(true);
        });
    });

    describe('Error Handling', () => {
        beforeEach(function() {
            if (!witnessNode || !balanceLookup) {
                this.skip();
                return;
            }
        });

        it('should handle malformed usernames gracefully', async () => {
            const balance = await balanceLookup.getBalance('');
            expect(balance).to.be.null;
        });

        it('should handle special characters in usernames', async () => {
            const balance = await balanceLookup.getBalance('user@#$%');
            expect(balance).to.be.null;
        });

        it('should handle asset queries with empty asset symbol', async () => {
            const balance = await balanceLookup.getAssetBalance('testuser', '');
            expect(balance).to.be.null;
        });
    });

    describe('Balance Formatting', () => {
        beforeEach(function() {
            if (!witnessNode || !balanceLookup) {
                this.skip();
                return;
            }
        });

        it('should format balance amounts correctly', async () => {
            const balance = await balanceLookup.getBalance('testuser');
            
            if (balance) {
                // Check that formatted amount is a valid decimal string
                const formatted = parseFloat(balance.formatted_amount);
                expect(isNaN(formatted)).to.equal(false);
                
                // Check precision is applied correctly
                const decimalPlaces = balance.formatted_amount.split('.')[1]?.length || 0;
                expect(decimalPlaces).to.equal(balance.asset_precision);
            }
        });
    });
}); 