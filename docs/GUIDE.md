# Getting Started with SMToolkit-DB

This guide walks you through connecting to a StarMade server database, reading game data, and making modifications — no prior knowledge of HSQLDB or the StarMade database schema required.

---

## Table of Contents

1. [What is SMToolkit-DB?](#1-what-is-smtoolkit-db)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [The StarMade database at a glance](#4-the-starmade-database-at-a-glance)
5. [Which controller for which table?](#5-which-controller-for-which-table)
6. [Setup and initialization](#6-setup-and-initialization)
7. [Reading data](#7-reading-data)
8. [Writing data](#8-writing-data)
9. [Bulk operations](#9-bulk-operations)
10. [Error handling](#10-error-handling)
11. [Common pitfalls](#11-common-pitfalls)

---

## 1. What is SMToolkit-DB?

SMToolkit-DB is a TypeScript library that connects to a StarMade server's **HSQLDB** database and gives you typed, validated access to all 16 game tables. It supports:

- Reading players, entities (ships, stations), sectors, systems, fleets, trading nodes, and more.
- Inserting, updating, and deleting records with automatic validation.
- Atomic ID generation, bulk operations, spatial queries, and analytics.

---

## 2. Prerequisites

- **Node.js ≥ 18**
- **Java 8+** — required for the HSQLDB JDBC driver included in `dist/lib/hsqldb.jar`
- A StarMade server installation with a world (the database lives at `server-database/<worldName>/`)

---

## 3. Installation

```bash
npm install smtoolkit-db
```

Or from the repository:

```bash
git clone https://github.com/blackcancer/smtoolkit-db
cd smtoolkit-db
npm install
npm run build
npm test
```

---

## 4. The StarMade database at a glance

The StarMade server uses an embedded **HSQLDB 2.3.4** database located at:

```
StarMade/
└── server-database/
    └── <worldName>/          ← set as worldName in HSQLManager config
        ├── *.script          ← SQL script (human-readable schema + data)
        ├── *.data            ← binary data pages
        ├── *.lck             ← lock file (server must be stopped before connecting!)
        └── *.properties      ← database settings
```

> ⚠️ **Always stop the StarMade server before connecting.** HSQLDB uses an exclusive file lock. Connecting while the server is running can corrupt the database.

### The 16 tables

| Category | Tables |
|---|---|
| **Core** | `PLAYERS`, `ENTITIES`, `SECTORS`, `SYSTEMS` |
| **Fleet management** | `FLEETS`, `FLEET_MEMBERS` |
| **Game mechanics** | `EFFECTS`, `FTL`, `MINES` |
| **Economy** | `TRADE_NODES`, `TRADE_HISTORY` _(unused)_ |
| **Infrastructure** | `SECTORS_ITEMS`, `VISIBILITY`, `NPC_STATS`, `PLAYER_MESSAGES` |
| **Internal** | `ID_GEN_TABLE` |

### Key relationships

```
SYSTEMS (1) ──< SECTORS (N)        ← systems contain sectors
SECTORS (1) ──< ENTITIES (N)       ← entities live in sectors
ENTITIES (1) ──< FLEET_MEMBERS (N) ← entities belong to fleets (FK enforced)
FLEETS (1)  ──< FLEET_MEMBERS (N)  ← fleets have members (FK enforced)
ENTITIES (1) ──< EFFECTS (N)       ← entities can have active effects
ENTITIES (1)  ── TRADE_NODES (1)   ← station entities can be trade nodes
```

---

## 5. Which controller for which table?

| Table | Controller | Import |
|---|---|---|
| `PLAYERS` | `PlayersController` | `import { PlayersController } from 'smtoolkit-db'` |
| `ENTITIES` | `EntitiesController` | `import { EntitiesController } from 'smtoolkit-db'` |
| `SECTORS` | `SectorsController` | `import { SectorsController } from 'smtoolkit-db'` |
| `SYSTEMS` | `SystemsController` | `import { SystemsController } from 'smtoolkit-db'` |
| `EFFECTS` | `EffectsController` | `import { EffectsController } from 'smtoolkit-db'` |
| `FLEETS` | `FleetsController` | `import { FleetsController } from 'smtoolkit-db'` |
| `FLEET_MEMBERS` | `FleetMembersController` | `import { FleetMembersController } from 'smtoolkit-db'` |
| `TRADE_NODES` | `TradeNodesController` | `import { TradeNodesController } from 'smtoolkit-db'` |
| `TRADE_HISTORY` | `TradeHistoryController` | `import { TradeHistoryController } from 'smtoolkit-db'` |
| `FTL` | `FtlController` | `import { FtlController } from 'smtoolkit-db'` |
| `MINES` | `MinesController` | `import { MinesController } from 'smtoolkit-db'` |
| `NPC_STATS` | `NpcStatsController` | `import { NpcStatsController } from 'smtoolkit-db'` |
| `PLAYER_MESSAGES` | `PlayerMessagesController` | `import { PlayerMessagesController } from 'smtoolkit-db'` |
| `SECTORS_ITEMS` | `SectorsItemsController` | `import { SectorsItemsController } from 'smtoolkit-db'` |
| `VISIBILITY` | `VisibilityController` | `import { VisibilityController } from 'smtoolkit-db'` |
| `ID_GEN_TABLE` | `IdGenTableController` | `import { IdGenTableController } from 'smtoolkit-db'` |

You can also import everything from the root package:

```typescript
import {
  HSQLManager,
  PlayersController, EntitiesController, FleetsController,
  // ...
} from 'smtoolkit-db';
```

---

## 6. Setup and initialization

### Minimal setup

```typescript
import { HSQLManager } from 'smtoolkit-db';

const manager = new HSQLManager({
  starmadeDir: '/path/to/StarMade',
  worldName: 'world0',          // matches server-database/<worldName>/
});

await manager.initialize();
console.log('Connected to database');

// ... use controllers

await manager.destroy();
console.log('Connection closed');
```

### Full configuration

```typescript
const manager = new HSQLManager({
  starmadeDir: '/path/to/StarMade',
  worldName: 'world0',
  connection: {
    timeoutMs: 10_000,    // connection timeout in ms
    readOnly: false,       // true = safe read-only mode
    retryAttempts: 3,
  },
  modules: {
    enableRelationshipAnalysis: true,
    enableQueryValidation: true,
    enablePerformanceMonitoring: true,
    enableParameterizedQueries: true,
  },
  logging: {
    level: 'info',         // 'debug' | 'info' | 'warn' | 'error'
  },
});

await manager.initialize();
```

### Initialize a controller

Every controller follows the same pattern: construct, then call `initialize(manager)`.

```typescript
import { PlayersController } from 'smtoolkit-db';

const players = new PlayersController();
await players.initialize(manager);

// Ready to use
const all = await players.findPlayers();
```

> Always call `await ctrl.initialize(manager)` before any other method. Using a controller before initialization throws `ModuleNotInitializedError`.

---

## 7. Reading data

### Find all players

```typescript
const all = await players.findPlayers();
console.log(`${all.length} players`);
for (const p of all) {
  console.log(`[${p.ID}] ${p.NAME} / ${p.STARMADE_NAME} — faction: ${p.FACTION}`);
}
```

### Find by name

```typescript
const player = await players.findPlayerByAccountName('InitSysRev');
if (!player) {
  console.log('Player not found');
} else {
  console.log('Permission mask:', player.PERMISSION);
}
```

### Find entities in a sector

```typescript
import { EntitiesController } from 'smtoolkit-db';

const entities = new EntitiesController();
await entities.initialize(manager);

const inSector = await entities.findEntitiesInSector(4, 4, 4);
for (const e of inSector) {
  console.log(`${e.TYPE} — ${e.UID} (faction ${e.FACTION})`);
}
```

### Spatial search within radius

```typescript
const nearby = await entities.findEntitiesWithinRadius(
  { x: 4, y: 4, z: 4 },  // center
  5                        // radius in sectors
);
console.log(`${nearby.length} entities within radius 5`);
```

### Paginate large result sets

```typescript
const page1 = await players.findPlayers({ limit: 50, offset: 0, orderBy: 'NAME' });
const page2 = await players.findPlayers({ limit: 50, offset: 50, orderBy: 'NAME' });
```

### Fleet membership

```typescript
import { FleetsController, FleetMembersController } from 'smtoolkit-db';

const fleets = new FleetsController();
const members = new FleetMembersController();
await fleets.initialize(manager);
await members.initialize(manager);

const playerFleets = await fleets.findPlayerFleets();
for (const fleet of playerFleets) {
  const fleetMembers = await members.findByFleet(fleet.ID);
  console.log(`Fleet [${fleet.ID}] — ${fleetMembers.length} members`);
}
```

### Systems owned by a faction

```typescript
import { SystemsController } from 'smtoolkit-db';

const systems = new SystemsController();
await systems.initialize(manager);

const territory = await systems.getFactionTerritory(12345);
console.log(`Faction 12345 controls ${territory.length} systems`);
```

---

## 8. Writing data

### Create a player

```typescript
const newPlayer = await players.create({
  NAME: 'new_player',
  STARMADE_NAME: 'NewPlayer',
  FACTION: 0,           // 0 = neutral
  PERMISSION: 0,        // no special permissions
}, { autoGenerateId: true });

console.log('Created player with ID:', newPlayer.getId());
```

### Grant faction officer permissions

```typescript
import { PlayerRole } from 'smtoolkit-db';

// Set a preset role
await players.setPlayerRole(playerId, PlayerRole.OFFICER);

// Or grant individual permission bit
await players.grantPermission(playerId, 3); // bit mask: INVITE + KICK

// Or revoke a permission
await players.revokePermission(playerId, 2); // remove KICK
```

### Transfer a player to a faction

```typescript
await players.transferToFaction(playerId, factionId);
// Use 0 to make the player neutral
await players.leaveFaction(playerId);
```

### Create a fleet

```typescript
import { FleetsController } from 'smtoolkit-db';

const fleets = new FleetsController();
await fleets.initialize(manager);

const fleet = await fleets.create({
  FLAGSHIP: entityId,     // ID of the flagship entity
  OWNER: 'InitSysRev',   // owner player name
  MISSION_STRING: 'IDLE',
  FACTION_ACCESS: 3,      // FactionAccess.FACTION_ONLY
  COMBAT_SETTING: 0,      // CombatSetting.PASSIVE
});
```

### Add an entity to a fleet

```typescript
import { FleetMembersController } from 'smtoolkit-db';

const members = new FleetMembersController();
await members.initialize(manager);

await members.create({
  FLEET_ID: fleet.ID,
  ENTITY_ID: entityId,
});
```

### Send a player message

```typescript
import { PlayerMessagesController } from 'smtoolkit-db';

const messages = new PlayerMessagesController();
await messages.initialize(manager);

await messages.create({
  SENDER: 'InitSysRev',
  RECEIVER: 'OtherPlayer',
  CONTENT: 'Hello!',
});
```

### Arm a mine

```typescript
import { MinesController } from 'smtoolkit-db';

const mines = new MinesController();
await mines.initialize(manager);

await mines.armMine(mineId);
// or
await mines.disarmMine(mineId);
```

### Atomic ID generation

Use `IdGenTableController` when you need guaranteed-unique IDs:

```typescript
import { IdGenTableController } from 'smtoolkit-db';

const idGen = new IdGenTableController();
await idGen.initialize(manager);

// Create a sequence (once)
await idGen.initializeSequence('my_sequence', 1, 1);

// Get the next ID atomically (safe under concurrent load)
const result = await idGen.generateId('my_sequence');
console.log('Next ID:', result.id);

// Reserve a block of 100 IDs
const batch = await idGen.generateBatchIds('my_sequence', 100);
console.log('Reserved IDs:', batch.firstId, '–', batch.lastId);
```

---

## 9. Bulk operations

All controllers support `bulkCreate` and `bulkDelete`. Some also support specialized bulk methods.

```typescript
// Bulk create players
const result = await players.bulkCreate([
  { NAME: 'player1', STARMADE_NAME: 'Player1', FACTION: 0, PERMISSION: 0 },
  { NAME: 'player2', STARMADE_NAME: 'Player2', FACTION: 0, PERMISSION: 0 },
], { continueOnError: true, skipValidation: false });

console.log(`Created: ${result.success}, Failed: ${result.failed}`);
if (result.errors.length > 0) {
  for (const e of result.errors) {
    console.error(`  [${e.index}] ${e.error}`);
  }
}
```

`BulkOperationResult` fields: `success`, `failed`, `skipped`, `errors`.

---

## 10. Error handling

All errors extend `HSQLDBError`. Import the specific classes to handle them:

```typescript
import {
  ValidationError,
  ConflictError,
  ConnectionError,
  ModuleNotInitializedError,
} from 'smtoolkit-db';

try {
  await players.create({ NAME: 'existing_name', ... });
} catch (err) {
  if (err instanceof ConflictError) {
    console.error('Duplicate player name:', err.message);
  } else if (err instanceof ValidationError) {
    console.error('Invalid field value:', err.field, '=', err.value, '—', err.message);
  } else if (err instanceof ConnectionError) {
    console.error('Cannot connect to database:', err.message);
  } else {
    throw err; // re-throw unexpected errors
  }
}
```

| Error class | When thrown |
|---|---|
| `ConnectionError` | Database unreachable, Java missing, lock held by server |
| `ValidationError` | Invalid field value (wrong type, out of range, etc.) |
| `ConflictError` | Duplicate unique value (e.g. player name already exists) |
| `ModuleNotInitializedError` | Controller used before `initialize(manager)` |
| `SQLConstraintViolationError` | Foreign key or unique constraint violated at DB level |
| `SQLRequiredFieldError` | Required column missing from insert data |

---

## 11. Common pitfalls

### ❌ Connecting while the StarMade server is running

HSQLDB uses an exclusive file lock. If the server holds the lock, the connection will fail with a `ConnectionError` or silently corrupt data.

```
// Always stop the server first:
./starloader.sh --stop
// Then connect with smtoolkit-db
// Then restart:
./starloader.sh
```

### ❌ Using a controller before `initialize()`

```typescript
// Wrong — throws ModuleNotInitializedError
const all = await players.findPlayers();

// Correct
await players.initialize(manager);
const all = await players.findPlayers();
```

### ❌ Not calling `manager.destroy()` after use

HSQLDB keeps the file lock open until the connection is explicitly closed. Always call `destroy()` in a `finally` block:

```typescript
const manager = new HSQLManager({ ... });
await manager.initialize();

try {
  // ... your work
} finally {
  await manager.destroy();
}
```

### ❌ Treating credits/IDs as `number` when they are `bigint`

The `PLAYERS.ID`, `ENTITIES.ID`, and several other fields are `BIGINT` in HSQLDB and return as `bigint` in TypeScript. Use `BigInt()` literals and operations:

```typescript
// Wrong — JavaScript number loses precision above 2^53
const id = 123456789012345;

// Correct
const id = 123456789012345n;  // bigint literal
```

### ❌ Skipping `autoGenerateId` when creating players

The `PLAYERS` table has no `AUTO_INCREMENT`. IDs must be generated explicitly:

```typescript
// Wrong — will fail with a required-field error
await players.create({ NAME: 'x', STARMADE_NAME: 'x', FACTION: 0, PERMISSION: 0 });

// Correct
await players.create(
  { NAME: 'x', STARMADE_NAME: 'x', FACTION: 0, PERMISSION: 0 },
  { autoGenerateId: true }
);
```

### ❌ Expecting `TRADE_HISTORY` to contain real data

The `TRADE_HISTORY` table is **not populated by the current StarMade game engine**. The `TradeHistoryController` is fully implemented for future use, but queries will return empty results on a live server.

### ❌ Running raw queries without parameterization

Always use parameterized queries to avoid SQL injection:

```typescript
// Wrong — SQL injection risk
const name = userInput;
await manager.query(`SELECT * FROM PLAYERS WHERE NAME = '${name}'`);

// Correct
await manager.query('SELECT * FROM PLAYERS WHERE NAME = ?', [name]);
```

---

## What next?

- **[docs/API.md](API.md)** — complete method reference for all controllers
- **[docs/database/INDEX.md](database/INDEX.md)** — table structure documentation and SQL query examples
- **[docs/database/EXEMPLE_ADVANCED.md](database/EXEMPLE_ADVANCED.md)** — complex multi-table queries, CTEs, analytics
