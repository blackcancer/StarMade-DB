# SECTORS Table

## Overview
**SECTORS** is a core table in the StarMade database that represents individual sectors within star systems. Each sector is a distinct region of space that can contain entities, resources, and various environmental features. This table serves as the foundation for the game's spatial organization and resource distribution.

---

## Table Structure

| Column               | Type           | Constraints              | Description                |
|----------------------|----------------|--------------------------|----------------------------|
| **ID**               | `BIGINT(64)`   | `NOT NULL`               | Sector identifier          |
| **X**                | `INTEGER(32)`  | `NOT NULL`               | Sector grid X coordinate   |
| **Y**                | `INTEGER(32)`  | `NOT NULL`               | Sector grid Y coordinate   |
| **Z**                | `INTEGER(32)`  | `NOT NULL`               | Sector grid Z coordinate   |
| **TYPE**             | `INTEGER(32)`  | `NOT NULL`               | Sector classification      |
| **NAME**             | `VARCHAR(64)`  | `NOT NULL`               | Sector designation         |
| **ITEMS**            | `BIGINT(64)`   | `NOT NULL`               | Unused, always 0           |
| **PROTECTION**       | `INTEGER(32)`  | `NOT NULL`               | Protection level flags     |
| **STELLAR**          | `INTEGER(32)`  | `NOT NULL`               | System identifier          |
| **TRANSIENT**        | `BOOLEAN`      | `NOT NULL DEFAULT TRUE`  | Auto-unload when empty     |
| **LAST_REPLENISHED** | `BIGINT(64)`   | `NOT NULL DEFAULT 0`     | Resource refresh timestamp |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10134` PRIMARY KEY on `ID`  
**References:** `ITEMS` → `SECTORS_ITEMS.ID` (implicit)

---

## Column Details

### TYPE{#type}
Sector classification that determines the primary characteristics and contents of the sector.

Current StarMade-Open `e5a3b49d8` ordinals, also used in `SYSTEMS.INFOS`:

| Value | Name |
| --- | --- |
| `0` | `SPACE_STATION` |
| `1` | `ASTEROID` |
| `2` | `PLANET` |
| `3` | `MAIN` |
| `4` | `SUN` |
| `5` | `BLACK_HOLE` |
| `6` | `VOID` |
| `7` | `LOW_ASTEROID` |
| `8` | `GIANT` |
| `9` | `DOUBLE_STAR` |

`WORMHOLE` and `NEBULA` were erroneous application labels and are not sector enum values in this revision.

### PROTECTION{#protection}
Protection level flags using bitwise combinations to control sector behavior and access.

| Bit | Value | Name             | Description                                   | Common Use                    |
|-----|-------|------------------|-----------------------------------------------|-------------------------------|
| `0` | `1`   | `NO_SPAWN`       | PROT_NO_SPAWN - peace mode, no enemy spawning | Trading sectors               |
| `1` | `2`   | `NO_ATTACK`      | PROT_NO_ATTACK - protected mode, no PvP       | Safe zones                    |
| `2` | `4`   | `NO_ENTER`       | LOCK_NO_ENTER - sector locked, no entry       | Restricted areas              |
| `3` | `8`   | `NO_EXIT`        | LOCK_NO_EXIT - sector locked, no exit         | Event areas                   |
| `4` | `16`  | `NO_INDICATIONS` | NO_INDICATIONS - no sector notifications      | Hidden sectors                |
| `5` | `32`  | `NO_FP_LOSS`     | NO_FP_LOSS - no faction point loss            | Faction protection            |

#### Common Protection Combinations
| Value | Protection Level        | Usage                                    |
|-------|-------------------------|------------------------------------------|
| `0`   | Normal sector           | No protection, standard gameplay         |
| `3`   | Safe zone               | NO_SPAWN + NO_ATTACK                     |
| `35`  | Complete protection     | NO_SPAWN + NO_ATTACK + NO_FP_LOSS        |
| `12`  | Locked sector           | NO_ENTER + NO_EXIT                       |

---

## Example Queries

see [EXEMPLE_SECTORS.md](./EXEMPLE_SECTORS.md) for a curated list of example queries that can be run against the **SECTORS** table.

---

## Security and Performance

### Performance Considerations
- **Spatial Indexes**: Critical for coordinate-based queries
- **TYPE Filtering**: Use indexes on TYPE for sector classification queries
- **STELLAR Grouping**: Efficient for system-wide operations
- **Coordinate Ranges**: Limit search areas to improve performance

### Security Implications
- **Protection Flags**: Enforce access control and gameplay rules
- **Resource Tracking**: Monitor sector exploitation and regeneration
- **Spatial Access**: Control movement and building permissions

---

## Changelog

| Version | Date       | Author       | Description                                   |
|---------|------------|--------------|-----------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the SECTORS table schema |

[INDEX](./INDEX.md)

## Global coordinate contract

`SectorTable.define()` creates the unique index `secCoordIndex(X,Y,Z)`. Coordinates identify a sector globally, regardless of `STELLAR`; two different rows at the same coordinates conflict even if their system references differ. `getUniqueCoordinateKey()` follows this index. `getSystemContextCoordinateKey()` additionally includes the system ID for diagnostics.

`calculateRelativeCoordinatesInSystem()` uses a 16-sector grid by default, matching the decoder's `SYSTEM_SIZE`. Floor division correctly maps negative positions: sector -1 belongs to grid coordinate -1 with local coordinate 15. This helper accepts an explicit positive integer grid size.
