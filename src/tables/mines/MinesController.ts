/**
 * @fileoverview Mines Controller
 *
 * Controller for managing deployable mine records in the MINES table.
 * Provides tactical mine management, arming state tracking, and combat analytics.
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
    MinesModel,
    MineArmingState,
    MineStatus,
    MineModuleType,
    KnownMineFactions
} from './MinesModel.js';
import {
    ValidationError,
    ErrorFactory
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Search options for mine records
 */
export interface MineSearchOptions extends QueryOptions {
    /** Filter by owner player UID */
    owner?: string;
    /** Filter by faction ID */
    factionId?: number;
    /** Filter by sector X coordinate */
    sectorX?: number;
    /** Filter by sector Y coordinate */
    sectorY?: number;
    /** Filter by sector Z coordinate */
    sectorZ?: number;
    /** Filter by arming state */
    armingState?: MineArmingState;
    /** Filter by operational status */
    status?: MineStatus;
    /** Include only armed mines */
    armedOnly?: boolean;
    /** Include only unarmed mines */
    unarmedOnly?: boolean;
    /** Include only active mines (HP > 0) */
    activeOnly?: boolean;
    /** Include only NPC mines */
    npcOnly?: boolean;
    /** Include only player-owned mines */
    playerOwnedOnly?: boolean;
}

/**
 * Mine creation options
 */
export interface MineCreateOptions extends CreateOptions {
    /** Validate coordinate ranges */
    validateCoordinates?: boolean;
}

/**
 * Mine update options
 */
export interface MineUpdateOptions extends UpdateOptions {
    /** Allow arming state changes */
    allowArmingChange?: boolean;
}

/**
 * Bulk mine operation options
 */
export interface BulkMineOptions {
    /** Skip validation */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log operations */
    logOperations?: boolean;
    /** Batch size */
    batchSize?: number;
}

/**
 * Mine statistics
 */
export interface MineStatistics {
    /** Total mine records */
    totalMines: number;
    /** Armed mines */
    armedMines: number;
    /** Arming mines */
    armingMines: number;
    /** Disarmed mines */
    disarmedMines: number;
    /** Depleted mines */
    depletedMines: number;
    /** NPC-owned mines */
    npcMines: number;
    /** Player-owned mines */
    playerMines: number;
    /** Distribution by faction */
    factionDistribution: Record<string, number>;
    /** Top mine deployers */
    topOwners: Array<{ owner: string; count: number }>;
}

// =============================================================================
// MINES CONTROLLER
// =============================================================================

/**
 * Controller for MINES table with tactical mine management capabilities
 */
export class MinesController extends BaseController<MinesModel> {
    /** Model constructor used to map database rows and obtain the table schema. */
    protected ModelClass: ModelConstructor<MinesModel> = MinesModel;
    /** Controller name attached to logging and diagnostics. */
    protected controllerName = 'MinesController';

    /**
     * Create a new MinesController instance
     * @param {BaseControllerConfig} [config={}] - Controller configuration options
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 120000, // 2 min – mines change state frequently
            enableForeignKeyValidation: false,
            ...config
        });
    }

    // =============================================================================
    // EXISTENCE CHECKS
    // =============================================================================

    /**
     * Check if a mine record exists by ID
     * @param {number} mineId - The mine record ID
     * @returns {Promise<boolean>} True if the mine exists
     * @throws {ErrorFactory} If the query fails
     */
    public async mineExistsById(mineId: number): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM MINES WHERE ID = ?';
        try {
            const result = await this.executeQuery(sql, [mineId]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check mine existence', {
                operation: 'mine-exists-by-id', mineId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, [mineId]);
        }
    }

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    /**
     * Find all mine records with filtering and pagination
     * @param {MineSearchOptions} [options={}] - Search and pagination options
     * @returns {Promise<MinesModel[]>} Array of matching mine records
     * @throws {ErrorFactory} If the query fails
     */
    public async findAll(options: MineSearchOptions = {}): Promise<MinesModel[]> {
        this.validateQueryOptions(options);
        this.ensureInitialized();

        const {
            owner, factionId, sectorX, sectorY, sectorZ,
            armedOnly, unarmedOnly, activeOnly, npcOnly, playerOwnedOnly,
            limit = this.config.maxResults,
            offset = 0,
            orderBy = 'ID',
            orderDirection = 'ASC',
            skipCache = false,
            cacheTtl = this.config.cacheTtlMs
        } = options;

        const cacheKey = `MINES:find-all:${JSON.stringify(options)}`;

        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) return MinesModel.fromRows(cached);
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (owner !== undefined) { conditions.push('OWNER = ?'); params.push(owner); } // OWNER is BIGINT
        if (factionId !== undefined) { conditions.push('FACTION = ?'); params.push(factionId); }
        if (sectorX !== undefined) { conditions.push('SECTOR_X = ?'); params.push(sectorX); }
        if (sectorY !== undefined) { conditions.push('SECTOR_Y = ?'); params.push(sectorY); }
        if (sectorZ !== undefined) { conditions.push('SECTOR_Z = ?'); params.push(sectorZ); }
        if (armedOnly) { conditions.push('ARMED = TRUE'); }
        if (unarmedOnly) { conditions.push('ARMED = FALSE'); }
        if (activeOnly) { conditions.push('HP > 0'); }
        if (npcOnly) { conditions.push('FACTION < 0'); }
        if (playerOwnedOnly) { conditions.push('(FACTION >= 0 AND OWNER IS NOT NULL)'); }

        let sql = 'SELECT * FROM MINES';
        if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        if (limit > 0) { sql += ' LIMIT ?'; params.push(limit); }
        if (offset > 0) { sql += ' OFFSET ?'; params.push(offset); }

        try {
            const rows = await this.executeQuery(sql, params);
            const records = MinesModel.fromRows(rows);

            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, rows, { ttl: cacheTtl });
            }

            this.logger.debug('Mine records retrieved', { operation: 'find-all', count: records.length });
            return records;
        } catch (error) {
            this.logger.error('Failed to find mine records', {
                operation: 'find-all',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a single mine record by ID
     * @param {number} id - The mine record ID
     * @returns {Promise<MinesModel | null>} The mine record or null
     * @throws {ErrorFactory} If the query fails
     */
    public async findOne(id: number): Promise<MinesModel | null> {
        return this.findById(id);
    }

    /**
     * Find all mines owned by a specific player
     * @param {string} owner - Player UID
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<MinesModel[]>} Array of mine records
     * @throws {ValidationError} If owner is empty
     */
    public async findByOwner(owner: string, options: QueryOptions = {}): Promise<MinesModel[]> {
        if (!owner || owner.trim().length === 0) {
            throw new ValidationError('owner', owner, 'Owner cannot be empty');
        }
        return this.findAll({ ...options, owner });
    }

    /**
     * Find all mines in a specific sector
     * @param {number} x - Sector X coordinate
     * @param {number} y - Sector Y coordinate
     * @param {number} z - Sector Z coordinate
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<MinesModel[]>} Array of mine records in the sector
     */
    public async findInSector(x: number, y: number, z: number, options: QueryOptions = {}): Promise<MinesModel[]> {
        return this.findAll({ ...options, sectorX: x, sectorY: y, sectorZ: z });
    }

    /**
     * Find all armed mines
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<MinesModel[]>} Array of armed mine records
     */
    public async findArmed(options: QueryOptions = {}): Promise<MinesModel[]> {
        return this.findAll({ ...options, armedOnly: true });
    }

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    /**
     * Create a new mine record
     * @param {Partial<Record<string, any>>} data - Mine data to insert
     * @param {MineCreateOptions} [options={}] - Creation options
     * @returns {Promise<MinesModel>} The created mine record
     * @throws {ValidationError} If data validation fails
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: MineCreateOptions = {}
    ): Promise<MinesModel> {
        // Default arming values
        if (data.ARMED === undefined) { data = { ...data, ARMED: false }; }
        if (data.ARMED_IN_SECS === undefined) { data = { ...data, ARMED_IN_SECS: -1 }; }

        this.logger.info('Creating mine record', {
            operation: 'create', owner: data.OWNER, sector: `${data.SECTOR_X},${data.SECTOR_Y},${data.SECTOR_Z}`
        });

        return super.create(data, options);
    }

    /**
     * Update an existing mine record
     * @param {number} id - The mine record ID
     * @param {Partial<Record<string, any>>} data - Updated mine data
     * @param {MineUpdateOptions} [options={}] - Update options
     * @returns {Promise<MinesModel>} The updated mine record
     */
    public async update(
        id: number,
        data: Partial<Record<string, any>>,
        options: MineUpdateOptions = {}
    ): Promise<MinesModel> {
        this.logger.info('Updating mine record', { operation: 'update', id });
        return super.update(id, data, options);
    }

    /**
     * Delete a mine record
     * @param {number} id - The mine record ID
     * @param {DeleteOptions} [options={}] - Deletion options
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    public async delete(id: number, options: DeleteOptions = {}): Promise<boolean> {
        const exists = await this.mineExistsById(id);
        if (!exists) return false;

        this.logger.info('Deleting mine record', { operation: 'delete', id });
        return super.delete(id, options);
    }

    /**
     * Arm a mine immediately
     * @param {number} mineId - The mine record ID
     * @returns {Promise<MinesModel>} The updated mine record
     * @throws {ValidationError} If the mine does not exist
     */
    public async armMine(mineId: number): Promise<MinesModel> {
        if (!await this.mineExistsById(mineId)) {
            throw new ValidationError('mineId', mineId, `Mine ${mineId} does not exist`);
        }
        return this.update(mineId, { ARMED: true, ARMED_IN_SECS: -1 });
    }

    /**
     * Disarm a mine
     * @param {number} mineId - The mine record ID
     * @returns {Promise<MinesModel>} The updated mine record
     * @throws {ValidationError} If the mine does not exist
     */
    public async disarmMine(mineId: number): Promise<MinesModel> {
        if (!await this.mineExistsById(mineId)) {
            throw new ValidationError('mineId', mineId, `Mine ${mineId} does not exist`);
        }
        return this.update(mineId, { ARMED: false, ARMED_IN_SECS: -1 });
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Create multiple mine records
     * @param {Array<Partial<Record<string, any>>>} records - Array of mine data objects
     * @param {BulkMineOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkCreate(
        records: Array<Partial<Record<string, any>>>,
        options: BulkMineOptions = {}
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
     * Delete multiple mine records by ID
     * @param {number[]} ids - Array of mine record IDs
     * @param {BulkMineOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkDelete(ids: number[], options: BulkMineOptions = {}): Promise<BulkOperationResult> {
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
     * Get comprehensive mine statistics
     * @returns {Promise<MineStatistics>} Mine statistics object
     * @throws {ErrorFactory} If the query fails
     */
    public async getStatistics(): Promise<MineStatistics> {
        this.ensureInitialized();

        try {
            const [
                totalResult, armedResult, armingResult, disarmedResult, depletedResult,
                npcResult, factionResult, ownerResult
            ] = await Promise.all([
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM MINES', []),
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM MINES WHERE ARMED = TRUE', []),
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM MINES WHERE ARMED = FALSE AND ARMED_IN_SECS > 0', []),
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM MINES WHERE ARMED = FALSE AND ARMED_IN_SECS = -1', []),
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM MINES WHERE AMMO = 0', []),
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM MINES WHERE FACTION < 0', []),
                this.executeQuery('SELECT FACTION, COUNT(*) AS "cnt" FROM MINES GROUP BY FACTION', []),
                this.executeQuery('SELECT OWNER, COUNT(*) AS "cnt" FROM MINES WHERE OWNER IS NOT NULL GROUP BY OWNER ORDER BY "cnt" DESC LIMIT 10', [])
            ]);

            const total = Number(totalResult[0]?.cnt ?? 0);
            const npc = Number(npcResult[0]?.cnt ?? 0);

            const factionDistribution: Record<string, number> = {};
            factionResult.forEach((r: any) => {
                factionDistribution[String(r.FACTION)] = Number(r.cnt);
            });

            const topOwners = ownerResult.map((r: any) => ({
                owner: String(r.OWNER),
                count: Number(r.cnt)
            }));

            return {
                totalMines: total,
                armedMines: Number(armedResult[0]?.cnt ?? 0),
                armingMines: Number(armingResult[0]?.cnt ?? 0),
                disarmedMines: Number(disarmedResult[0]?.cnt ?? 0),
                depletedMines: Number(depletedResult[0]?.cnt ?? 0),
                npcMines: npc,
                playerMines: total - npc,
                factionDistribution,
                topOwners
            };
        } catch (error) {
            this.logger.error('Failed to compute mine statistics', {
                operation: 'get-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Count mines in a specific sector
     * @param {number} x - Sector X coordinate
     * @param {number} y - Sector Y coordinate
     * @param {number} z - Sector Z coordinate
     * @returns {Promise<number>} Number of mines in the sector
     */
    public async countInSector(x: number, y: number, z: number): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) AS "cnt" FROM MINES WHERE SECTOR_X = ? AND SECTOR_Y = ? AND SECTOR_Z = ?';
        try {
            const result = await this.executeQuery(sql, [x, y, z]);
            return Number(result[0]?.cnt ?? 0);
        } catch (error) {
            this.logger.error('Failed to count mines in sector', { operation: 'count-in-sector', x, y, z });
            throw ErrorFactory.createQueryError(sql, error, [x, y, z]);
        }
    }
}
