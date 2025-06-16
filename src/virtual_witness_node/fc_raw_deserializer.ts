#!/usr/bin/env ts-node

/**
 * fc::raw Binary Deserializer for GrapheneJS Format
 * 
 * This implements the binary deserialization format used by fc::raw in GrapheneJS,
 * which is the same format used by witness_node.exe in BitShares/EOS/OmniCoin blockchains.
 * 
 * Based on GrapheneJS serialization patterns and fc library documentation.
 */

export interface DeserializeResult<T> {
    value: T;
    bytesRead: number;
}

export class FCRawDeserializer {
    private buffer: Buffer;
    private offset: number;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }

    /**
     * Read variable-length integer (LEB128 unsigned)
     */
    public readVarint(): number {
        let result = 0;
        let shift = 0;
        
        while (this.offset < this.buffer.length) {
            const byte = this.buffer[this.offset++];
            result |= (byte & 0x7F) << shift;
            
            if ((byte & 0x80) === 0) {
                break;
            }
            shift += 7;
        }
        
        return result;
    }

    /**
     * Read signed variable-length integer (LEB128 signed)
     */
    public readSignedVarint(): number {
        let result = 0;
        let shift = 0;
        let byte: number;
        
        do {
            byte = this.buffer[this.offset++];
            result |= (byte & 0x7F) << shift;
            shift += 7;
        } while ((byte & 0x80) !== 0);
        
        // Sign extend if negative
        if (shift < 32 && (byte & 0x40) !== 0) {
            result |= (~0 << shift);
        }
        
        return result;
    }

    /**
     * Read fixed-size integer (little-endian)
     */
    public readUInt8(): number {
        return this.buffer.readUInt8(this.offset++);
    }

    public readUInt16LE(): number {
        const value = this.buffer.readUInt16LE(this.offset);
        this.offset += 2;
        return value;
    }

    public readUInt32LE(): number {
        const value = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return value;
    }

    public readUInt64LE(): bigint {
        const value = this.buffer.readBigUInt64LE(this.offset);
        this.offset += 8;
        return value;
    }

    /**
     * Read timestamp (microseconds since epoch)
     */
    public readTimestamp(): Date {
        const microseconds = this.readUInt64LE();
        return new Date(Number(microseconds / 1000n));
    }

    /**
     * Read string (length-prefixed)
     */
    public readString(): string {
        const length = this.readVarint();
        const value = this.buffer.subarray(this.offset, this.offset + length).toString('utf8');
        this.offset += length;
        return value;
    }

    /**
     * Read binary data (length-prefixed)
     */
    public readBytes(): Buffer {
        const length = this.readVarint();
        const value = this.buffer.subarray(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    /**
     * Read array with known element deserializer
     */
    public readArray<T>(deserializeElement: () => T): T[] {
        const length = this.readVarint();
        const result: T[] = [];
        
        for (let i = 0; i < length; i++) {
            result.push(deserializeElement());
        }
        
        return result;
    }

    /**
     * Read optional value
     */
    public readOptional<T>(deserializeValue: () => T): T | null {
        const hasValue = this.readUInt8();
        return hasValue ? deserializeValue() : null;
    }

    /**
     * Read static variant (known type index)
     */
    public readStaticVariant<T>(deserializers: Array<() => T>): T {
        const typeIndex = this.readVarint();
        if (typeIndex >= deserializers.length) {
            throw new Error(`Invalid variant type index: ${typeIndex}`);
        }
        return deserializers[typeIndex]();
    }

    /**
     * Read GrapheneJS object ID (e.g., "1.2.123")
     */
    public readObjectId(): string {
        const instanceId = this.readVarint();
        return `1.2.${instanceId}`;
    }

    /**
     * Read asset amount with asset ID
     */
    public readAsset(): { amount: bigint; asset_id: string } {
        const amount = this.readUInt64LE();
        const assetId = this.readObjectId();
        return { amount, asset_id: assetId };
    }

    /**
     * Get current position and remaining bytes
     */
    public getPosition(): number {
        return this.offset;
    }

    public getRemainingBytes(): number {
        return this.buffer.length - this.offset;
    }

    public isAtEnd(): boolean {
        return this.offset >= this.buffer.length;
    }

    /**
     * Peek at next bytes without advancing
     */
    public peekBytes(count: number): Buffer {
        return this.buffer.subarray(this.offset, this.offset + count);
    }

    /**
     * Skip bytes
     */
    public skip(count: number): void {
        this.offset += count;
    }

    /**
     * Reset to beginning
     */
    public reset(): void {
        this.offset = 0;
    }

    /**
     * Set position
     */
    public setPosition(position: number): void {
        this.offset = position;
    }

    /**
     * Create a new deserializer for a subsection
     */
    public createSubDeserializer(length: number): FCRawDeserializer {
        const subBuffer = this.buffer.subarray(this.offset, this.offset + length);
        this.offset += length;
        return new FCRawDeserializer(subBuffer);
    }
}

/**
 * Operation type definitions based on GrapheneJS
 */
export enum OperationType {
    TRANSFER = 0,
    LIMIT_ORDER_CREATE = 1,
    LIMIT_ORDER_CANCEL = 2,
    CALL_ORDER_UPDATE = 3,
    FILL_ORDER = 4,
    ACCOUNT_CREATE = 5,
    ACCOUNT_UPDATE = 6,
    ACCOUNT_WHITELIST = 7,
    ACCOUNT_UPGRADE = 8,
    ACCOUNT_TRANSFER = 9,
    ASSET_CREATE = 10,
    ASSET_UPDATE = 11,
    ASSET_UPDATE_BITASSET = 12,
    ASSET_UPDATE_FEED_PRODUCERS = 13,
    ASSET_ISSUE = 14,
    ASSET_RESERVE = 15,
    ASSET_FUND_FEE_POOL = 16,
    ASSET_SETTLE = 17,
    ASSET_GLOBAL_SETTLE = 18,
    ASSET_PUBLISH_FEED = 19,
    WITNESS_CREATE = 20,
    WITNESS_UPDATE = 21,
    PROPOSAL_CREATE = 22,
    PROPOSAL_UPDATE = 23,
    PROPOSAL_DELETE = 24,
    WITHDRAW_PERMISSION_CREATE = 25,
    WITHDRAW_PERMISSION_UPDATE = 26,
    WITHDRAW_PERMISSION_CLAIM = 27,
    WITHDRAW_PERMISSION_DELETE = 28,
    COMMITTEE_MEMBER_CREATE = 29,
    COMMITTEE_MEMBER_UPDATE = 30,
    COMMITTEE_MEMBER_UPDATE_GLOBAL_PARAMETERS = 31,
    VESTING_BALANCE_CREATE = 32,
    VESTING_BALANCE_WITHDRAW = 33,
    WORKER_CREATE = 34,
    CUSTOM = 35,
    ASSERT = 36,
    BALANCE_CLAIM = 37,
    OVERRIDE_TRANSFER = 38,
    TRANSFER_TO_BLIND = 39,
    BLIND_TRANSFER = 40,
    TRANSFER_FROM_BLIND = 41,
    ASSET_SETTLE_CANCEL = 42,
    ASSET_CLAIM_FEES = 43,
    FBA_DISTRIBUTE = 44,
    BID_COLLATERAL = 45,
    EXECUTE_BID = 46
}

/**
 * Specific deserializers for GrapheneJS operations
 */
export class GrapheneOperationDeserializer {
    private deserializer: FCRawDeserializer;

    constructor(buffer: Buffer) {
        this.deserializer = new FCRawDeserializer(buffer);
    }

    /**
     * Deserialize a transfer operation
     */
    public deserializeTransfer(): any {
        return {
            type: OperationType.TRANSFER,
            from: this.deserializer.readObjectId(),
            to: this.deserializer.readObjectId(),
            amount: this.deserializer.readAsset(),
            memo: this.deserializer.readOptional(() => this.deserializeMemo()),
            extensions: this.deserializer.readArray(() => this.deserializeExtension())
        };
    }

    /**
     * Deserialize an account create operation
     */
    public deserializeAccountCreate(): any {
        return {
            type: OperationType.ACCOUNT_CREATE,
            registrar: this.deserializer.readObjectId(),
            referrer: this.deserializer.readObjectId(),
            referrer_percent: this.deserializer.readUInt16LE(),
            name: this.deserializer.readString(),
            owner: this.deserializeAuthority(),
            active: this.deserializeAuthority(),
            options: this.deserializeAccountOptions(),
            extensions: this.deserializer.readArray(() => this.deserializeExtension())
        };
    }

    /**
     * Deserialize an asset create operation
     */
    public deserializeAssetCreate(): any {
        return {
            type: OperationType.ASSET_CREATE,
            issuer: this.deserializer.readObjectId(),
            symbol: this.deserializer.readString(),
            precision: this.deserializer.readUInt8(),
            common_options: this.deserializeAssetOptions(),
            bitasset_opts: this.deserializer.readOptional(() => this.deserializeBitassetOptions()),
            is_prediction_market: this.deserializer.readUInt8() > 0,
            extensions: this.deserializer.readArray(() => this.deserializeExtension())
        };
    }

    /**
     * Deserialize memo
     */
    private deserializeMemo(): any {
        return {
            from: this.deserializer.readString(), // public key
            to: this.deserializer.readString(),   // public key
            nonce: this.deserializer.readUInt64LE(),
            message: this.deserializer.readBytes()
        };
    }

    /**
     * Deserialize authority
     */
    private deserializeAuthority(): any {
        return {
            weight_threshold: this.deserializer.readUInt32LE(),
            account_auths: this.deserializer.readArray(() => [
                this.deserializer.readObjectId(),
                this.deserializer.readUInt16LE()
            ]),
            key_auths: this.deserializer.readArray(() => [
                this.deserializer.readString(),
                this.deserializer.readUInt16LE()
            ]),
            address_auths: this.deserializer.readArray(() => [
                this.deserializer.readString(),
                this.deserializer.readUInt16LE()
            ])
        };
    }

    /**
     * Deserialize account options
     */
    private deserializeAccountOptions(): any {
        return {
            memo_key: this.deserializer.readString(),
            voting_account: this.deserializer.readObjectId(),
            num_witness: this.deserializer.readUInt16LE(),
            num_committee: this.deserializer.readUInt16LE(),
            votes: this.deserializer.readArray(() => this.deserializer.readObjectId()),
            extensions: this.deserializer.readArray(() => this.deserializeExtension())
        };
    }

    /**
     * Deserialize asset options
     */
    private deserializeAssetOptions(): any {
        return {
            max_supply: this.deserializer.readUInt64LE(),
            market_fee_percent: this.deserializer.readUInt16LE(),
            max_market_fee: this.deserializer.readUInt64LE(),
            issuer_permissions: this.deserializer.readUInt16LE(),
            flags: this.deserializer.readUInt16LE(),
            core_exchange_rate: this.deserializePriceCore(),
            whitelist_authorities: this.deserializer.readArray(() => this.deserializer.readObjectId()),
            blacklist_authorities: this.deserializer.readArray(() => this.deserializer.readObjectId()),
            whitelist_markets: this.deserializer.readArray(() => this.deserializer.readObjectId()),
            blacklist_markets: this.deserializer.readArray(() => this.deserializer.readObjectId()),
            description: this.deserializer.readString(),
            extensions: this.deserializer.readArray(() => this.deserializeExtension())
        };
    }

    /**
     * Deserialize bitasset options
     */
    private deserializeBitassetOptions(): any {
        return {
            feed_lifetime_sec: this.deserializer.readUInt32LE(),
            minimum_feeds: this.deserializer.readUInt8(),
            force_settlement_delay_sec: this.deserializer.readUInt32LE(),
            force_settlement_offset_percent: this.deserializer.readUInt16LE(),
            maximum_force_settlement_volume: this.deserializer.readUInt16LE(),
            short_backing_asset: this.deserializer.readObjectId(),
            extensions: this.deserializer.readArray(() => this.deserializeExtension())
        };
    }

    /**
     * Deserialize price core
     */
    private deserializePriceCore(): any {
        return {
            base: this.deserializer.readAsset(),
            quote: this.deserializer.readAsset()
        };
    }

    /**
     * Deserialize extension (placeholder)
     */
    private deserializeExtension(): any {
        // Extensions are usually empty or contain specialized data
        return {};
    }

    /**
     * Deserialize any operation based on type
     */
    public deserializeOperation(): any {
        const operationType = this.deserializer.readVarint();
        
        switch (operationType) {
            case OperationType.TRANSFER:
                return this.deserializeTransfer();
            case OperationType.ACCOUNT_CREATE:
                return this.deserializeAccountCreate();
            case OperationType.ASSET_CREATE:
                return this.deserializeAssetCreate();
            default:
                // For unsupported operations, skip the data
                console.log(`⚠️  Unsupported operation type: ${operationType}`);
                return {
                    type: operationType,
                    data: 'unsupported'
                };
        }
    }

    /**
     * Get the underlying deserializer for direct access
     */
    public getDeserializer(): FCRawDeserializer {
        return this.deserializer;
    }
} 