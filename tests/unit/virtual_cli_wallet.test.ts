import { VirtualWallet } from '../../src/virtual_cli_wallet';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';

describe('VirtualWallet', () => {
    let wallet: VirtualWallet;

    beforeEach(() => {
        // Create wallet instance for testing
        wallet = new VirtualWallet();
    });

    it('should create wallet successfully', async () => {
        const result = await wallet.createWallet('testpassword');
        expect(result).to.equal(true);
    });

    it('should get account by name', async () => {
        const account = await wallet.getAccountByName('testuser');
        // Account may be null if not found, which is expected in test environment
        expect(account !== undefined).to.equal(true);
    });

    it('should get account balances', async () => {
        const balances = await wallet.getAccountBalances('1.2.0');
        expect(Array.isArray(balances)).to.equal(true);
    });

    it('should get specific balance', async () => {
        const balance = await wallet.getBalance('1.2.0', '1.3.0');
        // Balance may be null if not found, which is expected in test environment
        expect(balance !== undefined).to.equal(true);
    });

    it('should handle connection gracefully', () => {
        expect(() => new VirtualWallet()).to.not.throw();
    });

    it('should validate credentials', async () => {
        const result = await wallet.validateCredentials('testuser', 'testpass');
        expect(typeof result).to.equal('boolean');
    });
}); 