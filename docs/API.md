# SMToolkit-DB – API Reference

> **Version 2.1.0** — Last updated 2026-05-08

---

## Table of Contents

1. [Core – HSQLManager](#1-core--hsqlmanager)
2. [BaseController](#2-basecontroller)
3. [Controllers](#3-controllers)
   - [IdGenTableController](#idgentablecontroller)
   - [EntitiesController](#entitiescontroller)
   - [PlayersController](#playerscontroller)
   - [SystemsController](#systemscontroller)
   - [SectorsController](#sectorscontroller)
   - [SectorsItemsController](#sectorsitemscontroller)
   - [EffectsController](#effectscontroller)
   - [FleetsController](#fleetscontroller) ✨ _2.1.0_
   - [FleetMembersController](#fleetmemberscontroller) ✨ _2.1.0_
   - [TradeNodesController](#tradenodescontroller) ✨ _2.1.0_
   - [FtlController](#ftlcontroller) ✨ _2.1.0_
   - [MinesController](#minescontroller) ✨ _2.1.0_
   - [NpcStatsController](#npcstatscontroller) ✨ _2.1.0_
   - [PlayerMessagesController](#playermessagescontroller) ✨ _2.1.0_
   - [TradeHistoryController](#tradehistorycontroller) ✨ _2.1.0_
   - [VisibilityController](#visibilitycontroller) ✨ _2.1.0_
4. [Error Classes](#4-error-classes)
5. [Type Reference](#5-type-reference)

---

## 1. Core – HSQLManager

The central entry point for the library.

```typescript
import { HSQLManager } from 'smtoolkit-db';

const manager = new HSQLManager({
    starmadeDir: '/path/to/starmade',
    worldName: 'my_world',
    connection: { timeoutMs: 10000, readOnly: true },
    logging: { level: 'info' }
});

await manager.initialize();
// ... use controllers
await manager.destroy();
```

---

## 2. BaseController

All controllers extend `BaseController<TModel>` and share these CRUD methods:

| Method | Signature | Description |
|---|---|---|
| `findById` | `(id: any) → Promise<TModel \| null>` | Find by primary key |
| `findMany` | `(options: QueryOptions) → Promise<TModel[]>` | Paginated list |
| `create` | `(data, options) → Promise<TModel>` | Insert record |
| `update` | `(id, data, options) → Promise<TModel>` | Update record |
| `delete` | `(id, options) → Promise<boolean>` | Delete record |

### QueryOptions

```typescript
interface QueryOptions {
    limit?: number;           // Max results (default: 1000)
    offset?: number;          // Pagination offset
    orderBy?: string;         // Column name
    orderDirection?: 'ASC' | 'DESC';
    cacheTtl?: number;        // Cache TTL in ms
    skipCache?: boolean;      // Bypass cache
}
```

---

## 3. Controllers

### FleetsController

Manages the `FLEETS` table – fleet command, mission, and hierarchy management.

```typescript
import { FleetsController } from 'smtoolkit-db';

const ctrl = new FleetsController();
await ctrl.initialize(manager);
```

#### Search Methods

| Method | Description |
|---|---|
| `findAll(options: FleetSearchOptions)` | List fleets with optional filters |
| `findOne(id: number)` | Find fleet by ID |
| `findByOwner(owner, options?)` | Fleets owned by a player |
| `findByFlagship(flagshipId)` | Fleets using an entity as flagship |
| `findTopLevel(options?)` | Fleets without a parent |
| `findChildren(parentId, options?)` | Sub-fleets of a given fleet |
| `findNPCFleets(options?)` | NPC-owned fleets |
| `findPlayerFleets(options?)` | Player-owned fleets |
| `findInCombat(options?)` | Fleets in combat missions |
| `findIdle(options?)` | Idle fleets |

#### CRUD

| Method | Description |
|---|---|
| `create(data, options?: FleetCreateOptions)` | Create fleet; validates flagship and parent |
| `update(id, data, options?: FleetUpdateOptions)` | Update; validates combatSetting / factionAccess |
| `delete(id, options?)` | Delete fleet |

#### Domain Methods

| Method | Description |
|---|---|
| `fleetExistsById(id)` | Quick existence check |
| `fleetExistsByFlagship(flagshipId)` | Check flagship usage |
| `updateMission(fleetId, missionString)` | Update mission string |
| `updateCombatSetting(fleetId, setting)` | Update combat behaviour |
| `getFleetHierarchy(options?)` | Build full hierarchy tree |
| `countChildren(fleetId)` | Count direct child fleets |
| `count(options?)` | Count matching records |
| `getStatistics(options?)` | Aggregate stats |

#### `FleetSearchOptions`

```typescript
interface FleetSearchOptions extends QueryOptions {
    owner?: string;
    flagshipId?: number;
    parentFleet?: number;
    topLevelOnly?: boolean;
    missionString?: string;
    missionCategory?: FleetMissionCategory;
    factionAccess?: FactionAccess;
    combatSetting?: CombatSetting;
    npcOnly?: boolean;
    playerOwnedOnly?: boolean;
    fleetType?: FleetType;
    searchTerm?: string;
    idleOnly?: boolean;
    inCombatOnly?: boolean;
}
```

---

### FleetMembersController

Manages the `FLEET_MEMBERS` table – entity ↔ fleet associations.

```typescript
const ctrl = new FleetMembersController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `membershipExists(fleetId, entityId)` | Check membership by composite PK |
| `findAll(options: FleetMemberSearchOptions)` | List memberships |
| `findByFleet(fleetId, options?)` | All members of a fleet |
| `findByEntity(entityId)` | All fleets an entity belongs to |
| `findOne(fleetId, entityId)` | Find by composite PK |
| `create(data, options?)` | Add entity to fleet (duplicate prevention) |
| `update(id, data, options?)` | Update membership record |
| `delete(id: {fleetId, entityId}, options?)` | Remove member |
| `removeAllFromFleet(fleetId)` | Clear all fleet members |
| `countByFleet(fleetId)` | Member count |
| `bulkCreate(records, options?)` | Batch add |
| `bulkDelete(ids, options?)` | Batch remove |
| `getStatistics()` | Aggregate stats |

---

### TradeNodesController

Manages the `TRADE_NODES` table – economic marketplace nodes.

```typescript
const ctrl = new TradeNodesController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `nodeExistsById(id)` | Quick existence check |
| `findAll(options: TradeNodeSearchOptions)` | List nodes |
| `findByOwner(owner, options?)` | Nodes by owner |
| `findByFaction(factionId, options?)` | Nodes by faction |
| `findNPCNodes(options?)` | NPC-owned nodes |
| `create(data, options?)` | Create node (defaults PERMISSION to STANDARD_COMMERCIAL) |
| `update(id, data, options?)` | Update; validates permission bitmask |
| `delete(id, options?)` | Delete node |
| `updatePermissions(nodeId, permission)` | Update permission bitmask (0–31) |
| `count(options?)` | Count matching records |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkDelete(ids, options?)` | Batch delete |
| `getStatistics()` | Aggregate stats |

---

### FtlController

Manages the `FTL` table – faster-than-light jump connections.

```typescript
const ctrl = new FtlController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `ftlExistsById(id)` | Quick existence check |
| `findAll(options: FtlSearchOptions)` | List connections |
| `findOne(id)` | Find by ID |
| `findByType(type, options?)` | Filter by `FtlType` |
| `findFromSector(x, y, z)` | Connections originating from sector |
| `findToSector(x, y, z)` | Connections pointing to sector |
| `create(data, options?)` | Create connection (defaults PERMISSION to NORMAL) |
| `update(id, data, options?)` | Update; validates permission bitmask (0–63) |
| `delete(id, options?)` | Delete connection |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkDelete(ids, options?)` | Batch delete |
| `getStatistics()` | Aggregate stats |

---

### MinesController

Manages the `MINES` table – deployable tactical mines.

```typescript
const ctrl = new MinesController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `mineExistsById(id)` | Quick existence check |
| `findAll(options: MineSearchOptions)` | List mines |
| `findOne(id)` | Find by ID |
| `findByOwner(owner, options?)` | Mines by owner |
| `findInSector(x, y, z, options?)` | Mines in a sector |
| `findArmed(options?)` | Armed mines only |
| `create(data, options?)` | Create mine (defaults ARMED=false, ARMED_IN_SECS=-1) |
| `update(id, data, options?)` | Update mine |
| `delete(id, options?)` | Delete mine |
| `armMine(mineId)` | Set ARMED=true |
| `disarmMine(mineId)` | Set ARMED=false |
| `countInSector(x, y, z)` | Mine count in sector |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkDelete(ids, options?)` | Batch delete |
| `getStatistics()` | Aggregate stats |

---

### NpcStatsController

Manages the `NPC_STATS` table – NPC faction spawn statistics by system.

```typescript
const ctrl = new NpcStatsController();
await ctrl.initialize(manager);
```

**Composite PK**: `{ id: number, sysX: number, sysY: number, sysZ: number }`

| Method | Description |
|---|---|
| `recordExists(key: NpcStatsKey)` | Quick existence check |
| `findAll(options: NpcStatsSearchOptions)` | List records |
| `findOne(key)` | Find by composite PK |
| `findByFaction(factionId, options?)` | Stats for a faction |
| `findBySystem(x, y, z)` | Stats for a system |
| `findMostActive(limit?)` | Top-N by total spawn count |
| `create(data, options?)` | Insert stats record |
| `update(key, data, options?)` | Update; validates non-negative counts |
| `delete(key, options?)` | Delete record |
| `incrementFleetSpawns(key, count?)` | Upsert + increment fleet spawns |
| `incrementEntitySpawns(key, count?)` | Upsert + increment entity spawns |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkDelete(keys, options?)` | Batch delete |
| `getStatistics()` | Aggregate stats |

---

### PlayerMessagesController

Manages the `PLAYER_MESSAGES` table – in-game messaging system.

```typescript
const ctrl = new PlayerMessagesController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `messageExistsById(id)` | Quick existence check |
| `findAll(options: PlayerMessageSearchOptions)` | List messages |
| `findOne(id)` | Find by ID |
| `findBySender(sender, options?)` | Outbox for a player |
| `findByReceiver(receiver, options?)` | Inbox for a player |
| `findUnread(receiver, options?)` | Unread inbox |
| `findConversation(playerA, playerB, options?)` | Exchange between two players |
| `create(data, options?)` | Send message (auto SENT, auto READ=false, self-send prevention) |
| `update(id, data, options?)` | Update message |
| `delete(id, options?)` | Delete message |
| `markAsRead(messageId)` | Mark single message as read |
| `markAllAsRead(receiver)` | Mark all inbox as read |
| `countUnread(receiver)` | Unread count for player |
| `deleteAllForPlayer(playerName)` | Remove all inbox+outbox |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkDelete(ids, options?)` | Batch delete |
| `getStatistics()` | Aggregate stats |

---

### TradeHistoryController

Manages the `TRADE_HISTORY` table.

> **Note**: This table is currently **unused** by the StarMade game engine. The controller is fully implemented for future use when the game activates transaction logging.

```typescript
const ctrl = new TradeHistoryController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `transactionExistsById(id)` | Quick existence check |
| `findAll(options: TradeHistorySearchOptions)` | List transactions |
| `findOne(id)` | Find by ID |
| `findByOwner(owner, options?)` | All transactions involving an owner |
| `findSuccessful(options?)` | Successful transactions |
| `findFailed(options?)` | Failed transactions |
| `create(data, options?)` | Insert transaction (validates costs, timestamps) |
| `update(id, data, options?)` | Update transaction |
| `delete(id, options?)` | Delete transaction |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkDelete(ids, options?)` | Batch delete |
| `getStatistics()` | Aggregate stats |

---

### VisibilityController

Manages the `VISIBILITY` table – fog-of-war / sector reconnaissance tracking.

```typescript
const ctrl = new VisibilityController();
await ctrl.initialize(manager);
```

**Composite PK**: `{ id: number, x: number, y: number, z: number }`

| Method | Description |
|---|---|
| `recordExists(key: VisibilityKey)` | Quick existence check |
| `findAll(options: VisibilitySearchOptions)` | List records |
| `findOne(key)` | Find by composite PK |
| `findByObserver(observerId, options?)` | Sectors seen by observer |
| `findBySector(x, y, z)` | Observers of a sector |
| `findNPCObservations(options?)` | NPC-faction observations |
| `findMostRecent(limit?)` | Most recently observed records |
| `hasVisibility(observerId, x, y, z)` | Boolean visibility check |
| `markAsObserved(id, x, y, z, timestamp?)` | Upsert observation |
| `clearObserver(observerId)` | Remove all records for observer |
| `create(data, options?)` | Insert record (auto TIMESTAMP) |
| `update(key, data, options?)` | Update record |
| `delete(key, options?)` | Delete record |
| `countByObserver(observerId)` | Sector count for observer |
| `countBySector(x, y, z)` | Observer count for sector |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkDelete(keys, options?)` | Batch delete |
| `getStatistics()` | Aggregate stats |

---

### EntitiesController

Manages the `ENTITIES` table — all in-game objects (ships, stations, asteroids, etc.).

```typescript
import { EntitiesController } from 'smtoolkit-db';
const ctrl = new EntitiesController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `findEntities(options: EntitySearchOptions)` | List entities with optional filters |
| `findEntityByUID(uid)` | Find by unique UID string |
| `findEntitiesByType(type, options?)` | Filter by `EntityType` |
| `findEntitiesByFaction(factionId, options?)` | All entities of a faction |
| `findEntitiesInSector(x, y, z, options?)` | Entities at exact sector coordinates |
| `findEntitiesWithinRadius(center, radius, options?)` | Spatial radius search |
| `getDockingChain(entityId)` | Full docking hierarchy from root to entity |
| `validateDockingChain(dockedToId, dockedRootId?)` | Validate docking relationships |
| `performSpatialAnalysis(options?)` | Spatial distribution statistics |
| `getEntityAnalytics(options?)` | Detailed analytics by type/faction/sector |
| `checkEntityConflicts(data)` | Pre-create conflict detection |
| `getEntityStatistics()` | Aggregate statistics |
| `getTotalEntityCount()` | Quick total count |
| `create(data, options?)` | Insert entity (validates docking chain) |
| `update(id, data, options?)` | Update entity |
| `delete(id, options?)` | Delete entity |

#### `EntitySearchOptions`

```typescript
interface EntitySearchOptions extends QueryOptions {
    uid?: string;                          // Filter by UID
    entityType?: EntityType;               // Single type filter
    entityTypes?: EntityType[];            // Multi-type filter
    factionId?: number;                    // Faction filter
    coordinates?: { x, y, z };           // Exact sector
    withinRadius?: { center: { x, y, z }; radius: number };
    creator?: string;                      // Creator player name
    lastModifier?: string;                 // Last modifier name
    dockedOnly?: boolean;                  // Only docked entities
    undockedOnly?: boolean;                // Only undocked entities
    rootEntitiesOnly?: boolean;            // Only docking roots
    searchTerm?: string;                   // Name pattern match
}
```

---

### PlayersController

Manages the `PLAYERS` table — player accounts, factions, and permissions.

```typescript
import { PlayersController } from 'smtoolkit-db';
const ctrl = new PlayersController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `findPlayers(options: PlayerSearchOptions)` | List players with optional filters |
| `findPlayerByAccountName(name)` | Find by login username |
| `findPlayerByStarMadeName(name)` | Find by in-game display name |
| `findPlayerByName(name)` | Try account name then StarMade name |
| `findPlayersByFaction(factionId, options?)` | All members of a faction |
| `findPlayersWithPermission(permission, options?)` | Players with a specific permission bit |
| `playerExistsById(id)` | Quick existence check by numeric ID |
| `playerExistsByName(name)` | Quick existence check by account name |
| `create(data, options?)` | Create player (auto-ID, duplicate prevention) |
| `update(id, data, options?)` | Update player (protected field guard) |
| `delete(id, options?)` | Delete player |
| `grantPermission(playerId, permission)` | Bitwise OR a permission bit |
| `revokePermission(playerId, permission)` | Bitwise AND NOT a permission bit |
| `setPlayerRole(playerId, role)` | Set permission to a preset `PlayerRole` |
| `promotePlayer(playerId)` | Advance to next role (requires contiguous role permissions) |
| `demotePlayer(playerId)` | Downgrade to previous role |
| `transferToFaction(playerId, factionId)` | Move player to a new faction |
| `leaveFaction(playerId)` | Set faction to `0` (neutral) |
| `getFactionLeaders(factionId)` | Players with full permission mask |
| `getFactionOfficers(factionId)` | Players with officer-level permissions |
| `getPlayerStatistics()` | Aggregate statistics |
| `getTotalPlayerCount()` | Quick total count |
| `getFactionMemberCount(factionId)` | Member count for a faction |
| `getPlayerCountByPermission(role)` | Count by `PlayerRole` |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkDelete(ids, options?)` | Batch delete |
| `bulkUpdatePermissions(updates)` | Batch permission changes |
| `PlayersController.resetLastPlayerIdCache()` | _(static)_ Reset the ID cache |
| `PlayersController.getLastPlayerIdFromCache()` | _(static)_ Read the cached max ID |

> **ID caching**: the first `create()` call initializes an in-memory max-ID cache. Subsequent creations skip the `MAX(ID)` query. Reset the cache after an external database reset with `PlayersController.resetLastPlayerIdCache()`.

---

### SystemsController

Manages the `SYSTEMS` table — star systems and territorial ownership.

```typescript
import { SystemsController } from 'smtoolkit-db';
const ctrl = new SystemsController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `findSystems(options: SystemSearchOptions)` | List systems |
| `findByCoordinates(x, y, z)` | Find system at exact coordinates |
| `findByType(type, options?)` | Filter by `SystemType` |
| `findByOwnerFaction(factionId, options?)` | Systems owned by a faction |
| `findByOwnerUid(uid, options?)` | Systems owned by an entity |
| `findWithinDistance(center, radius, options?)` | Spatial radius search |
| `transferOwnership(id, newFactionId, newOwnerUid)` | Change owner |
| `releaseOwnership(id)` | Set to neutral/unowned |
| `claimSystem(id, factionId, ownerUid)` | Claim unowned system |
| `getTerritoryMap(options?)` | Full territorial breakdown |
| `getFactionTerritory(factionId, options?)` | All systems of a faction |
| `getAdjacentSystems(identifier)` | Neighboring systems |
| `getSystemStatistics()` | Aggregate statistics |
| `getTotalSystemCount()` | Quick total count |
| `getSystemCountByType(type)` | Count by type |
| `areCoordinatesAvailable(x, y, z)` | Check if coordinates are free |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkUpdateOwnership(updates)` | Batch ownership changes |
| `create(data, options?)` / `update(id, data)` / `delete(id)` | CRUD |

---

### SectorsController

Manages the `SECTORS` table — individual sectors within star systems and their protection levels.

```typescript
import { SectorsController } from 'smtoolkit-db';
const ctrl = new SectorsController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `findSectors(options: SectorSearchOptions)` | List sectors |
| `findByCoordinates(x, y, z)` | Find sector at exact coordinates |
| `findByType(type, options?)` | Filter by `SectorType` |
| `findBySystem(stellarId, options?)` | All sectors in a system |
| `findByProtectionLevel(level, options?)` | Filter by `ProtectionLevel` |
| `findWithProtection(protections, options?)` | Sectors with specific protection flags |
| `findWithinDistance(center, radius, options?)` | Spatial radius search |
| `findEmptyCoordinatesNear(center, radius)` | Find free sector coordinates |
| `findSectorsNeedingReplenishment(options?)` | Sectors due for item replenishment |
| `setProtectionLevel(id, level)` | Set protection level |
| `grantProtection(id, protection)` | Bitwise OR a protection flag |
| `revokeProtection(id, protection)` | Remove a protection flag |
| `createSafeZone(id)` | Apply full safe-zone protection |
| `removeAllProtection(id)` | Clear all protection flags |
| `getSpatialMap(options?)` | Grid distribution map |
| `getAdjacentSectors(identifier)` | Neighboring sectors |
| `replenishSectors(ids)` | Trigger item replenishment |
| `autoReplenishStaleSectors(options?)` | Auto-replenish overdue sectors |
| `getSectorStatistics()` | Aggregate statistics |
| `getTotalSectorCount()` | Quick total count |
| `getSectorCountByType(type)` | Count by type |
| `areCoordinatesAvailable(x, y, z)` | Check coordinate availability |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkUpdateProtection(updates)` | Batch protection changes |
| `create(data, options?)` / `update(id, data)` / `delete(id)` | CRUD |

---

### SectorsItemsController

Manages the `SECTORS_ITEMS` table — binary item storage linked to sectors.

```typescript
import { SectorsItemsController } from 'smtoolkit-db';
const ctrl = new SectorsItemsController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `findSectorsItems(options?)` | List sector item records |
| `findBySectorId(sectorId)` | Find storage for a sector |
| `findWithItems(options?)` | Records with non-empty storage |
| `findEmptyItems(options?)` | Empty storage records |
| `findAtCapacity(options?)` | Storage at maximum capacity |
| `findByEfficiencyRange(min, max, options?)` | Filter by storage efficiency |
| `analyzeStorageCapacity(options?)` | Storage distribution analysis |
| `getStorageStatistics()` | Aggregate statistics |
| `getTotalSectorsItemsCount()` | Quick total count |
| `getTotalStorageUsage()` | Used/total byte counts |
| `cleanupStorage(options?)` | Delete empty or expired records |
| `bulkCreate(records, options?)` | Batch insert |
| `create(data, options?)` / `update(id, data)` / `delete(id)` | CRUD |

---

### EffectsController

Manages the `EFFECTS` table — active status effects applied to entities.

```typescript
import { EffectsController } from 'smtoolkit-db';
const ctrl = new EffectsController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `findEffects(options: EffectSearchOptions)` | List effects |
| `findByEntityId(entityId, options?)` | All effects on an entity |
| `findByType(type, options?)` | Filter by `EffectType` |
| `findByCategory(category, options?)` | Filter by `EffectCategory` |
| `findByEffectUid(uid, exact?, options?)` | Find by UID pattern |
| `findRecognizedEffects(options?)` | Known/recognized effects |
| `findUnrecognizedEffects(options?)` | Unknown/unrecognized effects |
| `getEntityEffectSummary(entityId, options?)` | Summary object per entity |
| `addEffectToEntity(entityId, effectData)` | Apply an effect to an entity |
| `removeEffectsFromEntity(entityId, filter?)` | Remove matching effects |
| `clearEntityEffects(entityId)` | Remove all effects from entity |
| `getTotalEffectCount()` | Quick total count |
| `getEffectCountByEntity(entityId)` | Per-entity count |
| `entityHasEffects(entityId)` | Boolean check |
| `getEffectStatistics(options?)` | Aggregate statistics |
| `getCategoryAnalysis()` | Distribution by category |
| `bulkCreate(records, options?)` | Batch insert |
| `bulkUpdateByEntity(entityId, updates)` | Batch update for one entity |
| `bulkUpdate(updates)` | General batch update |
| `create(data, options?)` / `update(id, data)` / `delete(id)` | CRUD |

---

### IdGenTableController

Manages the `ID_GEN_TABLE` table — atomic primary key sequence generation.

```typescript
import { IdGenTableController } from 'smtoolkit-db';
const ctrl = new IdGenTableController();
await ctrl.initialize(manager);
```

| Method | Description |
|---|---|
| `initializeSequence(sequenceId, initialValue?, increment?)` | Create or reset a sequence |
| `getSequenceStatus(sequenceId)` | Current state of a sequence |
| `listSequences(options?)` | All sequences |
| `deleteSequence(sequenceId)` | Remove a sequence |
| `generateId(sequenceId)` | Atomic next-ID generation |
| `generateBatchIds(sequenceId, count)` | Reserve a block of IDs |
| `resetSequence(sequenceId, newValue)` | Reset to a specific value |
| `incrementSequence(sequenceId, incrementBy?)` | Advance by N |
| `peekNextId(sequenceId)` | Read next ID without consuming |
| `sequenceExists(sequenceId)` | Boolean existence check |
| `getNextMineId()` | Convenience: next mine ID |

> **Thread safety**: `generateId` uses a database-level transaction to guarantee atomic allocation even under concurrent load.

---


---

## 4. Error Classes

| Class | Code | When thrown |
|---|---|---|
| `HSQLDBError` | base | Generic HSQL error |
| `ConnectionError` | `CONNECTION_ERROR` | DB connection failures |
| `QueryExecutionError` | `QUERY_EXECUTION_ERROR` | SQL query failures |
| `ValidationError` | `VALIDATION_ERROR` | Input validation failures |
| `ModuleNotInitializedError` | `MODULE_NOT_INITIALIZED` | Controller used before `initialize()` |
| `ConflictError` | `CONFLICT_ERROR` | Duplicate record conflicts |
| `SQLRequiredFieldError` | `SQL_REQUIRED_FIELD` | Missing required DB field |
| `SQLConstraintViolationError` | `SQL_CONSTRAINT_VIOLATION` | FK / unique constraint violation |

---

## 5. Type Reference

### Enumerations

| Enum | Location | Values |
|---|---|---|
| `FleetCommand` | `fleets/FleetsModel` | IDLE, MOVE_FLEET, PATROL_FLEET, … |
| `FactionAccess` | `fleets/FleetsModel` | NONE(0) … ALL(5) |
| `CombatSetting` | `fleets/FleetsModel` | PASSIVE, SOMETIMES_ENGAGE, ALWAYS_ENGAGE, ALWAYS_FLEE |
| `MissionString` | `fleets/FleetsModel` | IDLE, ATTACKING, DEFENDING, MINING, … |
| `FleetType` | `fleets/FleetsModel` | ATTACKING, DEFENDING, MINING, TRADING, SCAVENGING |
| `FleetMissionCategory` | `fleets/FleetsModel` | IDLE, MOVEMENT, COMBAT, OPERATIONS, SPECIAL |
| `MemberMissionState` | `fleet-members/FleetMembersModel` | IDLE, MINING, ATTACKING, … |
| `MissionCategory` | `fleet-members/FleetMembersModel` | IDLE, MOVEMENT, COMBAT, OPERATIONS, SUPPORT, SPECIAL |
| `TradePermissionFlag` | `trade-nodes/TradeNodesModel` | NEUTRAL(1), FACTION(2), ALLY(4), NPC(8), ENEMY(16) |
| `TradePermissionPreset` | `trade-nodes/TradeNodesModel` | NO_ACCESS(0) … UNIVERSAL_ACCESS(31) |
| `FtlType` | `ftl/FtlModel` | WARP_GATE(0), WORM_HOLE(1), RACE_WAY(2) |
| `FtlPermission` | `ftl/FtlModel` | NO_SPAWN(1), NO_ATTACK(2), NO_ENTER(4), NO_EXIT(8), … |
| `MineArmingState` | `mines/MinesModel` | DISARMED, ARMING, ARMED, DEPLETED |
| `MineStatus` | `mines/MinesModel` | ACTIVE, DESTROYED, EXPIRED, DISABLED |
| `KnownObserver` | `visibility/VisibilityModel` | SYSTEM(0), TRADING_GUILD, OUTCASTS, SCAVENGERS |

### BulkOperationResult

```typescript
interface BulkOperationResult {
    success: number;
    failed: number;
    skipped: number;
    errors: Array<{ index: number; error: string; data?: any }>;
}
```
