# Controller behavior and database guarantees

This supplement describes controller behavior verified against the documented
[StarMade schema](SCHEMA_VALIDATION.md), the game Java sources under `docs/starmade src`,
and isolated copies of the HSQLDB fixture. Tests never require writing to a running
StarMade world.

## Reads, identifiers and statistics

`findById(id, {skipCache: true})` reads the current database state without reading or
populating the controller cache. Sequence allocation uses this mode before its
compare-and-swap update.

Controller sort columns must exist in the model schema. Sort direction is `ASC` or
`DESC`; limits and offsets must be nonnegative safe integers. A zero limit means
no controller limit. Invalid options fail before cache access or SQL execution.

Computed SQL aliases use quoted lowercase names so JDBC preserves the names consumed
by controller statistics. Counts, grouped distributions and maximum identifiers are
checked against real fixture queries; JDBC uppercase column labels must not silently
turn these results into zero.

## Mutations and generated identifiers

For an auto-increment primary key omitted from `create`, when a returned record is
requested, the INSERT and identity lookup execute on the same JDBC connection before
it is released. Explicit primary keys, including zero, are preserved. BIGINT identities
returned as strings retain their exact value beyond JavaScript's safe integer range.
An unsuccessful query or unusable generated identity rejects the operation.

Nullable composite foreign keys follow SQL `MATCH SIMPLE`: if any component is null
or undefined, no parent lookup is required. StarMade's `-1` sentinel also represents
an absent reference. Fully specified references are checked against their parent.

`EffectsController.removeEffectsFromEntity`,
`PlayerMessagesController.markAllAsRead` and `VisibilityController.clearObserver`
return the affected-row count reported by JDBC, including zero.

Where a bulk operation exposes `batchSize`, it must be a positive safe integer. When their stop-on-error
option is selected, the first failure stops all subsequent batches. A bulk operation
is not automatically transactional; already completed records remain completed.

## Fleet membership and docking

Fleet membership is stored with an `ID` primary key. Composite convenience methods
resolve `(FLEET_ID, ENTITY_ID)` before changing or deleting that membership. A failed
lookup is propagated; a missing membership produces the documented missing-record
result.

Docking filters use `DOCKED_TO`, fleet membership and entity type. Stations have
`ENTITIES.TYPE = 1`. Flagship filtering compares `FLEETS.FLAGSHIP_ID` with the member's
`ENTITY_ID`; there are no `DOCKING_STATUS` or `IS_FLAGSHIP` columns.

`EntitiesController.findEntities({dockedToId})` filters children by their actual
`DOCKED_TO` parent. Dependency checks and docking-chain traversal use this relationship,
including children beyond the first 100 rows. Root, untouched and spawned predicates
remain grouped when combined with other filters.

## Coordinates and sequences

Sector coordinates are global; `(X, Y, Z)` is unique independently of `STELLAR`.
Coordinate-conflict checks preserve a zero excluded identifier. Sector protection
filters accept only documented numeric protection flags.

On HSQLDB, sequence allocation falls back to an optimistic compare-and-swap update.
An ID or range is claimed only when that update affects exactly one row. Contention
retries re-read uncached state and stop after 100 attempts. Batch sizes must be positive
safe integers and may not exceed 10,000. Concurrent allocation tests assert unique
individual IDs and disjoint ranges.
