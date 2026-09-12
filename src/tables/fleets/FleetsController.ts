/**
 * @fileoverview Fleets Controller
 *
 * Controller for managing fleets in the FLEETS table with advanced operations,
 * mission management, hierarchy analysis, and comprehensive fleet analytics.
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
    FleetsModel,
    FleetCommand,
    FactionAccess,
    CombatSetting,
    MissionString,
    FleetType,
    FleetMissionCategory,
    NPCFleetPrefix
} from './FleetsModel.js';
import {
    ValidationError,
    QueryExecutionError,
    ErrorFactory,
    ConflictError
} from '../../core/errors.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Fleet search options with mission, ownership, and hierarchy filtering
 */
export interface FleetSearchOptions extends QueryOptions {
    /** Filter by owner player UID */
    owner?: string;
    /** Filter by flagship entity ID */
    flagshipId?: number;
    /** Filter by parent fleet ID */
    parentFleet?: number;
    /** Include only top-level fleets (no parent) */
    topLevelOnly?: boolean;
    /** Filter by mission string */
    missionString?: string;
    /** Filter by mission category */
    missionCategory?: FleetMissionCategory;
    /** Filter by faction access level */
    factionAccess?: FactionAccess;
    /** Filter by combat setting */
    combatSetting?: CombatSetting;
    /** Include only NPC fleets */
    npcOnly?: boolean;
    /** Include only player-owned fleets */
    playerOwnedOnly?: boolean;
    /** Filter by fleet type (from name pattern) */
    fleetType?: FleetType;
    /** Search term for fleet name */
    searchTerm?: string;
    /** Filter by idle status */
    idleOnly?: boolean;
    /** Filter by combat status */
    inCombatOnly?: boolean;
}

/**
 * Fleet creation options
 */
export interface FleetCreateOptions extends CreateOptions {
    /** Validate flagship entity existence */
    validateFlagship?: boolean;
    /** Validate parent fleet existence */
    validateParent?: boolean;
    /** Prevent circular hierarchy */
    preventCircularHierarchy?: boolean;
}

/**
 * Fleet update options
 */
export interface FleetUpdateOptions extends UpdateOptions {
    /** Allow mission state changes */
    allowMissionChange?: boolean;
    /** Validate combat setting value */
    validateCombatSetting?: boolean;
    /** Validate faction access level */
    validateFactionAccess?: boolean;
}

/**
 * Fleet hierarchy analysis options
 */
export interface FleetHierarchyOptions {
    /** Maximum depth to traverse */
    maxDepth?: number;
    /** Include member counts */
    includeMemberCounts?: boolean;
    /** Include mission summaries */
    includeMissionSummaries?: boolean;
}

/**
 * Fleet analytics options
 */
export interface FleetAnalyticsOptions {
    /** Include mission distribution */
    includeMissionDistribution?: boolean;
    /** Include ownership breakdown */
    includeOwnershipBreakdown?: boolean;
    /** Include combat readiness assessment */
    includeCombatReadiness?: boolean;
    /** Include hierarchy analysis */
    includeHierarchyAnalysis?: boolean;
}

/**
 * Bulk fleet operation options
 */
export interface BulkFleetOptions {
    /** Skip validation for performance */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log individual operations */
    logOperations?: boolean;
    /** Batch size for processing */
    batchSize?: number;
}

/**
 * Fleet statistics result
 */
export interface FleetStatistics {
    /** Total number of fleets */
    totalFleets: number;
    /** Number of top-level fleets */
    topLevelFleets: number;
    /** Number of sub-fleets */
    subFleets: number;
    /** Number of NPC fleets */
    npcFleets: number;
    /** Number of player-owned fleets */
    playerOwnedFleets: number;
    /** Mission distribution */
    missionDistribution: Record<string, number>;
    /** Combat setting distribution */
    combatDistribution: Record<string, number>;
    /** Access level distribution */
    accessDistribution: Record<string, number>;
    /** Top fleet owners */
    topOwners: Array<{ owner: string; fleetCount: number }>;
}

/**
 * Fleet hierarchy node
 */
export interface FleetHierarchyNode {
    /** Fleet ID */
    id: number;
    /** Fleet name */
    name: string | undefined;
    /** Fleet owner */
    owner: string | undefined;
    /** Current mission */
    mission: string;
    /** Mission category */
    missionCategory: FleetMissionCategory;
    /** Whether fleet is NPC-owned */
    isNPC: boolean;
    /** Child fleets */
    children: FleetHierarchyNode[];
    /** Hierarchy depth */
    depth: number;
}

// =============================================================================
// FLEETS CONTROLLER
// =============================================================================

/**
 * Controller for FLEETS table with advanced fleet management capabilities
 */
export class FleetsController extends BaseController<FleetsModel> {
    /** Model constructor used to map database rows and obtain the table schema. */
    protected ModelClass: ModelConstructor<FleetsModel> = FleetsModel;
    /** Controller name attached to logging and diagnostics. */
    protected controllerName = 'FleetsController';

    /**
     * Create a new fleets controller
     * @param {BaseControllerConfig} [config={}] - Controller configuration options
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 300000, // 5 minutes
            enableForeignKeyValidation: true,
            ...config
        });
    }

    // =============================================================================
    // EXISTENCE CHECK METHODS
    // =============================================================================

    /**
     * Check if a fleet exists by ID
     * @param {number} fleetId - The fleet ID to check
     * @returns {Promise<boolean>} True if the fleet exists
     * @throws {QueryExecutionError} If the query fails
     */
    public async fleetExistsById(fleetId: number): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM FLEETS WHERE ID = ?';
        try {
            const result = await this.executeQuery(sql, [fleetId]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check fleet existence by ID', {
                operation: 'fleet-exists-by-id',
                fleetId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, [fleetId]);
        }
    }

    /**
     * Check if a fleet exists by flagship ID
     * @param {number} flagshipId - The flagship entity ID
     * @returns {Promise<boolean>} True if any fleet uses this flagship
     * @throws {QueryExecutionError} If the query fails
     */
    public async fleetExistsByFlagship(flagshipId: number): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM FLEETS WHERE FLAGSHIP_ID = ?';
        try {
            const result = await this.executeQuery(sql, [flagshipId]);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check fleet existence by flagship', {
                operation: 'fleet-exists-by-flagship',
                flagshipId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, [flagshipId]);
        }
    }

    // =============================================================================
    // SEARCH METHODS
    // =============================================================================

    /**
     * Find all fleets with filtering and pagination support
     * @param {FleetSearchOptions} [options={}] - Search and pagination options
     * @returns {Promise<FleetsModel[]>} Array of matching fleet records
     * @throws {QueryExecutionError} If the query fails
     */
    public async findAll(options: FleetSearchOptions = {}): Promise<FleetsModel[]> {
        this.validateQueryOptions(options);
        this.ensureInitialized();

        const {
            owner,
            flagshipId,
            parentFleet,
            topLevelOnly,
            missionString,
            missionCategory,
            factionAccess,
            combatSetting,
            npcOnly,
            playerOwnedOnly,
            fleetType,
            searchTerm,
            idleOnly,
            inCombatOnly,
            limit = this.config.maxResults,
            offset = 0,
            orderBy = 'ID',
            orderDirection = 'ASC',
            skipCache = false,
            cacheTtl = this.config.cacheTtlMs
        } = options;

        const cacheKey = `FLEETS:find-all:${JSON.stringify(options)}`;

        if (!skipCache && this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) {
                return FleetsModel.fromRows(cached);
            }
        }

        const conditions: string[] = [];
        const params: any[] = [];

        if (owner !== undefined) {
            conditions.push('OWNER = ?');
            params.push(owner);
        }
        if (flagshipId !== undefined) {
            conditions.push('FLAGSHIP_ID = ?');
            params.push(flagshipId);
        }
        if (parentFleet !== undefined) {
            conditions.push('PARENT_FLEET = ?');
            params.push(parentFleet);
        }
        if (topLevelOnly) {
            conditions.push('(PARENT_FLEET IS NULL OR PARENT_FLEET = -1)');
        }
        if (missionString !== undefined) {
            conditions.push('MISSION_STRING = ?');
            params.push(missionString);
        }
        if (combatSetting !== undefined) {
            conditions.push('COMBAT_SETTING = ?');
            params.push(combatSetting);
        }
        if (factionAccess !== undefined) {
            conditions.push('FACTION_ACCESS = ?');
            params.push(factionAccess);
        }
        if (npcOnly) {
            conditions.push("(OWNER LIKE 'GNPC#%' OR OWNER LIKE 'NPC#%')");
        }
        if (playerOwnedOnly) {
            conditions.push("(OWNER NOT LIKE 'GNPC#%' AND OWNER NOT LIKE 'NPC#%' AND OWNER IS NOT NULL)");
        }
        if (fleetType !== undefined) {
            conditions.push("NAME LIKE ?");
            params.push(`%#${fleetType}#%`);
        }
        if (searchTerm !== undefined) {
            conditions.push('LOWER(NAME) LIKE ?');
            params.push(`%${searchTerm.toLowerCase()}%`);
        }
        if (idleOnly) {
            conditions.push("(MISSION_STRING IS NULL OR UPPER(MISSION_STRING) = 'IDLE')");
        }
        if (inCombatOnly) {
            conditions.push("UPPER(MISSION_STRING) IN ('ATTACKING', 'DEFENDING', 'STANDOFF', 'ESCORTING', 'SENTRY', 'SENTRY - FORMATION')");
        }

        let sql = 'SELECT * FROM FLEETS';
        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        sql += ` ORDER BY ${orderBy} ${orderDirection}`;
        if (limit > 0) {
            sql += ' LIMIT ?';
            params.push(limit);
        }
        if (offset > 0) {
            sql += ' OFFSET ?';
            params.push(offset);
        }

        try {
            const rows = await this.executeQuery(sql, params);
            const records = FleetsModel.fromRows(rows);

            if (!skipCache && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, rows, { ttl: cacheTtl });
            }

            this.logger.debug('Fleets retrieved', { operation: 'find-all', count: records.length, options });
            return records;
        } catch (error) {
            this.logger.error('Failed to find fleets', {
                operation: 'find-all',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a single fleet by ID
     * @param {number} id - The fleet ID
     * @returns {Promise<FleetsModel | null>} The fleet record or null if not found
     * @throws {QueryExecutionError} If the query fails
     */
    public async findOne(id: number): Promise<FleetsModel | null> {
        return this.findById(id);
    }

    /**
     * Find all fleets owned by a specific player
     * @param {string} owner - Player UID (StarMade name)
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<FleetsModel[]>} Array of fleet records owned by the player
     * @throws {QueryExecutionError} If the query fails
     */
    public async findByOwner(owner: string, options: QueryOptions = {}): Promise<FleetsModel[]> {
        if (!owner || owner.trim().length === 0) {
            throw new ValidationError('owner', owner, 'Owner cannot be empty');
        }
        return this.findAll({ ...options, owner });
    }

    /**
     * Find all fleets using a specific flagship entity
     * @param {number} flagshipId - The flagship entity ID
     * @returns {Promise<FleetsModel[]>} Array of fleet records using this flagship
     * @throws {QueryExecutionError} If the query fails
     */
    public async findByFlagship(flagshipId: number): Promise<FleetsModel[]> {
        return this.findAll({ flagshipId });
    }

    /**
     * Find all top-level fleets (no parent fleet)
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<FleetsModel[]>} Array of top-level fleet records
     * @throws {QueryExecutionError} If the query fails
     */
    public async findTopLevel(options: QueryOptions = {}): Promise<FleetsModel[]> {
        return this.findAll({ ...options, topLevelOnly: true });
    }

    /**
     * Find all child fleets of a given parent fleet
     * @param {number} parentId - The parent fleet ID
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<FleetsModel[]>} Array of child fleet records
     * @throws {QueryExecutionError} If the query fails
     */
    public async findChildren(parentId: number, options: QueryOptions = {}): Promise<FleetsModel[]> {
        return this.findAll({ ...options, parentFleet: parentId });
    }

    /**
     * Find all NPC-controlled fleets
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<FleetsModel[]>} Array of NPC fleet records
     * @throws {QueryExecutionError} If the query fails
     */
    public async findNPCFleets(options: QueryOptions = {}): Promise<FleetsModel[]> {
        return this.findAll({ ...options, npcOnly: true });
    }

    /**
     * Find all player-owned fleets
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<FleetsModel[]>} Array of player-owned fleet records
     * @throws {QueryExecutionError} If the query fails
     */
    public async findPlayerFleets(options: QueryOptions = {}): Promise<FleetsModel[]> {
        return this.findAll({ ...options, playerOwnedOnly: true });
    }

    /**
     * Find fleets currently in combat operations
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<FleetsModel[]>} Array of fleet records in combat
     * @throws {QueryExecutionError} If the query fails
     */
    public async findInCombat(options: QueryOptions = {}): Promise<FleetsModel[]> {
        return this.findAll({ ...options, inCombatOnly: true });
    }

    /**
     * Find idle fleets
     * @param {QueryOptions} [options={}] - Pagination options
     * @returns {Promise<FleetsModel[]>} Array of idle fleet records
     * @throws {QueryExecutionError} If the query fails
     */
    public async findIdle(options: QueryOptions = {}): Promise<FleetsModel[]> {
        return this.findAll({ ...options, idleOnly: true });
    }

    // =============================================================================
    // CRUD OPERATIONS
    // =============================================================================

    /**
     * Create a new fleet record
     * @param {Partial<Record<string, any>>} data - Fleet data to insert
     * @param {FleetCreateOptions} [options={}] - Creation options
     * @returns {Promise<FleetsModel>} The created fleet record
     * @throws {ValidationError} If the data fails validation
     * @throws {QueryExecutionError} If the query fails
     */
    public async create(data: Partial<Record<string, any>>, options: FleetCreateOptions = {}): Promise<FleetsModel> {
        const {
            validateFlagship = true,
            validateParent = true,
            preventCircularHierarchy = true,
            ...baseOptions
        } = options;

        if (!data.FLAGSHIP_ID) {
            throw new ValidationError('FLAGSHIP_ID', data.FLAGSHIP_ID, 'FLAGSHIP_ID is required');
        }

        // Validate parent fleet exists
        if (validateParent && data.PARENT_FLEET !== undefined &&
            data.PARENT_FLEET !== null && data.PARENT_FLEET !== -1) {
            const parentExists = await this.fleetExistsById(data.PARENT_FLEET as number);
            if (!parentExists) {
                throw new ValidationError('PARENT_FLEET', data.PARENT_FLEET,
                    `Parent fleet ${data.PARENT_FLEET} does not exist`);
            }
        }

        // Set default PARENT_FLEET to -1 (no parent)
        if (data.PARENT_FLEET === undefined) {
            data = { ...data, PARENT_FLEET: -1 };
        }

        this.logger.info('Creating fleet record', {
            operation: 'create',
            flagship: data.FLAGSHIP_ID,
            owner: data.OWNER
        });

        return super.create(data, baseOptions);
    }

    /**
     * Update an existing fleet record
     * @param {number} id - The fleet ID to update
     * @param {Partial<Record<string, any>>} data - Updated fleet data
     * @param {FleetUpdateOptions} [options={}] - Update options
     * @returns {Promise<FleetsModel>} The updated fleet record
     * @throws {ValidationError} If the data fails validation or fleet not found
     * @throws {QueryExecutionError} If the query fails
     */
    public async update(
        id: number,
        data: Partial<Record<string, any>>,
        options: FleetUpdateOptions = {}
    ): Promise<FleetsModel> {
        const {
            validateCombatSetting = true,
            validateFactionAccess = true,
            ...baseOptions
        } = options;

        if (validateCombatSetting && data.COMBAT_SETTING !== undefined) {
            const validSettings = Object.values(CombatSetting);
            if (data.COMBAT_SETTING !== null && !validSettings.includes(data.COMBAT_SETTING as CombatSetting)) {
                throw new ValidationError('COMBAT_SETTING', data.COMBAT_SETTING,
                    `Invalid combat setting. Must be one of: ${validSettings.join(', ')}`);
            }
        }

        if (validateFactionAccess && data.FACTION_ACCESS !== undefined && data.FACTION_ACCESS !== null) {
            const access = Number(data.FACTION_ACCESS);
            if (access < 0 || access > 5) {
                throw new ValidationError('FACTION_ACCESS', data.FACTION_ACCESS,
                    'FACTION_ACCESS must be between 0 and 5');
            }
        }

        this.logger.info('Updating fleet record', { operation: 'update', id, fields: Object.keys(data) });
        return super.update(id, data, baseOptions);
    }

    /**
     * Delete a fleet record
     * @param {number} id - The fleet ID to delete
     * @param {DeleteOptions} [options={}] - Deletion options
     * @returns {Promise<boolean>} True if the fleet was deleted, false if not found
     * @throws {QueryExecutionError} If the query fails
     */
    public async delete(id: number, options: DeleteOptions = {}): Promise<boolean> {
        this.ensureInitialized();

        const exists = await this.fleetExistsById(id);
        if (!exists) return false;

        this.logger.info('Deleting fleet record', { operation: 'delete', id });
        return super.delete(id, options);
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Create multiple fleet records in a single operation
     * @param {Array<Partial<Record<string, any>>>} records - Array of fleet data objects
     * @param {BulkFleetOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary with success/fail counts
     * @throws {QueryExecutionError} If a query fails and continueOnError is false
     */
    public async bulkCreate(
        records: Array<Partial<Record<string, any>>>,
        options: BulkFleetOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const { continueOnError = true, logOperations = false, batchSize = 100 } = options;
        const result: BulkOperationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

        for (let i = 0; i < records.length; i++) {
            try {
                await this.create(records[i], { skipValidation: options.skipValidation });
                result.success++;
                if (logOperations) {
                    this.logger.debug('Bulk create: record created', { operation: 'bulk-create', index: i });
                }
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
     * Update multiple fleet records
     * @param {Array<{id: number; data: Partial<Record<string, any>>}>} records - Array of update operations
     * @param {BulkFleetOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     * @throws {QueryExecutionError} If a query fails and continueOnError is false
     */
    public async bulkUpdate(
        records: Array<{ id: number; data: Partial<Record<string, any>> }>,
        options: BulkFleetOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const { continueOnError = true, logOperations = false } = options;
        const result: BulkOperationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

        for (let i = 0; i < records.length; i++) {
            const { id, data } = records[i];
            try {
                const exists = await this.fleetExistsById(id);
                if (!exists) {
                    result.skipped++;
                    continue;
                }
                await this.update(id, data, { skipValidation: options.skipValidation });
                result.success++;
            } catch (error) {
                result.failed++;
                result.errors.push({ index: i, error: error instanceof Error ? error.message : String(error), data: records[i] });
                if (!continueOnError) throw error;
            }
        }

        this.logger.info('Bulk update completed', { operation: 'bulk-update', ...result });
        return result;
    }

    /**
     * Delete multiple fleet records by ID
     * @param {number[]} ids - Array of fleet IDs to delete
     * @param {BulkFleetOptions} [options={}] - Bulk operation options
     * @returns {Promise<BulkOperationResult>} Result summary
     * @throws {QueryExecutionError} If a query fails and continueOnError is false
     */
    public async bulkDelete(ids: number[], options: BulkFleetOptions = {}): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const { continueOnError = true } = options;
        const result: BulkOperationResult = { success: 0, failed: 0, skipped: 0, errors: [] };

        for (let i = 0; i < ids.length; i++) {
            try {
                const deleted = await this.delete(ids[i]);
                if (deleted) {
                    result.success++;
                } else {
                    result.skipped++;
                }
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
    // HIERARCHY ANALYSIS
    // =============================================================================

    /**
     * Build the complete fleet hierarchy tree starting from top-level fleets
     * @param {FleetHierarchyOptions} [options={}] - Hierarchy traversal options
     * @returns {Promise<FleetHierarchyNode[]>} Array of root hierarchy nodes with nested children
     * @throws {QueryExecutionError} If the query fails
     */
    public async getFleetHierarchy(options: FleetHierarchyOptions = {}): Promise<FleetHierarchyNode[]> {
        this.ensureInitialized();

        const { maxDepth = 5 } = options;

        const allFleets = await this.findAll({ limit: 10000, skipCache: true });
        const fleetMap = new Map<number, FleetsModel>();
        allFleets.forEach(f => fleetMap.set(f.getId(), f));

        const buildNode = (fleet: FleetsModel, depth: number): FleetHierarchyNode => {
            const children: FleetHierarchyNode[] = [];

            if (depth < maxDepth) {
                allFleets
                    .filter(f => f.getParentFleet() === fleet.getId())
                    .forEach(child => children.push(buildNode(child, depth + 1)));
            }

            return {
                id: fleet.getId(),
                name: fleet.getName(),
                owner: fleet.getOwner(),
                mission: fleet.getCurrentMission(),
                missionCategory: fleet.getMissionCategory(),
                isNPC: fleet.isNPCFleet(),
                children,
                depth
            };
        };

        const topLevel = allFleets.filter(f => f.isTopLevel());
        return topLevel.map(f => buildNode(f, 0));
    }

    /**
     * Count the number of direct child fleets for a given fleet
     * @param {number} fleetId - The parent fleet ID
     * @returns {Promise<number>} Number of direct children
     * @throws {QueryExecutionError} If the query fails
     */
    public async countChildren(fleetId: number): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) FROM FLEETS WHERE PARENT_FLEET = ?';
        try {
            const result = await this.executeQuery(sql, [fleetId]);
            return Number(Object.values(result[0] ?? {'0': 0})[0] ?? 0);
        } catch (error) {
            this.logger.error('Failed to count children', { operation: 'count-children', fleetId });
            throw ErrorFactory.createQueryError(sql, error, [fleetId]);
        }
    }

    // =============================================================================
    // ANALYTICS AND STATISTICS
    // =============================================================================

    /**
     * Get comprehensive fleet statistics across all records
     * @param {FleetAnalyticsOptions} [options={}] - Analytics options
     * @returns {Promise<FleetStatistics>} Fleet statistics object
     * @throws {QueryExecutionError} If the query fails
     */
    public async getStatistics(options: FleetAnalyticsOptions = {}): Promise<FleetStatistics> {
        this.ensureInitialized();

        try {
            const [
                totalResult,
                topLevelResult,
                npcResult,
                missionResult,
                combatResult,
                accessResult,
                ownerResult
            ] = await Promise.all([
                this.executeQuery('SELECT COUNT(*) AS "cnt" FROM FLEETS', []),
                this.executeQuery("SELECT COUNT(*) AS \"cnt\" FROM FLEETS WHERE PARENT_FLEET IS NULL OR PARENT_FLEET = -1", []),
                this.executeQuery("SELECT COUNT(*) AS \"cnt\" FROM FLEETS WHERE OWNER LIKE 'GNPC#%' OR OWNER LIKE 'NPC#%'", []),
                this.executeQuery('SELECT MISSION_STRING, COUNT(*) AS "cnt" FROM FLEETS GROUP BY MISSION_STRING', []),
                this.executeQuery('SELECT COMBAT_SETTING, COUNT(*) AS "cnt" FROM FLEETS GROUP BY COMBAT_SETTING', []),
                this.executeQuery('SELECT FACTION_ACCESS, COUNT(*) AS "cnt" FROM FLEETS GROUP BY FACTION_ACCESS', []),
                this.executeQuery('SELECT OWNER, COUNT(*) AS "cnt" FROM FLEETS WHERE OWNER IS NOT NULL GROUP BY OWNER ORDER BY "cnt" DESC LIMIT 10', [])
            ]);

            const total = Number(totalResult[0]?.cnt ?? 0);
            const topLevel = Number(topLevelResult[0]?.cnt ?? 0);
            const npc = Number(npcResult[0]?.cnt ?? 0);

            const missionDistribution: Record<string, number> = {};
            missionResult.forEach((r: any) => {
                missionDistribution[r.MISSION_STRING ?? 'UNKNOWN'] = Number(r.cnt);
            });

            const combatDistribution: Record<string, number> = {};
            combatResult.forEach((r: any) => {
                combatDistribution[r.COMBAT_SETTING ?? 'UNKNOWN'] = Number(r.cnt);
            });

            const accessDistribution: Record<string, number> = {};
            accessResult.forEach((r: any) => {
                const key = FactionAccess[r.FACTION_ACCESS as number] ?? String(r.FACTION_ACCESS ?? 'UNKNOWN');
                accessDistribution[key] = Number(r.cnt);
            });

            const topOwners = ownerResult.map((r: any) => ({
                owner: String(r.OWNER),
                fleetCount: Number(r.cnt)
            }));

            const stats: FleetStatistics = {
                totalFleets: total,
                topLevelFleets: topLevel,
                subFleets: total - topLevel,
                npcFleets: npc,
                playerOwnedFleets: total - npc,
                missionDistribution,
                combatDistribution,
                accessDistribution,
                topOwners
            };

            this.logger.debug('Fleet statistics computed', { operation: 'get-statistics', stats });
            return stats;
        } catch (error) {
            this.logger.error('Failed to compute fleet statistics', {
                operation: 'get-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Count total fleets matching optional filter options
     * @param {FleetSearchOptions} [options={}] - Filter options
     * @returns {Promise<number>} Number of matching fleet records
     * @throws {QueryExecutionError} If the query fails
     */
    public async count(options: FleetSearchOptions = {}): Promise<number> {
        this.ensureInitialized();

        const records = await this.findAll({ ...options, limit: 0 });
        return records.length;
    }

    /**
     * Update the mission string of a fleet
     * @param {number} fleetId - The fleet ID
     * @param {string} missionString - New mission string
     * @returns {Promise<FleetsModel>} The updated fleet record
     * @throws {ValidationError} If the fleet does not exist
     * @throws {QueryExecutionError} If the query fails
     */
    public async updateMission(fleetId: number, missionString: string): Promise<FleetsModel> {
        this.ensureInitialized();

        if (!await this.fleetExistsById(fleetId)) {
            throw new ValidationError('fleetId', fleetId, `Fleet ${fleetId} does not exist`);
        }

        return this.update(fleetId, { MISSION_STRING: missionString });
    }

    /**
     * Update the combat setting of a fleet
     * @param {number} fleetId - The fleet ID
     * @param {CombatSetting} combatSetting - New combat setting
     * @returns {Promise<FleetsModel>} The updated fleet record
     * @throws {ValidationError} If the fleet does not exist or setting is invalid
     * @throws {QueryExecutionError} If the query fails
     */
    public async updateCombatSetting(fleetId: number, combatSetting: CombatSetting): Promise<FleetsModel> {
        this.ensureInitialized();

        if (!await this.fleetExistsById(fleetId)) {
            throw new ValidationError('fleetId', fleetId, `Fleet ${fleetId} does not exist`);
        }

        return this.update(fleetId, { COMBAT_SETTING: combatSetting });
    }
}
