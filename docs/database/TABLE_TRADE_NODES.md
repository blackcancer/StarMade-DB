# TRADE_NODES Table

## Overview
**TRADE_NODES** is an economic hub table in the StarMade database that manages station marketplaces for item exchange throughout the galaxy. This table serves as the foundation of the StarMade economy, storing information about trading stations, their inventories, pricing, permissions, and commercial operations that enable player-to-player and player-to-NPC commerce.

---

## Table Structure

| Column             | Type                     | Constraints                  | Description                                                        |
|--------------------|--------------------------|------------------------------|--------------------------------------------------------------------|
| **ID**             | `BIGINT(64)`             | `NULL`                       | Node identifier                                                    |
| **SEC_X**          | `INTEGER(32)`            | `NOT NULL`                   | Station sector X location                                          |
| **SEC_Y**          | `INTEGER(32)`            | `NOT NULL`                   | Station sector Y location                                          |
| **SEC_Z**          | `INTEGER(32)`            | `NOT NULL`                   | Station sector Z location                                          |
| **PLAYER**         | `VARCHAR(128)`           | `NOT NULL`                   | Owner player name                                                  |
| **STATION_NAME**   | `VARCHAR(128)`           | `NOT NULL`                   | Market display name                                                |
| **FACTION**        | `INTEGER(32)`            | `NOT NULL`                   | Faction identifier                                                 |
| **PERMISSION**     | `BIGINT(64)`             | `NOT NULL DEFAULT 15`        | Trade permission mask                                              |
| **ITEMS**          | `VARBINARY(73732)`       | `NOT NULL`                   | Zipped serialized NBT items with types, amounts, prices, limits   |
| **VOLUME**         | `DOUBLE PRECISION(64)`   | `NOT NULL`                   | Current cargo volume                                               |
| **CAPACITY**       | `DOUBLE PRECISION(64)`   | `NOT NULL`                   | Maximum capacity                                                   |
| **CREDITS**        | `BIGINT(64)`             | `NOT NULL`                   | Available credits                                                  |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10251` PRIMARY KEY on `ID`  
**References:** `ID` → `ENTITIES.ID` (implicit, stations are entities)

---

## Column Details

### PERMISSION{#permission}
Bitwise permission mask controlling who can access and trade with this station.

#### Permission Flags (Bitwise)
| Bit | Value | Name      | Description           | Usage                           |
|-----|-------|-----------|----------------------|--------------------------------|
| `0` | `1`   | `NEUTRAL` | Neutral players      | Open access for unaffiliated  |
| `1` | `2`   | `FACTION` | Faction members      | Own faction member access      |
| `2` | `4`   | `ALLY`    | Allied factions      | Diplomatic ally access         |
| `3` | `8`   | `NPC`     | NPC entities         | AI trader access               |
| `4` | `16`  | `ENEMY`   | Enemy factions       | Hostile faction access         |

#### Common Permission Combinations
| Value | Binary   | Meaning                    | Trade Policy                    |
|-------|----------|----------------------------|---------------------------------|
| `0`   | `00000`  | No access                  | Station closed                  |
| `1`   | `00001`  | Neutral only               | Public trading post             |
| `3`   | `00011`  | Neutral + Faction          | Faction-friendly trading        |
| `7`   | `00111`  | Neutral + Faction + Ally   | Diplomatic trading hub          |
| `15`  | `01111`  | All except enemies         | Standard commercial station     |
| `31`  | `11111`  | Universal access           | Free trade zone                 |

---

## Example Queries

see [EXEMPLE_TRADE_NODES.md](./EXEMPLE_TRADE_NODES.md) for a curated list of example queries that can be run against the **TRADE_NODES** table.

---

## Changelog

| Version | Date       | Author       | Description                                         |
|---------|------------|--------------|-----------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the TRADE_NODES table schema   |

[INDEX](./INDEX.md)
## ITEMS binary compatibility

For Open `e5a3b49d8`, the cell begins with two big-endian 32-bit lengths
(inflated size and compressed size), followed by a **zlib-wrapped** DEFLATE stream.
The payload contains a 64-bit entity ID, a 32-bit entry count, then entries of
14 bytes: signed short block type and three signed integers (amount, price, limit).
Negative block types are buy orders. The old SDK's raw DEFLATE requires the explicit
`legacy-sdk` profile; it is not the current game encoding.
