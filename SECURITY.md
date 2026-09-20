# Security policy

## Supported versions and reporting

The 2.x release line is maintained; 1.x and 0.x are no longer supported.
Report vulnerabilities privately to **init-sys-rev@hotmail.com**, the project contact.
Do not publish credentials, private database contents or exploit details in public issues.

Include the affected revision and runtime versions, prerequisites, reproduction steps,
expected impact and a minimal proof of concept with sensitive data removed. Coordinate
public disclosure with the maintainer. Test only data and systems you are authorized
to use, and avoid data destruction or service disruption.

Security fixes and relevant release notes belong in [CHANGELOG.md](CHANGELOG.md).
This document does not promise a response deadline or certify that the library is
free of vulnerabilities.

## Using the library

- Use an offline database copy for development and exploration. Read-only connections
  do not establish that opening a running game's files is safe.
- Keep read-only mode unless writes are required. Use transactions for related writes
  and await manager cleanup.
- Bind values through parameterized queries; obtain SQL identifiers from validated
  schema metadata. Query validation is not a substitute for parameter binding.
- Restrict access to database files, logs, caches and exported reports. Review their
  contents before sharing; the library does not guarantee removal of all sensitive data.
- Supply a driver compatible with the database and maintain the Node.js/JDK/native
  bridge environment. The HSQLDB driver is not bundled.

The [README](README.md) and [API guide](docs/API.md) describe supported configuration,
cache freshness, query cancellation and other limits. Their security/performance scores
are estimates, not security assessments. Applications remain responsible for access
control and for deciding which error/log details may be exposed to their users.

## Contributions

Follow the [contribution checks](CONTRIBUTING.md), including assertions for invalid
input, dependency failures, connection cleanup and transaction behavior. Do not add
hardcoded credentials, proprietary game sources, or untrusted SQL identifiers.

Run `npm audit` when reviewing dependency changes and record its result separately
from compilation and coverage. A clean dependency audit does not validate application
behavior; review proposed dependency updates and rerun the complete validation gate.
