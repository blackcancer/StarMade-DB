# PLAYERS - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) 2.3.4 database. **All queries focus exclusively on the PLAYERS table.**

---

## Basic Player Queries

### Find players by name or ID
```sql
-- Search players by exact name
SELECT p.ID, p.NAME, p.STARMADE_NAME, p.FACTION, p.PERMISSION
FROM PLAYERS p
WHERE p.NAME = 'player_username'
OR p.STARMADE_NAME = 'DisplayName';
```

```sql
-- Search players by pattern matching
SELECT p.ID, p.NAME, p.STARMADE_NAME, p.FACTION
FROM PLAYERS p
WHERE p.NAME LIKE 'admin%'
OR p.STARMADE_NAME LIKE '%moderator%'
ORDER BY p.NAME;
```

```sql
-- Get player by ID
SELECT p.*
FROM PLAYERS p
WHERE p.ID = ?;
```

### List all players with faction information
```sql
SELECT p.ID, p.NAME, p.STARMADE_NAME, p.FACTION,
       CASE 
           WHEN p.FACTION = 0 THEN 'NEUTRAL'
           WHEN p.FACTION = -10000000 THEN 'NPC_TRADING_GUILD'
           WHEN p.FACTION = -9999999 THEN 'NPC_OUTCASTS'
           WHEN p.FACTION = -9999998 THEN 'NPC_SCAVENGERS'
           WHEN p.FACTION > 0 THEN 'PLAYER_FACTION_' || p.FACTION
           ELSE 'UNKNOWN'
       END as faction_type
FROM PLAYERS p
ORDER BY p.FACTION, p.NAME;
```

### Count players by faction
```sql
SELECT p.FACTION,
       CASE 
           WHEN p.FACTION = 0 THEN 'NEUTRAL'
           WHEN p.FACTION = -10000000 THEN 'NPC_TRADING_GUILD'
           WHEN p.FACTION = -9999999 THEN 'NPC_OUTCASTS'
           WHEN p.FACTION = -9999998 THEN 'NPC_SCAVENGERS'
           WHEN p.FACTION > 0 THEN 'PLAYER_FACTION'
           ELSE 'UNKNOWN'
       END as faction_type,
       COUNT(*) as player_count
FROM PLAYERS p
GROUP BY p.FACTION
ORDER BY player_count DESC;
```

---

## Permission Analysis

### Players by permission level
```sql
-- Analyze permission distribution
SELECT p.PERMISSION,
       CASE 
           WHEN p.PERMISSION = 0 THEN 'BASIC_MEMBER'
           WHEN p.PERMISSION = 1 THEN 'RECRUITER'
           WHEN p.PERMISSION = 3 THEN 'OFFICER'
           WHEN p.PERMISSION = 7 THEN 'ADMINISTRATOR'
           WHEN p.PERMISSION = 255 THEN 'FACTION_LEADER'
           WHEN p.PERMISSION = 2147483647 THEN 'ADMIN_PERMISSIONS'
           ELSE 'CUSTOM_PERMISSIONS'
       END as permission_level,
       COUNT(*) as player_count
FROM PLAYERS p
GROUP BY p.PERMISSION
ORDER BY p.PERMISSION;
```

### Players with specific permissions
```sql
-- Players who can invite members (bit 0)
SELECT p.NAME, p.STARMADE_NAME, p.FACTION, p.PERMISSION
FROM PLAYERS p
WHERE MOD(p.PERMISSION, 2) = 1
ORDER BY p.FACTION, p.NAME;
```

```sql
-- Players who can kick members (bit 1)
SELECT p.NAME, p.STARMADE_NAME, p.FACTION, p.PERMISSION
FROM PLAYERS p
WHERE MOD(p.PERMISSION / 2, 2) = 1
ORDER BY p.FACTION, p.NAME;
```

```sql
-- Players with administrative permissions
SELECT p.NAME, p.STARMADE_NAME, p.FACTION, p.PERMISSION,
       CASE 
           WHEN MOD(p.PERMISSION, 2) = 1 THEN 'Y' ELSE 'N' 
       END as can_invite,
       CASE 
           WHEN MOD(p.PERMISSION / 2, 2) = 1 THEN 'Y' ELSE 'N' 
       END as can_kick,
       CASE 
           WHEN MOD(p.PERMISSION / 4, 2) = 1 THEN 'Y' ELSE 'N' 
       END as can_edit_permissions,
       CASE 
           WHEN MOD(p.PERMISSION / 16, 2) = 1 THEN 'Y' ELSE 'N' 
       END as can_manage_relationships
FROM PLAYERS p
WHERE p.PERMISSION > 0
ORDER BY p.PERMISSION DESC, p.NAME;
```

### Permission bit analysis
```sql
-- Detailed permission breakdown
WITH permission_analysis AS (
    SELECT p.ID, p.NAME, p.STARMADE_NAME, p.FACTION, p.PERMISSION,
           MOD(p.PERMISSION, 2) as bit_0_invite,
           MOD(p.PERMISSION / 2, 2) as bit_1_kick,
           MOD(p.PERMISSION / 4, 2) as bit_2_edit_perms,
           MOD(p.PERMISSION / 8, 2) as bit_3_reserved,
           MOD(p.PERMISSION / 16, 2) as bit_4_relations,
           MOD(p.PERMISSION / 32, 2) as bit_5_reserved,
           MOD(p.PERMISSION / 64, 2) as bit_6_reserved,
           MOD(p.PERMISSION / 128, 2) as bit_7_leader
    FROM PLAYERS p
    WHERE p.PERMISSION > 0
)
SELECT pa.NAME, pa.STARMADE_NAME, pa.FACTION, pa.PERMISSION,
       pa.bit_0_invite || pa.bit_1_kick || pa.bit_2_edit_perms || pa.bit_3_reserved ||
       pa.bit_4_relations || pa.bit_5_reserved || pa.bit_6_reserved || pa.bit_7_leader as permission_bits
FROM permission_analysis pa
ORDER BY pa.PERMISSION DESC, pa.NAME;
```

---

## Faction Management

### Faction member counts and hierarchy
```sql
-- Faction sizes and leadership structure
SELECT p.FACTION,
       COUNT(*) as total_members,
       COUNT(CASE WHEN p.PERMISSION = 0 THEN 1 END) as basic_members,
       COUNT(CASE WHEN p.PERMISSION > 0 AND p.PERMISSION < 255 THEN 1 END) as officers,
       COUNT(CASE WHEN p.PERMISSION = 255 THEN 1 END) as leaders,
       MAX(CASE WHEN p.PERMISSION = 255 THEN p.STARMADE_NAME END) as faction_leader
FROM PLAYERS p
WHERE p.FACTION != 0
GROUP BY p.FACTION
HAVING COUNT(*) > 1
ORDER BY total_members DESC;
```

### Find players without factions
```sql
SELECT p.ID, p.NAME, p.STARMADE_NAME, p.PERMISSION
FROM PLAYERS p
WHERE p.FACTION = 0
ORDER BY p.NAME;
```

### Faction permission distribution
```sql
-- Permission levels within each faction
SELECT 
    f.FACTION,
    f.permission_level,
    COUNT(*) as player_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY f.FACTION), 2) as percentage_in_faction
FROM (
    SELECT p.FACTION,
           CASE 
               WHEN p.PERMISSION = 0 THEN '0_BASIC_MEMBER'
               WHEN p.PERMISSION = 1 THEN '1_RECRUITER'
               WHEN p.PERMISSION = 3 THEN '3_OFFICER'
               WHEN p.PERMISSION = 7 THEN '7_ADMINISTRATOR'
               WHEN p.PERMISSION = 255 THEN '255_FACTION_LEADER'
               ELSE 'CUSTOM_' || p.PERMISSION
           END as permission_level
    FROM PLAYERS p
    WHERE p.FACTION != 0
) f
GROUP BY f.FACTION, f.permission_level
ORDER BY f.FACTION, f.permission_level;
```

---

## Advanced Analytics

### Player statistics summary
```sql
-- Overall player database statistics
SELECT 
    COUNT(*) as total_players,
    COUNT(DISTINCT FACTION) as unique_factions,
    COUNT(CASE WHEN FACTION = 0 THEN 1 END) as neutral_players,
    COUNT(CASE WHEN FACTION > 0 THEN 1 END) as faction_players,
    COUNT(CASE WHEN FACTION < 0 THEN 1 END) as NPC_faction_players,
    COUNT(CASE WHEN PERMISSION = 0 THEN 1 END) as basic_members,
    COUNT(CASE WHEN PERMISSION > 0 THEN 1 END) as privileged_players,
    AVG(CAST(PERMISSION AS DOUBLE)) as avg_permission_level,
    MAX(PERMISSION) as max_permission_level
FROM PLAYERS;
```

```sql
-- Faction leadership report
SELECT 
    p.FACTION,
    COUNT(*) as total_members,
    GROUP_CONCAT(
        CASE WHEN p.PERMISSION >= 255 THEN p.STARMADE_NAME END 
        SEPARATOR ', '
    ) as leaders,
    GROUP_CONCAT(
        CASE WHEN p.PERMISSION >= 7 AND p.PERMISSION < 255 THEN p.STARMADE_NAME END 
        SEPARATOR ', '
    ) as officers
FROM PLAYERS p
WHERE p.FACTION > 0
GROUP BY p.FACTION
HAVING COUNT(*) > 1
ORDER BY total_members DESC;
```

### Player activity indicators
```sql
-- Identify potentially inactive accounts (players with minimal setup)
SELECT p.NAME, p.STARMADE_NAME, p.FACTION, p.PERMISSION,
       CASE 
           WHEN p.FACTION = 0 AND p.PERMISSION = 0 THEN 'MINIMAL_SETUP'
           WHEN p.NAME = p.STARMADE_NAME AND p.FACTION = 0 THEN 'DEFAULT_SETUP'
           WHEN p.PERMISSION > 0 AND p.FACTION = 0 THEN 'NEUTRAL_WITH_PERMS'
           ELSE 'ACTIVE_SETUP'
       END as activity_indicator
FROM PLAYERS p
ORDER BY 
    CASE 
        WHEN p.FACTION = 0 AND p.PERMISSION = 0 THEN 1
        WHEN p.NAME = p.STARMADE_NAME AND p.FACTION = 0 THEN 2
        ELSE 3
    END, p.NAME;
```

---

## Search and Filtering

### Find players by name pattern with faction info
```sql
-- Search with comprehensive player information
SELECT p.ID, p.NAME, p.STARMADE_NAME, p.FACTION, p.PERMISSION,
       CASE 
           WHEN p.FACTION = 0 THEN 'NEUTRAL'
           WHEN p.FACTION = -10000000 THEN 'NPC_TRADING_GUILD'
           WHEN p.FACTION = -9999999 THEN 'NPC_OUTCASTS'
           WHEN p.FACTION = -9999998 THEN 'NPC_SCAVENGERS'
           WHEN p.FACTION > 0 THEN 'PLAYER_FACTION'
           ELSE 'UNKNOWN_FACTION'
       END as faction_type,
       CASE 
           WHEN p.PERMISSION = 0 THEN 'BASIC'
           WHEN p.PERMISSION = 255 THEN 'LEADER'
           WHEN p.PERMISSION > 0 THEN 'OFFICER'
           ELSE 'UNKNOWN'
       END as role
FROM PLAYERS p
WHERE LOWER(p.NAME) LIKE LOWER(?)
   OR LOWER(p.STARMADE_NAME) LIKE LOWER(?)
ORDER BY p.NAME;
```

### List faction leaders and officers
```sql
-- All players with elevated permissions
SELECT p.NAME, p.STARMADE_NAME, p.FACTION, p.PERMISSION,
       CASE 
           WHEN p.PERMISSION = 255 THEN 'FACTION_LEADER'
           WHEN p.PERMISSION >= 7 THEN 'ADMINISTRATOR'
           WHEN p.PERMISSION >= 3 THEN 'OFFICER'
           WHEN p.PERMISSION >= 1 THEN 'RECRUITER'
           ELSE 'MEMBER'
       END as role,
       CASE 
           WHEN p.FACTION = 0 THEN 'NEUTRAL'
           WHEN p.FACTION < 0 THEN 'NPC_FACTION'
           ELSE 'PLAYER_FACTION_' || p.FACTION
       END as faction_type
FROM PLAYERS p
WHERE p.PERMISSION > 0
ORDER BY p.FACTION, p.PERMISSION DESC, p.NAME;
```

---

## Data Validation and Integrity

### Check for data anomalies
```sql
-- Identify potential data issues
SELECT 
    'DUPLICATE_NAMES' as issue_type,
    p1.NAME as player_name,
    COUNT(*) as occurrences
FROM PLAYERS p1
GROUP BY p1.NAME
HAVING COUNT(*) > 1

UNION ALL

SELECT 
    'INVALID_PERMISSIONS' as issue_type,
    p.NAME as player_name,
    p.PERMISSION as occurrences
FROM PLAYERS p
WHERE p.PERMISSION < 0 OR p.PERMISSION > 2147483647

UNION ALL

SELECT 
    'MISSING_DISPLAY_NAME' as issue_type,
    p.NAME as player_name,
    0 as occurrences
FROM PLAYERS p
WHERE p.STARMADE_NAME IS NULL OR TRIM(p.STARMADE_NAME) = '';
```

---

## Changelog

| Version | Date       | Author       | Description                                      |
|---------|------------|--------------|--------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of PLAYERS example queries     |
| `1.1`   | 2025-01-09 | Assistant    | Updated for HSQLDB 2.3.4 compatibility         |

[INDEX](./INDEX.md) | [PLAYERS](./TABLE_PLAYERS.md)