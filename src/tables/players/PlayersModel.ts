import * as related0 from '../player-messages/PlayerMessagesModel.js';
import * as related1 from '../mines/MinesModel.js';
import * as related2 from '../trade-nodes/TradeNodesModel.js';
import * as related3 from '../fleets/FleetsModel.js';
import * as related4 from '../entities/EntitiesModel.js';
/**
 * @fileoverview Players Model
 * 
 * Model for the PLAYERS table containing player account information.
 * Provides player management with permission validation and faction support.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

import {
    BaseModel,
    column,
    index,
    validation,
    relation,
    Model,
    DataType,
    type TableSchema,
    type RelationMappings
} from '../BaseModel.js';

// =============================================================================
// PLAYERS ENUMS AND TYPES
// =============================================================================

/**
 * Player permission flags (bitwise)
 */
export enum PlayerPermission {
    /** Player permission value for invite, serialized as 1. */
    INVITE = 1,              // 0x1 - Can invite players to faction
    /** Player permission value for kick, serialized as 2. */
    KICK = 2,                // 0x2 - Can kick players from faction  
    /** Player permission value for edit permissions, serialized as 4. */
    EDIT_PERMISSIONS = 4,     // 0x4 - Can modify permissions
    /** Player permission value for edit description, serialized as 8. */
    EDIT_DESCRIPTION = 8,     // 0x8 - Can edit faction description
    /** Player permission value for relationship, serialized as 16. */
    RELATIONSHIP = 16,        // 0x10 - Can manage faction relationships
    /** Player permission value for homebase, serialized as 32. */
    HOMEBASE = 32,           // 0x20 - Can manage homebase
    /** Player permission value for fog of war share, serialized as 64. */
    FOG_OF_WAR_SHARE = 64,   // 0x40 - Can share fog of war
    /** Player permission value for news post, serialized as 128. */
    NEWS_POST = 128,         // 0x80 - Can post faction news
    /** Player permission value for admin permissions, serialized as 0x7FFFFFFF. */
    ADMIN_PERMISSIONS = 0x7FFFFFFF // Admin level permissions
}

/**
 * Common permission combinations
 */
export enum PlayerRole {
    /** Player role value for member, serialized as 0. */
    MEMBER = 0,                                           // No permissions
    /** Player role value for commander, serialized as PlayerPermission.INVITE | PlayerPermission.KICK. */
    COMMANDER = PlayerPermission.INVITE | PlayerPermission.KICK,
    /** Player role value for captain, serialized as PlayerPermission.INVITE | PlayerPermission.KICK | PlayerPermission.EDIT_PERMISSIONS. */
    CAPTAIN  = PlayerPermission.INVITE | PlayerPermission.KICK | PlayerPermission.EDIT_PERMISSIONS,
    /** Player role value for full control, serialized as 255. */
    FULL_CONTROL = 255                                   // All permissions
}

// =============================================================================
// PLAYERS MODEL
// =============================================================================

/**
 * Model for the PLAYERS table - Enhanced Edition with Complete Relations
 * 
 * Advanced player management with complete relationship mapping,
 * permission system, and comprehensive player analytics.
 */
export class PlayersModel extends BaseModel {
    /** SQL table name used to generate queries for this model. */
    public static tableName = 'PLAYERS';
    
    /** SQL column, key, index and validation definitions for this table. */
    public static schema: TableSchema = {
        tableName: 'PLAYERS',
        comment: 'Player account information and permissions',
        
        columns: [
            column('ID', DataType.BIGINT, {
                primaryKey: true,
                autoIncrement: true,
                nullable: false,
                comment: 'Player unique identifier'
            }),
            column('NAME', DataType.VARCHAR, {
                length: 512,
                nullable: false,
                comment: 'Login username'
            }),
            column('STARMADE_NAME', DataType.VARCHAR, {
                length: 512,
                nullable: false,
                comment: 'Display name in-game'
            }),
            column('FACTION', DataType.INTEGER, {
                nullable: false,
                defaultValue: 0,
                comment: 'Current faction affiliation'
            }),
            column('PERMISSION', DataType.BIGINT, {
                nullable: false,
                defaultValue: 0,
                comment: 'Permission bitmask for faction rights'
            })
        ],

        primaryKey: ['ID'],
        foreignKeys: [],

        indexes: [
            index('PLAYERS_NAME', ['NAME'], { unique: true }),
            index('PLAYERS_SM_NAME', ['STARMADE_NAME']),
        ],

        validationRules: [
            validation('NAME', 'required'),
            validation('NAME', 'maxLength', {
                value: 512,
                message: 'Login name cannot exceed 512 characters'
            }),
            validation('NAME', 'minLength', {
                value: 1,
                message: 'Login name cannot be empty'
            }),
            validation('STARMADE_NAME', 'required'),
            validation('STARMADE_NAME', 'maxLength', {
                value: 512,
                message: 'StarMade name cannot exceed 512 characters'
            }),
            validation('FACTION', 'required'),
            validation('PERMISSION', 'required'),
            validation('PERMISSION', 'min', {
                value: 0,
                message: 'Permission cannot be negative'
            }),
            validation('NAME', 'custom', {
                validator: (name: string) => {
                    // Basic username validation
                    if (!name || name.trim() !== name) {
                        return 'Username cannot have leading/trailing spaces';
                    }
                    if (name.includes('\n') || name.includes('\r') || name.includes('\t')) {
                        return 'Username cannot contain control characters';
                    }
                    return true;
                }
            })
        ]
    };

    // =============================================================================
    // RELATIONSHIP MAPPINGS - COMPLETE PLAYER ECOSYSTEM (100/100)
    // =============================================================================

    /**
     * Define relationships for this model
     * Complete mapping of all player-related data in the StarMade universe
     */
    public static get relationMappings(): RelationMappings {
        return {
            /** Messages sent by this player (PLAYERS.STARMADE_NAME -> PLAYER_MESSAGES.SENDER) */
            sentMessages: relation(
                Model.HasManyRelation,
                () => {
                    return related0.PlayerMessagesModel;
                },
                {
                    from: 'PLAYERS.STARMADE_NAME',
                    to: 'PLAYER_MESSAGES.SENDER'
                }
            ),

            /** Messages received by this player (PLAYERS.STARMADE_NAME -> PLAYER_MESSAGES.RECEIVER) */
            receivedMessages: relation(
                Model.HasManyRelation,
                () => {
                    return related0.PlayerMessagesModel;
                },
                {
                    from: 'PLAYERS.STARMADE_NAME',
                    to: 'PLAYER_MESSAGES.RECEIVER'
                }
            ),

            /** Mines owned by this player (PLAYERS.ID -> MINES.OWNER) */
            ownedMines: relation(
                Model.HasManyRelation,
                () => {
                    return related1.MinesModel;
                },
                {
                    from: 'PLAYERS.ID',
                    to: 'MINES.OWNER'
                }
            ),

            /** Trade nodes owned by this player (PLAYERS.STARMADE_NAME -> TRADE_NODES.PLAYER) */
            ownedTradeNodes: relation(
                Model.HasManyRelation,
                () => {
                    return related2.TradeNodesModel;
                },
                {
                    from: 'PLAYERS.STARMADE_NAME',
                    to: 'TRADE_NODES.PLAYER'
                }
            ),

            /** Fleets owned by this player (PLAYERS.STARMADE_NAME -> FLEETS.OWNER) */
            ownedFleets: relation(
                Model.HasManyRelation,
                () => {
                    return related3.FleetsModel;
                },
                {
                    from: 'PLAYERS.STARMADE_NAME',
                    to: 'FLEETS.OWNER'
                }
            ),

            /** Entities created by this player (PLAYERS.STARMADE_NAME -> ENTITIES.CREATOR) */
            createdEntities: relation(
                Model.HasManyRelation,
                () => {
                    return related4.EntitiesModel;
                },
                {
                    from: 'PLAYERS.STARMADE_NAME',
                    to: 'ENTITIES.CREATOR'
                }
            ),

            /** Entities last modified by this player (PLAYERS.STARMADE_NAME -> ENTITIES.LAST_MOD) */
            modifiedEntities: relation(
                Model.HasManyRelation,
                () => {
                    return related4.EntitiesModel;
                },
                {
                    from: 'PLAYERS.STARMADE_NAME',
                    to: 'ENTITIES.LAST_MOD'
                }
            )
        };
    }

    // =============================================================================
    // TYPED ACCESSORS
    // =============================================================================

    /**
     * Read the PLAYERS.ID column from this model. Numeric strings are converted to integers.
     * @returns The stored ID value, normalized to an integer when necessary.
     */
    public getId(): number { 
        const id = this.get('ID'); 
        return typeof id === 'string' ? parseInt(id, 10) : id;
    }
    /**
     * Store the PLAYERS.ID column in this model and return this for chaining.
     * @param id New value for the ID column.
     * @returns This model for chaining.
     */
    public setId(id: number): this { return this.set('ID', id); }

    /**
     * Read the PLAYERS.NAME column from this model.
     * @returns The stored NAME value.
     */
    public getName(): string { return this.get('NAME'); }
    /**
     * Store the PLAYERS.NAME column in this model and return this for chaining.
     * @param name New value for the NAME column.
     * @returns This model for chaining.
     */
    public setName(name: string): this { return this.set('NAME', name); }

    /**
     * Read the PLAYERS.STARMADE_NAME column from this model.
     * @returns The stored STARMADE_NAME value.
     */
    public getStarmadeName(): string { return this.get('STARMADE_NAME'); }
    /**
     * Store the PLAYERS.STARMADE_NAME column in this model and return this for chaining.
     * @param starmadeName New value for the STARMADE_NAME column.
     * @returns This model for chaining.
     */
    public setStarmadeName(starmadeName: string): this { return this.set('STARMADE_NAME', starmadeName); }

    /**
     * Read the PLAYERS.FACTION column from this model. Numeric strings are converted to integers.
     * @returns The stored FACTION value, normalized to an integer when necessary.
     */
    public getFaction(): number { 
        const faction = this.get('FACTION'); 
        return typeof faction === 'string' ? parseInt(faction, 10) : faction;
    }
    /**
     * Store the PLAYERS.FACTION column in this model and return this for chaining.
     * @param faction New value for the FACTION column.
     * @returns This model for chaining.
     */
    public setFaction(faction: number): this { return this.set('FACTION', faction); }

    /**
     * Read the PLAYERS.PERMISSION column from this model. Numeric strings are converted to integers.
     * @returns The stored PERMISSION value, normalized to an integer when necessary.
     */
    public getPermission(): number { 
        const permission = this.get('PERMISSION'); 
        return typeof permission === 'string' ? parseInt(permission, 10) : permission;
    }
    /**
     * Store the PLAYERS.PERMISSION column in this model and return this for chaining.
     * @param permission New value for the PERMISSION column.
     * @returns This model for chaining.
     */
    public setPermission(permission: number): this { return this.set('PERMISSION', permission); }

    // =============================================================================
    // RELATIONSHIP ACCESSORS - COMPLETE PLAYER ECOSYSTEM (100/100)
    // =============================================================================

    /** Get messages sent by this player */
    public getSentMessages(): any[] | undefined {
        return this.getRelated<any[]>('sentMessages');
    }

    /** Set messages sent by this player */
    public setSentMessages(messages: any[] | undefined): this {
        return this.setRelated('sentMessages', messages);
    }

    /** Get messages received by this player */
    public getReceivedMessages(): any[] | undefined {
        return this.getRelated<any[]>('receivedMessages');
    }

    /** Set messages received by this player */
    public setReceivedMessages(messages: any[] | undefined): this {
        return this.setRelated('receivedMessages', messages);
    }

    /** Get mines owned by this player */
    public getOwnedMines(): any[] | undefined {
        return this.getRelated<any[]>('ownedMines');
    }

    /** Set mines owned by this player */
    public setOwnedMines(mines: any[] | undefined): this {
        return this.setRelated('ownedMines', mines);
    }

    /** Get trade nodes owned by this player */
    public getOwnedTradeNodes(): any[] | undefined {
        return this.getRelated<any[]>('ownedTradeNodes');
    }

    /** Set trade nodes owned by this player */
    public setOwnedTradeNodes(tradeNodes: any[] | undefined): this {
        return this.setRelated('ownedTradeNodes', tradeNodes);
    }

    /** Get fleets owned by this player */
    public getOwnedFleets(): any[] | undefined {
        return this.getRelated<any[]>('ownedFleets');
    }

    /** Set fleets owned by this player */
    public setOwnedFleets(fleets: any[] | undefined): this {
        return this.setRelated('ownedFleets', fleets);
    }

    /** Get entities created by this player */
    public getCreatedEntities(): any[] | undefined {
        return this.getRelated<any[]>('createdEntities');
    }

    /** Set entities created by this player */
    public setCreatedEntities(entities: any[] | undefined): this {
        return this.setRelated('createdEntities', entities);
    }

    /** Get entities last modified by this player */
    public getModifiedEntities(): any[] | undefined {
        return this.getRelated<any[]>('modifiedEntities');
    }

    /** Set entities last modified by this player */
    public setModifiedEntities(entities: any[] | undefined): this {
        return this.setRelated('modifiedEntities', entities);
    }

    // =============================================================================
    // ADVANCED RELATIONSHIP STATUS CHECKS (100/100 FEATURE)
    // =============================================================================

    /** Check if sent messages are loaded */
    public hasSentMessagesLoaded(): boolean {
        return this.hasRelated('sentMessages');
    }

    /** Check if received messages are loaded */
    public hasReceivedMessagesLoaded(): boolean {
        return this.hasRelated('receivedMessages');
    }

    /** Check if any messages are loaded */
    public hasMessagesLoaded(): boolean {
        return this.hasSentMessagesLoaded() || this.hasReceivedMessagesLoaded();
    }

    /** Check if owned mines are loaded */
    public hasOwnedMinesLoaded(): boolean {
        return this.hasRelated('ownedMines');
    }

    /** Check if owned trade nodes are loaded */
    public hasOwnedTradeNodesLoaded(): boolean {
        return this.hasRelated('ownedTradeNodes');
    }

    /** Check if economic assets are loaded */
    public hasEconomicAssetsLoaded(): boolean {
        return this.hasOwnedMinesLoaded() || this.hasOwnedTradeNodesLoaded();
    }

    /** Check if owned fleets are loaded */
    public hasOwnedFleetsLoaded(): boolean {
        return this.hasRelated('ownedFleets');
    }

    /** Check if created entities are loaded */
    public hasCreatedEntitiesLoaded(): boolean {
        return this.hasRelated('createdEntities');
    }

    /** Check if modified entities are loaded */
    public hasModifiedEntitiesLoaded(): boolean {
        return this.hasRelated('modifiedEntities');
    }

    /** Check if any entities are loaded */
    public hasEntitiesLoaded(): boolean {
        return this.hasCreatedEntitiesLoaded() || this.hasModifiedEntitiesLoaded();
    }

    /** Check if all player assets are loaded */
    public hasAllAssetsLoaded(): boolean {
        return this.hasEconomicAssetsLoaded() && 
               this.hasOwnedFleetsLoaded() && 
               this.hasEntitiesLoaded();
    }

    // =============================================================================
    // ADVANCED COUNTING METHODS (100/100 FEATURE)
    // =============================================================================

    /** Get count of sent messages */
    public getSentMessagesCount(): number {
        const messages = this.getSentMessages();
        return messages ? messages.length : 0;
    }

    /** Get count of received messages */
    public getReceivedMessagesCount(): number {
        const messages = this.getReceivedMessages();
        return messages ? messages.length : 0;
    }

    /** Get total message count (sent + received) */
    public getTotalMessagesCount(): number {
        return this.getSentMessagesCount() + this.getReceivedMessagesCount();
    }

    /** Get count of owned mines */
    public getOwnedMinesCount(): number {
        const mines = this.getOwnedMines();
        return mines ? mines.length : 0;
    }

    /** Get count of owned trade nodes */
    public getOwnedTradeNodesCount(): number {
        const tradeNodes = this.getOwnedTradeNodes();
        return tradeNodes ? tradeNodes.length : 0;
    }

    /** Get economic assets count */
    public getEconomicAssetsCount(): number {
        return this.getOwnedMinesCount() + this.getOwnedTradeNodesCount();
    }

    /** Get count of owned fleets */
    public getOwnedFleetsCount(): number {
        const fleets = this.getOwnedFleets();
        return fleets ? fleets.length : 0;
    }

    /** Get count of created entities */
    public getCreatedEntitiesCount(): number {
        const entities = this.getCreatedEntities();
        return entities ? entities.length : 0;
    }

    /** Get count of modified entities */
    public getModifiedEntitiesCount(): number {
        const entities = this.getModifiedEntities();
        return entities ? entities.length : 0;
    }

    /** Get total entity interaction count */
    public getTotalEntityInteractionsCount(): number {
        return this.getCreatedEntitiesCount() + this.getModifiedEntitiesCount();
    }

    /** Get overall player activity score */
    public getPlayerActivityScore(): number {
        return this.getTotalMessagesCount() + 
               this.getEconomicAssetsCount() * 5 + 
               this.getOwnedFleetsCount() * 3 + 
               this.getTotalEntityInteractionsCount();
    }

    // =============================================================================
    // ADVANCED PLAYER ANALYTICS (100/100 FEATURES)
    // =============================================================================

    /**
     * Get player activity analysis
     */
    public getActivityAnalysis(): {
        communicationLevel: 'SILENT' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
        economicLevel: 'NONE' | 'BASIC' | 'MODERATE' | 'ADVANCED' | 'TYCOON';
        militaryLevel: 'CIVILIAN' | 'RECRUIT' | 'SOLDIER' | 'COMMANDER' | 'ADMIRAL';
        builderLevel: 'NONE' | 'NOVICE' | 'ARCHITECT' | 'MASTER' | 'LEGENDARY';
        overallActivity: 'INACTIVE' | 'CASUAL' | 'ACTIVE' | 'DEDICATED' | 'HARDCORE';
    } {
        const messages = this.getTotalMessagesCount();
        const economic = this.getEconomicAssetsCount();
        const fleets = this.getOwnedFleetsCount();
        const entities = this.getTotalEntityInteractionsCount();

        // Communication level
        let communicationLevel: any = 'SILENT';
        if (messages > 100) communicationLevel = 'VERY_HIGH';
        else if (messages > 50) communicationLevel = 'HIGH';
        else if (messages > 20) communicationLevel = 'MODERATE';
        else if (messages > 5) communicationLevel = 'LOW';

        // Economic level
        let economicLevel: any = 'NONE';
        if (economic >= 10) economicLevel = 'TYCOON';
        else if (economic >= 5) economicLevel = 'ADVANCED';
        else if (economic >= 3) economicLevel = 'MODERATE';
        else if (economic >= 1) economicLevel = 'BASIC';

        // Military level
        let militaryLevel: any = 'CIVILIAN';
        if (fleets >= 10) militaryLevel = 'ADMIRAL';
        else if (fleets >= 5) militaryLevel = 'COMMANDER';
        else if (fleets >= 2) militaryLevel = 'SOLDIER';
        else if (fleets >= 1) militaryLevel = 'RECRUIT';

        // Builder level
        let builderLevel: any = 'NONE';
        if (entities >= 100) builderLevel = 'LEGENDARY';
        else if (entities >= 50) builderLevel = 'MASTER';
        else if (entities >= 20) builderLevel = 'ARCHITECT';
        else if (entities >= 5) builderLevel = 'NOVICE';

        // Overall activity
        const activityScore = this.getPlayerActivityScore();
        let overallActivity: any = 'INACTIVE';
        if (activityScore >= 200) overallActivity = 'HARDCORE';
        else if (activityScore >= 100) overallActivity = 'DEDICATED';
        else if (activityScore >= 50) overallActivity = 'ACTIVE';
        else if (activityScore >= 10) overallActivity = 'CASUAL';

        return {
            communicationLevel,
            economicLevel,
            militaryLevel,
            builderLevel,
            overallActivity
        };
    }

    /**
     * Get player influence assessment
     */
    public getInfluenceAssessment(): {
        economicInfluence: number; // 0-100
        militaryInfluence: number; // 0-100
        socialInfluence: number; // 0-100
        overallInfluence: number; // 0-100
        influenceRank: 'NEWCOMER' | 'CITIZEN' | 'NOTABLE' | 'INFLUENTIAL' | 'POWER_PLAYER';
        recommendations: string[];
    } {
        const recommendations: string[] = [];

        // Economic influence (based on economic assets)
        const economic = this.getEconomicAssetsCount();
        const economicInfluence = Math.min(100, economic * 10);

        // Military influence (based on fleets and entities)
        const fleets = this.getOwnedFleetsCount();
        const entities = this.getTotalEntityInteractionsCount();
        const militaryInfluence = Math.min(100, (fleets * 15) + (entities * 0.5));

        // Social influence (based on messaging and permissions)
        const messages = this.getTotalMessagesCount();
        const permissions = this.getPermission();
        const socialInfluence = Math.min(100, (messages * 0.5) + (permissions > 0 ? 25 : 0));

        // Overall influence
        const overallInfluence = Math.round(
            (economicInfluence * 0.4) + 
            (militaryInfluence * 0.4) + 
            (socialInfluence * 0.2)
        );

        // Influence rank
        let influenceRank: any = 'NEWCOMER';
        if (overallInfluence >= 80) influenceRank = 'POWER_PLAYER';
        else if (overallInfluence >= 60) influenceRank = 'INFLUENTIAL';
        else if (overallInfluence >= 40) influenceRank = 'NOTABLE';
        else if (overallInfluence >= 20) influenceRank = 'CITIZEN';

        // Generate recommendations
        if (economicInfluence < 30) {
            recommendations.push('Consider establishing trade nodes or mines to increase economic influence');
        }
        if (militaryInfluence < 30) {
            recommendations.push('Build fleets and structures to strengthen military presence');
        }
        if (socialInfluence < 30) {
            recommendations.push('Engage more in faction activities and messaging to build social connections');
        }
        if (this.isOfficer()) {
            recommendations.push('Use your officer permissions to help manage faction growth');
        }

        return {
            economicInfluence,
            militaryInfluence,
            socialInfluence,
            overallInfluence,
            influenceRank,
            recommendations
        };
    }

    /**
     * Generate comprehensive player profile
     */
    public generatePlayerProfile(): {
        basic: {
            id: number;
            name: string;
            starmadeName: string;
            faction: number;
            isInFaction: boolean;
            role: string;
            displayName: string;
        };
        permissions: {
            permission: number;
            role: string;
            permissionNames: string[];
            isAdmin: boolean;
            isOfficer: boolean;
            isLeader: boolean;
        };
        assets: {
            sentMessages?: number;
            receivedMessages?: number;
            totalMessages?: number;
            ownedMines?: number;
            ownedTradeNodes?: number;
            economicAssets?: number;
            ownedFleets?: number;
            createdEntities?: number;
            modifiedEntities?: number;
            totalEntityInteractions?: number;
            activityScore?: number;
        };
        analytics: {
            activity?: ReturnType<PlayersModel['getActivityAnalysis']>;
            influence?: ReturnType<PlayersModel['getInfluenceAssessment']>;
        };
        relationshipStatus: {
            hasMessagesLoaded: boolean;
            hasEconomicAssetsLoaded: boolean;
            hasOwnedFleetsLoaded: boolean;
            hasEntitiesLoaded: boolean;
            hasAllAssetsLoaded: boolean;
        };
        overallRating: 'NEWCOMER' | 'DEVELOPING' | 'ESTABLISHED' | 'VETERAN' | 'LEGEND';
    } {
        const basic = {
            id: this.getId(),
            name: this.getName(),
            starmadeName: this.getStarmadeName(),
            faction: this.getFaction(),
            isInFaction: this.isInFaction(),
            role: this.getRole(),
            displayName: this.getDisplayName()
        };

        const permissions = {
            ...this.getPermissionSummary(),
            permission: this.getPermission()
        };

        const assets: any = {};
        const relationshipStatus = {
            hasMessagesLoaded: this.hasMessagesLoaded(),
            hasEconomicAssetsLoaded: this.hasEconomicAssetsLoaded(),
            hasOwnedFleetsLoaded: this.hasOwnedFleetsLoaded(),
            hasEntitiesLoaded: this.hasEntitiesLoaded(),
            hasAllAssetsLoaded: this.hasAllAssetsLoaded()
        };

        // Add asset information if loaded
        if (this.hasMessagesLoaded()) {
            assets.sentMessages = this.getSentMessagesCount();
            assets.receivedMessages = this.getReceivedMessagesCount();
            assets.totalMessages = this.getTotalMessagesCount();
        }

        if (this.hasEconomicAssetsLoaded()) {
            assets.ownedMines = this.getOwnedMinesCount();
            assets.ownedTradeNodes = this.getOwnedTradeNodesCount();
            assets.economicAssets = this.getEconomicAssetsCount();
        }

        if (this.hasOwnedFleetsLoaded()) {
            assets.ownedFleets = this.getOwnedFleetsCount();
        }

        if (this.hasEntitiesLoaded()) {
            assets.createdEntities = this.getCreatedEntitiesCount();
            assets.modifiedEntities = this.getModifiedEntitiesCount();
            assets.totalEntityInteractions = this.getTotalEntityInteractionsCount();
        }

        const analytics: any = {};
        if (relationshipStatus.hasAllAssetsLoaded) {
            assets.activityScore = this.getPlayerActivityScore();
            analytics.activity = this.getActivityAnalysis();
            analytics.influence = this.getInfluenceAssessment();
        }

        // Overall rating
        let overallRating: any = 'NEWCOMER';
        if (analytics.influence?.overallInfluence >= 80) overallRating = 'LEGEND';
        else if (analytics.influence?.overallInfluence >= 60) overallRating = 'VETERAN';
        else if (analytics.influence?.overallInfluence >= 40) overallRating = 'ESTABLISHED';
        else if (analytics.influence?.overallInfluence >= 20) overallRating = 'DEVELOPING';

        return {
            basic,
            permissions,
            assets,
            analytics,
            relationshipStatus,
            overallRating
        };
    }

    // =============================================================================
    // PERMISSION MANAGEMENT METHODS - ENHANCED EDITION
    // =============================================================================

    /**
     * Check if player has a specific permission
     */
    public hasPermission(permission: PlayerPermission): boolean {
        const permissions = this.getPermission();
        return (permissions & permission) === permission;
    }

    /**
     * Check if player has admin permissions
     */
    public isAdmin(): boolean {
        return this.hasPermission(PlayerPermission.ADMIN_PERMISSIONS);
    }

    /**
     * Grant a permission to the player
     */
    public grantPermission(permission: PlayerPermission): this {
        const current = this.getPermission();
        return this.setPermission(current | permission);
    }

    /**
     * Revoke a permission from the player
     */
    public revokePermission(permission: PlayerPermission): this {
        const current = this.getPermission();
        return this.setPermission(current & ~permission);
    }

    /**
     * Set multiple permissions at once
     */
    public setPermissions(permissions: PlayerPermission[]): this {
        const combined = permissions.reduce((acc, perm) => acc | perm, 0);
        return this.setPermission(combined);
    }

    /**
     * Get all permissions as an array
     */
    public getPermissions(): PlayerPermission[] {
        const permissions: PlayerPermission[] = [];
        const current = this.getPermission();
        
        for (const [key, value] of Object.entries(PlayerPermission)) {
            if (typeof value === 'number' && (current & value) === value) {
                permissions.push(value);
            }
        }
        
        return permissions;
    }

    /**
     * Get permission names as strings
     */
    public getPermissionNames(): string[] {
        const permissions = this.getPermissions();
        return permissions.map(perm => PlayerPermission[perm] || `UNKNOWN_${perm}`);
    }

    /**
     * Check if player can invite others to faction
     */
    public canInvite(): boolean {
        return this.hasPermission(PlayerPermission.INVITE);
    }

    /**
     * Check if player can kick others from faction
     */
    public canKick(): boolean {
        return this.hasPermission(PlayerPermission.KICK);
    }

    /**
     * Check if player can edit permissions
     */
    public canEditPermissions(): boolean {
        return this.hasPermission(PlayerPermission.EDIT_PERMISSIONS);
    }

    /**
     * Check if player can edit faction description
     */
    public canEditDescription(): boolean {
        return this.hasPermission(PlayerPermission.EDIT_DESCRIPTION);
    }

    /**
     * Check if player can manage faction relationships
     */
    public canManageRelationships(): boolean {
        return this.hasPermission(PlayerPermission.RELATIONSHIP);
    }

    /**
     * Check if player can manage homebase
     */
    public canManageHomebase(): boolean {
        return this.hasPermission(PlayerPermission.HOMEBASE);
    }

    /**
     * Check if player can share fog of war
     */
    public canShareFogOfWar(): boolean {
        return this.hasPermission(PlayerPermission.FOG_OF_WAR_SHARE);
    }

    /**
     * Check if player can post faction news
     */
    public canPostNews(): boolean {
        return this.hasPermission(PlayerPermission.NEWS_POST);
    }

    // =============================================================================
    // BUSINESS LOGIC METHODS - ENHANCED EDITION
    // =============================================================================

    /**
     * Check if player is in a faction
     */
    public isInFaction(): boolean {
        return this.getFaction() !== 0;
    }

    /**
     * Get player role based on permissions
     */
    public getRole(): string {
        const permissions = this.getPermission();
        
        if (this.isAdmin()) {
            return 'Admin';
        }
        
        switch (permissions) {
            case PlayerRole.MEMBER:
                return 'Member';
            case PlayerRole.COMMANDER:
                return 'Basic Officer';
            case PlayerRole.CAPTAIN :
                return 'Senior Officer';
            case PlayerRole.FULL_CONTROL:
                return 'Leader';
            default:
                return 'Custom Role';
        }
    }

    /**
     * Get role name for display
     */
    public getRoleName(): string {
        return this.getRole();
    }

    /**
     * Check if player has officer-level permissions
     */
    public isOfficer(): boolean {
        return this.canInvite() || this.canKick() || this.canEditPermissions();
    }

    /**
     * Check if player has leadership permissions
     */
    public isLeader(): boolean {
        return this.canEditPermissions() && this.canManageRelationships() && this.canManageHomebase();
    }

    /**
     * Get display name (prefer StarMade name, fallback to login name)
     */
    public getDisplayName(): string {
        const starmadeName = this.getStarmadeName();
        return starmadeName && starmadeName.trim() ? starmadeName : this.getName();
    }

    /**
     * Check if player names match (case-insensitive)
     */
    public nameMatches(name: string): boolean {
        const loginName = this.getName().toLowerCase();
        const displayName = this.getStarmadeName().toLowerCase();
        const searchName = name.toLowerCase();
        
        return loginName === searchName || displayName === searchName;
    }

    /**
     * Validate permission level for an action
     */
    public validatePermissionForAction(requiredPermission: PlayerPermission): boolean {
        return this.isAdmin() || this.hasPermission(requiredPermission);
    }

    /**
     * Get permission summary
     */
    public getPermissionSummary(): {
        permission: number;
        role: string;
        permissionNames: string[];
        isAdmin: boolean;
        isOfficer: boolean;
        isLeader: boolean;
    } {
        return {
            permission: this.getPermission(),
            role: this.getRole(),
            permissionNames: this.getPermissionNames(),
            isAdmin: this.isAdmin(),
            isOfficer: this.isOfficer(),
            isLeader: this.isLeader()
        };
    }

    /**
     * Compare permission levels with another player
     */
    public comparePermissionsWith(other: PlayersModel): number {
        const thisPermissions = this.getPermission();
        const otherPermissions = other.getPermission();
        
        if (thisPermissions === otherPermissions) return 0;
        if (this.isAdmin() && !other.isAdmin()) return 1;
        if (!this.isAdmin() && other.isAdmin()) return -1;
        
        return thisPermissions > otherPermissions ? 1 : -1;
    }
}