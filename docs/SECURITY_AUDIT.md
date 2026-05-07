# Security Audit - StarMade-DB 1.0.0 Release Preparation

> Scope: first public release preparation for `starmade-db`.
>
> Status: preliminary audit document prepared before first Git commit.

---

## 1. Audit Scope

Reviewed/targeted areas:

- Package metadata and release versioning.
- Public documentation and examples.
- HSQLManager lifecycle and configuration model.
- Controller-based access pattern.
- Raw SQL guidance and parameterized query usage.
- Write safety and backup guidance.
- Local StarMade database test strategy.
- Dependency audit workflow.

Out of scope for this preliminary pass:

- Formal penetration test.
- Live production StarMade server testing.
- Third-party native dependency source-code audit.

---

## 2. Release Safety Principles

- Treat StarMade world files as production data.
- Never run exploratory write operations against an original world database.
- Prefer read-only connections for inspection/reporting use cases.
- Use a copied database for real-world validation.
- Prefer controllers over raw SQL.
- Use parameterized queries for all raw SQL.
- Always close the manager/JDBC resources with `manager.destroy()`.

---

## 3. Real Database Copy

A safe local copy was prepared for release validation from a local StarMade installation. The original database was not used directly.

Copied to the local-only release validation area:

```txt
.release-db/StarMade/server-database/world0
```

Approximate copied size: `53M`.

Use the copy with a project-local path or environment variable:

```ts
const manager = new HSQLManager({
  starmadeDir: `${process.cwd()}/.release-db/StarMade`,
  worldName: 'world0',
  connection: { readOnly: true }
});
```

The `.release-db/` directory is local-only and must not be committed.

---

## 4. Main Risks and Controls

| Risk | Impact | Control |
|---|---:|---|
| Accidental writes to a real StarMade world | High | Default to read-only; copy world before validation; document safe workflow |
| SQL injection in raw SQL consumers | High | Promote controllers and parameterized queries; discourage string concatenation |
| HSQLDB file corruption after abrupt shutdown | Medium/High | Always destroy manager; sandbox loader uses compact shutdown |
| Committing real DB files or private paths | Medium | `.release-db/` ignored; release checklist includes local-data check |
| Native/JDBC dependency vulnerabilities | Medium | Run `npm audit`; review `node-java`, `nodejs-jdbc`, HSQLDB driver artifacts |
| Sensitive data in logs | Medium | Keep examples minimal; recommend trusted logs and no unnecessary path/player dumps |
| Write APIs used without backups | High | Docs require backup/copy before bulk or write operations |

---

## 5. Secure Usage Checklist for Users

- [ ] Use `connection.readOnly: true` for read/report tools.
- [ ] Back up or copy `server-database/<worldName>` before writes.
- [ ] Use controller methods where possible.
- [ ] Use `parameterized-query` for raw SQL.
- [ ] Avoid logging full private paths/player data unless necessary.
- [ ] Destroy the manager in `finally`.
- [ ] Keep Java/JDK updated.

---

## 6. Release Audit Checklist

Before the first public commit/release:

- [x] Public version reset to `1.0.0` in `package.json` and `package-lock.json`.
- [x] Changelog rewritten for first public release.
- [x] Security policy rewritten for `1.x.x` public release line.
- [x] Contributor guide cleaned of internal/stale package naming.
- [x] API guide updated with safe defaults and actual module keys.
- [x] Real database copied to a safe local release validation path.
- [x] `.release-db/` ignored by Git.
- [x] `npm run type-check` after cleanup.
- [x] Full test suite after cleanup.
- [x] `npm audit` reviewed.
- [x] `npm audit fix` applied for non-breaking automatic fixes.
- [x] `npm pack --dry-run` reviewed.
- [x] Read-only smoke test against copied `world0`.
- [ ] Optional write smoke test against a second disposable copy only.

---

## 7. Suggested Smoke Test Against Copied World

Read-only only:

```ts
import {
  HSQLManager,
  PlayersController,
  EntitiesController,
  SectorsController
} from 'starmade-db';

const manager = new HSQLManager({
  starmadeDir: `${process.cwd()}/.release-db/StarMade`,
  worldName: 'world0',
  connection: { readOnly: true },
  logging: { level: 'error', enableConsole: false }
});

try {
  await manager.initialize();

  const players = new PlayersController();
  const entities = new EntitiesController();
  const sectors = new SectorsController();
  await players.initialize(manager);
  await entities.initialize(manager);
  await sectors.initialize(manager);

  console.log({
    players: (await players.findPlayers({ limit: 10 })).length,
    entities: (await entities.findEntities({ limit: 10 })).length,
    sectors: (await sectors.findSectors({ limit: 10 })).length
  });
} finally {
  await manager.destroy();
}
```

---

## 8. Dependency Audit Result

`npm audit fix` reduced the full development report from 13 vulnerabilities to 7 vulnerabilities. Runtime-only audit currently reports 3 critical vulnerabilities, all from the same `node-java` chain.

Remaining audit findings requiring release decision:

| Dependency chain | Severity | Status |
|---|---:|---|
| `node-java` → `node-zookeeper-client` → `underscore` | Critical | No fix available via npm audit; release blocker unless dependency is replaced, patched, or risk-accepted with mitigation |
| `mocha` → `diff` / `serialize-javascript` | High | Dev/test dependency path; `npm audit fix --force` proposes a breaking Mocha change; needs explicit test validation before accepting |
| `nodemon` → `chokidar` → `picomatch` | High | Dev-only watch-tool path; not shipped as runtime dependency, but should be upgraded/replaced or risk-accepted before release |

Current recommendation: treat the production `node-java` chain as the main security blocker for a production release. Because JDBC support depends on native Java bridging, evaluate replacement/upgrade options before public release or document a conscious risk acceptance. The other findings are currently in dev/test tooling paths.

## 9. Validation Results

- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npm run type-check` → pass.
- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npm run build` → pass, 232 emitted `dist/` files.
- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npm test -- --reporter dot` → pass, `2782 passing / 0 pending / 0 failing`.
- `npm pack --dry-run` → package `starmade-db@1.0.0`, package size about `812 kB`, unpacked size about `4.5 MB`, 294 files.
- Read-only smoke test against copied `world0` → pass:
  - players loaded: 1
  - entities loaded: 10
  - sectors loaded: 10
  - manager status: `ready`

## 10. Open Items

- Create the initial Git repository and commit only source/docs/config fixtures intended for release.
- Decide how to handle the remaining `npm audit` findings, especially the critical production `node-java` dependency chain.
- Optional write smoke test against a second disposable copy only.
