# Getting started with StarMade-DB

StarMade-DB provides TypeScript models and controllers for the game's 16 HSQLDB tables.
It uses the native Java bridge and StarMade's matching HSQLDB driver.

## Prepare the environment

Follow [installation requirements](../README.md#requirements-and-installation). Set
`JAVA_HOME` to a JDK when compiling the native bridge and `HSQLDB_JAR` to the game driver,
for example `/srv/StarMade/lib/hsqldb.jar`. This checkout also requires its sibling
`StarMade-Decoder` project. Use an isolated database copy for development and tests.

## Read players

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

## Write a transaction

Enable writes explicitly with `connection: {readOnly: false}`. Once initialized:

```javascript
const transactions = manager.getModule('transaction-manager');
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

## Keep reads current

Use controller `skipCache: true` or disable executor caching when other processes change
the database. Mutations through QueryExecutor invalidate its own cache; external writes
require explicit invalidation. Query streaming currently batches an in-memory result.
See [query limits and cache](../README.md#query-limits-and-cache) for cancellation semantics.

## Validate changes

`npm run validate` type-checks code, checks JSDoc including private declarations, and runs
the full suite with 100% line/branch thresholds per source file. The runner copies the
checked-in test database to a temporary directory. Regenerate API references with
`npm run docs:build` after source documentation changes.

Continue with the [API guide](API.md), [generated public reference](api/reference.md),
[internal reference](api/internal.md) and [contribution guide](../CONTRIBUTING.md).
