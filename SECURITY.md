# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 2.x.x   | :white_check_mark: | Active development |
| 1.x.x   | :x:                | End of life |
| 0.x.x   | :x:                | End of life |

## Reporting a Vulnerability

The SMToolkit-DB team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings, and will make every effort to acknowledge your contributions.

### Where to Report

**DO NOT** report security vulnerabilities through public GitHub issues.

Instead, please report them via one of these methods:
1. Email: security@smtoolkit-db.example.com
2. GitHub Security Advisories: [Create a security advisory](https://github.com/blackcancer/smtoolkit-db/security/advisories/new)

### What to Include

Please include the following information:

- Type of issue (e.g., SQL injection, path traversal, remote code execution)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response**: Within 48 hours
- **Vulnerability Confirmation**: Within 7 days
- **Patch Development**: Depends on severity
  - Critical: Within 7 days
  - High: Within 14 days
  - Medium: Within 30 days
  - Low: Next regular release

## Security Measures

### Built-in Security Features

SMToolkit-DB implements several security measures to protect against common vulnerabilities:

#### 1. SQL Injection Prevention
```javascript
// Safe: Using parameterized queries
const result = await query.execute(
    'SELECT * FROM PLAYERS WHERE id = ?', 
    [playerId]
);

// Unsafe: Never do this
const result = await query.execute(
    `SELECT * FROM PLAYERS WHERE id = ${playerId}`
);
```

#### 2. Connection Security
- Read-only mode by default for data exploration
- Connection string validation
- Timeout enforcement
- Connection pooling limits

#### 3. Input Validation
- All configuration inputs are validated
- Path traversal prevention
- World name validation
- Query parameter type checking

#### 4. Error Handling
- No stack traces in production
- Generic error messages to users
- Detailed logging for administrators only

### Security Best Practices for Users

#### 1. Database Access
```javascript
// Always use read-only mode when possible
const manager = new HSQLManager({
    starmadeDir: '/path/to/starmade',
    worldName: 'my_world',
    connection: {
        readOnly: true  // Default and recommended
    }
});
```

#### 2. Environment Variables
```bash
# Store sensitive configuration in environment variables
STARMADE_DB_PATH=/secure/path/to/starmade
STARMADE_WORLD_NAME=production_world
```

#### 3. Query Validation
```javascript
// Enable query validation
const manager = new HSQLManager({
    modules: {
        enableQueryValidation: true,
        enableParameterizedQueries: true
    }
});
```

#### 4. Logging Security
```javascript
// Configure secure logging
const manager = new HSQLManager({
    logging: {
        level: 'info',
        sanitizeLogs: true,  // Remove sensitive data
        logDir: '/secure/logs/'
    }
});
```

## Known Security Considerations

### HSQLDB Specific

1. **File Access**: HSQLDB uses file-based storage
   - Ensure proper file system permissions
   - Restrict access to database files
   - Use read-only mode when possible

2. **Java Security**: HSQLDB runs on JVM
   - Keep Java updated
   - Use security manager if needed
   - Monitor for Java CVEs

3. **Network Access**: When using server mode
   - Always use authentication
   - Encrypt connections if possible
   - Restrict network access

### Module-Specific Security

#### Connection Module
- Validates all JDBC URLs
- Prevents directory traversal
- Enforces timeout limits

#### Query Module
- Parameterized queries only
- Query complexity limits
- Syntax validation

#### Cache Module
- Memory limits enforced
- No sensitive data caching
- TTL enforcement

## Security Checklist for Contributors

Before submitting code, ensure:

- [ ] No hardcoded credentials or secrets
- [ ] All user inputs are validated
- [ ] SQL queries use parameters, not concatenation
- [ ] Error messages don't leak sensitive information
- [ ] File paths are validated against traversal attacks
- [ ] Dependencies are up-to-date and vulnerability-free
- [ ] New features have security tests
- [ ] Documentation includes security considerations

## Vulnerability Disclosure Policy

### For Researchers

1. Please give us reasonable time to address vulnerabilities before public disclosure
2. Make a good faith effort to avoid privacy violations, data destruction, and service disruption
3. Only interact with accounts you own or with explicit permission

### Our Commitment

1. We will respond promptly to security reports
2. We will keep you informed about our progress
3. We will credit you for your discovery (unless you prefer anonymity)
4. We will not pursue legal action against researchers who follow this policy

## Security Updates

Security updates will be released as:
- **Patches**: For current major version
- **Advisories**: Published on GitHub Security
- **Announcements**: In release notes and HISTORY.md

### Update Notifications

Subscribe to security updates:
1. Watch the repository with "Security alerts" enabled
2. Subscribe to our security mailing list
3. Check GitHub Security Advisories

## Dependencies

We regularly audit our dependencies for vulnerabilities:

```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Force audit fixes (use with caution)
npm audit fix
```

### Critical Dependencies

| Package | Purpose | Security Considerations |
|---------|---------|------------------------|
| winston | Logging | Keep updated, configure properly |
| java | JDBC bridge | Monitor Java security updates |
| hsqldb.jar | Database driver | Update when HSQLDB releases patches |

## Contact

For any security-related questions that don't fit the vulnerability reporting process:
- Open a discussion with the "security" tag
- Email: init-sys-rev@hotmail.com

---

*This security policy is adapted from best practices recommended by the [GitHub Security Lab](https://securitylab.github.com/) and the [OWASP Foundation](https://owasp.org/).*