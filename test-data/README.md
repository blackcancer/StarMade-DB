# StarMade Test Dataset

## Overview

This comprehensive test dataset provides realistic test data for the StarMade database system. It contains over 600 records across 16 tables, representing a complete galactic ecosystem with players, factions, systems, entities, fleets, and their complex relationships.

## Dataset Statistics

| Table | Records | Description |
|-------|---------|-------------|
| SYSTEMS | 31 | Star systems with diverse types and ownership |
| PLAYERS | 67 | Player accounts with varied permissions and factions |
| SECTORS | 100 | Sectors across multiple systems |
| ENTITIES | 70 | Ships, stations, and celestial bodies |
| FLEETS | 50 | Fleet command structures with hierarchies |
| FLEET_MEMBERS | 65 | Fleet composition and member assignments |
| FTL | 50 | Jump gates and wormhole connections |
| TRADE_NODES | 30 | Trade stations and economic hubs |
| EFFECTS | 43 | Status effects and entity modifiers |
| MINES | 36 | Deployed mines with varied configurations |
| PLAYER_MESSAGES | 35 | Communication between players |
| SECTORS_ITEMS | 37 | Sector inventories and item distributions |
| TRADE_HISTORY | 20 | Historical trade transactions |
| VISIBILITY | 10 | Entity detection and tracking |
| NPC_STATS | 10 | NPC behavior and statistics |
| ID_GEN_TABLE | 16 | ID generation and management |
| **TOTAL** | **600+** | **Complete galactic ecosystem** |

## File Structure

```
test-data/
??? 00-cleanup.sql              # Cleanup script for existing test data
??? 01-systems.sql              # Star systems (31 records)
??? 02-players.sql              # Player accounts (67 records)
??? 03-sectors.sql              # Sectors (100 records)
??? 04-entities.sql             # Entities (70 records)
??? 05-fleets.sql               # Fleets (50 records)
??? 06-fleet-members.sql        # Fleet members (65 records)
??? 07-ftl.sql                  # FTL connections (50 records)
??? 08-trade-nodes.sql          # Trade nodes (30 records)
??? 09-effects.sql              # Effects (43 records)
??? 10-mines.sql                # Mines (36 records)
??? 11-player-messages.sql      # Player messages (35 records)
??? 12-sectors-items.sql        # Sector items (37 records)
??? 13-trade-history.sql        # Trade history (20 records)
??? 14-visibility.sql           # Visibility (10 records)
??? 15-NPC-stats.sql            # NPC stats (10 records)
??? 16-id-gen-table.sql         # ID generation table (16 records)
??? master-insert-all.sql       # Master execution script
??? README.md                   # This documentation
```

## Usage Instructions

### Quick Start
1. Run the cleanup script to remove existing test data:
   ```sql
   \i test-data/00-cleanup.sql
   ```

2. Run the master script to insert all test data:
   ```sql
   \i test-data/master-insert-all.sql
   ```

### Individual File Execution
Execute files in dependency order:
```sql
\i test-data/01-systems.sql
\i test-data/02-players.sql
\i test-data/03-sectors.sql
\i test-data/04-entities.sql
\i test-data/05-fleets.sql
\i test-data/06-fleet-members.sql
\i test-data/07-ftl.sql
\i test-data/08-trade-nodes.sql
\i test-data/09-effects.sql
\i test-data/10-mines.sql
\i test-data/11-player-messages.sql
\i test-data/12-sectors-items.sql
\i test-data/13-trade-history.sql
\i test-data/14-visibility.sql
\i test-data/15-NPC-stats.sql
\i test-data/16-id-gen-table.sql
```

## Dataset Features

### 1. Realistic Relationships
- Complete referential integrity between all tables
- Complex many-to-many relationships through junction tables
- Self-referencing relationships (entity docking, fleet hierarchies)
- Cross-table dependencies reflecting real game mechanics

### 2. Diverse Data Scenarios
- **6 Player Factions** with different roles and permissions
- **3 NPC Factions** (Trading Guild, Outcasts, Scavengers)
- **5 System Types** (Regular, Giant, Black Hole, Binary, Void)
- **18 Entity Types** (Ships, Stations, Planets, Asteroids, etc.)
- **Multiple Fleet Configurations** (Combat, Trading, Research, etc.)

### 3. Edge Cases and Special Conditions
- Docked entities with complex hierarchies
- Expired and degraded items
- Failed trade transactions
- Stealth and detection scenarios
- Emergency communications
- System malfunctions and repairs

### 4. Data Integrity Features
- Proper foreign key relationships
- Realistic value distributions
- Consistent naming conventions
- Comprehensive metadata fields
- Audit trails and timestamps

## Key Relationships

### Primary Relationships
```
SYSTEMS (1) ? (M) SECTORS ? (M) ENTITIES
PLAYERS (1) ? (M) FLEETS ? (M) FLEET_MEMBERS ? (1) ENTITIES
ENTITIES (1) ? (M) EFFECTS, MINES, TRADE_NODES
PLAYERS (1) ? (M) PLAYER_MESSAGES, TRADE_HISTORY
```

### Complex Relationships
- **Entity Docking Chains**: Ships docked to carriers, fighters to ships
- **Fleet Hierarchies**: Parent-child fleet relationships
- **FTL Networks**: Bidirectional jump gate connections
- **Trade Networks**: Economic relationships between players and factions

## Test Scenarios Covered

### 1. Basic CRUD Operations
- Create, read, update, delete operations on all tables
- Bulk operations and batch processing
- Transaction management and rollback scenarios

### 2. Complex Queries
- Multi-table joins across the entire schema
- Recursive queries for hierarchical data
- Aggregation and statistical analysis
- Spatial queries for coordinate-based data

### 3. Business Logic Testing
- Faction permission validation
- Fleet command hierarchies
- Trade transaction processing
- Resource management and allocation

### 4. Performance Testing
- Large dataset operations
- Complex relationship traversal
- Index usage optimization
- Query performance benchmarking

## Validation Queries

The master script includes validation queries to verify:
- Record counts per table
- Referential integrity
- Data diversity and distribution
- Relationship consistency

## Data Ranges

All test data uses ID ranges to avoid conflicts:
- **Entity IDs**: 1000000-1999999
- **Player IDs**: 1000000-1999999
- **Fleet IDs**: 1000000-1999999
- **System IDs**: 1000000-1999999
- **Coordinates**: Various ranges per table

## Cleanup

To remove all test data:
```sql
\i test-data/00-cleanup.sql
```

This will safely remove all test records while preserving production data outside the test ID ranges.

## Notes

- All timestamps use Unix epoch milliseconds
- Binary data fields use placeholder values
- Coordinates follow the game's 3D spatial system
- Faction IDs follow the game's faction system
- All relationships respect the database constraints

## License

This test dataset is provided for development and testing purposes as part of the StarMade database system project.