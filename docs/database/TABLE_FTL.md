# FTL Table

## Overview
**FTL** (Faster-Than-Light) is a specialized table in the StarMade database that manages jump gate connections and fast-travel networks throughout the galaxy. This table establishes the infrastructure for instantaneous travel between distant sectors, creating strategic transportation corridors that define the economic and military dynamics of the game universe.

---

## Table Structure

| Column         | Type             | Constraints              | Description                        |
|----------------|------------------|--------------------------|------------------------------------|
| **ID**         | `BIGINT(64)`     | `NOT NULL`               | Jump record ID                     |
| **FROM_X**     | `INTEGER(32)`    | `NOT NULL`               | Origin sector X coordinate         |
| **FROM_Y**     | `INTEGER(32)`    | `NOT NULL`               | Origin sector Y coordinate         |
| **FROM_Z**     | `INTEGER(32)`    | `NOT NULL`               | Origin sector Z coordinate         |
| **FROM_X_LOC** | `INTEGER(32)`    | `NOT NULL`               | Origin local X position (always 0) |
| **FROM_Y_LOC** | `INTEGER(32)`    | `NOT NULL`               | Origin local Y position (always 0) |
| **FROM_Z_LOC** | `INTEGER(32)`    | `NOT NULL`               | Origin local Z position (always 0) |
| **FROM_UID**   | `VARCHAR(128)`   | `NOT NULL`               | Origin entity UID                  |
| **TO_X**       | `INTEGER(32)`    | `NOT NULL`               | Destination sector X coordinate    |
| **TO_Y**       | `INTEGER(32)`    | `NOT NULL`               | Destination sector Y coordinate    |
| **TO_Z**       | `INTEGER(32)`    | `NOT NULL`               | Destination sector Z coordinate    |
| **TO_X_LOC**   | `INTEGER(32)`    | `NOT NULL DEFAULT 0`     | Destination local X position       |
| **TO_Y_LOC**   | `INTEGER(32)`    | `NOT NULL DEFAULT 0`     | Destination local Y position       |
| **TO_Z_LOC**   | `INTEGER(32)`    | `NOT NULL DEFAULT 0`     | Destination local Z position       |
| **TO_UID**     | `VARCHAR(128)`   | `NOT NULL`               | Destination entity UID             |
| **TYPE**       | `INTEGER(32)`    | `NOT NULL`               | Jump type                          |
| **PERMISSION** | `INTEGER(32)`    | `NOT NULL`               | Access control flags               |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10184` PRIMARY KEY on `ID`  
**References:** `FROM_UID`/`TO_UID` → `ENTITIES.UID` (implicit)

---

## Column Details

### TYPE{#type}
Classification of the FTL connection type determining its characteristics and behavior.

| Value | Name        | Description                | Usage                              | Characteristics              |
|-------|-------------|----------------------------|------------------------------------|------------------------------|
| `0`   | `WARP_GATE` | Fixed jump gate connection | Player-built gates                 | Constructed, controllable    |
| `1`   | `WORM_HOLE` | Natural space anomaly      | System-generated connections       | Natural, always active       |
| `2`   | `RACE_WAY`  | Racing/transit corridor    | High-speed transit lanes           | Specialized usage            |

### PERMISSION{#permission}
Access control flags using bitwise combinations to restrict FTL usage.

| Bit | Value | Name             | Description           | Common Use                    |
|-----|-------|------------------|-----------------------|-------------------------------|
| `0` | `1`   | `NO_SPAWN`       | No spawning allowed   | Prevent enemy spawning        |
| `1` | `2`   | `NO_ATTACK`      | No attacks allowed    | Peace zones                   |
| `2` | `4`   | `NO_ENTER`       | Entry prohibited      | Restricted jump gates         |
| `3` | `8`   | `NO_EXIT`        | Exit prohibited       | Trap wormholes                |
| `4` | `16`  | `NO_INDICATIONS` | No notifications      | Stealth transit               |
| `5` | `32`  | `NO_FP_LOSS`     | No faction point loss | Protected wormholes           |

#### Common Permission Combinations
| Value | Protection Level        | Usage                                    |
|-------|-------------------------|------------------------------------------|
| `0`   | Normal (no restrictions)| Standard FTL travel                      |
| `3`   | Peace zone              | NO_SPAWN + NO_ATTACK                     |
| `12`  | Locked connection       | NO_ENTER + NO_EXIT                       |
| `35`  | Full protection         | NO_SPAWN + NO_ATTACK + NO_FP_LOSS       |

---

## UID Patterns{#uid-patterns}

### Black Hole Wormholes
The most common pattern observed in the FTL table:

**Pattern:** `"BH_[position x]_[position y]_[position z]_OO_[offset x]_[offset y]_[offset z]"`

**Examples:**
- `"BH_-104_-24_200_OO_0_0_0"`
- `"BH_42_-15_88_OO_0_0_0"`

**Components:**
- **BH_**: Prefix indicating Black Hole wormhole
- **Position**: Sector coordinates of the wormhole
- **_OO_**: Separator (possibly "Origin-Offset")
- **Offset**: Local position offsets (typically 0,0,0)

---

## Example Queries

see [EXEMPLE_FTL.md](./EXEMPLE_FTL.md) for a curated list of example queries that can be run against the **FTL** table.

---

## Changelog

| Version | Date       | Author       | Description                                   |
|---------|------------|--------------|-----------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the FTL table schema     |

[INDEX](./INDEX.md)