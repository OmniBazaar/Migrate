#!/usr/bin/env ts-node

import { createServer, Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { BlockchainFileLoader } from './blockchain_loader';

/**
 * Virtual Witness Node Server
 * Implements the same RPC API as witness_node.exe but reads data directly from blockchain files
 * Skips networking, transaction processing, and block creation - focuses on serving existing data
 */

interface RPCRequest {
    id: number;
    method: string;
    params: unknown[];
}

interface RPCResponse {
    id: number;
    result?: unknown;
    error?: {
        code: number;
        message: string;
    };
}

interface DynamicGlobalProperties {
    id: string;
    head_block_number: number;
    head_block_id: string;
    time: string;
    current_witness: string;
    next_maintenance_time: string;
    last_budget_time: string;
    witness_budget: number;
    accounts_registered_this_interval: number;
    recently_missed_count: number;
    current_aslot: number;
    recent_slots_filled: string;
    dynamic_flags: number;
    last_irreversible_block_num: number;
    referral_bonus: number;
    sale_bonus: number;
    founder_bonus: number;
    witness_bonus: number;
}

interface GlobalProperties {
    id: string;
    parameters: {
        current_fees: unknown;
        block_interval: number;
        maintenance_interval: number;
        maintenance_skip_slots: number;
        committee_proposal_review_period: number;
        maximum_transaction_size: number;
        maximum_block_size: number;
        maximum_time_until_expiration: number;
        maximum_proposal_lifetime: number;
        maximum_asset_whitelist_authorities: number;
        maximum_asset_feed_publishers: number;
        maximum_witness_count: number;
        maximum_committee_count: number;
        maximum_authority_membership: number;
        reserve_percent_of_fee: number;
        network_percent_of_fee: number;
        lifetime_referrer_percent_of_fee: number;
        cashback_vesting_period_seconds: number;
        cashback_vesting_threshold: number;
        count_non_member_votes: boolean;
        allow_non_member_whitelists: boolean;
        witness_pay_per_block: number;
        worker_budget_per_day: number;
        max_predicate_opcode: number;
        fee_liquidation_threshold: number;
        accounts_per_fee_scale: number;
        account_fee_scale_bitshifts: number;
        max_authority_depth: number;
        extensions: unknown[];
    };
    next_available_vote_id: number;
    active_committee_members: string[];
    active_witnesses: string[];
}

interface NodeInfo {
    head_block_num: number;
    head_block_id: string;
    head_block_age: string;
    next_maintenance_time: string;
    chain_id: string;
    participation: string;
    active_witnesses: string[];
    active_committee_members: string[];
}

interface AccountBalance {
    amount: string;
    asset_id: string;
}

interface AssetInfo {
    id: string;
    symbol: string;
    precision: number;
    issuer: string;
    options: {
        max_supply: string;
        market_fee_percent: number;
        max_market_fee: string;
        issuer_permissions: number;
        flags: number;
        core_exchange_rate: {
            base: { amount: number; asset_id: string };
            quote: { amount: number; asset_id: string };
        };
        whitelist_authorities: string[];
        blacklist_authorities: string[];
        whitelist_markets: string[];
        blacklist_markets: string[];
        description: string;
        extensions: unknown[];
    };
    dynamic_asset_data_id: string;
}

export class VirtualWitnessNode {
    private server?: Server;
    private wsServer?: WebSocketServer;
    private blockchain: BlockchainFileLoader;
    private port: number;
    private host: string;
    private isLoaded: boolean = false;

    constructor(witnessDataDir: string, host: string = '127.0.0.1', port: number = 8090) {
        this.blockchain = new BlockchainFileLoader(witnessDataDir);
        this.host = host;
        this.port = port;
    }

    /**
     * Start the virtual witness node server
     */
    public async start(): Promise<void> {
        console.log('🚀 Starting Virtual Witness Node...');
        console.log('📂 Loading blockchain data directly from files...');
        
        try {
            // Load blockchain data using the same process as witness_node.exe
            await this.blockchain.open();
            await this.blockchain.loadAllBlocks();
            this.isLoaded = true;
            
            console.log('✅ Blockchain data loaded successfully');
            
            // Start HTTP server for WebSocket connections
            this.server = createServer();
            this.wsServer = new WebSocketServer({ server: this.server });
            
            // Handle WebSocket connections (same as witness_node.exe)
            this.wsServer.on('connection', (ws: WebSocket) => {
                console.log('🔗 New WebSocket connection');
                this.handleConnection(ws);
            });
            
            // Start listening
            this.server.listen(this.port, this.host, () => {
                console.log(`✅ Virtual Witness Node listening on ws://${this.host}:${this.port}`);
                console.log('🎯 Ready to serve blockchain data!');
                console.log('💡 Compatible with cli_wallet.exe and other GrapheneJS clients');
            });
            
        } catch (error) {
            console.error('❌ Failed to start Virtual Witness Node:', error);
            throw error;
        }
    }

    /**
     * Handle WebSocket connection
     */
    private handleConnection(ws: WebSocket): void {
        ws.on('message', async (data) => {
            try {
                const request = JSON.parse(data.toString()) as RPCRequest;
                const response = await this.handleRPCRequest(request);
                ws.send(JSON.stringify(response));
            } catch (error) {
                console.error('Error handling message:', error);
                const errorResponse: RPCResponse = {
                    id: 0,
                    error: {
                        code: -1,
                        message: `Error processing request: ${error}`
                    }
                };
                ws.send(JSON.stringify(errorResponse));
            }
        });

        ws.on('close', () => {
            console.log('🔌 WebSocket connection closed');
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    }

    /**
     * Handle RPC requests - implements the same API as witness_node.exe
     */
    private async handleRPCRequest(request: RPCRequest): Promise<RPCResponse> {
        if (!this.isLoaded) {
            return {
                id: request.id,
                error: {
                    code: -1,
                    message: 'Blockchain data not loaded yet'
                }
            };
        }

        console.log(`📞 RPC Call: ${request.method}`);

        try {
            switch (request.method) {
                case 'get_dynamic_global_properties':
                    return {
                        id: request.id,
                        result: this.getDynamicGlobalProperties()
                    };

                case 'get_global_properties':
                    return {
                        id: request.id,
                        result: this.getGlobalProperties()
                    };

                case 'info':
                    return {
                        id: request.id,
                        result: this.getInfo()
                    };

                case 'get_block':
                    const blockNum = request.params[0] as number;
                    const block = await this.blockchain.getBlock(blockNum);
                    return {
                        id: request.id,
                        result: block
                    };

                case 'list_accounts':
                    const start = request.params[0] as string;
                    const limit = request.params[1] as number;
                    return {
                        id: request.id,
                        result: this.listAccounts(start, limit)
                    };

                case 'get_account':
                    const accountName = request.params[0] as string;
                    return {
                        id: request.id,
                        result: this.blockchain.getAccount(accountName)
                    };

                case 'list_account_balances':
                    const account = request.params[0] as string;
                    return {
                        id: request.id,
                        result: this.listAccountBalances(account)
                    };

                case 'get_asset':
                    const assetSymbol = request.params[0] as string;
                    return {
                        id: request.id,
                        result: this.blockchain.getAsset(assetSymbol)
                    };

                case 'list_assets':
                    const assetStart = request.params[0] as string;
                    const assetLimit = request.params[1] as number;
                    return {
                        id: request.id,
                        result: this.listAssets(assetStart, assetLimit)
                    };

                case 'get_chain_id':
                    return {
                        id: request.id,
                        result: '4556f5208cef79027fa6af7178c22c8965270a176671f60cb2c2c5874fafcb4d'
                    };

                default:
                    return {
                        id: request.id,
                        error: {
                            code: -32601,
                            message: `Method '${request.method}' not found`
                        }
                    };
            }
        } catch (error) {
            return {
                id: request.id,
                error: {
                    code: -1,
                    message: `Error executing ${request.method}: ${error}`
                }
            };
        }
    }

    /**
     * Get dynamic global properties (current blockchain state)
     */
    private getDynamicGlobalProperties(): DynamicGlobalProperties {
        const state = this.blockchain.getState();
        
        return {
            id: '2.1.0',
            head_block_number: state.headBlockNum,
            head_block_id: state.headBlockId,
            time: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
            current_witness: '1.6.0',
            next_maintenance_time: '2024-12-31T23:59:59',
            last_budget_time: '2024-01-01T00:00:00',
            witness_budget: 0,
            accounts_registered_this_interval: state.accounts.size,
            recently_missed_count: 0,
            current_aslot: 0,
            recent_slots_filled: '340282366920938463463374607431768211455',
            dynamic_flags: 0,
            last_irreversible_block_num: Math.max(0, state.headBlockNum - 20),
            referral_bonus: 0,
            sale_bonus: 0,
            founder_bonus: 0,
            witness_bonus: 0
        };
    }

    /**
     * Get global properties (blockchain parameters)
     */
    private getGlobalProperties(): GlobalProperties {
        return {
            id: '2.0.0',
            parameters: {
                current_fees: { parameters: [] },
                block_interval: 3,
                maintenance_interval: 86400,
                maintenance_skip_slots: 3,
                committee_proposal_review_period: 1209600,
                maximum_transaction_size: 2048,
                maximum_block_size: 2048000,
                maximum_time_until_expiration: 86400,
                maximum_proposal_lifetime: 2419200,
                maximum_asset_whitelist_authorities: 10,
                maximum_asset_feed_publishers: 10,
                maximum_witness_count: 1001,
                maximum_committee_count: 1001,
                maximum_authority_membership: 10,
                reserve_percent_of_fee: 2000,
                network_percent_of_fee: 2000,
                lifetime_referrer_percent_of_fee: 3000,
                cashback_vesting_period_seconds: 31536000,
                cashback_vesting_threshold: 10000000,
                count_non_member_votes: true,
                allow_non_member_whitelists: false,
                witness_pay_per_block: 200000,
                worker_budget_per_day: 50000000000,
                max_predicate_opcode: 1,
                fee_liquidation_threshold: 10000000,
                accounts_per_fee_scale: 1000,
                account_fee_scale_bitshifts: 4,
                max_authority_depth: 2,
                extensions: []
            },
            next_available_vote_id: 0,
            active_committee_members: ['1.5.0'],
            active_witnesses: ['1.6.0']
        };
    }

    /**
     * Get basic node info
     */
    private getInfo(): NodeInfo {
        const state = this.blockchain.getState();
        
        return {
            head_block_num: state.headBlockNum,
            head_block_id: state.headBlockId,
            head_block_age: '0 seconds ago',
            next_maintenance_time: '2024-12-31 23:59:59',
            chain_id: '4556f5208cef79027fa6af7178c22c8965270a176671f60cb2c2c5874fafcb4d',
            participation: '100.00000000000000000',
            active_witnesses: ['1.6.0'],
            active_committee_members: ['1.5.0']
        };
    }

    /**
     * List accounts starting from a given name
     */
    private listAccounts(_start: string, limit: number): [string, string][] {
        // This would be enhanced to read from processed blockchain state
        // For now, return basic accounts based on the real data we found
        const accounts: [string, string][] = [
            ['barter', '1.2.128'],
            ['bounty', '1.2.131'],
            ['committee-account', '1.2.0'],
            ['cryptobazaar', '1.2.130'],
            ['developer', '1.2.122'],
            ['escrow', '1.2.127'],
            ['exchange', '1.2.8'],
            ['kyc', '1.2.7'],
            ['listings', '1.2.124'],
            ['nathan', '1.2.120'],
            ['null-account', '1.2.3'],
            ['omnibazaar', '1.2.6'],
            ['omnicoin', '1.2.121'],
            ['processor', '1.2.125'],
            ['proxy-to-self', '1.2.5'],
            ['publisher', '1.2.123'],
            ['referrer', '1.2.126'],
            ['relaxed-committee-account', '1.2.2'],
            ['social', '1.2.129'],
            ['temp-account', '1.2.4'],
            ['welcome', '1.2.9'],
            ['witness-account', '1.2.1']
        ];
        
        return accounts.slice(0, limit);
    }

    /**
     * List account balances for a specific account
     */
    private listAccountBalances(_account: string): AccountBalance[] {
        // This would read from processed blockchain state
        // For now, return empty as balances need to be processed from blocks
        return [];
    }

    /**
     * List assets starting from a given symbol
     */
    private listAssets(_start: string, _limit: number): AssetInfo[] {
        // Return the XOM asset and other assets found in the real blockchain
        return [{
            id: '1.3.0',
            symbol: 'XOM',
            precision: 5,
            issuer: '1.2.3',
            options: {
                max_supply: '2500000000000000',
                market_fee_percent: 0,
                max_market_fee: '1000000000000000',
                issuer_permissions: 0,
                flags: 0,
                core_exchange_rate: {
                    base: { amount: 1, asset_id: '1.3.0' },
                    quote: { amount: 1, asset_id: '1.3.0' }
                },
                whitelist_authorities: [],
                blacklist_authorities: [],
                whitelist_markets: [],
                blacklist_markets: [],
                description: '',
                extensions: []
            },
            dynamic_asset_data_id: '2.3.0'
        }];
    }

    /**
     * Stop the virtual witness node
     */
    public async stop(): Promise<void> {
        console.log('🛑 Stopping Virtual Witness Node...');
        
        if (this.wsServer) {
            this.wsServer.close();
        }
        
        if (this.server) {
            this.server.close();
        }
        
        this.blockchain.close();
        console.log('✅ Virtual Witness Node stopped');
    }
}

// Example usage
export async function startVirtualWitnessNode(witnessDataDir: string, port: number = 8090): Promise<VirtualWitnessNode> {
    const node = new VirtualWitnessNode(witnessDataDir, '127.0.0.1', port);
    await node.start();
    return node;
} 