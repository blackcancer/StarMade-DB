# EFFECTS Table

## Overview
**EFFECTS** is a table in the StarMade database that stores information about status effects and modifiers applied to entities. Each effect has a specific scope and purpose, ranging from ship performance enhancements to system-wide environmental modifications.

---

## Table Structure

| Column         | Type           | Constraints | Description                |
|----------------|----------------|-------------|----------------------------|
| **ID**         | `BIGINT(64)`   | `NOT NULL`  | Effect instance ID         |
| **ENTITY_ID**  | `BIGINT(64)`   | `NOT NULL`  | Affected entity            |
| **TYPE**       | `TINYINT(8)`   | `NOT NULL`  | Effect category            |
| **EFFECT_UID** | `VARCHAR(128)` | `NULL`      | Specific effect identifier |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10176` PRIMARY KEY on `ID`  
**References:** `ENTITY_ID` → `ENTITIES.ID` (implicit)

---

## Column Details

### TYPE{#type}
Effect classification values defining the scope and application level of the effect.

| Value | Name        | Description                   | Usage Notes                             |
|-------|-------------|-------------------------------|-----------------------------------------|
| `0`   | `OTHER`     | General/miscellaneous effects | Default category for custom effects     |
| `1`   | `STRUCTURE` | Structure-based effects       | Applied to ships, stations, structures  |
| `2`   | `SECTOR`    | Sector-wide effects           | Environmental effects affecting regions |
| `3`   | `SYSTEM`    | System-wide effects           | Large-scale effects across star systems |

### EFFECT_UID patterns{#effect_uid}

The EFFECT_UID field contains string identifiers for specific effect types. These are categorized by their functional area:

#### Movement & Navigation Effects
| Value                  | Description                      | Typical Usage                           |
|------------------------|----------------------------------|-----------------------------------------|
| `SPEED_BOOST`          | Increases entity movement speed  | Temporary speed enhancements            |
| `JUMP_DRIVE_CHARGE`    | Affects jump drive charging      | Modifies FTL preparation time           |
| `THRUST_EFFECTIVENESS` | Modifies thruster efficiency     | Engine performance modifications        |

#### Defensive & Shield Effects
| Value                | Description                      | Typical Usage                           |
|----------------------|----------------------------------|-----------------------------------------|
| `SHIELD_RECHARGE`    | Affects shield regeneration rate | Shield system enhancements             |
| `SHIELD_CAPACITY`    | Modifies maximum shield capacity | Shield upgrade effects                  |
| `ARMOR_EFFECTIVENESS`| Enhances armor protection        | Defensive bonuses                       |
| `ION_RESISTANCE`     | Protects against ion weapons     | Specialized defensive measures          |

#### Offensive & Weapons Effects
| Value              | Description                    | Typical Usage                           |
|--------------------|--------------------------------|-----------------------------------------|
| `DAMAGE_MULTIPLIER`| Increases weapon damage output | Weapon enhancement effects              |

#### Power & Energy Effects
| Value             | Description                    | Typical Usage                           |
|-------------------|--------------------------------|-----------------------------------------|
| `POWER_GENERATION`| Affects power generation rate  | Reactor efficiency modifications        |
| `POWER_CAPACITY`  | Modifies maximum power storage | Power system upgrades                   |

#### Utility & Operations Effects
| Value                   | Description                  | Typical Usage                           |
|-------------------------|------------------------------|-----------------------------------------|
| `MINING_EFFECTIVENESS`  | Enhances mining operations   | Mining ship bonuses                     |
| `SCANNER_RANGE`         | Increases scanner detection  | Reconnaissance improvements             |

#### Stealth & Electronic Warfare Effects
| Value      | Description                    | Typical Usage                 |
|------------|--------------------------------|-------------------------------|
| `STEALTH`  | Reduces detectability          | Stealth system activation     |
| `JAMMING`  | Interferes with enemy sensors  | Electronic countermeasures    |
| `CLOAKING` | Provides visual concealment    | Advanced stealth capabilities |

---

## Example Queries

see [EXEMPLE_EFFECTS.md](./EXEMPLE_EFFECTS.md) for a curated list of example queries that can be run against the **EFFECTS** table.

---

## Changelog

| Version | Date       | Author       | Description                                   |
|---------|------------|--------------|-----------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the EFFECTS table schema  |

[INDEX](./INDEX.md)