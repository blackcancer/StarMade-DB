# TRADE_HISTORY Table

## Overview
**TRADE_HISTORY** is a transaction logging table in the StarMade database designed to record all commercial trades between trading stations. However, this table is currently **UNUSED** in the game implementation, serving as a reserved structure for potential future transaction tracking and economic analytics functionality.

---

## Table Structure

| Column              | Type                     | Constraints              | Description                     |
|---------------------|--------------------------|--------------------------|----------------------------------| 
| **ID**              | `BIGINT(64)`             | `NOT NULL`               | Transaction ID                  |
| **FROM_ID**         | `BIGINT(64)`             | `NOT NULL`               | Source node ID                  |
| **TO_ID**           | `BIGINT(64)`             | `NOT NULL`               | Destination node ID             |
| **FROM_OWNER**      | `VARCHAR(128)`           | `NOT NULL`               | Source owner UID                |
| **TO_OWNER**        | `VARCHAR(128)`           | `NOT NULL`               | Destination owner UID           |
| **FROM_FACTION_ID** | `INTEGER(32)`            | `NOT NULL`               | Source faction                  |
| **TO_FACTION_ID**   | `INTEGER(32)`            | `NOT NULL`               | Destination faction             |
| **TOTAL_COST**      | `BIGINT(64)`             | `NOT NULL`               | Transaction value               |
| **DELIVERY_COST**   | `BIGINT(64)`             | `NOT NULL`               | Shipping fee                    |
| **SENT**            | `BIGINT(64)`             | `NOT NULL`               | Dispatch timestamp              |
| **RECEIVED**        | `BIGINT(64)`             | `NOT NULL`               | Delivery timestamp              |
| **VOLUME**          | `DOUBLE PRECISION(64)`   | `NOT NULL`               | Cargo volume                    |
| **SUCCESS**         | `BOOLEAN`                | `NOT NULL DEFAULT FALSE` | Completion status               |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10276` PRIMARY KEY on `ID`  
**References:** `FROM_ID`/`TO_ID` → `TRADE_NODES.ID` (implicit)

---

## Table Status: UNUSED

### Current Implementation Status
The TRADE_HISTORY table exists in the database schema but is **not actively used** by the StarMade game engine. This table represents a designed but unimplemented feature for comprehensive transaction logging.

---

## Example Queries (Theoretical)

see [EXEMPLE_TRADE_HISTORY.md](./EXEMPLE_TRADE_HISTORY.md) for theoretical example queries that could be run against the **TRADE_HISTORY** table if it were implemented.

---

## Changelog

| Version | Date       | Author       | Description                                           |
|---------|------------|--------------|-------------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the TRADE_HISTORY table schema   |

[INDEX](./INDEX.md)