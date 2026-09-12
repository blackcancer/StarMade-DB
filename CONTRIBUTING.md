# Contributing to StarMade-DB

First off, thank you for considering contributing to StarMade-DB! It's people like you that make StarMade-DB such a great tool for the StarMade community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Process](#development-process)
- [Style Guidelines](#style-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 20.19+ on the 20.x line, or Node.js 22.12+
- A JDK compatible with the installed StarMade HSQLDB driver, plus a C/C++ compiler and Python for the native bridge
- Git
- npm or yarn

### Setting Up Your Development Environment

1. **Fork the repository**
   ```bash
   # Click the 'Fork' button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/blackcancer/StarMade-DB.git
   cd StarMade-DB
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/blackcancer/StarMade-DB.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Run tests**
   ```bash
   npm test
   ```

7. **Set up test database**
   ```bash
   # Ensure you have the test world in tests/sandbox/
   # The test database should be at:
   # tests/sandbox/server-database/test_world/
   ```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**
```markdown
### Description
[Clear description of the bug]

### Steps to Reproduce
1. [First Step]
2. [Second Step]
3. [...]

### Expected Behavior
[What you expected to happen]

### Actual Behavior
[What actually happened]

### Environment
- StarMade-DB Version: [e.g., 0.202.86]
- Node.js Version: [e.g., 18.17.0]
- Operating System: [e.g., Windows 10, Ubuntu 22.04]
- Java Version: [e.g., OpenJDK 11]

### Additional Context
[Any other information that might be helpful]
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

**Enhancement Template:**
```markdown
### Summary
[One paragraph summary of the enhancement]

### Motivation
[Why is this enhancement needed?]

### Detailed Description
[Detailed description of the proposed enhancement]

### Alternatives Considered
[Any alternative solutions you've considered]

### Additional Context
[Any other information or mockups]
```

### Your First Code Contribution

Unsure where to begin? Look for these tags in our issues:
- `good first issue` - Simple issues perfect for beginners
- `help wanted` - Issues where we need community help
- `documentation` - Documentation improvements

## Development Process

### 1. Create a Feature Branch

```bash
# Update your local repository
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

Follow our coding standards and ensure your changes include:
- Appropriate tests
- JSDoc documentation
- Updated examples (if applicable)

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/core/modules/your-module.test.js

# Check coverage
npm run test:coverage

# Ensure build works
npm run build
```

### 4. Commit Your Changes

Follow our [Commit Guidelines](#commit-guidelines) for your commit messages.

## Style Guidelines

### TypeScript/JavaScript Style

We use ES2023 features and follow these conventions:

```javascript
// Good
export class MyModule implements BaseModule {
    readonly name = 'MyModule';
    readonly version = '1.0.0';
    #privateField;
    
    constructor(config) {
        this.#privateField = config?.value ?? 'default';
    }
    
    async initialize(manager) {
        // Implementation
    }
}

// Bad
export class mymodule {
    constructor(config) {
        this.name = "MyModule"  // Missing semicolon, wrong quotes
        this._privateField = config.value || "default"  // Use # for private
    }
}
```

### Key Principles

1. **Use `const` by default, `let` when necessary, never `var`**
2. **Private fields with `#` prefix**
3. **Async/await over promises chains**
4. **Optional chaining `?.` and nullish coalescing `??`**
5. **Descriptive variable names**
6. **Single quotes for strings (except template literals)**

### JSDoc Standards

```javascript
/**
 * Brief description of the module
 * 
 * @module ModuleName
 * @author Your Name
 * @since 2.0.0
 */

/**
 * Detailed method description
 * 
 * @param {string} param1 - Parameter description
 * @param {Object} [options] - Optional configuration object
 * @param {boolean} [options.flag=false] - Flag description
 * @returns {Promise<Result>} Description of return value
 * @throws {ModuleError} When initialization fails
 * 
 * @example
 * const result = await module.method('value', { flag: true });
 */
```

## Commit Guidelines

We follow a modified version of [Conventional Commits](https://www.conventionalcommits.org/):

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or modifying tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes (updating dependencies, etc.)

### Examples
```bash
# Feature
git commit -m "feat(connection): add connection pooling support"

# Bug fix
git commit -m "fix(query): handle null parameters in prepared statements"

# Documentation
git commit -m "docs(readme): add installation troubleshooting section"

# Multiple changes (use body)
git commit -m "refactor(cache): improve cache invalidation logic

- Extract invalidation logic to separate method
- Add time-based invalidation support
- Improve performance for large cache sizes

Closes #123"
```

## Pull Request Process

1. **Ensure all tests pass** and every source file reaches 100% line and branch coverage
2. **Update documentation** for any API changes
3. **Add examples** for new features
4. **Update CHANGELOG.md** with your changes
5. **Ensure clean commit history** (squash if needed)

### PR Template
```markdown
### Description
[Brief description of changes]

### Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update

### Testing
- [ ] All tests pass
- [ ] Added new tests
- [ ] Coverage: 100% lines and branches per source file

### Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No new warnings

### Related Issues
Closes #[issue number]
```

## Testing Guidelines

### Test Structure

Tests should mirror the source structure:
```
src/core/modules/connection/ConnectionManager.ts
tests/core/modules/connection/ConnectionManager.test.ts
```

### Writing Tests

```typescript
// tests/core/modules/connection/ConnectionManager.contract.test.ts
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { HSQLManager } from '../../../../src/core/HSQLManager.js';
import type { ConnectionManager } from '../../../../src/core/modules/connection/ConnectionManager.js';

it('borrows and returns an initialized connection', async () => {
    const manager = new HSQLManager({
        starmadeDir: './tests/sandbox',
        worldName: 'test_world',
        connection: { readOnly: true },
        modules: { enableConnectionFactory: true }
    });
    try {
        await manager.initialize();
        const pool = manager.getModule<ConnectionManager>('connection-manager')!;
        const connection = await pool.getConnection();
        try {
            expect(connection.isActive).to.equal(true);
            expect(await connection.ping()).to.equal(true);
        } finally {
            await pool.releaseConnection(connection);
        }
    } finally {
        await manager.destroy();
    }
});
```

For a regression, assert the broken behavior first and keep its dependencies
controlled. The test runner supplies the disposable fixture working directory.

### Test Categories

- **Unit Tests**: Test individual modules in isolation
- **Integration Tests**: Test module interactions
- **Performance Tests**: Benchmark critical operations
- **Sandbox Tests**: Test against real database

## Documentation

### When to Update Documentation

- Adding new public APIs
- Changing existing APIs
- Adding new modules
- Improving examples
- Fixing documentation errors

### Documentation Locations

- **API Documentation**: `docs/api/`
- **Database Schema**: `docs/database/`
- **Module Guides**: In module directories
- **Examples**: `examples/`
- **Wiki**: For extensive guides and tutorials

## Community

### Getting Help

- **GitHub Issues**: For bugs and features
- **Discussions**: For questions and ideas
- **Wiki**: For detailed guides

### Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation

## Questions?

Feel free to open an issue with the `question` label or start a discussion in the GitHub Discussions tab.

Thank you for contributing to StarMade-DB!
## Local verification contract

Follow [README setup](README.md#requirements-and-installation), including the sibling
`StarMade-Decoder` checkout and `HSQLDB_JAR`. The test runner makes a disposable copy
of `tests/sandbox`; do not run integration tests against a live game database.

Run `npm run validate` before submitting changes. It checks TypeScript, JSDoc descriptions
and 100% lines/branches for every source file, including private implementation paths.
Do not add coverage exclusions or ignore annotations to satisfy the threshold.
Exercise error paths through controlled dependency failures and test database semantics
against the bundled fixture or isolated HSQLDB memory databases.

Run `npm run docs:build` after editing declarations or comments. Update the public and
internal references together with examples and behavioral limitations. The documentation
check includes private/protected declarations; it does not replace a review of accuracy.
Schema corrections should cite the local game source and schema evidence in
[SCHEMA_VALIDATION.md](docs/SCHEMA_VALIDATION.md).
