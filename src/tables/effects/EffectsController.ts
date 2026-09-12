/**
 * @fileoverview Effects Controller
 * 
 * Controller for managing entity effects in the EFFECTS table with advanced operations,
 * effect categorization, entity relationship management, and comprehensive effect analytics.
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
    EffectsModel,
    EffectType,
    EffectCategory,
    EFFECT_UIDS,
    ALL_EFFECT_UIDS
} from './EffectsModel.js';
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
 * Effect search options
 */
export interface EffectSearchOptions extends QueryOptions {
    /** Search by effect UID pattern */
    searchTerm?: string;
    /** Filter by effect type */
    effectType?: EffectType;
    /** Filter by effect category */
    category?: EffectCategory;
    /** Filter by entity ID */
    entityId?: number;
    /** Filter by entity IDs (multiple entities) */
    entityIds?: number[];
    /** Include only recognized effects */
    recognizedOnly?: boolean;
    /** Include only unrecognized effects */
    unrecognizedOnly?: boolean;
    /** Filter by effects that affect combat */
    affectsCombat?: boolean;
    /** Filter by effects that affect ship operation */
    affectsOperation?: boolean;
    /** Filter by scope type */
    scopeType?: 'structure' | 'sector' | 'system' | 'other';
}

/**
 * Effect creation options
 */
export interface EffectCreateOptions extends CreateOptions {
    /** Validate that the entity exists */
    validateEntityExists?: boolean;
    /** Allow creation of unrecognized effect UIDs */
    allowUnrecognizedEffects?: boolean;
    /** Auto-categorize effect if UID is recognized */
    autoCategorize?: boolean;
}

/**
 * Effect update options
 */
export interface EffectUpdateOptions extends UpdateOptions {
    /** Allow updating entity ID */
    allowEntityIdUpdates?: boolean;
    /** Allow updating effect type */
    allowTypeUpdates?: boolean;
    /** Validate entity exists on update */
    validateEntityExists?: boolean;
}

/**
 * Bulk effect operation options
 */
export interface BulkEffectOptions {
    /** Skip validation for performance */
    skipValidation?: boolean;
    /** Continue on errors */
    continueOnError?: boolean;
    /** Log individual operations */
    logOperations?: boolean;
    /** Batch size for processing */
    batchSize?: number;
    /** Validate entities exist */
    validateEntities?: boolean;
}

/**
 * Effect analysis options
 */
export interface EffectAnalysisOptions {
    /** Include effect category breakdown */
    includeCategoryBreakdown?: boolean;
    /** Include entity type analysis */
    includeEntityTypeAnalysis?: boolean;
    /** Include recognition statistics */
    includeRecognitionStats?: boolean;
    /** Include scope analysis */
    includeScopeAnalysis?: boolean;
    /** Include performance impact analysis */
    includePerformanceAnalysis?: boolean;
}

/**
 * Entity effect management options
 */
export interface EntityEffectOptions {
    /** Include inactive effects */
    includeInactive?: boolean;
    /** Group by effect category */
    groupByCategory?: boolean;
    /** Include effect summaries */
    includeSummaries?: boolean;
    /** Sort by effect type */
    sortByType?: boolean;
}

/**
 * Effect statistics result
 */
export interface EffectStatistics {
    /** Total effects */
    totalEffects: number;
    /** Effects by type */
    effectsByType: Record<EffectType, number>;
    /** Effects by category */
    effectsByCategory: Record<EffectCategory, number>;
    /** Recognized vs unrecognized effects */
    recognitionStats: {
        recognized: number;
        unrecognized: number;
        recognitionRate: number;
    };
    /** Scope distribution */
    scopeDistribution: {
        structure: number;
        sector: number;
        system: number;
        other: number;
    };
    /** Performance impact analysis */
    performanceImpact: {
        combatEffects: number;
        operationEffects: number;
        hybridEffects: number;
        neutralEffects: number;
    };
    /** Top effect UIDs */
    topEffectUIDs: Array<{
        uid: string;
        count: number;
        category: EffectCategory;
    }>;
    /** Entity coverage */
    entityCoverage: {
        entitiesWithEffects: number;
        averageEffectsPerEntity: number;
        maxEffectsOnEntity: number;
    };
}

/**
 * Entity effect summary
 */
export interface EntityEffectSummary {
    /** Entity ID */
    entityId: number;
    /** Entity name (if available from relationship) */
    entityName?: string;
    /** Entity type (if available from relationship) */
    entityType?: string;
    /** Total effects on entity */
    totalEffects: number;
    /** Effects by category */
    effectsByCategory: Record<EffectCategory, number>;
    /** Combat-affecting effects */
    combatEffects: EffectsModel[];
    /** Operation-affecting effects */
    operationEffects: EffectsModel[];
    /** All effects on entity */
    allEffects: EffectsModel[];
    /** Performance impact summary */
    performanceImpact: {
        hasCombatEffects: boolean;
        hasOperationEffects: boolean;
        overallImpact: 'high' | 'medium' | 'low' | 'none';
    };
}

/**
 * Effect category analysis
 */
export interface CategoryAnalysis {
    /** Category */
    category: EffectCategory;
    /** Total effects in category */
    totalEffects: number;
    /** Unique effect UIDs in category */
    uniqueUIDs: string[];
    /** Entities affected */
    entitiesAffected: number;
    /** Average effects per entity */
    averagePerEntity: number;
    /** Scope distribution within category */
    scopeDistribution: Record<EffectType, number>;
    /** Most common effect UID in category */
    mostCommonUID?: {
        uid: string;
        count: number;
    };
}

// =============================================================================
// EFFECTS CONTROLLER
// =============================================================================

/**
 * Controller for EFFECTS table with comprehensive effect management capabilities
 */
export class EffectsController extends BaseController<EffectsModel> {
    /** Model constructor used to map database rows and obtain the table schema. */
    protected ModelClass: ModelConstructor<EffectsModel> = EffectsModel;
    /** Controller name attached to logging and diagnostics. */
    protected controllerName = 'EffectsController';

    /**
     * Create a new effects controller
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 600000, // 10 minutes - effects change moderately
            enableForeignKeyValidation: true,
            ...config
        });
    }

    // =============================================================================
    // ENHANCED CRUD OPERATIONS
    // =============================================================================

    /**
     * Override: Create with effect-specific validation
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: EffectCreateOptions = {}
    ): Promise<EffectsModel> {
        const {
            validateEntityExists = true,
            allowUnrecognizedEffects = true,
            autoCategorize = false,
            ...baseOptions
        } = options;

        // Enhanced validation specific to effects
        if (!data.ENTITY_ID) {
            throw new ValidationError('data', data, 'ENTITY_ID is required');
        }

        if (data.TYPE === undefined || data.TYPE === null) {
            throw new ValidationError('data', data, 'TYPE is required');
        }

        // Validate entity exists if requested
        if (validateEntityExists) {
            await this.validateEntityExists(data.ENTITY_ID);
        }

        // Validate effect UID if provided
        if (data.EFFECT_UID && !allowUnrecognizedEffects) {
            if (!ALL_EFFECT_UIDS.includes(data.EFFECT_UID)) {
                throw new ValidationError(
                    'EFFECT_UID', 
                    data.EFFECT_UID, 
                    `Unrecognized effect UID: ${data.EFFECT_UID}. Set allowUnrecognizedEffects to true to allow.`
                );
            }
        }

        // Auto-categorize if requested and effect UID is recognized
        if (autoCategorize && data.EFFECT_UID) {
            const tempEffect = new EffectsModel(data);
            if (tempEffect.isRecognizedEffect()) {
                this.logger.debug('Auto-categorizing effect', {
                    operation: 'create-auto-categorize',
                    effectUid: data.EFFECT_UID,
                    category: tempEffect.getCategory()
                });
            }
        }

        // Call parent create method
        return await super.create(data, baseOptions);
    }

    /**
     * Override: Update with effect-specific validation
     */
    public async update(
        effectId: any,
        data: Partial<Record<string, any>>,
        options: EffectUpdateOptions = {}
    ): Promise<EffectsModel> {
        const {
            allowEntityIdUpdates = false,
            allowTypeUpdates = true,
            validateEntityExists = true,
            ...baseOptions
        } = options;

        // Validate current effect exists
        const currentEffect = await this.findById(effectId);
        if (!currentEffect) {
            throw new ValidationError('effectId', effectId, `Effect not found: ${effectId}`);
        }

        // Check for entity ID updates when not allowed
        if (!allowEntityIdUpdates && data.hasOwnProperty('ENTITY_ID') && data.ENTITY_ID !== undefined) {
            throw new ValidationError(
                'data', 
                data, 
                'Cannot update ENTITY_ID when allowEntityIdUpdates is false'
            );
        }

        // Check for type updates when not allowed
        if (!allowTypeUpdates && data.hasOwnProperty('TYPE') && data.TYPE !== undefined) {
            throw new ValidationError(
                'data', 
                data, 
                'Cannot update TYPE when allowTypeUpdates is false'
            );
        }

        // Validate entity exists if entity ID is being updated
        if (data.ENTITY_ID && validateEntityExists) {
            await this.validateEntityExists(data.ENTITY_ID);
        }

        // Call parent update method
        return await super.update(effectId, data, { returnRecord: true, ...baseOptions });
    }

    /**
     * Override: Delete with effect-specific logging
     */
    public async delete(
        effectId: any,
        options: DeleteOptions = {}
    ): Promise<boolean> {
        this.ensureInitialized();

        // Get effect for logging before deletion
        const effect = await this.findById(effectId);
        if (!effect) {
            return false; // Effect doesn't exist
        }

        // Log effect deletion
        this.logger.info('Effect deletion initiated', {
            operation: 'delete-effect',
            effectId: effect.getId(),
            entityId: effect.getEntityId(),
            effectType: effect.getTypeName(),
            effectUid: effect.getEffectUid(),
            category: effect.getCategory()
        });

        // Call parent delete method
        const result = await super.delete(effectId, options);

        if (result) {
            this.logger.info('Effect deleted successfully', {
                operation: 'delete-effect',
                effectId: effect.getId(),
                entityId: effect.getEntityId()
            });
        }

        return result;
    }

    // =============================================================================
    // SEARCH AND FILTERING OPERATIONS
    // =============================================================================

    /**
     * Find effects with advanced search capabilities
     */
    public async findEffects(options: EffectSearchOptions = {}): Promise<EffectsModel[]> {
        this.validateQueryOptions(options);
        this.ensureInitialized();

        const {
            searchTerm,
            effectType,
            category,
            entityId,
            entityIds,
            recognizedOnly = false,
            unrecognizedOnly = false,
            affectsCombat,
            affectsOperation,
            scopeType,
            ...queryOptions
        } = options;

        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [];

        if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim() !== '') {
            conditions.push('(LOWER(EFFECT_UID) LIKE ? OR CAST(ID AS VARCHAR(50)) LIKE ?)');
            const searchPattern = `%${searchTerm.toLowerCase()}%`;
            params.push(searchPattern, searchPattern);
        }

        if (effectType !== undefined && effectType !== null) {
            conditions.push('TYPE = ?');
            params.push(effectType);
        }

        if (entityId !== undefined && entityId !== null) {
            conditions.push('ENTITY_ID = ?');
            params.push(entityId);
        }

        if (entityIds && entityIds.length > 0) {
            const validEntityIds = entityIds.filter(id => id !== null && id !== undefined);
            if (validEntityIds.length > 0) {
                const placeholders = validEntityIds.map(() => '?').join(',');
                conditions.push(`ENTITY_ID IN (${placeholders})`);
                params.push(...validEntityIds);
            }
        }

        if (scopeType) {
            const typeMapping = {
                'structure': EffectType.STRUCTURE,
                'sector': EffectType.SECTOR,
                'system': EffectType.SYSTEM,
                'other': EffectType.OTHER
            };
            conditions.push('TYPE = ?');
            params.push(typeMapping[scopeType]);
        }

        // Build cache key
        const cacheKey = `effects:search:${JSON.stringify(options)}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) {
                this.logger.debug('Effects retrieved from cache', {
                    operation: 'find-effects',
                    count: cached.length,
                    searchTerm,
                    effectType
                });
                let effects = EffectsModel.fromRows(cached);
                
                // Apply post-query filters that can't be done in SQL
                effects = this.applyPostQueryFilters(effects, options);
                return effects;
            }
        }

        // Build SQL query
        let sql = 'SELECT * FROM EFFECTS';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        // Add ordering - fix column name validation
        if (queryOptions.orderBy) {
            sql += ` ORDER BY ${queryOptions.orderBy} ${queryOptions.orderDirection || 'ASC'}`;
        } else {
            sql += ' ORDER BY ENTITY_ID ASC, TYPE ASC, ID ASC';
        }

        // Add pagination
        if (queryOptions.limit && queryOptions.limit > 0) {
            sql += ` LIMIT ${queryOptions.limit}`;
        }
        if (queryOptions.offset && queryOptions.offset > 0) {
            sql += ` OFFSET ${queryOptions.offset}`;
        }

        try {
            const result = await this.executeQuery(sql, params);
            let effects = EffectsModel.fromRows(result);

            // Apply post-query filters
            effects = this.applyPostQueryFilters(effects, options);

            // Cache result
            if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
                await this.cacheManager.set(cacheKey, result, {
                    ttl: queryOptions.cacheTtl || this.config.cacheTtlMs
                });
            }

            this.logger.debug('Effects retrieved from database', {
                operation: 'find-effects',
                count: effects.length,
                searchTerm,
                effectType
            });

            return effects;
        } catch (error) {
            this.logger.error('Failed to find effects', {
                operation: 'find-effects',
                options,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find effects by entity ID
     */
    public async findByEntityId(entityId: number, options: QueryOptions = {}): Promise<EffectsModel[]> {
        return await this.findEffects({
            entityId,
            ...options
        });
    }

    /**
     * Find effects by type
     */
    public async findByType(effectType: EffectType, options: QueryOptions = {}): Promise<EffectsModel[]> {
        return await this.findEffects({
            effectType,
            ...options
        });
    }

    /**
     * Find effects by category
     */
    public async findByCategory(category: EffectCategory, options: QueryOptions = {}): Promise<EffectsModel[]> {
        return await this.findEffects({
            category,
            ...options
        });
    }

    /**
     * Find effects by UID pattern
     */
    public async findByEffectUid(effectUid: string, exact: boolean = true, options: QueryOptions = {}): Promise<EffectsModel[]> {
        this.ensureInitialized();

        const sql = exact 
            ? 'SELECT * FROM EFFECTS WHERE EFFECT_UID = ?'
            : 'SELECT * FROM EFFECTS WHERE LOWER(EFFECT_UID) LIKE ?';
        const params = exact ? [effectUid] : [`%${effectUid.toLowerCase()}%`];

        try {
            const result = await this.executeQuery(sql, params);
            const effects = EffectsModel.fromRows(result);

            this.logger.debug('Effects retrieved by UID', {
                operation: 'find-by-effect-uid',
                effectUid,
                exact,
                count: effects.length
            });

            return effects;
        } catch (error) {
            this.logger.error('Failed to find effects by UID', {
                operation: 'find-by-effect-uid',
                effectUid,
                exact,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find recognized effects only
     */
    public async findRecognizedEffects(options: QueryOptions = {}): Promise<EffectsModel[]> {
        return await this.findEffects({
            recognizedOnly: true,
            ...options
        });
    }

    /**
     * Find unrecognized effects only
     */
    public async findUnrecognizedEffects(options: QueryOptions = {}): Promise<EffectsModel[]> {
        return await this.findEffects({
            unrecognizedOnly: true,
            ...options
        });
    }

    // =============================================================================
    // ENTITY EFFECT MANAGEMENT
    // =============================================================================

    /**
     * Get comprehensive effect summary for an entity
     */
    public async getEntityEffectSummary(entityId: number, options: EntityEffectOptions = {}): Promise<EntityEffectSummary> {
        this.ensureInitialized();

        const {
            includeInactive = false,
            groupByCategory = true,
            includeSummaries = true,
            sortByType = true
        } = options;

        // Get all effects for the entity
        const effects = await this.findByEntityId(entityId, {
            includeInactive,
            orderBy: sortByType ? 'TYPE' : undefined
        });

        // Initialize category counts
        const effectsByCategory: Record<EffectCategory, number> = {
            [EffectCategory.MOVEMENT]: 0,
            [EffectCategory.DEFENSIVE]: 0,
            [EffectCategory.OFFENSIVE]: 0,
            [EffectCategory.POWER]: 0,
            [EffectCategory.UTILITY]: 0,
            [EffectCategory.STEALTH]: 0,
            [EffectCategory.UNKNOWN]: 0
        };

        // Categorize effects
        const combatEffects: EffectsModel[] = [];
        const operationEffects: EffectsModel[] = [];

        for (const effect of effects) {
            const category = effect.getCategory();
            effectsByCategory[category]++;

            if (effect.affectsCombatPerformance()) {
                combatEffects.push(effect);
            }
            if (effect.affectsShipOperation()) {
                operationEffects.push(effect);
            }
        }

        // Determine overall performance impact
        let overallImpact: 'high' | 'medium' | 'low' | 'none' = 'none';
        if (combatEffects.length > 0 && operationEffects.length > 0) {
            overallImpact = 'high';
        } else if (combatEffects.length > 0 || operationEffects.length > 0) {
            overallImpact = 'medium';
        } else if (effects.length > 0) {
            overallImpact = 'low';
        }

        // Try to get entity information from relationship if possible
        let entityName: string | undefined;
        let entityType: string | undefined;
        if (effects.length > 0 && effects[0].hasEntityLoaded()) {
            entityName = effects[0].getEntityName();
            entityType = effects[0].getEntityTypeName();
        }

        const summary: EntityEffectSummary = {
            entityId,
            entityName,
            entityType,
            totalEffects: effects.length,
            effectsByCategory,
            combatEffects,
            operationEffects,
            allEffects: effects,
            performanceImpact: {
                hasCombatEffects: combatEffects.length > 0,
                hasOperationEffects: operationEffects.length > 0,
                overallImpact
            }
        };

        this.logger.debug('Entity effect summary generated', {
            operation: 'get-entity-effect-summary',
            entityId,
            totalEffects: effects.length,
            combatEffects: combatEffects.length,
            operationEffects: operationEffects.length,
            overallImpact
        });

        return summary;
    }

    /**
     * Add effect to entity
     */
    public async addEffectToEntity(
        entityId: number,
        effectType: EffectType,
        effectUid?: string,
        options: EffectCreateOptions = {}
    ): Promise<EffectsModel> {
        return await this.create({
            ENTITY_ID: entityId,
            TYPE: effectType,
            EFFECT_UID: effectUid
        }, options);
    }

    /**
     * Remove effects from entity
     */
    public async removeEffectsFromEntity(
        entityId: number,
        effectType?: EffectType,
        effectUid?: string
    ): Promise<number> {
        this.ensureInitialized();

        // Build WHERE conditions
        const conditions: string[] = ['ENTITY_ID = ?'];
        const params: any[] = [entityId];

        if (effectType !== undefined) {
            conditions.push('TYPE = ?');
            params.push(effectType);
        }

        if (effectUid) {
            conditions.push('EFFECT_UID = ?');
            params.push(effectUid);
        }

        const sql = `DELETE FROM EFFECTS WHERE ${conditions.join(' AND ')}`;

        try {
            const affectedRows = await this.executeUpdate(sql, params);
            
            // Clear caches
            if (this.cacheManager && this.config.enableCaching) {
                await this.clearCachesForTable('EFFECTS');
            }

            this.logger.info('Effects removed from entity', {
                operation: 'remove-effects-from-entity',
                entityId,
                effectType,
                effectUid,
                affectedRows
            });

            return affectedRows;
        } catch (error) {
            this.logger.error('Failed to remove effects from entity', {
                operation: 'remove-effects-from-entity',
                entityId,
                effectType,
                effectUid,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Clear all effects from entity
     */
    public async clearEntityEffects(entityId: number): Promise<number> {
        return await this.removeEffectsFromEntity(entityId);
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Bulk create effects
     */
    public async bulkCreate(
        effectsData: Array<Partial<Record<string, any>>>,
        options: BulkEffectOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const {
            skipValidation = false,
            continueOnError = true,
            batchSize = 100,
            logOperations = false,
            validateEntities = false
        } = options;

        if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
            throw new ValidationError('batchSize', batchSize, 'Batch size must be a positive safe integer');
        }

        const result: BulkOperationResult = {
            success: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        // Process in batches
        batches: for (let i = 0; i < effectsData.length; i += batchSize) {
            const batch = effectsData.slice(i, i + batchSize);
            
            for (let j = 0; j < batch.length; j++) {
                const effectData = batch[j];
                const index = i + j;
                
                try {
                    const createdEffect = await this.create(effectData, {
                        skipValidation,
                        validateEntityExists: validateEntities
                    } as EffectCreateOptions);
                    
                    result.success++;
                    
                    if (logOperations) {
                        this.logger.debug('Bulk create effect success', {
                            operation: 'bulk-create-effects',
                            index,
                            effectId: createdEffect.getId(),
                            entityId: createdEffect.getEntityId(),
                            effectUid: createdEffect.getEffectUid()
                        });
                    }
                } catch (error: unknown) {
                    result.failed++;
                    result.errors.push({
                        index,
                        error: error instanceof Error ? error.message : String(error),
                        data: effectData
                    });
                    
                    if (!continueOnError) {
                        break batches;
                    }
                }
            }
        }

        this.logger.info('Bulk create effects completed', {
            operation: 'bulk-create-effects',
            totalItems: effectsData.length,
            result
        });

        return result;
    }

    /**
     * Bulk update effects by entity
     */
    public async bulkUpdateByEntity(
        entityId: number,
        updates: Partial<Record<string, any>>,
        options: BulkEffectOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const effects = await this.findByEntityId(entityId);
        const effectIds = effects.map(effect => effect.getId());

        return await this.bulkUpdate(effectIds, updates, options);
    }

    /**
     * Bulk update effects
     */
    public async bulkUpdate(
        effectIds: number[],
        updates: Partial<Record<string, any>>,
        options: BulkEffectOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const {
            continueOnError = true,
            logOperations = false
        } = options;

        const result: BulkOperationResult = {
            success: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };

        for (let i = 0; i < effectIds.length; i++) {
            const effectId = effectIds[i];
            
            try {
                await this.update(effectId, updates);
                
                result.success++;
                
                if (logOperations) {
                    this.logger.debug('Bulk update effect success', {
                        operation: 'bulk-update-effects',
                        effectId
                    });
                }
            } catch (error) {
                result.failed++;
                result.errors.push({
                    index: i,
                    error: error instanceof Error ? error.message : String(error),
                    data: { effectId, updates }
                });
                
                if (!continueOnError) {
                    break;
                }
            }
        }

        this.logger.info('Bulk update effects completed', {
            operation: 'bulk-update-effects',
            totalItems: effectIds.length,
            result
        });

        return result;
    }

    // =============================================================================
    // STATISTICS AND ANALYTICS
    // =============================================================================

    /**
     * Get comprehensive effect statistics
     */
    public async getEffectStatistics(options: EffectAnalysisOptions = {}): Promise<EffectStatistics> {
        this.ensureInitialized();

        const {
            includeCategoryBreakdown = true,
            includeEntityTypeAnalysis = false,
            includeRecognitionStats = true,
            includeScopeAnalysis = true,
            includePerformanceAnalysis = true
        } = options;

        try {
            // Get all effects
            const allEffects = await this.findMany({ limit: 0 }); // No limit to get all

            // Basic counts
            const totalEffects = allEffects.length;

            // Effects by type
            const effectsByType: Record<EffectType, number> = {
                [EffectType.OTHER]: 0,
                [EffectType.STRUCTURE]: 0,
                [EffectType.SECTOR]: 0,
                [EffectType.SYSTEM]: 0
            };

            // Effects by category
            const effectsByCategory: Record<EffectCategory, number> = {
                [EffectCategory.MOVEMENT]: 0,
                [EffectCategory.DEFENSIVE]: 0,
                [EffectCategory.OFFENSIVE]: 0,
                [EffectCategory.POWER]: 0,
                [EffectCategory.UTILITY]: 0,
                [EffectCategory.STEALTH]: 0,
                [EffectCategory.UNKNOWN]: 0
            };

            // Recognition stats
            let recognized = 0;
            let unrecognized = 0;

            // Scope distribution
            const scopeDistribution = {
                structure: 0,
                sector: 0,
                system: 0,
                other: 0
            };

            // Performance impact
            let combatEffects = 0;
            let operationEffects = 0;
            let hybridEffects = 0;
            let neutralEffects = 0;

            // UID counting
            const uidCounts = new Map<string, number>();
            const entityEffectCounts = new Map<number, number>();

            // Process all effects
            for (const effect of allEffects) {
                // Type counting
                effectsByType[effect.getType()]++;

                // Category counting
                effectsByCategory[effect.getCategory()]++;

                // Recognition stats
                if (effect.isRecognizedEffect()) {
                    recognized++;
                } else {
                    unrecognized++;
                }

                // Scope distribution
                if (effect.isStructureScoped()) scopeDistribution.structure++;
                else if (effect.isSectorScoped()) scopeDistribution.sector++;
                else if (effect.isSystemScoped()) scopeDistribution.system++;
                else scopeDistribution.other++;

                // Performance impact
                const affectsCombat = effect.affectsCombatPerformance();
                const affectsOperation = effect.affectsShipOperation();

                if (affectsCombat && affectsOperation) {
                    hybridEffects++;
                } else if (affectsCombat) {
                    combatEffects++;
                } else if (affectsOperation) {
                    operationEffects++;
                } else {
                    neutralEffects++;
                }

                // UID counting
                const uid = effect.getEffectUid();
                if (uid) {
                    uidCounts.set(uid, (uidCounts.get(uid) || 0) + 1);
                }

                // Entity effect counting
                const entityId = effect.getEntityId();
                entityEffectCounts.set(entityId, (entityEffectCounts.get(entityId) || 0) + 1);
            }

            // Calculate top effect UIDs
            const topEffectUIDs = Array.from(uidCounts.entries())
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([uid, count]) => {
                    const tempEffect = new EffectsModel({ EFFECT_UID: uid, ENTITY_ID: 1, TYPE: EffectType.OTHER });
                    return {
                        uid,
                        count,
                        category: tempEffect.getCategory()
                    };
                });

            // Calculate entity coverage
            const entitiesWithEffects = entityEffectCounts.size;
            const totalEffectCount = Array.from(entityEffectCounts.values()).reduce((sum, count) => sum + count, 0);
            const averageEffectsPerEntity = entitiesWithEffects > 0 ? totalEffectCount / entitiesWithEffects : 0;
            const maxEffectsOnEntity = entitiesWithEffects > 0 ? Math.max(...Array.from(entityEffectCounts.values())) : 0;

            const statistics: EffectStatistics = {
                totalEffects,
                effectsByType,
                effectsByCategory,
                recognitionStats: {
                    recognized,
                    unrecognized,
                    recognitionRate: totalEffects > 0 ? (recognized / totalEffects) * 100 : 0
                },
                scopeDistribution,
                performanceImpact: {
                    combatEffects,
                    operationEffects,
                    hybridEffects,
                    neutralEffects
                },
                topEffectUIDs,
                entityCoverage: {
                    entitiesWithEffects,
                    averageEffectsPerEntity,
                    maxEffectsOnEntity
                }
            };

            this.logger.info('Effect statistics generated', {
                operation: 'get-effect-statistics',
                totalEffects,
                recognitionRate: statistics.recognitionStats.recognitionRate,
                entitiesWithEffects
            });

            return statistics;
        } catch (error) {
            this.logger.error('Failed to get effect statistics', {
                operation: 'get-effect-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError('getEffectStatistics', error, []);
        }
    }

    /**
     * Get category analysis
     */
    public async getCategoryAnalysis(): Promise<CategoryAnalysis[]> {
        this.ensureInitialized();

        const allEffects = await this.findMany({ limit: 0 });
        const categoryMap = new Map<EffectCategory, EffectsModel[]>();

        // Group effects by category
        for (const effect of allEffects) {
            const category = effect.getCategory();
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category)!.push(effect);
        }

        const analyses: CategoryAnalysis[] = [];

        for (const [category, effects] of categoryMap.entries()) {
            const uniqueUIDs = new Set<string>();
            const entitiesAffected = new Set<number>();
            const scopeDistribution: Record<EffectType, number> = {
                [EffectType.OTHER]: 0,
                [EffectType.STRUCTURE]: 0,
                [EffectType.SECTOR]: 0,
                [EffectType.SYSTEM]: 0
            };
            const uidCounts = new Map<string, number>();

            for (const effect of effects) {
                const uid = effect.getEffectUid();
                if (uid) {
                    uniqueUIDs.add(uid);
                    uidCounts.set(uid, (uidCounts.get(uid) || 0) + 1);
                }
                entitiesAffected.add(effect.getEntityId());
                scopeDistribution[effect.getType()]++;
            }

            // Find most common UID
            let mostCommonUID: { uid: string; count: number } | undefined;
            if (uidCounts.size > 0) {
                const [uid, count] = Array.from(uidCounts.entries())
                    .sort(([, a], [, b]) => b - a)[0];
                mostCommonUID = { uid, count };
            }

            analyses.push({
                category,
                totalEffects: effects.length,
                uniqueUIDs: Array.from(uniqueUIDs),
                entitiesAffected: entitiesAffected.size,
                averagePerEntity: effects.length / entitiesAffected.size,
                scopeDistribution,
                mostCommonUID
            });
        }

        return analyses;
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Get total effect count
     */
    public async getTotalEffectCount(): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) FROM EFFECTS';

        try {
            const result = await this.executeQuery(sql, []);
            // HSQLDB might return COUNT(*) results differently, let's handle multiple formats
            const countValue = result[0]?.total_count || result[0]?.['COUNT(*)'] || result[0]?.count || Object.values(result[0] || {})[0];
            return parseInt(String(countValue || '0'), 10);
        } catch (error) {
            this.logger.error('Failed to get total effect count', {
                operation: 'get-total-effect-count',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, []);
        }
    }

    /**
     * Get effect count by entity
     */
    public async getEffectCountByEntity(entityId: number): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) FROM EFFECTS WHERE ENTITY_ID = ?';
        const params = [entityId];

        try {
            const result = await this.executeQuery(sql, params);
            // HSQLDB might return COUNT(*) results differently, let's handle multiple formats
            const countValue = result[0]?.effect_count || result[0]?.['COUNT(*)'] || result[0]?.count || Object.values(result[0] || {})[0];
            return parseInt(String(countValue || '0'), 10);
        } catch (error) {
            this.logger.error('Failed to get effect count by entity', {
                operation: 'get-effect-count-by-entity',
                entityId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Check if entity has effects
     */
    public async entityHasEffects(entityId: number): Promise<boolean> {
        const count = await this.getEffectCountByEntity(entityId);
        return count > 0;
    }

    /**
     * Validate that an entity exists (placeholder - would need EntitiesController)
     */
    private async validateEntityExists(entityId: number): Promise<void> {
        // This is a simplified validation - in a real implementation,
        // we would inject an EntitiesController dependency and check if entity exists
        
        // For now, we'll do a basic check that the entity ID is valid
        if (!entityId || entityId <= 0) {
            throw new ValidationError('entityId', entityId, 'Invalid entity ID');
        }

        // We could also check if the entity exists in the ENTITIES table
        try {
            const sql = 'SELECT 1 FROM ENTITIES WHERE ID = ? LIMIT 1';
            const result = await this.executeQuery(sql, [entityId]);
            if (result.length === 0) {
                throw new ValidationError('entityId', entityId, `Entity with ID ${entityId} does not exist`);
            }
        } catch (error) {
            // Validation must fail when existence cannot be established.
            this.logger.warn('Could not validate entity existence', {
                operation: 'validate-entity-exists',
                entityId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Apply post-query filters that can't be done efficiently in SQL
     */
    private applyPostQueryFilters(effects: EffectsModel[], options: EffectSearchOptions): EffectsModel[] {
        let filteredEffects = effects;

        // Filter by category
        if (options.category !== undefined) {
            filteredEffects = filteredEffects.filter(effect => effect.getCategory() === options.category);
        }

        // Filter by recognition status
        if (options.recognizedOnly) {
            filteredEffects = filteredEffects.filter(effect => effect.isRecognizedEffect());
        }
        if (options.unrecognizedOnly) {
            filteredEffects = filteredEffects.filter(effect => !effect.isRecognizedEffect());
        }

        // Filter by combat effects
        if (options.affectsCombat !== undefined) {
            filteredEffects = filteredEffects.filter(effect => effect.affectsCombatPerformance() === options.affectsCombat);
        }

        // Filter by operation effects
        if (options.affectsOperation !== undefined) {
            filteredEffects = filteredEffects.filter(effect => effect.affectsShipOperation() === options.affectsOperation);
        }

        return filteredEffects;
    }

    /**
     * Clear effect-related caches
     */
    protected async clearEffectCaches(effectId?: number): Promise<void> {
        if (this.cacheManager) {
            await this.cacheManager.clear('effects:*');
            
            if (effectId) {
                await this.cacheManager.clear(`EFFECTS:by-id:${effectId}`);
            }
        }
    }

    /**
     * Override cache clearing to include effect-specific patterns
     */
    protected async clearCachesForTable(tableName: string): Promise<void> {
        await super.clearCachesForTable(tableName);
        await this.clearEffectCaches();
    }
}