# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) starting from the public `1.0.0` release.

> Note: version numbers used before `1.0.0` were internal development markers and are intentionally not part of the public release history.

---

## [1.0.0] - First public release

### Added

- Core `HSQLManager` lifecycle for StarMade HSQLDB worlds.
- JDBC-backed connection management and connection factory modules.
- Parameterized query execution, query validation and query executor modules.
- Transaction support with transaction contexts, isolation levels and savepoints.
- Cache, cache statistics and cache optimization modules.
- Schema analysis, relationship analysis and database reporting modules.
- Metrics and performance monitoring modules.
- Typed model/controller API for the StarMade database tables:
  - `PlayersController` / `PlayersModel`
  - `EntitiesController` / `EntitiesModel`
  - `SystemsController` / `SystemsModel`
  - `SectorsController` / `SectorsModel`
  - `SectorsItemsController` / `SectorsItemsModel`
  - `EffectsController` / `EffectsModel`
  - `FleetsController` / `FleetsModel`
  - `FleetMembersController` / `FleetMembersModel`
  - `TradeNodesController` / `TradeNodesModel`
  - `TradeHistoryController` / `TradeHistoryModel`
  - `FtlController` / `FtlModel`
  - `MinesController` / `MinesModel`
  - `NpcStatsController` / `NPCStatsModel`
  - `PlayerMessagesController` / `PlayerMessagesModel`
  - `VisibilityController` / `VisibilityModel`
  - `IdGenTableController` / `IdGenTableModel`
- Public package exports for core APIs, modules, errors and table controllers/models.
- Practical API documentation in `docs/API.md`.
- Database/table documentation under `docs/database/`.
- Security policy and contributor guide.
- Test sandbox and HSQLDB-compatible fixture loader.

### Fixed

- HSQLDB 2.3.4 compatibility issues:
  - use `TOP` instead of `LIMIT`;
  - avoid reserved alias `count`;
  - use `SELECT IDENTITY() FROM (VALUES(0)) t(x)` for identity retrieval.
- Fleet membership creation test now runs as a real assertion instead of a skipped/pending test.
- `FleetMembersController.delete()` now deletes public membership keys by `(FLEET_ID, ENTITY_ID)` while respecting the table's surrogate `ID` primary key.
- Sandbox loader now compacts/shuts down HSQLDB cleanly after loading fixtures.
- Build scripts now clean `.tsbuildinfo` with `dist/` so TypeScript incremental state cannot produce an empty package after a clean artifact removal.
- Full TypeScript/Mocha/HSQLDB test suite stabilized at `2782 passing / 0 pending / 0 failing` before release preparation.

### Security

- Read-only database access remains the recommended/default mode for inspection tools.
- Documentation now emphasizes parameterized SQL, safe write workflows, backups before bulk operations and proper manager cleanup.
- Security audit checklist prepared in `docs/SECURITY_AUDIT.md`.
