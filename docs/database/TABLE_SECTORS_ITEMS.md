# SECTORS_ITEMS Table

## Overview
**SECTORS_ITEMS** is a specialized binary storage table in the StarMade database that stores serialized data for items floating freely in space sectors. This table manages the persistence of dropped items, salvaged materials, and other loose objects that exist within sectors but are not attached to entities.

---

## Table Structure

| Column    | Type                 | Constraints | Description                |
|-----------|----------------------|-------------|----------------------------|
| **ID**    | `BIGINT(64)`         | `NULL`      | Sector reference           |
| **ITEMS** | `VARBINARY(22528)`   | `NOT NULL`  | Serialized item stack data |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10157` PRIMARY KEY on `ID`  
**Referenced By:** `SECTORS.ITEMS` (implicit)

---

## Column Details

### ITEMS Data Structure
The ITEMS field stores a sequence of fixed-size records, each representing one floating item stack:

| Offset | Size | Type      | Field     | Description                    |
|--------|------|-----------|-----------|--------------------------------|
| 0      | 2    | SMALLINT  | `TYPE`    | Item type identifier           |
| 2      | 4    | INTEGER   | `COUNT`   | Number of items in stack       |
| 6      | 4    | FLOAT     | `POS_X`   | Local X position in sector     |
| 10     | 4    | FLOAT     | `POS_Y`   | Local Y position in sector     |
| 14     | 4    | FLOAT     | `POS_Z`   | Local Z position in sector     |
| 18     | 4    | INTEGER   | `META_ID` | Additional metadata identifier |

**Total Record Size:** 22 bytes per item stack  
**Maximum Records:** 22,528 ÷ 22 = 1,024 item stacks per sector

---

## Changelog

| Version | Date       | Author       | Description                                        |
|---------|------------|--------------|----------------------------------------------------| 
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the SECTORS_ITEMS table schema|

[INDEX](./INDEX.md)