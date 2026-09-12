/**
 * @fileoverview Trade Nodes Controller
 *
 * Controller for managing trade node records in the TRADE_NODES table.
 * Provides marketplace inventory management, permission control, and economic analytics.
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
import {
    TradeNodesModel,
    TradePermissionFlag,
    TradePermissionPreset,
    KnownTradeFactions
} from './TradeNodesModel.js';
import {
    ValidationError,
    ErrorFactory
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Search options for trade node records
 */
export interface TradeNodeSearchOptions extends QueryOptions {
    /** Filter by owner player UID */
    owner?: string;
    /** Filter by faction ID */
    factionId?: number;
    /** Filter by linked entity ID */
    entityId?: number;
    /** Filter by permission preset */
    permissionPreset?: TradePermissionPreset;
    /** Include only NPC-owned nodes */
    npcOnly?: boolean;
    /** Include only player-owned nodes */
    playerOwnedOnly?: boolean;
    /** Search term for owner name */
    searchTerm?: string;
    /** Filter nodes that allow neutral access */
    allowsNeutral?: boolean;
}

/**
 * Trade node creation options
 */
export interface TradeNodeCreateOptions extends CreateOptions {
    /** Validate entity existence */
    validateEntity?: boolean;
    /** Prevent duplicate entity assignments */
    preventDuplicates?: boolean;
}

/**
 * Trade node update options
 */
export interface TradeNodeUpdateOptions extends UpdateOptions {
    /** Validate permission value range */
    validatePermissions?: boolean;
}

/**
 * Bulk trade node operation options
 */
export interface BulkTradeNodeOptions {
    /** Skip validation for performance */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log individual operations */
    logOperations?: boolean;
    /** Batch size */
    batchSize?: number;
}

/**
 * Trade node statistics
 */
export interface TradeNodeStatistics {
    /** Total number of trade nodes */
    totalNodes: number;
    /** NPC-owned nodes */
    npcNodes: number;
    /** Player-owned nodes */
    playerNodes: number;
    /** Open-access nodes (permission = UNIVERSAL_ACCESS) */
    openAccessNodes: number;
    /** Closed nodes (permission = NO_ACCESS) */
    closedNodes: number;
    /** Top node owners */
    topOwners: Array<{ owner: string; nodeCount: number }>;
    /** Permission distribution */
    permissionDistribution: Record<number, number>;
}

// =============================================================================
// TRADE NODES CONTROLLER
// =============================================================================

/**
 * Controller for TRADE_NODES table with economic management capabilities
 */
export class TradeNodesController extends BaseController<TradeNodesModel> {
    /** Model constructor used to map database rows and obtain the table schema. */
    protected ModelClass: ModelConstructor<TradeNodesModel> = TradeNodesModel;
    /** Controller name attached to logging and diagnostics. */
    protected controllerName = 'TradeNodesController';

    /**
     * Create a new TradeNodesController instance
     * @param {BaseControllerConfig} [config={}] - Controller configuration options
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 300000,
            enableForeignKeyValidation: false, // Trade nodes have no FK constraints
            ...config
        });
    }

    // =============================================================================
    // EXISTENCE CHECKS
    // =============================================================================

    /**
     * Check if a trade node exists by ID
     * @param {number} nodeId - The trade node ID
     * @returns {Promise<boolean>} True if the node exists
     * @throws {ErrorFactory} If the query fails
     */
    public async nodeExistsById(nodeId: number): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM TRADE_NODES WHERE ID = ?';
        try {
            const result = await this.executeQuery(sql, [nodeId]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check trade node existence', {
                operation: 'node-exists-by-id', nodeId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, [nodeId]);
        }
    }

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    /**
     * Find all trade nodes with filtering and pagination
     * @param {TradeNodeSearchOptions} [options={}] - Search and pagination options
     * @returns {Promise<TradeNodesModel[]>} Array of matching trade node records
     * @throws {ErrorFactory} If the query fails
     */
    public async findAll(options: TradeNodeSearchOptions = {}): Promise<TradeNodesModel[]> {
        this.validateQueryOptions(options);
        this.ensureInitialized();

        const {
            owner,
            factionId,
            entityId,
            permissionPreset,
            npcOnly,
            playerOwnedOnly,
            searchTerm,
            allowsNeutral,
            limit = this.config.maxResults,
            offset = 0,
            orderBy = 'ID',
            orderDirection = 'ASC',
            skipCache = false,
            cacheTtl = this.config.cacheTtlMs
        } = options;

        const cacheKey = `TRADE_NODES:find-all:${JSON.stringify(options)}`;

        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) return TradeNodesModel.fromRows(cached);
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (owner !== undefined) { conditions.push('PLAYER = ?'); params.push(owner); }
        if (factionId !== undefined) { conditions.push('FACTION = ?'); params.push(factionId); }
        if (entityId !== undefined) { conditions.push('ENTITY_ID = ?'); params.push(entityId); }
        if (permissionPreset !== undefined) { conditions.push('PERMISSION = ?'); params.push(permissionPreset); }
        if (npcOnly) {
            conditions.push('FACTION < 0');
        }
        if (playerOwnedOnly) {
            conditions.push('(FACTION >= 0 AND PLAYER IS NOT NULL)');
        }
        if (searchTerm !== undefined) {
            conditions.push('LOWER(PLAYER) LIKE ?');
            params.push(`%${searchTerm.toLowerCase()}%`);
        }
        if (allowsNeutral) {
            conditions.push(`(PERMISSION & ${TradePermissionFlag.NEUTRAL}) > 0`);
        }

        let sql = 'SELECT * FROM TRADE_NODES';
        if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        if (limit > 0) { sql += ' LIMIT ?'; params.push(limit); }
        if (offset > 0) { sql += ' OFFSET ?'; params.push(offset); }

        try {
            const rows = await this.executeQuery(sql, params);
            const records = TradeNodesModel.fromRows(rows);

            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, rows, { ttl: cacheTtl });
            }

            this.logger.debug('Trade nodes retrieved', { operation: 'find-all', count: records.length });
            return records;
        } catch (error) {
            this.logger.error('Failed to find trade nodes', {
                operation: 'find-all',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a single trade node by ID
     * @param {number} id - The trade node ID
     * @returns {Promise<TradeNodesModel | null>} The trade node record or null
     * @throws {ErrorFactory} If the query fails
     */
    public async findOne(id: number): Promise<TradeNodesModel | null> {
        return this.findById(id);
    }

    /**
     * Find all trade nodes owned by a specific player
     * @param {string} owner - Player UID
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<TradeNodesModel[]>} Array of trade node records
     * @throws {ValidationError} If owner is empty
     * @throws {ErrorFactory} If the query fails
     */
    public async findByOwner(owner: string, options: QueryOptions = {}): Promise<TradeNodesModel[]> {
        if (!owner || owner.trim().length === 0) {
            throw new ValidationError('owner', owner, 'Owner cannot be empty');
        }
        return this.findAll({ ...options, owner });
    }

    /**
     * Find all trade nodes belonging to a faction
     * @param {number} factionId - The faction ID
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<TradeNodesModel[]>} Array of trade node records for the faction
     * @throws {ErrorFactory} If the query fails
     */
    public async findByFaction(factionId: number, options: QueryOptions = {}): Promise<TradeNodesModel[]> {
        return this.findAll({ ...options, factionId });
    }

    /**
     * Find all NPC trade nodes
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<TradeNodesModel[]>} Array of NPC-owned trade node records
     * @throws {ErrorFactory} If the query fails
     */
    public async findNPCNodes(options: QueryOptions = {}): Promise<TradeNodesModel[]> {
        return this.findAll({ ...options, npcOnly: true });
    }

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    /**
     * Create a new trade node record
     * @param {Partial<Record<string, any>>} data - Trade node data to insert
     * @param {TradeNodeCreateOptions} [options={}] - Creation options
     * @returns {Promise<TradeNodesModel>} The created trade node record
     * @throws {ValidationError} If data validation fails
     * @throws {ErrorFactory} If the query fails
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: TradeNodeCreateOptions = {}
    ): Promise<TradeNodesModel> {
        // Default permission if not provided
        if (data.PERMISSION === undefined) {
            data = { ...data, PERMISSION: TradePermissionPreset.STANDARD_COMMERCIAL };
        }

        this.logger.info('Creating trade node record', {
            operation: 'create', owner: data.PLAYER, faction: data.FACTION
        });

        return super.create(data, options);
    }

    /**
     * Update an existing trade node record
     * @param {number} id - The trade node ID
     * @param {Partial<Record<string, any>>} data - Updated trade node data
     * @param {TradeNodeUpdateOptions} [options={}] - Update options
     * @returns {Promise<TradeNodesModel>} The updated trade node record
     * @throws {ValidationError} If validation fails or node not found
     * @throws {ErrorFactory} If the query fails
     */
    public async update(
        id: number,
        data: Partial<Record<string, any>>,
        options: TradeNodeUpdateOptions = {}
    ): Promise<TradeNodesModel> {
        const { validatePermissions = true, ...baseOptions } = options;

        if (validatePermissions && data.PERMISSION !== undefined && data.PERMISSION !== null) {
            const perm = Number(data.PERMISSION);
            if (perm < 0 || perm > 31) {
                throw new ValidationError('PERMISSION', data.PERMISSION,
                    'PERMISSION must be a bitmask between 0 and 31');
            }
        }

        this.logger.info('Updating trade node record', { operation: 'update', id, fields: Object.keys(data) });
        return super.update(id, data, baseOptions);
    }

    /**
     * Delete a trade node record
     * @param {number} id - The trade node ID
     * @param {DeleteOptions} [options={}] - Deletion options
     * @returns {Promise<boolean>} True if deleted, false if not found
     * @throws {ErrorFactory} If the query fails
     */
    public async delete(id: number, options: DeleteOptions = {}): Promise<boolean> {
        const exists = await this.nodeExistsById(id);
        if (!exists) return false;

        this.logger.info('Deleting trade node record', { operation: 'delete', id });
        return super.delete(id, options);
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Create multiple trade node records
     * @param {Array<Partial<Record<string, any>>>} records - Array of trade node data
     * @param {BulkTradeNodeOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkCreate(
        records: Array<Partial<Record<string, any>>>,
        options: BulkTradeNodeOptions = {}
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
     * Delete multiple trade node records by ID
     * @param {number[]} ids - Array of trade node IDs to delete
     * @param {BulkTradeNodeOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkDelete(ids: number[], options: BulkTradeNodeOptions = {}): Promise<BulkOperationResult> {
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
     * Get comprehensive trade node statistics
     * @returns {Promise<TradeNodeStatistics>} Trade node statistics object
     * @throws {ErrorFactory} If the query fails
     */
    public async getStatistics(): Promise<TradeNodeStatistics> {
        this.ensureInitialized();

        try {
            const [totalResult, npcResult, openResult, closedResult, permResult, ownerResult] = await Promise.all([
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM TRADE_NODES', []),
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM TRADE_NODES WHERE FACTION < 0', []),
                this.executeQuery(`SELECT COUNT(*) AS "cnt" FROM TRADE_NODES WHERE PERMISSION = ${TradePermissionPreset.UNIVERSAL_ACCESS}`, []),
                this.executeQuery(`SELECT COUNT(*) AS "cnt" FROM TRADE_NODES WHERE PERMISSION = ${TradePermissionPreset.NO_ACCESS}`, []),
                this.executeQuery('SELECT PERMISSION, COUNT(*) AS "cnt" FROM TRADE_NODES GROUP BY PERMISSION', []),
                this.executeQuery('SELECT PLAYER, COUNT(*) AS "cnt" FROM TRADE_NODES WHERE PLAYER IS NOT NULL GROUP BY PLAYER ORDER BY "cnt" DESC LIMIT 10', [])
            ]);

            const total = Number(totalResult[0]?.cnt ?? 0);
            const npc = Number(npcResult[0]?.cnt ?? 0);

            const permissionDistribution: Record<number, number> = {};
            permResult.forEach((r: any) => {
                permissionDistribution[Number(r.PERMISSION ?? -1)] = Number(r.cnt);
            });

            const topOwners = ownerResult.map((r: any) => ({
                owner: String(r.PLAYER),
                nodeCount: Number(r.cnt)
            }));

            return {
                totalNodes: total,
                npcNodes: npc,
                playerNodes: total - npc,
                openAccessNodes: Number(openResult[0]?.cnt ?? 0),
                closedNodes: Number(closedResult[0]?.cnt ?? 0),
                topOwners,
                permissionDistribution
            };
        } catch (error) {
            this.logger.error('Failed to compute trade node statistics', {
                operation: 'get-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Update the permission bitmask of a trade node
     * @param {number} nodeId - The trade node ID
     * @param {number | TradePermissionPreset} permission - New permission bitmask
     * @returns {Promise<TradeNodesModel>} The updated trade node record
     * @throws {ValidationError} If permission is out of range or node not found
     * @throws {ErrorFactory} If the query fails
     */
    public async updatePermissions(nodeId: number, permission: number | TradePermissionPreset): Promise<TradeNodesModel> {
        this.ensureInitialized();

        if (permission < 0 || permission > 31) {
            throw new ValidationError('permission', permission, 'Permission must be a bitmask between 0 and 31');
        }

        if (!await this.nodeExistsById(nodeId)) {
            throw new ValidationError('nodeId', nodeId, `Trade node ${nodeId} does not exist`);
        }

        return this.update(nodeId, { PERMISSION: permission }, { validatePermissions: false });
    }

    /**
     * Count total trade nodes matching optional filters
     * @param {TradeNodeSearchOptions} [options={}] - Filter options
     * @returns {Promise<number>} Number of matching records
     * @throws {ErrorFactory} If the query fails
     */
    public async count(options: TradeNodeSearchOptions = {}): Promise<number> {
        const records = await this.findAll({ ...options, limit: 0 });
        return records.length;
    }
}
