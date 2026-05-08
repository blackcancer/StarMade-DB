# SYSTEMS Table

## Overview
**SYSTEMS** is a high-level table in the StarMade database that represents star systems within the galaxy grid. Each system serves as a container for multiple sectors and defines the large-scale structure of the game universe. This table manages territorial control, resource distribution, and the fundamental organization of space.

---

## Table Structure

| Column            | Type                | Constraints              | Description                    |
|-------------------|---------------------|--------------------------|--------------------------------|
| **ID**            | `BIGINT(64)`        | `NOT NULL`               | System identifier              |
| **X**             | `INTEGER(32)`       | `NOT NULL`               | System grid X coordinate       |
| **Y**             | `INTEGER(32)`       | `NOT NULL`               | System grid Y coordinate       |
| **Z**             | `INTEGER(32)`       | `NOT NULL`               | System grid Z coordinate       |
| **TYPE**          | `INTEGER(32)`       | `NOT NULL`               | System classification          |
| **STARTTIME**     | `BIGINT(64)`        | `NULL`                   | Generation timestamp           |
| **NAME**          | `VARCHAR(64)`       | `NULL`                   | System name                    |
| **INFOS**         | `VARBINARY(8192)`   | `NOT NULL`               | Additional system data         |
| **OWNER_UID**     | `VARCHAR(128)`      | `NULL`                   | Controlling entity UID         |
| **OWNER_FACTION** | `INTEGER(32)`       | `NOT NULL DEFAULT 0`     | Controlling faction            |
| **OWNER_X**       | `INTEGER(32)`       | `NOT NULL DEFAULT 0`     | Owner home X coordinate        |
| **OWNER_Y**       | `INTEGER(32)`       | `NOT NULL DEFAULT 0`     | Owner home Y coordinate        |
| **OWNER_Z**       | `INTEGER(32)`       | `NOT NULL DEFAULT 0`     | Owner home Z coordinate        |
| **RESOURCES**     | `VARBINARY(16)`     | `NOT NULL`               | Resource richness distribution |

**Primary Key:** `ID`  
**Constraints:** `SYS_PK_10110` PRIMARY KEY on `ID`

---

## Column Details

### TYPE{#type}
System classification that determines the primary stellar configuration and characteristics.

| Value | Name          | Description                    | Characteristics                | Rarity        |
|-------|---------------|--------------------------------|--------------------------------|---------------|
| `0`   | `SUN`         | Regular star system            | Standard stellar configuration | Common        |
| `1`   | `GIANT`       | Giant star system              | Massive stellar body           | Uncommon      |
| `2`   | `BLACK_HOLE`  | Black hole system              | Gravitational anomaly          | Rare          |
| `3`   | `DOUBLE_STAR` | Binary star system             | Dual star configuration        | Uncommon      |
| `4`   | `VOID`        | Void system                    | Empty space, no star           | Most common   |

### INFOS{#infos}
Binary data field containing additional system metadata and procedural generation parameters.

#### OWNER_UID{#owner_uid}
Unique identifier of the controlling entity, typically a homebase or system base.

| Pattern Type    | Format                               | Example                    |
|-----------------|--------------------------------------|----------------------------|
| **NPC Homebase**| `NPC-HOMEBASE_[x]_[y]_[z]`          | `NPC-HOMEBASE_0_0_0`       |
| **NPC System** | `NPC-SYSTEMBASE_[x]_[y]_[z]`        | `NPC-SYSTEMBASE_2_1_-1`    |
| **Player Base** | Custom entity UID                   | Various formats            |

#### OWNER_FACTION{#owner_faction}
Faction ID of the controlling faction.

| Value        | Meaning                      | Usage                                    |
|--------------|------------------------------|------------------------------------------|
| `0`          | No faction (neutral)         | Unclaimed systems                        |
| `-10000000`  | NPC Trading Guild            | Default NPC trader faction               |
| `-9999999`   | NPC Outcasts                 | Hostile NPC faction                      |
| `-9999998`   | NPC Scavengers               | Scavenger NPC faction                    |
| `> 0`        | Player factions              | Player-created factions                  |

#### Resource Distribution Format
The RESOURCES field contains 16 bytes representing the abundance of different materials:

| Index | Type | Resource          | Byte Value Range |
|-------|------|-------------------|------------------|
| `0`   | BYTE | Hattel Crystal    | -127 to +127     |
| `1`   | BYTE | Sintyr Crystal    | -127 to +127     |
| `2`   | BYTE | Mattise Crystal   | -127 to +127     |
| `3`   | BYTE | Rammet Crystal    | -127 to +127     |
| `4`   | BYTE | Varat Crystal     | -127 to +127     |
| `5`   | BYTE | Bastyn Crystal    | -127 to +127     |
| `6`   | BYTE | Parsen Crystal    | -127 to +127     |
| `7`   | BYTE | Nocx Crystal      | -127 to +127     |
| `8`   | BYTE | Threns Raw Ore    | -127 to +127     |
| `9`   | BYTE | Jisper Raw Ore    | -127 to +127     |
| `10`  | BYTE | Zercaner Raw Ore  | -127 to +127     |
| `11`  | BYTE | Sertise Raw Ore   | -127 to +127     |
| `12`  | BYTE | Hital Raw Ore     | -127 to +127     |
| `13`  | BYTE | Fertikeen Raw Ore | -127 to +127     |
| `14`  | BYTE | Parstun Raw Ore   | -127 to +127     |
| `15`  | BYTE | Nacht Raw Ore     | -127 to +127     |

#### Resource Generation Algorithm
The resource values are generated using a deterministic Perlin noise algorithm:

1. **Galaxy Seed**: A random number generator initialized with the galaxy seed
2. **Per-Resource Subseed**: For each resource index (0-15), generate a subseed
3. **Perlin Noise**: Configure SinglePerlin noise with frequency 0.22
4. **Sampling**: Sample noise at system coordinates (X, Y, Z)
5. **Normalization**: Convert result (-1 to +1) to byte range (-127 to +127)

---

## Example Queries

see [EXEMPLE_SYSTEMS.md](./EXEMPLE_SYSTEMS.md) for a curated list of example queries that can be run against the **SYSTEMS** table.

---

## Changelog

| Version | Date       | Author       | Description                                   |
|---------|------------|--------------|-----------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the SYSTEMS table schema |

[INDEX](./INDEX.md)