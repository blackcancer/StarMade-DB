# SMToolkit-DB

Advanced HSQLDB database management module for StarMade, offering a modular and extensible architecture for interacting with game data.

## Features

- **Modular Architecture**: Extensible system with specialized modules (connection, queries, cache, performance)
- **Native HSQLDB Management**: Complete interface for StarMade databases via JDBC
- **Schema Analysis**: Comprehensive exploration and analysis of data structures
- **Relationship Detection**: Automatic identification of relationships between tables
- **Performance Monitoring**: Query performance tracking and optimization
- **Transaction Support**: Complete transaction management with isolation and savepoints
- **Intelligent Caching**: Configurable cache system with TTL and automatic optimization
- **Optimized ID Generation**: Static caching for rapid sequential player ID generation

## Installation

```bash
npm install smtoolkit-db
```

## Quick Start

```javascript
import { HSQLManager } from 'smtoolkit-db';

// Configure the manager
const manager = new HSQLManager({
    starmadeDir: '/path/to/starmade',
    worldName: 'my_world',
    modules: {
        enableRelationshipAnalysis: true,
        enableQueryValidation: true,
        enablePerformanceMonitoring: true
    }
});

// Initialize
await manager.initialize();

// Execute queries
const players = await manager.query('SELECT * FROM PLAYER');
console.log(`Number of players: ${players.length}`);

// Cleanup
await manager.destroy();
```

## Performance Optimizations

### Optimized Player ID Generation

The PlayersController now features an optimized ID generation system that avoids redundant database queries:

```javascript
import { PlayersController } from 'smtoolkit-db';

const controller = new PlayersController();
await controller.initialize(manager);

// First creation initializes the ID cache
const player1 = await controller.create({
    NAME: 'player1',
    STARMADE_NAME: 'player1',
    FACTION: 0,
    PERMISSION: 0
}, { autoGenerateId: true });

// Subsequent creations use cached ID - no database query needed!
const player2 = await controller.create({
    NAME: 'player2', 
    STARMADE_NAME: 'player2',
    FACTION: 0,
    PERMISSION: 0
}, { autoGenerateId: true });

// Bulk operations are much faster
const playersData = Array.from({ length: 100 }, (_, i) => ({
    NAME: `bulk_player_${i}`,
    STARMADE_NAME: `bulk_player_${i}`,
    FACTION: 0,
    PERMISSION: 0
}));

// Only one MAX(ID) query for the entire batch!
const result = await controller.bulkCreate(playersData, {
    skipValidation: false,
    continueOnError: true
});

console.log(`Created ${result.success} players efficiently`);
```

### Cache Management

The static ID cache can be managed programmatically:

```javascript
// Reset cache if database is reset
PlayersController.resetLastPlayerIdCache();

// Check current cached ID
const currentCacheId = PlayersController.getLastPlayerIdFromCache();
console.log(`Current cached ID: ${currentCacheId}`);
```

## API Documentation

### Main Class: HSQLManager

The main manager for all StarMade database operations.

```javascript
const manager = new HSQLManager(configuration);
```

**Configuration:**
- `starmadeDir`: Path to StarMade installation
- `worldName`: World/database name
- `modules`: Module configuration to enable
- `connection`: Connection options (timeout, retry, etc.)
- `performance`: Performance configuration
- `logging`: Logging configuration

### Available Modules

#### ConnectionManager
Manages JDBC connections to the HSQLDB database.

```javascript
const connectionManager = manager.getModule('ConnectionManager');
const connection = await connectionManager.getConnection();
```

#### SchemaAnalyzer
Complete database schema analysis.

```javascript
const analyzer = new SchemaAnalyzer();
await analyzer.initialize(manager);
const tables = await analyzer.getAllTables();
```

#### RelationshipAnalyzer
Automatic detection of relationships between tables.

```javascript
const relAnalyzer = new RelationshipAnalyzer({
    enableImplicitDetection: true,
    enableNamingPatterns: true
});
await relAnalyzer.initialize(manager);
const relationships = await relAnalyzer.detectAllRelationships();
```

#### QueryExecutor
Secure query execution with validation.

```javascript
const executor = manager.getModule('QueryExecutor');
const result = await executor.execute('SELECT * FROM PLAYER WHERE level > ?', [10]);
```

#### TransactionManager
Advanced transaction management.

```javascript
const txManager = manager.getModule('TransactionManager');
const tx = await txManager.beginTransaction({
    isolationLevel: 'READ_COMMITTED'
});

try {
    await tx.execute('UPDATE PLAYER SET credits = credits + ? WHERE id = ?', [100, 1]);
    await tx.commit();
} catch (error) {
    await tx.rollback();
}
```

#### CacheManager
Intelligent cache system for performance optimization.

```javascript
const cache = manager.getModule('CacheManager');
cache.set('player:all', playersData, { ttl: 300000 }); // 5 minutes
```

#### PerformanceMonitor
Performance monitoring and analysis.

```javascript
const monitor = manager.getModule('PerformanceMonitor');
const stats = await monitor.getStatistics();
console.log(`Average query time: ${stats.averageQueryTime}ms`);
```

## Development

### Prerequisites

- Node.js 18+ (ES2023 support)
- Java 8+ (for HSQLDB)
- npm or yarn

### Setup

```bash
# Clone repository
git clone https://github.com/blackcancer/smtoolkit-db.git
cd smtoolkit-db

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Test coverage
npm run test:coverage
```

### Project Structure

```
smtoolkit-db/
├── src/                           # TypeScript source code
│   └── core/
│       ├── HSQLManager.ts         # Main manager
│       ├── errors.ts              # Error classes
│       ├── utils.ts               # Utilities
│       └── modules/
│           ├── connection/        # Connection modules
│           ├── schema/            # Schema analyzers
│           ├── query/             # Query execution
│           ├── transactions/      # Transaction management
│           ├── cache/             # Cache system
│           ├── performance/       # Performance monitoring
│           └── logging/           # Logging system
├── dist/                          # Compiled JavaScript code
│   ├── [mirror structure of src]  # Mirror of src/
│   └── lib/                       # External libraries
│       └── hsqldb.jar             # HSQLDB driver
├── tests/
│   ├── sandbox/                   # Test database
│   └── [mirror structure of src]  # Unit/integration tests
├── tools/
│   └── StarMadeExplorer.js        # Exploration tool
├── examples/                      # Usage examples
└── package.json
```

### Code Conventions

1. **ES2023 Syntax**: Use modern features
2. **JSDoc**: Complete documentation of public APIs
3. **Testing**: Minimum 80% coverage
4. **Imports**: Relative paths with `.js` extension
5. **Immutability**: `const` by default
6. **TypeScript Types**: Strong typing without `any`

### Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

## Examples

### Database Exploration

Use the StarMadeExplorer tool to analyze your database:

```bash
# Complete exploration
node tools/StarMadeExplorer.js

# Analyze specific table
node tools/StarMadeExplorer.js --table PLAYER

# Export schema as JSON
node tools/StarMadeExplorer.js --export schema.json

# Generate Markdown report
node tools/StarMadeExplorer.js --export report.md --format markdown
```

### Parameterized Queries

```javascript
import { HSQLManager } from 'smtoolkit-db';

const manager = new HSQLManager({
    starmadeDir: '/path/to/starmade',
    worldName: 'my_world',
    modules: {
        enableParameterizedQueries: true
    }
});

await manager.initialize();

// Secure parameterized query
const paramQuery = manager.getModule('ParameterizedQuery');
const players = await paramQuery.execute(
    'SELECT * FROM PLAYER WHERE faction_id = :factionId AND credits >= :minCredits',
    { factionId: 123, minCredits: 10 }
);
```

### Performance Analysis

```javascript
const monitor = manager.getModule('PerformanceMonitor');

// Enable monitoring
monitor.startMonitoring();

// Execute queries...
await manager.query('SELECT * FROM ENTITY');

// Get statistics
const report = await monitor.generateReport();
console.log(`Slow queries: ${report.slowQueries.length}`);
console.log(`Average time: ${report.summary.averageQueryTime}ms`);
```

### Cache Management

```javascript
const cache = manager.getModule('CacheManager');

// Configure cache
cache.configure({
    maxSize: 1000,
    defaultTTL: 300000, // 5 minutes
    strategy: 'LRU'
});

// Use with queries
const result = await manager.query('SELECT * FROM Fleet', {
    cache: true,
    cacheKey: 'fleet:all',
    cacheTTL: 600000 // 10 minutes
});
```

## Tools

### StarMadeExplorer

Comprehensive analysis and exploration tool for StarMade databases.

**Features:**
- Complete schema analysis
- Automatic relationship detection
- Data integrity validation
- Optimization suggestions
- Multi-format export (JSON, Markdown, HTML)
- Interactive mode

## Contributing

Contributing guidelines are available in [CONTRIBUTING.md](CONTRIBUTING.md).

For detailed information, please consult our [Wiki](https://github.com/blackcancer/smtoolkit-db/wiki).

## Documentation

- **[Getting Started Guide](docs/GUIDE.md)** — setup, which controller to use, common pitfalls
- **[API Reference](docs/API.md)** — all controllers, methods, and types
- **[Database Documentation](docs/database/INDEX.md)** — table structures, column details, SQL examples
- **[Advanced SQL Examples](docs/database/EXEMPLE_ADVANCED.md)** — multi-table queries and analytics
- **Wiki**: [GitHub Wiki](https://github.com/blackcancer/smtoolkit-db/wiki)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Issues: [GitHub Issues](https://github.com/blackcancer/smtoolkit-db/issues)
- Discussions: [GitHub Discussions](https://github.com/blackcancer/smtoolkit-db/discussions)
- Wiki: [Complete Documentation](https://github.com/blackcancer/smtoolkit-db/wiki)

## Acknowledgments

- StarMade team for the game
- HSQLDB community for the database
- Project contributors