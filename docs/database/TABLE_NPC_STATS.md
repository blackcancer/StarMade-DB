# NPC_STATS Table

## Overview
**NPC_STATS** is a strategic intelligence table in the StarMade database that aggregates NPC activity by star system coordinates. This table provides critical insights into AI-driven fleet and entity spawning patterns, enabling server administrators and players to understand NPC population dynamics and strategic deployment across the galaxy.

---

## Table Structure

| Column             | Type             | Constraints               | Description                     |
|--------------------|------------------|---------------------------|---------------------------------|
| **ID**             | `INTEGER(32)`    | `NULL`                    | Placeholder (-10000000)         |
| **SYS_X**          | `INTEGER(32)`    | `NOT NULL`                | System X coordinate             |
| **SYS_Y**          | `INTEGER(32)`    | `NOT NULL`                | System Y coordinate             |
| **SYS_Z**          | `INTEGER(32)`    | `NOT NULL`                | System Z coordinate             |
| **FLEET_SPAWNS**   | `INTEGER(32)`    | `NULL DEFAULT 0`          | Fleet spawn count               |
| **ENTITY_SPAWNS**  | `INTEGER(32)`    | `NULL DEFAULT 0`          | Entity spawn count              |

**Primary Key:** `ID, SYS_X, SYS_Y, SYS_Z` (composite)  
**Constraints:** `SYS_PK_10306` PRIMARY KEY on `ID, SYS_X, SYS_Y, SYS_Z`

---

## Example Queries

see [EXEMPLE_NPC_STATS.md](./EXEMPLE_NPC_STATS.md) for a curated list of example queries that can be run against the **NPC_STATS** table.

---

## Changelog

| Version | Date       | Author       | Description                                       |
|---------|------------|--------------|---------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the NPC_STATS table schema    |

[INDEX](./INDEX.md)