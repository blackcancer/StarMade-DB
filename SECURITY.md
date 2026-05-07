# Security Policy

## Supported Versions

| Version | Supported | Status |
| ------- | --------- | ------ |
| 1.x.x | ✅ | Active public release line |
| < 1.0.0 | ❌ | Internal development builds only |

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public issues.

Until the public repository is created, report vulnerabilities privately to the project maintainer. Once repository hosting is configured, use the repository's private security advisory flow if available.

Include as much detail as possible:

- vulnerability type, for example SQL injection, path traversal, unsafe write, data corruption or secret exposure;
- affected file(s), API(s), version and environment;
- reproduction steps;
- expected and actual behavior;
- impact assessment;
- proof of concept, if safe to share privately.

## Response Targets

- Initial acknowledgement: 48 hours
- Triage/confirmation target: 7 days
- Fix target:
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: next planned release

## Security Model

`starmade-db` is a local database access library for StarMade HSQLDB worlds. It can read and, when configured, write game database files. Treat write-capable configurations as privileged operations.

### Default Recommendations

- Prefer `connection.readOnly: true` for dashboards, reports, exports and diagnostics.
- Use `connection.readOnly: false` only for explicit maintenance/write tools.
- Back up or copy the StarMade world before running write or bulk operations.
- Prefer controllers over raw SQL for application code.
- Use parameterized queries for all raw SQL.
- Always call `manager.destroy()` in `finally` blocks to close JDBC/HSQLDB resources.

## Built-in Security Measures

### SQL Injection Prevention

Use parameterized queries:

```ts
const query = manager.getModule<any>('parameterized-query');
const result = await query.execute(
  'SELECT TOP 20 ID, NAME FROM PLAYERS WHERE FACTION = ?',
  [factionId]
);
```

Never concatenate user input into SQL strings:

```ts
// Unsafe: do not do this
await query.execute(`SELECT * FROM PLAYERS WHERE NAME = '${name}'`, []);
```

### Connection Safety

- Read-only mode is recommended for most production consumers.
- Connection timeouts and retry limits are configurable.
- HSQLDB lock-file/stability options are available for controlled test/sandbox environments.

### Input Validation

Controllers validate required fields and many domain-specific invariants before issuing writes. Applications should still validate user-supplied input at their boundary.

### Error Handling

- Avoid exposing internal stack traces to end users.
- Log operational detail only to trusted logs.
- Do not log private player data or database paths unnecessarily.

## HSQLDB/File-System Considerations

HSQLDB uses local files. Protect the StarMade installation and copied test databases with normal file-system permissions.

Recommendations:

- Run write tools as a dedicated low-privilege user where practical.
- Do not run against a live production world without a tested backup/restore plan.
- Prefer testing against a copy of `server-database/<worldName>`.
- Keep Java/JDK patched.

## Dependency Security

Before release and periodically afterwards:

```bash
npm audit
npm outdated
```

Review native/JDBC-related dependencies carefully, especially:

- `node-java`
- `nodejs-jdbc`
- HSQLDB driver artifacts

## Contributor Security Checklist

Before merging code:

- [ ] No hardcoded secrets, tokens, credentials or private paths.
- [ ] Raw SQL uses parameters, not string concatenation.
- [ ] Write operations require explicit write-capable configuration.
- [ ] Bulk operations document backup requirements.
- [ ] File paths are validated and not vulnerable to traversal.
- [ ] Errors do not leak sensitive data to users.
- [ ] New public APIs include security notes where relevant.
- [ ] Tests cover validation and negative paths.

## Release Security Checklist

- [ ] `npm audit` reviewed.
- [ ] `npm run type-check` passes.
- [ ] Full test suite passes.
- [ ] Package contents checked with `npm pack --dry-run`.
- [ ] Documentation reviewed for safe defaults and backup guidance.
- [ ] Real-world database validation is performed only against a copy.
