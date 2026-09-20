# TRADE_NODES - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) database with advanced features including economic analysis, market intelligence, and commercial optimization. **All queries focus exclusively on the TRADE_NODES table.**

---

## Basic Trade Node Queries

### Find stations by location, owner, and economic status
```sql
-- Search trading stations by specific owner
SELECT tn.ID, tn.STATION_NAME, tn.SEC_X, tn.SEC_Y, tn.SEC_Z,
       tn.FACTION, tn.CREDITS, tn.VOLUME, tn.CAPACITY, tn.PERMISSION
FROM TRADE_NODES tn
WHERE tn.PLAYER = ?  -- Specific player name
ORDER BY tn.CREDITS DESC, tn.CAPACITY DESC;
```

```sql
-- Find trading stations in specific sector
SELECT tn.ID, tn.PLAYER, tn.STATION_NAME, tn.FACTION,
       tn.CREDITS, tn.VOLUME, tn.CAPACITY,
       ROUND((tn.VOLUME / tn.CAPACITY) * 100, 2) as utilization_percentage
FROM TRADE_NODES tn
WHERE tn.SEC_X = ? AND tn.SEC_Y = ? AND tn.SEC_Z = ?
ORDER BY tn.CREDITS DESC;
```

```sql
-- Search wealthy trading stations
SELECT tn.ID, tn.PLAYER, tn.STATION_NAME, tn.SEC_X, tn.SEC_Y, tn.SEC_Z,
       tn.CREDITS, tn.CAPACITY, tn.FACTION, tn.PERMISSION
FROM TRADE_NODES tn
WHERE tn.CREDITS >= ?  -- Minimum credit threshold
ORDER BY tn.CREDITS DESC, tn.CAPACITY DESC;
```

```sql
-- Find stations by permission access level
SELECT tn.ID, tn.STATION_NAME, tn.PLAYER, tn.SEC_X, tn.SEC_Y, tn.SEC_Z,
       tn.PERMISSION, tn.CREDITS,
       CASE 
           WHEN (tn.PERMISSION & 1) = 1 THEN 'NEUTRAL_ACCESS'
           ELSE 'NO_NEUTRAL_ACCESS'
       END as neutral_access,
       CASE 
           WHEN (tn.PERMISSION & 2) = 2 THEN 'FACTION_ACCESS'
           ELSE 'NO_FACTION_ACCESS'
       END as faction_access,
       CASE 
           WHEN (tn.PERMISSION & 4) = 4 THEN 'ALLY_ACCESS'
           ELSE 'NO_ALLY_ACCESS'
       END as ally_access
FROM TRADE_NODES tn
WHERE (tn.PERMISSION & ?) > 0  -- Has specific permission bit
ORDER BY tn.PERMISSION DESC, tn.CREDITS DESC;
```

### Count stations by faction, location, and economic metrics
```sql
-- Trading station distribution by faction
SELECT tn.FACTION,
       CASE 
           WHEN tn.FACTION = 0 THEN 'NEUTRAL'
           WHEN tn.FACTION = -10000000 THEN 'TRADING_GUILD'
           WHEN tn.FACTION = -9999999 THEN 'OUTCASTS'
           WHEN tn.FACTION = -9999998 THEN 'SCAVENGERS'
           WHEN tn.FACTION > 0 THEN 'PLAYER_FACTION_' || tn.FACTION
           ELSE 'UNKNOWN'
       END as faction_type,
       COUNT(*) as station_count,
       SUM(tn.CREDITS) as total_credits,
       AVG(tn.CREDITS) as avg_credits,
       SUM(tn.CAPACITY) as total_capacity,
       AVG(tn.CAPACITY) as avg_capacity,
       AVG(tn.VOLUME / tn.CAPACITY) as avg_utilization_rate
FROM TRADE_NODES tn
GROUP BY tn.FACTION
ORDER BY station_count DESC, total_credits DESC;
```

```sql
-- Geographic distribution of trading stations
SELECT tn.SEC_X, tn.SEC_Y, tn.SEC_Z,
       COUNT(*) as station_count,
       COUNT(DISTINCT tn.PLAYER) as unique_owners,
       COUNT(DISTINCT tn.FACTION) as faction_count,
       SUM(tn.CREDITS) as total_sector_credits,
       AVG(tn.CREDITS) as avg_station_credits,
       SUM(tn.CAPACITY) as total_sector_capacity,
       AVG(tn.VOLUME / tn.CAPACITY) as avg_utilization_rate
FROM TRADE_NODES tn
GROUP BY tn.SEC_X, tn.SEC_Y, tn.SEC_Z
ORDER BY station_count DESC, total_sector_credits DESC;
```

```sql
-- Economic size classification
SELECT 
    CASE 
        WHEN tn.CREDITS >= 100000000 THEN 'MEGA_CORP (100M+)'
        WHEN tn.CREDITS >= 10000000 THEN 'LARGE_BUSINESS (10M-100M)'
        WHEN tn.CREDITS >= 1000000 THEN 'MEDIUM_BUSINESS (1M-10M)'
        WHEN tn.CREDITS >= 100000 THEN 'SMALL_BUSINESS (100K-1M)'
        WHEN tn.CREDITS >= 10000 THEN 'STARTUP (10K-100K)'
        ELSE 'MICRO_BUSINESS (<10K)'
    END as economic_class,
    COUNT(*) as station_count,
    AVG(tn.CREDITS) as avg_credits,
    AVG(tn.CAPACITY) as avg_capacity,
    COUNT(DISTINCT tn.PLAYER) as unique_owners,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM TRADE_NODES), 2) as percentage_of_total
FROM TRADE_NODES tn
GROUP BY 
    CASE 
        WHEN tn.CREDITS >= 100000000 THEN 'MEGA_CORP (100M+)'
        WHEN tn.CREDITS >= 10000000 THEN 'LARGE_BUSINESS (10M-100M)'
        WHEN tn.CREDITS >= 1000000 THEN 'MEDIUM_BUSINESS (1M-10M)'
        WHEN tn.CREDITS >= 100000 THEN 'SMALL_BUSINESS (100K-1M)'
        WHEN tn.CREDITS >= 10000 THEN 'STARTUP (10K-100K)'
        ELSE 'MICRO_BUSINESS (<10K)'
    END
ORDER BY AVG(tn.CREDITS) DESC;
```

---

## Economic Analysis and Market Intelligence

### Market concentration and commercial power analysis
```sql
-- Commercial empire analysis by player ownership
WITH commercial_empires AS (
    SELECT tn.PLAYER,
           COUNT(*) as owned_stations,
           SUM(tn.CREDITS) as total_wealth,
           AVG(tn.CREDITS) as avg_station_wealth,
           SUM(tn.CAPACITY) as total_capacity,
           AVG(tn.CAPACITY) as avg_capacity,
           COUNT(DISTINCT CONCAT(tn.SEC_X, ',', tn.SEC_Y, ',', tn.SEC_Z)) as sectors_controlled,
           COUNT(DISTINCT tn.FACTION) as faction_diversity,
           AVG(tn.VOLUME / tn.CAPACITY) as avg_utilization_rate
    FROM TRADE_NODES tn
    GROUP BY tn.PLAYER
    HAVING COUNT(*) >= 2  -- Only analyze significant commercial presence
)
SELECT ce.PLAYER,
       ce.owned_stations,
       ce.total_wealth,
       ce.avg_station_wealth,
       ce.total_capacity,
       ce.sectors_controlled,
       ce.faction_diversity,
       ROUND(ce.avg_utilization_rate * 100, 2) as avg_utilization_percentage,
       CASE 
           WHEN ce.owned_stations >= 20 THEN 'COMMERCIAL_EMPIRE'
           WHEN ce.owned_stations >= 10 THEN 'MAJOR_TRADER'
           WHEN ce.owned_stations >= 5 THEN 'ESTABLISHED_MERCHANT'
           WHEN ce.owned_stations >= 3 THEN 'GROWING_BUSINESS'
           ELSE 'SMALL_TRADER'
       END as commercial_classification,
       CASE 
           WHEN ce.total_wealth >= 1000000000 THEN 'ULTRA_WEALTHY'
           WHEN ce.total_wealth >= 100000000 THEN 'VERY_WEALTHY'
           WHEN ce.total_wealth >= 10000000 THEN 'WEALTHY'
           WHEN ce.total_wealth >= 1000000 THEN 'COMFORTABLE'
           ELSE 'MODEST'
       END as wealth_class
FROM commercial_empires ce
ORDER BY ce.total_wealth DESC, ce.owned_stations DESC;
```

```sql
-- Market concentration and competition analysis
WITH market_metrics AS (
    SELECT tn.SEC_X, tn.SEC_Y, tn.SEC_Z,
           COUNT(*) as station_count,
           COUNT(DISTINCT tn.PLAYER) as unique_owners,
           SUM(tn.CREDITS) as total_credits,
           MAX(tn.CREDITS) as max_credits,
           AVG(tn.CREDITS) as avg_credits,
           STDDEV_POP(tn.CREDITS) as credit_std_dev,
           SUM(tn.CAPACITY) as total_capacity
    FROM TRADE_NODES tn
    GROUP BY tn.SEC_X, tn.SEC_Y, tn.SEC_Z
    HAVING COUNT(*) >= 2  -- Only analyze sectors with multiple stations
)
SELECT mm.SEC_X, mm.SEC_Y, mm.SEC_Z,
       mm.station_count,
       mm.unique_owners,
       mm.total_credits,
       mm.avg_credits,
       ROUND(mm.credit_std_dev, 2) as credit_std_dev,
       ROUND(mm.max_credits / mm.avg_credits, 2) as wealth_concentration_ratio,
       mm.total_capacity,
       CASE 
           WHEN mm.station_count >= 10 THEN 'MAJOR_TRADING_HUB'
           WHEN mm.station_count >= 5 THEN 'COMMERCIAL_CENTER'
           WHEN mm.station_count >= 3 THEN 'TRADING_CLUSTER'
           ELSE 'SMALL_MARKET'
       END as market_classification,
       CASE 
           WHEN mm.unique_owners * 1.0 / mm.station_count >= 0.8 THEN 'COMPETITIVE_MARKET'
           WHEN mm.unique_owners * 1.0 / mm.station_count >= 0.6 THEN 'MODERATELY_COMPETITIVE'
           WHEN mm.unique_owners * 1.0 / mm.station_count >= 0.4 THEN 'CONCENTRATED_MARKET'
           ELSE 'MONOPOLISTIC_MARKET'
       END as competition_level
FROM market_metrics mm
ORDER BY mm.total_credits DESC, mm.station_count DESC;
```

### Storage utilization and capacity analysis
```sql
-- Storage efficiency and capacity utilization analysis
WITH storage_analysis AS (
    SELECT tn.*,
           tn.VOLUME / tn.CAPACITY as utilization_rate,
           tn.CAPACITY - tn.VOLUME as available_space,
           CASE 
               WHEN tn.VOLUME / tn.CAPACITY >= 0.95 THEN 'CRITICAL_FULL'
               WHEN tn.VOLUME / tn.CAPACITY >= 0.85 THEN 'NEARLY_FULL'
               WHEN tn.VOLUME / tn.CAPACITY >= 0.70 THEN 'WELL_UTILIZED'
               WHEN tn.VOLUME / tn.CAPACITY >= 0.50 THEN 'MODERATE_USAGE'
               WHEN tn.VOLUME / tn.CAPACITY >= 0.25 THEN 'LOW_USAGE'
               ELSE 'MINIMAL_USAGE'
           END as utilization_category
    FROM TRADE_NODES tn
)
SELECT sa.utilization_category,
       COUNT(*) as station_count,
       AVG(sa.utilization_rate) as avg_utilization_rate,
       AVG(sa.CAPACITY) as avg_capacity,
       AVG(sa.available_space) as avg_available_space,
       AVG(sa.CREDITS) as avg_credits,
       SUM(sa.available_space) as total_available_space,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM TRADE_NODES), 2) as percentage_of_stations
FROM storage_analysis sa
GROUP BY sa.utilization_category
ORDER BY AVG(sa.utilization_rate) DESC;
```

```sql
-- Large capacity stations and storage infrastructure
SELECT tn.ID, tn.PLAYER, tn.STATION_NAME, tn.SEC_X, tn.SEC_Y, tn.SEC_Z,
       tn.CAPACITY, tn.VOLUME, tn.CREDITS,
       ROUND(tn.VOLUME / tn.CAPACITY * 100, 2) as utilization_percentage,
       tn.CAPACITY - tn.VOLUME as available_space,
       CASE 
           WHEN tn.CAPACITY >= 100000000 THEN 'MEGA_WAREHOUSE'
           WHEN tn.CAPACITY >= 10000000 THEN 'LARGE_WAREHOUSE'
           WHEN tn.CAPACITY >= 1000000 THEN 'MEDIUM_WAREHOUSE'
           WHEN tn.CAPACITY >= 100000 THEN 'SMALL_WAREHOUSE'
           ELSE 'BASIC_STORAGE'
       END as storage_class
FROM TRADE_NODES tn
WHERE tn.CAPACITY >= 100000  -- Focus on significant storage facilities
ORDER BY tn.CAPACITY DESC, tn.available_space DESC;
```

---

## Permission and Access Analysis

### Trade access and permission policy analysis
```sql
-- Comprehensive permission analysis
WITH permission_breakdown AS (
    SELECT tn.*,
           CASE WHEN (tn.PERMISSION & 1) = 1 THEN 1 ELSE 0 END as allows_neutral,
           CASE WHEN (tn.PERMISSION & 2) = 2 THEN 1 ELSE 0 END as allows_faction,
           CASE WHEN (tn.PERMISSION & 4) = 4 THEN 1 ELSE 0 END as allows_ally,
           CASE WHEN (tn.PERMISSION & 8) = 8 THEN 1 ELSE 0 END as allows_NPC,
           CASE WHEN (tn.PERMISSION & 16) = 16 THEN 1 ELSE 0 END as allows_enemy,
           BIN(tn.PERMISSION) as permission_binary
    FROM TRADE_NODES tn
)
SELECT pb.allows_neutral, pb.allows_faction, pb.allows_ally, pb.allows_NPC, pb.allows_enemy,
       COUNT(*) as station_count,
       AVG(pb.CREDITS) as avg_credits,
       AVG(pb.CAPACITY) as avg_capacity,
       COUNT(DISTINCT pb.PLAYER) as unique_owners,
       CASE 
           WHEN pb.allows_neutral = 1 AND pb.allows_faction = 1 AND pb.allows_ally = 1 AND pb.allows_NPC = 1 AND pb.allows_enemy = 1 THEN 'UNIVERSAL_ACCESS'
           WHEN pb.allows_neutral = 1 AND pb.allows_faction = 1 AND pb.allows_ally = 1 AND pb.allows_NPC = 1 THEN 'OPEN_TRADE'
           WHEN pb.allows_neutral = 1 AND pb.allows_faction = 1 AND pb.allows_ally = 1 THEN 'FRIENDLY_TRADE'
           WHEN pb.allows_faction = 1 AND pb.allows_ally = 1 THEN 'FACTION_ALLIED_ONLY'
           WHEN pb.allows_faction = 1 THEN 'FACTION_ONLY'
           WHEN pb.allows_neutral = 1 THEN 'NEUTRAL_ONLY'
           ELSE 'RESTRICTED_ACCESS'
       END as access_policy
FROM permission_breakdown pb
GROUP BY pb.allows_neutral, pb.allows_faction, pb.allows_ally, pb.allows_NPC, pb.allows_enemy
ORDER BY station_count DESC;
```

```sql
-- Access policy by faction type
SELECT tn.FACTION,
       CASE 
           WHEN tn.FACTION = 0 THEN 'NEUTRAL'
           WHEN tn.FACTION = -10000000 THEN 'TRADING_GUILD'
           WHEN tn.FACTION = -9999999 THEN 'OUTCASTS'
           WHEN tn.FACTION = -9999998 THEN 'SCAVENGERS'
           WHEN tn.FACTION > 0 THEN 'PLAYER_FACTION'
           ELSE 'UNKNOWN'
       END as faction_type,
       COUNT(*) as total_stations,
       COUNT(CASE WHEN (tn.PERMISSION & 1) = 1 THEN 1 END) as neutral_access_stations,
       COUNT(CASE WHEN (tn.PERMISSION & 16) = 16 THEN 1 END) as enemy_access_stations,
       AVG(tn.PERMISSION) as avg_permission_value,
       ROUND(COUNT(CASE WHEN (tn.PERMISSION & 1) = 1 THEN 1 END) * 100.0 / COUNT(*), 2) as neutral_access_percentage,
       ROUND(COUNT(CASE WHEN (tn.PERMISSION & 16) = 16 THEN 1 END) * 100.0 / COUNT(*), 2) as enemy_access_percentage
FROM TRADE_NODES tn
GROUP BY tn.FACTION
ORDER BY total_stations DESC;
```

### Market accessibility and openness analysis
```sql
-- Market openness and trade barrier analysis
WITH accessibility_metrics AS (
    SELECT tn.*,
           (tn.PERMISSION & 1) + (tn.PERMISSION & 2) + (tn.PERMISSION & 4) + (tn.PERMISSION & 8) + (tn.PERMISSION & 16) as access_score,
           CASE 
               WHEN tn.PERMISSION = 31 THEN 'COMPLETELY_OPEN'      -- All bits set
               WHEN tn.PERMISSION >= 15 THEN 'MOSTLY_OPEN'         -- Most access granted
               WHEN tn.PERMISSION >= 7 THEN 'MODERATELY_OPEN'      -- Some restrictions
               WHEN tn.PERMISSION >= 3 THEN 'SOMEWHAT_RESTRICTED'  -- Significant restrictions
               WHEN tn.PERMISSION >= 1 THEN 'HIGHLY_RESTRICTED'    -- Very limited access
               ELSE 'CLOSED'                                       -- No access
           END as openness_level
    FROM TRADE_NODES tn
)
SELECT am.openness_level,
       COUNT(*) as station_count,
       AVG(am.access_score) as avg_access_score,
       AVG(am.CREDITS) as avg_credits,
       AVG(am.CAPACITY) as avg_capacity,
       COUNT(DISTINCT am.PLAYER) as unique_owners,
       COUNT(DISTINCT am.FACTION) as faction_diversity,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM TRADE_NODES), 2) as market_share_percentage
FROM accessibility_metrics am
GROUP BY am.openness_level
ORDER BY AVG(am.access_score) DESC;
```

---

## Geographic and Spatial Analysis

### Trading hub identification and spatial distribution
```sql
-- Major trading hub identification
WITH trading_hubs AS (
    SELECT tn.SEC_X, tn.SEC_Y, tn.SEC_Z,
           COUNT(*) as station_density,
           COUNT(DISTINCT tn.PLAYER) as merchant_diversity,
           SUM(tn.CREDITS) as hub_wealth,
           SUM(tn.CAPACITY) as hub_capacity,
           AVG(tn.CREDITS) as avg_station_wealth,
           AVG(tn.VOLUME / tn.CAPACITY) as avg_utilization,
           SQRT(POWER(tn.SEC_X, 2) + POWER(tn.SEC_Y, 2) + POWER(tn.SEC_Z, 2)) as distance_from_origin
    FROM TRADE_NODES tn
    GROUP BY tn.SEC_X, tn.SEC_Y, tn.SEC_Z
    HAVING COUNT(*) >= 3  -- Only consider sectors with multiple stations
)
SELECT th.SEC_X, th.SEC_Y, th.SEC_Z,
       th.station_density,
       th.merchant_diversity,
       th.hub_wealth,
       th.hub_capacity,
       ROUND(th.avg_station_wealth, 2) as avg_station_wealth,
       ROUND(th.avg_utilization * 100, 2) as avg_utilization_percentage,
       ROUND(th.distance_from_origin, 2) as distance_from_origin,
       CASE 
           WHEN th.station_density >= 10 AND th.hub_wealth >= 100000000 THEN 'MEGA_HUB'
           WHEN th.station_density >= 5 AND th.hub_wealth >= 50000000 THEN 'MAJOR_HUB'
           WHEN th.station_density >= 3 AND th.hub_wealth >= 10000000 THEN 'REGIONAL_HUB'
           ELSE 'LOCAL_HUB'
       END as hub_classification,
       CASE 
           WHEN th.distance_from_origin <= 10 THEN 'CORE_REGION'
           WHEN th.distance_from_origin <= 25 THEN 'INNER_REGION'
           WHEN th.distance_from_origin <= 50 THEN 'MIDDLE_REGION'
           ELSE 'OUTER_REGION'
       END as regional_classification
FROM trading_hubs th
ORDER BY th.hub_wealth DESC, th.station_density DESC;
```

```sql
-- Trade route analysis and distance-based opportunities
WITH trade_pairs AS (
    SELECT tn1.ID as station1_id, tn1.PLAYER as player1, tn1.STATION_NAME as station1_name,
           tn1.SEC_X as x1, tn1.SEC_Y as y1, tn1.SEC_Z as z1, tn1.CREDITS as credits1,
           tn2.ID as station2_id, tn2.PLAYER as player2, tn2.STATION_NAME as station2_name,
           tn2.SEC_X as x2, tn2.SEC_Y as y2, tn2.SEC_Z as z2, tn2.CREDITS as credits2,
           SQRT(POWER(tn1.SEC_X - tn2.SEC_X, 2) + POWER(tn1.SEC_Y - tn2.SEC_Y, 2) + POWER(tn1.SEC_Z - tn2.SEC_Z, 2)) as distance
    FROM TRADE_NODES tn1
    JOIN TRADE_NODES tn2 ON tn1.ID < tn2.ID  -- Avoid duplicates
    WHERE tn1.PLAYER != tn2.PLAYER  -- Different owners for meaningful trade routes
)
SELECT tp.station1_name, tp.player1, tp.x1, tp.y1, tp.z1, tp.credits1,
       tp.station2_name, tp.player2, tp.x2, tp.y2, tp.z2, tp.credits2,
       ROUND(tp.distance, 2) as distance,
       ABS(tp.credits1 - tp.credits2) as wealth_difference,
       CASE 
           WHEN tp.distance <= 5 THEN 'LOCAL_TRADE'
           WHEN tp.distance <= 15 THEN 'REGIONAL_TRADE'
           WHEN tp.distance <= 30 THEN 'LONG_DISTANCE_TRADE'
           ELSE 'EXTREME_DISTANCE_TRADE'
       END as trade_route_type
FROM trade_pairs tp
WHERE tp.distance <= 50  -- Focus on feasible trade routes
  AND ABS(tp.credits1 - tp.credits2) >= 1000000  -- Significant wealth differences
ORDER BY tp.distance, ABS(tp.credits1 - tp.credits2) DESC
LIMIT 50;
```

### Regional economic dominance and market control
```sql
-- Regional economic analysis by distance from origin
WITH regional_analysis AS (
    SELECT tn.*,
           SQRT(POWER(tn.SEC_X, 2) + POWER(tn.SEC_Y, 2) + POWER(tn.SEC_Z, 2)) as distance_from_origin,
           CASE 
               WHEN SQRT(POWER(tn.SEC_X, 2) + POWER(tn.SEC_Y, 2) + POWER(tn.SEC_Z, 2)) <= 10 THEN 'CORE'
               WHEN SQRT(POWER(tn.SEC_X, 2) + POWER(tn.SEC_Y, 2) + POWER(tn.SEC_Z, 2)) <= 25 THEN 'INNER'
               WHEN SQRT(POWER(tn.SEC_X, 2) + POWER(tn.SEC_Y, 2) + POWER(tn.SEC_Z, 2)) <= 50 THEN 'MIDDLE'
               WHEN SQRT(POWER(tn.SEC_X, 2) + POWER(tn.SEC_Y, 2) + POWER(tn.SEC_Z, 2)) <= 100 THEN 'OUTER'
               ELSE 'FRONTIER'
           END as region
    FROM TRADE_NODES tn
)
SELECT ra.region,
       COUNT(*) as station_count,
       COUNT(DISTINCT ra.PLAYER) as unique_merchants,
       SUM(ra.CREDITS) as total_regional_wealth,
       AVG(ra.CREDITS) as avg_station_wealth,
       SUM(ra.CAPACITY) as total_regional_capacity,
       AVG(ra.CAPACITY) as avg_station_capacity,
       AVG(ra.VOLUME / ra.CAPACITY) as avg_utilization_rate,
       AVG(ra.distance_from_origin) as avg_distance_from_origin,
       MAX(ra.CREDITS) as wealthiest_station_credits,
       MIN(ra.CREDITS) as poorest_station_credits
FROM regional_analysis ra
GROUP BY ra.region
ORDER BY SUM(ra.CREDITS) DESC;
```

---

## Data Management and Maintenance

### Trade node data validation and integrity
```sql
-- Comprehensive trade node data validation
WITH validation_checks AS (
    -- Check 1: Invalid coordinate references
    SELECT 'INVALID_COORDINATES' as check_type, COUNT(*) as issues
    FROM TRADE_NODES tn
    WHERE tn.SEC_X IS NULL OR tn.SEC_Y IS NULL OR tn.SEC_Z IS NULL
    
    UNION ALL
    
    -- Check 2: Negative or zero capacity
    SELECT 'INVALID_CAPACITY' as check_type, COUNT(*) as issues
    FROM TRADE_NODES tn
    WHERE tn.CAPACITY <= 0
    
    UNION ALL
    
    -- Check 3: Volume exceeding capacity
    SELECT 'VOLUME_EXCEEDS_CAPACITY' as check_type, COUNT(*) as issues
    FROM TRADE_NODES tn
    WHERE tn.VOLUME > tn.CAPACITY
    
    UNION ALL
    
    -- Check 4: Negative credits
    SELECT 'NEGATIVE_CREDITS' as check_type, COUNT(*) as issues
    FROM TRADE_NODES tn
    WHERE tn.CREDITS < 0
    
    UNION ALL
    
    -- Check 5: Missing owner information
    SELECT 'MISSING_OWNER' as check_type, COUNT(*) as issues
    FROM TRADE_NODES tn
    WHERE tn.PLAYER IS NULL OR TRIM(tn.PLAYER) = ''
    
    UNION ALL
    
    -- Check 6: Missing station name
    SELECT 'MISSING_STATION_NAME' as check_type, COUNT(*) as issues
    FROM TRADE_NODES tn
    WHERE tn.STATION_NAME IS NULL OR TRIM(tn.STATION_NAME) = ''
    
    UNION ALL
    
    -- Check 7: Invalid permission values
    SELECT 'INVALID_PERMISSIONS' as check_type, COUNT(*) as issues
    FROM TRADE_NODES tn
    WHERE tn.PERMISSION < 0 OR tn.PERMISSION > 31  -- Max 5 bits set
    
    UNION ALL
    
    -- Check 8: Orphaned entity references
    SELECT 'ORPHANED_ENTITIES' as check_type, COUNT(*) as issues
    FROM TRADE_NODES tn
    WHERE tn.ID IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ENTITIES e WHERE e.ID = tn.ID)
)
SELECT 
    vc.check_type,
    vc.issues,
    CASE 
        WHEN vc.issues = 0 THEN 'PASS'
        WHEN vc.issues < 5 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status
FROM validation_checks vc
ORDER BY vc.issues DESC;
```

```sql
-- Trade node storage and performance analysis
SELECT 
    'TRADE_NODE_STORAGE_ANALYSIS' as metric_type,
    COUNT(*) as total_trade_nodes,
    COUNT(DISTINCT PLAYER) as unique_merchants,
    COUNT(DISTINCT FACTION) as unique_factions,
    COUNT(DISTINCT CONCAT(SEC_X, ',', SEC_Y, ',', SEC_Z)) as sectors_with_trade,
    SUM(CREDITS) as total_economy_credits,
    AVG(CREDITS) as avg_station_credits,
    SUM(CAPACITY) as total_storage_capacity,
    SUM(VOLUME) as total_used_storage,
    AVG(VOLUME / CAPACITY) as avg_utilization_rate,
    MAX(LENGTH(ITEMS)) as max_items_data_size,
    AVG(LENGTH(ITEMS)) as avg_items_data_size
FROM TRADE_NODES;
```

### Maintenance operations and optimization
```sql
-- Identify cleanup and optimization candidates
-- Note: These are analysis queries; actual cleanup requires careful consideration

-- Find stations with suspicious economic metrics
SELECT tn.ID, tn.PLAYER, tn.STATION_NAME, tn.SEC_X, tn.SEC_Y, tn.SEC_Z,
       tn.CREDITS, tn.CAPACITY, tn.VOLUME,
       'SUSPICIOUS_METRICS' as issue_type,
       CASE 
           WHEN tn.CREDITS > 999999999999 THEN 'EXCESSIVE_CREDITS'
           WHEN tn.CAPACITY > 999999999999 THEN 'EXCESSIVE_CAPACITY'
           WHEN tn.VOLUME > tn.CAPACITY THEN 'VOLUME_OVERFLOW'
           WHEN tn.CREDITS = 0 AND tn.VOLUME = 0 THEN 'EMPTY_STATION'
           ELSE 'OTHER'
       END as specific_issue
FROM TRADE_NODES tn
WHERE tn.CREDITS > 999999999999  -- Excessive credits
   OR tn.CAPACITY > 999999999999  -- Excessive capacity
   OR tn.VOLUME > tn.CAPACITY     -- Volume overflow
   OR (tn.CREDITS = 0 AND tn.VOLUME = 0)  -- Completely empty
ORDER BY tn.CREDITS DESC, tn.CAPACITY DESC;
```

```sql
-- Find potential duplicate or abandoned stations
SELECT tn.PLAYER, tn.SEC_X, tn.SEC_Y, tn.SEC_Z,
       COUNT(*) as stations_in_sector,
       STRING_AGG(tn.STATION_NAME, ', ') as station_names,
       SUM(tn.CREDITS) as total_sector_credits,
       'POTENTIAL_DUPLICATES' as analysis_type
FROM TRADE_NODES tn
GROUP BY tn.PLAYER, tn.SEC_X, tn.SEC_Y, tn.SEC_Z
HAVING COUNT(*) > 1  -- Multiple stations by same player in same sector
ORDER BY COUNT(*) DESC, SUM(tn.CREDITS) DESC;
```

```sql
-- Performance summary after maintenance
SELECT 
    'TRADE_NODE_MAINTENANCE_SUMMARY' as operation,
    COUNT(*) as total_stations,
    COUNT(DISTINCT PLAYER) as active_merchants,
    COUNT(DISTINCT FACTION) as active_factions,
    COUNT(DISTINCT CONCAT(SEC_X, ',', SEC_Y, ',', SEC_Z)) as trading_sectors,
    SUM(CREDITS) as total_economy_value,
    SUM(CAPACITY) as total_storage_infrastructure,
    SUM(VOLUME) as total_inventory_volume,
    COUNT(CASE WHEN VOLUME / CAPACITY >= 0.8 THEN 1 END) as high_utilization_stations
FROM TRADE_NODES;
```

---

## Reporting and Economic Intelligence

### Comprehensive economic system report
```sql
-- Complete trading economy system report
SELECT 
    'TRADE_ECONOMY_SYSTEM_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    COUNT(*) as total_trading_stations,
    COUNT(DISTINCT PLAYER) as unique_merchants,
    COUNT(DISTINCT FACTION) as factions_in_trade,
    COUNT(DISTINCT CONCAT(SEC_X, ',', SEC_Y, ',', SEC_Z)) as sectors_with_trade,
    SUM(CREDITS) as total_economy_credits,
    AVG(CREDITS) as avg_station_credits,
    SUM(CAPACITY) as total_storage_capacity,
    SUM(VOLUME) as total_inventory_volume,
    ROUND(SUM(VOLUME) / SUM(CAPACITY) * 100, 2) as economy_utilization_percentage,
    MAX(CREDITS) as wealthiest_station_credits,
    MIN(CREDITS) as poorest_station_credits
FROM TRADE_NODES;
```

```sql
-- Top trading empires and economic leaders
SELECT tn.PLAYER,
       COUNT(*) as owned_stations,
       SUM(tn.CREDITS) as total_wealth,
       AVG(tn.CREDITS) as avg_station_wealth,
       SUM(tn.CAPACITY) as total_capacity,
       COUNT(DISTINCT CONCAT(tn.SEC_X, ',', tn.SEC_Y, ',', tn.SEC_Z)) as sectors_presence,
       COUNT(DISTINCT tn.FACTION) as faction_diversity,
       ROUND(AVG(tn.VOLUME / tn.CAPACITY) * 100, 2) as avg_utilization_percentage
FROM TRADE_NODES tn
GROUP BY tn.PLAYER
ORDER BY SUM(tn.CREDITS) DESC, COUNT(*) DESC
LIMIT 20;
```

---

## Changelog

| Version | Date       | Author       | Description                                        |
|---------|------------|--------------|----------------------------------------------------| 
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of TRADE_NODES example queries   |

[INDEX](./INDEX.md) | [TRADE_NODE](./TABLE_TRADE_NODES.md)