# StarMade-DB

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
npm install starmade-db
```

## Quick Start

```javascript
import { HSQLManager, PlayersController } from 'starmade-db';

const manager = new HSQLManager({
    starmadeDir: '/path/to/starmade',
    worldName: 'my_world',
    connection: { readOnly: true },
    modules: {
        enableParameterizedQueries: true,
        enableQueryValidation: true,
        enableAdvancedCaching: true,
        enableConnectionFactory: true
    }
});

try {
    await manager.initialize();

    const players = new PlayersController();
    await players.initialize(manager);

    const result = await players.findPlayers({ limit: 20 });
    console.log(`Number of players loaded: ${result.length}`);
} finally {
    await manager.destroy();
}
```

## Performance Optimizations

### Optimized Player ID Generation

The PlayersController now features an optimized ID generation system that avoids redundant database queries:

```javascript
import { PlayersController } from 'starmade-db';

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

For a full practical API guide, see [`docs/API.md`](docs/API.md).

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
const executor = manager.getModule('query-executor');
const result = await executor.execute('SELECT * FROM PLAYERS WHERE FACTION = ?', [1]);
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
const cache = manager.getModule('cache-manager');
cache.set('player:all', playersData, { ttl: 300000 }); // 5 minutes
```

#### PerformanceMonitor
Performance monitoring and analysis.

```javascript
const monitor = manager.getModule('performance-monitor');
const stats = await monitor.getStatistics();
console.log(`Average query time: ${stats.averageQueryTime}ms`);
```

## Development

### Prerequisites

- Node.js 20+
- Java/JDK available at runtime (for HSQLDB/JDBC)
- npm or yarn

### Setup

```bash
# Clone repository
git clone <repository-url>
cd starmade-db

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
starmade-db/
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

# Type-check only
npm run type-check

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
import { HSQLManager } from 'starmade-db';

const manager = new HSQLManager({
    starmadeDir: '/path/to/starmade',
    worldName: 'my_world',
    modules: {
        enableParameterizedQueries: true
    }
});

try {
    await manager.initialize();

    const paramQuery = manager.getModule('parameterized-query');
    const result = await paramQuery.execute(
        'SELECT TOP 20 ID, NAME FROM PLAYERS WHERE FACTION = ?',
        [123]
    );

    console.log(result.rows);
} finally {
    await manager.destroy();
}
```

### Performance Analysis

```javascript
const monitor = manager.getModule('performance-monitor');
const entities = new EntitiesController();
await entities.initialize(manager);

await entities.findEntities({ limit: 100 });

const stats = await monitor.getStatistics();
console.log(stats);
```

### Cache Management

```javascript
const cache = manager.getModule('cache-manager');
const players = new PlayersController();
await players.initialize(manager);

const firstPage = await players.findPlayers({ limit: 50 });
const freshPage = await players.findPlayers({ limit: 50, skipCache: true });
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

For detailed API usage, see [`docs/API.md`](docs/API.md).

## Documentation

- **API Documentation**: Available in `docs/api/`
- **StarMade DB Documentation**: Available in `docs/database/`
- **API Guide**: [`docs/API.md`](docs/API.md)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Issues: project issue tracker
- Discussions: project discussions
- Documentation: [`docs/API.md`](docs/API.md) and [`docs/database/INDEX.md`](docs/database/INDEX.md)

## Acknowledgments

- StarMade team for the game
- HSQLDB community for the database
- Project contributors