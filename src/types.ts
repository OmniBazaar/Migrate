export interface Transaction {
  ref_block_num: number;
  ref_block_prefix: number;
  expiration: string;
  operations: Operation[];
  extensions: unknown[];
  signatures?: string[];
}

export interface Operation {
  type: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
}

export interface Config {
  server: {
    port: number;
    host: string;
    wsPath: string;
  };
  data: {
    accountsPath: string;
    balancesPath: string;
    assetsPath: string;
    walletPath: string;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    errorLogPath: string;
    combinedLogPath: string;
    console: boolean;
  };
  security: {
    maxLoginAttempts: number;
    sessionTimeout: number;
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
  };
}

export interface Account {
  id: string;
  name: string;
  owner_key: string;
  active_key: string;
  memo_key: string;
}

export interface Balance {
  account_id: string;
  asset_id: string;
  amount: number;
  owner: string;
  last_claim_date: string;
}

export interface Asset {
  id: string;
  symbol: string;
  precision: number;
  issuer: string;
  options: Record<string, unknown>;
  dynamic_asset_data_id: string;
}

export interface TransactionRequest {
  from: string;
  to: string;
  amount: string;
  asset: string;
}

export interface Request {
  id: number;
  method: string;
  params: unknown[];
}

export interface Response {
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface WalletData {
  chain_id: string;
  cipher_keys: string;
  ws_server: string;
  ws_user: string;
  ws_password: string;
}

export interface BlockData {
  block_id: string;
  previous: string;
  timestamp: string;
  witness: string;
  transaction_merkle_root: string;
  extensions: unknown[];
  witness_signature: string;
  transactions: Transaction[];
} 