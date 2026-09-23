# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.2] – 2026-09-23

### Fixed

- Align fleet, sector, planet and system types with StarMade-Open `e5a3b49d8`, together with the sibling Decoder correction for zlib trade data and 16-byte resources.
- Add combined targeting, JSON message history and cargo capacity columns, accessors and validation; reject incomplete fleet-member keys before lookup.
- Preserve absent resource data and expose explicit `legacy-sdk` decoding for previous SDK bytes without automatic database migration.
- Add independent format contracts and native JDBC acceptance tests; update schema guides, executable SQL examples and public/private API references.

## [2.0.1] – 2026-09-20

### Maintenance

- Consolidate getting-started/API documentation and controller validation evidence; correct broken schema links and obsolete contribution/security instructions.
- Remove unused Mocha/ts-node configuration, the empty TypeScript project, redundant npm aliases and retired JDBC/sandbox prototypes; keep the active test runner, production build and database explorer.
- Stop tracking IDE caches, intermediate build output, generated reports and compiled Java helpers; preserve local copies and historical SQL data.
- Retain all executable source files, test assertions, database fixtures and per-file 100% line/branch coverage gates.

### Fixed

- Store fleet remotes consistently as Java ObjectOutputStream data, reject incomplete recovered objects, and document strict command decoding.
- Adapt legacy 16-byte system resource cells to the current 19-slot decoder; expose explicit 19-byte writes and reject lossy conversions.
- Remove proprietary StarMade Java sources from the tracked tree and npm package; retain local references only.
- Validate table schemas against database metadata without requiring proprietary source files.

## [2.0.0] – 2026-09-12

### Compatibility

- Requires Node.js 20.19+ on the 20.x line, or Node.js 22.12+; older runtimes are no longer supported.
- Invalid SQL identifiers, pagination, validation decisions and failed mutations now raise errors instead of being accepted or silently ignored.
- Generated BIGINT identities preserve JDBC precision and may be strings; callers must not assume a JavaScript number.
- Cache optimization suggestions are advisory; unsupported HTTP metric exports raise an explicit error.

### Fixed

- Retrieve generated identities on the insertion session and preserve BIGINT precision.
- Reject invalid lazy relationship targets and incomplete column references; keep relationship dictionaries free of inherited properties.
- Reserve pooled connections before asynchronous health checks and count pending creations against capacity.
- Isolate JDBC pools by factory, URL and configuration; close only owned sessions during manager destruction.
- Restore transaction session settings and invoke the correct no-savepoint JDBC rollback overload.
- Await global rollbacks, invalidate completed contexts before session reuse, reserve pending transaction IDs/capacity, and surface cleanup failures.
- Preserve exact query cache keys, invalidate executor caches after mutations, and validate SQL independently of metrics.
- Forward query deadlines and row limits to JDBC; close statements after binding and execution errors.
- Reject unsafe controller sort/update identifiers and invalid pagination values.
- Replace CommonJS model imports with ESM imports and provide the declared `starmade-db/interfaces` export.

- Validate every batch row, preserve SQL literal case in statement keys, and recognize named placeholders outside quoted literals only.
- Honor per-call SQL validation policies and reject validator failures; ignore quoted parentheses in syntax checks.
- Allocate ID ranges using affected-row-checked compare-and-swap and bypass stale cache entries during allocation.
- Align table identity flags, sector coordinate rules, fleet parsing, docking checks and mutation counts with schema/game evidence.
- Expire internal schema caches and invalidate only matching schema entries in the shared cache.
- Read HSQLDB indexes and correctly pair composite foreign-key columns and actions; handle nullable composite references and quoted identifiers.
- Preserve zero numeric averages and finite quality scores for all-null columns.
- Write metric exports, preserve threshold severity, escape reports and identify advisory cache recommendations accurately.
- Keep configured console logging active and create nested log directories.
- Copy manager configuration arrays and prevent duplicate/self-registration and inherited-property module lookups.

### Changed

- Update the test/dependency toolchain and remove unused nodemon; Node.js minimum is now 20.19 (20.x) or 22.12.
- Run tests against disposable copies of the database fixture and preserve the test process exit status.
- Enforce 100% source line and branch coverage per file in the coverage command.
- Check JSDoc descriptions for public, protected and private declarations and generate source-derived references.
- Correct README examples, module identifiers, setup requirements and documented limitations.

## [1.3.0] – 2026-05-14

### Added

#### VARBINARY encode/write helpers for `starmade-decoder` objects

Completes the `starmade-decoder` integration with write-back helpers matching the existing `decode*()` APIs:

- **`FleetsModel.encodeCommand()`** — writes `FLEETS.COMMAND` from a `FleetCommandObject` or raw `FleetCommand` structure.
- **`FleetsModel.encodeRemotes()`** — writes `FLEETS.SAVED_REMOTES` from a `FleetRemotesObject`, `Map<string, boolean>`, or plain record. Uses the portable DataOutput/network format.
- **`SectorsItemsModel.encodeItems()`** — writes `SECTORS_ITEMS.ITEMS` from a `SectorItemsObject` or `FreeItem[]`.
- **`SystemsModel.encodeStarSystem()`** — writes both `SYSTEMS.INFOS` and `SYSTEMS.RESOURCES` from a `StarSystem` object.
- **`SystemsModel.encodeInfos()`** — writes `SYSTEMS.INFOS` from typed `SectorInfo[]` entries.
- **`SystemsModel.encodeResources()`** — writes `SYSTEMS.RESOURCES` from typed `SystemResource[]` entries.
- **`TradeNodesModel.encodeItems()`** — writes `TRADE_NODES.ITEMS` from a `TradePricesObject` or raw `TradePrices` structure.

This enables full typed read → immutable mutation → write-back workflows directly from the DB models.

---

## [1.2.0] – 2026-05-12

### Added

#### StarMade-Decoder integration

Adds `starmade-decoder` as a dependency and exposes typed `decode*()` methods
on the 4 models that store custom binary-serialized VARBINARY columns.
All existing accessors (`getCommand()`, `getItems()`, etc.) are unchanged —
decode methods are additive and lazy (`require()` at call time).

- **`FleetsModel.decodeCommand()`** → `FleetCommandObject | null`
  Decodes `FLEETS.COMMAND` (VARBINARY 1024): typed fleet command with
  `commandType`, `fleetDbId`, `args` (vec3i, string, boolean…).

- **`FleetsModel.decodeRemotes()`** → `FleetRemotesObject`
  Decodes `FLEETS.SAVED_REMOTES` (VARBINARY 1024): handles both the network
  DataOutput format and the Java ObjectOutputStream format (AC ED magic).
  Exposes `activeNames`, `isActive()`, `has()`, `size`.

- **`SectorsItemsModel.decodeItems()`** → `SectorItemsObject`
  Decodes `SECTORS_ITEMS.ITEMS` (VARBINARY 22 KB): typed item stacks with
  `blockType`, `count`, `posX/Y/Z`, `metaId` per entry.
  Exposes `byType()`, `totalCount()`, `types`, `withItem()`, `withMerged()`.

- **`SystemsModel.decodeStarSystem()`** → `StarSystem | null`
  Decodes `SYSTEMS.INFOS` + `SYSTEMS.RESOURCES`: full 16³ sector grid
  (SectorType enum + PlanetType for planet sectors) and 19-resource density
  array. Exposes `planets`, `sunSectors`, `presentResources`,
  `withSectorType()`, `withResourceDensity*()`, `infosToBytes()`,
  `resourcesToBytes()`.

- **`SystemsModel.decodeResources()`** → `SystemResource[]`
  Convenience shortcut for resource-only access without loading the full
  sector grid.

- **`TradeNodesModel.decodeItems()`** → `TradePricesObject | null`
  Decodes `TRADE_NODES.ITEMS` (VARBINARY 20 KB): zlib raw-DEFLATE compressed
  TradePrices payload. Exposes `buyOrders`, `sellOrders`, `getBuyOrder()`,
  `getSellOrder()`, `withBuyOrder()`, `withSellOrder()`, `toBytes()`.

### Fixed

- **`FleetsModel.FleetCommand` enum** : `REPAIR_FLEET = 4` was missing, causing
  all subsequent ordinals to be off by one (`FLEET_ATTACK` was 4 instead of 5,
  `FLEET_DEFEND` was 5 instead of 6, etc.). Corrected to match the Java
  `FleetCommandTypes` enum exactly (22 entries, ordinals 0–21).

- **`SystemsModel.RESOURCE_COUNT` and `MAX_RESOURCES_SIZE`** : were set to 16,
  correct value is **19** (source: `VoidSystem.RESOURCES = 19` in StarMade-Open).

---

## [1.1.0] – 2026-05-06

### Added

#### Controllers (9 new)

- **`FleetsController`** (`src/tables/fleets/FleetsController.ts`)
  - Full CRUD, search by owner / flagship / parent / mission / combat / NPC status
  - Fleet hierarchy tree builder (`getFleetHierarchy`)
  - Child count helper (`countChildren`)
  - Mission and combat-setting shortcuts (`updateMission`, `updateCombatSetting`)
  - Comprehensive statistics (`getStatistics`)
  - Bulk create / update / delete

- **`FleetMembersController`** (`src/tables/fleet-members/FleetMembersController.ts`)
  - Full CRUD with composite PK `(FLEET_ID, ENTITY_ID)`
  - Duplicate prevention, search by fleet / entity / mission state
  - `removeAllFromFleet`, member count helper
  - Statistics: distinct fleets, entities, mission distribution, average members
  - Bulk create / delete

- **`TradeNodesController`** (`src/tables/trade-nodes/TradeNodesController.ts`)
  - Full CRUD, search by owner / faction / permission / NPC
  - Bitwise `updatePermissions` with range validation
  - Statistics: NPC vs player nodes, open/closed/permission distribution
  - Bulk create / delete

- **`FtlController`** (`src/tables/ftl/FtlController.ts`)
  - Full CRUD, search by type / from-sector / to-sector / permission preset
  - `findFromSector`, `findToSector` helpers
  - Statistics: by type, peace-zone, locked, unrestricted counts
  - Bulk create / delete

- **`MinesController`** (`src/tables/mines/MinesController.ts`)
  - Full CRUD, search by owner / sector / armed state / NPC
  - `armMine`, `disarmMine` convenience methods
  - `countInSector` helper
  - Statistics: armed / arming / disarmed / depleted, faction distribution
  - Bulk create / delete

- **`NpcStatsController`** (`src/tables/npc-stats/NpcStatsController.ts`)
  - Full CRUD with composite PK `(ID, SYS_X, SYS_Y, SYS_Z)`
  - Upsert-style `incrementFleetSpawns` / `incrementEntitySpawns`
  - `findMostActive` for activity-sorted results
  - Statistics: distinct factions/systems, total spawns, most active
  - Bulk create / delete

- **`PlayerMessagesController`** (`src/tables/player-messages/PlayerMessagesController.ts`)
  - Full CRUD, inbox/outbox helpers, conversation view
  - `markAsRead`, `markAllAsRead`, `countUnread`, `deleteAllForPlayer`
  - Self-message prevention, auto-timestamp
  - Statistics: read/unread, attachments, top senders/receivers
  - Bulk create / delete

- **`TradeHistoryController`** (`src/tables/trade-history/TradeHistoryController.ts`)
  - Full CRUD (table currently unused in game engine – implemented for future use)
  - Search by owner, faction, success state, date range, cost threshold
  - Cost and timestamp validation
  - Statistics: totals, averages, success/fail ratio, top factions
  - Bulk create / delete

- **`VisibilityController`** (`src/tables/visibility/VisibilityController.ts`)
  - Full CRUD with composite PK `(ID, X, Y, Z)`
  - `hasVisibility`, `markAsObserved` (upsert), `clearObserver`
  - `findByObserver`, `findBySector`, `findNPCObservations`, `findMostRecent`
  - `countByObserver`, `countBySector`
  - Statistics: distinct observers/sectors, NPC vs player observations, top explorers
  - Bulk create / delete

#### Tests (9 new test files)

- `tests/tables/fleets/FleetsController.test.ts`
- `tests/tables/fleet-members/FleetMembersController.test.ts`
- `tests/tables/trade-nodes/TradeNodesController.test.ts`
- `tests/tables/ftl/FtlController.test.ts`
- `tests/tables/mines/MinesController.test.ts`
- `tests/tables/npc-stats/NpcStatsController.test.ts`
- `tests/tables/player-messages/PlayerMessagesController.test.ts`
- `tests/tables/trade-history/TradeHistoryController.test.ts`
- `tests/tables/visibility/VisibilityController.test.ts`

Each test file covers:
- Initialization / not-initialized guard
- Existence checks
- CRUD (create, find, update, delete) – positive and negative paths
- Validation errors (missing fields, out-of-range values, duplicates, self-reference)
- Domain-specific helpers
- Bulk operations (success, skip, error handling)
- Statistics object shape and invariants

#### Module Registry

- `src/tables/index.ts` updated:
  - 9 new controller imports and re-exports
  - All new TypeScript types exported
  - `ControllerClasses` map extended with all 9 new controllers
  - `TableController` union type updated

### Changed

- `src/tables/index.ts`: `ControllerClasses` now covers all 16 tables (previously 7)

---

## [1.0.0] – Initial release

- Core module architecture (HSQLManager, ConnectionManager, CacheManager, etc.)
- 16 table Models
- 7 initial Controllers (IdGenTable, Entities, Players, Systems, Sectors, SectorsItems, Effects)
- Complete test suite for initial controllers
- API documentation, CONTRIBUTING, SECURITY
