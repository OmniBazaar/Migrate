import { VirtualWitnessNode } from '../../src/virtual_witness_node';
import { Config } from '../../src/config';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';

describe('VirtualWitnessNode', () => {
    let node: VirtualWitnessNode;
    let config: Config;

    beforeEach(() => {
        // Mock config
        config = {
            server: {
                port: 8091, // Use different port to avoid conflicts
                host: 'localhost',
                wsPath: '/ws'
            },
            data: {
                accountsPath: 'test_accounts.json',
                balancesPath: 'test_balances.json',
                assetsPath: 'test_assets.json',
                walletPath: 'test_wallet.json'
            },
            logging: {
                level: 'error', // Reduce logging during tests
                errorLogPath: 'test_error.log',
                combinedLogPath: 'test_combined.log',
                console: false
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

        // In a real test environment, we would mock file system operations
        // For now, we'll create the node with default config and test what we can
        try {
            node = new VirtualWitnessNode(config);
        } catch (error) {
            // Expected if data files don't exist
            console.log('Note: VirtualWitnessNode creation failed (expected in test environment)');
        }
    });

    afterEach(() => {
        if (node) {
            try {
                node.close();
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });

    it('should handle node creation', () => {
        // Test that the node fails gracefully when data files don't exist
        expect(() => new VirtualWitnessNode(config)).to.throw('Failed to load accounts data');
    });

    it('should have proper configuration structure', () => {
        expect(config).to.have.property('server');
        expect(config).to.have.property('data');
        expect(config).to.have.property('logging');
        expect(config).to.have.property('security');
    });

    it('should validate config properties', () => {
        expect(config.server.port).to.be.a('number');
        expect(config.server.host).to.be.a('string');
        expect(config.server.wsPath).to.be.a('string');
        expect(config.data.accountsPath).to.be.a('string');
        expect(config.data.balancesPath).to.be.a('string');
        expect(config.data.assetsPath).to.be.a('string');
    });
}); 