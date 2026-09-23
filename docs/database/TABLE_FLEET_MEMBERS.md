# FLEET_MEMBERS Table

## Overview
**FLEET_MEMBERS** is a junction table in the StarMade database that establishes the many-to-many relationship between fleets and entities. This table defines fleet composition by linking individual ships, stations, and other entities to their parent fleets, enabling complex fleet structures with detailed member-specific configurations and hierarchical docking arrangements.

---

## Table Structure

| Column             | Type             | Constraints              | Description                                                        |
|--------------------|------------------|--------------------------|--------------------------------------------------------------------|
| **ID**             | `BIGINT(64)`     | `NOT NULL`               | Member record ID                                                   |
| **FLEET_ID**       | `BIGINT(64)`     | `NOT NULL`               | Parent fleet                                                       |
| **ENTITY_ID**      | `BIGINT(64)`     | `NOT NULL`               | Member entity                                                      |
| **MISSION_STRING** | `VARCHAR(1024)`  | `NULL`                   | Individual member mission                                          |
| **LIST_INDEX**     | `INTEGER(32)`    | `NOT NULL`               | Position in fleet                                                  |
| **DOCKED_TO**      | `BIGINT(64)`     | `NOT NULL`               | ID of entity docked to                                             |
| **CARGO_CAPACITY** | `DOUBLE` | `NOT NULL DEFAULT 0` | Cargo capacity for trade deliveries |
| **FACTION**        | `INTEGER(32)`    | `NOT NULL DEFAULT 0`     | Faction ID                                                         |

**Primary Key:** `ID`  
**Constraints:** 
- `SYS_PK_10234` PRIMARY KEY on `ID`
- `EFKC` FOREIGN KEY `ENTITY_ID` → `ENTITIES.ID`
- `FFKC` FOREIGN KEY `FLEET_ID` → `FLEETS.ID`

---

## Column Details

### MISSION_STRING{#mission_string}
Individual mission assignment for this specific fleet member, which can differ from the overall fleet mission.

#### Active Mission States
| Mission String            | Operational Status           | Fleet Behavior                    |
|---------------------------|------------------------------|-----------------------------------|
| `"IDLE"`                  | No active mission            | Standby, awaiting orders          |
| `"IDLE - SENTRY"`         | Idle sentry mode             | Passive defense position          |
| `"SENTRY - FORMATION"`    | Formation sentry             | Coordinated defensive pattern     |
| `"CALLBACK TO CARRIER"`   | Returning to carrier         | Docking with mothership           |
| `"MINING"`                | Active mining operations     | Resource extraction               |
| `"PATROLLING"`            | Patrol route execution       | Following waypoint pattern        |
| `"TRADING"`               | Commercial operations        | Trade route execution             |
| `"MOVING"`                | Transit to destination       | En route to target coordinates    |
| `"REPAIRING"`             | Maintenance operations       | Seeking repair facilities         |
| `"STANDOFF"`              | Combat standoff              | Maintaining combat distance       |
| `"ATTACKING"`             | Active combat engagement     | Engaging hostile targets          |
| `"SENTRY"`                | Static defense mode          | Stationary defensive position     |
| `"DEFENDING"`             | Area defense                 | Protecting specific location      |
| `"ESCORTING"`             | Escort operations            | Protecting specific entity        |

#### Special Mission States
| Mission String            | Special Condition            | Fleet Behavior                    |
|---------------------------|------------------------------|-----------------------------------|
| `"CLOAKING"`              | Activating stealth           | Engaging cloaking systems         |
| `"UNCLOAKING"`            | Deactivating stealth         | Disengaging cloaking systems      |
| `"JAMMING"`               | Electronic warfare          | Activating sensor jamming          |
| `"STOP JAMMING"`          | Ending electronic warfare    | Deactivating sensor jamming       |
| `"FTL INTERDICTING"`      | Jump interdiction            | Preventing enemy FTL escape       |
| `"STOP FTL INTERDICTION"` | Ending interdiction          | Ceasing FTL interference          |

---

## Example Queries

see [EXEMPLE_FLEET_MEMBERS.md](./EXEMPLE_FLEET_MEMBERS.md) for a curated list of example queries that can be run against the **FLEET_MEMBERS** table.

---

## Changelog

| Version | Date       | Author       | Description                                        |
|---------|------------|--------------|----------------------------------------------------| 
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the FLEET_MEMBERS table schema |

[INDEX](./INDEX.md)