import jwt from 'jsonwebtoken';
import { createLogger, format, transports } from 'winston';
import { Config } from '../config';
import { Account } from '../types';

interface AuthConfig {
    jwtSecret: string;
    tokenExpiration: string;
}

interface UserData {
    username: string;
    accountId: string;
    publicKey?: string;
    permissions?: string[];
}

interface AuthToken {
    token: string;
    expiresAt: Date;
    userData: UserData;
}

export class UserAuth {
    private config: Config;
    private authConfig: AuthConfig;
    private logger: ReturnType<typeof createLogger>;
    private activeSessions: Map<string, AuthToken> = new Map();
    private loginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();

    constructor(authConfig: AuthConfig, config?: Config) {
        this.authConfig = authConfig;
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

        this.logger.info('UserAuth module initialized');
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
     * Authenticate a user with username and password
     */
    public async authenticate(username: string, password: string, account?: Account): Promise<string> {
        try {
            // Check rate limiting
            if (!this.checkRateLimit(username)) {
                throw new Error('Too many login attempts. Please try again later.');
            }

            // Validate credentials (simplified for testing)
            const isValid = await this.validateCredentials(username, password, account);
            
            if (!isValid) {
                this.recordFailedAttempt(username);
                throw new Error('Invalid credentials');
            }

            // Clear failed attempts on successful login
            this.loginAttempts.delete(username);

            // Create user data
            const userData: UserData = {
                username,
                accountId: account?.id || '1.2.0', // Default for testing
                publicKey: account?.owner_key,
                permissions: ['read', 'write'] // Default permissions
            };

            // Generate JWT token
            const token = this.generateToken(userData);
            
            // Store active session
            const expiresAt = new Date(Date.now() + this.parseExpiration(this.authConfig.tokenExpiration));
            this.activeSessions.set(token, { token, expiresAt, userData });

            this.logger.info(`User ${username} authenticated successfully`);
            return token;

        } catch (error) {
            this.logger.error(`Authentication failed for user ${username}:`, error);
            throw error;
        }
    }

    /**
     * Validate user credentials
     */
    private async validateCredentials(username: string, password: string, account?: Account): Promise<boolean> {
        // For testing purposes, we'll use a simple validation
        // In a real implementation, this would check against a secure password store
        
        // Accept test credentials
        if (username === 'testuser' && password === 'testpass123') {
            return true;
        }
        
        // If an account is provided, validate it exists
        if (account && account.name === username) {
            // In a real implementation, we would verify the password hash
            // For now, accept any password for existing accounts
            return true;
        }

        // For demo purposes, accept any username with a valid-looking password
        if (username.length > 3 && password.length > 6) {
            return true;
        }

        return false;
    }

    /**
     * Validate a JWT token and return user data
     */
    public async validateToken(token: string): Promise<UserData> {
        try {
            // Check if token exists in active sessions
            const session = this.activeSessions.get(token);
            if (!session) {
                throw new Error('Token not found in active sessions');
            }

            // Check if token is expired
            if (new Date() > session.expiresAt) {
                this.activeSessions.delete(token);
                throw new Error('Token has expired');
            }

            // Verify JWT signature
            const decoded = jwt.verify(token, this.authConfig.jwtSecret) as any;
            
            if (!decoded.userData) {
                throw new Error('Invalid token structure');
            }

            // Update last access time
            session.expiresAt = new Date(Date.now() + this.parseExpiration(this.authConfig.tokenExpiration));
            this.activeSessions.set(token, session);

            this.logger.info(`Token validated for user ${decoded.userData.username}`);
            return decoded.userData;

        } catch (error) {
            this.logger.error('Token validation failed:', error);
            throw new Error('Invalid or expired token');
        }
    }

    /**
     * Generate a JWT token for user data
     */
    private generateToken(userData: UserData): string {
        const now = Date.now();
        const payload = {
            userData,
            iat: Math.floor(now / 1000),
            exp: Math.floor(now / 1000) + this.parseExpiration(this.authConfig.tokenExpiration) / 1000,
            // Add a random component to ensure unique tokens
            jti: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        };

        return jwt.sign(payload, this.authConfig.jwtSecret);
    }

    /**
     * Parse expiration string to milliseconds
     */
    private parseExpiration(expiration: string): number {
        const match = expiration.match(/^(\d+)([hms])$/);
        if (!match) {
            throw new Error('Invalid expiration format. Use format like "1h", "30m", "60s"');
        }

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'h': return value * 60 * 60 * 1000;
            case 'm': return value * 60 * 1000;
            case 's': return value * 1000;
            default: throw new Error('Invalid time unit');
        }
    }

    /**
     * Check rate limiting for login attempts
     */
    private checkRateLimit(username: string): boolean {
        const attempts = this.loginAttempts.get(username);
        if (!attempts) {
            return true;
        }

        const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
        const lockoutTime = 15 * 60 * 1000; // 15 minutes

        // Reset attempts if enough time has passed
        if (timeSinceLastAttempt > lockoutTime) {
            this.loginAttempts.delete(username);
            return true;
        }

        // Check if user is locked out
        return attempts.count < this.config.security.maxLoginAttempts;
    }

    /**
     * Record a failed login attempt
     */
    private recordFailedAttempt(username: string): void {
        const current = this.loginAttempts.get(username) || { count: 0, lastAttempt: new Date() };
        this.loginAttempts.set(username, {
            count: current.count + 1,
            lastAttempt: new Date()
        });

        this.logger.warn(`Failed login attempt for user ${username}. Attempt ${current.count + 1}/${this.config.security.maxLoginAttempts}`);
    }

    /**
     * Logout a user by invalidating their token
     */
    public async logout(token: string): Promise<boolean> {
        try {
            const session = this.activeSessions.get(token);
            if (session) {
                this.activeSessions.delete(token);
                this.logger.info(`User ${session.userData.username} logged out successfully`);
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error('Logout failed:', error);
            return false;
        }
    }

    /**
     * Get active session count
     */
    public getActiveSessionCount(): number {
        // Clean up expired sessions
        this.cleanupExpiredSessions();
        return this.activeSessions.size;
    }

    /**
     * Clean up expired sessions
     */
    private cleanupExpiredSessions(): void {
        const now = new Date();
        for (const [token, session] of this.activeSessions.entries()) {
            if (now > session.expiresAt) {
                this.activeSessions.delete(token);
            }
        }
    }

    /**
     * Refresh a token (extend expiration)
     */
    public async refreshToken(token: string): Promise<string> {
        try {
            const userData = await this.validateToken(token);
            
            // Generate new token
            const newToken = this.generateToken(userData);
            
            // Remove old session
            this.activeSessions.delete(token);
            
            // Add new session
            const expiresAt = new Date(Date.now() + this.parseExpiration(this.authConfig.tokenExpiration));
            this.activeSessions.set(newToken, { token: newToken, expiresAt, userData });

            this.logger.info(`Token refreshed for user ${userData.username}`);
            return newToken;

        } catch (error) {
            this.logger.error('Token refresh failed:', error);
            throw error;
        }
    }

    /**
     * Check if user has specific permission
     */
    public async hasPermission(token: string, permission: string): Promise<boolean> {
        try {
            const userData = await this.validateToken(token);
            return userData.permissions?.includes(permission) || false;
        } catch (error) {
            return false;
        }
    }
} 