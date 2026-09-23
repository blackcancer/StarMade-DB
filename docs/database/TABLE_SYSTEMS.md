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

The database stores the central sector's ordinal, not a separate sequence from zero:

| Value | Name |
| --- | --- |
| `4` | `SUN` |
| `8` | `GIANT` |
| `5` | `BLACK_HOLE` |
| `9` | `DOUBLE_STAR` |
| `6` | `VOID` |

### INFOS{#infos}
An 8192-byte grid of 4096 sector records. Each record contains a sector ordinal and one metadata byte. Index: `(z * 256 + y * 16 + x) * 2`. Current VOID is 6. PLANET metadata uses `MARS=0`, `EARTH=1`, `DESERT=2`, `PURPLE=3`, `ICE=4`; values beyond the last entry are clamped as in the game. Explicit `legacy-sdk` decoding retains the historical SDK interpretation.

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
| `0`   | BYTE | Hattel Crystal    | 0 to 255 (SDK)     |
| `1`   | BYTE | Sintyr Crystal    | 0 to 255 (SDK)     |
| `2`   | BYTE | Mattise Crystal   | 0 to 255 (SDK)     |
| `3`   | BYTE | Rammet Crystal    | 0 to 255 (SDK)     |
| `4`   | BYTE | Varat Crystal     | 0 to 255 (SDK)     |
| `5`   | BYTE | Bastyn Crystal    | 0 to 255 (SDK)     |
| `6`   | BYTE | Parsen Crystal    | 0 to 255 (SDK)     |
| `7`   | BYTE | Nocx Crystal      | 0 to 255 (SDK)     |
| `8`   | BYTE | Threns Raw Ore    | 0 to 255 (SDK)     |
| `9`   | BYTE | Jisper Raw Ore    | 0 to 255 (SDK)     |
| `10`  | BYTE | Zercaner Raw Ore  | 0 to 255 (SDK)     |
| `11`  | BYTE | Sertise Raw Ore   | 0 to 255 (SDK)     |
| `12`  | BYTE | Hital Raw Ore     | 0 to 255 (SDK)     |
| `13`  | BYTE | Fertikeen Raw Ore | 0 to 255 (SDK)     |
| `14`  | BYTE | Parstun Raw Ore   | 0 to 255 (SDK)     |
| `15`  | BYTE | Nacht Raw Ore     | 0 to 255 (SDK)     |

#### Resource Generation Algorithm
The resource values are generated using a deterministic Perlin noise algorithm:

1. **Galaxy Seed**: A random number generator initialized with the galaxy seed
2. **Per-Resource Subseed**: For each resource index (0-15), generate a subseed
3. **Perlin Noise**: Configure SinglePerlin noise with frequency 0.22
4. **Sampling**: Sample noise at system coordinates (X, Y, Z)
5. **Normalization**: Convert result (-1 to +1) to byte range (0 to 255 (SDK))

---

## Example Queries

see [EXEMPLE_SYSTEMS.md](./EXEMPLE_SYSTEMS.md) for a curated list of example queries that can be run against the **SYSTEMS** table.

---

## Changelog

| Version | Date       | Author       | Description                                   |
|---------|------------|--------------|-----------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of the SYSTEMS table schema |

[INDEX](./INDEX.md)