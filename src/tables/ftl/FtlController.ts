/**
 * @fileoverview FTL Controller
 *
 * Controller for managing faster-than-light jump connection records in the FTL table.
 * Provides jump gate and wormhole management, access control, and routing analytics.
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
    FtlModel,
    FtlType,
    FtlPermission,
    FTL_PERMISSION_COMBINATIONS
} from './FtlModel.js';
import {
    ValidationError,
    ErrorFactory
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Search options for FTL records
 */
export interface FtlSearchOptions extends QueryOptions {
    /** Filter by FTL connection type */
    ftlType?: FtlType;
    /** Filter by source sector X coordinate */
    fromX?: number;
    /** Filter by source sector Y coordinate */
    fromY?: number;
    /** Filter by source sector Z coordinate */
    fromZ?: number;
    /** Filter by destination sector X coordinate */
    toX?: number;
    /** Filter by destination sector Y coordinate */
    toY?: number;
    /** Filter by destination sector Z coordinate */
    toZ?: number;
    /** Include only peace-zone connections */
    peaceZoneOnly?: boolean;
    /** Include only locked connections */
    lockedOnly?: boolean;
    /** Filter by specific permission bitmask */
    permission?: number;
}

/**
 * FTL creation options
 */
export interface FtlCreateOptions extends CreateOptions {
    /** Validate sector coordinate ranges */
    validateCoordinates?: boolean;
    /** Prevent duplicate connections between same sectors */
    preventDuplicates?: boolean;
}

/**
 * FTL update options
 */
export interface FtlUpdateOptions extends UpdateOptions {
    /** Validate permission bitmask */
    validatePermission?: boolean;
}

/**
 * Bulk FTL operation options
 */
export interface BulkFtlOptions {
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
 * FTL statistics
 */
export interface FtlStatistics {
    /** Total FTL connections */
    totalConnections: number;
    /** Connections by type */
    byType: Record<string, number>;
    /** Peace zone connections */
    peaceZoneCount: number;
    /** Locked connections */
    lockedCount: number;
    /** Unrestricted connections */
    unrestrictedCount: number;
}

// =============================================================================
// FTL CONTROLLER
// =============================================================================

/**
 * Controller for FTL table with jump connection management capabilities
 */
export class FtlController extends BaseController<FtlModel> {
    protected ModelClass: ModelConstructor<FtlModel> = FtlModel;
    protected controllerName = 'FtlController';

    /**
     * Create a new FtlController instance
     * @param {BaseControllerConfig} [config={}] - Controller configuration options
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 600000, // 10 min – FTL connections are rarely changed
            enableForeignKeyValidation: false,
            ...config
        });
    }

    // =============================================================================
    // EXISTENCE CHECKS
    // =============================================================================

    /**
     * Check if a FTL connection exists by ID
     * @param {number} ftlId - The FTL record ID
     * @returns {Promise<boolean>} True if the record exists
     * @throws {ErrorFactory} If the query fails
     */
    public async ftlExistsById(ftlId: number): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM FTL WHERE ID = ?';
        try {
            const result = await this.executeQuery(sql, [ftlId]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check FTL existence', {
                operation: 'ftl-exists-by-id', ftlId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, [ftlId]);
        }
    }

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    /**
     * Find all FTL connection records with filtering and pagination
     * @param {FtlSearchOptions} [options={}] - Search and pagination options
     * @returns {Promise<FtlModel[]>} Array of matching FTL records
     * @throws {ErrorFactory} If the query fails
     */
    public async findAll(options: FtlSearchOptions = {}): Promise<FtlModel[]> {
        this.ensureInitialized();

        const {
            ftlType,
            fromX, fromY, fromZ,
            toX, toY, toZ,
            peaceZoneOnly,
            lockedOnly,
            permission,
            limit = this.config.maxResults,
            offset = 0,
            orderBy = 'ID',
            orderDirection = 'ASC',
            skipCache = false,
            cacheTtl = this.config.cacheTtlMs
        } = options;

        const cacheKey = `FTL:find-all:${JSON.stringify(options)}`;

        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) return FtlModel.fromRows(cached);
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (ftlType !== undefined) { conditions.push('TYPE = ?'); params.push(ftlType); }
        if (fromX !== undefined) { conditions.push('FROM_X = ?'); params.push(fromX); }
        if (fromY !== undefined) { conditions.push('FROM_Y = ?'); params.push(fromY); }
        if (fromZ !== undefined) { conditions.push('FROM_Z = ?'); params.push(fromZ); }
        if (toX !== undefined) { conditions.push('TO_X = ?'); params.push(toX); }
        if (toY !== undefined) { conditions.push('TO_Y = ?'); params.push(toY); }
        if (toZ !== undefined) { conditions.push('TO_Z = ?'); params.push(toZ); }
        if (peaceZoneOnly) {
            conditions.push(`PERMISSION = ${FTL_PERMISSION_COMBINATIONS.PEACE_ZONE}`);
        }
        if (lockedOnly) {
            conditions.push(`PERMISSION = ${FTL_PERMISSION_COMBINATIONS.LOCKED}`);
        }
        if (permission !== undefined) { conditions.push('PERMISSION = ?'); params.push(permission); }

        let sql = 'SELECT * FROM FTL';
        if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        if (limit > 0) { sql += ' LIMIT ?'; params.push(limit); }
        if (offset > 0) { sql += ' OFFSET ?'; params.push(offset); }

        try {
            const rows = await this.executeQuery(sql, params);
            const records = FtlModel.fromRows(rows);

            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, rows, { ttl: cacheTtl });
            }

            this.logger.debug('FTL records retrieved', { operation: 'find-all', count: records.length });
            return records;
        } catch (error) {
            this.logger.error('Failed to find FTL records', {
                operation: 'find-all',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a single FTL record by ID
     * @param {number} id - The FTL record ID
     * @returns {Promise<FtlModel | null>} The FTL record or null
     * @throws {ErrorFactory} If the query fails
     */
    public async findOne(id: number): Promise<FtlModel | null> {
        return this.findById(id);
    }

    /**
     * Find all FTL connections of a specific type
     * @param {FtlType} ftlType - The FTL connection type
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<FtlModel[]>} Array of FTL records of the specified type
     * @throws {ErrorFactory} If the query fails
     */
    public async findByType(ftlType: FtlType, options: QueryOptions = {}): Promise<FtlModel[]> {
        return this.findAll({ ...options, ftlType });
    }

    /**
     * Find all FTL connections originating from a sector
     * @param {number} x - Sector X coordinate
     * @param {number} y - Sector Y coordinate
     * @param {number} z - Sector Z coordinate
     * @returns {Promise<FtlModel[]>} Array of FTL records starting from this sector
     * @throws {ErrorFactory} If the query fails
     */
    public async findFromSector(x: number, y: number, z: number): Promise<FtlModel[]> {
        return this.findAll({ fromX: x, fromY: y, fromZ: z });
    }

    /**
     * Find all FTL connections pointing to a sector
     * @param {number} x - Sector X coordinate
     * @param {number} y - Sector Y coordinate
     * @param {number} z - Sector Z coordinate
     * @returns {Promise<FtlModel[]>} Array of FTL records ending at this sector
     * @throws {ErrorFactory} If the query fails
     */
    public async findToSector(x: number, y: number, z: number): Promise<FtlModel[]> {
        return this.findAll({ toX: x, toY: y, toZ: z });
    }

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    /**
     * Create a new FTL connection record
     * @param {Partial<Record<string, any>>} data - FTL connection data
     * @param {FtlCreateOptions} [options={}] - Creation options
     * @returns {Promise<FtlModel>} The created FTL record
     * @throws {ValidationError} If data validation fails
     * @throws {ErrorFactory} If the query fails
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: FtlCreateOptions = {}
    ): Promise<FtlModel> {
        if (data.TYPE === undefined) {
            throw new ValidationError('TYPE', data.TYPE, 'FTL TYPE is required');
        }

        // Default permission to NORMAL (no restrictions)
        if (data.PERMISSION === undefined) {
            data = { ...data, PERMISSION: FTL_PERMISSION_COMBINATIONS.NORMAL };
        }

        this.logger.info('Creating FTL record', {
            operation: 'create', type: data.TYPE
        });

        return super.create(data, options);
    }

    /**
     * Update an existing FTL record
     * @param {number} id - The FTL record ID
     * @param {Partial<Record<string, any>>} data - Updated FTL data
     * @param {FtlUpdateOptions} [options={}] - Update options
     * @returns {Promise<FtlModel>} The updated FTL record
     * @throws {ValidationError} If validation fails
     * @throws {ErrorFactory} If the query fails
     */
    public async update(
        id: number,
        data: Partial<Record<string, any>>,
        options: FtlUpdateOptions = {}
    ): Promise<FtlModel> {
        const { validatePermission = true, ...baseOptions } = options;

        if (validatePermission && data.PERMISSION !== undefined && data.PERMISSION !== null) {
            const perm = Number(data.PERMISSION);
            // Max permission is 6 bits set = 63
            if (perm < 0 || perm > 63) {
                throw new ValidationError('PERMISSION', data.PERMISSION,
                    'FTL PERMISSION must be a bitmask between 0 and 63');
            }
        }

        this.logger.info('Updating FTL record', { operation: 'update', id });
        return super.update(id, data, baseOptions);
    }

    /**
     * Delete a FTL connection record
     * @param {number} id - The FTL record ID
     * @param {DeleteOptions} [options={}] - Deletion options
     * @returns {Promise<boolean>} True if deleted, false if not found
     * @throws {ErrorFactory} If the query fails
     */
    public async delete(id: number, options: DeleteOptions = {}): Promise<boolean> {
        const exists = await this.ftlExistsById(id);
        if (!exists) return false;

        this.logger.info('Deleting FTL record', { operation: 'delete', id });
        return super.delete(id, options);
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Create multiple FTL connection records
     * @param {Array<Partial<Record<string, any>>>} records - Array of FTL data objects
     * @param {BulkFtlOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkCreate(
        records: Array<Partial<Record<string, any>>>,
        options: BulkFtlOptions = {}
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
     * Delete multiple FTL records by ID
     * @param {number[]} ids - Array of FTL record IDs
     * @param {BulkFtlOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkDelete(ids: number[], options: BulkFtlOptions = {}): Promise<BulkOperationResult> {
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
     * Get comprehensive FTL connection statistics
     * @returns {Promise<FtlStatistics>} FTL statistics object
     * @throws {ErrorFactory} If the query fails
     */
    public async getStatistics(): Promise<FtlStatistics> {
        this.ensureInitialized();

        try {
            const [totalResult, typeResult, peaceResult, lockedResult, unrestrictedResult] = await Promise.all([
                this.executeQuery('SELECT COUNT(*) AS cnt FROM FTL', []),
                this.executeQuery('SELECT TYPE, COUNT(*) AS cnt FROM FTL GROUP BY TYPE', []),
                this.executeQuery(`SELECT COUNT(*) AS cnt FROM FTL WHERE PERMISSION = ${FTL_PERMISSION_COMBINATIONS.PEACE_ZONE}`, []),
                this.executeQuery(`SELECT COUNT(*) AS cnt FROM FTL WHERE PERMISSION = ${FTL_PERMISSION_COMBINATIONS.LOCKED}`, []),
                this.executeQuery(`SELECT COUNT(*) AS cnt FROM FTL WHERE PERMISSION = ${FTL_PERMISSION_COMBINATIONS.NORMAL}`, [])
            ]);

            const byType: Record<string, number> = {};
            typeResult.forEach((r: any) => {
                byType[FtlType[r.TYPE as number] ?? String(r.TYPE)] = Number(r.cnt);
            });

            return {
                totalConnections: Number(totalResult[0]?.cnt ?? 0),
                byType,
                peaceZoneCount: Number(peaceResult[0]?.cnt ?? 0),
                lockedCount: Number(lockedResult[0]?.cnt ?? 0),
                unrestrictedCount: Number(unrestrictedResult[0]?.cnt ?? 0)
            };
        } catch (error) {
            this.logger.error('Failed to compute FTL statistics', {
                operation: 'get-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
}
