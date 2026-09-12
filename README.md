# StarMade-DB

TypeScript / ESM library for reading and managing StarMade’s HSQLDB data through JDBC. It provides connection pools, parameterized queries, transactions, schema analysis, caching, metrics, and table models/controllers.

## Requirements and installation

- Node.js 20.19+ on the 20.x line, or Node.js 22.12+.
- Java with a matching JDK when the native `java` dependency must be compiled. Set `JAVA_HOME` to that JDK; a JRE alone does not provide JNI headers.
- A C/C++ compiler and Python for native dependency compilation.
- StarMade’s `hsqldb.jar`, matching the database version.
- The sibling `../StarMade-Decoder` checkout: this repository currently uses a local `file:` dependency on it.

From the repository:

```bash
export JAVA_HOME=/path/to/jdk
export HSQLDB_JAR=/srv/StarMade/lib/hsqldb.jar
npm ci
```

`HSQLDB_JAR` selects the driver explicitly. The library also searches its `lib/` and `src/lib/` locations. The driver is not downloaded or bundled automatically. The npm package name and import prefix are `starmade-db`.

## Read data

```javascript
import { HSQLManager, QueryExecutor } from 'starmade-db';

const manager = new HSQLManager({
    starmadeDir: '/path/to/StarMade',
    worldName: 'my_world',
    connection: { readOnly: true },
    modules: {
        enableConnectionFactory: true,
        enableQueryValidation: true,
        enableParameterizedQueries: true
    }
});

try {
    await manager.initialize();
    // QueryExecutor is explicitly registered; HSQLManager has no query() method.
    const queries = new QueryExecutor();
    await queries.initialize(manager);
    manager.registerModule(queries);

    const result = await queries.executeParameterizedQuery(
        'SELECT NAME FROM PLAYERS WHERE FACTION = ?', [0]
    );
    console.log(result.rows);
} finally {
    await manager.destroy();
}
```

Results contain `columns`, `rows` and timing information. JDBC may return BIGINT values as strings to preserve precision. Module identifiers use kebab case, for example `parameterized-query`, `transaction-manager`, `schema-analyzer` and `cache-manager`.

## Models and controllers

```javascript
import { PlayersController } from 'starmade-db';

const players = new PlayersController();
await players.initialize(manager);
const page = await players.findMany({
    orderBy: 'NAME', orderDirection: 'ASC', limit: 20, offset: 0
});
console.log(page.map(player => player.getData()));
```

Controllers use SQL column names from their model schema. `orderBy` accepts a column name, not a SQL expression; direction is `ASC` or `DESC`. Pagination requires non-negative safe integers; `limit: 0` means unlimited. Update column names are checked even when model validation is disabled. Decoder-backed model helpers use ESM imports.

## Connections and transactions

Connections default to read-only. Enable writes explicitly with `connection.readOnly: false` and use a transaction for related mutations. The `transaction-manager` module must be enabled with `modules.enableParameterizedQueries: true`.

```javascript
const transactions = manager.getModule('transaction-manager');
await transactions.executeTransaction(async transaction => {
    await transaction.execute(
        'UPDATE PLAYERS SET FACTION = ? WHERE NAME = ?', [123, 'Alice']
    );
});
```

The transaction wrapper commits on success and rolls back on failure. Before releasing the connection it restores the original auto-commit, read-only and isolation settings. Explicit pool reservations prevent simultaneous borrowers from using the same session. Native pools are owned by each factory and separated by URL and configuration. Destroying a manager closes its sessions without sending a database-wide `SHUTDOWN` that would disconnect other managers. HSQLDB file locking and logging are left enabled unless explicitly configured otherwise in the supplied JDBC URL. The shared native Java bridge may keep a Node.js process alive after manager cleanup; command-line programs must manage their final process exit after all work and cleanup have completed.

## Query limits and cache

`QueryExecutor.executeQuery(sql, {timeoutMs, maxResultSize})` forwards the deadline and row limit to JDBC. A timeout requests statement cancellation and waits for the JDBC operation to settle before reusing the session; cancellation latency therefore depends on the driver. `timeoutMs: 0` disables the deadline. Streaming currently batches a materialized result; it is not a database cursor.

Query cache keys preserve SQL literal case and whitespace and include the result limit. Mutations executed through the query executor invalidate its cache. SQL validation runs independently of metrics collection and a validator failure rejects execution. Changes made by other processes or directly through another module require explicit `queries.clearCache()`; use `enableCaching: false` when fresh external data is required.

## Analysis, metrics and limitations

The 16 table models are checked against the local schema and game source documented in
[Schema validation](docs/SCHEMA_VALIDATION.md). HSQLDB index metadata comes from
`INFORMATION_SCHEMA.SYSTEM_INDEXINFO`; composite foreign keys retain column order and
referential actions. Statistics quote metadata identifiers and preserve zero values.
Health, security and performance scores are heuristics, and some report scores are fixed
estimates: they are not a security audit or measured query benchmarks. QueryValidator's
schema validation currently reports a placeholder warning; use SchemaAnalyzer for metadata.

CacheOptimizer produces recommendations. Cache tuning suggestions do not modify configuration
automatically. MetricsCollector writes JSON, CSV and Prometheus exports to files; HTTP export
is unsupported and raises a configuration error. Generated HTML reports escape metadata.

## Tests and quality checks

```bash
npm test                 # compile and run Mocha
npm run test:coverage    # measure every src/**/*.ts file; require 100% lines/branches per file
npm run docs:check       # require descriptions for public, protected and private declarations
npm run docs:build       # regenerate the source-derived reference
npm run validate        # type check, documentation check and coverage gate
```

The runner copies `tests/sandbox` to a temporary directory. Each invocation uses a disposable database and leaves the checked-in fixture unchanged. Java integration tests require the driver and native bridge; they are part of the suite. Use `npm run test:no-build -- tests/core/audit-regressions.test.ts` for a focused run. Mocha options with values can be supplied as `--grep=pattern`.

Coverage thresholds are acceptance criteria, not a claim that a particular run passed. Inspect `coverage/index.html` and `coverage/coverage-summary.json` for the measured result. Type declaration files (`*.d.ts`) are the only source exclusion. JSDoc checks include module-level declarations and class/interface/enum members, including internal members; they check description presence, while documentation review is still needed for accuracy.

## Documentation

- [Getting started](docs/GUIDE.md)
- [API guide](docs/API.md)
- [Schema validation](docs/SCHEMA_VALIDATION.md)
- [Generated public API reference](docs/api/reference.md)
- [Generated internal reference](docs/api/internal.md)
- [Validation des corrections](docs/QUALITY.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
