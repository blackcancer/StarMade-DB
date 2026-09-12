/**
 * @fileoverview Visibility Controller
 *
 * Controller for managing sector visibility (fog-of-war) records in the VISIBILITY table.
 * Provides spatial reconnaissance tracking, observation analytics, and exploration management.
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
import { VisibilityModel, KnownObserver } from './VisibilityModel.js';
import {
    ValidationError,
    ErrorFactory
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Composite primary key for VISIBILITY records
 */
export interface VisibilityKey {
    /** Observer ID (player or faction) */
    id: number;
    /** Sector X coordinate */
    x: number;
    /** Sector Y coordinate */
    y: number;
    /** Sector Z coordinate */
    z: number;
}

/**
 * Search options for visibility records
 */
export interface VisibilitySearchOptions extends QueryOptions {
    /** Filter by observer ID */
    observerId?: number;
    /** Filter by sector X coordinate */
    x?: number;
    /** Filter by sector Y coordinate */
    y?: number;
    /** Filter by sector Z coordinate */
    z?: number;
    /** Filter observations after this timestamp */
    observedAfter?: number;
    /** Filter observations before this timestamp */
    observedBefore?: number;
    /** Include only NPC faction observations */
    npcOnly?: boolean;
    /** Include only player observations (positive IDs) */
    playerOnly?: boolean;
    /** Order by most recently observed */
    orderByRecent?: boolean;
}

/**
 * Visibility update options
 */
export interface VisibilityUpdateOptions extends UpdateOptions {
    /** Allow updating the observation timestamp */
    allowTimestampUpdate?: boolean;
}

/**
 * Bulk visibility operation options
 */
export interface BulkVisibilityOptions {
    /** Skip validation */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log operations */
    logOperations?: boolean;
}

/**
 * Visibility statistics
 */
export interface VisibilityStatistics {
    /** Total observation records */
    totalObservations: number;
    /** Distinct observers */
    distinctObservers: number;
    /** Distinct observed sectors */
    distinctSectors: number;
    /** NPC faction observations */
    npcObservations: number;
    /** Player observations */
    playerObservations: number;
    /** Most explored observers */
    topExplorers: Array<{ observerId: number; sectorCount: number }>;
    /** Most observed sectors */
    mostObservedSectors: Array<{ x: number; y: number; z: number; observerCount: number }>;
}

// =============================================================================
// VISIBILITY CONTROLLER
// =============================================================================

/**
 * Controller for VISIBILITY table with fog-of-war and exploration management
 */
export class VisibilityController extends BaseController<VisibilityModel> {
    /** Model constructor used to map database rows and obtain the table schema. */
    protected ModelClass: ModelConstructor<VisibilityModel> = VisibilityModel;
    /** Controller name attached to logging and diagnostics. */
    protected controllerName = 'VisibilityController';

    /**
     * Create a new VisibilityController instance
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
     * Check if a visibility record exists by composite primary key
     * @param {VisibilityKey} key - The composite primary key
     * @returns {Promise<boolean>} True if the record exists
     * @throws {ErrorFactory} If the query fails
     */
    public async recordExists(key: VisibilityKey): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM VISIBILITY WHERE ID = ? AND X = ? AND Y = ? AND Z = ?';
        try {
            const result = await this.executeQuery(sql, [key.id, key.x, key.y, key.z]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check visibility existence', {
                operation: 'record-exists', key,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, [key.id, key.x, key.y, key.z]);
        }
    }

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    /**
     * Find all visibility records with filtering and pagination
     * @param {VisibilitySearchOptions} [options={}] - Search and pagination options
     * @returns {Promise<VisibilityModel[]>} Array of matching visibility records
     * @throws {ErrorFactory} If the query fails
     */
    public async findAll(options: VisibilitySearchOptions = {}): Promise<VisibilityModel[]> {
        this.validateQueryOptions(options);
        this.ensureInitialized();

        const {
            observerId, x, y, z, observedAfter, observedBefore,
            npcOnly, playerOnly, orderByRecent,
            limit = this.config.maxResults,
            offset = 0,
            orderBy = orderByRecent ? 'TIMESTAMP' : 'ID',
            orderDirection = orderByRecent ? 'DESC' : 'ASC',
            skipCache = false,
            cacheTtl = this.config.cacheTtlMs
        } = options;

        const cacheKey = `VISIBILITY:find-all:${JSON.stringify(options)}`;

        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) return VisibilityModel.fromRows(cached);
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (observerId !== undefined) { conditions.push('ID = ?'); params.push(observerId); }
        if (x !== undefined) { conditions.push('X = ?'); params.push(x); }
        if (y !== undefined) { conditions.push('Y = ?'); params.push(y); }
        if (z !== undefined) { conditions.push('Z = ?'); params.push(z); }
        if (observedAfter !== undefined) { conditions.push('TIMESTAMP >= ?'); params.push(observedAfter); }
        if (observedBefore !== undefined) { conditions.push('TIMESTAMP <= ?'); params.push(observedBefore); }
        if (npcOnly) { conditions.push('ID < 0'); }
        if (playerOnly) { conditions.push('ID > 0'); }

        let sql = 'SELECT * FROM VISIBILITY';
        if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        if (limit > 0) { sql += ' LIMIT ?'; params.push(limit); }
        if (offset > 0) { sql += ' OFFSET ?'; params.push(offset); }

        try {
            const rows = await this.executeQuery(sql, params);
            const records = VisibilityModel.fromRows(rows);

            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, rows, { ttl: cacheTtl });
            }

            this.logger.debug('Visibility records retrieved', { operation: 'find-all', count: records.length });
            return records;
        } catch (error) {
            this.logger.error('Failed to find visibility records', {
                operation: 'find-all',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a visibility record by composite primary key
     * @param {VisibilityKey} key - The composite primary key
     * @returns {Promise<VisibilityModel | null>} The visibility record or null
     * @throws {ErrorFactory} If the query fails
     */
    public async findOne(key: VisibilityKey): Promise<VisibilityModel | null> {
        return this.findById({ ID: key.id, X: key.x, Y: key.y, Z: key.z });
    }

    /**
     * Find all sectors observed by a specific observer
     * @param {number} observerId - The observer ID (player or faction)
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<VisibilityModel[]>} Array of visibility records for the observer
     * @throws {ErrorFactory} If the query fails
     */
    public async findByObserver(observerId: number, options: QueryOptions = {}): Promise<VisibilityModel[]> {
        return this.findAll({ ...options, observerId });
    }

    /**
     * Find all observers who have seen a specific sector
     * @param {number} x - Sector X coordinate
     * @param {number} y - Sector Y coordinate
     * @param {number} z - Sector Z coordinate
     * @returns {Promise<VisibilityModel[]>} Array of visibility records for the sector
     * @throws {ErrorFactory} If the query fails
     */
    public async findBySector(x: number, y: number, z: number): Promise<VisibilityModel[]> {
        return this.findAll({ x, y, z });
    }

    /**
     * Find all visibility records for NPC factions
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<VisibilityModel[]>} Array of NPC visibility records
     */
    public async findNPCObservations(options: QueryOptions = {}): Promise<VisibilityModel[]> {
        return this.findAll({ ...options, npcOnly: true });
    }

    /**
     * Find the most recently observed sectors
     * @param {number} [limit=10] - Maximum number of records to return
     * @returns {Promise<VisibilityModel[]>} Array of most recently observed visibility records
     */
    public async findMostRecent(limit: number = 10): Promise<VisibilityModel[]> {
        return this.findAll({ orderByRecent: true, limit });
    }

    /**
     * Check whether a specific observer has visibility of a sector
     * @param {number} observerId - The observer ID
     * @param {number} x - Sector X coordinate
     * @param {number} y - Sector Y coordinate
     * @param {number} z - Sector Z coordinate
     * @returns {Promise<boolean>} True if the observer has seen the sector
     * @throws {ErrorFactory} If the query fails
     */
    public async hasVisibility(observerId: number, x: number, y: number, z: number): Promise<boolean> {
        return this.recordExists({ id: observerId, x, y, z });
    }

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    /**
     * Create a new visibility record (mark sector as observed)
     * @param {Partial<Record<string, any>>} data - Visibility data to insert
     * @param {CreateOptions} [options={}] - Creation options
     * @returns {Promise<VisibilityModel>} The created visibility record
     * @throws {ValidationError} If required fields are missing
     * @throws {ErrorFactory} If the query fails
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: CreateOptions = {}
    ): Promise<VisibilityModel> {
        if (data.ID === undefined) {
            throw new ValidationError('ID', data.ID, 'Observer ID is required');
        }
        if (data.X === undefined || data.Y === undefined || data.Z === undefined) {
            throw new ValidationError('X/Y/Z', data, 'Sector coordinates (X, Y, Z) are required');
        }

        // Default timestamp to now if not provided
        if (data.TIMESTAMP === undefined) {
            data = { ...data, TIMESTAMP: Date.now() };
        }

        this.logger.info('Creating visibility record', {
            operation: 'create',
            observerId: data.ID,
            sector: `${data.X},${data.Y},${data.Z}`
        });

        return super.create(data, options);
    }

    /**
     * Update a visibility record by composite primary key
     * @param {VisibilityKey} key - The composite primary key
     * @param {Partial<Record<string, any>>} data - Updated visibility data
     * @param {VisibilityUpdateOptions} [options={}] - Update options
     * @returns {Promise<VisibilityModel>} The updated visibility record
     * @throws {ErrorFactory} If the query fails
     */
    public async update(
        key: VisibilityKey,
        data: Partial<Record<string, any>>,
        options: VisibilityUpdateOptions = {}
    ): Promise<VisibilityModel> {
        const compositeId = { ID: key.id, X: key.x, Y: key.y, Z: key.z };
        this.logger.info('Updating visibility record', { operation: 'update', key });
        return super.update(compositeId, data, options);
    }

    /**
     * Delete a visibility record by composite primary key
     * @param {VisibilityKey} key - The composite primary key
     * @param {DeleteOptions} [options={}] - Deletion options
     * @returns {Promise<boolean>} True if deleted, false if not found
     * @throws {ErrorFactory} If the query fails
     */
    public async delete(key: VisibilityKey, options: DeleteOptions = {}): Promise<boolean> {
        const compositeId = { ID: key.id, X: key.x, Y: key.y, Z: key.z };
        this.logger.info('Deleting visibility record', { operation: 'delete', key });
        return super.delete(compositeId, options);
    }

    /**
     * Mark a sector as observed by an observer (upsert)
     * @param {number} observerId - The observer ID
     * @param {number} x - Sector X coordinate
     * @param {number} y - Sector Y coordinate
     * @param {number} z - Sector Z coordinate
     * @param {number} [timestamp] - Observation timestamp (defaults to now)
     * @returns {Promise<VisibilityModel>} The created or existing visibility record
     * @throws {ErrorFactory} If the query fails
     */
    public async markAsObserved(
        observerId: number,
        x: number,
        y: number,
        z: number,
        timestamp?: number
    ): Promise<VisibilityModel> {
        this.ensureInitialized();

        const existing = await this.findOne({ id: observerId, x, y, z });
        if (existing) {
            // Update the timestamp to reflect the latest observation
            return this.update({ id: observerId, x, y, z }, {
                TIMESTAMP: timestamp ?? Date.now()
            });
        }

        return this.create({
            ID: observerId,
            X: x,
            Y: y,
            Z: z,
            TIMESTAMP: timestamp ?? Date.now()
        });
    }

    /**
     * Remove all visibility records for a specific observer
     * @param {number} observerId - The observer ID to clear
     * @returns {Promise<number>} Number of records removed
     * @throws {ErrorFactory} If the query fails
     */
    public async clearObserver(observerId: number): Promise<number> {
        this.ensureInitialized();

        const sql = 'DELETE FROM VISIBILITY WHERE ID = ?';
        try {
            const affected = await this.executeUpdate(sql, [observerId]);
            if (this.cacheManager) await this.clearCachesForTable('VISIBILITY');

            this.logger.info('Observer visibility cleared', { operation: 'clear-observer', observerId });
            return affected;
        } catch (error) {
            this.logger.error('Failed to clear observer visibility', { operation: 'clear-observer', observerId });
            throw ErrorFactory.createQueryError(sql, error, [observerId]);
        }
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Create multiple visibility records
     * @param {Array<Partial<Record<string, any>>>} records - Array of visibility data
     * @param {BulkVisibilityOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkCreate(
        records: Array<Partial<Record<string, any>>>,
        options: BulkVisibilityOptions = {}
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
     * Delete multiple visibility records by composite key
     * @param {VisibilityKey[]} keys - Array of composite primary keys
     * @param {BulkVisibilityOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     */
    public async bulkDelete(keys: VisibilityKey[], options: BulkVisibilityOptions = {}): Promise<BulkOperationResult> {
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
     * Get comprehensive visibility statistics
     * @returns {Promise<VisibilityStatistics>} Visibility statistics object
     * @throws {ErrorFactory} If the query fails
     */
    public async getStatistics(): Promise<VisibilityStatistics> {
        this.ensureInitialized();

        try {
            const [
                totalResult, observerResult, sectorResult,
                npcResult, topExplorerResult, topSectorResult
            ] = await Promise.all([
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM VISIBILITY', []),
                this.executeQuery('SELECT COUNT(DISTINCT ID) AS "cnt" FROM VISIBILITY', []),
                this.executeQuery('SELECT COUNT(DISTINCT X || \',\' || Y || \',\' || Z) AS "cnt" FROM VISIBILITY', []),
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM VISIBILITY WHERE ID < 0', []),
                this.executeQuery('SELECT ID, COUNT(*) AS "cnt" FROM VISIBILITY GROUP BY ID ORDER BY "cnt" DESC LIMIT 10', []),
                this.executeQuery('SELECT X, Y, Z, COUNT(*) AS "cnt" FROM VISIBILITY GROUP BY X, Y, Z ORDER BY "cnt" DESC LIMIT 10', [])
            ]);

            const total = Number(totalResult[0]?.cnt ?? 0);
            const npc = Number(npcResult[0]?.cnt ?? 0);

            const topExplorers = topExplorerResult.map((r: any) => ({
                observerId: Number(r.ID),
                sectorCount: Number(r.cnt)
            }));

            const mostObservedSectors = topSectorResult.map((r: any) => ({
                x: Number(r.X),
                y: Number(r.Y),
                z: Number(r.Z),
                observerCount: Number(r.cnt)
            }));

            return {
                totalObservations: total,
                distinctObservers: Number(observerResult[0]?.cnt ?? 0),
                distinctSectors: Number(sectorResult[0]?.cnt ?? 0),
                npcObservations: npc,
                playerObservations: total - npc,
                topExplorers,
                mostObservedSectors
            };
        } catch (error) {
            this.logger.error('Failed to compute visibility statistics', {
                operation: 'get-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Count the number of distinct sectors observed by an observer
     * @param {number} observerId - The observer ID
     * @returns {Promise<number>} Number of sectors observed
     * @throws {ErrorFactory} If the query fails
     */
    public async countByObserver(observerId: number): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) AS "cnt" FROM VISIBILITY WHERE ID = ?';
        try {
            const result = await this.executeQuery(sql, [observerId]);
            return Number(result[0]?.cnt ?? 0);
        } catch (error) {
            this.logger.error('Failed to count observer visibility', { operation: 'count-by-observer', observerId });
            throw ErrorFactory.createQueryError(sql, error, [observerId]);
        }
    }

    /**
     * Count the number of distinct observers for a specific sector
     * @param {number} x - Sector X coordinate
     * @param {number} y - Sector Y coordinate
     * @param {number} z - Sector Z coordinate
     * @returns {Promise<number>} Number of observers who have seen the sector
     * @throws {ErrorFactory} If the query fails
     */
    public async countBySector(x: number, y: number, z: number): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) AS "cnt" FROM VISIBILITY WHERE X = ? AND Y = ? AND Z = ?';
        try {
            const result = await this.executeQuery(sql, [x, y, z]);
            return Number(result[0]?.cnt ?? 0);
        } catch (error) {
            this.logger.error('Failed to count sector observers', { operation: 'count-by-sector', x, y, z });
            throw ErrorFactory.createQueryError(sql, error, [x, y, z]);
        }
    }
}
