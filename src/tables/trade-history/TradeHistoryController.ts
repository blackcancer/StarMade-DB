/**
 * @fileoverview Trade History Controller
 *
 * Controller for the TRADE_HISTORY table.
 *
 * **IMPORTANT NOTE: This table is currently UNUSED in the StarMade game implementation.**
 * The controller is provided for completeness and potential future use when the game
 * engine activates transaction logging functionality.
 *
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    BaseController,
    type ModelConstructor,
    type QueryOptions,
    type CreateOptions,
    type UpdateOptions,
    type DeleteOptions,
    type BulkOperationResult,
    type BaseControllerConfig
} from '../BaseController.js';
import { TradeHistoryModel } from './TradeHistoryModel.js';
import {
    ValidationError,
    ErrorFactory
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Search options for trade history records
 */
export interface TradeHistorySearchOptions extends QueryOptions {
    /** Filter by source node ID */
    fromId?: number;
    /** Filter by destination node ID */
    toId?: number;
    /** Filter by source owner UID */
    fromOwner?: string;
    /** Filter by destination owner UID */
    toOwner?: string;
    /** Filter by source faction ID */
    fromFactionId?: number;
    /** Filter by destination faction ID */
    toFactionId?: number;
    /** Include only successful transactions */
    successOnly?: boolean;
    /** Include only failed transactions */
    failedOnly?: boolean;
    /** Filter transactions sent after this timestamp */
    sentAfter?: number;
    /** Filter transactions sent before this timestamp */
    sentBefore?: number;
    /** Filter by minimum total cost */
    minTotalCost?: number;
}

/**
 * Trade history creation options
 */
export interface TradeHistoryCreateOptions extends CreateOptions {
    /** Validate that costs are non-negative */
    validateCosts?: boolean;
    /** Validate timestamp ordering */
    validateTimestamps?: boolean;
}

/**
 * Trade history update options
 */
export interface TradeHistoryUpdateOptions extends UpdateOptions {
    /** Allow marking a transaction as failed */
    allowStatusChange?: boolean;
}

/**
 * Bulk trade history operation options
 */
export interface BulkTradeHistoryOptions {
    /** Skip validation */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log operations */
    logOperations?: boolean;
}

/**
 * Trade history statistics
 */
export interface TradeHistoryStatistics {
    /** Total transaction records */
    totalTransactions: number;
    /** Successful transactions */
    successfulTransactions: number;
    /** Failed transactions */
    failedTransactions: number;
    /** Total value transacted */
    totalValue: number;
    /** Total delivery costs */
    totalDeliveryCost: number;
    /** Average transaction value */
    averageTransactionValue: number;
    /** Top trading factions */
    topFactions: Array<{ factionId: number; transactionCount: number; totalValue: number }>;
}

// =============================================================================
// TRADE HISTORY CONTROLLER
// =============================================================================

/**
 * Controller for TRADE_HISTORY table – reserved for future activation.
 *
 * @remarks
 * This table is currently unused by the StarMade game engine.
 * All operations are implemented and functional should the table become active.
 */
export class TradeHistoryController extends BaseController<TradeHistoryModel> {
    protected ModelClass: ModelConstructor<TradeHistoryModel> = TradeHistoryModel;
    protected controllerName = 'TradeHistoryController';

    /**
     * Create a new TradeHistoryController instance
     * @param {BaseControllerConfig} [config={}] - Controller configuration options
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 300000,
            enableForeignKeyValidation: false,
            ...config
        });
    }

    // =============================================================================
    // EXISTENCE CHECKS
    // =============================================================================

    /**
     * Check if a trade history record exists by ID
     * @param {number} transactionId - The transaction record ID
     * @returns {Promise<boolean>} True if the record exists
     * @throws {ErrorFactory} If the query fails
     */
    public async transactionExistsById(transactionId: number): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM TRADE_HISTORY WHERE ID = ?';
        try {
            const result = await this.executeQuery(sql, [transactionId]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check trade history existence', {
                operation: 'transaction-exists-by-id', transactionId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, [transactionId]);
        }
    }

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    /**
     * Find all trade history records with filtering and pagination
     * @param {TradeHistorySearchOptions} [options={}] - Search and pagination options
     * @returns {Promise<TradeHistoryModel[]>} Array of matching transaction records
     * @throws {ErrorFactory} If the query fails
     */
    public async findAll(options: TradeHistorySearchOptions = {}): Promise<TradeHistoryModel[]> {
        this.ensureInitialized();

        const {
            fromId, toId, fromOwner, toOwner, fromFactionId, toFactionId,
            successOnly, failedOnly, sentAfter, sentBefore, minTotalCost,
            limit = this.config.maxResults,
            offset = 0,
            orderBy = 'SENT',
            orderDirection = 'DESC',
            skipCache = false,
            cacheTtl = this.config.cacheTtlMs
        } = options;

        const cacheKey = `TRADE_HISTORY:find-all:${JSON.stringify(options)}`;

        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) return TradeHistoryModel.fromRows(cached);
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (fromId !== undefined) { conditions.push('FROM_ID = ?'); params.push(fromId); }
        if (toId !== undefined) { conditions.push('TO_ID = ?'); params.push(toId); }
        if (fromOwner !== undefined) { conditions.push('FROM_OWNER = ?'); params.push(fromOwner); }
        if (toOwner !== undefined) { conditions.push('TO_OWNER = ?'); params.push(toOwner); }
        if (fromFactionId !== undefined) { conditions.push('FROM_FACTION_ID = ?'); params.push(fromFactionId); }
        if (toFactionId !== undefined) { conditions.push('TO_FACTION_ID = ?'); params.push(toFactionId); }
        if (successOnly) { conditions.push('SUCCESS = TRUE'); }
        if (failedOnly) { conditions.push('SUCCESS = FALSE'); }
        if (sentAfter !== undefined) { conditions.push('SENT >= ?'); params.push(sentAfter); }
        if (sentBefore !== undefined) { conditions.push('SENT <= ?'); params.push(sentBefore); }
        if (minTotalCost !== undefined) { conditions.push('TOTAL_COST >= ?'); params.push(minTotalCost); }

        let sql = 'SELECT * FROM TRADE_HISTORY';
        if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        if (limit > 0) { sql += ' LIMIT ?'; params.push(limit); }
        if (offset > 0) { sql += ' OFFSET ?'; params.push(offset); }

        try {
            const rows = await this.executeQuery(sql, params);
            const records = TradeHistoryModel.fromRows(rows);

            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, rows, { ttl: cacheTtl });
            }

            this.logger.debug('Trade history records retrieved', { operation: 'find-all', count: records.length });
            return records;
        } catch (error) {
            this.logger.error('Failed to find trade history records', {
                operation: 'find-all',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a single trade history record by ID
     * @param {number} id - The transaction record ID
     * @returns {Promise<TradeHistoryModel | null>} The transaction record or null
     */
    public async findOne(id: number): Promise<TradeHistoryModel | null> {
        return this.findById(id);
    }

    /**
     * Find all transactions involving a specific owner
     * @param {string} owner - Player or entity UID
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<TradeHistoryModel[]>} Array of transaction records
     * @throws {ValidationError} If owner is empty
     */
    public async findByOwner(owner: string, options: QueryOptions = {}): Promise<TradeHistoryModel[]> {
        this.ensureInitialized();

        if (!owner || owner.trim().length === 0) {
            throw new ValidationError('owner', owner, 'Owner cannot be empty');
        }

        const {
            limit = this.config.maxResults,
            offset = 0,
            orderBy = 'SENT',
            orderDirection = 'DESC'
        } = options;

        const sql = `SELECT * FROM TRADE_HISTORY WHERE FROM_OWNER = ? OR TO_OWNER = ?
            ORDER BY ${orderBy} ${orderDirection}
            ${limit > 0 ? `LIMIT ${limit}` : ''}
            ${offset > 0 ? `OFFSET ${offset}` : ''}`;

        try {
            const rows = await this.executeQuery(sql, [owner, owner]);
            return TradeHistoryModel.fromRows(rows);
        } catch (error) {
            this.logger.error('Failed to find transactions by owner', { operation: 'find-by-owner', owner });
            throw ErrorFactory.createQueryError(sql, error, [owner, owner]);
        }
    }

    /**
     * Find all successful trade history records
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<TradeHistoryModel[]>} Array of successful transaction records
     */
    public async findSuccessful(options: QueryOptions = {}): Promise<TradeHistoryModel[]> {
        return this.findAll({ ...options, successOnly: true });
    }

    /**
     * Find all failed trade history records
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<TradeHistoryModel[]>} Array of failed transaction records
     */
    public async findFailed(options: QueryOptions = {}): Promise<TradeHistoryModel[]> {
        return this.findAll({ ...options, failedOnly: true });
    }

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    /**
     * Create a new trade history record
     * @param {Partial<Record<string, any>>} data - Transaction data to insert
     * @param {TradeHistoryCreateOptions} [options={}] - Creation options
     * @returns {Promise<TradeHistoryModel>} The created transaction record
     * @throws {ValidationError} If required fields are missing or invalid
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: TradeHistoryCreateOptions = {}
    ): Promise<TradeHistoryModel> {
        const { validateCosts = true, validateTimestamps = true } = options;

        const required = ['FROM_ID', 'TO_ID', 'FROM_OWNER', 'TO_OWNER', 'FROM_FACTION_ID', 'TO_FACTION_ID', 'TOTAL_COST', 'DELIVERY_COST', 'SENT', 'RECEIVED', 'VOLUME'];
        for (const field of required) {
            if (data[field] === undefined || data[field] === null) {
                throw new ValidationError(field, data[field], `${field} is required`);
            }
        }

        if (validateCosts) {
            if (Number(data.TOTAL_COST) < 0) {
                throw new ValidationError('TOTAL_COST', data.TOTAL_COST, 'TOTAL_COST cannot be negative');
            }
            if (Number(data.DELIVERY_COST) < 0) {
                throw new ValidationError('DELIVERY_COST', data.DELIVERY_COST, 'DELIVERY_COST cannot be negative');
            }
        }

        if (validateTimestamps && Number(data.RECEIVED) < Number(data.SENT)) {
            throw new ValidationError('RECEIVED', data.RECEIVED, 'RECEIVED timestamp must be >= SENT timestamp');
        }

        if (data.SUCCESS === undefined) {
            data = { ...data, SUCCESS: false };
        }

        this.logger.info('Creating trade history record', {
            operation: 'create', fromOwner: data.FROM_OWNER, toOwner: data.TO_OWNER
        });

        return super.create(data, options);
    }

    /**
     * Update a trade history record
     * @param {number} id - The transaction record ID
     * @param {Partial<Record<string, any>>} data - Updated transaction data
     * @param {TradeHistoryUpdateOptions} [options={}] - Update options
     * @returns {Promise<TradeHistoryModel>} The updated transaction record
     */
    public async update(
        id: number,
        data: Partial<Record<string, any>>,
        options: TradeHistoryUpdateOptions = {}
    ): Promise<TradeHistoryModel> {
        this.logger.info('Updating trade history record', { operation: 'update', id });
        return super.update(id, data, options);
    }

    /**
     * Delete a trade history record
     * @param {number} id - The transaction record ID
     * @param {DeleteOptions} [options={}] - Deletion options
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    public async delete(id: number, options: DeleteOptions = {}): Promise<boolean> {
        const exists = await this.transactionExistsById(id);
        if (!exists) return false;

        this.logger.info('Deleting trade history record', { operation: 'delete', id });
        return super.delete(id, options);
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Create multiple trade history records
     * @param {Array<Partial<Record<string, any>>>} records - Array of transaction data
     * @param {BulkTradeHistoryOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkCreate(
        records: Array<Partial<Record<string, any>>>,
        options: BulkTradeHistoryOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const { continueOnError = true } = options;
        const result: BulkOperationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

        for (let i = 0; i < records.length; i++) {
            try {
                await this.create(records[i], { skipValidation: options.skipValidation });
                result.success++;
            } catch (error) {
                result.failed++;
                result.errors.push({ index: i, error: error instanceof Error ? error.message : String(error), data: records[i] });
                if (!continueOnError) throw error;
            }
        }

        this.logger.info('Bulk create completed', { operation: 'bulk-create', ...result });
        return result;
    }

    /**
     * Delete multiple trade history records by ID
     * @param {number[]} ids - Array of transaction IDs to delete
     * @param {BulkTradeHistoryOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkDelete(ids: number[], options: BulkTradeHistoryOptions = {}): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const { continueOnError = true } = options;
        const result: BulkOperationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

        for (let i = 0; i < ids.length; i++) {
            try {
                const deleted = await this.delete(ids[i]);
                if (deleted) { result.success++; } else { result.skipped++; }
            } catch (error) {
                result.failed++;
                result.errors.push({ index: i, error: error instanceof Error ? error.message : String(error), data: ids[i] });
                if (!continueOnError) throw error;
            }
        }

        this.logger.info('Bulk delete completed', { operation: 'bulk-delete', ...result });
        return result;
    }

    // =============================================================================
    // ANALYTICS AND STATISTICS
    // =============================================================================

    /**
     * Get comprehensive trade history statistics
     * @returns {Promise<TradeHistoryStatistics>} Trade history statistics object
     * @throws {ErrorFactory} If the query fails
     */
    public async getStatistics(): Promise<TradeHistoryStatistics> {
        this.ensureInitialized();

        try {
            const [
                totalResult, successResult, failResult,
                valueResult, deliveryResult,
                factionResult
            ] = await Promise.all([
                this.executeQuery('SELECT COUNT(*) AS cnt FROM TRADE_HISTORY', []),
                this.executeQuery('SELECT COUNT(*) AS cnt FROM TRADE_HISTORY WHERE SUCCESS = TRUE', []),
                this.executeQuery('SELECT COUNT(*) AS cnt FROM TRADE_HISTORY WHERE SUCCESS = FALSE', []),
                this.executeQuery('SELECT SUM(TOTAL_COST) AS total FROM TRADE_HISTORY', []),
                this.executeQuery('SELECT SUM(DELIVERY_COST) AS total FROM TRADE_HISTORY', []),
                this.executeQuery('SELECT FROM_FACTION_ID AS fid, COUNT(*) AS cnt, SUM(TOTAL_COST) AS val FROM TRADE_HISTORY GROUP BY FROM_FACTION_ID ORDER BY cnt DESC LIMIT 5', [])
            ]);

            const total = Number(totalResult[0]?.cnt ?? 0);
            const totalValue = Number(valueResult[0]?.total ?? 0);

            const topFactions = factionResult.map((r: any) => ({
                factionId: Number(r.fid),
                transactionCount: Number(r.cnt),
                totalValue: Number(r.val)
            }));

            return {
                totalTransactions: total,
                successfulTransactions: Number(successResult[0]?.cnt ?? 0),
                failedTransactions: Number(failResult[0]?.cnt ?? 0),
                totalValue,
                totalDeliveryCost: Number(deliveryResult[0]?.total ?? 0),
                averageTransactionValue: total > 0 ? totalValue / total : 0,
                topFactions
            };
        } catch (error) {
            this.logger.error('Failed to compute trade history statistics', {
                operation: 'get-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
}
