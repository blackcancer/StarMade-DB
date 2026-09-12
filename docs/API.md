# StarMade-DB API guide

This guide describes the current source API. Package version is declared in
[package.json](../package.json); historical releases are in [CHANGELOG.md](../CHANGELOG.md).

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

`getModule(name)` uses kebab-case names. Common names include `connection-manager`,
`parameterized-query`, `transaction-manager`, `query-validator`, `schema-analyzer`,
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
