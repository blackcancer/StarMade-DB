# MINES - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) 2.3.4 database. **All queries focus exclusively on the MINES table.**

---

## Basic Mine Queries

### Find mines by owner or location
```sql
-- Search mines by owner ID
SELECT m.ID, m.OWNER, m.FACTION, m.SECTOR_X, m.SECTOR_Y, m.SECTOR_Z,
       m.HP, m.AMMO, m.ARMED, m.CREATION_DATE
FROM MINES m
WHERE m.OWNER = ?
ORDER BY m.CREATION_DATE DESC;
```

```sql
-- Find all mines in a specific sector
SELECT m.ID, m.OWNER, m.FACTION, m.HP, m.AMMO, m.ARMED,
       m.ARMED_IN_SECS, m.CREATION_DATE
FROM MINES m
WHERE m.SECTOR_X = ? AND m.SECTOR_Y = ? AND m.SECTOR_Z = ?
ORDER BY m.ARMED DESC, m.HP DESC;
```

```sql
-- Search mines within coordinate range
SELECT m.ID, m.OWNER, m.FACTION, m.SECTOR_X, m.SECTOR_Y, m.SECTOR_Z,
       m.HP, m.AMMO, m.ARMED, m.CREATION_DATE
FROM MINES m
WHERE m.SECTOR_X BETWEEN ? AND ?
  AND m.SECTOR_Y BETWEEN ? AND ?
  AND m.SECTOR_Z BETWEEN ? AND ?
ORDER BY m.SECTOR_X, m.SECTOR_Y, m.SECTOR_Z;
```

### Mine status analysis
```sql
-- Count mines by status
SELECT 
    CASE 
        WHEN m.HP <= 0 THEN 'DESTROYED'
        WHEN m.AMMO = 0 AND m.AMMO != -2 THEN 'DEPLETED'
        WHEN m.ARMED = TRUE THEN 'ARMED_ACTIVE'
        WHEN m.ARMED_IN_SECS > 0 THEN 'ARMING'
        WHEN m.ARMED_IN_SECS = -1 THEN 'DISARMED'
        ELSE 'UNKNOWN'
    END as mine_status,
    COUNT(*) as mine_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM MINES), 2) as percentage
FROM MINES m
GROUP BY 
    CASE 
        WHEN m.HP <= 0 THEN 'DESTROYED'
        WHEN m.AMMO = 0 AND m.AMMO != -2 THEN 'DEPLETED'
        WHEN m.ARMED = TRUE THEN 'ARMED_ACTIVE'
        WHEN m.ARMED_IN_SECS > 0 THEN 'ARMING'
        WHEN m.ARMED_IN_SECS = -1 THEN 'DISARMED'
        ELSE 'UNKNOWN'
    END
ORDER BY mine_count DESC;
```

---

## Faction Mine Analysis

### Mines by faction
```sql
-- Faction mine deployment statistics
SELECT m.FACTION,
       CASE 
           WHEN m.FACTION = 0 THEN 'NEUTRAL'
           WHEN m.FACTION = -10000000 THEN 'TRADING_GUILD'
           WHEN m.FACTION = -9999999 THEN 'OUTCASTS'
           WHEN m.FACTION = -9999998 THEN 'SCAVENGERS'
           WHEN m.FACTION > 0 THEN 'PLAYER_FACTION'
           ELSE 'UNKNOWN'
       END as faction_type,
       COUNT(*) as total_mines,
       COUNT(CASE WHEN m.ARMED = TRUE THEN 1 END) as armed_mines,
       COUNT(CASE WHEN m.HP > 0 THEN 1 END) as active_mines,
       COUNT(CASE WHEN m.AMMO = -2 THEN 1 END) as unlimited_ammo_mines,
       AVG(m.HP) as avg_durability
FROM MINES m
GROUP BY m.FACTION
ORDER BY total_mines DESC;
```

### Top mine deployers
```sql
-- Players with most mine deployments
SELECT m.OWNER, m.FACTION,
       COUNT(*) as total_mines_deployed,
       COUNT(CASE WHEN m.ARMED = TRUE THEN 1 END) as armed_mines,
       COUNT(CASE WHEN m.HP <= 0 THEN 1 END) as destroyed_mines,
       COUNT(CASE WHEN m.AMMO = 0 AND m.AMMO != -2 THEN 1 END) as depleted_mines,
       MIN(m.CREATION_DATE) as first_mine_deployed,
       MAX(m.CREATION_DATE) as last_mine_deployed,
       COUNT(DISTINCT m.SECTOR_X || ',' || m.SECTOR_Y || ',' || m.SECTOR_Z) as sectors_mined
FROM MINES m
GROUP BY m.OWNER, m.FACTION
HAVING COUNT(*) > 5
ORDER BY total_mines_deployed DESC
LIMIT 20;
```

---

## Spatial Mine Distribution

### Mine field density analysis
```sql
-- Analyze mine concentration in different regions
WITH mine_regions AS (
    SELECT 
        FLOOR(m.SECTOR_X / 10.0) * 10 as region_x,
        FLOOR(m.SECTOR_Y / 10.0) * 10 as region_y,
        FLOOR(m.SECTOR_Z / 10.0) * 10 as region_z,
        COUNT(*) as mine_count,
        COUNT(CASE WHEN m.ARMED = TRUE THEN 1 END) as armed_count,
        COUNT(DISTINCT m.OWNER) as unique_owners,
        COUNT(DISTINCT m.FACTION) as faction_diversity,
        AVG(m.HP) as avg_hp
    FROM MINES m
    WHERE m.HP > 0  -- Only active mines
    GROUP BY FLOOR(m.SECTOR_X / 10.0), FLOOR(m.SECTOR_Y / 10.0), FLOOR(m.SECTOR_Z / 10.0)
)
SELECT 
    mr.region_x || ' to ' || (mr.region_x + 9) as x_range,
    mr.region_y || ' to ' || (mr.region_y + 9) as y_range,
    mr.region_z || ' to ' || (mr.region_z + 9) as z_range,
    mr.mine_count,
    mr.armed_count,
    mr.unique_owners,
    mr.faction_diversity,
    ROUND(mr.avg_hp, 2) as avg_durability,
    CASE 
        WHEN mr.mine_count >= 100 THEN 'HEAVILY_MINED'
        WHEN mr.mine_count >= 50 THEN 'DENSELY_MINED'
        WHEN mr.mine_count >= 20 THEN 'MODERATELY_MINED'
        WHEN mr.mine_count >= 5 THEN 'LIGHTLY_MINED'
        ELSE 'SPARSE_MINES'
    END as mine_density
FROM mine_regions mr
ORDER BY mr.mine_count DESC
LIMIT 20;
```

### Strategic mine placement analysis
```sql
-- Find mine clusters and defensive perimeters
WITH mine_positions AS (
    SELECT 
        m.ID, m.OWNER, m.FACTION,
        m.SECTOR_X, m.SECTOR_Y, m.SECTOR_Z,
        m.ARMED, m.HP, m.AMMO
    FROM MINES m
    WHERE m.HP > 0 AND m.ARMED = TRUE
),
mine_clusters AS (
    SELECT 
        mp1.SECTOR_X, mp1.SECTOR_Y, mp1.SECTOR_Z,
        mp1.FACTION,
        COUNT(DISTINCT mp2.ID) as nearby_mines
    FROM mine_positions mp1
    JOIN mine_positions mp2 ON 
        ABS(mp2.SECTOR_X - mp1.SECTOR_X) <= 2 AND
        ABS(mp2.SECTOR_Y - mp1.SECTOR_Y) <= 2 AND
        ABS(mp2.SECTOR_Z - mp1.SECTOR_Z) <= 2
    GROUP BY mp1.SECTOR_X, mp1.SECTOR_Y, mp1.SECTOR_Z, mp1.FACTION
    HAVING COUNT(DISTINCT mp2.ID) >= 3
)
SELECT 
    mc.SECTOR_X, mc.SECTOR_Y, mc.SECTOR_Z,
    mc.FACTION,
    mc.nearby_mines,
    CASE 
        WHEN mc.nearby_mines >= 20 THEN 'FORTRESS_MINEFIELD'
        WHEN mc.nearby_mines >= 10 THEN 'DEFENSIVE_PERIMETER'
        WHEN mc.nearby_mines >= 5 THEN 'MINE_CLUSTER'
        ELSE 'MINE_GROUP'
    END as formation_type,
    SQRT(POWER(mc.SECTOR_X, 2) + POWER(mc.SECTOR_Y, 2) + POWER(mc.SECTOR_Z, 2)) as distance_from_origin
FROM mine_clusters mc
ORDER BY mc.nearby_mines DESC
LIMIT 50;
```

---

## Temporal Analysis

### Mine deployment timeline
```sql
-- Analyze mine deployment patterns over time
WITH deployment_periods AS (
    SELECT 
        m.ID, m.OWNER, m.FACTION, m.CREATION_DATE,
        CASE 
            WHEN m.CREATION_DATE > (UNIX_TIMESTAMP() - 3600) * 1000 THEN 'LAST_HOUR'
            WHEN m.CREATION_DATE > (UNIX_TIMESTAMP() - 86400) * 1000 THEN 'LAST_DAY'
            WHEN m.CREATION_DATE > (UNIX_TIMESTAMP() - 604800) * 1000 THEN 'LAST_WEEK'
            WHEN m.CREATION_DATE > (UNIX_TIMESTAMP() - 2592000) * 1000 THEN 'LAST_MONTH'
            ELSE 'OLDER'
        END as deployment_period
    FROM MINES m
)
SELECT 
    dp.deployment_period,
    COUNT(*) as mines_deployed,
    COUNT(DISTINCT dp.OWNER) as unique_deployers,
    COUNT(DISTINCT dp.FACTION) as active_factions,
    COUNT(CASE WHEN m.ARMED = TRUE THEN 1 END) as currently_armed,
    COUNT(CASE WHEN m.HP <= 0 THEN 1 END) as already_destroyed
FROM deployment_periods dp
JOIN MINES m ON dp.ID = m.ID
GROUP BY dp.deployment_period
ORDER BY 
    CASE dp.deployment_period
        WHEN 'LAST_HOUR' THEN 1
        WHEN 'LAST_DAY' THEN 2
        WHEN 'LAST_WEEK' THEN 3
        WHEN 'LAST_MONTH' THEN 4
        ELSE 5
    END;
```

### Mine lifespan analysis
```sql
-- Analyze mine durability and depletion rates
SELECT 
    m.FACTION,
    COUNT(*) as total_mines,
    COUNT(CASE WHEN m.HP = 100 THEN 1 END) as full_health_mines,
    COUNT(CASE WHEN m.HP BETWEEN 50 AND 99 THEN 1 END) as damaged_mines,
    COUNT(CASE WHEN m.HP BETWEEN 1 AND 49 THEN 1 END) as critical_mines,
    COUNT(CASE WHEN m.HP <= 0 THEN 1 END) as destroyed_mines,
    AVG(CASE WHEN m.HP > 0 THEN m.HP END) as avg_hp_active_mines,
    COUNT(CASE WHEN m.AMMO = -2 THEN 1 END) as unlimited_ammo,
    COUNT(CASE WHEN m.AMMO > 0 THEN 1 END) as limited_ammo,
    COUNT(CASE WHEN m.AMMO = 0 THEN 1 END) as depleted_ammo
FROM MINES m
GROUP BY m.FACTION
HAVING COUNT(*) > 10
ORDER BY total_mines DESC;
```

---

## Combat Effectiveness Analysis

### Mine activation patterns
```sql
-- Analyze arming delays and activation strategies
WITH arming_analysis AS (
    SELECT 
        m.ID, m.OWNER, m.FACTION,
        m.ARMED, m.ARMED_IN_SECS,
        CASE 
            WHEN m.ARMED = TRUE THEN 'ARMED'
            WHEN m.ARMED_IN_SECS > 0 THEN 'ARMING'
            WHEN m.ARMED_IN_SECS = 0 THEN 'INSTANT_ARM'
            WHEN m.ARMED_IN_SECS = -1 THEN 'MANUAL_ARM'
            ELSE 'UNKNOWN'
        END as arming_status,
        CASE 
            WHEN m.ARMED_IN_SECS BETWEEN 1 AND 30 THEN 'QUICK_ARM'
            WHEN m.ARMED_IN_SECS BETWEEN 31 AND 300 THEN 'DELAYED_ARM'
            WHEN m.ARMED_IN_SECS > 300 THEN 'LONG_DELAY'
            ELSE 'OTHER'
        END as arming_strategy
    FROM MINES m
    WHERE m.HP > 0  -- Only active mines
)
SELECT 
    aa.arming_status,
    aa.arming_strategy,
    COUNT(*) as mine_count,
    COUNT(DISTINCT aa.OWNER) as unique_owners,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM MINES WHERE HP > 0), 2) as percentage
FROM arming_analysis aa
GROUP BY aa.arming_status, aa.arming_strategy
ORDER BY mine_count DESC;
```

### Faction mine warfare statistics
```sql
-- Compare faction mine deployment strategies
WITH faction_mine_stats AS (
    SELECT 
        m.FACTION,
        COUNT(*) as total_mines,
        COUNT(CASE WHEN m.ARMED = TRUE THEN 1 END) as armed_mines,
        COUNT(CASE WHEN m.AMMO = -2 THEN 1 END) as persistent_mines,
        COUNT(CASE WHEN m.ARMED_IN_SECS = 0 THEN 1 END) as instant_mines,
        COUNT(CASE WHEN m.ARMED_IN_SECS > 0 THEN 1 END) as delayed_mines,
        AVG(CASE WHEN m.ARMED_IN_SECS > 0 THEN m.ARMED_IN_SECS END) as avg_arming_delay,
        COUNT(DISTINCT m.SECTOR_X || ',' || m.SECTOR_Y || ',' || m.SECTOR_Z) as sectors_controlled
    FROM MINES m
    WHERE m.HP > 0
    GROUP BY m.FACTION
)
SELECT 
    fms.FACTION,
    CASE 
        WHEN fms.FACTION = 0 THEN 'NEUTRAL'
        WHEN fms.FACTION = -10000000 THEN 'TRADING_GUILD'
        WHEN fms.FACTION = -9999999 THEN 'OUTCASTS'
        WHEN fms.FACTION = -9999998 THEN 'SCAVENGERS'
        WHEN fms.FACTION > 0 THEN 'PLAYER_FACTION_' || fms.FACTION
        ELSE 'UNKNOWN'
    END as faction_name,
    fms.total_mines,
    fms.armed_mines,
    ROUND(fms.armed_mines * 100.0 / NULLIF(fms.total_mines, 0), 2) as armed_percentage,
    fms.persistent_mines,
    fms.instant_mines,
    fms.delayed_mines,
    ROUND(fms.avg_arming_delay, 2) as avg_arming_delay_secs,
    fms.sectors_controlled,
    CASE 
        WHEN fms.persistent_mines > fms.total_mines * 0.5 THEN 'PERSISTENT_DEFENSE'
        WHEN fms.instant_mines > fms.total_mines * 0.5 THEN 'RAPID_RESPONSE'
        WHEN fms.delayed_mines > fms.total_mines * 0.5 THEN 'TRAP_WARFARE'
        ELSE 'MIXED_STRATEGY'
    END as mine_doctrine
FROM faction_mine_stats fms
WHERE fms.total_mines > 0
ORDER BY fms.total_mines DESC;
```

---

## Data Validation and Maintenance

### Mine data integrity checks
```sql
-- Comprehensive data validation
WITH validation_checks AS (
    -- Check 1: Invalid HP values
    SELECT 'INVALID_HP' as check_type, COUNT(*) as issues
    FROM MINES m
    WHERE m.HP < 0 OR m.HP > 100
    
    UNION ALL
    
    -- Check 2: Invalid AMMO values
    SELECT 'INVALID_AMMO' as check_type, COUNT(*) as issues
    FROM MINES m
    WHERE m.AMMO < -2 OR (m.AMMO = -1)  -- -1 should not exist, only -2 for unlimited
    
    UNION ALL
    
    -- Check 3: Invalid ARMED_IN_SECS values
    SELECT 'INVALID_ARMING_TIME' as check_type, COUNT(*) as issues
    FROM MINES m
    WHERE m.ARMED_IN_SECS < -1  -- Should be >= -1
    
    UNION ALL
    
    -- Check 4: Logical inconsistencies
    SELECT 'ARMED_BUT_ARMING' as check_type, COUNT(*) as issues
    FROM MINES m
    WHERE m.ARMED = TRUE AND m.ARMED_IN_SECS > 0
    
    UNION ALL
    
    -- Check 5: Future creation dates
    SELECT 'FUTURE_CREATION' as check_type, COUNT(*) as issues
    FROM MINES m
    WHERE m.CREATION_DATE > UNIX_TIMESTAMP() * 1000
    
    UNION ALL
    
    -- Check 6: Extreme coordinates
    SELECT 'EXTREME_COORDINATES' as check_type, COUNT(*) as issues
    FROM MINES m
    WHERE ABS(m.SECTOR_X) > 1000000 OR ABS(m.SECTOR_Y) > 1000000 OR ABS(m.SECTOR_Z) > 1000000
)
SELECT 
    vc.check_type,
    vc.issues,
    CASE 
        WHEN vc.issues = 0 THEN 'PASS'
        WHEN vc.issues < 10 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status
FROM validation_checks vc
ORDER BY vc.issues DESC;
```

```sql
-- Storage and performance analysis
SELECT 
    'MINE_STORAGE_ANALYSIS' as metric_type,
    COUNT(*) as total_mines,
    COUNT(DISTINCT OWNER) as unique_owners,
    COUNT(DISTINCT FACTION) as active_factions,
    COUNT(CASE WHEN ARMED = TRUE THEN 1 END) as armed_mines,
    COUNT(CASE WHEN AMMO > 0 OR AMMO = -2 THEN 1 END) as functional_mines,
    COUNT(DISTINCT CONCAT(SECTOR_X, ',', SECTOR_Y, ',', SECTOR_Z)) as sectors_with_mines,
    AVG(HP) as avg_durability,
    MIN(CREATION_DATE) as earliest_mine,
    MAX(CREATION_DATE) as latest_mine
FROM MINES;
```

### Maintenance operations and cleanup
```sql
-- Identify cleanup candidates
-- Note: These are analysis queries; actual cleanup requires careful consideration

-- Find destroyed or depleted mines
SELECT m.ID, m.OWNER, m.FACTION, m.SECTOR_X, m.SECTOR_Y, m.SECTOR_Z,
       m.HP, m.AMMO, m.ARMED, m.CREATION_DATE,
       'DESTROYED_OR_DEPLETED' as cleanup_reason
FROM MINES m
WHERE m.HP <= 0 OR (m.AMMO = 0 AND m.AMMO != -2)
ORDER BY m.CREATION_DATE;
```

```sql
-- Find very old inactive mines
SELECT m.ID, m.OWNER, m.FACTION, m.SECTOR_X, m.SECTOR_Y, m.SECTOR_Z,
       m.ARMED, m.AMMO, m.CREATION_DATE,
       UNIX_TIMESTAMP() * 1000 - m.CREATION_DATE as age_milliseconds,
       'OLD_INACTIVE_MINE' as cleanup_reason
FROM MINES m
WHERE m.ARMED = FALSE 
  AND m.ARMED_IN_SECS = -1  -- Not set to arm
  AND UNIX_TIMESTAMP() * 1000 - m.CREATION_DATE > 2592000000  -- Older than 30 days
ORDER BY m.CREATION_DATE;
```

```sql
-- Find mines with broken owner references
SELECT m.ID, m.OWNER, m.FACTION, m.SECTOR_X, m.SECTOR_Y, m.SECTOR_Z,
       m.CREATION_DATE,
       'ORPHANED_OWNER' as cleanup_reason
FROM MINES m
WHERE NOT EXISTS (SELECT 1 FROM PLAYERS p WHERE p.ID = m.OWNER)
ORDER BY m.CREATION_DATE;
```

```sql
-- Performance summary after maintenance
SELECT 
    'MINE_MAINTENANCE_SUMMARY' as operation,
    COUNT(*) as total_mines,
    COUNT(DISTINCT OWNER) as active_owners,
    COUNT(DISTINCT FACTION) as active_factions,
    COUNT(CASE WHEN ARMED = TRUE THEN 1 END) as armed_mines,
    COUNT(CASE WHEN AMMO > 0 OR AMMO = -2 THEN 1 END) as functional_mines,
    COUNT(CASE WHEN HP > 0 THEN 1 END) as active_mines,
    COUNT(CASE WHEN HP <= 0 THEN 1 END) as destroyed_mines,
    COUNT(CASE WHEN CREATION_DATE < (UNIX_TIMESTAMP() - 2592000) * 1000 THEN 1 END) as old_mines
FROM MINES;
```

---

## Changelog

| Version | Date       | Author       | Description                                    |
|---------|------------|--------------|------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of MINES example queries      |

[INDEX](./INDEX.md) | [MINES](./TABLE_MINES.md)