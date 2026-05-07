# StarMade-DB API Guide

> Practical guide for using the StarMade HSQLDB API from TypeScript/JavaScript.
>
> Verified against the current test suite: **2782 passing / 0 pending / 0 failing**.

---

## 1. What this package provides

`starmade-db` is a Node.js/TypeScript API for reading and writing StarMade server HSQLDB worlds through JDBC. It provides:

- `HSQLManager`: lifecycle, configuration, module registry and database connection setup.
- Table controllers: typed domain APIs for StarMade tables (`PlayersController`, `EntitiesController`, `SectorsController`, etc.).
- Models: wrappers around rows with getters, validation helpers and domain methods.
- Core modules: parameterized queries, schema analysis, relationship analysis, transactions, caching, metrics and reconnection.

---

## 2. Requirements

- Node.js >= 20
- Java/JDK available at runtime for the JDBC bridge
- A StarMade installation or compatible sandbox layout containing a world database

For local tests in this repository, use:

```bash
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npm test
```

---

## 3. Installation and imports

```bash
npm install starmade-db
```

```ts
import {
  HSQLManager,
  PlayersController,
  EntitiesController,
  SectorsController,
  PlayerRole,
  EntityType,
  SectorType
} from 'starmade-db';
```

The package also exposes subpath exports:

```ts
import { HSQLManager } from 'starmade-db/core';
import { QueryExecutionError } from 'starmade-db/errors';
```

---

## 4. Manager lifecycle

Always create one `HSQLManager`, initialize it once, then destroy it when finished.

```ts
import { HSQLManager } from 'starmade-db';

const manager = new HSQLManager({
  starmadeDir: '/opt/starmade',
  worldName: 'world',
  connection: {
    readOnly: true,
    timeoutMs: 30_000,
    maxRetries: 3,
    autoCommit: true,
    maxConcurrentConnections: 10
  },
  modules: {
    enableParameterizedQueries: true,
    enableQueryValidation: true,
    enableAdvancedCaching: true,
    enableConnectionFactory: true
  },
  logging: {
    level: 'info',
    enableConsole: true,
    enableFile: false
  }
});

try {
  await manager.initialize();
  console.log(manager.getStatus());
} finally {
  await manager.destroy();
}
```

### Read-only vs write mode

Use read-only mode for dashboards, exports and inspection tools. Use write mode only when intentionally modifying the world database.

```ts
const manager = new HSQLManager({
  starmadeDir: '/opt/starmade',
  worldName: 'world',
  connection: { readOnly: false, autoCommit: true }
});
```

---

## 5. Controllers: common pattern

Controllers are the recommended API for table access.

```ts
const players = new PlayersController();
await players.initialize(manager);

const admins = await players.findPlayersWithPermission(PlayerRole.ADMIN, {
  limit: 20,
  orderBy: 'NAME',
  orderDirection: 'ASC'
});

for (const player of admins) {
  console.log(player.getName(), player.getFaction());
}
```

Most controllers support the same broad families of methods:

| Family | Examples |
|---|---|
| Existence | `playerExistsByName`, `fleetExistsById`, `membershipExists` |
| Search | `findPlayers`, `findEntities`, `findSectors`, `findAll` |
| Lookup | `findById`, `findOne`, `findByCoordinates`, `findPlayerByName` |
| Write | `create`, `update`, `delete` |
| Bulk | `bulkCreate`, `bulkUpdate`, `bulkDelete` |
| Analytics | `getStatistics`, `getEntityAnalytics`, `performSpatialAnalysis` |

### Query options

```ts
const page = await players.findPlayers({
  searchTerm: 'admin',
  limit: 50,
  offset: 0,
  orderBy: 'NAME',
  orderDirection: 'ASC',
  skipCache: false
});
```

Common `QueryOptions` fields:

| Option | Purpose |
|---|---|
| `limit` | Maximum rows returned |
| `offset` | Pagination offset |
| `orderBy` | Column to sort by |
| `orderDirection` | `ASC` or `DESC` |
| `skipCache` | Bypass controller cache |
| `cacheTtl` | Override cache TTL in ms |

---

## 6. Common table APIs

### Players

```ts
const players = new PlayersController();
await players.initialize(manager);

const player = await players.findPlayerByName('admin_leader');
const factionMembers = await players.findPlayersByFaction(1, { limit: 100 });
const leaders = await players.getFactionLeaders(1);

await players.grantPermission(2147483647, PlayerRole.ADMIN);
await players.transferToFaction(2147483600, 2);
```

Useful methods:

- `findPlayers(options)`
- `findPlayerByName(name)` / `findPlayerByAccountName(name)` / `findPlayerByStarMadeName(name)`
- `findPlayersByFaction(factionId)`
- `grantPermission`, `revokePermission`, `setPlayerRole`, `promotePlayer`, `demotePlayer`
- `transferToFaction`, `leaveFaction`
- `getPlayerAnalytics`, `getPlayerStatistics`
- `bulkCreate`, `bulkDelete`, `bulkUpdatePermissions`

### Entities

```ts
const entities = new EntitiesController();
await entities.initialize(manager);

const ship = await entities.findEntityByUID('ENTITY_SHIP_UID');
const factionShips = await entities.findEntities({
  entityType: EntityType.SHIP,
  factionId: 1,
  limit: 50
});

const nearby = await entities.findEntitiesWithinRadius(0, 0, 0, 5);
const stats = await entities.getEntityStatistics();
```

Useful methods:

- `findEntities(options)`
- `findEntityByUID(uid)`
- `findEntitiesByType(type)`
- `findEntitiesByFaction(factionId)`
- `findEntitiesInSector(x, y, z)`
- `findEntitiesWithinRadius(x, y, z, radius)`
- `getDockingChain`, `validateDockingChain`
- `performSpatialAnalysis`, `getEntityAnalytics`, `getEntityStatistics`

### Sectors

```ts
const sectors = new SectorsController();
await sectors.initialize(manager);

const origin = await sectors.findByCoordinates(0, 0, 0);
const asteroids = await sectors.findByType(SectorType.ASTEROID, { limit: 25 });

if (origin) {
  const systemSectors = await sectors.findBySystem(origin.getStellar());
  console.log(systemSectors.length);
}
```

Useful methods:

- `findSectors(options)`
- `findByCoordinates(x, y, z)`
- `findByType(sectorType)`
- `findBySystem(stellarId)`
- `findByProtectionLevel(level)`
- `findWithProtection(flags)`
- `performSpatialAnalysis`, `getSectorStatistics`

### Systems

```ts
const systems = new SystemsController();
await systems.initialize(manager);

const all = await systems.findSystems({ limit: 100 });
const owned = await systems.findByOwnerFaction(1);
```

Useful methods include system search, ownership/territory operations, bulk operations and statistics.

### Fleets and fleet members

```ts
const fleets = new FleetsController();
const members = new FleetMembersController();
await fleets.initialize(manager);
await members.initialize(manager);

const playerFleets = await fleets.findPlayerFleets();
const hierarchy = await fleets.getFleetHierarchy();

const exists = await members.membershipExists(1, 42);
if (!exists) {
  await members.create({
    FLEET_ID: 1,
    ENTITY_ID: 42,
    MISSION_STRING: 'IDLE',
    LIST_INDEX: 0,
    DOCKED_TO: -1,
    FACTION: 0
  });
}
```

Important: `FleetMembersController.delete()` accepts the public membership key:

```ts
await members.delete({ fleetId: 1, entityId: 42 });
```

### Effects

```ts
const effects = new EffectsController();
await effects.initialize(manager);

const speed = await effects.findByEffectUid('SPEED_BOOST', true);
const entityEffects = await effects.findByEntityId(42);
const summary = await effects.getEntityEffectSummary(42);
```

### Trade, FTL, mines, messages and visibility

The following controllers expose the same initialize/search/create/update/delete/statistics pattern:

| Controller | Domain |
|---|---|
| `TradeNodesController` | Marketplace/trade nodes |
| `TradeHistoryController` | Completed trade records |
| `FtlController` | FTL jump links |
| `MinesController` | Minefields and arming state |
| `NpcStatsController` | NPC spawn/activity counters |
| `PlayerMessagesController` | In-game messages and read state |
| `VisibilityController` | Sector/player visibility intelligence |
| `SectorsItemsController` | Sector inventory binary data |
| `IdGenTableController` | Atomic ID generation/sequences |

---

## 7. Raw SQL and parameterized queries

Prefer controllers for application code. Use raw modules for diagnostics, reporting and advanced queries.

```ts
const query = manager.getModule<any>('parameterized-query');
if (!query) throw new Error('Parameterized query module is disabled');

const result = await query.execute(
  'SELECT TOP 10 ID, NAME FROM PLAYERS WHERE LOWER(NAME) LIKE ?',
  ['%admin%']
);

for (const row of result.rows) {
  console.log(row);
}
```

HSQLDB compatibility notes used throughout this codebase:

- Use `TOP n`, not `LIMIT n`.
- Avoid reserved aliases such as `count`; use `cnt`, `total_count`, etc.
- For last identity in HSQLDB 2.3.4, use:

```sql
SELECT IDENTITY() FROM (VALUES(0)) t(x)
```

---

## 8. Transactions

```ts
const txManager = manager.getModule<any>('TransactionManager');
if (!txManager) throw new Error('TransactionManager module is not available');

const tx = await txManager.beginTransaction({
  isolationLevel: 'READ_COMMITTED',
  readOnly: false
});

try {
  await tx.execute('UPDATE PLAYERS SET FACTION = ? WHERE ID = ?', [2, 2147483600]);
  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}
```

---

## 9. Error handling

The API exports typed errors from `starmade-db/errors` and the root package.

```ts
import {
  ValidationError,
  QueryExecutionError,
  ModuleNotInitializedError,
  SQLConstraintViolationError
} from 'starmade-db';

try {
  await players.create({ NAME: '' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input', error.message);
  } else if (error instanceof QueryExecutionError) {
    console.error('Database query failed', error.message);
  } else {
    throw error;
  }
}
```

Common categories:

| Error | Typical cause |
|---|---|
| `ModuleNotInitializedError` | Controller/module used before `initialize()` |
| `ValidationError` | Missing/invalid input field |
| `QueryExecutionError` | SQL or JDBC failure |
| `SQLConstraintViolationError` | Primary key, foreign key or uniqueness violation |
| `ConfigurationError` | Invalid manager configuration |
| `WorldNotFoundError` | Configured StarMade world does not exist |

---

## 10. Model usage

Controllers return model instances, not plain objects. Use model getters and methods instead of assuming raw property names.

```ts
const player = await players.findPlayerByName('admin_leader');
if (player) {
  console.log(player.getId());
  console.log(player.getName());
  console.log(player.getFaction());
}
```

For inserts/updates, pass database column names in the data object unless the controller documents a higher-level option.

```ts
await players.create({
  NAME: 'new_player',
  STARMADE_NAME: 'new_player',
  FACTION: 0,
  PERMISSION: 0
}, { autoGenerateId: true });
```

---

## 11. Safe write workflow

When writing tools that modify a StarMade world:

1. Start with `connection.readOnly: true` while developing queries.
2. Switch to `readOnly: false` only for the write path.
3. Validate foreign keys before creating related records.
4. Prefer controller methods over raw SQL.
5. Use transactions for multi-step writes.
6. Always call `manager.destroy()` in `finally`.
7. Back up the world database before running bulk operations.

---

## 12. Minimal complete example

```ts
import {
  HSQLManager,
  PlayersController,
  EntitiesController,
  PlayerRole,
  EntityType
} from 'starmade-db';

const manager = new HSQLManager({
  starmadeDir: '/opt/starmade',
  worldName: 'world',
  connection: { readOnly: true },
  logging: { level: 'error', enableConsole: false }
});

try {
  await manager.initialize();

  const players = new PlayersController();
  const entities = new EntitiesController();
  await players.initialize(manager);
  await entities.initialize(manager);

  const admins = await players.findPlayersWithPermission(PlayerRole.ADMIN);
  const ships = await entities.findEntitiesByType(EntityType.SHIP, { limit: 20 });

  console.log({ admins: admins.length, ships: ships.length });
} finally {
  await manager.destroy();
}
```

---

## 13. Where to find table-specific details

- Database/table docs: `docs/database/INDEX.md`
- Per-table examples: `docs/database/EXEMPLE_*.md`
- Source of truth for exported APIs: `src/core/index.ts` and `src/tables/index.ts`
- Tests as executable examples: `tests/**/*.test.ts`
