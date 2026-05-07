# FLEETS Table

## Overview
**FLEETS** is a strategic command table in the StarMade database that manages collections of entities operating together as coordinated units. This table serves as the central control system for fleet operations, containing command structures, mission parameters, and hierarchical relationships that enable sophisticated group tactics and automated behaviors.

---

## Table Structure

| Column             | Type                | Constraints              | Description                     |
|--------------------|---------------------|--------------------------|---------------------------------|
| **ID**             | `BIGINT(64)`        | `NOT NULL`               | Fleet identifier                |
| **FLAGSHIP_ID**    | `BIGINT(64)`        | `NOT NULL`               | Leading entity ID               |
| **PARENT_FLEET**   | `BIGINT(64)`        | `NULL DEFAULT -1`        | Parent fleet for hierarchies    |
| **NAME**           | `VARCHAR(128)`      | `NULL`                   | Fleet designation               |
| **OWNER**          | `VARCHAR(128)`      | `NULL`                   | Controlling player UID          |
| **MISSION_STRING** | `VARCHAR(1024)`     | `NULL`                   | High-level mission description  |
| **COMMAND**        | `VARBINARY(1024)`   | `NULL`                   | Serialized command data         |
| **FACTION_ACCESS** | `TINYINT(8)`        | `NULL DEFAULT 0`         | Access permission level bitmask |
| **SAVED_REMOTES**  | `VARBINARY(1024)`   | `NULL`                   | Serialized NBT remote data      |
| **COMBAT_SETTING** | `VARCHAR(128)`      | `NULL`                   | Combat behavior preset          |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10228` PRIMARY KEY on `ID`  
**Referenced By:** `FLEET_MEMBERS.FLEET_ID` (FFKC)

---

## Column Details

### MISSION_STRING{#mission_string}
High-level mission description indicating the fleet's current operational status and objectives.

#### Active Mission States
| Mission String          | Operational Status           | Fleet Behavior                    |
|-------------------------|------------------------------|-----------------------------------|
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
| Mission String          | Special Condition            | Fleet Behavior                    |
|-------------------------|------------------------------|-----------------------------------|
| `"CLOAKING"`              | Activating stealth           | Engaging cloaking systems         |
| `"UNCLOAKING"`            | Deactivating stealth         | Disengaging cloaking systems      |
| `"JAMMING"`               | Electronic warfare          | Activating sensor jamming          |
| `"STOP JAMMING"`          | Ending electronic warfare    | Deactivating sensor jamming       |
| `"FTL INTERDICTING"`      | Jump interdiction            | Preventing enemy FTL escape       |
| `"STOP FTL INTERDICTION"` | Ending interdiction          | Ceasing FTL interference          |

### COMMAND{#command}
Serialized data containing the specific fleet command with parameters, arguments, and execution details.

#### FleetCommand Binary Layout
1. **Faction ID** (4 bytes) - 32-bit signed integer
2. **Command Ordinal** (4 bytes) - 32-bit signed integer 
3. **Arguments Array** - Length-prefixed list with type tags

#### Command Types
| Index | Constant               | Arguments                     | Behavior                                    |
|-------|------------------------|-------------------------------|---------------------------------------------|
| `0`   | `IDLE`                 | None                          | Fleet enters idle standby state             |
| `1`   | `MOVE_FLEET`           | `Vector3i destination`        | Fleet moves to specified sector             |
| `2`   | `PATROL_FLEET`         | `Vector3i[] waypoints`        | Fleet follows patrol route                  |
| `3`   | `TRADE_FLEET`          | `Vector3i targetSector`       | Fleet performs trading operations           |
| `4`   | `FLEET_ATTACK`         | `Vector3i targetSector`       | Fleet attacks specified sector              |
| `5`   | `FLEET_DEFEND`         | `Vector3i anchorSector`       | Fleet defends specified sector              |
| `6`   | `ESCORT`               | None                          | Fleet escorts flagship                      |
| `7`   | `REPAIR`               | None                          | Fleet seeks repair facilities               |
| `8`   | `STANDOFF`             | None                          | Fleet maintains combat distance             |
| `9`   | `SENTRY_FORMATION`     | None                          | Fleet forms defensive circle                |
| `10`  | `SENTRY`               | None                          | Fleet enters static defense mode           |
| `11`  | `FLEET_IDLE_FORMATION` | None                          | Fleet maintains loose formation             |
| `12`  | `CALL_TO_CARRIER`      | None                          | Fleet recalls docked ships                 |
| `13`  | `MINE_IN_SECTOR`       | None                          | Fleet begins mining operations              |
| `14`  | `CLOAK`                | None                          | Fleet activates cloaking                   |
| `15`  | `UNCLOAK`              | None                          | Fleet deactivates cloaking                 |
| `16`  | `JAM`                  | None                          | Fleet activates radar jamming              |
| `17`  | `UNJAM`                | None                          | Fleet deactivates radar jamming            |
| `18`  | `ACTIVATE_REMOTE`      | `String name, Boolean state` | Fleet toggles remote system                |
| `19`  | `INTERDICT`            | None                          | Fleet activates jump interdiction          |
| `20`  | `STOP_INTERDICT`       | None                          | Fleet deactivates jump interdiction        |

#### Argument Value Tags
| Tag | Type         | Description           | Example Usage                    |
|-----|--------------|-----------------------|----------------------------------|
| `1` | `int`        | 32-bit integer        | Coordinates, counts, flags       |
| `2` | `long`       | 64-bit integer        | Entity IDs, timestamps           |
| `3` | `float`      | 32-bit float          | Distances, ratios                |
| `4` | `String`     | Variable string       | Names, identifiers               |
| `5` | `boolean`    | True/false flag       | On/off states                    |
| `6` | `byte`       | 8-bit integer         | Small values, type indicators    |
| `7` | `short`      | 16-bit integer        | Medium range values              |
| `8` | `byte[]`     | Binary data array     | Complex data structures          |
| `9` | `Object[]`   | Nested object array   | Complex argument lists           |
| `10`| `Vector3i`   | 3D integer vector     | Coordinates (x, y, z)            |
| `11`| `Vector3f`   | 3D float vector       | Precise positions                |
| `12`| `Vector4f`   | 4D float vector       | Extended coordinate data         |

### FACTION_ACCESS{#faction_access}
Access permission level controlling who can command and modify the fleet.

| Value | Name        | Description           | Who Can Control                |
|-------|-------------|-----------------------|--------------------------------|
| `0`   | `NONE`      | Only owner can access | Fleet owner only               |
| `1`   | `OFFICER`   | Officers and above    | Officers, commanders, leaders  |
| `2`   | `COMMANDER` | Commanders and above  | Commanders and leaders         |
| `3`   | `MEMBER`    | Members and above     | All faction members            |
| `4`   | `RECRUIT`   | Recruits and above    | Including new recruits         |
| `5`   | `ALL`       | Anyone                | Public access                  |

### SAVED_REMOTES{#saved_remotes}

The SAVED_REMOTES field uses a custom binary format produced by `Fleet.serialize(DataOutput...)` and `Fleet.deserialize(DataInput...)`, which is **not** NBT and **not** Java `ObjectOutputStream`.

##### Header Layout
| Offset | Size | Java Type | Description                                           |
|--------|------|-----------|-------------------------------------------------------|
| `0`    | 1    | `byte`    | **hasRemotes** - 0 = no saved ISR, 1 = list follows |
| `1`    | 2    | `short`   | **count** - number of remote entries (big-endian)    |
| `3`    | ...  | loop      | Remote entries (see entry layout below)              |

##### Remote Entry Layout
Each remote entry is stored consecutively without padding:

| Order | Size       | Java Type      | Content                                                    |
|-------|------------|----------------|------------------------------------------------------------|
| a     | 2 bytes    | `short`        | **len** - length of remote name (big-endian)              |
| b     | `len` bytes| modified UTF-8 | **remoteName** - Inner-Ship Remote identifier             |
| c     | 1 byte     | `byte`         | **toggle** - 0 = deactivate, 1 = activate                 |

#### Remote Control System
The saved remotes system enables fleet-wide control of Inner-Ship Remote blocks across all fleet members:

### COMBAT_SETTING{#combat_setting}
Combat behavior preset determining how the fleet engages in combat situations.

| Value              | Name             | Description                     | AI Behavior                              |
|--------------------|------------------|---------------------------------|------------------------------------------|
| `PASSIVE`          | Passive          | Will not engage unless attacked | Defensive only, retaliates when damaged  |
| `SOMETIMES ENGAGE` | Sometimes Engage | Selective engagement            | Evaluates threats, engages if favorable  |
| `ALWAYS ENGAGE`    | Always Engage    | Actively seeks enemies          | Aggressive, seeks targets in range       |
| `ALWAYS FLEE`      | Always Flee      | Avoids all combat               | Runs from any threat                     |

---

## Fleet Naming Patterns{#naming-patterns}

### NPC Fleet Patterns
NPC fleets follow structured naming conventions that encode operational information:

**Pattern:** `"[prefix]#[type]#[faction id]#[system x], [system y], [system z]#[index]"`

#### Prefixes
- **NPCFLT**: Standard NPC fleet
- **GNPCFLT**: Guild NPC fleet (Trading Guild specific)

#### Fleet Types
- **Attacking**: Offensive combat operations
- **Defending**: Defensive and patrol operations
- **Mining**: Resource extraction operations
- **Trading**: Commercial and transport operations
- **Scavenging**: Salvage and recovery operations

#### Examples
NPCFLT#DEFENDING#-10000000#0, 0, 0#0
GNPCFLT#TRADING#-10000000#2, 1, -1#3
NPCFLT#MINING#-9999998#-5, 3, 8#1
---

## Example Queries

see [EXEMPLE_FLEETS.md](./EXEMPLE_FLEETS.md) for a curated list of example queries that can be run against the **FLEETS** table.

---

## Changelog

| Version | Date       | Author       | Description                                   |
|---------|------------|--------------|-----------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the FLEETS table schema  |

[INDEX](./INDEX.md)