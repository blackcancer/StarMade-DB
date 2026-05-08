/**
 * @fileoverview Table Models Index
 * 
 * Central export file for all table models in the StarMade database.
 * 
 * @author InitSysRev
 * @version 1.0.0
 */

// Base Model exports
import { BaseModel } from './BaseModel.js';
export {
    BaseModel,
    column,
    foreignKey,
    index,
    validation,
    DataType,
    ForeignKeyAction,
    type TableSchema,
    type ModelValidationResult,
    type ColumnDefinition,
    type ForeignKeyDefinition,
    type ModelValidationRule,
    type IndexDefinition
} from './BaseModel.js';

// Base Controller exports
export {
    BaseController,
    type ModelConstructor,
    type QueryOptions,
    type CreateOptions,
    type UpdateOptions,
    type DeleteOptions,
    type BulkOperationResult,
    type BaseControllerConfig
} from './BaseController.js';

// Import individual models
import { EntitiesModel, EntityType, KnownFactions } from './entities/EntitiesModel.js';
import { PlayersModel, PlayerPermission, PlayerRole } from './players/PlayersModel.js';
import { SectorsModel, SectorType, SectorProtection, ProtectionLevel } from './sectors/SectorsModel.js';
import { SystemsModel, SystemType, MAX_INFOS_SIZE, MAX_RESOURCES_SIZE, RESOURCE_COUNT, KnownSystemFactions } from './systems/SystemsModel.js';
import { FleetsModel, FleetCommand, FactionAccess, CombatSetting, MissionString, FleetType, NPCFleetPrefix, FleetMissionCategory, FLEET_MISSION_CATEGORIES } from './fleets/FleetsModel.js';
import { FleetMembersModel, MemberMissionState, MissionCategory, MemberPriority, DockingStatus, KnownFleetFactions } from './fleet-members/FleetMembersModel.js';
import { TradeNodesModel, MAX_ITEMS_SIZE as TRADE_NODES_MAX_ITEMS_SIZE, DEFAULT_PERMISSION, TradePermissionFlag, TradePermissionPreset, KnownTradeFactions } from './trade-nodes/TradeNodesModel.js';
import { EffectsModel, EffectType, EffectCategory, EFFECT_UIDS, ALL_EFFECT_UIDS } from './effects/EffectsModel.js';
import { FtlModel, FtlType, FtlPermission, FTL_PERMISSION_COMBINATIONS } from './ftl/FtlModel.js';
import { MinesModel, MineModuleType, MineArmingState, MineStatus, KnownMineFactions } from './mines/MinesModel.js';
import { NPCStatsModel } from './npc-stats/NpcStatsModel.js';
import { PlayerMessagesModel } from './player-messages/PlayerMessagesModel.js';
import { TradeHistoryModel } from './trade-history/TradeHistoryModel.js';
import { VisibilityModel, KnownObserver } from './visibility/VisibilityModel.js';
import { SectorsItemsModel, MAX_ITEMS_SIZE, ITEM_RECORD_SIZE, MAX_ITEM_STACKS } from './sectors-items/SectorsItemsModel.js';
import { IdGenTableModel } from './id-gen-table/IdGenTableModel.js';

// Import controllers
import { IdGenTableController } from './id-gen-table/IdGenTableController.js';
import { EntitiesController } from './entities/EntitiesController.js';
import { FleetsController } from './fleets/FleetsController.js';
import { FleetMembersController } from './fleet-members/FleetMembersController.js';
import { TradeNodesController } from './trade-nodes/TradeNodesController.js';
import { FtlController } from './ftl/FtlController.js';
import { MinesController } from './mines/MinesController.js';
import { NpcStatsController } from './npc-stats/NpcStatsController.js';
import { PlayerMessagesController } from './player-messages/PlayerMessagesController.js';
import { TradeHistoryController } from './trade-history/TradeHistoryController.js';
import { VisibilityController } from './visibility/VisibilityController.js';
import { PlayersController } from './players/PlayersController.js';
import { SystemsController } from './systems/SystemsController.js';
import { SectorsController } from './sectors/SectorsController.js';
import { SectorsItemsController } from './sectors-items/SectorsItemsController.js';
import { EffectsController } from './effects/EffectsController.js';

// Re-export models and enums
export {
    EntitiesModel, EntityType, KnownFactions,
    PlayersModel, PlayerPermission, PlayerRole,
    SectorsModel, SectorType, SectorProtection, ProtectionLevel,
    SystemsModel, SystemType, MAX_INFOS_SIZE, MAX_RESOURCES_SIZE, RESOURCE_COUNT, KnownSystemFactions,
    FleetsModel, FleetCommand, FactionAccess, CombatSetting, MissionString, FleetType, NPCFleetPrefix, FleetMissionCategory, FLEET_MISSION_CATEGORIES,
    FleetMembersModel, MemberMissionState, MissionCategory, MemberPriority, DockingStatus, KnownFleetFactions,
    TradeNodesModel, TRADE_NODES_MAX_ITEMS_SIZE, DEFAULT_PERMISSION, TradePermissionFlag, TradePermissionPreset, KnownTradeFactions,
    EffectsModel, EffectType, EffectCategory, EFFECT_UIDS, ALL_EFFECT_UIDS,
    FtlModel, FtlType, FtlPermission, FTL_PERMISSION_COMBINATIONS,
    MinesModel, MineModuleType, MineArmingState, MineStatus, KnownMineFactions,
    NPCStatsModel,
    PlayerMessagesModel,
    TradeHistoryModel,
    VisibilityModel, KnownObserver,
    SectorsItemsModel, MAX_ITEMS_SIZE, ITEM_RECORD_SIZE, MAX_ITEM_STACKS,
    IdGenTableModel
};

// Re-export controllers
export {
    IdGenTableController,
    EntitiesController,
    FleetsController,
    FleetMembersController,
    TradeNodesController,
    FtlController,
    MinesController,
    NpcStatsController,
    PlayerMessagesController,
    TradeHistoryController,
    VisibilityController,
    PlayersController,
    SystemsController,
    SectorsController,
    SectorsItemsController,
    EffectsController
};

// Re-export controller types
export type {
    EntitySearchOptions,
    EntityCreateOptions,
    EntityUpdateOptions,
    SpatialAnalysisOptions as EntitySpatialAnalysisOptions,
    DockingChainOptions,
    EntityAnalyticsOptions,
    BulkEntityOptions,
    EntityStatistics,
    SpatialAnalysisResult as EntitySpatialAnalysisResult,
    DockingChainAnalysis,
    EntityConflictResult
} from './entities/EntitiesController.js';

export type {
    SequenceInitOptions,
    BatchIdOptions,
    SequenceStatus,
    AtomicIdResult,
    BatchIdResult
} from './id-gen-table/IdGenTableController.js';

export type {
    PlayerSearchOptions,
    PlayerCreateOptions,
    PlayerUpdateOptions,
    FactionTransferOptions,
    PermissionChangeOptions,
    PlayerAnalyticsOptions,
    BulkPlayerOptions,
    PlayerStatistics
} from './players/PlayersController.js';

export type {
    SystemSearchOptions,
    SystemCreateOptions,
    SystemUpdateOptions,
    OwnershipTransferOptions,
    TerritoryAnalysisOptions,
    BulkSystemOptions,
    SystemStatistics,
    TerritoryMap
} from './systems/SystemsController.js';

export type {
    SectorSearchOptions,
    SectorCreateOptions,
    SectorUpdateOptions,
    ProtectionManagementOptions,
    SpatialAnalysisOptions,
    BulkSectorOptions,
    SectorStatistics,
    SpatialMap,
    ReplenishmentResult
} from './sectors/SectorsController.js';

export type {
    SectorsItemsSearchOptions,
    SectorsItemsCreateOptions,
    SectorsItemsUpdateOptions,
    StorageAnalysisOptions,
    BulkSectorsItemsOptions,
    StorageStatistics,
    CapacityAnalysis,
    CleanupResult
} from './sectors-items/SectorsItemsController.js';

export type {
    EffectSearchOptions,
    EffectCreateOptions,
    EffectUpdateOptions,
    BulkEffectOptions,
    EffectAnalysisOptions,
    EntityEffectOptions,
    EffectStatistics,
    EntityEffectSummary,
    CategoryAnalysis
} from './effects/EffectsController.js';

export type { MineComposition } from './mines/MinesModel.js';

export type {
    FleetSearchOptions,
    FleetCreateOptions,
    FleetUpdateOptions,
    FleetHierarchyOptions,
    FleetAnalyticsOptions,
    BulkFleetOptions,
    FleetStatistics,
    FleetHierarchyNode
} from './fleets/FleetsController.js';

export type {
    FleetMemberSearchOptions,
    FleetMemberCreateOptions,
    FleetMemberUpdateOptions,
    BulkFleetMemberOptions,
    FleetMemberStatistics
} from './fleet-members/FleetMembersController.js';

export type {
    TradeNodeSearchOptions,
    TradeNodeCreateOptions,
    TradeNodeUpdateOptions,
    BulkTradeNodeOptions,
    TradeNodeStatistics
} from './trade-nodes/TradeNodesController.js';

export type {
    FtlSearchOptions,
    FtlCreateOptions,
    FtlUpdateOptions,
    BulkFtlOptions,
    FtlStatistics
} from './ftl/FtlController.js';

export type {
    MineSearchOptions,
    MineCreateOptions,
    MineUpdateOptions,
    BulkMineOptions,
    MineStatistics
} from './mines/MinesController.js';

export type {
    NpcStatsKey,
    NpcStatsSearchOptions,
    NpcStatsUpdateOptions,
    BulkNpcStatsOptions,
    NpcStatsStatistics
} from './npc-stats/NpcStatsController.js';

export type {
    PlayerMessageSearchOptions,
    PlayerMessageCreateOptions,
    PlayerMessageUpdateOptions,
    BulkMessageOptions,
    PlayerMessageStatistics
} from './player-messages/PlayerMessagesController.js';

export type {
    TradeHistorySearchOptions,
    TradeHistoryCreateOptions,
    TradeHistoryUpdateOptions,
    BulkTradeHistoryOptions,
    TradeHistoryStatistics
} from './trade-history/TradeHistoryController.js';

export type {
    VisibilityKey,
    VisibilitySearchOptions,
    VisibilityUpdateOptions,
    BulkVisibilityOptions,
    VisibilityStatistics
} from './visibility/VisibilityController.js';

// Model type union for type checking
export type TableModel = 
    | EntitiesModel
    | PlayersModel
    | SectorsModel
    | SystemsModel
    | FleetsModel
    | FleetMembersModel
    | TradeNodesModel
    | EffectsModel
    | FtlModel
    | MinesModel
    | NPCStatsModel
    | PlayerMessagesModel
    | TradeHistoryModel
    | VisibilityModel
    | SectorsItemsModel
    | IdGenTableModel;

// Controller type for future expansion
export type TableController =
    | IdGenTableController
    | EntitiesController
    | FleetsController
    | FleetMembersController
    | TradeNodesController
    | FtlController
    | MinesController
    | NpcStatsController
    | PlayerMessagesController
    | TradeHistoryController
    | VisibilityController
    | PlayersController
    | SystemsController
    | SectorsController
    | SectorsItemsController
    | EffectsController;

// Model class map for dynamic instantiation
export const ModelClasses = {
    ENTITIES: EntitiesModel,
    PLAYERS: PlayersModel,
    SECTORS: SectorsModel,
    SYSTEMS: SystemsModel,
    FLEETS: FleetsModel,
    FLEET_MEMBERS: FleetMembersModel,
    TRADE_NODES: TradeNodesModel,
    EFFECTS: EffectsModel,
    FTL: FtlModel,
    MINES: MinesModel,
    NPC_STATS: NPCStatsModel,
    PLAYER_MESSAGES: PlayerMessagesModel,
    TRADE_HISTORY: TradeHistoryModel,
    VISIBILITY: VisibilityModel,
    SECTORS_ITEMS: SectorsItemsModel,
    ID_GEN_TABLE: IdGenTableModel
} as const;

// Controller class map for dynamic instantiation
export const ControllerClasses = {
    ID_GEN_TABLE: IdGenTableController,
    ENTITIES: EntitiesController,
    FLEETS: FleetsController,
    FLEET_MEMBERS: FleetMembersController,
    TRADE_NODES: TradeNodesController,
    FTL: FtlController,
    MINES: MinesController,
    NPC_STATS: NpcStatsController,
    PLAYER_MESSAGES: PlayerMessagesController,
    TRADE_HISTORY: TradeHistoryController,
    VISIBILITY: VisibilityController,
    PLAYERS: PlayersController,
    SYSTEMS: SystemsController,
    SECTORS: SectorsController,
    SECTORS_ITEMS: SectorsItemsController,
    EFFECTS: EffectsController
} as const;

// Table names constant
export const TABLE_NAMES = {
    ENTITIES: 'ENTITIES',
    PLAYERS: 'PLAYERS',
    SECTORS: 'SECTORS',
    SYSTEMS: 'SYSTEMS',
    FLEETS: 'FLEETS',
    FLEET_MEMBERS: 'FLEET_MEMBERS',
    TRADE_NODES: 'TRADE_NODES',
    EFFECTS: 'EFFECTS',
    FTL: 'FTL',
    MINES: 'MINES',
    NPC_STATS: 'NPC_STATS',
    PLAYER_MESSAGES: 'PLAYER_MESSAGES',
    TRADE_HISTORY: 'TRADE_HISTORY',
    VISIBILITY: 'VISIBILITY',
    SECTORS_ITEMS: 'SECTORS_ITEMS',
    ID_GEN_TABLE: 'ID_GEN_TABLE'
} as const;

// Constructor type for concrete model classes
type ModelControllerConstructor = new (config?: any) => TableController;
type ModelConstructorType<T extends BaseModel = BaseModel> = new (data?: any) => T;

// Helper function to get model class by table name
export function getModelClass(tableName: string): ModelConstructorType | undefined {
    return ModelClasses[tableName as keyof typeof ModelClasses] as ModelConstructorType | undefined;
}

// Helper function to create model instance
export function createModel<T extends BaseModel>(
    tableName: string, 
    data?: Record<string, any>
): T | undefined {
    const ModelClass = getModelClass(tableName);
    if (!ModelClass) return undefined;
    
    return new ModelClass(data) as T;
}

// Helper function to get controller class by table name
export function getControllerClass(tableName: string): ModelControllerConstructor | undefined {
    return ControllerClasses[tableName as keyof typeof ControllerClasses] as ModelControllerConstructor | undefined;
}

// Helper function to get all table names
export function getAllTableNames(): string[] {
    return Object.values(TABLE_NAMES);
}

// Helper function to check if table name is valid
export function isValidTableName(tableName: string): boolean {
    return tableName in ModelClasses;
}

// Model registry for dynamic access
export class ModelRegistry {
    private static models = new Map<string, ModelConstructorType>();

    static {
        // Register all models
        Object.entries(ModelClasses).forEach(([tableName, ModelClass]) => {
            this.models.set(tableName, ModelClass as ModelConstructorType);
        });
    }

    /**
     * Get model class by table name
     */
    static getModel(tableName: string): ModelConstructorType | undefined {
        return this.models.get(tableName.toUpperCase());
    }

    /**
     * Create model instance
     */
    static create<T extends BaseModel>(tableName: string, data?: Record<string, any>): T | undefined {
        const ModelClass = this.getModel(tableName);
        if (!ModelClass) return undefined;
        
        return new ModelClass(data) as T;
    }

    /**
     * Get all registered table names
     */
    static getTableNames(): string[] {
        return Array.from(this.models.keys());
    }

    /**
     * Check if table is registered
     */
    static hasTable(tableName: string): boolean {
        return this.models.has(tableName.toUpperCase());
    }

    /**
     * Get model schema
     */
    static getSchema(tableName: string): any {
        const ModelClass = this.getModel(tableName);
        return (ModelClass as any)?.getSchema();
    }
}