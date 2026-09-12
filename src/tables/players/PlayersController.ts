/**
 * @fileoverview Players Controller
 * 
 * Controller for managing players in the PLAYERS table with advanced operations,
 * permission management, faction handling, and player analytics.
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
    PlayersModel,
    PlayerPermission,
    PlayerRole,
    type PlayerPermission as PlayerPermissionType
} from './PlayersModel.js';
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
 * Player search options
 */
export interface PlayerSearchOptions extends QueryOptions {
    /** Search by name or StarMade name */
    searchTerm?: string;
    /** Filter by faction */
    factionId?: number;
    /** Filter by permission level */
    hasPermission?: PlayerPermissionType;
    /** Filter by role */
    role?: PlayerRole;
    /** Include only active players */
    activeOnly?: boolean;
    /** Include only faction members */
    factionMembersOnly?: boolean;
}

/**
 * Player creation options
 */
export interface PlayerCreateOptions extends CreateOptions {
    /** Auto-generate ID if not provided */
    autoGenerateId?: boolean;
    /** Validate username uniqueness */
    validateUniqueness?: boolean;
    /** Send welcome message */
    sendWelcomeMessage?: boolean;
}

/**
 * Player update options
 */
export interface PlayerUpdateOptions extends UpdateOptions {
    /** Allow updating protected fields */
    allowProtectedFieldUpdates?: boolean;
    /** Log permission changes */
    logPermissionChanges?: boolean;
    /** Validate new faction membership */
    validateFactionMembership?: boolean;
}

/**
 * Faction transfer options
 */
export interface FactionTransferOptions {
    /** Force transfer even if player has assets */
    forceTransfer?: boolean;
    /** Transfer player assets to new faction */
    transferAssets?: boolean;
    /** Notify faction leaders */
    notifyLeaders?: boolean;
    /** Reason for transfer */
    reason?: string;
}

/**
 * Permission change options
 */
export interface PermissionChangeOptions {
    /** Player making the change */
    changedBy?: number;
    /** Reason for change */
    reason?: string;
    /** Log the change */
    logChange?: boolean;
    /** Notify affected player */
    notifyPlayer?: boolean;
}

/**
 * Player analytics options
 */
export interface PlayerAnalyticsOptions {
    /** Include detailed asset information */
    includeAssets?: boolean;
    /** Include relationship data */
    includeRelationships?: boolean;
    /** Include activity analysis */
    includeActivity?: boolean;
    /** Include influence assessment */
    includeInfluence?: boolean;
    /** Load all related data */
    loadFullProfile?: boolean;
}

/**
 * Bulk operation options for players
 */
export interface BulkPlayerOptions {
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
 * Player statistics result
 */
export interface PlayerStatistics {
    /** Total players */
    totalPlayers: number;
    /** Active players */
    activePlayers: number;
    /** Players in factions */
    factionsMembers: number;
    /** Players with officer permissions */
    officers: number;
    /** Players with admin permissions */
    admins: number;
    /** Average activity score */
    averageActivityScore: number;
    /** Most active faction */
    mostActiveFaction?: {
        id: number;
        memberCount: number;
        averageActivity: number;
    };
    /** Distribution by permission level */
    permissionDistribution: Record<string, number>;
}

// =============================================================================
// PLAYERS CONTROLLER
// =============================================================================

/**
 * Controller for PLAYERS table with advanced player management capabilities
 */
export class PlayersController extends BaseController<PlayersModel> {
    /** Model constructor used to map database rows and obtain the table schema. */
    protected ModelClass: ModelConstructor<PlayersModel> = PlayersModel;
    /** Controller name attached to logging and diagnostics. */
    protected controllerName = 'PlayersController';

    // =============================================================================
    // STATIC ID CACHE FOR PERFORMANCE OPTIMIZATION
    // =============================================================================

    /**
     * Static cache for the last used player ID to avoid redundant MAX(ID) queries
     * This cache is shared across all PlayersController instances for consistency
     */
    private static lastPlayerId: number | null = null;
    
    /**
     * Flag to track if the last ID cache has been initialized
     */
    private static isLastPlayerIdInitialized: boolean = false;

    /**
     * Create a new players controller
     */
    constructor(config: BaseControllerConfig = {}) {
        super({
            enableCaching: true,
            cacheTtlMs: 600000, // 10 minutes - players change frequently
            enableForeignKeyValidation: true,
            ...config
        });
    }

    /**
     * Override initialize to setup ID cache
     */
    public async initialize(manager: any): Promise<void> {
        await super.initialize(manager);
        
        // Pre-initialize the ID cache for better performance on first use
        try {
            await this.initializeLastPlayerIdCache();
        } catch (error: unknown) {
            // Don't fail initialization if ID cache setup fails
            // It will be initialized on first use
            this.logger.warn('Failed to pre-initialize player ID cache during initialization', {
                operation: 'initialize',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    // =============================================================================
    // OPTIMIZED EXISTENCE CHECKS (for efficient testing)
    // =============================================================================

    /**
     * Check if player exists by ID (optimized with SELECT 1)
     */
    public async playerExistsById(playerId: number): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM PLAYERS WHERE ID = ?';
        const params = [playerId];

        try {
            const result = await this.executeQuery(sql, params);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check player existence by ID', {
                operation: 'player-exists-by-id',
                playerId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Check if player exists by account name (optimized with SELECT 1)
     */
    public async playerExistsByName(name: string): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM PLAYERS WHERE LOWER(NAME) = ?';
        const params = [name.toLowerCase()];

        try {
            const result = await this.executeQuery(sql, params);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check player existence by name', {
                operation: 'player-exists-by-name',
                name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Check if player exists by StarMade name (optimized with SELECT 1)
     */
    public async playerExistsByStarMadeName(starMadeName: string): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM PLAYERS WHERE LOWER(STARMADE_NAME) = ?';
        const params = [starMadeName.toLowerCase()];

        try {
            const result = await this.executeQuery(sql, params);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check player existence by StarMade name', {
                operation: 'player-exists-by-starmade-name',
                starMadeName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Check if any players exist with multiple criteria (optimized with SELECT 1)
     */
    public async playersExist(options: PlayerSearchOptions = {}): Promise<boolean> {
        this.ensureInitialized();

        const {
            searchTerm,
            factionId,
            role,
            activeOnly = false,
            factionMembersOnly = false
        } = options;

        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [];

        if (searchTerm) {
            conditions.push('(LOWER(NAME) LIKE ? OR LOWER(STARMADE_NAME) LIKE ?)');
            const searchPattern = `%${searchTerm.toLowerCase()}%`;
            params.push(searchPattern, searchPattern);
        }

        if (factionId !== undefined) {
            conditions.push('FACTION = ?');
            params.push(factionId);
        }

        if (role !== undefined) {
            conditions.push('PERMISSION = ?');
            params.push(role);
        }

        if (activeOnly) {
            conditions.push('PERMISSION >= 0');
        }

        if (factionMembersOnly) {
            conditions.push('FACTION != 0');
        }

        // Build SQL query
        let sql = 'SELECT 1 FROM PLAYERS';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' LIMIT 1';

        try {
            const result = await this.executeQuery(sql, params);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check players existence', {
                operation: 'players-exist',
                options,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Check if faction members exist (optimized with SELECT 1)
     */
    public async factionMembersExist(factionId: number): Promise<boolean> {
        return await this.playersExist({ factionId });
    }

    /**
     * Check if independent players exist (optimized with SELECT 1)
     */
    public async independentPlayersExist(): Promise<boolean> {
        this.ensureInitialized();

        const sql = 'SELECT 1 FROM PLAYERS WHERE FACTION = 0 LIMIT 1';

        try {
            const result = await this.executeQuery(sql, []);
            return result.length > 0;
        } catch (error) {
            this.logger.error('Failed to check independent players existence', {
                operation: 'independent-players-exist',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, []);
        }
    }

    // =============================================================================
    // ENHANCED CRUD OPERATIONS
    // =============================================================================

    /**
     * Override: Create with player-specific validation
     */
    public async create(
        data: Partial<Record<string, any>>,
        options: PlayerCreateOptions = {}
    ): Promise<PlayersModel> {
        const {
            autoGenerateId = false,
            validateUniqueness = true,
            sendWelcomeMessage = false,
            ...baseOptions
        } = options;

        // Enhanced validation specific to players
        if (!data.NAME || !data.STARMADE_NAME) {
            throw new ValidationError('data', data, 'Both NAME and STARMADE_NAME are required');
        }

        // Check username uniqueness
        if (validateUniqueness) {
            await this.validateUsernameUniqueness(data.NAME as string, data.STARMADE_NAME as string);
        }

        // Auto-generate ID if needed
        if (autoGenerateId && !data.ID) {
            data.ID = await this.generatePlayerId();
        }

        // Set default values
        data.FACTION = data.FACTION ?? 0;
        data.PERMISSION = data.PERMISSION ?? PlayerRole.MEMBER;

        // Call parent create method
        const createdPlayer = await super.create(data, baseOptions);

        // Update the static last ID cache if we created a player with an explicit ID
        if (data.ID && typeof data.ID === 'number') {
            PlayersController.updateLastPlayerId(data.ID);
        }

        return createdPlayer;
    }

    /**
     * Override: Update with player-specific validation
     * Accepts player ID, NAME, or STARMADE_NAME as identifier
     */
    public async update(
        playerIdentifier: any,
        data: Partial<Record<string, any>>,
        options: PlayerUpdateOptions = {}
    ): Promise<PlayersModel> {
        const {
            allowProtectedFieldUpdates = false,
            logPermissionChanges = true,
            validateFactionMembership = true,
            ...baseOptions
        } = options;

        // Resolve player by ID, NAME, or STARMADE_NAME
        const currentPlayer = await this.resolvePlayer(playerIdentifier);
        if (!currentPlayer) {
            throw new ValidationError('playerIdentifier', playerIdentifier, `Player not found: ${playerIdentifier}`);
        }

        const playerId = currentPlayer.getId();

        // Check for protected field updates when not allowed
        if (!allowProtectedFieldUpdates) {
            const protectedFields = ['NAME', 'STARMADE_NAME', 'ID'];
            const updatingProtectedFields = protectedFields.filter(field => 
                data.hasOwnProperty(field) && data[field] !== undefined
            );
            
            if (updatingProtectedFields.length > 0) {
                throw new ValidationError(
                    'data', 
                    data, 
                    `Cannot update protected fields [${updatingProtectedFields.join(', ')}] when allowProtectedFieldUpdates is false`
                );
            }
        }

        // Enhanced validation specific to players
        if (data.NAME || data.STARMADE_NAME) {
            // Validate username uniqueness if changing names
            if (data.NAME && data.NAME !== currentPlayer.getName()) {

                const existingPlayer = await this.findPlayerByAccountName(data.NAME as string);
                if (existingPlayer && existingPlayer.getId() !== playerId) {
                    throw new ConflictError(`Player with name '${data.NAME}' already exists`);
                }
            }

            if (data.STARMADE_NAME && data.STARMADE_NAME !== currentPlayer.getStarmadeName()) {

                const existingPlayer = await this.findPlayerByStarMadeName(data.STARMADE_NAME as string);
                if (existingPlayer && existingPlayer.getId() !== playerId) {
                        throw new ConflictError(`Player with StarMade name '${data.STARMADE_NAME}' already exists`);
                }
            }
        }

        // Log permission changes if needed
        if (logPermissionChanges && data.PERMISSION !== undefined) {
            this.logger.info('Player permission changed via update', {
                operation: 'update-player',
                playerId,
                playerName: currentPlayer.getName(),
                oldPermission: currentPlayer.getPermission(),
                newPermission: data.PERMISSION
            });
        }

        // Call parent update method with resolved ID
        return await super.update(playerId, data, { returnRecord: true, ...baseOptions });
    }

    /**
     * Override: Delete with player-specific validation
     * Accepts player ID, NAME, or STARMADE_NAME as identifier
     */
    public async delete(
        playerIdentifier: any,
        options: DeleteOptions = {}
    ): Promise<boolean> {
        this.ensureInitialized();

        // Resolve player by ID, NAME, or STARMADE_NAME
        const player = await this.resolvePlayer(playerIdentifier);
        if (!player) {
            return false; // Player doesn't exist
        }

        const playerId = player.getId();

        // Log player deletion
        this.logger.info('Player deletion initiated', {
            operation: 'delete-player',
            playerId,
            playerName: player.getName(),
            starMadeName: player.getStarmadeName(),
            faction: player.getFaction()
        });

        // Call parent delete method with resolved ID
        const result = await super.delete(playerId, options);

        if (result) {
            this.logger.info('Player deleted successfully', {
                operation: 'delete-player',
                playerId,
                playerName: player.getName()
            });

            // Note: We don't need to update the cache on deletion since we only track the max ID
            // and deletions don't affect the maximum ID value
        }

        return result;
    }

    /**
     * Find players with advanced search capabilities
     */
    public async findPlayers(options: PlayerSearchOptions = {}): Promise<PlayersModel[]> {
        this.validateQueryOptions(options);
        this.ensureInitialized();

        const {
            searchTerm,
            factionId,
            hasPermission,
            role,
            activeOnly = false,
            factionMembersOnly = false,
            ...queryOptions
        } = options;

        // Build WHERE conditions
        const conditions: string[] = [];
        const params: any[] = [];

        if (searchTerm) {
            conditions.push('(LOWER(NAME) LIKE ? OR LOWER(STARMADE_NAME) LIKE ?)');
            const searchPattern = `%${searchTerm.toLowerCase()}%`;
            params.push(searchPattern, searchPattern);
        }

        if (factionId !== undefined) {
            conditions.push('FACTION = ?');
            params.push(factionId);
        }

        if (role !== undefined) {
            conditions.push('PERMISSION = ?');
            params.push(role);
        }

        if (activeOnly) {
            conditions.push('PERMISSION >= 0'); // Assuming negative permissions indicate inactive
        }

        if (factionMembersOnly) {
            conditions.push('FACTION != 0');
        }

        // Build cache key
        const cacheKey = `players:search:${JSON.stringify(options)}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
            const cached = await this.cacheManager.get<Record<string, any>[]>(cacheKey);
            if (cached) {
                this.logger.debug('Players retrieved from cache', {
                    operation: 'find-players',
                    count: cached.length,
                    searchTerm,
                    factionId
                });
                return PlayersModel.fromRows(cached);
            }
        }

        // Build SQL query
        let sql = 'SELECT * FROM PLAYERS';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        // Add ordering
        if (queryOptions.orderBy) {
            sql += ` ORDER BY ${queryOptions.orderBy} ${queryOptions.orderDirection || 'ASC'}`;
        } else {
            sql += ' ORDER BY STARMADE_NAME ASC';
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
            const players = PlayersModel.fromRows(result);

            // Cache result
            if (this.cacheManager && this.config.enableCaching && !queryOptions.skipCache) {
                await this.cacheManager.set(cacheKey, result, {
                    ttl: queryOptions.cacheTtl || this.config.cacheTtlMs
                });
            }

            this.logger.debug('Players retrieved from database', {
                operation: 'find-players',
                count: players.length,
                searchTerm,
                factionId
            });

            return players;
        } catch (error) {
            this.logger.error('Failed to find players', {
                operation: 'find-players',
                options,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a player by exact account name only (not StarMade name)
     */
    public async findPlayerByAccountName(name: string): Promise<PlayersModel | null> {
        this.ensureInitialized();

        const sql = 'SELECT * FROM PLAYERS WHERE LOWER(NAME) = ?';
        const params = [name.toLowerCase()];

        try {
            const result = await this.executeQuery(sql, params);
            return result.length > 0 ? PlayersModel.fromRow(result[0]) : null;
        } catch (error) {
            this.logger.error('Failed to find player by account name', {
                operation: 'find-player-by-account-name',
                name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a player by exact StarMade name only (not account name)
     */
    public async findPlayerByStarMadeName(starMadeName: string): Promise<PlayersModel | null> {
        this.ensureInitialized();

        const sql = 'SELECT * FROM PLAYERS WHERE LOWER(STARMADE_NAME) = ?';
        const params = [starMadeName.toLowerCase()];

        try {
            const result = await this.executeQuery(sql, params);
            return result.length > 0 ? PlayersModel.fromRow(result[0]) : null;
        } catch (error) {
            this.logger.error('Failed to find player by StarMade name', {
                operation: 'find-player-by-starmade-name',
                starMadeName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find a player by name (login or StarMade name) - optimized with caching
     */
    public async findPlayerByName(name: string): Promise<PlayersModel | null> {
        this.ensureInitialized();

        // Build cache key
        const cacheKey = `players:by-name:${name.toLowerCase()}`;

        // Try cache first
        if (this.cacheManager && this.config.enableCaching) {
            const cached = await this.cacheManager.get<Record<string, any>>(cacheKey);
            if (cached) {
                this.logger.debug('Player retrieved from cache by name', {
                    operation: 'find-player-by-name',
                    name,
                    cached: true
                });
                return PlayersModel.fromRow(cached);
            }
        }

        const sql = 'SELECT * FROM PLAYERS WHERE LOWER(NAME) = ? OR LOWER(STARMADE_NAME) = ?';
        const params = [name.toLowerCase(), name.toLowerCase()];

        try {
            const result = await this.executeQuery(sql, params);
            const player = result.length > 0 ? PlayersModel.fromRow(result[0]) : null;

            // Cache result if player found
            if (player && this.cacheManager && this.config.enableCaching) {
                await this.cacheManager.set(cacheKey, result[0], {
                    ttl: this.config.cacheTtlMs
                });
            }

            this.logger.debug('Player retrieved from database by name', {
                operation: 'find-player-by-name',
                name,
                found: !!player,
                cached: false
            });

            return player;
        } catch (error) {
            this.logger.error('Failed to find player by name', {
                operation: 'find-player-by-name',
                name,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Find players by faction
     */
    public async findPlayersByFaction(factionId: number, options: QueryOptions = {}): Promise<PlayersModel[]> {
        return await this.findPlayers({
            factionId,
            ...options
        });
    }

    /**
     * Find players with specific permission
     */
    public async findPlayersWithPermission(
        permission: PlayerPermissionType,
        options: QueryOptions = {}
    ): Promise<PlayersModel[]> {
        // Get all players and filter in memory since HSQLDB doesn't support bitwise operations well
        const allPlayers = await this.findPlayers(options);
        
        return allPlayers.filter(player => player.hasPermission(permission));
    }

    // =============================================================================
    // PERMISSION MANAGEMENT
    // =============================================================================

    /**
     * Grant permission to a player
     */
    public async grantPermission(
        playerIdentifier: number | string,
        permission: PlayerPermissionType,
        options: PermissionChangeOptions = {}
    ): Promise<PlayersModel> {
        this.ensureInitialized();

        // Validate permission change options
        if (options.changedBy !== undefined) {
            if (typeof options.changedBy !== 'number' || options.changedBy < 0) {
                throw new ValidationError('changedBy', options.changedBy, 'Invalid changedBy ID - must be a positive number');
            }
        }

        if (options.reason !== undefined && options.reason !== null) {
            if (typeof options.reason !== 'string' || options.reason.trim().length === 0) {
                throw new ValidationError('reason', options.reason, 'Reason must be a non-empty string when provided');
            }
        } else {
            // Require reason for permission changes
            throw new ValidationError('reason', options.reason, 'Reason is required for permission changes');
        }

        const player = await this.resolvePlayer(playerIdentifier);
        if (!player) {
            throw new ValidationError('playerIdentifier', playerIdentifier, `Player not found: ${playerIdentifier}`);
        }

        const playerId = player.getId();
        const oldPermissions = player.getPermission();
        player.grantPermission(permission);
        const newPermissions = player.getPermission();

        if (oldPermissions === newPermissions) {
            return player; // Already has permission
        }

        const updatedPlayer = await this.update(playerId, {
            PERMISSION: newPermissions
        }, {
            returnRecord: true
        } as PlayerUpdateOptions);

        this.logger.info('Permission granted to player', {
            operation: 'grant-permission',
            playerId,
            playerName: player.getName(),
            permission,
            oldPermissions,
            newPermissions,
            changedBy: options.changedBy,
            reason: options.reason
        });

        return updatedPlayer;
    }

    /**
     * Revoke permission from a player
     */
    public async revokePermission(
        playerIdentifier: number | string,
        permission: PlayerPermissionType,
        options: PermissionChangeOptions = {}
    ): Promise<PlayersModel> {
        this.ensureInitialized();

        // Validate permission change options
        if (options.changedBy !== undefined) {
            if (typeof options.changedBy !== 'number' || options.changedBy < 0) {
                throw new ValidationError('changedBy', options.changedBy, 'Invalid changedBy ID - must be a positive number');
            }
        }

        if (options.reason !== undefined && options.reason !== null) {
            if (typeof options.reason !== 'string' || options.reason.trim().length === 0) {
                throw new ValidationError('reason', options.reason, 'Reason must be a non-empty string when provided');
            }
        } else {
            // Require reason for permission changes
            throw new ValidationError('reason', options.reason, 'Reason is required for permission changes');
        }

        const player = await this.resolvePlayer(playerIdentifier);
        if (!player) {
            throw new ValidationError('playerIdentifier', playerIdentifier, `Player not found: ${playerIdentifier}`);
        }

        const playerId = player.getId();
        const oldPermissions = player.getPermission();
        player.revokePermission(permission);
        const newPermissions = player.getPermission();

        if (oldPermissions === newPermissions) {
            return player; // Didn't have permission
        }

        const updatedPlayer = await this.update(playerId, {
            PERMISSION: newPermissions
        }, {
            returnRecord: true
        });

        this.logger.info('Permission revoked from player', {
            operation: 'revoke-permission',
            playerId,
            playerName: player.getName(),
            permission,
            oldPermissions,
            newPermissions,
            changedBy: options.changedBy,
            reason: options.reason
        });

        return updatedPlayer;
    }

    /**
     * Set player role (replaces all permissions)
     */
    public async setPlayerRole(
        playerIdentifier: number | string,
        role: PlayerRole,
        options: PermissionChangeOptions = {}
    ): Promise<PlayersModel> {
        this.ensureInitialized();

        // Validate permission change options
        if (options.changedBy !== undefined) {
            if (typeof options.changedBy !== 'number' || options.changedBy < 0) {
                throw new ValidationError('changedBy', options.changedBy, 'Invalid changedBy ID - must be a positive number');
            }
        }

        if (options.reason !== undefined && options.reason !== null) {
            if (typeof options.reason !== 'string' || options.reason.trim().length === 0) {
                throw new ValidationError('reason', options.reason, 'Reason must be a non-empty string when provided');
            }
        } else {
            // Require reason for permission changes
            throw new ValidationError('reason', options.reason, 'Reason is required for permission changes');
        }

        const player = await this.resolvePlayer(playerIdentifier);
        if (!player) {
            throw new ValidationError('playerIdentifier', playerIdentifier, `Player not found: ${playerIdentifier}`);
        }

        const playerId = player.getId();
        const oldPermissions = player.getPermission();
        const oldRole = player.getRole();

        const updatedPlayer = await this.update(playerId, {
            PERMISSION: role
        }, {
            returnRecord: true
        } as PlayerUpdateOptions);

        this.logger.info('Player role changed', {
            operation: 'set-player-role',
            playerId,
            playerName: player.getName(),
            oldRole,
            newRole: PlayerRole[role],
            oldPermissions,
            newPermissions: role,
            changedBy: options.changedBy,
            reason: options.reason
        });

        return updatedPlayer;
    }

    /**
     * Promote player to next role level
     */
    public async promotePlayer(
        playerIdentifier: number | string,
        options: PermissionChangeOptions = {}
    ): Promise<PlayersModel> {
        this.ensureInitialized();

        const player = await this.resolvePlayer(playerIdentifier);
        if (!player) {
            throw new ValidationError('playerIdentifier', playerIdentifier, `Player not found: ${playerIdentifier}`);
        }

        const currentPermissions = player.getPermission();
        let newRole: PlayerRole;

        switch (currentPermissions) {
            case PlayerRole.MEMBER:
                newRole = PlayerRole.COMMANDER;
                break;
            case PlayerRole.COMMANDER:
                newRole = PlayerRole.CAPTAIN;
                break;
            case PlayerRole.CAPTAIN:
                newRole = PlayerRole.FULL_CONTROL;
                break;
            case PlayerRole.FULL_CONTROL:
                throw new ValidationError('permission', currentPermissions, 'Player already has maximum role');
            default:
                throw new ValidationError('permission', currentPermissions, 'Player has custom permissions, cannot auto-promote');
        }

        return await this.setPlayerRole(player.getId(), newRole, options);
    }

    /**
     * Demote player to previous role level
     */
    public async demotePlayer(
        playerIdentifier: number | string,
        options: PermissionChangeOptions = {}
    ): Promise<PlayersModel> {
        this.ensureInitialized();

        const player = await this.resolvePlayer(playerIdentifier);
        if (!player) {
            throw new ValidationError('playerIdentifier', playerIdentifier, `Player not found: ${playerIdentifier}`);
        }

        const currentPermissions = player.getPermission();
        let newRole: PlayerRole;

        switch (currentPermissions) {
            case PlayerRole.FULL_CONTROL:
                newRole = PlayerRole.CAPTAIN;
                break;
            case PlayerRole.CAPTAIN:
                newRole = PlayerRole.COMMANDER;
                break;
            case PlayerRole.COMMANDER:
                newRole = PlayerRole.MEMBER;
                break;
            case PlayerRole.MEMBER:
                throw new ValidationError('permission', currentPermissions, 'Player already has minimum role');
            default:
                throw new ValidationError('permission', currentPermissions, 'Player has custom permissions, cannot auto-demote');
        }

        return await this.setPlayerRole(player.getId(), newRole, options);
    }

    // =============================================================================
    // FACTION MANAGEMENT
    // =============================================================================

    /**
     * Transfer player to a new faction
     */
    public async transferToFaction(
        playerIdentifier: number | string,
        newFactionId: number,
        options: FactionTransferOptions = {}
    ): Promise<PlayersModel> {
        this.ensureInitialized();

        const player = await this.resolvePlayer(playerIdentifier);
        if (!player) {
            throw new ValidationError('playerIdentifier', playerIdentifier, `Player not found: ${playerIdentifier}`);
        }

        const playerId = player.getId();
        const oldFactionId = player.getFaction();
        
        if (oldFactionId === newFactionId) {
            return player; // Already in target faction
        }

        // Reset permissions when changing faction (except for admins)
        let newPermissions = player.getPermission();
        if (!player.isAdmin()) {
            newPermissions = PlayerRole.MEMBER;
        }

        const updatedPlayer = await this.update(playerId, {
            FACTION: newFactionId,
            PERMISSION: newPermissions
        }, {
            returnRecord: true
        } as PlayerUpdateOptions);

        this.logger.info('Player transferred to new faction', {
            operation: 'transfer-to-faction',
            playerId,
            playerName: player.getName(),
            oldFactionId,
            newFactionId,
            oldPermissions: player.getPermission(),
            newPermissions,
            reason: options.reason
        });

        return updatedPlayer;
    }

    /**
     * Remove player from faction
     */
    public async leaveFaction(
        playerIdentifier: number | string,
        options: PermissionChangeOptions = {}
    ): Promise<PlayersModel> {
        return await this.transferToFaction(playerIdentifier, 0, {
            reason: options.reason || 'Player left faction'
        });
    }

    /**
     * Get faction leaders
     */
    public async getFactionLeaders(factionId: number): Promise<PlayersModel[]> {
        // Leaders have FULL_CONTROL role or higher permissions
        return await this.findPlayers({
            factionId,
            role: PlayerRole.FULL_CONTROL
        });
    }

    /**
     * Get faction officers
     */
    public async getFactionOfficers(factionId: number): Promise<PlayersModel[]> {
        // Officers have COMMANDER role or higher
        const officers = await this.findPlayers({
            factionId,
            orderBy: 'PERMISSION',
            orderDirection: 'DESC'
        });
        
        // Filter to only include officers (COMMANDER and above)
        return officers.filter(officer => 
            officer.getPermission() >= PlayerRole.COMMANDER
        );
    }

    // =============================================================================
    // ANALYTICS AND REPORTING
    // =============================================================================

    /**
     * Get comprehensive player analytics
     */
    public async getPlayerAnalytics(
        playerIdentifier: number | string,
        options: PlayerAnalyticsOptions = {}
    ): Promise<ReturnType<PlayersModel['generatePlayerProfile']>> {
        this.ensureInitialized();

        const player = await this.resolvePlayer(playerIdentifier);
        if (!player) {
            throw new ValidationError('playerIdentifier', playerIdentifier, `Player not found: ${playerIdentifier}`);
        }

        const {
            includeAssets = false,
            includeRelationships = false,
            includeActivity = false,
            includeInfluence = false,
            loadFullProfile = false
        } = options;

        // Load relationships if requested
        if (loadFullProfile || includeRelationships) {
            // Note: In a real implementation, we would load the actual relationships
            // For now, we'll work with what the model provides
        }

        const profile = player.generatePlayerProfile();

        this.logger.debug('Player analytics generated', {
            operation: 'get-player-analytics',
            playerId: player.getId(),
            playerName: player.getName(),
            options,
            hasAssets: profile.relationshipStatus.hasAllAssetsLoaded,
            overallRating: profile.overallRating
        });

        return profile;
    }

    /**
     * Get player statistics
     */
    public async getPlayerStatistics(): Promise<PlayerStatistics> {
        this.ensureInitialized();

        // Simplified statistics query compatible with HSQLDB
        const basicStatsSql = `
            SELECT 
                COUNT(*) as "total_players",
                SUM(CASE WHEN PERMISSION >= 0 THEN 1 ELSE 0 END) as "active_players",
                SUM(CASE WHEN FACTION != 0 THEN 1 ELSE 0 END) as "faction_members"
            FROM PLAYERS
        `;

        // Separate query for officers
        const officersSql = `
            SELECT COUNT(*) as "officer_count"
            FROM PLAYERS 
            WHERE PERMISSION IN (?, ?)
        `;

        // Separate query for admins  
        const adminsSql = `
            SELECT COUNT(*) as "admin_count"
            FROM PLAYERS 
            WHERE PERMISSION >= ?
        `;

        try {
            // Get basic statistics
            const basicStatsResult = await this.executeQuery(basicStatsSql, []);
            const basicStats = basicStatsResult[0];

            // Convert strings to numbers (HSQLDB returns strings)
            const totalPlayers = parseInt(basicStats.total_players || '0', 10);
            const activePlayers = parseInt(basicStats.active_players || '0', 10);
            const factionsMembers = parseInt(basicStats.faction_members || '0', 10);

            // Get officer count
            const officersResult = await this.executeQuery(officersSql, [PlayerRole.COMMANDER, PlayerRole.CAPTAIN]);
            const officers = parseInt(officersResult[0]?.officer_count || '0', 10);

            // Get admin count (full control + admin permissions)
            const adminsResult = await this.executeQuery(adminsSql, [PlayerRole.FULL_CONTROL]);
            const admins = parseInt(adminsResult[0]?.admin_count || '0', 10);

            // Get faction statistics
            const factionSql = `
                SELECT 
                    FACTION,
                    COUNT(*) as "member_count"
                FROM PLAYERS 
                WHERE FACTION != 0 
                GROUP BY FACTION 
                ORDER BY "member_count" DESC 
                LIMIT 1
            `;

            let mostActiveFaction = undefined;
            try {
                const factionResult = await this.executeQuery(factionSql, []);
                if (factionResult.length > 0) {
                    mostActiveFaction = {
                        id: parseInt(factionResult[0].FACTION || '0', 10),
                        memberCount: parseInt(factionResult[0].member_count || '0', 10),
                        averageActivity: 1.0 // Placeholder since we don't have activity data
                    };
                }
            } catch (error) {
                this.logger.warn('Failed to get faction statistics', {
                    operation: 'get-faction-stats',
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            const stats: PlayerStatistics = {
                totalPlayers,
                activePlayers,
                factionsMembers,
                officers,
                admins,
                averageActivityScore: totalPlayers > 0 ? factionsMembers / totalPlayers : 0,
                permissionDistribution: {
                    [PlayerRole.MEMBER]: totalPlayers - officers - admins,
                    [PlayerRole.COMMANDER]: Math.floor(officers * 0.6), // Estimate
                    [PlayerRole.CAPTAIN]: Math.floor(officers * 0.4), // Estimate  
                    [PlayerRole.FULL_CONTROL]: admins
                },
                mostActiveFaction
            };

            this.logger.info('Player statistics generated', {
                operation: 'get-player-statistics',
                statistics: stats
            });

            return stats;
        } catch (error) {
            this.logger.error('Failed to get player statistics', {
                operation: 'get-player-statistics',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(basicStatsSql, error, []);
        }
    }

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Bulk create players (overrides BaseController bulkCreate)
     */
    public async bulkCreate(
        playersData: Array<Partial<Record<string, any>>>,
        options: BulkPlayerOptions = {}
    ): Promise<BulkOperationResult> {
        this.ensureInitialized();

        const {
            skipValidation = false,
            continueOnError = true,
            batchSize = 100,
            logOperations = false
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

        // Initialize ID cache before bulk operations to avoid repeated database queries
        if (!PlayersController.isLastPlayerIdInitialized) {
            await this.initializeLastPlayerIdCache();
        }

        // Process in batches
        batches: for (let i = 0; i < playersData.length; i += batchSize) {
            const batch = playersData.slice(i, i + batchSize);
            
            for (let j = 0; j < batch.length; j++) {
                const playerData = batch[j];
                const index = i + j;
                
                try {
                    const createdPlayer = await this.create(playerData, {
                        skipValidation,
                        validateUniqueness: !skipValidation
                    } as PlayerCreateOptions);
                    
                    result.success++;
                    
                    if (logOperations) {
                        this.logger.debug('Bulk create player success', {
                            operation: 'bulk-create-players',
                            index,
                            playerId: createdPlayer.getId(),
                            playerData
                        });
                    }
                } catch (error: unknown) {
                    result.failed++;
                    result.errors.push({
                        index,
                        error: error instanceof Error ? error.message : String(error),
                        data: playerData
                    });
                    
                    if (!continueOnError) {
                        break batches;
                    }
                }
            }
        }

        this.logger.info('Bulk create players completed', {
            operation: 'bulk-create-players',
            totalItems: playersData.length,
            finalCachedId: PlayersController.getLastPlayerIdFromCache(),
            result
        });

        return result;
    }

    /**
     * Bulk delete players
     */
    public async bulkDelete(
        playerIdentifiers: Array<number | string>,
        options: BulkPlayerOptions = {}
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

        for (let i = 0; i < playerIdentifiers.length; i++) {
            const playerIdentifier = playerIdentifiers[i];
            
            try {
                const deleted = await this.delete(playerIdentifier);
                
                if (deleted) {
                    result.success++;
                } else {
                    result.skipped++;
                }
                
                if (logOperations) {
                    this.logger.debug('Bulk delete player success', {
                        operation: 'bulk-delete-players',
                        playerIdentifier,
                        deleted
                    });
                }
            } catch (error) {
                result.failed++;
                result.errors.push({
                    index: i,
                    error: error instanceof Error ? error.message : String(error),
                    data: { playerIdentifier }
                });
                
                if (!continueOnError) {
                    break;
                }
            }
        }

        this.logger.info('Bulk delete players completed', {
            operation: 'bulk-delete-players',
            totalItems: playerIdentifiers.length,
            result
        });

        return result;
    }

    /**
     * Bulk update player permissions
     */
    public async bulkUpdatePermissions(
        playerIds: number[],
        newPermissions: PlayerPermissionType,
        options: BulkPlayerOptions = {}
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

        for (let i = 0; i < playerIds.length; i++) {
            const playerId = playerIds[i];
            
            try {
                await this.update(playerId, {
                    PERMISSION: newPermissions
                });
                
                result.success++;
                
                if (logOperations) {
                    this.logger.debug('Bulk update permissions success', {
                        operation: 'bulk-update-permissions',
                        playerId,
                        newPermissions
                    });
                }
            } catch (error) {
                result.failed++;
                result.errors.push({
                    index: i,
                    error: error instanceof Error ? error.message : String(error),
                    data: { playerId, newPermissions }
                });
                
                if (!continueOnError) {
                    break;
                }
            }
        }

        this.logger.info('Bulk update permissions completed', {
            operation: 'bulk-update-permissions',
            totalItems: playerIds.length,
            newPermissions,
            result
        });

        return result;
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Get total player count (optimized for testing)
     */
    public async getTotalPlayerCount(): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) as "total_count" FROM PLAYERS';

        try {
            const result = await this.executeQuery(sql, []);
            return parseInt(result[0]?.total_count || '0', 10);
        } catch (error) {
            this.logger.error('Failed to get total player count', {
                operation: 'get-total-player-count',
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, []);
        }
    }

    /**
     * Get faction member count (optimized for testing)
     */
    public async getFactionMemberCount(factionId: number): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) as "member_count" FROM PLAYERS WHERE FACTION = ?';
        const params = [factionId];

        try {
            const result = await this.executeQuery(sql, params);
            return parseInt(result[0]?.member_count || '0', 10);
        } catch (error) {
            this.logger.error('Failed to get faction member count', {
                operation: 'get-faction-member-count',
                factionId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Get players count by permission level (optimized for testing)
     */
    public async getPlayerCountByPermission(permission: PlayerRole): Promise<number> {
        this.ensureInitialized();

        const sql = 'SELECT COUNT(*) as "permission_count" FROM PLAYERS WHERE PERMISSION = ?';
        const params = [permission];

        try {
            const result = await this.executeQuery(sql, params);
            return parseInt(result[0]?.permission_count || '0', 10);
        } catch (error) {
            this.logger.error('Failed to get player count by permission', {
                operation: 'get-player-count-by-permission',
                permission,
                error: error instanceof Error ? error.message : String(error)
            });
            throw ErrorFactory.createQueryError(sql, error, params);
        }
    }

    /**
     * Validate username uniqueness (optimized with SELECT 1)
     */
    private async validateUsernameUniqueness(name: string, starMadeName: string): Promise<void> {
        // Check account name uniqueness with optimized query
        const nameExists = await this.playerExistsByName(name);
        if (nameExists) {
            throw new ConflictError(`Player with name '${name}' already exists`);
        }

        // Check StarMade name uniqueness with optimized query
        const starMadeNameExists = await this.playerExistsByStarMadeName(starMadeName);
        if (starMadeNameExists) {
            throw new ConflictError(`Player with StarMade name '${starMadeName}' already exists`);
        }
    }

    /**
     * Generate a unique player ID - optimized with static cache
     */
    private async generatePlayerId(): Promise<number> {
        // Initialize the cache if needed
        if (!PlayersController.isLastPlayerIdInitialized) {
            await this.initializeLastPlayerIdCache();
        }

        // Increment and return the next available ID
        if (PlayersController.lastPlayerId !== null) {
            PlayersController.lastPlayerId++;
            
            this.logger.debug('Generated player ID from cache', {
                operation: 'generate-player-id',
                generatedId: PlayersController.lastPlayerId,
                fromCache: true
            });
            
            return PlayersController.lastPlayerId;
        }

        // Fallback to database query if cache is not available
        return await this.generatePlayerIdFromDatabase();
    }

    /**
     * Initialize the last player ID cache by querying the database
     */
    private async initializeLastPlayerIdCache(): Promise<void> {
        try {
            const sql = 'SELECT MAX(ID) as "max_id" FROM PLAYERS';
            const result = await this.executeQuery(sql, []);
            const maxId = result.length > 0 && result[0].max_id ? parseInt(result[0].max_id, 10) : 0;
            
            PlayersController.lastPlayerId = maxId;
            PlayersController.isLastPlayerIdInitialized = true;
            
            this.logger.debug('Initialized last player ID cache', {
                operation: 'initialize-last-player-id-cache',
                lastPlayerId: PlayersController.lastPlayerId
            });
            
        } catch (error: unknown) {
            this.logger.error('Failed to initialize last player ID cache', {
                operation: 'initialize-last-player-id-cache',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Fallback method to generate player ID from database (when cache fails)
     */
    private async generatePlayerIdFromDatabase(): Promise<number> {
        const sql = 'SELECT MAX(ID) as "max_id" FROM PLAYERS';
        
        try {
            const result = await this.executeQuery(sql, []);
            const maxId = result.length > 0 && result[0].max_id ? parseInt(result[0].max_id, 10) : 0;
            const newId = maxId + 1;
            
            // Update cache with the new ID
            PlayersController.updateLastPlayerId(newId);
            
            this.logger.debug('Generated player ID from database (fallback)', {
                operation: 'generate-player-id-from-database',
                generatedId: newId,
                fromCache: false
            });
            
            return newId;
            
        } catch (error: unknown) {
            this.logger.error('Failed to generate player ID from database', {
                operation: 'generate-player-id-from-database',
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Update the static last player ID cache
     */
    private static updateLastPlayerId(newId: number): void {
        if (PlayersController.lastPlayerId === null || newId > PlayersController.lastPlayerId) {
            PlayersController.lastPlayerId = newId;
            PlayersController.isLastPlayerIdInitialized = true;
        }
    }

    /**
     * Reset the static ID cache (useful for testing or when database is reset)
     */
    public static resetLastPlayerIdCache(): void {
        PlayersController.lastPlayerId = null;
        PlayersController.isLastPlayerIdInitialized = false;
    }

    /**
     * Get the current cached last player ID (for debugging/testing)
     */
    public static getLastPlayerIdFromCache(): number | null {
        return PlayersController.lastPlayerId;
    }

    /**
     * Clear player-related caches
     */
    protected async clearPlayerCaches(playerId?: number): Promise<void> {
        if (this.cacheManager) {
            await this.cacheManager.clear('players:*');
            
            if (playerId) {
                await this.cacheManager.clear(`PLAYERS:by-id:${playerId}`);
            }
        }
    }

    /**
     * Override cache clearing to include player-specific patterns
     */
    protected async clearCachesForTable(tableName: string): Promise<void> {
        await super.clearCachesForTable(tableName);
        await this.clearPlayerCaches();
    }

    /**
     * Resolve player by ID, NAME, or STARMADE_NAME (optimized with existence checks)
     */
    private async resolvePlayer(identifier: any): Promise<PlayersModel | null> {
        // If identifier is a number, try by ID first
        if (typeof identifier === 'number') {
            const player = await this.findById(identifier);
            if (player) return player;
        }

        // If identifier is a string, try by NAME and STARMADE_NAME
        if (typeof identifier === 'string') {
            // If identifier looks like a number but is a string, try parsing it first
            if (/^\d+$/.test(identifier)) {
                const playerId = parseInt(identifier, 10);
                if (!isNaN(playerId)) {
                    const player = await this.findById(playerId);
                    if (player) return player;
                }
            }

            // Try by name
            const player = await this.findPlayerByName(identifier);
            if (player) return player;
        }

        return null;
    }
}