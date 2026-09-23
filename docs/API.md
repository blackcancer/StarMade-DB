# StarMade-DB API guide

This guide describes the current source API. Package version is declared in
[package.json](../package.json); historical releases are in [CHANGELOG.md](../CHANGELOG.md).

## Prepare the environment

Follow [installation requirements](../README.md#requirements-and-installation). Set
`JAVA_HOME` to a JDK when compiling the native bridge and `HSQLDB_JAR` to the game driver,
for example `/srv/StarMade/lib/hsqldb.jar`. This checkout also requires its sibling
`StarMade-Decoder` project. Use an isolated database copy for development and tests.

## Reference and exports

The generated [public reference](api/reference.md) lists exported declarations and public
members. The [internal reference](api/internal.md) covers internal declarations, including
protected and private members. Both are generated from JSDoc by `npm run docs:build`.

Import runtime classes from `starmade-db`. Supported subpaths are `starmade-db/core`,
`starmade-db/hsql-manager`, `starmade-db/modules`, `starmade-db/interfaces` and
`starmade-db/errors`. `interfaces` provides TypeScript type exports.

## Manager and modules

Create `HSQLManager` with `starmadeDir`, `worldName`, connection settings and module flags;
then await `initialize()`. Always await `destroy()` when finished. Configuration snapshots
are independent of the manager's internal state.

`getModule(name)` uses each module's exact registered name. Common names include `connection-manager`,
`parameterized-query`, `TransactionManager`, `query-validator`, `schema-analyzer`,
`cache-manager` and `performance-monitor`. A requested module may be absent when its flag
is disabled; check before calling it. `QueryExecutor` is initialized and registered explicitly.
See the complete [setup example](../README.md#read-data).

## Query execution

- `QueryExecutor.executeQuery(sql, options)` executes SQL without parameters.
- `executeParameterizedQuery(sql, parameters, options)` binds positional `?` placeholders.
- `executeNamedQuery(sql, parameters, options)` binds `:name` placeholders.
- `executeStreamingQuery(...)` yields batches from a materialized result.
- `ParameterizedQuery.executeBatch(...)` reports success/failure per row; it does not make the batch atomic.

Result rows are arrays, accompanied by column metadata. BIGINT values may be strings.
`ParameterizedQuery` exposes affected-row counts for mutations. Do not derive mutation
counts from returned rows. Bound values remain literal data; SQL identifiers must come from
trusted schema definitions. Statement caches store preparation metadata, not live JDBC statements.
`ParameterizedQuery.execute(sql, values, {returnGeneratedIdentity: true})` reads HSQLDB
`IDENTITY()` on the insertion session and exposes `generatedIdentity` without loss of
BIGINT precision; use this option for identity-generating inserts.

Query deadlines cancel and then drain JDBC work before session reuse. Cache freshness,
streaming behavior and validator limitations are described in the
[README](../README.md#query-limits-and-cache).

## Controllers and models

```javascript
import { HSQLManager, PlayersController } from 'starmade-db';

const manager = new HSQLManager({
    starmadeDir: '/path/to/StarMade',
    worldName: 'my_world',
    connection: { readOnly: true },
    modules: { enableConnectionFactory: true, enableParameterizedQueries: true }
});
try {
    await manager.initialize();
    const players = new PlayersController();
    await players.initialize(manager);
    const page = await players.findMany({
        orderBy: 'NAME', orderDirection: 'ASC', limit: 20, offset: 0
    });
    console.log(page.map(player => player.getData()));
} finally {
    await manager.destroy();
}
```

Use exact SQL column names in controller options. Table schemas and game-source evidence
are indexed by [SCHEMA_VALIDATION.md](SCHEMA_VALIDATION.md). A missing lookup returns
`null`; a database failure should be handled as an error. BIGINT values returned by JDBC
can be strings to preserve precision.


Controllers require `await controller.initialize(manager)`. Base operations include
`findById`, `findMany`, `create`, `update` and `delete`. `findById(id, {skipCache: true})`
reads current database state without reading or writing the controller cache. `findMany`
also accepts `skipCache`, ordering and pagination options. Sort columns must exist in the
model schema, direction is `ASC` or `DESC`, and pagination values are non-negative safe
integers. A zero limit means no limit.

Models expose schema definitions, validation, field accessors and serialization. Private
validation and relationship serialization are included in coverage. Table-specific behavior
and its game-source evidence are documented in [SCHEMA_VALIDATION.md](SCHEMA_VALIDATION.md)
and the linked table documents. Prefer generated signatures over historical examples when
checking exact optional arguments.

## Transactions and analysis

Enable writes explicitly with `connection: {readOnly: false}`. Once initialized:

```javascript
const transactions = manager.getModule('TransactionManager');
if (!transactions) throw new Error('Enable modules.enableParameterizedQueries');
await transactions.executeTransaction(async transaction => {
    await transaction.execute(
        'UPDATE PLAYERS SET FACTION = ? WHERE NAME = ?', [123, 'Alice']
    );
});
```

The callback commits on success and rolls back on failure. Keep related queries on its
transaction context. A standalone batch is not automatically a transaction. HSQLDB's
locking mode can make concurrent writers wait; never wait for another writer that needs
a lock held by the current transaction.


Enable `modules.enableParameterizedQueries` to load the transaction manager. Use
`executeTransaction(callback)` for a commit-on-success, rollback-on-failure unit of work.
Execute transaction SQL through the supplied context so it uses the reserved session.
Cleanup restores session settings; a session that cannot be restored is discarded.
`rollbackAllTransactions()` waits for JDBC rollbacks and reports aggregate failures.
The legacy `forceCleanupAllTransactions()` clears tracking and invalidates contexts only;
it does not roll back or return JDBC sessions. Use the asynchronous rollback operation
for normal cleanup.

`SchemaAnalyzer` reads metadata and computes statistics. `RelationshipAnalyzer` evaluates
relationships, including composite nullable references. `DatabaseReporter` formats their
results. Scores include estimates and are not proof of security or measured performance.
Cache optimization recommendations are advisory; HTTP metric export is unsupported.

## Development checks

See the [contribution guide](../CONTRIBUTING.md) for focused tests, the full coverage gate,
and regeneration of both API references.

## Binary database compatibility

The default `current` profile targets StarMade-Open `e5a3b49d8`: 24 fleet commands,
10 sector types, five planet types and zlib-wrapped trade prices. SQL `SectorType`
and `SystemType` use the game ordinals; the erroneous `WORMHOLE`/`NEBULA` labels
have been removed. Do not reuse old numeric enum literals.

`decodeCommand(profile?)`, `decodeStarSystem(profile?)`, `encodeInfos(entries, profile?)`
and `TradeNodesModel.decodeItems(profile?)` accept `current` or `legacy-sdk`.
The legacy profile preserves **SDK 2.0.1** ordinals and raw-DEFLATE prices; it is not
a certification of an older game release. Binary cells do not identify their profile.
Decoder business objects retain their profile across edits and serialization.
`TradeNodesModel.encodeItems(rawPrices, profile?)` uses the selected profile for raw
structures; a business object uses its own profile.

```javascript
const command = fleet.decodeCommand('current');
const oldCommand = oldFleet.decodeCommand('legacy-sdk');
const prices = tradeNode.decodeItems('current');
if (prices) tradeNode.encodeItems(prices.withSellOrder(259, 2, 500));
```

`FleetsModel.decodeCommand()` returns `null` for absent/empty data and throws
`DecodeError` for malformed nonempty bytes. `encodeRemotes()` writes the Java
ObjectOutputStream database representation for records, Maps and FleetRemotesObject
inputs. Reading also accepts network-format remotes; an incomplete recovered object
cannot be written back.

`SystemsModel` reads both 16-byte current and 19-byte extended resource cells.
`encodeResources(resources, resourceSize = 16)` and
`encodeStarSystem(system, resourceSize = 16)` default to the supplied fixture/game schema.
Pass `19` only for a database column supporting that width. Writing nonzero extended
resources to a 16-byte column throws before changing the stored cell; values are never
silently truncated. No database migration is performed by these helpers.

Absent resource cells remain distinct from zero-filled cells: `decodeResources()`
and the decoded system's `resources` return empty arrays when the cell is absent.

`FleetsModel` provides `get/setCombinedTargeting()` and `get/setMessageLog()`;
`FleetMembersModel` provides `get/setCargoCapacity()`. The controllers support
sorting and updating their SQL columns on a database containing the new schema.
Cargo must be finite, the targeting flag boolean or null, and the message at most
4096 characters containing a JSON array of strings (empty string/null is also accepted).
Each game message string encodes a JSON object with timestamp, type and description.
An omitted column remains undefined on an in-memory model;
read the created row to observe database defaults.

Fleet membership mutations use `{fleetId, entityId}`, not the membership's `ID`.
Incomplete keys are rejected before any row lookup. The library does not add the
new columns to existing worlds: schema migration belongs to the game/operator.

The [schema validation notes](SCHEMA_VALIDATION.md#compatibilite-open-20260923)
record the audit, corrections and independent format evidence.
