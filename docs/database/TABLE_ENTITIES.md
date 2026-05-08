# ENTITIES Table

## Overview
**ENTITIES** is a table in the StarMade database that stores information about various entities in the game.
Each entity has a unique identifier and is associated with specific attributes such as position, velocity,
and type.

---

## Table Structure

| Column                 | Type           | Constraints          | Description                                         |
|------------------------|----------------|----------------------|-----------------------------------------------------|
| **ID**                 | `BIGINT(64)`   | `NOT NULL`           | Internal surrogate key                              |
| **UID**                | `VARCHAR(128)` | `NOT NULL`           | External persistent identifier                      |
| **X**                  | `INTEGER(32)`  | `NOT NULL`           | Sector X coordinate                                 |
| **Y**                  | `INTEGER(32)`  | `NOT NULL`           | Sector Y coordinate                                 |
| **Z**                  | `INTEGER(32)`  | `NOT NULL`           | Sector Z coordinate                                 |
| **TYPE**               | `TINYINT(8)`   | `NOT NULL`           | Entity type                                         |
| **NAME**               | `CHAR(64)`     | `NULL`               | Display name of the entity                          |
| **FACTION**            | `INTEGER(32)`  | `NULL DEFAULT 0`     | Owning faction ID                                   |
| **CREATOR**            | `VARCHAR(64)`  | `NULL`               | Creation author									   |
| **LAST_MOD**           | `VARCHAR(64)`  | `NULL`               | Most recent modifying author                        |
| **SEED**               | `BIGINT(64)`   | `NULL`               | Procedural generation seed                          |
| **TOUCHED**            | `BOOLEAN`      | `NULL`               | Whether visited/loaded since generation             |
| **LOCAL_POS**          | `ARRAY`        | `NULL`               | Coordinate within the sector where the entity stand |
| **DIM**                | `ARRAY`        | `NULL`               | Dimensions of the entity bounding box               |
| **GEN_ID**             | `INTEGER(32)`  | `NULL`               | Internal build version                              |
| **DOCKED_TO**          | `BIGINT(64)`   | `NULL DEFAULT -1`    | Parent entity ID if docked (-1 if not docked)       |
| **DOCKED_ROOT**        | `BIGINT(64)`   | `NULL DEFAULT -1`    | Root of docking chain (-1 if not docked)            |
| **SPAWNED_ONLY_IN_DB** | `BOOLEAN`      | `NULL DEFAULT FALSE` | Present only in DB, not yet spawned                 |
| **TRACKED**            | `BOOLEAN`      | `NULL DEFAULT FALSE` | Marked for tracking by server tools                 |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10167` PRIMARY KEY on `ID`  
**Referenced By:** `FLEET_MEMBERS.ENTITY_ID` (EFKC)

---

## Column Details

### TYPE{#type}
Entity classification values (numeric enumeration).

| Value | Name               | Description                | Usage Notes                          |
|-------|--------------------|----------------------------|--------------------------------------|
| `0`   | `SHIP`             | Player or NPC spacecraft   | Player-owned vessels                 |
| `1`   | `SPACE_STATION`    | Stationary structure       | Common for NPC trade nodes           |
| `2`   | `PLANET`           | Natural celestial body     | Generated in planetary systems       |
| `3`   | `ASTEROID`         | Mineable space rock        | Found in asteroid belts              |
| `4`   | `FLOAT_ROCK`       | Decorative asteroid        | Visual enhancement only              |
| `5`   | `SHIP_CORE`        | Minimal ship entity        | Most common entity type              |
| `6`   | `ASTEROID_MANAGED` | System-controlled asteroid | Auto-replenishing resources          |
| `7`   | `SPACE_CREATURE`   | Organic space entity       | Rare encounters                      |
| `8`   | `PLANET_ICO`       | Icosahedral planet         | Performance-optimized planets        |
| `10`  | `ASTRONAUT`        | Player avatar              | Player outside of ship               |
| `11`  | `NPC`              | Non-player character       | Station inhabitants                  |
| `12`  | `SHOP`             | Trading post station       | Automated trade centers              |
| `13`  | `PLANET_SEGMENT`   | Planet surface section     | Planet subdivision                   |
| `14`  | `PLANET_CORE`      | Planet center entity       | Hidden entity                        |
| `15`  | `BLACK_HOLE`       | Gravitational anomaly      | System hazard                        |
| `16`  | `SUN`              | Star entity                | System center                        |
| `17`  | `VEHICLE`          | Ground/atmospheric craft   | Surface vehicles                     |
| `18`  | `DEATH_STAR`       | Superweapon platform       | End-game content                     |

### UID patterns{#uid}

| Pattern																	   | Exemple						 | Context                | Usage Notes                          |
|------------------------------------------------------------------------------|---------------------------------|----------------------------|--------------------------------------|
| FLTSHP_[faction id]_[system x]_[system y]_[system z]_[ship creator number]   | `"FLTSHP_-10000000_-1_-1_-1_0"` | NPC spacecraft   |
| BH_[positon x]_[position y]_[position z]_oo_[offset x]_[offset y]_[offset z] | `"BH_-104_-24_200_OO_0_0_0"`	   | NPC spacecraft   |

### FACTION sentinel value{#faction}

| Value		  | Meaning           |
|-------------|-------------------|
| `0`		  | No faction        |
| `-10000000` | NPC Trading Guild |
| `-9999999`  | NOC Outcasts      |
| `-9999998`  | NPC Scavengers    |
| `> 0`		  | Player factions   |

### CREATOR and LAST_MOD sentinel value{#creator}
| Value												 | Created By								  |
|----------------------------------------------------|--------------------------------------------|
| `ENTITY_PLAYERSTATE_[playerName]` or `playerName`  | Player									  |
| ``											 | Simulation Enfine or NPC Fleets			  |
| `<system>`										 | NPC Fleets								  |
| `SHIPYARD_ENTITY_SPACESTATION_[UIDOfSpaceStation]` | Shipyard									  |
| (blank)											 | some entities can be spawn without creator | 

### Docking sentinel values
`DOCKET_TO = -1` and `DOCKED_ROOT = -1` indicate that the entity is not docked to any other entity.

---

## Example Queries

see [EXEMPLE_ENTITIES.md](./EXEMPLE_ENTITIES.md) for a curated list of example queries that can be run against the **ENTITIES** table.

---

## Changelog

| Version | Date       | Author       | Description                                   |
|---------|------------|--------------|-----------------------------------------------|
| `1.0`   | 2025-07-11 | InitSysRev   | Initial creation of the ENTITIES table schema |

[INDEX](./INDEX.md)