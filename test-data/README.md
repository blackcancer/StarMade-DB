# Historical SQL samples

These files are retained as sample data and provenance for the test database. They are
not loaded by `npm test` and are not a supported database migration or fixture rebuild
procedure. Some statements and enum values predate the current models; verify them
against the target schema before any manual use.

The automated suite copies the checked-in HSQLDB fixture from `tests/sandbox` to a
temporary directory. Follow [the contribution guide](../CONTRIBUTING.md#development-and-tests)
for current test commands. No import or cleanup of the original fixture is required.

## Contents

| Files | Historical purpose |
| --- | --- |
| `00-cleanup.sql` | Deletes existing sample data |
| `01-systems.sql` through `16-id-gen-table.sql` | Sample rows for the 16 game tables |
| `master-insert-all.sql` | Manual driver script referencing the numbered files |

The master script contains client directives such as `\i`; these are not JDBC SQL.
The old reload/cleanup prototypes have been retired. If examining these samples, use
a disposable database copy and a compatible SQL client; do not run the cleanup file
against a live world or use these samples as evidence of current schema conformance.

Current schema evidence is in [SCHEMA_VALIDATION.md](../docs/SCHEMA_VALIDATION.md),
the [table index](../docs/database/INDEX.md), and `tests/tables/schema-contract.json`.
The SQL files themselves are preserved unchanged by the repository cleanup.
