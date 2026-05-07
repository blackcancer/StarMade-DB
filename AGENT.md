# StarMade-DB – AGENT.md

## Objective

Develop a robust, secure, and fully documented **TypeScript/JavaScript ES2023 module** to interact with StarMade's HSQLDB database through a modular architecture. The module must strictly adhere to quality, security, and reliability guidelines while providing a clean, extensible API.

---

## Project Structure

```
/StarMade-DB
├── docs/
│   ├── api/                    # Public API documentation
│   ├── database/               # StarMade database schema documentation
│   └── HISTORY.md              # Change log and version history
├── src/
│   ├── core/
│   │   ├── HSQLManager.ts      # Main manager class
│   │   ├── errors.ts           # Custom error classes
│   │   ├── utils.ts            # Utility functions
│   │   ├── events.ts           # Event system
│   │   ├── index.ts            # Core exports
│   │   └── modules/
│   │       ├── connection/     # Database connection management
│   │       ├── schema/         # Schema analysis and relationships
│   │       ├── query/          # Query execution and validation
│   │       ├── transactions/   # Transaction management
│   │       ├── cache/          # Caching system
│   │       ├── performance/    # Performance monitoring
│   │       └── logging/        # Logging system
│   └── tables/                 # Table-specific implementations (future)
│       ├── players/
│       ├── entities/
│       ├── fleets/
│       └── ...
├── dist/                       # Compiled JavaScript output
│   ├── [mirror of src]         # Compiled modules
│   └── lib/
│       └── hsqldb.jar          # HSQLDB driver
├── tests/
│   ├── sandbox/                # Test database environment
│   │   └── server-database/
│   │       └── test_world/
│   └── [mirror of src]         # Unit and integration tests
├── tools/
│   └── StarMadeExplorer.js     # Database exploration tool
├── examples/                   # Usage examples
├── AGENT.md                    # This file
├── README.md                   # Quick-start & usage
├── CONTRIBUTING.md             # Contribution guidelines
├── LICENSE                     # MIT License
└── package.json                # Project configuration
```

---

## Mandatory Quality Constraints

### Test-Driven Development (TDD)

* Write tests using **Mocha + Chai** for each new module, method, or function
* Follow the "Red-Green-Refactor" cycle:
  - Write failing test first
  - Implement minimal code to pass
  - Refactor while keeping tests green
* Maintain test structure mirroring `src/` directory
* Achieve minimum 80% code coverage

### Coding Standards

* **TypeScript/JavaScript ES2023**: Use modern language features
* **SOLID Principles**: Single responsibility, open/closed, etc.
* **DRY**: Eliminate code duplication through abstraction
* **JSDoc**: Document all public APIs with complete annotations
* **Immutability**: Prefer `const` over `let`, avoid mutations
* **Module Pattern**: Each module extends `BaseModule` interface

### Module Architecture

```typescript
interface BaseModule {
    readonly name: string;
    readonly version: string;
    readonly isInitialized: boolean;
    initialize(manager: HSQLManager): Promise<void>;
    destroy(): Promise<void>;
}
```

---

## Security Requirements (Mandatory)

### SQL Injection Protection
* **Parameterized Queries**: Use `ParameterizedQuery` module exclusively
* **Query Validation**: Enable `QueryValidator` for all user inputs
* **Never**: Concatenate strings to build SQL queries

### Connection Security
* **Read-Only Mode**: Default for data exploration
* **Connection Pooling**: Limit concurrent connections
* **Timeout Management**: Enforce query timeouts
* **JDBC URL Validation**: Strict validation of connection strings

### Error Handling
* **Custom Error Classes**: Use typed errors from `errors.ts`
* **No Stack Traces**: Never expose internal errors to end users
* **Structured Logging**: Log errors with context, not sensitive data

### Input Validation
* **Schema Validation**: Validate all configuration inputs
* **Path Validation**: Verify StarMade directory structure
* **World Validation**: Check world existence before connection

---

## Module Development Guidelines

### Creating New Modules

1. **Define Interface**
   ```typescript
   export interface MyModuleConfig {
       // Configuration options
   }
   ```

2. **Implement BaseModule**
   ```typescript
   export class MyModule implements BaseModule {
       public readonly name = 'MyModule';
       public readonly version = '1.0.0';
       private initialized = false;
       
       public get isInitialized(): boolean {
           return this.initialized;
       }
       
       public async initialize(manager: HSQLManager): Promise<void> {
           // Initialization logic
       }
       
       public async destroy(): Promise<void> {
           // Cleanup logic
       }
   }
   ```

3. **Add Tests**
   ```javascript
   describe('MyModule', () => {
       it('should initialize correctly', async () => {
           // Test implementation
       });
   });
   ```

---

## Testing Strategy

### Test Categories

| Test Type | Location | Purpose | Tools |
|-----------|----------|---------|-------|
| Unit Tests | `tests/core/modules/*/` | Individual module testing | Mocha + Chai |
| Integration Tests | `tests/integration/` | Multi-module interaction | Mocha + Chai |
| Performance Tests | `tests/performance/` | Benchmark critical paths | Mocha + custom metrics |
| Sandbox Tests | `tests/sandbox/` | Real database testing | Test world database |

### Test Execution Matrix

```markdown
## Module: ModuleName

| Scenario | Input | Expected | Actual | Status |
|----------|-------|----------|--------|--------|
| Normal operation | Valid config | Success | Success | ✓ |
| Missing config | undefined | Use defaults | Defaults used | ✓ |
| Invalid config | {invalid} | ConfigurationError | ConfigurationError | ✓ |
| Connection failure | Bad URL | ConnectionError | ConnectionError | ✓ |
| Concurrent access | Multiple calls | Handled gracefully | Success | ✓ |
```

---

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/module-name

# Develop with TDD
npm run test:watch

# Build and verify
npm run build
npm test
```

### 2. Documentation Requirements

* **JSDoc**: Complete documentation for all public methods
* **README**: Update if API changes
* **HISTORY.md**: Log all changes with version
* **Examples**: Add usage examples for new features

### 3. Code Review Checklist

- [ ] All tests pass (`npm test`)
- [ ] Coverage ≥ 80% (`npm run test:coverage`)
- [ ] JSDoc complete and accurate
- [ ] No TypeScript errors (`npm run build`)
- [ ] Security guidelines followed
- [ ] Performance impact assessed
- [ ] Examples provided
- [ ] HISTORY.md updated

---

## Module-Specific Guidelines

### Connection Modules
- Implement connection pooling
- Handle reconnection gracefully
- Log connection events
- Validate JDBC URLs

### Query Modules
- Parameterize all queries
- Validate query syntax
- Implement query caching
- Monitor execution time

### Schema Modules
- Cache schema metadata
- Detect relationships
- Version schema changes
- Export documentation

### Performance Modules
- Minimal overhead monitoring
- Configurable metrics
- Export capabilities
- Alert thresholds

---

## Release Process

### Pre-Release Checklist

| Task | Complete | Notes |
|------|----------|-------|
| All tests passing | ☐ | `npm test` |
| Coverage ≥ 80% | ☐ | `npm run test:coverage` |
| Build successful | ☐ | `npm run build` |
| Docs updated | ☐ | API.md, HISTORY.md |
| Examples working | ☐ | `npm run examples` |
| Security audit | ☐ | `npm audit` |
| Performance baseline | ☐ | No regression |

### Version Management

- **Major**: Breaking API changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, no API changes

---

## Performance Guidelines

* **Lazy Loading**: Initialize modules on demand
* **Connection Pooling**: Reuse database connections
* **Query Caching**: Cache frequently used queries
* **Batch Operations**: Group similar operations
* **Resource Cleanup**: Always destroy modules properly

---

## Security Audit Requirements

### Regular Audits

- [ ] Dependency vulnerabilities (`npm audit`)
- [ ] SQL injection vectors
- [ ] Connection string exposure
- [ ] Error message leakage
- [ ] Log file security
- [ ] Configuration validation

---

## Success Indicators

* **Test Coverage**: ≥ 80% across all modules
* **Performance**: < 100ms average query time
* **Reliability**: Zero unhandled rejections
* **Documentation**: 100% public API documented
* **Security**: Zero high/critical vulnerabilities
* **Modularity**: All features as independent modules

---

## Maintenance Protocol

### Weekly Tasks
- Review and merge dependabot PRs
- Run security audit
- Update dependencies

### Monthly Tasks
- Performance profiling
- Documentation review
- Test coverage analysis

### Per Release
- Full security audit
- Performance benchmarking
- API documentation update
- Migration guide (if needed)