# MINES Table

## Overview
**MINES** is a tactical warfare table in the StarMade database that manages deployable explosive devices throughout space. This table stores information about space mines including their ownership, composition, positioning, arming status, and operational parameters, enabling sophisticated area denial and defensive strategies.

---

## Table Structure

| Column             | Type                     | Constraints                  | Description                                                        |
|--------------------|--------------------------|------------------------------|--------------------------------------------------------------------|
| **ID**             | `INTEGER(32)`            | `NOT NULL`                   | Mine identifier                                                    |
| **OWNER**          | `BIGINT(64)`             | `NOT NULL`                   | Deploying player ID                                                |
| **FACTION**        | `INTEGER(32)`            | `NOT NULL DEFAULT 0`         | Owner's faction                                                    |
| **HP**             | `SMALLINT(16)`           | `NOT NULL`                   | Mine durability                                                    |
| **COMPOSITION**    | `ARRAY`                  | `NOT NULL`                   | Component materials                                                |
| **SECTOR_X**       | `INTEGER(32)`            | `NOT NULL`                   | Deployment sector X                                                |
| **SECTOR_Y**       | `INTEGER(32)`            | `NOT NULL`                   | Deployment sector Y                                                |
| **SECTOR_Z**       | `INTEGER(32)`            | `NOT NULL`                   | Deployment sector Z                                                |
| **LOCAL_X**        | `DOUBLE PRECISION(64)`   | `NOT NULL`                   | Local X coordinate                                                 |
| **LOCAL_Y**        | `DOUBLE PRECISION(64)`   | `NOT NULL`                   | Local Y coordinate                                                 |
| **LOCAL_Z**        | `DOUBLE PRECISION(64)`   | `NOT NULL`                   | Local Z coordinate                                                 |
| **CREATION_DATE**  | `BIGINT(64)`             | `NOT NULL`                   | Deployment timestamp                                               |
| **ARMED**          | `BOOLEAN`                | `NOT NULL DEFAULT FALSE`     | Activation status                                                  |
| **ARMED_IN_SECS**  | `INTEGER(32)`            | `NOT NULL DEFAULT -1`        | Arming countdown                                                   |
| **AMMO**           | `SMALLINT(16)`           | `NOT NULL DEFAULT -2`        | Remaining triggers                                                 |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10326` PRIMARY KEY on `ID`

---

## Column Details

### COMPOSITION{#composition}
Array containing the mine's component configuration, determining its capabilities and behavior.

| Property          | Details                              |
|-------------------|--------------------------------------|
| **Type**          | `ARRAY` - Multi-dimensional array    |
| **Size**          | Fixed 6-element array                |
| **Purpose**       | Mine specification and capabilities  |
| **Format**        | Block ID array defining mine config  |

#### Composition Layout (6 Slots)
| Slot | Component Type      | Purpose                      | Effect                              |
|------|---------------------|------------------------------|-------------------------------------|
| `0`  | **Core Block**      | Mine type determination      | CANNON, MISSILE, PROXIMITY          |
| `1`  | **Strength Module** | Damage scaling               | Explosion power and damage radius   |
| `2`  | **Radius Module**   | Trigger range                | Detection distance in meters        |
| `3`  | **Stealth Module**  | Jamming level                | Visibility and scanner resistance   |
| `4`  | **Firing Module**   | Burst/seeker/contact         | Detonation behavior and targeting   |
| `5`  | **Reserved**        | Future expansion             | Currently unused                    |

---

## Changelog

| Version | Date       | Author       | Description                                      |
|---------|------------|--------------|--------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the MINES table schema      |

[INDEX](./INDEX.md)