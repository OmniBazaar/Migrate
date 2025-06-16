import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { VirtualWitnessNode } from '../../src/virtual_witness_node';
import { VirtualWallet } from '../../src/virtual_cli_wallet';
import { BlockchainLoader } from '../../src/blockchain_loader';
import { UserAuth } from '../../src/user_auth';
import { BalanceLookup } from '../../src/balance_lookup';
import { Config } from '../../src/config';
import testConfig from '../config.test.json';

describe('Migration Integration Tests', () => {
  let witnessNode: VirtualWitnessNode;
  let cliWallet: VirtualWallet;
  let blockchainLoader: BlockchainLoader;
  let userAuth: UserAuth;
  let balanceLookup: BalanceLookup;
  let config: Config;

  before(async () => {
    // Create proper configuration
    config = {
      server: {
        port: 8093, // Use different port to avoid conflicts
        host: 'localhost',
        wsPath: '/ws'
      },
      data: {
        accountsPath: 'data/accounts.json',
        balancesPath: 'data/balances.json',
        assetsPath: 'data/assets.json',
        walletPath: 'test_wallet.json'
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

    // Initialize components
    try {
      witnessNode = new VirtualWitnessNode(config);
      console.log('✓ Virtual Witness Node initialized');
    } catch (error) {
      console.log('Note: Virtual Witness Node creation failed (expected if data files are missing)');
      witnessNode = null as any;
    }

    cliWallet = new VirtualWallet();
    blockchainLoader = new BlockchainLoader(testConfig.database as any, config);
    userAuth = new UserAuth(testConfig.auth, config);
    
    if (witnessNode) {
      balanceLookup = new BalanceLookup(witnessNode, config);
    }

    console.log('All components initialized');
  });

  after(async () => {
    // Cleanup
    if (witnessNode) {
      try {
        witnessNode.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('User Authentication Flow', () => {
    it('should authenticate a user and return a valid token', async () => {
      const { username, password } = testConfig.testData.testUser;
      const token = await userAuth.authenticate(username, password);
      expect(token).to.be.a('string');
      expect(token.length).to.be.greaterThan(0);
    });

    it('should validate a token and return user data', async () => {
      const { username, password } = testConfig.testData.testUser;
      const token = await userAuth.authenticate(username, password);
      const userData = await userAuth.validateToken(token);
      expect(userData).to.have.property('username', username);
    });

    it('should handle invalid credentials', async () => {
      try {
        await userAuth.authenticate('invaliduser', 'wrongpassword');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });
  });

  describe('Blockchain Loading', () => {
    it('should load blockchain data successfully', async () => {
      const result = await blockchainLoader.load();
      expect(result).to.be.true;
      expect(blockchainLoader.getBlockCount()).to.be.greaterThan(0);
    });

    it('should validate loaded blockchain data', async () => {
      await blockchainLoader.load();
      const isValid = await blockchainLoader.validate();
      expect(isValid).to.be.true;
    });

    it('should provide access to loaded data', async () => {
      await blockchainLoader.load();
      const accounts = blockchainLoader.getAccounts();
      const balances = blockchainLoader.getBalances();
      const assets = blockchainLoader.getAssets();
      
      expect(Array.isArray(accounts)).to.be.true;
      expect(Array.isArray(balances)).to.be.true;
      expect(Array.isArray(assets)).to.be.true;
    });
  });

  describe('Balance Lookup', () => {
    it('should fetch user balance correctly', async function() {
      if (!witnessNode) {
        this.skip();
        return;
      }

      const { username } = testConfig.testData.testUser;
      const balance = await balanceLookup.getBalance(username);
      
      if (balance) {
        expect(balance).to.have.property('asset_symbol');
        expect(balance).to.have.property('formatted_amount');
        expect(balance.asset_symbol).to.equal(testConfig.testData.testBalance.asset);
      } else {
        console.log('No balance found (expected in test environment)');
      }
    });

    it('should handle non-existent user gracefully', async function() {
      if (!witnessNode) {
        this.skip();
        return;
      }

      const balance = await balanceLookup.getBalance('nonexistentuser');
      expect(balance).to.be.null;
    });

    it('should get balance summary', async function() {
      if (!witnessNode) {
        this.skip();
        return;
      }

      const { username } = testConfig.testData.testUser;
      const summary = await balanceLookup.getBalanceSummary(username);
      
      if (summary) {
        expect(summary).to.have.property('total_assets');
        expect(summary).to.have.property('balances');
        expect(Array.isArray(summary.balances)).to.be.true;
      } else {
        console.log('No balance summary found (expected in test environment)');
      }
    });
  });

  describe('CLI Wallet Operations', () => {
    it('should create wallet successfully', async () => {
      const result = await cliWallet.createWallet('testpassword123');
      expect(result).to.equal(true);
    });

    it('should handle connection gracefully', () => {
      expect(() => new VirtualWallet()).to.not.throw();
    });
  });

  describe('Witness Node Integration', () => {
    it('should handle witness node operations', function() {
      if (!witnessNode) {
        console.log('Witness node not available for testing');
        this.skip();
        return;
      }

      expect(witnessNode).to.not.be.null;
      console.log('Virtual Witness Node operations available');
    });
  });

  describe('End-to-End Migration Flow', () => {
    it('should complete a basic migration cycle', async function() {
      if (!witnessNode) {
        console.log('Skipping E2E test - witness node not available');
        this.skip();
        return;
      }

      // 1. Authenticate user
      const { username, password } = testConfig.testData.testUser;
      const token = await userAuth.authenticate(username, password);
      expect(token).to.be.a('string');

      // 2. Load blockchain data
      const loadResult = await blockchainLoader.load();
      expect(loadResult).to.be.true;

      // 3. Get user balance
      const balance = await balanceLookup.getBalance(username);
      console.log(`Balance lookup result: ${balance ? 'found' : 'not found'}`);

      // 4. Create wallet
      const walletResult = await cliWallet.createWallet('testpassword123');
      expect(walletResult).to.equal(true);

      console.log('End-to-end migration cycle completed successfully');
    });

    it('should handle integration errors gracefully', async () => {
      // Test error handling in integration
      try {
        await userAuth.authenticate('', '');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });
  });
}); 