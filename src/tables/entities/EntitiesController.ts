/**
 * @fileoverview Entities Controller
 * 
 * Controller for managing game entities (ships, stations, planets, etc.) with advanced
 * spatial operations, docking chain management, and comprehensive entity analytics.
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
    EntitiesModel,
    EntityType,
    KnownFactions
} from './EntitiesModel.js';
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
 * Entity search options with spatial and type filtering
 */
export interface EntitySearchOptions extends QueryOptions {
    /** Search by entity UID */
    uid?: string;
    /** Filter by entity type */
    entityType?: EntityType;
    /** Filter by entity types (multiple) */
    entityTypes?: EntityType[];
    /** Filter by faction ID */
    factionId?: number;
    /** Filter by sector coordinates */
    coordinates?: {
        x: number;
        y: number;
        z: number;
    };
    /** Search within radius of coordinates */
    withinRadius?: {
        center: { x: number; y: number; z: number };
        radius: number;
    };
    /** Filter by creator name */
    creator?: string;
    /** Filter by last modifier */
    lastModifier?: string;
    /** Filter dependents by their persisted parent entity ID (ENTITIES.DOCKED_TO). */
    dockedToId?: number;
    /** Include only docked entities */
    dockedOnly?: boolean;
    /** Include only undocked entities */
    undockedOnly?: boolean;
    /** Include only root entities (not docked to anything) */
    rootEntitiesOnly?: boolean;
    /** Include only touched/visited entities */
    touchedOnly?: boolean;
    /** Include only untouched entities */
    untouchedOnly?: boolean;
    /** Include only tracked entities */
    trackedOnly?: boolean;
    /** Include only spawned entities (not DB-only) */
    spawnedOnly?: boolean;
    /** Search term for name matching */
    searchTerm?: string;
    /** Load specific relationships */
    withRelations?: {
        sector?: boolean;
        dockedEntities?: boolean;
        dockedToEntity?: boolean;
        dockedRootEntity?: boolean;
        effects?: boolean;
        fleetMembership?: boolean;
        ftlConnections?: boolean;
    };
}

/**
 * Entity creation options
 */
export interface EntityCreateOptions extends CreateOptions {
    /** Auto-generate UID if not provided */
    autoGenerateUid?: boolean;
    /** Validate entity placement rules */
    validatePlacement?: boolean;
    /** Check for entity conflicts in sector */
    checkSectorConflicts?: boolean;
    /** Auto-assign to sector */
    autoAssignSector?: boolean;
    /** Link to existing docking chain */
    linkToDockingChain?: boolean;
}

/**
 * Entity update options
 */
export interface EntityUpdateOptions extends UpdateOptions {
    /** Allow updating immutable fields (UID, etc.) */
    allowImmutableUpdates?: boolean;
    /** Validate new position */
    validatePosition?: boolean;
    /** Update docking chain automatically */
    updateDockingChain?: boolean;
    /** Check for sector changes */
    checkSectorChange?: boolean;
    /** Preserve entity relationships */
    preserveRelationships?: boolean;
}

/**
 * Spatial analysis options
 */
export interface SpatialAnalysisOptions {
    /** Include density analysis */
    includeDensity?: boolean;
    /** Include type distribution */
    includeTypeDistribution?: boolean;
    /** Include faction presence */
    includeFactionPresence?: boolean;
    /** Include docking statistics */
    includeDockingStats?: boolean;
    /** Radius for analysis */
    analysisRadius?: number;
}

/**
 * Docking chain options
 */
export interface DockingChainOptions {
    /** Include chain depth analysis */
    includeChainDepth?: boolean;
    /** Include entity details */
    includeEntityDetails?: boolean;
    /** Maximum chain depth to traverse */
    maxDepth?: number;
    /** Include performance metrics */
    includePerformanceMetrics?: boolean;
}

/**
 * Entity analytics options
 */
export interface EntityAnalyticsOptions {
    /** Include spatial intelligence */
    includeSpatialIntelligence?: boolean;
    /** Include docking analysis */
    includeDockingAnalysis?: boolean;
    /** Include fleet involvement */
    includeFleetInvolvement?: boolean;
    /** Include FTL capabilities */
    includeFtlCapabilities?: boolean;
    /** Include effects analysis */
    includeEffectsAnalysis?: boolean;
    /** Include relationship status */
    includeRelationshipStatus?: boolean;
}

/**
 * Bulk entity operations options
 */
export interface BulkEntityOptions {
    /** Batch size for processing */
    batchSize?: number;
    /** Skip validation for performance */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log operations */
    logOperations?: boolean;
    /** Update docking chains */
    updateDockingChains?: boolean;
    /** Check sector assignments */
    checkSectorAssignments?: boolean;
}

/**
 * Entity statistics result
 */
export interface EntityStatistics {
    /** Total entities */
    totalEntities: number;
    /** Entities by type */
    entitiesByType: Record<string, number>;
    /** Entities by faction */
    entitiesByFaction: Record<string, number>;
    /** Docked entities count */
    dockedEntities: number;
    /** Root entities count */
    rootEntities: number;
    /** Touched entities count */
    touchedEntities: number;
    /** Tracked entities count */
    trackedEntities: number;
    /** Average entities per sector */
    averageEntitiesPerSector: number;
    /** Most populated sectors */
    mostPopulatedSectors: Array<{
        coordinates: string;
        entityCount: number;
    }>;
    /** Largest docking chains */
    largestDockingChains: Array<{
        rootEntityId: number;
        chainSize: number;
    }>;
}

/**
 * Spatial analysis result
 */
export interface SpatialAnalysisResult {
    /** Center coordinates */
    center: { x: number; y: number; z: number };
    /** Analysis radius */
    radius: number;
    /** Total entities in area */
    totalEntities: number;
    /** Entity density per sector */
    entityDensity: number;
    /** Type distribution */
    typeDistribution?: Record<string, number>;
    /** Faction presence */
    factionPresence?: Record<string, number>;
    /** Docking statistics */
    dockingStats?: {
        dockedEntities: number;
        dockingChains: number;
        averageChainLength: number;
    };
    /** Sector coverage */
    sectorsCovered: number;
}

/**
 * Docking chain analysis result
 */
export interface DockingChainAnalysis {
    /** Root entity */
    rootEntity: EntitiesModel;
    /** Chain depth */
    chainDepth: number;
    /** Total entities in chain */
    totalEntities: number;
    /** Chain structure */
    chainStructure: Array<{
        entity: EntitiesModel;
        depth: number;
        children: number;
    }>;
    /** Performance metrics */
    performanceMetrics?: {
        loadTime: number;
        memoryUsage: number;
        complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    };
}

/**
 * Entity conflict check result
 */
export interface EntityConflictResult {
    /** Has conflicts */
    hasConflicts: boolean;
    /** Conflict details */
    conflicts: Array<{
        type: 'POSITION_OVERLAP' | 'UID_DUPLICATE' | 'DOCKING_CONFLICT' | 'SECTOR_MISMATCH';
        severity: 'LOW' | 'MEDIUM' | 'HIGH';
        description: string;
        conflictingEntity?: EntitiesModel;
    }>;
    /** Recommendations */
    recommendations: string[];
}

// =============================================================================
// ENTITIES CONTROLLER
// =============================================================================

/**
 * Controller for ENTITIES table with advanced spatial and entity management capabilities
 */
export class EntitiesController extends BaseController<EntitiesModel> {
    /** Model constructor used to map database rows and obtain the table schema. */
    protected ModelClass: ModelConstructor<EntitiesModel> = EntitiesModel;
    /** Controller name attached to logging and diagnostics. */
    protected controllerName = 'EntitiesController';

    /**
     * UID generation counter for auto-generation
     */
    private static uidCounter = 0;

    /**
     * Create a new entities controller
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 600000, // 10 minutes - entities change less frequently
            enableForeignKeyValidation: true,
            maxResults: 2000, // Higher limit for spatial queries
            ...config
        });
    }

    // =============================================================================
    // ENHANCED CRUD OPERATIONS
    // =============================================================================

    /**
     * Override: Create with entity-specific validation
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: EntityCreateOptions = {}
    ): Promise<EntitiesModel> {
        const {
            autoGenerateUid = true,
            validatePlacement = true,
            checkSectorConflicts = true,
            autoAssignSector = false,
            linkToDockingChain = false,
            ...baseOptions
        } = options;

        // Auto-generate UID if not provided
        if (autoGenerateUid && !data.UID) {
            data.UID = await this.generateUniqueUID();
        }

        // Validate entity data
        if (!data.UID) {
            throw new ValidationError('data', data, 'UID is required for entity creation');
        }

        if (data.X === undefined || data.Y === undefined || data.Z === undefined) {
            throw new ValidationError('data', data, 'Coordinates (X, Y, Z) are required');
        }

        if (data.TYPE === undefined) {
            throw new ValidationError('data', data, 'Entity TYPE is required');
        }

        // Check for UID uniqueness
        const existingEntity = await this.findEntityByUID(data.UID);
        if (existingEntity) {
            throw new ConflictError(`Entity with UID '${data.UID}' already exists`);
        }

        // Validate placement rules
        if (validatePlacement) {
            await this.validateEntityPlacement(data);
        }

        // Check sector conflicts
        if (checkSectorConflicts) {
            const conflicts = await this.checkEntityConflicts({
                uid: data.UID,
                coordinates: { x: data.X, y: data.Y, z: data.Z },
                entityType: data.TYPE
            });
            
            if (conflicts.hasConflicts) {
                const highSeverityConflicts = conflicts.conflicts.filter(c => c.severity === 'HIGH');
                if (highSeverityConflicts.length > 0) {
                    throw new ValidationError(
                        'data',
                        data,
                        `Entity placement conflicts: ${highSeverityConflicts.map(c => c.description).join(', ')}`
                    );
                }
            }
        }

        // Set default values
        data.FACTION = data.FACTION ?? 0;
        data.TOUCHED = data.TOUCHED ?? false;
        data.SPAWNED_ONLY_IN_DB = data.SPAWNED_ONLY_IN_DB ?? false;
        data.TRACKED = data.TRACKED ?? false;
        data.DOCKED_TO = data.DOCKED_TO ?? -1;
        data.DOCKED_ROOT = data.DOCKED_ROOT ?? -1;

        // Link to docking chain if requested
        if (linkToDockingChain && data.DOCKED_TO && data.DOCKED_TO !== -1) {
            await this.validateDockingChain(data.DOCKED_TO, data.DOCKED_ROOT);
        }

        // Call parent create method
        const entity = await super.create(data, baseOptions);

        // TEMPORARY DEBUG: Force set ID if undefined and we can get it from database
        if (entity.getId() === undefined) {
            this.logger.info('Entity ID is undefined after creation, attempting to retrieve it', {
                operation: 'create-entity-debug',
                uid: entity.getUid()
            });
            
            // Try to find the entity by UID to get its ID
            const createdEntity = await this.findEntityByUID(entity.getUid());
            if (createdEntity && createdEntity.getId() !== undefined) {
                entity.set('ID', createdEntity.getId());
                entity.markAsSaved();
                this.logger.info('Successfully retrieved entity ID via UID lookup', {
                    operation: 'create-entity-debug',
                    uid: entity.getUid(),
                    retrievedId: createdEntity.getId()
                });
            }
        }

        this.logger.info('Entity created successfully', {
            operation: 'create-entity',
            entityId: entity.getId(),
            uid: entity.getUid(),
            type: entity.getTypeName(),
            coordinates: entity.getCoordinatesString()
        });

        return entity;
    }

    /**
     * Override: Update with entity-specific validation
     */
    public async update(
        recordIdentifier: any,
        data: Partial<Record<string, any>>,
        options: EntityUpdateOptions = {}
    ): Promise<EntitiesModel> {
        const {
            allowImmutableUpdates = false,
            validatePosition = true,
            updateDockingChain = true,
            checkSectorChange = true,
            preserveRelationships = true,
            ...baseOptions
        } = options;

        // Resolve entity by identifier
        const currentEntity = await this.resolveEntity(recordIdentifier);
        if (!currentEntity) {
            throw new ValidationError('recordIdentifier', recordIdentifier, `Entity not found: ${recordIdentifier}`);
        }

        // Prevent updating immutable fields unless explicitly allowed
        if (!allowImmutableUpdates) {
            const immutableFields = ['UID', 'ID'];
            for (const field of immutableFields) {
                if (data[field] !== undefined && data[field] !== currentEntity.get(field)) {
                    throw new ValidationError('data', data, `Field '${field}' is immutable and cannot be updated`);
                }
            }
        }

        // Validate position changes
        if (validatePosition && (data.X !== undefined || data.Y !== undefined || data.Z !== undefined)) {
            const newCoords = {
                x: data.X ?? currentEntity.getX(),
                y: data.Y ?? currentEntity.getY(),
                z: data.Z ?? currentEntity.getZ()
            };

            // Check if position actually changed
            const positionChanged = newCoords.x !== currentEntity.getX() || 
                                  newCoords.y !== currentEntity.getY() || 
                                  newCoords.z !== currentEntity.getZ();

            if (positionChanged) {
                await this.validateEntityPlacement({
                    ...currentEntity.getData(),
                    ...data,
                    X: newCoords.x,
                    Y: newCoords.y,
                    Z: newCoords.z
                });
            }
        }

        // Update docking chain if docking relationships changed
        if (updateDockingChain && (data.DOCKED_TO !== undefined || data.DOCKED_ROOT !== undefined)) {
            const newDockedTo = data.DOCKED_TO ?? currentEntity.getDockedTo();
            const newDockedRoot = data.DOCKED_ROOT ?? currentEntity.getDockedRoot();
            
            if (newDockedTo !== -1) {
                await this.validateDockingChain(newDockedTo, newDockedRoot);
            }
        }

        // Call parent update method
        const updatedEntity = await super.update(currentEntity.getId(), data, baseOptions);

        this.logger.info('Entity updated successfully', {
            operation: 'update-entity',
            entityId: updatedEntity.getId(),
            uid: updatedEntity.getUid(),
            updatedFields: Object.keys(data)
        });

        return updatedEntity;
    }

    /**
     * Override: Delete with entity-specific cleanup
     */
    public async delete(
        recordIdentifier: any,
        options: DeleteOptions = {}
    ): Promise<boolean> {
        this.ensureInitialized();

        // Resolve entity by identifier
        const entity = await this.resolveEntity(recordIdentifier);
        if (!entity) {
            return false; // Entity doesn't exist
        }

        // Check for docked entities before deletion
        const dockedEntities = await this.findEntities({
            dockedToId: entity.getId(),
            limit: 1,
            skipCache: true
        });

        if (dockedEntities.length > 0 && !options.forceDelete) {
            throw new ValidationError(
                'recordIdentifier',
                recordIdentifier,
                'Cannot delete entity with docked entities. Use forceDelete option to override.'
            );
        }

        this.logger.info('Entity deletion initiated', {
            operation: 'delete-entity',
            entityId: entity.getId(),
            uid: entity.getUid(),
            type: entity.getTypeName(),
            hasDockedEntities: dockedEntities.length > 0
        });

        // Call parent delete method with resolved ID
        const result = await super.delete(entity.getId(), options);

        if (result) {
            this.logger.info('Entity deleted successfully', {
                operation: 'delete-entity',
                entityId: entity.getId(),
                uid: entity.getUid()
            });
        }

        return result;
    }

    // =============================================================================
    // ENTITY SEARCH AND FILTERING
    // =============================================================================

    /**
     * Find entities with advanced search capabilities
     */
    public async findEntities(options: EntitySearchOptions = {}): Promise<EntitiesModel[]> {
        this.validateQueryOptions(options);
        this.ensureInitialized();

        const {
            uid,
            entityType,
            entityTypes,
            factionId,
            coordinates,
            withinRadius,
            creator,
            lastModifier,
            dockedToId,
            dockedOnly,
            undockedOnly,
            rootEntitiesOnly,
            touchedOnly,
            untouchedOnly,
            trackedOnly,
            spawnedOnly,
            searchTerm,
            withRelations,
            ...queryOptions
        } = options;

        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [];

        if (uid) {
            conditions.push('UID = ?');
            params.push(uid);
        }

        if (entityType !== undefined) {
            conditions.push('TYPE = ?');
            params.push(entityType);
        }

        if (entityTypes && entityTypes.length > 0) {
            const placeholders = entityTypes.map(() => '?').join(',');
            conditions.push(`TYPE IN (${placeholders})`);
            params.push(...entityTypes);
        }

        if (factionId !== undefined) {
            conditions.push('FACTION = ?');
            params.push(factionId);
        }

        if (coordinates) {
            conditions.push('X = ? AND Y = ? AND Z = ?');
            params.push(coordinates.x, coordinates.y, coordinates.z);
        }

        if (withinRadius) {
            // Calculate entities within radius using distance formula
            const { center, radius } = withinRadius;
            conditions.push(`
                SQRT(POWER(X - ?, 2) + POWER(Y - ?, 2) + POWER(Z - ?, 2)) <= ?
            `);
            params.push(center.x, center.y, center.z, radius);
        }

        if (creator) {
            conditions.push('CREATOR = ?');
            params.push(creator);
        }

        if (lastModifier) {
            conditions.push('LAST_MOD = ?');
            params.push(lastModifier);
        }

        if (dockedToId !== undefined) {
            conditions.push('DOCKED_TO = ?');
            params.push(dockedToId);
        }

        if (dockedOnly) {
            conditions.push('DOCKED_TO != -1');
        }

        if (undockedOnly) {
            // Handle both numeric -1 and string '-1' for undocked entities
            conditions.push('(DOCKED_TO = -1 OR DOCKED_TO = ? OR DOCKED_TO IS NULL)');
            params.push('-1'); // Add string version for comparison
        }

        if (rootEntitiesOnly) {
            conditions.push('(DOCKED_TO = -1 OR DOCKED_TO = DOCKED_ROOT)');
        }

        if (touchedOnly) {
            conditions.push('TOUCHED = TRUE');
        }

        if (untouchedOnly) {
            conditions.push('(TOUCHED = FALSE OR TOUCHED IS NULL)');
        }

        if (trackedOnly) {
            conditions.push('TRACKED = TRUE');
        }

        if (spawnedOnly) {
            conditions.push('(SPAWNED_ONLY_IN_DB = FALSE OR SPAWNED_ONLY_IN_DB IS NULL)');
        }

        if (searchTerm) {
            conditions.push('(NAME LIKE ? OR UID LIKE ? OR CREATOR LIKE ?)');
            const searchPattern = `%${searchTerm}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        // Build cache key
        const cacheKey = `entities:search:${JSON.stringify(options)}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) {
                this.logger.debug('Entities retrieved from cache', {
                    operation: 'find-entities',
                    count: cached.length
                });
                return EntitiesModel.fromRows(cached);
            }
        }

        // Build SQL query
        let sql = 'SELECT * FROM ENTITIES';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        // Add ordering
        if (queryOptions.orderBy) {
            sql += ` ORDER BY ${queryOptions.orderBy} ${queryOptions.orderDirection || 'ASC'}`;
        } else {
            sql += ' ORDER BY ID ASC';
        }

        // Add pagination
        if (queryOptions.limit) {
            sql += ` LIMIT ${queryOptions.limit}`;
        }
        if (queryOptions.offset) {
            sql += ` OFFSET ${queryOptions.offset}`;
        }

        try {
            const result = await this.executeQuery(sql, params);
            const entities = EntitiesModel.fromRows(result);

            // Load relationships if requested
            if (withRelations) {
                await this.loadEntityRelationships(entities, withRelations);
            }

            // Cache result
            if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
                await this.cacheManager.set(cacheKey, result, {
                    ttl: queryOptions.cacheTtl || this.config.cacheTtlMs
                });
            }

            this.logger.debug('Entities retrieved from database', {
                operation: 'find-entities',
                count: entities.length
            });

            return entities;
        } catch (error) {
            this.logger.error('Failed to find entities', {
                operation: 'find-entities',
                options,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find entity by UID
     */
    public async findEntityByUID(uid: string): Promise<EntitiesModel | null> {
        this.ensureInitialized();

        const sql = 'SELECT * FROM ENTITIES WHERE UID = ?';
        const params = [uid];

        // Build cache key
        const cacheKey = `entities:by-uid:${uid}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>>(cacheKey);
            if (cached) {
                this.logger.debug('Entity retrieved from cache by UID', {
                    operation: 'find-by-uid',
                    uid,
                    cached: true
                });
                return EntitiesModel.fromRow(cached);
            }
        }

        try {
            const result = await this.executeQuery(sql, params);
            const entity = result.length > 0 ? EntitiesModel.fromRow(result[0]) : null;

            // Cache result if found
            if (entity && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, result[0], {
                    ttl: this.config.cacheTtlMs
                });
            }

            this.logger.debug('Entity retrieved from database by UID', {
                operation: 'find-by-uid',
                uid,
                found: !!entity,
                cached: false
            });

            return entity;
        } catch (error) {
            this.logger.error('Failed to find entity by UID', {
                operation: 'find-by-uid',
                uid,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find entities by type
     */
    public async findEntitiesByType(
        entityType: EntityType,
        options: QueryOptions = {}
    ): Promise<EntitiesModel[]> {
        return await this.findEntities({
            entityType,
            ...options
        });
    }

    /**
     * Find entities by faction
     */
    public async findEntitiesByFaction(
        factionId: number,
        options: QueryOptions = {}
    ): Promise<EntitiesModel[]> {
        return await this.findEntities({
            factionId,
            ...options
        });
    }

    /**
     * Find entities in sector
     */
    public async findEntitiesInSector(
        x: number,
        y: number,
        z: number,
        options: QueryOptions = {}
    ): Promise<EntitiesModel[]> {
        return await this.findEntities({
            coordinates: { x, y, z },
            ...options
        });
    }

    /**
     * Find entities within radius
     */
    public async findEntitiesWithinRadius(
        center: { x: number; y: number; z: number },
        radius: number,
        options: QueryOptions = {}
    ): Promise<EntitiesModel[]> {
        return await this.findEntities({
            withinRadius: { center, radius },
            ...options
        });
    }

    // =============================================================================
    // DOCKING CHAIN MANAGEMENT
    // =============================================================================

    /**
     * Get complete docking chain for an entity
     */
    public async getDockingChain(
        entityIdentifier: any,
        options: DockingChainOptions = {}
    ): Promise<DockingChainAnalysis> {
        this.ensureInitialized();

        const entity = await this.resolveEntity(entityIdentifier);
        if (!entity) {
            throw new ValidationError('entityIdentifier', entityIdentifier, `Entity not found: ${entityIdentifier}`);
        }

        const {
            includeChainDepth = true,
            includeEntityDetails = true,
            maxDepth = 50,
            includePerformanceMetrics = false
        } = options;

        const startTime = Date.now();

        // Find root entity
        let rootEntity = entity;
        if (entity.isDocked()) {
            const rootId = entity.getDockedRoot();
            if (rootId !== -1) {
                const foundRoot = await this.findById(rootId);
                if (foundRoot) {
                    rootEntity = foundRoot;
                }
            }
        }

        // Build chain structure
        const chainStructure: Array<{
            entity: EntitiesModel;
            depth: number;
            children: number;
        }> = [];

        let totalEntities = 0;
        let maxChainDepth = 0;

        // Recursive function to build chain
        const buildChain = async (currentEntity: EntitiesModel, depth: number): Promise<void> => {
            if (depth > maxDepth) {
                return; // Prevent infinite loops
            }

            // Find entities docked to current entity
            const dockedEntities = await this.findEntities({
                dockedToId: currentEntity.getId(),
                limit: 0
            });

            const directlyDocked = dockedEntities.filter(e => e.getDockedTo() === currentEntity.getId());

            chainStructure.push({
                entity: currentEntity,
                depth,
                children: directlyDocked.length
            });

            totalEntities++;
            maxChainDepth = Math.max(maxChainDepth, depth);

            // Recursively process docked entities
            for (const dockedEntity of directlyDocked) {
                await buildChain(dockedEntity, depth + 1);
            }
        };

        await buildChain(rootEntity, 0);

        const loadTime = Date.now() - startTime;

        const analysis: DockingChainAnalysis = {
            rootEntity,
            chainDepth: maxChainDepth,
            totalEntities,
            chainStructure
        };

        if (includePerformanceMetrics) {
            analysis.performanceMetrics = {
                loadTime,
                memoryUsage: totalEntities * 1024, // Rough estimate
                complexity: totalEntities <= 10 ? 'LOW' : totalEntities <= 50 ? 'MEDIUM' : 'HIGH'
            };
        }

        this.logger.debug('Docking chain analysis completed', {
            operation: 'get-docking-chain',
            rootEntityId: rootEntity.getId(),
            totalEntities,
            chainDepth: maxChainDepth,
            loadTime
        });

        return analysis;
    }

    /**
     * Validate docking chain integrity
     */
    public async validateDockingChain(dockedToId: number, dockedRootId?: number): Promise<void> {
        if (dockedToId === -1) {
            return; // Not docked, nothing to validate
        }

        // Check that docked-to entity exists
        const dockedToEntity = await this.findById(dockedToId);
        if (!dockedToEntity) {
            throw new ValidationError('dockedToId', dockedToId, `Docked-to entity not found: ${dockedToId}`);
        }

        // If root is specified, validate it
        if (dockedRootId && dockedRootId !== -1) {
            const rootEntity = await this.findById(dockedRootId);
            if (!rootEntity) {
                throw new ValidationError('dockedRootId', dockedRootId, `Docked-root entity not found: ${dockedRootId}`);
            }

            // Root should not be docked to anything - use robust comparison
            const rootDockedTo = rootEntity.getDockedTo();
            if (rootDockedTo !== -1 && rootDockedTo != -1) { // Check both number and string
                throw new ValidationError('dockedRootId', dockedRootId, 'Root entity cannot be docked to another entity');
            }
        }
    }

    // =============================================================================
    // SPATIAL ANALYSIS
    // =============================================================================

    /**
     * Perform spatial analysis around coordinates
     */
    public async performSpatialAnalysis(
        center: { x: number; y: number; z: number },
        radius: number,
        options: SpatialAnalysisOptions = {}
    ): Promise<SpatialAnalysisResult> {
        this.ensureInitialized();

        const {
            includeDensity = true,
            includeTypeDistribution = true,
            includeFactionPresence = true,
            includeDockingStats = true,
            analysisRadius = radius
        } = options;

        // Find all entities within radius
        const entities = await this.findEntitiesWithinRadius(center, analysisRadius, {
            limit: 5000 // High limit for comprehensive analysis
        });

        const result: SpatialAnalysisResult = {
            center,
            radius: analysisRadius,
            totalEntities: entities.length,
            entityDensity: 0,
            sectorsCovered: 0
        };

        if (entities.length === 0) {
            return result;
        }

        // Calculate sectors covered
        const uniqueSectors = new Set(
            entities.map(e => `${e.getX()},${e.getY()},${e.getZ()}`)
        );
        result.sectorsCovered = uniqueSectors.size;

        // Calculate density
        if (includeDensity) {
            const volume = (4/3) * Math.PI * Math.pow(analysisRadius, 3);
            result.entityDensity = entities.length / Math.max(1, result.sectorsCovered);
        }

        // Type distribution
        if (includeTypeDistribution) {
            result.typeDistribution = {};
            entities.forEach(entity => {
                const typeName = entity.getTypeName();
                result.typeDistribution![typeName] = (result.typeDistribution![typeName] || 0) + 1;
            });
        }

        // Faction presence
        if (includeFactionPresence) {
            result.factionPresence = {};
            entities.forEach(entity => {
                const factionName = entity.getFactionName();
                result.factionPresence![factionName] = (result.factionPresence![factionName] || 0) + 1;
            });
        }

        // Docking statistics
        if (includeDockingStats) {
            const dockedEntities = entities.filter(e => e.isDocked());
            const rootEntities = entities.filter(e => !e.isDocked());
            
            result.dockingStats = {
                dockedEntities: dockedEntities.length,
                dockingChains: rootEntities.length,
                averageChainLength: dockedEntities.length > 0 ? 
                    dockedEntities.length / Math.max(1, rootEntities.length) : 0
            };
        }

        this.logger.debug('Spatial analysis completed', {
            operation: 'spatial-analysis',
            center,
            radius: analysisRadius,
            totalEntities: entities.length,
            sectorsCovered: result.sectorsCovered
        });

        return result;
    }

    // =============================================================================
    // ENTITY ANALYTICS
    // =============================================================================

    /**
     * Get comprehensive entity analytics
     */
    public async getEntityAnalytics(
        entityIdentifier: any,
        options: EntityAnalyticsOptions = {}
    ): Promise<any> {
        this.ensureInitialized();

        const entity = await this.resolveEntity(entityIdentifier);
        if (!entity) {
            throw new ValidationError('entityIdentifier', entityIdentifier, `Entity not found: ${entityIdentifier}`);
        }

        const {
            includeSpatialIntelligence = true,
            includeDockingAnalysis = true,
            includeFleetInvolvement = true,
            includeFtlCapabilities = true,
            includeEffectsAnalysis = true,
            includeRelationshipStatus = true
        } = options;

        // Load necessary relationships
        if (includeRelationshipStatus) {
            await this.loadEntityRelationships([entity], {
                sector: true,
                dockedEntities: true,
                dockedToEntity: true,
                dockedRootEntity: true,
                effects: true,
                fleetMembership: true,
                ftlConnections: true
            });
        }

        // Generate comprehensive summary using the entity's built-in method
        const summary = entity.getEntitySummary();

        // Add additional analytics based on options
        const analytics: any = {
            ...summary,
            analysisTimestamp: new Date().toISOString(),
            analysisOptions: options
        };

        if (includeSpatialIntelligence) {
            const spatialAnalysis = await this.performSpatialAnalysis(
                { x: entity.getX(), y: entity.getY(), z: entity.getZ() },
                5, // 5 sector radius
                { includeDensity: true, includeTypeDistribution: true }
            );
            analytics.spatialIntelligence = spatialAnalysis;
        }

        if (includeDockingAnalysis && (entity.isDocked() || entity.getDockedEntitiesCount() > 0)) {
            const dockingAnalysis = await this.getDockingChain(entity.getId(), {
                includeChainDepth: true,
                includeEntityDetails: false,
                includePerformanceMetrics: true
            });
            analytics.dockingAnalysis = dockingAnalysis;
        }

        this.logger.debug('Entity analytics generated', {
            operation: 'get-entity-analytics',
            entityId: entity.getId(),
            uid: entity.getUid(),
            analysisOptions: options
        });

        return analytics;
    }

    // =============================================================================
    // CONFLICT DETECTION
    // =============================================================================

    /**
     * Check for entity conflicts
     */
    public async checkEntityConflicts(entityData: {
        uid?: string;
        coordinates: { x: number; y: number; z: number };
        entityType?: EntityType;
    }): Promise<EntityConflictResult> {
        this.ensureInitialized();

        const result: EntityConflictResult = {
            hasConflicts: false,
            conflicts: [],
            recommendations: []
        };

        const { uid, coordinates, entityType } = entityData;

        // Check UID uniqueness
        if (uid) {
            const existingEntity = await this.findEntityByUID(uid);
            if (existingEntity) {
                result.conflicts.push({
                    type: 'UID_DUPLICATE',
                    severity: 'HIGH',
                    description: `Entity with UID '${uid}' already exists`,
                    conflictingEntity: existingEntity
                });
            }
        }

        // Check position conflicts (for certain entity types)
        if (entityType && this.requiresUniquePosition(entityType)) {
            const entitiesInSector = await this.findEntitiesInSector(
                coordinates.x,
                coordinates.y,
                coordinates.z,
                { limit: 100 }
            );

            const conflictingEntities = entitiesInSector.filter(e => 
                this.requiresUniquePosition(e.getType()) && e.getType() === entityType
            );

            if (conflictingEntities.length > 0) {
                result.conflicts.push({
                    type: 'POSITION_OVERLAP',
                    severity: 'MEDIUM',
                    description: `Another ${EntityType[entityType]} already exists in this sector`,
                    conflictingEntity: conflictingEntities[0]
                });
            }
        }

        result.hasConflicts = result.conflicts.length > 0;

        // Generate recommendations
        if (result.hasConflicts) {
            result.recommendations.push('Consider using a different UID or coordinates');
            if (result.conflicts.some(c => c.type === 'POSITION_OVERLAP')) {
                result.recommendations.push('Check if multiple entities of this type are allowed in the same sector');
            }
        }

        return result;
    }

    // =============================================================================
    // STATISTICS AND REPORTING
    // =============================================================================

    /**
     * Get comprehensive entity statistics
     */
    public async getEntityStatistics(): Promise<EntityStatistics> {
        this.ensureInitialized();

        try {
            // Simplifier les requêtes pour HSQLDB - juste récupérer tous les enregistrements et calculer en mémoire
            const allEntitiesSql = 'SELECT * FROM ENTITIES';
            const allEntitiesResult = await this.executeQuery(allEntitiesSql, []);
            
            const entities = EntitiesModel.fromRows(allEntitiesResult);
            const totalEntities = entities.length;

            // Calculer les statistiques en mémoire
            const entitiesByType: Record<string, number> = {};
            const entitiesByFaction: Record<string, number> = {};
            let dockedEntities = 0;
            let rootEntities = 0;
            let touchedEntities = 0;
            let trackedEntities = 0;
            const sectorCounts: Record<string, number> = {};
            const dockingChains: Record<number, number> = {};

            entities.forEach(entity => {
                // Type distribution
                const typeName = entity.getTypeName();
                entitiesByType[typeName] = (entitiesByType[typeName] || 0) + 1;

                // Faction distribution
                const factionName = entity.getFactionName();
                entitiesByFaction[factionName] = (entitiesByFaction[factionName] || 0) + 1;

                // Docking statistics
                if (entity.isDocked()) {
                    dockedEntities++;
                } else {
                    rootEntities++;
                }

                // Status counts
                if (entity.getTouched()) {
                    touchedEntities++;
                }
                if (entity.getTracked()) {
                    trackedEntities++;
                }

                // Sector statistics
                const coordinates = `${entity.getX()},${entity.getY()},${entity.getZ()}`;
                sectorCounts[coordinates] = (sectorCounts[coordinates] || 0) + 1;

                // Docking chain statistics
                const dockedRoot = entity.getDockedRoot();
                if (dockedRoot !== -1) {
                    dockingChains[dockedRoot] = (dockingChains[dockedRoot] || 0) + 1;
                }
            });

            // Most populated sectors
            const mostPopulatedSectors = Object.entries(sectorCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([coordinates, entityCount]) => ({ coordinates, entityCount }));

            // Largest docking chains
            const largestDockingChains = Object.entries(dockingChains)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([rootEntityId, chainSize]) => ({ 
                    rootEntityId: parseInt(rootEntityId, 10), 
                    chainSize 
                }));

            // Average entities per sector
            const sectorCount = Object.keys(sectorCounts).length;
            const averageEntitiesPerSector = totalEntities / Math.max(1, sectorCount);

            const statistics: EntityStatistics = {
                totalEntities,
                entitiesByType,
                entitiesByFaction,
                dockedEntities,
                rootEntities,
                touchedEntities,
                trackedEntities,
                averageEntitiesPerSector,
                mostPopulatedSectors,
                largestDockingChains
            };

            this.logger.info('Entity statistics generated', {
                operation: 'get-entity-statistics',
                statistics
            });

            return statistics;
        } catch (error) {
            this.logger.error('Failed to get entity statistics', {
                operation: 'get-entity-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError('getEntityStatistics', error, []);
        }
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Get total entity count
     */
    public async getTotalEntityCount(): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) as "total_count" FROM ENTITIES';

        try {
            const result = await this.executeQuery(sql, []);
            return parseInt(result[0]?.total_count || '0', 10);
        } catch (error) {
            this.logger.error('Failed to get total entity count', {
                operation: 'get-total-entity-count',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, []);
        }
    }

    // =============================================================================
    // PRIVATE HELPER METHODS
    // =============================================================================

    /**
     * Generate unique UID for new entity
     */
    private async generateUniqueUID(): Promise<string> {
        let uid: string;
        let attempts = 0;
        const maxAttempts = 100;

        do {
            EntitiesController.uidCounter = (EntitiesController.uidCounter + 1) % 1000000;
            uid = `ENTITY_${Date.now()}_${EntitiesController.uidCounter}`;
            
            const existing = await this.findEntityByUID(uid);
            if (!existing) {
                return uid;
            }
            
            attempts++;
        } while (attempts < maxAttempts);

        throw new Error('Failed to generate unique UID after maximum attempts');
    }

    /**
     * Validate entity placement rules
     */
    private async validateEntityPlacement(entityData: any): Promise<void> {
        // Validate coordinates are integers
        if (!Number.isInteger(entityData.X) || !Number.isInteger(entityData.Y) || !Number.isInteger(entityData.Z)) {
            throw new ValidationError('entityData', entityData, 'Entity coordinates must be integers');
        }

        // Validate entity type
        const validTypes = Object.values(EntityType).filter(v => typeof v === 'number');
        if (!validTypes.includes(entityData.TYPE)) {
            throw new ValidationError('entityData', entityData, `Invalid entity type: ${entityData.TYPE}`);
        }

        // Additional placement rules can be added here
    }

    /**
     * Check if entity type requires unique position
     */
    private requiresUniquePosition(entityType: EntityType): boolean {
        const uniquePositionTypes = [
            EntityType.PLANET,
            EntityType.SUN,
            EntityType.BLACK_HOLE,
            EntityType.PLANET_CORE
        ];
        return uniquePositionTypes.includes(entityType);
    }

    /**
     * Get faction display name
     */
    private getFactionDisplayName(factionId: number): string {
        switch (factionId) {
            case KnownFactions.NO_FACTION:
                return 'No Faction';
            case KnownFactions.TRADING_GUILD:
                return 'Trading Guild';
            case KnownFactions.OUTCASTS:
                return 'Outcasts';
            case KnownFactions.SCAVENGERS:
                return 'Scavengers';
            default:
                return factionId > 0 ? `Player Faction ${factionId}` : `Unknown Faction ${factionId}`;
        }
    }

    /**
     * Resolve entity by ID, UID, or name
     */
    private async resolveEntity(identifier: any): Promise<EntitiesModel | null> {
        // Try by ID first
        if (typeof identifier === 'number') {
            return await this.findById(identifier);
        }

        // Try by string ID
        if (typeof identifier === 'string' && /^\d+$/.test(identifier)) {
            const id = parseInt(identifier, 10);
            if (!isNaN(id)) {
                return await this.findById(id);
            }
        }

        // Try by UID
        if (typeof identifier === 'string') {
            return await this.findEntityByUID(identifier);
        }

        return null;
    }

    /**
     * Load relationships for entities
     */
    private async loadEntityRelationships(
        entities: EntitiesModel[],
        relations: NonNullable<EntitySearchOptions['withRelations']>
    ): Promise<void> {
        // This would be implemented with proper relationship loading
        // For now, it's a placeholder for the relationship system
        this.logger.debug('Loading entity relationships', {
            operation: 'load-entity-relationships',
            entityCount: entities.length,
            relations
        });
    }

    /**
     * Clear entity-related caches
     */
    protected async clearEntityCaches(entityId?: number): Promise<void> {
        if (this.cacheManager) {
            await this.cacheManager.clear('entities:*');
            
            if (entityId) {
                await this.cacheManager.clear(`ENTITIES:by-id:${entityId}`);
            }
        }
    }

    /**
     * Override cache clearing to include entity-specific patterns
     */
    protected async clearCachesForTable(tableName: string): Promise<void> {
        await super.clearCachesForTable(tableName);
        await this.clearEntityCaches();
    }
}