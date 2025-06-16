import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { UserAuth } from '../../src/user_auth';
import { Config } from '../../src/config';

describe('UserAuth', () => {
    let userAuth: UserAuth;
    let config: Config;
    const authConfig = {
        jwtSecret: 'test-secret-key-12345',
        tokenExpiration: '1h'
    };

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

        userAuth = new UserAuth(authConfig, config);
    });

    describe('Initialization', () => {
        it('should create UserAuth instance', () => {
            expect(userAuth).to.be.instanceOf(UserAuth);
        });

        it('should initialize with zero active sessions', () => {
            expect(userAuth.getActiveSessionCount()).to.equal(0);
        });
    });

    describe('Authentication', () => {
        it('should authenticate valid test user', async () => {
            const token = await userAuth.authenticate('testuser', 'testpass123');
            expect(token).to.be.a('string');
            expect(token.length).to.be.greaterThan(0);
        });

        it('should authenticate user with valid-looking credentials', async () => {
            const token = await userAuth.authenticate('validuser', 'password123');
            expect(token).to.be.a('string');
            expect(token.length).to.be.greaterThan(0);
        });

        it('should reject invalid credentials', async () => {
            try {
                await userAuth.authenticate('bad', 'weak');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
                expect((error as Error).message).to.equal('Invalid credentials');
            }
        });

        it('should reject empty credentials', async () => {
            try {
                await userAuth.authenticate('', '');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
                expect((error as Error).message).to.equal('Invalid credentials');
            }
        });

        it('should track active sessions after authentication', async () => {
            await userAuth.authenticate('testuser', 'testpass123');
            expect(userAuth.getActiveSessionCount()).to.equal(1);
        });

        it('should accept account-based authentication', async () => {
            const account = {
                id: '1.2.0',
                name: 'testuser',
                owner_key: 'test_key',
                active_key: 'test_key',
                memo_key: 'test_key'
            };
            
            const token = await userAuth.authenticate('testuser', 'anypassword', account);
            expect(token).to.be.a('string');
            expect(token.length).to.be.greaterThan(0);
        });
    });

    describe('Token Validation', () => {
        let validToken: string;

        beforeEach(async () => {
            validToken = await userAuth.authenticate('testuser', 'testpass123');
        });

        it('should validate valid token', async () => {
            const userData = await userAuth.validateToken(validToken);
            expect(userData).to.have.property('username', 'testuser');
            expect(userData).to.have.property('accountId');
            expect(userData).to.have.property('permissions');
        });

        it('should reject invalid token', async () => {
            try {
                await userAuth.validateToken('invalid-token');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
                expect((error as Error).message).to.equal('Invalid or expired token');
            }
        });

        it('should reject empty token', async () => {
            try {
                await userAuth.validateToken('');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });
    });

    describe('Rate Limiting', () => {
        it('should allow authentication within rate limits', async () => {
            // First attempt should succeed
            const token1 = await userAuth.authenticate('testuser', 'testpass123');
            expect(token1).to.be.a('string');

            // Second attempt should also succeed (within limits)
            const token2 = await userAuth.authenticate('testuser2', 'testpass123');
            expect(token2).to.be.a('string');
        });

        it('should block authentication after max failed attempts', async () => {
            const username = 'bad'; // Short username (3 chars or less)
            const password = 'weak'; // Short password (6 chars or less)
            
            // Make max failed attempts
            for (let i = 0; i < 3; i++) {
                try {
                    await userAuth.authenticate(username, password);
                    expect.fail(`Expected authentication to fail for attempt ${i + 1}`);
                } catch (error) {
                    expect((error as Error).message).to.equal('Invalid credentials');
                }
            }

            // Next attempt should be blocked due to rate limiting
            try {
                await userAuth.authenticate(username, password);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
                expect((error as Error).message).to.equal('Too many login attempts. Please try again later.');
            }
        });
    });

    describe('Session Management', () => {
        let token: string;

        beforeEach(async () => {
            token = await userAuth.authenticate('testuser', 'testpass123');
        });

        it('should logout user successfully', async () => {
            const result = await userAuth.logout(token);
            expect(result).to.equal(true);
            expect(userAuth.getActiveSessionCount()).to.equal(0);
        });

        it('should handle logout of non-existent token', async () => {
            const result = await userAuth.logout('non-existent-token');
            expect(result).to.equal(false);
        });

        it('should refresh token successfully', async () => {
            // Add a small delay to ensure different timestamp/jti
            await new Promise(resolve => setTimeout(resolve, 10));
            const newToken = await userAuth.refreshToken(token);
            expect(newToken).to.be.a('string');
            expect(newToken).to.not.equal(token);
            expect(userAuth.getActiveSessionCount()).to.equal(1);
        });

        it('should fail to refresh invalid token', async () => {
            try {
                await userAuth.refreshToken('invalid-token');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
            }
        });
    });

    describe('Permissions', () => {
        let token: string;

        beforeEach(async () => {
            token = await userAuth.authenticate('testuser', 'testpass123');
        });

        it('should check user permissions correctly', async () => {
            const hasRead = await userAuth.hasPermission(token, 'read');
            const hasWrite = await userAuth.hasPermission(token, 'write');
            const hasAdmin = await userAuth.hasPermission(token, 'admin');

            expect(hasRead).to.equal(true);
            expect(hasWrite).to.equal(true);
            expect(hasAdmin).to.equal(false);
        });

        it('should return false for invalid token permission check', async () => {
            const hasPermission = await userAuth.hasPermission('invalid-token', 'read');
            expect(hasPermission).to.equal(false);
        });
    });

    describe('Expiration Parsing', () => {
        it('should create UserAuth with different expiration formats', () => {
            const configs = [
                { jwtSecret: 'test', tokenExpiration: '1h' },
                { jwtSecret: 'test', tokenExpiration: '30m' },
                { jwtSecret: 'test', tokenExpiration: '60s' }
            ];

            configs.forEach(authConfig => {
                expect(() => new UserAuth(authConfig, config)).to.not.throw();
            });
        });
    });
}); 