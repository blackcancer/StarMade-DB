# Contributing to StarMade-DB

Use the [README installation instructions](README.md#requirements-and-installation),
including a compatible JDK/native toolchain, `HSQLDB_JAR`, and the sibling
`StarMade-Decoder` checkout. Build that dependency before installing this project.
Keep discussion respectful and include reproducible steps when reporting issues.

## Development and tests

Create a branch for the change. For new behavior or a regression, write a failing
Mocha/Chai test first, implement the correction, then refactor with tests passing.
Mirror `src/` in `tests/` and assert results, failure paths and database semantics.

```bash
npm ci
npm run build
npm run test:no-build -- tests/core/audit-regressions.test.ts
npm run test:no-build -- '--grep=connection'
npm run validate
npm run build:prod
```

`npm run validate` checks TypeScript, JSDoc descriptions and the complete test suite
with **100% lines and branches in every executable `src/**/*.ts` file**, including
private implementation paths. The only source exclusion is declaration files (`*.d.ts`).
Do not remove assertions, lower thresholds, add ignore annotations or exclude difficult
files to satisfy the gate. A failing or unexecuted check is not a passing result.

The runner in `scripts/run-tests.mjs` configures Mocha and uses `tsx` for TypeScript.
It copies `tests/sandbox` into a disposable directory; native JDBC integration is part
of the suite. Use controlled dependency failures for error paths and isolated fixture
copies or in-memory HSQLDB databases for database assertions. Never run these tests
against a live game database or reset the checked-in fixture with manual SQL samples.

Inspect `coverage/index.html` and `coverage/coverage-summary.json`. Include the actual
commands, results, runtime/driver versions and remaining limitations in the review.
The dated [quality report](docs/QUALITY.md) records measured results, not a permanent
certification of later revisions. `tsconfig.json` builds library sources; tests are
executed by `tsx`, not checked by a separate TypeScript test project.

## Code, security and documentation

Follow the project's [development rules](AGENT.md). Use TypeScript/ESM, strict types,
`const` by default, async/await, descriptive names and the existing module lifecycle.
Keep modern ES2023-compatible source within the configured ES2022 compilation target.
Use parameterized values and validated schema identifiers for SQL. Validate input and
paths, preserve read-only defaults, restore session state and release resources after
errors. Do not add credentials, private data or proprietary StarMade source code.

Document public, protected and private declarations with meaningful JSDoc descriptions,
parameters, return values and failure conditions. Presence checks do not replace a
review of correctness. After declaration or comment changes, run:

```bash
npm run docs:check
npm run docs:build
```

Commit generated public and internal references together. Maintain the
[API guide](docs/API.md), [schema evidence](docs/SCHEMA_VALIDATION.md), examples and
[CHANGELOG.md](CHANGELOG.md) when relevant. Game sources may be consulted privately;
tests and package artifacts must remain independent of them. The table documentation
and SQL examples live in [docs/database](docs/database/INDEX.md).

## Commits and review

Use conventional commit messages such as `fix(connection): restore session state`.
Automated commits use **InitSysRev-Agent**; preserve other contributors' attribution.
Avoid unrelated formatting, generated caches and local editor settings.

A change needs independent review of its behavior and assertions, the required passing
checks, and updated documentation. Explain the problem, resulting behavior and evidence
in the pull request. An existing defect remains a documented failure until corrected;
do not describe partial coverage or a successful build as global acceptance.

For a bug report, provide package, Node.js, Java and OS versions, minimal reproduction,
expected/actual behavior and relevant redacted logs. For a feature, describe the use
case and constraints. Report vulnerabilities through the [security policy](SECURITY.md).
