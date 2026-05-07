# VISIBILITY - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) 2.3.4 database. **All queries focus exclusively on the VISIBILITY table.**

---

## Basic Visibility Queries

### Find observations by observer and location
```sql
-- Search visibility records by observer ID
SELECT v.ID, v.X, v.Y, v.Z, v.TIMESTAMP
FROM VISIBILITY v
WHERE v.ID = ?
ORDER BY v.TIMESTAMP DESC;
```

```sql
-- Find all observers of a specific sector
SELECT v.ID, v.TIMESTAMP,
       CASE 
           WHEN v.ID > 0 THEN 'PLAYER_' || v.ID
           WHEN v.ID = -10000000 THEN 'TRADING_GUILD'
           WHEN v.ID = -9999999 THEN 'OUTCASTS'
           WHEN v.ID = -9999998 THEN 'SCAVENGERS'
           ELSE 'FACTION_' || v.ID
       END as observer_type
FROM VISIBILITY v
WHERE v.X = ? AND v.Y = ? AND v.Z = ?
ORDER BY v.TIMESTAMP DESC;
```

```sql
-- Recent observations within coordinate range
SELECT v.ID, v.X, v.Y, v.Z, v.TIMESTAMP
FROM VISIBILITY v
WHERE v.X BETWEEN ? AND ?
  AND v.Y BETWEEN ? AND ?
  AND v.Z BETWEEN ? AND ?
  AND v.TIMESTAMP > (UNIX_TIMESTAMP() - 86400) * 1000  -- Last 24 hours
ORDER BY v.TIMESTAMP DESC;
```

### Observer activity summary
```sql
-- Count observations by observer type
SELECT 
    CASE 
        WHEN v.ID > 0 THEN 'PLAYER'
        WHEN v.ID = -10000000 THEN 'TRADING_GUILD'
        WHEN v.ID = -9999999 THEN 'OUTCASTS'
        WHEN v.ID = -9999998 THEN 'SCAVENGERS'
        WHEN v.ID = 0 THEN 'SYSTEM'
        ELSE 'OTHER_FACTION'
    END as observer_type,
    COUNT(*) as observation_count,
    COUNT(DISTINCT CONCAT(v.X, ',', v.Y, ',', v.Z)) as unique_sectors_observed,
    MIN(v.TIMESTAMP) as first_observation,
    MAX(v.TIMESTAMP) as last_observation
FROM VISIBILITY v
GROUP BY 
    CASE 
        WHEN v.ID > 0 THEN 'PLAYER'
        WHEN v.ID = -10000000 THEN 'TRADING_GUILD'
        WHEN v.ID = -9999999 THEN 'OUTCASTS'
        WHEN v.ID = -9999998 THEN 'SCAVENGERS'
        WHEN v.ID = 0 THEN 'SYSTEM'
        ELSE 'OTHER_FACTION'
    END
ORDER BY observation_count DESC;
```

---

## Spatial Coverage Analysis

### Map coverage by region
```sql
-- Analyze visibility coverage in different regions
WITH region_coverage AS (
    SELECT 
        FLOOR(v.X / 10.0) * 10 as region_x,
        FLOOR(v.Y / 10.0) * 10 as region_y,
        FLOOR(v.Z / 10.0) * 10 as region_z,
        COUNT(*) as observation_count,
        COUNT(DISTINCT v.ID) as unique_observers,
        COUNT(DISTINCT CONCAT(v.X, ',', v.Y, ',', v.Z)) as sectors_observed,
        MIN(v.TIMESTAMP) as first_observed,
        MAX(v.TIMESTAMP) as last_observed
    FROM VISIBILITY v
    GROUP BY FLOOR(v.X / 10.0), FLOOR(v.Y / 10.0), FLOOR(v.Z / 10.0)
)
SELECT 
    rc.region_x || ' to ' || (rc.region_x + 9) as x_range,
    rc.region_y || ' to ' || (rc.region_y + 9) as y_range,
    rc.region_z || ' to ' || (rc.region_z + 9) as z_range,
    rc.observation_count,
    rc.unique_observers,
    rc.sectors_observed,
    CASE 
        WHEN rc.observation_count >= 100 THEN 'HEAVILY_MONITORED'
        WHEN rc.observation_count >= 50 THEN 'WELL_MONITORED'
        WHEN rc.observation_count >= 20 THEN 'MODERATELY_MONITORED'
        WHEN rc.observation_count >= 5 THEN 'LIGHTLY_MONITORED'
        ELSE 'RARELY_MONITORED'
    END as monitoring_level,
    CASE 
        WHEN rc.last_observed > (UNIX_TIMESTAMP() - 3600) * 1000 THEN 'CURRENTLY_ACTIVE'
        WHEN rc.last_observed > (UNIX_TIMESTAMP() - 86400) * 1000 THEN 'RECENTLY_ACTIVE'
        WHEN rc.last_observed > (UNIX_TIMESTAMP() - 604800) * 1000 THEN 'ACTIVE_THIS_WEEK'
        ELSE 'INACTIVE'
    END as activity_status
FROM region_coverage rc
ORDER BY rc.observation_count DESC
LIMIT 50;
```

### Find unexplored regions
```sql
-- Identify sectors with no or minimal visibility
WITH all_sectors AS (
    SELECT DISTINCT s.X, s.Y, s.Z, s.NAME, s.TYPE
    FROM SECTORS s
    WHERE s.TYPE != 1  -- Exclude empty space
),
observed_sectors AS (
    SELECT DISTINCT v.X, v.Y, v.Z, MAX(v.TIMESTAMP) as last_observed
    FROM VISIBILITY v
    GROUP BY v.X, v.Y, v.Z
)
SELECT 
    als.X, als.Y, als.Z, als.NAME,
    CASE als.TYPE
        WHEN 0 THEN 'STAR'
        WHEN 2 THEN 'PLANET'
        WHEN 3 THEN 'STATION'
        WHEN 4 THEN 'ASTEROID_FIELD'
        WHEN 5 THEN 'NEBULA'
        WHEN 6 THEN 'WORMHOLE'
        WHEN 7 THEN 'TRADING_POST'
        WHEN 8 THEN 'PIRATE_BASE'
        WHEN 9 THEN 'DEBRIS_FIELD'
        ELSE 'UNKNOWN'
    END as sector_type,
    CASE 
        WHEN os.X IS NULL THEN 'NEVER_OBSERVED'
        WHEN os.last_observed < (UNIX_TIMESTAMP() - 2592000) * 1000 THEN 'NOT_RECENTLY_OBSERVED'
        ELSE 'RECENTLY_OBSERVED'
    END as observation_status,
    SQRT(POWER(als.X, 2) + POWER(als.Y, 2) + POWER(als.Z, 2)) as distance_from_origin
FROM all_sectors als
LEFT JOIN observed_sectors os ON als.X = os.X AND als.Y = os.Y AND als.Z = os.Z
WHERE os.X IS NULL  -- Never observed
   OR os.last_observed < (UNIX_TIMESTAMP() - 2592000) * 1000  -- Not observed in 30 days
ORDER BY distance_from_origin
LIMIT 100;
```

---

## Observer Movement Patterns

### Track observer movement paths
```sql
-- Analyze movement patterns for specific observers
WITH observer_movement AS (
    SELECT 
        v.ID,
        v.X, v.Y, v.Z,
        v.TIMESTAMP,
        LAG(v.X) OVER (PARTITION BY v.ID ORDER BY v.TIMESTAMP) as prev_x,
        LAG(v.Y) OVER (PARTITION BY v.ID ORDER BY v.TIMESTAMP) as prev_y,
        LAG(v.Z) OVER (PARTITION BY v.ID ORDER BY v.TIMESTAMP) as prev_z,
        LAG(v.TIMESTAMP) OVER (PARTITION BY v.ID ORDER BY v.TIMESTAMP) as prev_timestamp
    FROM VISIBILITY v
    WHERE v.ID = ?  -- Specific observer
)
SELECT 
    om.X, om.Y, om.Z,
    om.TIMESTAMP,
    SQRT(POWER(om.X - om.prev_x, 2) + 
         POWER(om.Y - om.prev_y, 2) + 
         POWER(om.Z - om.prev_z, 2)) as distance_traveled,
    om.TIMESTAMP - om.prev_timestamp as time_elapsed,
    CASE 
        WHEN om.TIMESTAMP - om.prev_timestamp > 0 THEN
            SQRT(POWER(om.X - om.prev_x, 2) + 
                 POWER(om.Y - om.prev_y, 2) + 
                 POWER(om.Z - om.prev_z, 2)) * 1000.0 / (om.TIMESTAMP - om.prev_timestamp)
        ELSE 0
    END as movement_speed
FROM observer_movement om
WHERE om.prev_x IS NOT NULL
ORDER BY om.TIMESTAMP DESC
LIMIT 100;
```

### Observer activity patterns
```sql
-- Identify active observers and their patterns
WITH recent_activity AS (
    SELECT 
        v.ID,
        COUNT(*) as observations_24h,
        COUNT(DISTINCT CONCAT(v.X, ',', v.Y, ',', v.Z)) as sectors_visited_24h,
        MIN(v.TIMESTAMP) as first_observation_24h,
        MAX(v.TIMESTAMP) as last_observation_24h,
        AVG(SQRT(POWER(v.X, 2) + POWER(v.Y, 2) + POWER(v.Z, 2))) as avg_distance_from_origin
    FROM VISIBILITY v
    WHERE v.TIMESTAMP > (UNIX_TIMESTAMP() - 86400) * 1000  -- Last 24 hours
    GROUP BY v.ID
),
activity_classification AS (
    SELECT 
        ra.ID,
        ra.observations_24h,
        ra.sectors_visited_24h,
        ra.avg_distance_from_origin,
        CASE 
            WHEN ra.observations_24h >= 100 THEN 'HYPERACTIVE'
            WHEN ra.observations_24h >= 50 THEN 'VERY_ACTIVE'
            WHEN ra.observations_24h >= 20 THEN 'ACTIVE'
            WHEN ra.observations_24h >= 5 THEN 'MODERATE'
            ELSE 'LOW_ACTIVITY'
        END as activity_level,
        CASE 
            WHEN ra.sectors_visited_24h >= 50 THEN 'EXPLORER'
            WHEN ra.sectors_visited_24h >= 20 THEN 'PATROL'
            WHEN ra.sectors_visited_24h >= 5 THEN 'LOCAL_MOVEMENT'
            ELSE 'STATIONARY'
        END as movement_pattern,
        CASE 
            WHEN ra.last_observation_24h > (UNIX_TIMESTAMP() - 3600) * 1000 THEN 'LAST_HOUR'
            WHEN ra.last_observation_24h > (UNIX_TIMESTAMP() - 10800) * 1000 THEN 'LAST_3_HOURS'
            WHEN ra.last_observation_24h > (UNIX_TIMESTAMP() - 43200) * 1000 THEN 'LAST_12_HOURS'
            ELSE 'LAST_24_HOURS'
        END as activity_period
    FROM recent_activity ra
)
SELECT 
    ac.ID,
    CASE 
        WHEN ac.ID > 0 THEN 'PLAYER_' || ac.ID
        WHEN ac.ID = -10000000 THEN 'TRADING_GUILD'
        WHEN ac.ID = -9999999 THEN 'OUTCASTS'
        WHEN ac.ID = -9999998 THEN 'SCAVENGERS'
        ELSE 'FACTION_' || ac.ID
    END as observer_identity,
    ac.observations_24h,
    ac.sectors_visited_24h,
    ROUND(ac.avg_distance_from_origin, 2) as avg_distance,
    ac.activity_level,
    ac.movement_pattern,
    ac.activity_period
FROM activity_classification ac
ORDER BY 
    CASE ac.activity_period 
        WHEN 'LAST_HOUR' THEN 1 
        WHEN 'LAST_3_HOURS' THEN 2 
        WHEN 'LAST_12_HOURS' THEN 3 
        ELSE 4 
    END,
    ac.observations_24h DESC;
```

---

## Strategic Intelligence

### Hot zones analysis
```sql
-- Identify sectors with recent multiple observations
SELECT v.X, v.Y, v.Z,
       COUNT(*) as recent_observations,
       COUNT(DISTINCT v.ID) as recent_observers,
       MIN(v.TIMESTAMP) as first_recent_observation,
       MAX(v.TIMESTAMP) as last_recent_observation,
       GROUP_CONCAT(DISTINCT 
           CASE 
               WHEN v.ID > 0 THEN 'P' || v.ID
               WHEN v.ID = -10000000 THEN 'TG'
               WHEN v.ID = -9999999 THEN 'OC'
               WHEN v.ID = -9999998 THEN 'SC'
               ELSE 'F' || v.ID
           END 
           SEPARATOR ','
       ) as observer_codes,
       SQRT(POWER(v.X, 2) + POWER(v.Y, 2) + POWER(v.Z, 2)) as distance_from_origin
FROM VISIBILITY v
WHERE v.TIMESTAMP > (UNIX_TIMESTAMP() - 259200) * 1000  -- Last 3 days
GROUP BY v.X, v.Y, v.Z
HAVING COUNT(DISTINCT v.ID) > 1  -- Multiple observers
ORDER BY recent_observations DESC, recent_observers DESC
LIMIT 20;
```

### Intelligence alerts and anomaly detection
```sql
-- Unusual exploration patterns (potential threats or opportunities)
WITH exploration_anomalies AS (
    SELECT v.ID, v.X, v.Y, v.Z, v.TIMESTAMP,
           SQRT(POWER(v.X, 2) + POWER(v.Y, 2) + POWER(v.Z, 2)) as distance_from_origin,
           -- Calculate if this is an unusually distant exploration for this observer
           v.TIMESTAMP - LAG(v.TIMESTAMP) OVER (PARTITION BY v.ID ORDER BY v.TIMESTAMP) as time_since_last,
           ABS(v.X - LAG(v.X) OVER (PARTITION BY v.ID ORDER BY v.TIMESTAMP)) + 
           ABS(v.Y - LAG(v.Y) OVER (PARTITION BY v.ID ORDER BY v.TIMESTAMP)) + 
           ABS(v.Z - LAG(v.Z) OVER (PARTITION BY v.ID ORDER BY v.TIMESTAMP)) as movement_distance
    FROM VISIBILITY v
    WHERE v.TIMESTAMP > (UNIX_TIMESTAMP() - 604800) * 1000  -- Last week
)
SELECT ea.ID,
       CASE 
           WHEN ea.ID > 0 THEN 'PLAYER_' || ea.ID
           WHEN ea.ID = -10000000 THEN 'TRADING_GUILD'
           WHEN ea.ID = -9999999 THEN 'OUTCASTS'
           WHEN ea.ID = -9999998 THEN 'SCAVENGERS'
           ELSE 'FACTION_' || ea.ID
       END as observer_identity,
       ea.X, ea.Y, ea.Z,
       ea.distance_from_origin,
       ea.movement_distance,
       ea.time_since_last,
       CASE 
           WHEN ea.movement_distance > 100 AND ea.time_since_last < 60000 THEN 'HYPERSPACE_JUMP'
           WHEN ea.movement_distance > 50 THEN 'LONG_RANGE_TRAVEL'
           WHEN ea.distance_from_origin > 500 THEN 'DEEP_SPACE_EXPLORATION'
           WHEN ea.movement_distance = 0 AND ea.time_since_last > 3600000 THEN 'SURVEILLANCE'
           ELSE 'NORMAL_MOVEMENT'
       END as activity_type
FROM exploration_anomalies ea
WHERE ea.time_since_last IS NOT NULL
  AND (ea.movement_distance > 50 OR ea.distance_from_origin > 300)
ORDER BY ea.TIMESTAMP DESC
LIMIT 50;
```

---

## Data Validation and Maintenance

### Visibility data integrity checks
```sql
-- Comprehensive data validation
WITH validation_checks AS (
    -- Check 1: Future timestamps
    SELECT 'FUTURE_TIMESTAMPS' as check_type, COUNT(*) as issues
    FROM VISIBILITY v
    WHERE v.TIMESTAMP > UNIX_TIMESTAMP() * 1000
    
    UNION ALL
    
    -- Check 2: Invalid coordinates
    SELECT 'INVALID_COORDINATES' as check_type, COUNT(*) as issues
    FROM VISIBILITY v
    WHERE v.X IS NULL OR v.Y IS NULL OR v.Z IS NULL
       OR ABS(v.X) > 1000000 OR ABS(v.Y) > 1000000 OR ABS(v.Z) > 1000000
    
    UNION ALL
    
    -- Check 3: Invalid observer IDs
    SELECT 'INVALID_OBSERVER_ID' as check_type, COUNT(*) as issues
    FROM VISIBILITY v
    WHERE v.ID IS NULL
    
    UNION ALL
    
    -- Check 4: Null timestamps
    SELECT 'NULL_TIMESTAMPS' as check_type, COUNT(*) as issues
    FROM VISIBILITY v
    WHERE v.TIMESTAMP IS NULL
    
    UNION ALL
    
    -- Check 5: Duplicate entries (same observer, location, timestamp)
    SELECT 'DUPLICATE_ENTRIES' as check_type, 
           COUNT(*) - COUNT(DISTINCT v.ID || ',' || v.X || ',' || v.Y || ',' || v.Z || ',' || v.TIMESTAMP) as issues
    FROM VISIBILITY v
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
-- Performance and storage analysis
SELECT 
    'VISIBILITY_STORAGE_ANALYSIS' as metric_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT ID) as unique_observers,
    COUNT(DISTINCT CONCAT(X, ',', Y, ',', Z)) as unique_sectors_observed,
    COUNT(CASE WHEN TIMESTAMP IS NULL THEN 1 END) as records_without_timestamp,
    MIN(TIMESTAMP) as earliest_observation,
    MAX(TIMESTAMP) as latest_observation,
    -- Estimate storage usage (rough calculation)
    COUNT(*) * 32 as estimated_bytes_used,  -- Rough estimate: 32 bytes per record
    ROUND(COUNT(*) * 32.0 / 1048576, 2) as estimated_mb_used
FROM VISIBILITY;
```

### Maintenance operations and cleanup
```sql
-- Identify potential cleanup candidates
-- Note: These are analysis queries; actual cleanup requires careful consideration

-- Find very old observations that might be candidates for archival
SELECT v.ID, v.X, v.Y, v.Z, v.TIMESTAMP,
       'OLD_OBSERVATION' as cleanup_category,
       UNIX_TIMESTAMP() * 1000 - v.TIMESTAMP as age_milliseconds
FROM VISIBILITY v
WHERE v.TIMESTAMP IS NOT NULL
AND v.TIMESTAMP < (UNIX_TIMESTAMP() * 1000 - 31536000000)  -- Older than 1 year
ORDER BY v.TIMESTAMP
LIMIT 100;

-- Find sectors with excessive observation density (potential duplicates)
SELECT v.X, v.Y, v.Z,
       COUNT(*) as observation_count,
       COUNT(DISTINCT v.ID) as unique_observers,
       GROUP_CONCAT(DISTINCT CAST(v.ID AS VARCHAR) SEPARATOR ',') as observer_list
FROM VISIBILITY v
GROUP BY v.X, v.Y, v.Z
HAVING COUNT(*) > 20  -- Sectors with more than 20 observations
ORDER BY observation_count DESC;

-- Performance summary after maintenance
SELECT 
    'VISIBILITY_MAINTENANCE_SUMMARY' as operation,
    COUNT(*) as total_observations,
    COUNT(DISTINCT ID) as active_observers,
    COUNT(DISTINCT CONCAT(X, ',', Y, ',', Z)) as sectors_mapped,
    COUNT(CASE WHEN ID > 0 THEN 1 END) as player_observations,
    COUNT(CASE WHEN ID < 0 THEN 1 END) as NPC_observations,
    COUNT(CASE WHEN ID IS NULL THEN 1 END) as system_observations,
    COUNT(CASE WHEN TIMESTAMP IS NOT NULL THEN 1 END) as timestamped_observations
FROM VISIBILITY;
```

---

## Reporting and Strategic Intelligence

### Comprehensive visibility intelligence report
```sql
-- Complete visibility system report with strategic insights
WITH observation_summary AS (
    SELECT 
        COUNT(*) as total_observations,
        COUNT(DISTINCT ID) as unique_observers,
        COUNT(DISTINCT CONCAT(X, ',', Y, ',', Z)) as sectors_covered,
        COUNT(CASE WHEN TIMESTAMP > (UNIX_TIMESTAMP() - 86400) * 1000 THEN 1 END) as observations_24h,
        COUNT(CASE WHEN TIMESTAMP > (UNIX_TIMESTAMP() - 604800) * 1000 THEN 1 END) as observations_7d,
        MIN(TIMESTAMP) as earliest_observation,
        MAX(TIMESTAMP) as latest_observation
    FROM VISIBILITY
),
observer_breakdown AS (
    SELECT 
        COUNT(DISTINCT CASE WHEN ID > 0 THEN ID END) as player_observers,
        COUNT(DISTINCT CASE WHEN ID = -10000000 THEN ID END) as trading_guild_active,
        COUNT(DISTINCT CASE WHEN ID = -9999999 THEN ID END) as outcasts_active,
        COUNT(DISTINCT CASE WHEN ID = -9999998 THEN ID END) as scavengers_active,
        COUNT(DISTINCT CASE WHEN ID < -9999998 OR (ID < 0 AND ID > -9999998) THEN ID END) as other_faction_observers
    FROM VISIBILITY
    WHERE TIMESTAMP > (UNIX_TIMESTAMP() - 604800) * 1000  -- Active in last week
),
coverage_analysis AS (
    SELECT 
        COUNT(DISTINCT s.ID) as total_sectors,
        COUNT(DISTINCT v.X || ',' || v.Y || ',' || v.Z) as observed_sectors,
        COUNT(DISTINCT CASE WHEN s.TYPE = 2 THEN s.ID END) as total_planets,
        COUNT(DISTINCT CASE WHEN s.TYPE = 2 AND v.X IS NOT NULL THEN s.ID END) as observed_planets,
        COUNT(DISTINCT CASE WHEN s.TYPE = 3 THEN s.ID END) as total_stations,
        COUNT(DISTINCT CASE WHEN s.TYPE = 3 AND v.X IS NOT NULL THEN s.ID END) as observed_stations
    FROM SECTORS s
    LEFT JOIN VISIBILITY v ON s.X = v.X AND s.Y = v.Y AND s.Z = v.Z
    WHERE s.TYPE IN (2, 3, 4, 6, 7, 8)  -- Important sector types
)
SELECT 
    'VISIBILITY_INTELLIGENCE_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    os.total_observations,
    os.unique_observers,
    os.sectors_covered,
    ROUND(ca.observed_sectors * 100.0 / NULLIF(ca.total_sectors, 0), 2) as coverage_percentage,
    os.observations_24h,
    os.observations_7d,
    ob.player_observers,
    ob.trading_guild_active + ob.outcasts_active + ob.scavengers_active as NPC_factions_active,
    ob.other_faction_observers,
    ca.observed_planets || '/' || ca.total_planets as planet_coverage,
    ca.observed_stations || '/' || ca.total_stations as station_coverage,
    CASE 
        WHEN os.observations_24h > 10000 THEN 'HIGH_ACTIVITY'
        WHEN os.observations_24h > 1000 THEN 'MODERATE_ACTIVITY'
        WHEN os.observations_24h > 100 THEN 'LOW_ACTIVITY'
        ELSE 'MINIMAL_ACTIVITY'
    END as current_activity_level,
    CASE 
        WHEN ca.observed_sectors * 100.0 / NULLIF(ca.total_sectors, 0) > 80 THEN 'EXCELLENT_COVERAGE'
        WHEN ca.observed_sectors * 100.0 / NULLIF(ca.total_sectors, 0) > 60 THEN 'GOOD_COVERAGE'
        WHEN ca.observed_sectors * 100.0 / NULLIF(ca.total_sectors, 0) > 40 THEN 'MODERATE_COVERAGE'
        WHEN ca.observed_sectors * 100.0 / NULLIF(ca.total_sectors, 0) > 20 THEN 'POOR_COVERAGE'
        ELSE 'MINIMAL_COVERAGE'
    END as coverage_assessment
FROM observation_summary os, observer_breakdown ob, coverage_analysis ca;
```

### Top explorers and surveillance operators
```sql
-- Identify most active observers with detailed metrics
WITH observer_metrics AS (
    SELECT 
        v.ID,
        COUNT(*) as total_observations,
        COUNT(DISTINCT CONCAT(v.X, ',', v.Y, ',', v.Z)) as unique_sectors,
        COUNT(DISTINCT DATE(v.TIMESTAMP / 1000, 'unixepoch')) as active_days,
        MIN(v.TIMESTAMP) as first_observation,
        MAX(v.TIMESTAMP) as last_observation,
        AVG(SQRT(POWER(v.X, 2) + POWER(v.Y, 2) + POWER(v.Z, 2))) as avg_distance_from_origin,
        MAX(SQRT(POWER(v.X, 2) + POWER(v.Y, 2) + POWER(v.Z, 2))) as max_distance_from_origin
    FROM VISIBILITY v
    GROUP BY v.ID
)
SELECT 
    om.ID,
    CASE 
        WHEN om.ID > 0 THEN 'PLAYER_' || om.ID
        WHEN om.ID = -10000000 THEN 'TRADING_GUILD'
        WHEN om.ID = -9999999 THEN 'OUTCASTS'
        WHEN om.ID = -9999998 THEN 'SCAVENGERS'
        ELSE 'FACTION_' || om.ID
    END as observer_identity,
    om.total_observations,
    om.unique_sectors,
    om.active_days,
    ROUND(om.avg_distance_from_origin, 2) as avg_exploration_distance,
    ROUND(om.max_distance_from_origin, 2) as max_exploration_distance,
    ROUND(om.total_observations * 1.0 / NULLIF(om.active_days, 0), 2) as observations_per_day,
    ROUND(om.unique_sectors * 1.0 / NULLIF(om.active_days, 0), 2) as new_sectors_per_day,
    CASE 
        WHEN om.last_observation > (UNIX_TIMESTAMP() - 86400) * 1000 THEN 'ACTIVE'
        WHEN om.last_observation > (UNIX_TIMESTAMP() - 604800) * 1000 THEN 'RECENTLY_ACTIVE'
        WHEN om.last_observation > (UNIX_TIMESTAMP() - 2592000) * 1000 THEN 'INACTIVE'
        ELSE 'DORMANT'
    END as current_status,
    CASE 
        WHEN om.unique_sectors * 1.0 / NULLIF(om.total_observations, 0) > 0.8 THEN 'EXPLORER'
        WHEN om.unique_sectors * 1.0 / NULLIF(om.total_observations, 0) > 0.5 THEN 'SCOUT'
        WHEN om.unique_sectors * 1.0 / NULLIF(om.total_observations, 0) > 0.2 THEN 'PATROL'
        ELSE 'SURVEILLANCE'
    END as observer_role
FROM observer_metrics om
WHERE om.total_observations > 10  -- Minimum activity threshold
ORDER BY om.total_observations DESC
LIMIT 50;
```

---

## Changelog

| Version | Date       | Author       | Description                                          |
|---------|------------|--------------|------------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of VISIBILITY example queries       |

[INDEX](./INDEX.md) | [VISIBILITY](./TABLE_VISIBILITY.md)