# PLAYER_MESSAGES Table

## Overview
**PLAYER_MESSAGES** is a communication table in the StarMade database that manages the in-game messaging system between players. This table stores all messages exchanged within the game universe, including private communications, item attachments, and read status tracking for a comprehensive player interaction system.

---

## Table Structure

| Column        | Type             | Constraints              | Description                      |
|---------------|------------------|--------------------------|----------------------------------|
| **ID**        | `BIGINT(64)`     | `NOT NULL`               | Message ID                       |
| **SENDER**    | `VARCHAR(64)`    | `NOT NULL`               | Sender player UID                |
| **RECEIVER**  | `VARCHAR(64)`    | `NOT NULL`               | Recipient player UID             |
| **TOPIC**     | `VARCHAR(128)`   | `NOT NULL`               | Message subject                  |
| **MESSAGE**   | `VARCHAR(1024)`  | `NOT NULL`               | Message body content             |
| **SENT**      | `BIGINT(64)`     | `NOT NULL`               | Timestamp (epoch milliseconds)   |
| **READ**      | `BOOLEAN`        | `NULL DEFAULT FALSE`     | Read status flag                 |
| **ATT_ID**    | `BIGINT(64)`     | `NULL`                   | Attached entity ID (gifts/items) |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10312` PRIMARY KEY on `ID`

---

## Example Queries

see [EXEMPLE_PLAYER_MESSAGES.md](./EXEMPLE_PLAYER_MESSAGES.md) for a curated list of example queries that can be run against the **PLAYER_MESSAGES** table.

---

## Changelog

| Version | Date       | Author       | Description                                          |
|---------|------------|--------------|------------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the PLAYER_MESSAGES table schema |

[INDEX](./INDEX.md)