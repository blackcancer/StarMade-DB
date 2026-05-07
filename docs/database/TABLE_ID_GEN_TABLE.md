# ID_GEN_TABLE Table

## Overview
**ID_GEN_TABLE** is a critical infrastructure table in the StarMade database that manages sequence generation for primary keys across the entire database system. This table serves as the central authority for generating unique identifiers, ensuring data integrity and preventing primary key collisions in the distributed game environment.

---

## Table Structure

| Column      | Type             | Constraints       | Description                     |
|-------------|------------------|-------------------|---------------------------------|
| **ID**      | `VARCHAR(128)`   | `NOT NULL`        | Sequence name                   |
| **ID_GEN**  | `BIGINT(64)`     | `NOT NULL`        | Next available ID value         |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10092` PRIMARY KEY on `ID`

---

## Example Queries

see [EXEMPLE_ID_GEN_TABLE.md](./EXEMPLE_ID_GEN_TABLE.md) for a curated list of example queries that can be run against the **ID_GEN_TABLE** table.

---

## Changelog

| Version | Date       | Author       | Description                                         |
|---------|------------|--------------|-----------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the ID_GEN_TABLE table schema   |

[INDEX](./INDEX.md)