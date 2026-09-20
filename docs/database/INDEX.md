# StarMade Database Documentation Index

## Overview

The StarMade database is a HSQLDB 2.3.4 instance that stores all persistent game data for a StarMade server. This includes players, entities (ships, stations, etc.), sectors, systems, fleets, and various game mechanics like trading and messaging.

### Database Metadata
- **Engine**: HSQLDB 2.3.4
- **Schema**: PUBLIC
- **Total Tables**: 16
- **Total Columns**: 150

## Related Documentation

- [Advanced Multi-Table SQL Examples](./EXEMPLE_ADVANCED.md) - Complex cross-database queries and analytics

---

## Complete Table Documentation

### Core Tables
| Table | Documentation | Examples | Description |
|-------|---------------|----------|-------------|
| **ENTITIES** | [TABLE_ENTITIES.md](./TABLE_ENTITIES.md) | [EXEMPLE_ENTITIES.md](./EXEMPLE_ENTITIES.md) | All game objects (ships, stations, asteroids, etc.) |
| **PLAYERS** | [TABLE_PLAYERS.md](./TABLE_PLAYERS.md) | [EXEMPLE_PLAYERS.md](./EXEMPLE_PLAYERS.md) | Player accounts and authentication |
| **SECTORS** | [TABLE_SECTORS.md](./TABLE_SECTORS.md) | [EXEMPLE_SECTORS.md](./EXEMPLE_SECTORS.md) | Space sectors within systems |
| **SYSTEMS** | [TABLE_SYSTEMS.md](./TABLE_SYSTEMS.md) | [EXEMPLE_SYSTEMS.md](./EXEMPLE_SYSTEMS.md) | Star systems containing sectors |

### Fleet Management
| Table | Documentation | Examples | Description |
|-------|---------------|----------|-------------|
| **FLEETS** | [TABLE_FLEETS.md](./TABLE_FLEETS.md) | [EXEMPLE_FLEETS.md](./EXEMPLE_FLEETS.md) | Fleet definitions and commands |
| **FLEET_MEMBERS** | [TABLE_FLEET_MEMBERS.md](./TABLE_FLEET_MEMBERS.md) | [EXEMPLE_FLEET_MEMBERS.md](./EXEMPLE_FLEET_MEMBERS.md) | Fleet composition and member entities |

### Game Mechanics
| Table | Documentation | Examples | Description |
|-------|---------------|----------|-------------|
| **EFFECTS** | [TABLE_EFFECTS.md](./TABLE_EFFECTS.md) | [EXEMPLE_EFFECTS.md](./EXEMPLE_EFFECTS.md) | Status effects and modifiers |
| **FTL** | [TABLE_FTL.md](./TABLE_FTL.md) | [EXEMPLE_FTL.md](./EXEMPLE_FTL.md) | Jump gate connections and fast travel |
| **MINES** | [TABLE_MINES.md](./TABLE_MINES.md) | [EXEMPLE_MINES.md](./EXEMPLE_MINES.md) | Deployable explosive devices |

### Trading & Economy
| Table | Documentation | Examples | Description |
|-------|---------------|----------|-------------|
| **TRADE_NODES** | [TABLE_TRADE_NODES.md](./TABLE_TRADE_NODES.md) | [EXEMPLE_TRADE_NODES.md](./EXEMPLE_TRADE_NODES.md) | Trading stations and marketplaces |
| **TRADE_HISTORY** | [TABLE_TRADE_HISTORY.md](./TABLE_TRADE_HISTORY.md) | [EXEMPLE_TRADE_HISTORY.md](./EXEMPLE_TRADE_HISTORY.md) | Transaction log (**UNUSED**) |

### Support Tables
| Table | Documentation | Examples | Description |
|-------|---------------|----------|-------------|
| **ID_GEN_TABLE** | [TABLE_ID_GEN_TABLE.md](./TABLE_ID_GEN_TABLE.md) | [EXEMPLE_ID_GEN_TABLE.md](./EXEMPLE_ID_GEN_TABLE.md) | Primary key sequence generator |
| **NPC_STATS** | [TABLE_NPC_STATS.md](./TABLE_NPC_STATS.md) | [EXEMPLE_NPC_STATS.md](./EXEMPLE_NPC_STATS.md) | NPC activity statistics by system |
| **PLAYER_MESSAGES** | [TABLE_PLAYER_MESSAGES.md](./TABLE_PLAYER_MESSAGES.md) | [EXEMPLE_PLAYER_MESSAGES.md](./EXEMPLE_PLAYER_MESSAGES.md) | In-game messaging system |
| **SECTORS_ITEMS** | [TABLE_SECTORS_ITEMS.md](./TABLE_SECTORS_ITEMS.md) | [EXEMPLE_SECTORS_ITEMS.md](./EXEMPLE_SECTORS_ITEMS.md) | Items floating in sectors |
| **VISIBILITY** | [TABLE_VISIBILITY.md](./TABLE_VISIBILITY.md) | [EXEMPLE_VISIBILITY.md](./EXEMPLE_VISIBILITY.md) | Fog of war tracking |

---

## Advanced Query Examples

### Multi-Table Analytics
The [EXEMPLE_ADVANCED.md](./EXEMPLE_ADVANCED.md) document provides sophisticated examples that demonstrate:

#### Fleet Operations with Cross-Table Analysis
- **Complete fleet composition** with entity details and spatial distribution
- **Fleet territorial control** and strategic positioning analysis
- **Cross-table joins** combining FLEETS ↔ FLEET_MEMBERS ↔ ENTITIES ↔ SECTORS ↔ SYSTEMS ↔ PLAYERS

#### Economic Intelligence and Trading Networks
- **Comprehensive trade network analysis** with player relationships
- **Economic correlation** between TRADE_NODES ↔ PLAYER_MESSAGES ↔ PLAYERS
- **Market intelligence** with hub identification and merchant profiles

#### Spatial and Infrastructure Analysis
- **Jump gate network connectivity** using recursive CTEs for route analysis
- **Docking hierarchy exploration** with complex entity relationships
- **Infrastructure analysis** combining FTL ↔ ENTITIES ↔ SECTORS ↔ SYSTEMS

#### Intelligence and Surveillance Operations
- **Player activity correlation** across multiple dimensions
- **Cross-table surveillance** tracking PLAYERS ↔ ENTITIES ↔ FLEETS ↔ PLAYER_MESSAGES
- **Behavioral pattern analysis** with temporal correlations

#### Resource and Mining Intelligence
- **Resource distribution analysis** with mining fleet deployment
- **Territorial mining rights** combining resource availability with faction control
- **Mining efficiency analysis** with geographic and political considerations

#### Performance Monitoring and Database Health
- **Cross-table data integrity** validation across all relationships
- **Comprehensive health reporting** with 7 different integrity checks
- **Database maintenance** recommendations based on multi-table analysis

---

## Getting Started

### For Database Analysis
1. Start with [schema validation](../SCHEMA_VALIDATION.md) for complete table structures
2. Review the individual table documents above for enumeration values and meanings
3. Explore individual TABLE_*.md files for detailed column descriptions
4. Use EXEMPLE_*.md files for query inspiration and learning

### For Advanced Analytics
1. Study [EXEMPLE_ADVANCED.md](./EXEMPLE_ADVANCED.md) for multi-table patterns
2. Focus on CTEs and recursive queries for hierarchical data
3. Learn cross-table joins for comprehensive analysis
4. Implement performance monitoring and integrity checks

### For Server Administration
1. Use NPC_STATS queries for server load analysis
2. Implement player activity monitoring from PLAYERS examples
3. Set up fleet and territorial analysis for faction balance
4. Monitor trade networks for economic health

---

## Database Relationships

### Enforced Foreign Key Constraints
| Constraint | Source → Target | Type | Description |
|------------|-----------------|------|-------------|
| **EFKC** | FLEET_MEMBERS.ENTITY_ID → ENTITIES.ID | Many-to-One | Fleet member entity reference |
| **FFKC** | FLEET_MEMBERS.FLEET_ID → FLEETS.ID | Many-to-One | Fleet membership |

### Implicit Relationships
While not enforced by foreign keys, these logical relationships exist:
- **EFFECTS.ENTITY_ID** → ENTITIES.ID (Effects applied to entities)
- **TRADE_NODES.ID** → ENTITIES.ID (Station entities as trade nodes)
- **SECTORS.ITEMS** → SECTORS_ITEMS.ID (Sector item storage)
- **FTL.FROM_UID/TO_UID** → ENTITIES.UID (Jump gate entity references)
- **Coordinate-based relationships** between SYSTEMS, SECTORS, and ENTITIES

---

## Data Type Reference

### HSQLDB Type Mappings
| SQL Type | HSQLDB Internal | Size | Range/Constraints |
|----------|-----------------|------|-------------------|
| **TINYINT** | `TINYINT` | 8 bits | -128 to 127 |
| **SMALLINT** | `SMALLINT` | 16 bits | -32,768 to 32,767 |
| **INTEGER** | `INTEGER` | 32 bits | -2³¹ to 2³¹-1 |
| **BIGINT** | `BIGINT` | 64 bits | -2⁶³ to 2⁶³-1 |
| **DOUBLE PRECISION** | `DOUBLE` | 64 bits | IEEE 754 double |
| **BOOLEAN** | `BOOLEAN` | 1 bit | TRUE/FALSE |
| **VARCHAR(n)** | `VARCHAR` | Variable | Up to n characters |
| **CHAR(n)** | `CHAR` | Fixed | Exactly n characters |
| **VARBINARY(n)** | `VARBINARY` | Variable | Up to n bytes of binary data |
| **ARRAY** | `ARRAY` | Variable | Multi-dimensional array data |

---

## Changelog

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| `1.0` | 2025-01-09 | InitSysRev | Initial creation of complete database documentation index |