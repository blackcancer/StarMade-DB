/**
 * @fileoverview Fleet Members Controller
 *
 * Controller for managing fleet member associations in the FLEET_MEMBERS table.
 * Provides fleet composition management, member analytics, and mission coordination.
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
    FleetMembersModel,
    MemberMissionState,
    MissionCategory,
    MemberPriority,
    DockingStatus
} from './FleetMembersModel.js';
import {
    ValidationError,
    ErrorFactory
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Search options for fleet member records
 */
export interface FleetMemberSearchOptions extends QueryOptions {
    /** Filter by fleet ID */
    fleetId?: number;
    /** Filter by entity ID (member ship) */
    entityId?: number;
    /** Filter by mission state */
    missionState?: MemberMissionState;
    /** Filter by mission category */
    missionCategory?: MissionCategory;
    /** Filter by docking status */
    dockingStatus?: DockingStatus;
    /** Include only flagship entries */
    flagshipOnly?: boolean;
    /** Search term for mission string */
    searchTerm?: string;
}

/**
 * Fleet member creation options
 */
export interface FleetMemberCreateOptions extends CreateOptions {
    /** Validate that the fleet exists */
    validateFleet?: boolean;
    /** Validate that the entity exists */
    validateEntity?: boolean;
    /** Prevent duplicate membership */
    preventDuplicates?: boolean;
}

/**
 * Fleet member update options
 */
export interface FleetMemberUpdateOptions extends UpdateOptions {
    /** Allow mission state changes */
    allowMissionChange?: boolean;
}

/**
 * Bulk fleet member operation options
 */
export interface BulkFleetMemberOptions {
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
 * Fleet member statistics
 */
export interface FleetMemberStatistics {
    /** Total number of fleet memberships */
    totalMembers: number;
    /** Number of distinct fleets with members */
    distinctFleets: number;
    /** Number of distinct entities assigned to fleets */
    distinctEntities: number;
    /** Mission state distribution */
    missionDistribution: Record<string, number>;
    /** Average members per fleet */
    averageMembersPerFleet: number;
    /** Largest fleet (most members) */
    largestFleet: { fleetId: number; memberCount: number } | null;
}

// =============================================================================
// FLEET MEMBERS CONTROLLER
// =============================================================================

/**
 * Controller for FLEET_MEMBERS table with fleet composition management capabilities
 */
export class FleetMembersController extends BaseController<FleetMembersModel> {
    protected ModelClass: ModelConstructor<FleetMembersModel> = FleetMembersModel;
    protected controllerName = 'FleetMembersController';

    /**
     * Create a new FleetMembersController instance
     * @param {BaseControllerConfig} [config={}] - Controller configuration options
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 300000,
            enableForeignKeyValidation: true,
            ...config
        });
    }

    // =============================================================================
    // EXISTENCE CHECKS
    // =============================================================================

    /**
     * Check if a fleet member record exists by composite primary key
     * @param {number} fleetId - The fleet ID
     * @param {number} entityId - The entity (member ship) ID
     * @returns {Promise<boolean>} True if the membership exists
     * @throws {ErrorFactory} If the query fails
     */
    public async membershipExists(fleetId: number, entityId: number): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM FLEET_MEMBERS WHERE FLEET_ID = ? AND ENTITY_ID = ?';
        try {
            const result = await this.executeQuery(sql, [fleetId, entityId]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check fleet membership existence', {
                operation: 'membership-exists', fleetId, entityId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    /**
     * Find all fleet member records with filtering and pagination
     * @param {FleetMemberSearchOptions} [options={}] - Search and pagination options
     * @returns {Promise<FleetMembersModel[]>} Array of matching fleet member records
     * @throws {ErrorFactory} If the query fails
     */
    public async findAll(options: FleetMemberSearchOptions = {}): Promise<FleetMembersModel[]> {
        this.ensureInitialized();

        const {
            fleetId,
            entityId,
            missionState,
            dockingStatus,
            flagshipOnly,
            searchTerm,
            limit = this.config.maxResults,
            offset = 0,
            orderBy = 'FLEET_ID',
            orderDirection = 'ASC',
            skipCache = false,
            cacheTtl = this.config.cacheTtlMs
        } = options;

        const cacheKey = `FLEET_MEMBERS:find-all:${JSON.stringify(options)}`;

        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) return FleetMembersModel.fromRows(cached);
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (fleetId !== undefined) { conditions.push('FLEET_ID = ?'); params.push(fleetId); }
        if (entityId !== undefined) { conditions.push('ENTITY_ID = ?'); params.push(entityId); }
        if (missionState !== undefined) { conditions.push('MISSION_STRING = ?'); params.push(missionState); }
        if (dockingStatus !== undefined) { conditions.push('DOCKING_STATUS = ?'); params.push(dockingStatus); }
        if (flagshipOnly) { conditions.push('IS_FLAGSHIP = TRUE'); }
        if (searchTerm !== undefined) {
            conditions.push('LOWER(MISSION_STRING) LIKE ?');
            params.push(`%${searchTerm.toLowerCase()}%`);
        }

        let sql = 'SELECT * FROM FLEET_MEMBERS';
        if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        if (limit > 0) { sql += ' LIMIT ?'; params.push(limit); }
        if (offset > 0) { sql += ' OFFSET ?'; params.push(offset); }

        try {
            const rows = await this.executeQuery(sql, params);
            const records = FleetMembersModel.fromRows(rows);

            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, rows, { ttl: cacheTtl });
            }

            this.logger.debug('Fleet members retrieved', { operation: 'find-all', count: records.length });
            return records;
        } catch (error) {
            this.logger.error('Failed to find fleet members', {
                operation: 'find-all',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find all member records for a specific fleet
     * @param {number} fleetId - The fleet ID
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<FleetMembersModel[]>} Array of fleet member records
     * @throws {ErrorFactory} If the query fails
     */
    public async findByFleet(fleetId: number, options: QueryOptions = {}): Promise<FleetMembersModel[]> {
        return this.findAll({ ...options, fleetId });
    }

    /**
     * Find all fleet memberships for a specific entity
     * @param {number} entityId - The entity ID
     * @returns {Promise<FleetMembersModel[]>} Array of fleet membership records for the entity
     * @throws {ErrorFactory} If the query fails
     */
    public async findByEntity(entityId: number): Promise<FleetMembersModel[]> {
        return this.findAll({ entityId });
    }

    /**
     * Find a member record by composite primary key
     * @param {number} fleetId - The fleet ID
     * @param {number} entityId - The entity ID
     * @returns {Promise<FleetMembersModel | null>} The fleet member record or null
     * @throws {ErrorFactory} If the query fails
     */
    public async findOne(fleetId: number, entityId: number): Promise<FleetMembersModel | null> {
        return this.findById({ FLEET_ID: fleetId, ENTITY_ID: entityId });
    }

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    /**
     * Create a new fleet member record
     * @param {Partial<Record<string, any>>} data - Fleet member data
     * @param {FleetMemberCreateOptions} [options={}] - Creation options
     * @returns {Promise<FleetMembersModel>} The created fleet member record
     * @throws {ValidationError} If data validation fails or duplicate membership detected
     * @throws {ErrorFactory} If the query fails
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: FleetMemberCreateOptions = {}
    ): Promise<FleetMembersModel> {
        const { preventDuplicates = true, ...baseOptions } = options;

        if (data.FLEET_ID === undefined) {
            throw new ValidationError('FLEET_ID', data.FLEET_ID, 'FLEET_ID is required');
        }
        if (data.ENTITY_ID === undefined) {
            throw new ValidationError('ENTITY_ID', data.ENTITY_ID, 'ENTITY_ID is required');
        }

        if (preventDuplicates) {
            const exists = await this.membershipExists(data.FLEET_ID as number, data.ENTITY_ID as number);
            if (exists) {
                throw new ValidationError('FLEET_ID/ENTITY_ID', data,
                    `Entity ${data.ENTITY_ID} is already a member of fleet ${data.FLEET_ID}`);
            }
        }

        this.logger.info('Creating fleet member record', {
            operation: 'create', fleetId: data.FLEET_ID, entityId: data.ENTITY_ID
        });

        return super.create(data, baseOptions);
    }

    /**
     * Update a fleet member record by composite primary key
     * @param {{ fleetId: number; entityId: number }} id - Composite key
     * @param {Partial<Record<string, any>>} data - Updated data
     * @param {FleetMemberUpdateOptions} [options={}] - Update options
     * @returns {Promise<FleetMembersModel>} The updated fleet member record
     * @throws {ValidationError} If the record does not exist
     * @throws {ErrorFactory} If the query fails
     */
    public async update(
        id: { fleetId: number; entityId: number },
        data: Partial<Record<string, any>>,
        options: FleetMemberUpdateOptions = {}
    ): Promise<FleetMembersModel> {
        const compositeId = { FLEET_ID: id.fleetId, ENTITY_ID: id.entityId };
        this.logger.info('Updating fleet member record', { operation: 'update', id });
        return super.update(compositeId, data, options);
    }

    /**
     * Delete a fleet member record by composite primary key
     * @param {{ fleetId: number; entityId: number }} id - Composite key
     * @param {DeleteOptions} [options={}] - Deletion options
     * @returns {Promise<boolean>} True if deleted, false if not found
     * @throws {ErrorFactory} If the query fails
     */
    public async delete(
        id: { fleetId: number; entityId: number },
        options: DeleteOptions = {}
    ): Promise<boolean> {
        const compositeId = { FLEET_ID: id.fleetId, ENTITY_ID: id.entityId };
        this.logger.info('Deleting fleet member record', { operation: 'delete', id });
        try {
            return await super.delete(compositeId, options);
        } catch (error) {
            this.logger.error('Failed to delete fleet member', {
                operation: 'delete', id,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Remove all member records from a given fleet
     * @param {number} fleetId - The fleet ID to clear
     * @returns {Promise<number>} Number of members removed
     * @throws {ErrorFactory} If the query fails
     */
    public async removeAllFromFleet(fleetId: number): Promise<number> {
        this.ensureInitialized();

        const members = await this.findByFleet(fleetId);
        let count = 0;
        for (const member of members) {
            await this.delete({ fleetId, entityId: member.get('ENTITY_ID') as number });
            count++;
        }

        this.logger.info('All fleet members removed', { operation: 'remove-all-from-fleet', fleetId, count });
        return count;
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Create multiple fleet member records
     * @param {Array<Partial<Record<string, any>>>} records - Array of member data objects
     * @param {BulkFleetMemberOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     * @throws {ErrorFactory} If a query fails and continueOnError is false
     */
    public async bulkCreate(
        records: Array<Partial<Record<string, any>>>,
        options: BulkFleetMemberOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const { continueOnError = true, logOperations = false } = options;
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
     * Delete multiple fleet member records
     * @param {Array<{ fleetId: number; entityId: number }>} ids - Array of composite keys
     * @param {BulkFleetMemberOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     * @throws {ErrorFactory} If a query fails and continueOnError is false
     */
    public async bulkDelete(
        ids: Array<{ fleetId: number; entityId: number }>,
        options: BulkFleetMemberOptions = {}
    ): Promise<BulkOperationResult> {
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
     * Get comprehensive fleet member statistics
     * @returns {Promise<FleetMemberStatistics>} Fleet member statistics object
     * @throws {ErrorFactory} If the query fails
     */
    public async getStatistics(): Promise<FleetMemberStatistics> {
        this.ensureInitialized();

        try {
            const [totalResult, fleetResult, entityResult, missionResult, largestResult] = await Promise.all([
                this.executeQuery('SELECT COUNT(*) AS cnt FROM FLEET_MEMBERS', []),
                this.executeQuery('SELECT COUNT(DISTINCT FLEET_ID) AS cnt FROM FLEET_MEMBERS', []),
                this.executeQuery('SELECT COUNT(DISTINCT ENTITY_ID) AS cnt FROM FLEET_MEMBERS', []),
                this.executeQuery('SELECT MISSION_STRING, COUNT(*) AS cnt FROM FLEET_MEMBERS GROUP BY MISSION_STRING', []),
                this.executeQuery('SELECT FLEET_ID, COUNT(*) AS cnt FROM FLEET_MEMBERS GROUP BY FLEET_ID ORDER BY cnt DESC LIMIT 1', [])
            ]);

            const total = Number(totalResult[0]?.cnt ?? 0);
            const distinctFleets = Number(fleetResult[0]?.cnt ?? 0);
            const distinctEntities = Number(entityResult[0]?.cnt ?? 0);

            const missionDistribution: Record<string, number> = {};
            missionResult.forEach((r: any) => {
                missionDistribution[r.MISSION_STRING ?? 'UNKNOWN'] = Number(r.cnt);
            });

            const largestFleet = largestResult.length > 0
                ? { fleetId: Number(largestResult[0].FLEET_ID), memberCount: Number(largestResult[0].cnt) }
                : null;

            return {
                totalMembers: total,
                distinctFleets,
                distinctEntities,
                missionDistribution,
                averageMembersPerFleet: distinctFleets > 0 ? total / distinctFleets : 0,
                largestFleet
            };
        } catch (error) {
            this.logger.error('Failed to compute fleet member statistics', {
                operation: 'get-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Count members in a specific fleet
     * @param {number} fleetId - The fleet ID
     * @returns {Promise<number>} Number of members in the fleet
     * @throws {ErrorFactory} If the query fails
     */
    public async countByFleet(fleetId: number): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) AS cnt FROM FLEET_MEMBERS WHERE FLEET_ID = ?';
        try {
            const result = await this.executeQuery(sql, [fleetId]);
            return Number(result[0]?.cnt ?? 0);
        } catch (error) {
            this.logger.error('Failed to count fleet members', { operation: 'count-by-fleet', fleetId });
            throw ErrorFactory.createQueryError(sql, error, [fleetId]);
        }
    }
}
