# VISIBILITY Table

## Overview
**VISIBILITY** is a strategic intelligence table in the StarMade database that implements the "fog of war" system. This table tracks which sectors have been explored by specific players or factions, creating a persistent record of spatial knowledge and reconnaissance activities throughout the galaxy.

---

## Table Structure

| Column        | Type           | Constraints | Description                  |
|---------------|----------------|-------------|------------------------------|
| **ID**        | `BIGINT(64)`   | `NULL`      | Observer ID (player/faction) |
| **X**         | `INTEGER(32)`  | `NOT NULL`  | Observed sector X coordinate |
| **Y**         | `INTEGER(32)`  | `NOT NULL`  | Observed sector Y coordinate |
| **Z**         | `INTEGER(32)`  | `NOT NULL`  | Observed sector Z coordinate |
| **TIMESTAMP** | `BIGINT(64)`   | `NULL`      | First observation time       |

**Primary Key:** `ID, X, Y, Z` (composite)  
**Constraints:** `SYS_PK_10222` PRIMARY KEY on `ID, X, Y, Z`

---

## Example Queries

see [EXEMPLE_VISIBILITY.md](./EXEMPLE_VISIBILITY.md) for a curated list of example queries that can be run against the **VISIBILITY** table.

---

## Changelog

| Version | Date       | Author       | Description                                     |
|---------|------------|--------------|-------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the VISIBILITY table schema |

[INDEX](./INDEX.md)