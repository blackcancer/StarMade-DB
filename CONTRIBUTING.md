# Contributing to StarMade-DB

Thank you for helping improve StarMade-DB.

This project provides a TypeScript/Node.js API for interacting with StarMade HSQLDB worlds through JDBC. Contributions should prioritize data safety, clear APIs and compatibility with StarMade/HSQLDB behavior.

## Prerequisites

- Node.js 20+
- Java/JDK available at runtime
- npm
- Git, once the public repository is initialized

For this workspace's test environment, use:

```bash
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
```

## Setup

```bash
npm install
npm run build
npm run type-check
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npm test
```

The test sandbox lives under `tests/sandbox/`.

## Development Rules

- Prefer controllers over raw SQL for application-facing behavior.
- Use parameterized queries for raw SQL.
- Keep HSQLDB 2.3.4 compatibility in mind:
  - use `TOP`, not `LIMIT`;
  - avoid reserved aliases such as `count`;
  - use `SELECT IDENTITY() FROM (VALUES(0)) t(x)` for identity retrieval.
- Keep `connection.readOnly: true` as the safe default in examples and tools.
- Never run write tests against a user's real StarMade database; copy it first.
- Keep public docs and examples aligned with actual exports from `src/core/index.ts` and `src/tables/index.ts`.

## Testing

Before opening a change, run at least:

```bash
npm run type-check
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npm test
```

For release candidates, also run:

```bash
npm run build
npm pack --dry-run
npm audit
```

## Documentation

Update documentation when public behavior changes:

- API guide: `docs/API.md`
- Table docs: `docs/database/`
- Release notes: `CHANGELOG.md`
- Security notes: `SECURITY.md` or `docs/SECURITY_AUDIT.md`

## Commit Guidelines

Once the repository is initialized, use clear, scoped commits. Suggested prefixes:

- `feat:` for new public functionality
- `fix:` for bug fixes
- `docs:` for documentation-only changes
- `test:` for test-only changes
- `chore:` for build/release/tooling maintenance
- `security:` for security hardening

For the first public commit/release, prefer a single clean baseline commit if the repository has no prior history.

## Pull Request Checklist

- [ ] Type-check passes.
- [ ] Relevant tests pass.
- [ ] Full suite passes for release-impacting changes.
- [ ] Docs updated if behavior changed.
- [ ] Security impact considered.
- [ ] No real StarMade database files, local release copies or secrets are committed.

## Security

See `SECURITY.md` and `docs/SECURITY_AUDIT.md`.
