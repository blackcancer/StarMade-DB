/**
 * @fileoverview NPC Stats Controller
 *
 * Controller for managing NPC spawn statistics in the NPC_STATS table.
 * Provides faction spawn analytics and system-level NPC activity tracking.
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
import { NPCStatsModel } from './NpcStatsModel.js';
import {
    ValidationError,
    ErrorFactory
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Composite primary key for NPC_STATS records
 */
export interface NpcStatsKey {
    /** NPC faction ID */
    id: number;
    /** System X coordinate */
    sysX: number;
    /** System Y coordinate */
    sysY: number;
    /** System Z coordinate */
    sysZ: number;
}

/**
 * Search options for NPC stats records
 */
export interface NpcStatsSearchOptions extends QueryOptions {
    /** Filter by NPC faction ID */
    factionId?: number;
    /** Filter by system X coordinate */
    sysX?: number;
    /** Filter by system Y coordinate */
    sysY?: number;
    /** Filter by system Z coordinate */
    sysZ?: number;
    /** Minimum fleet spawns */
    minFleetSpawns?: number;
    /** Minimum entity spawns */
    minEntitySpawns?: number;
    /** Include only active systems (at least one spawn) */
    activeOnly?: boolean;
    /** Order by spawn activity (most active first) */
    orderByActivity?: boolean;
}

/**
 * NPC stats update options
 */
export interface NpcStatsUpdateOptions extends UpdateOptions {
    /** Allow decrementing spawn counters */
    allowDecrement?: boolean;
}

/**
 * Bulk NPC stats operation options
 */
export interface BulkNpcStatsOptions {
    /** Skip validation */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log operations */
    logOperations?: boolean;
}

/**
 * NPC stats aggregate statistics
 */
export interface NpcStatsStatistics {
    /** Total NPC stat records */
    totalRecords: number;
    /** Distinct factions tracked */
    distinctFactions: number;
    /** Distinct systems tracked */
    distinctSystems: number;
    /** Total fleet spawns across all records */
    totalFleetSpawns: number;
    /** Total entity spawns across all records */
    totalEntitySpawns: number;
    /** Most active factions */
    mostActiveFactions: Array<{ factionId: number; totalSpawns: number }>;
    /** Most active systems */
    mostActiveSystems: Array<{ x: number; y: number; z: number; totalSpawns: number }>;
}

// =============================================================================
// NPC STATS CONTROLLER
// =============================================================================

/**
 * Controller for NPC_STATS table with spawn analytics capabilities
 */
export class NpcStatsController extends BaseController<NPCStatsModel> {
    protected ModelClass: ModelConstructor<NPCStatsModel> = NPCStatsModel;
    protected controllerName = 'NpcStatsController';

    /**
     * Create a new NpcStatsController instance
     * @param {BaseControllerConfig} [config={}] - Controller configuration options
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 600000, // 10 min – spawn stats are updated periodically
            enableForeignKeyValidation: false,
            ...config
        });
    }

    // =============================================================================
    // EXISTENCE CHECKS
    // =============================================================================

    /**
     * Check if a NPC stats record exists by composite primary key
     * @param {NpcStatsKey} key - The composite primary key
     * @returns {Promise<boolean>} True if the record exists
     * @throws {ErrorFactory} If the query fails
     */
    public async recordExists(key: NpcStatsKey): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM NPC_STATS WHERE ID = ? AND SYS_X = ? AND SYS_Y = ? AND SYS_Z = ?';
        try {
            const result = await this.executeQuery(sql, [key.id, key.sysX, key.sysY, key.sysZ]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check NPC stats existence', {
                operation: 'record-exists', key,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, [key.id, key.sysX, key.sysY, key.sysZ]);
        }
    }

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    /**
     * Find all NPC stats records with filtering and pagination
     * @param {NpcStatsSearchOptions} [options={}] - Search and pagination options
     * @returns {Promise<NPCStatsModel[]>} Array of matching NPC stats records
     * @throws {ErrorFactory} If the query fails
     */
    public async findAll(options: NpcStatsSearchOptions = {}): Promise<NPCStatsModel[]> {
        this.ensureInitialized();

        const {
            factionId, sysX, sysY, sysZ,
            minFleetSpawns, minEntitySpawns, activeOnly, orderByActivity,
            limit = this.config.maxResults,
            offset = 0,
            orderBy = orderByActivity ? '(FLEET_SPAWNS + ENTITY_SPAWNS)' : 'ID',
            orderDirection = orderByActivity ? 'DESC' : 'ASC',
            skipCache = false,
            cacheTtl = this.config.cacheTtlMs
        } = options;

        const cacheKey = `NPC_STATS:find-all:${JSON.stringify(options)}`;

        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) return NPCStatsModel.fromRows(cached);
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (factionId !== undefined) { conditions.push('ID = ?'); params.push(factionId); }
        if (sysX !== undefined) { conditions.push('SYS_X = ?'); params.push(sysX); }
        if (sysY !== undefined) { conditions.push('SYS_Y = ?'); params.push(sysY); }
        if (sysZ !== undefined) { conditions.push('SYS_Z = ?'); params.push(sysZ); }
        if (minFleetSpawns !== undefined) { conditions.push('FLEET_SPAWNS >= ?'); params.push(minFleetSpawns); }
        if (minEntitySpawns !== undefined) { conditions.push('ENTITY_SPAWNS >= ?'); params.push(minEntitySpawns); }
        if (activeOnly) { conditions.push('(FLEET_SPAWNS > 0 OR ENTITY_SPAWNS > 0)'); }

        let sql = 'SELECT * FROM NPC_STATS';
        if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        if (limit > 0) { sql += ' LIMIT ?'; params.push(limit); }
        if (offset > 0) { sql += ' OFFSET ?'; params.push(offset); }

        try {
            const rows = await this.executeQuery(sql, params);
            const records = NPCStatsModel.fromRows(rows);

            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, rows, { ttl: cacheTtl });
            }

            this.logger.debug('NPC stats retrieved', { operation: 'find-all', count: records.length });
            return records;
        } catch (error) {
            this.logger.error('Failed to find NPC stats', {
                operation: 'find-all',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a NPC stats record by composite primary key
     * @param {NpcStatsKey} key - The composite primary key
     * @returns {Promise<NPCStatsModel | null>} The NPC stats record or null
     * @throws {ErrorFactory} If the query fails
     */
    public async findOne(key: NpcStatsKey): Promise<NPCStatsModel | null> {
        return this.findById({ ID: key.id, SYS_X: key.sysX, SYS_Y: key.sysY, SYS_Z: key.sysZ });
    }

    /**
     * Find all NPC stats records for a specific faction
     * @param {number} factionId - The NPC faction ID
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<NPCStatsModel[]>} Array of NPC stats records for the faction
     * @throws {ErrorFactory} If the query fails
     */
    public async findByFaction(factionId: number, options: QueryOptions = {}): Promise<NPCStatsModel[]> {
        return this.findAll({ ...options, factionId });
    }

    /**
     * Find all NPC stats records for a specific system
     * @param {number} x - System X coordinate
     * @param {number} y - System Y coordinate
     * @param {number} z - System Z coordinate
     * @returns {Promise<NPCStatsModel[]>} Array of NPC stats records for the system
     * @throws {ErrorFactory} If the query fails
     */
    public async findBySystem(x: number, y: number, z: number): Promise<NPCStatsModel[]> {
        return this.findAll({ sysX: x, sysY: y, sysZ: z });
    }

    /**
     * Find the most active systems sorted by total spawn count
     * @param {number} [limit=10] - Maximum number of systems to return
     * @returns {Promise<NPCStatsModel[]>} Array of most active NPC stats records
     * @throws {ErrorFactory} If the query fails
     */
    public async findMostActive(limit: number = 10): Promise<NPCStatsModel[]> {
        return this.findAll({ orderByActivity: true, limit });
    }

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    /**
     * Create a new NPC stats record
     * @param {Partial<Record<string, any>>} data - NPC stats data to insert
     * @param {CreateOptions} [options={}] - Creation options
     * @returns {Promise<NPCStatsModel>} The created NPC stats record
     * @throws {ValidationError} If required fields are missing
     * @throws {ErrorFactory} If the query fails
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: CreateOptions = {}
    ): Promise<NPCStatsModel> {
        if (data.ID === undefined) {
            throw new ValidationError('ID', data.ID, 'NPC faction ID (ID) is required');
        }
        if (data.SYS_X === undefined || data.SYS_Y === undefined || data.SYS_Z === undefined) {
            throw new ValidationError('SYS_X/SYS_Y/SYS_Z', data, 'System coordinates are required');
        }

        // Default spawn counters
        if (data.FLEET_SPAWNS === undefined) { data = { ...data, FLEET_SPAWNS: 0 }; }
        if (data.ENTITY_SPAWNS === undefined) { data = { ...data, ENTITY_SPAWNS: 0 }; }

        this.logger.info('Creating NPC stats record', {
            operation: 'create',
            factionId: data.ID,
            system: `${data.SYS_X},${data.SYS_Y},${data.SYS_Z}`
        });

        return super.create(data, options);
    }

    /**
     * Update a NPC stats record by composite key
     * @param {NpcStatsKey} key - The composite primary key
     * @param {Partial<Record<string, any>>} data - Updated NPC stats data
     * @param {NpcStatsUpdateOptions} [options={}] - Update options
     * @returns {Promise<NPCStatsModel>} The updated NPC stats record
     * @throws {ValidationError} If the record does not exist or counters are invalid
     * @throws {ErrorFactory} If the query fails
     */
    public async update(
        key: NpcStatsKey,
        data: Partial<Record<string, any>>,
        options: NpcStatsUpdateOptions = {}
    ): Promise<NPCStatsModel> {
        const { allowDecrement = false, ...baseOptions } = options;

        if (!allowDecrement) {
            if (data.FLEET_SPAWNS !== undefined && data.FLEET_SPAWNS !== null && Number(data.FLEET_SPAWNS) < 0) {
                throw new ValidationError('FLEET_SPAWNS', data.FLEET_SPAWNS, 'Fleet spawn count cannot be negative');
            }
            if (data.ENTITY_SPAWNS !== undefined && data.ENTITY_SPAWNS !== null && Number(data.ENTITY_SPAWNS) < 0) {
                throw new ValidationError('ENTITY_SPAWNS', data.ENTITY_SPAWNS, 'Entity spawn count cannot be negative');
            }
        }

        const compositeId = { ID: key.id, SYS_X: key.sysX, SYS_Y: key.sysY, SYS_Z: key.sysZ };
        this.logger.info('Updating NPC stats record', { operation: 'update', key });
        return super.update(compositeId, data, baseOptions);
    }

    /**
     * Delete a NPC stats record by composite key
     * @param {NpcStatsKey} key - The composite primary key
     * @param {DeleteOptions} [options={}] - Deletion options
     * @returns {Promise<boolean>} True if deleted, false if not found
     * @throws {ErrorFactory} If the query fails
     */
    public async delete(key: NpcStatsKey, options: DeleteOptions = {}): Promise<boolean> {
        const compositeId = { ID: key.id, SYS_X: key.sysX, SYS_Y: key.sysY, SYS_Z: key.sysZ };
        this.logger.info('Deleting NPC stats record', { operation: 'delete', key });
        return super.delete(compositeId, options);
    }

    /**
     * Increment the fleet spawn counter for a record (upsert)
     * @param {NpcStatsKey} key - The composite primary key
     * @param {number} [count=1] - Amount to increment
     * @returns {Promise<NPCStatsModel>} The updated or created NPC stats record
     * @throws {ErrorFactory} If the query fails
     */
    public async incrementFleetSpawns(key: NpcStatsKey, count: number = 1): Promise<NPCStatsModel> {
        this.ensureInitialized();

        const existing = await this.findOne(key);
        if (existing) {
            const currentCount = (existing.get('FLEET_SPAWNS') as number) ?? 0;
            return this.update(key, { FLEET_SPAWNS: currentCount + count }, { allowDecrement: true });
        }

        return this.create({
            ID: key.id,
            SYS_X: key.sysX,
            SYS_Y: key.sysY,
            SYS_Z: key.sysZ,
            FLEET_SPAWNS: count,
            ENTITY_SPAWNS: 0
        });
    }

    /**
     * Increment the entity spawn counter for a record (upsert)
     * @param {NpcStatsKey} key - The composite primary key
     * @param {number} [count=1] - Amount to increment
     * @returns {Promise<NPCStatsModel>} The updated or created NPC stats record
     * @throws {ErrorFactory} If the query fails
     */
    public async incrementEntitySpawns(key: NpcStatsKey, count: number = 1): Promise<NPCStatsModel> {
        this.ensureInitialized();

        const existing = await this.findOne(key);
        if (existing) {
            const currentCount = (existing.get('ENTITY_SPAWNS') as number) ?? 0;
            return this.update(key, { ENTITY_SPAWNS: currentCount + count }, { allowDecrement: true });
        }

        return this.create({
            ID: key.id,
            SYS_X: key.sysX,
            SYS_Y: key.sysY,
            SYS_Z: key.sysZ,
            FLEET_SPAWNS: 0,
            ENTITY_SPAWNS: count
        });
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Create multiple NPC stats records
     * @param {Array<Partial<Record<string, any>>>} records - Array of NPC stats data
     * @param {BulkNpcStatsOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkCreate(
        records: Array<Partial<Record<string, any>>>,
        options: BulkNpcStatsOptions = {}
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
     * Delete multiple NPC stats records
     * @param {NpcStatsKey[]} keys - Array of composite primary keys
     * @param {BulkNpcStatsOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkDelete(keys: NpcStatsKey[], options: BulkNpcStatsOptions = {}): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const { continueOnError = true } = options;
        const result: BulkOperationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

        for (let i = 0; i < keys.length; i++) {
            try {
                const deleted = await this.delete(keys[i]);
                if (deleted) { result.success++; } else { result.skipped++; }
            } catch (error) {
                result.failed++;
                result.errors.push({ index: i, error: error instanceof Error ? error.message : String(error), data: keys[i] });
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
     * Get comprehensive NPC spawn statistics
     * @returns {Promise<NpcStatsStatistics>} NPC stats statistics object
     * @throws {ErrorFactory} If the query fails
     */
    public async getStatistics(): Promise<NpcStatsStatistics> {
        this.ensureInitialized();

        try {
            const [
                totalResult, factionResult, systemResult,
                fleetSumResult, entitySumResult,
                topFactionsResult, topSystemsResult
            ] = await Promise.all([
                this.executeQuery('SELECT COUNT(*) AS cnt FROM NPC_STATS', []),
                this.executeQuery('SELECT COUNT(DISTINCT ID) AS cnt FROM NPC_STATS', []),
                this.executeQuery('SELECT COUNT(DISTINCT SYS_X || \',\' || SYS_Y || \',\' || SYS_Z) AS cnt FROM NPC_STATS', []),
                this.executeQuery('SELECT SUM(FLEET_SPAWNS) AS total FROM NPC_STATS', []),
                this.executeQuery('SELECT SUM(ENTITY_SPAWNS) AS total FROM NPC_STATS', []),
                this.executeQuery('SELECT ID, SUM(FLEET_SPAWNS + ENTITY_SPAWNS) AS total FROM NPC_STATS GROUP BY ID ORDER BY total DESC LIMIT 5', []),
                this.executeQuery('SELECT SYS_X, SYS_Y, SYS_Z, SUM(FLEET_SPAWNS + ENTITY_SPAWNS) AS total FROM NPC_STATS GROUP BY SYS_X, SYS_Y, SYS_Z ORDER BY total DESC LIMIT 5', [])
            ]);

            const mostActiveFactions = topFactionsResult.map((r: any) => ({
                factionId: Number(r.ID),
                totalSpawns: Number(r.total)
            }));

            const mostActiveSystems = topSystemsResult.map((r: any) => ({
                x: Number(r.SYS_X),
                y: Number(r.SYS_Y),
                z: Number(r.SYS_Z),
                totalSpawns: Number(r.total)
            }));

            return {
                totalRecords: Number(totalResult[0]?.cnt ?? 0),
                distinctFactions: Number(factionResult[0]?.cnt ?? 0),
                distinctSystems: Number(systemResult[0]?.cnt ?? 0),
                totalFleetSpawns: Number(fleetSumResult[0]?.total ?? 0),
                totalEntitySpawns: Number(entitySumResult[0]?.total ?? 0),
                mostActiveFactions,
                mostActiveSystems
            };
        } catch (error) {
            this.logger.error('Failed to compute NPC stats statistics', {
                operation: 'get-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
}
