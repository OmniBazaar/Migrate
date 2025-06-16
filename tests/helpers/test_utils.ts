import { Transaction, TransactionRequest } from '../../src/types';

/**
 * Generate a test transaction object
 */
export function generateTestTransaction(request: TransactionRequest): Transaction {
    return {
        ref_block_num: 12345,
        ref_block_prefix: 67890,
        expiration: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        operations: [
            [
                0, // transfer operation
                {
                    from: request.from,
                    to: request.to,
                    amount: {
                        amount: parseFloat(request.amount) * 100000, // Convert to base units
                        asset_id: getAssetId(request.asset)
                    },
                    fee: {
                        amount: 1000, // Base fee
                        asset_id: getAssetId(request.asset)
                    }
                }
            ]
        ],
        extensions: []
    };
}

/**
 * Generate a test signature for a transaction
 */
export function generateTestSignature(transaction: Transaction, privateKey: string): string {
    // In a real implementation, this would use cryptographic signing
    // For testing purposes, we'll generate a dummy signature
    const txString = JSON.stringify(transaction);
    const keyHash = hashString(privateKey);
    const txHash = hashString(txString);
    return `SIG_${keyHash}_${txHash}`;
}

/**
 * Get asset ID from symbol
 */
function getAssetId(symbol: string): string {
    const assetMap: { [key: string]: string } = {
        'OMNI': '1.3.0',
        'BTC': '1.3.1',
        'ETH': '1.3.2'
    };
    return assetMap[symbol] || '1.3.0';
}

/**
 * Simple hash function for testing
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Create test account data
 */
export function createTestAccount(id: string, name: string) {
    return {
        id,
        name,
        owner_key: `OMNI${Math.random().toString(36).substr(2, 50)}`,
        active_key: `OMNI${Math.random().toString(36).substr(2, 50)}`,
        memo_key: `OMNI${Math.random().toString(36).substr(2, 50)}`
    };
}

/**
 * Create test balance data
 */
export function createTestBalance(accountId: string, assetId: string, amount: number) {
    return {
        account_id: accountId,
        asset_id: assetId,
        amount,
        owner: accountId,
        last_claim_date: new Date().toISOString()
    };
}

/**
 * Create test asset data
 */
export function createTestAsset(id: string, symbol: string, precision: number = 5) {
    return {
        id,
        symbol,
        precision,
        issuer: '1.2.0',
        options: {
            max_supply: '1000000000000000',
            market_fee_percent: 0,
            max_market_fee: '1000000000000000',
            issuer_permissions: 0,
            flags: 0,
            core_exchange_rate: {
                base: { amount: 1, asset_id: id },
                quote: { amount: 1, asset_id: '1.3.0' }
            }
        },
        dynamic_asset_data_id: `2.3.${id.split('.')[2]}`
    };
}

/**
 * Generate test data for blockchain
 */
export function generateTestData() {
    const accounts = [
        createTestAccount('1.2.0', 'testuser'),
        createTestAccount('1.2.1', 'testuser2'),
        createTestAccount('1.2.2', 'recipient')
    ];

    const assets = [
        createTestAsset('1.3.0', 'OMNI', 5),
        createTestAsset('1.3.1', 'BTC', 8),
        createTestAsset('1.3.2', 'ETH', 18)
    ];

    const balances = [
        createTestBalance('1.2.0', '1.3.0', 1000.00000),
        createTestBalance('1.2.1', '1.3.0', 500.00000),
        createTestBalance('1.2.0', '1.3.1', 0.01000000),
        createTestBalance('1.2.1', '1.3.2', 10.000000000000000000)
    ];

    return { accounts, assets, balances };
}

export const mockBlockchainData = {
  blocks: [
    {
      block_id: '0000000000000000000000000000000000000000',
      previous: '0000000000000000000000000000000000000000',
      timestamp: '2024-02-20T00:00:00Z',
      witness: '1.6.0',
      transaction_merkle_root: '0000000000000000000000000000000000000000',
      extensions: [],
      witness_signature: '0000000000000000000000000000000000000000000000000000000000000000',
      transactions: []
    }
  ],
  accounts: [
    {
      id: '1.2.0',
      name: 'testuser',
      owner: {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [
          ['TEST5KjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqK', 1]
        ]
      },
      active: {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [
          ['TEST5KjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqK', 1]
        ]
      },
      options: {
        memo_key: 'TEST5KjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqKjJqK',
        voting_account: '1.2.0',
        num_witness: 0,
        num_committee: 0,
        votes: [],
        extensions: []
      }
    }
  ],
  balances: [
    {
      id: '1.3.0',
      owner: '1.2.0',
      asset_type: '1.3.0',
      balance: '1000.00000'
    }
  ]
};

export const setupTestDatabase = async (db: Database): Promise<void> => {
  // Create tables
  await db.exec(`
    CREATE TABLE blocks (
      id TEXT PRIMARY KEY,
      previous TEXT,
      timestamp TEXT,
      witness TEXT,
      transaction_merkle_root TEXT,
      witness_signature TEXT
    );
    
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT,
      owner TEXT,
      active TEXT,
      options TEXT
    );
    
    CREATE TABLE balances (
      id TEXT PRIMARY KEY,
      owner TEXT,
      asset_type TEXT,
      balance TEXT
    );
  `);

  // Insert test data
  for (const block of mockBlockchainData.blocks) {
    await db.run(
      'INSERT INTO blocks VALUES (?, ?, ?, ?, ?, ?)',
      [block.block_id, block.previous, block.timestamp, block.witness, 
       block.transaction_merkle_root, block.witness_signature]
    );
  }

  for (const account of mockBlockchainData.accounts) {
    await db.run(
      'INSERT INTO accounts VALUES (?, ?, ?, ?, ?)',
      [account.id, account.name, JSON.stringify(account.owner),
       JSON.stringify(account.active), JSON.stringify(account.options)]
    );
  }

  for (const balance of mockBlockchainData.balances) {
    await db.run(
      'INSERT INTO balances VALUES (?, ?, ?, ?)',
      [balance.id, balance.owner, balance.asset_type, balance.balance]
    );
  }
}; 