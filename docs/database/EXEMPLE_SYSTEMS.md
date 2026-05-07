# SYSTEMS - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) database with advanced features including territorial analysis, resource evaluation, and galaxy-scale operations. **All queries focus exclusively on the SYSTEMS table.**

---

## Basic System Queries

### Find systems by coordinates and type
```sql
-- Search systems by specific coordinates
SELECT s.ID, s.X, s.Y, s.Z, s.TYPE, s.NAME, s.OWNER_FACTION
FROM SYSTEMS s
WHERE s.X = ? AND s.Y = ? AND s.Z = ?;
```

```sql
-- Find systems by type
SELECT s.ID, s.X, s.Y, s.Z, s.NAME, s.OWNER_FACTION, s.STARTTIME
FROM SYSTEMS s
WHERE s.TYPE = 1  -- Giant star systems
ORDER BY s.X, s.Y, s.Z;
```

```sql
-- Search systems by type with descriptive names
SELECT s.X, s.Y, s.Z, s.TYPE,
       CASE s.TYPE
           WHEN 0 THEN 'SUN'
           WHEN 1 THEN 'GIANT'
           WHEN 2 THEN 'BLACK_HOLE'
           WHEN 3 THEN 'DOUBLE_STAR'
           WHEN 4 THEN 'VOID'
           ELSE 'UNKNOWN'
       END as type_name,
       s.NAME, s.OWNER_FACTION
FROM SYSTEMS s
WHERE s.TYPE IN (1, 2, 3)  -- High-value systems only
ORDER BY s.TYPE, s.X, s.Y, s.Z;
```

### Count systems by type and ownership
```sql
-- Distribution of system types
SELECT s.TYPE,
       CASE s.TYPE
           WHEN 0 THEN 'SUN'
           WHEN 1 THEN 'GIANT'
           WHEN 2 THEN 'BLACK_HOLE'
           WHEN 3 THEN 'DOUBLE_STAR'
           WHEN 4 THEN 'VOID'
           ELSE 'UNKNOWN'
       END as type_name,
       COUNT(*) as system_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM SYSTEMS), 2) as percentage
FROM SYSTEMS s
GROUP BY s.TYPE
ORDER BY system_count DESC;
```

```sql
-- Systems by faction ownership
SELECT s.OWNER_FACTION,
       CASE 
           WHEN s.OWNER_FACTION = 0 THEN 'UNCLAIMED'
           WHEN s.OWNER_FACTION = -10000000 THEN 'NPC_TRADING_GUILD'
           WHEN s.OWNER_FACTION = -9999999 THEN 'NPC_OUTCASTS'
           WHEN s.OWNER_FACTION = -9999998 THEN 'NPC_SCAVENGERS'
           WHEN s.OWNER_FACTION > 0 THEN 'PLAYER_FACTION_' || s.OWNER_FACTION
           ELSE 'UNKNOWN'
       END as faction_type,
       COUNT(*) as controlled_systems,
       COUNT(CASE WHEN s.TYPE IN (1, 2, 3) THEN 1 END) as high_value_systems
FROM SYSTEMS s
GROUP BY s.OWNER_FACTION
ORDER BY controlled_systems DESC;
```

---

## Territorial Analysis

### Galaxy control and faction territories
```sql
-- Comprehensive faction territory analysis
SELECT s.OWNER_FACTION,
       COUNT(*) as total_systems,
       COUNT(CASE WHEN s.TYPE = 0 THEN 1 END) as sun_systems,
       COUNT(CASE WHEN s.TYPE = 1 THEN 1 END) as giant_systems,
       COUNT(CASE WHEN s.TYPE = 2 THEN 1 END) as black_hole_systems,
       COUNT(CASE WHEN s.TYPE = 3 THEN 1 END) as binary_systems,
       COUNT(CASE WHEN s.TYPE = 4 THEN 1 END) as void_systems,
       AVG(SQRT(POWER(s.X, 2) + POWER(s.Y, 2) + POWER(s.Z, 2))) as avg_distance_from_center
FROM SYSTEMS s
WHERE s.OWNER_FACTION != 0
GROUP BY s.OWNER_FACTION
ORDER BY total_systems DESC;
```

```sql
-- Find faction borders and contested regions
SELECT s1.X, s1.Y, s1.Z, s1.OWNER_FACTION as faction1,
       s2.X, s2.Y, s2.Z, s2.OWNER_FACTION as faction2,
       SQRT(POWER(s2.X - s1.X, 2) + POWER(s2.Y - s1.Y, 2) + POWER(s2.Z - s1.Z, 2)) as distance
FROM SYSTEMS s1
JOIN SYSTEMS s2 ON s1.ID < s2.ID
WHERE s1.OWNER_FACTION != s2.OWNER_FACTION
  AND s1.OWNER_FACTION > 0 AND s2.OWNER_FACTION > 0
  AND ABS(s1.X - s2.X) <= 1
  AND ABS(s1.Y - s2.Y) <= 1
  AND ABS(s1.Z - s2.Z) <= 1
ORDER BY distance;
```

```sql
-- Central galaxy control analysis
WITH galaxy_center AS (
    SELECT AVG(CAST(s.X AS DOUBLE)) as center_x,
           AVG(CAST(s.Y AS DOUBLE)) as center_y,
           AVG(CAST(s.Z AS DOUBLE)) as center_z
    FROM SYSTEMS s
),
central_systems AS (
    SELECT s.*,
           SQRT(POWER(s.X - gc.center_x, 2) + POWER(s.Y - gc.center_y, 2) + POWER(s.Z - gc.center_z, 2)) as distance_from_center
    FROM SYSTEMS s
    CROSS JOIN galaxy_center gc
    WHERE SQRT(POWER(s.X - gc.center_x, 2) + POWER(s.Y - gc.center_y, 2) + POWER(s.Z - gc.center_z, 2)) <= 5
)
SELECT cs.OWNER_FACTION,
       COUNT(*) as central_systems_controlled,
       AVG(cs.distance_from_center) as avg_central_distance,
       COUNT(CASE WHEN cs.TYPE IN (1, 2, 3) THEN 1 END) as high_value_central_systems
FROM central_systems cs
WHERE cs.OWNER_FACTION > 0
GROUP BY cs.OWNER_FACTION
ORDER BY central_systems_controlled DESC;
```

### Strategic system identification
```sql
-- Find strategic chokepoints (systems with many neighbors)
WITH system_neighbors AS (
    SELECT s1.ID, s1.X, s1.Y, s1.Z, s1.OWNER_FACTION,
           COUNT(s2.ID) as neighbor_count
    FROM SYSTEMS s1
    JOIN SYSTEMS s2 ON s1.ID != s2.ID
    WHERE ABS(s1.X - s2.X) <= 1
      AND ABS(s1.Y - s2.Y) <= 1
      AND ABS(s1.Z - s2.Z) <= 1
    GROUP BY s1.ID, s1.X, s1.Y, s1.Z, s1.OWNER_FACTION
)
SELECT sn.X, sn.Y, sn.Z, sn.OWNER_FACTION, sn.neighbor_count,
       CASE 
           WHEN sn.OWNER_FACTION = 0 THEN 'STRATEGIC_UNCLAIMED'
           ELSE 'STRATEGIC_CONTROLLED'
       END as strategic_status
FROM system_neighbors sn
WHERE sn.neighbor_count > 6
ORDER BY sn.neighbor_count DESC, sn.OWNER_FACTION;
```

```sql
-- Identify expansion opportunities
SELECT s.X, s.Y, s.Z, s.TYPE, s.OWNER_FACTION,
       COUNT(ns.ID) as claimed_neighbors,
       COUNT(CASE WHEN ns.OWNER_FACTION = s.OWNER_FACTION THEN 1 END) as friendly_neighbors,
       COUNT(CASE WHEN ns.OWNER_FACTION != s.OWNER_FACTION AND ns.OWNER_FACTION > 0 THEN 1 END) as hostile_neighbors
FROM SYSTEMS s
JOIN SYSTEMS ns ON ABS(s.X - ns.X) <= 1 AND ABS(s.Y - ns.Y) <= 1 AND ABS(s.Z - ns.Z) <= 1 AND s.ID != ns.ID
WHERE s.OWNER_FACTION = 0  -- Unclaimed systems
GROUP BY s.X, s.Y, s.Z, s.TYPE, s.OWNER_FACTION
HAVING claimed_neighbors > 0
ORDER BY hostile_neighbors DESC, claimed_neighbors DESC;
```

---

## Resource Analysis

### System resource evaluation
```sql
-- Analyze resource richness across systems
-- Note: RESOURCES is binary data, so we'll analyze patterns and sizes
SELECT s.TYPE,
       CASE s.TYPE
           WHEN 0 THEN 'SUN'
           WHEN 1 THEN 'GIANT'
           WHEN 2 THEN 'BLACK_HOLE'
           WHEN 3 THEN 'DOUBLE_STAR'
           WHEN 4 THEN 'VOID'
           ELSE 'UNKNOWN'
       END as type_name,
       COUNT(*) as system_count,
       AVG(LENGTH(s.RESOURCES)) as avg_resource_data_size,
       COUNT(CASE WHEN LENGTH(s.RESOURCES) = 16 THEN 1 END) as standard_resource_systems,
       COUNT(CASE WHEN s.OWNER_FACTION > 0 THEN 1 END) as claimed_systems
FROM SYSTEMS s
GROUP BY s.TYPE
ORDER BY system_count DESC;
```

```sql
-- Resource data integrity analysis
SELECT 
    'RESOURCE_DATA_ANALYSIS' as metric_type,
    COUNT(*) as total_systems,
    COUNT(CASE WHEN s.RESOURCES IS NOT NULL THEN 1 END) as systems_with_resources,
    COUNT(CASE WHEN LENGTH(s.RESOURCES) = 16 THEN 1 END) as systems_with_standard_resources,
    COUNT(CASE WHEN LENGTH(s.RESOURCES) != 16 THEN 1 END) as systems_with_unusual_resources,
    AVG(LENGTH(s.RESOURCES)) as avg_resource_data_size,
    MIN(LENGTH(s.RESOURCES)) as min_resource_data_size,
    MAX(LENGTH(s.RESOURCES)) as max_resource_data_size
FROM SYSTEMS s;
```

```sql
-- High-value resource systems (by controlling faction)
WITH resource_systems AS (
    SELECT s.*,
           CASE 
               WHEN s.TYPE IN (1, 2) THEN 'HIGH_VALUE'
               WHEN s.TYPE = 3 THEN 'STRATEGIC'
               WHEN s.TYPE = 0 THEN 'STANDARD'
               WHEN s.TYPE = 4 THEN 'MINIMAL'
               ELSE 'UNKNOWN'
           END as resource_category
    FROM SYSTEMS s
    WHERE LENGTH(s.RESOURCES) = 16  -- Standard resource data
)
SELECT rs.resource_category,
       rs.OWNER_FACTION,
       COUNT(*) as system_count,
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage_of_total
FROM resource_systems rs
GROUP BY rs.resource_category, rs.OWNER_FACTION
ORDER BY rs.resource_category, system_count DESC;
```

### System generation and timeline analysis
```sql
-- System generation timeline analysis
SELECT 
    CASE 
        WHEN s.STARTTIME IS NULL THEN 'PRE_GENERATED'
        WHEN s.STARTTIME < 1000000000000 THEN 'INVALID_TIMESTAMP'  -- Before year 2001
        ELSE 'GENERATED'
    END as generation_status,
    COUNT(*) as system_count,
    MIN(s.STARTTIME) as earliest_generation,
    MAX(s.STARTTIME) as latest_generation,
    AVG(s.STARTTIME) as avg_generation_time
FROM SYSTEMS s
GROUP BY 
    CASE 
        WHEN s.STARTTIME IS NULL THEN 'PRE_GENERATED'
        WHEN s.STARTTIME < 1000000000000 THEN 'INVALID_TIMESTAMP'
        ELSE 'GENERATED'
    END
ORDER BY system_count DESC;
```

```sql
-- Recently generated systems
SELECT s.X, s.Y, s.Z, s.TYPE, s.NAME, s.STARTTIME,
       CASE s.TYPE
           WHEN 0 THEN 'SUN'
           WHEN 1 THEN 'GIANT'
           WHEN 2 THEN 'BLACK_HOLE'
           WHEN 3 THEN 'DOUBLE_STAR'
           WHEN 4 THEN 'VOID'
           ELSE 'UNKNOWN'
       END as type_name
FROM SYSTEMS s
WHERE s.STARTTIME IS NOT NULL
  AND s.STARTTIME > (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000 - 86400000)  -- Last 24 hours
ORDER BY s.STARTTIME DESC;
```

---

## Galaxy Structure Analysis

### Galaxy shape and distribution
```sql
-- Galaxy boundaries and structure
SELECT 
    'GALAXY_STRUCTURE' as analysis_type,
    MIN(s.X) as min_x, MAX(s.X) as max_x,
    MIN(s.Y) as min_y, MAX(s.Y) as max_y,
    MIN(s.Z) as min_z, MAX(s.Z) as max_z,
    (MAX(s.X) - MIN(s.X) + 1) as galaxy_width,
    (MAX(s.Y) - MIN(s.Y) + 1) as galaxy_height,
    (MAX(s.Z) - MIN(s.Z) + 1) as galaxy_depth,
    COUNT(*) as total_systems,
    COUNT(DISTINCT s.X) as unique_x_positions,
    COUNT(DISTINCT s.Y) as unique_y_positions,
    COUNT(DISTINCT s.Z) as unique_z_positions
FROM SYSTEMS s;
```

```sql
-- System density by galaxy region
WITH galaxy_regions AS (
    SELECT s.*,
           CASE 
               WHEN ABS(s.X) <= 5 AND ABS(s.Y) <= 5 AND ABS(s.Z) <= 5 THEN 'CORE'
               WHEN ABS(s.X) <= 10 AND ABS(s.Y) <= 10 AND ABS(s.Z) <= 10 THEN 'INNER'
               WHEN ABS(s.X) <= 15 AND ABS(s.Y) <= 15 AND ABS(s.Z) <= 15 THEN 'MIDDLE'
               ELSE 'OUTER'
           END as galaxy_region,
           SQRT(POWER(s.X, 2) + POWER(s.Y, 2) + POWER(s.Z, 2)) as distance_from_center
    FROM SYSTEMS s
)
SELECT gr.galaxy_region,
       COUNT(*) as system_count,
       COUNT(CASE WHEN gr.OWNER_FACTION > 0 THEN 1 END) as claimed_systems,
       COUNT(CASE WHEN gr.TYPE IN (1, 2, 3) THEN 1 END) as high_value_systems,
       AVG(gr.distance_from_center) as avg_distance_from_center,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM SYSTEMS), 2) as percentage_of_galaxy
FROM galaxy_regions gr
GROUP BY gr.galaxy_region
ORDER BY 
    CASE gr.galaxy_region 
        WHEN 'CORE' THEN 1 
        WHEN 'INNER' THEN 2 
        WHEN 'MIDDLE' THEN 3 
        WHEN 'OUTER' THEN 4 
    END;
```

```sql
-- System type distribution by distance from galaxy center
WITH distance_analysis AS (
    SELECT s.*,
           SQRT(POWER(s.X, 2) + POWER(s.Y, 2) + POWER(s.Z, 2)) as distance_from_center,
           CASE 
               WHEN SQRT(POWER(s.X, 2) + POWER(s.Y, 2) + POWER(s.Z, 2)) <= 5 THEN 'VERY_CLOSE'
               WHEN SQRT(POWER(s.X, 2) + POWER(s.Y, 2) + POWER(s.Z, 2)) <= 10 THEN 'CLOSE'
               WHEN SQRT(POWER(s.X, 2) + POWER(s.Y, 2) + POWER(s.Z, 2)) <= 15 THEN 'MEDIUM'
               ELSE 'FAR'
           END as distance_category
    FROM SYSTEMS s
)
SELECT da.distance_category,
       da.TYPE,
       CASE da.TYPE
           WHEN 0 THEN 'SUN'
           WHEN 1 THEN 'GIANT'
           WHEN 2 THEN 'BLACK_HOLE'
           WHEN 3 THEN 'DOUBLE_STAR'
           WHEN 4 THEN 'VOID'
       END as type_name,
       COUNT(*) as system_count,
       AVG(da.distance_from_center) as avg_distance
FROM distance_analysis da
GROUP BY da.distance_category, da.TYPE
ORDER BY da.distance_category, system_count DESC;
```

---

## Advanced System Analytics

### Owner pattern analysis
```sql
-- Analyze owner UID patterns
WITH owner_patterns AS (
    SELECT s.*,
           CASE 
               WHEN s.OWNER_UID IS NULL THEN 'NO_OWNER'
               WHEN s.OWNER_UID LIKE 'NPC-HOMEBASE_%' THEN 'NPC_HOMEBASE'
               WHEN s.OWNER_UID LIKE 'NPC-SYSTEMBASE_%' THEN 'NPC_SYSTEMBASE'
               ELSE 'PLAYER_ENTITY'
           END as owner_type,
           -- Extract coordinates from NPC patterns
           CASE 
               WHEN s.OWNER_UID LIKE 'NPC-%'
               THEN SUBSTRING(s.OWNER_UID FROM POSITION('_' IN s.OWNER_UID) + 1)
               ELSE NULL
           END as extracted_coords
    FROM SYSTEMS s
)
SELECT op.owner_type,
       COUNT(*) as system_count,
       COUNT(CASE WHEN op.OWNER_FACTION > 0 THEN 1 END) as player_faction_systems,
       COUNT(CASE WHEN op.OWNER_FACTION < 0 THEN 1 END) as NPC_faction_systems,
       COUNT(CASE WHEN op.TYPE IN (1, 2, 3) THEN 1 END) as high_value_systems
FROM owner_patterns op
GROUP BY op.owner_type
ORDER BY system_count DESC;
```

```sql
-- Home coordinate analysis
SELECT 
    'HOME_COORDINATE_ANALYSIS' as analysis_type,
    COUNT(*) as total_systems,
    COUNT(CASE WHEN s.OWNER_X = 0 AND s.OWNER_Y = 0 AND s.OWNER_Z = 0 THEN 1 END) as center_homes,
    COUNT(CASE WHEN ABS(s.OWNER_X) <= 5 AND ABS(s.OWNER_Y) <= 5 AND ABS(s.OWNER_Z) <= 5 THEN 1 END) as close_homes,
    AVG(ABS(s.OWNER_X)) as avg_home_x_distance,
    AVG(ABS(s.OWNER_Y)) as avg_home_y_distance,
    AVG(ABS(s.OWNER_Z)) as avg_home_z_distance,
    MAX(ABS(s.OWNER_X)) as max_home_x_distance,
    MAX(ABS(s.OWNER_Y)) as max_home_y_distance,
    MAX(ABS(s.OWNER_Z)) as max_home_z_distance
FROM SYSTEMS s
WHERE s.OWNER_FACTION > 0;
```

### System clustering analysis
```sql
-- Find system clusters and isolated systems
WITH system_connectivity AS (
    SELECT s1.ID, s1.X, s1.Y, s1.Z, s1.TYPE, s1.OWNER_FACTION,
           COUNT(s2.ID) as neighbor_count,
           COUNT(CASE WHEN s2.OWNER_FACTION = s1.OWNER_FACTION AND s1.OWNER_FACTION > 0 THEN 1 END) as friendly_neighbors,
           COUNT(CASE WHEN s2.OWNER_FACTION != s1.OWNER_FACTION AND s2.OWNER_FACTION > 0 THEN 1 END) as hostile_neighbors
    FROM SYSTEMS s1
    LEFT JOIN SYSTEMS s2 ON s1.ID != s2.ID
        AND ABS(s1.X - s2.X) <= 1
        AND ABS(s1.Y - s2.Y) <= 1
        AND ABS(s1.Z - s2.Z) <= 1
    GROUP BY s1.ID, s1.X, s1.Y, s1.Z, s1.TYPE, s1.OWNER_FACTION
)
SELECT 
    CASE 
        WHEN sc.neighbor_count = 0 THEN 'ISOLATED'
        WHEN sc.neighbor_count BETWEEN 1 AND 3 THEN 'SPARSE'
        WHEN sc.neighbor_count BETWEEN 4 AND 8 THEN 'CONNECTED'
        WHEN sc.neighbor_count > 8 THEN 'DENSE'
    END as connectivity_level,
    COUNT(*) as system_count,
    AVG(sc.neighbor_count) as avg_neighbors,
    AVG(sc.friendly_neighbors) as avg_friendly_neighbors,
    AVG(sc.hostile_neighbors) as avg_hostile_neighbors
FROM system_connectivity sc
GROUP BY 
    CASE 
        WHEN sc.neighbor_count = 0 THEN 'ISOLATED'
        WHEN sc.neighbor_count BETWEEN 1 AND 3 THEN 'SPARSE'
        WHEN sc.neighbor_count BETWEEN 4 AND 8 THEN 'CONNECTED'
        WHEN sc.neighbor_count > 8 THEN 'DENSE'
    END
ORDER BY system_count DESC;
```

---

## Data Management and Maintenance

### System data validation
```sql
-- Comprehensive system data validation
WITH validation_checks AS (
    -- Check 1: Invalid coordinates (NULL values)
    SELECT 'NULL_COORDINATES' as check_type, COUNT(*) as issues
    FROM SYSTEMS s
    WHERE s.X IS NULL OR s.Y IS NULL OR s.Z IS NULL
    
    UNION ALL
    
    -- Check 2: Invalid TYPE values
    SELECT 'INVALID_TYPE' as check_type, COUNT(*) as issues
    FROM SYSTEMS s
    WHERE s.TYPE NOT IN (0, 1, 2, 3, 4)
    
    UNION ALL
    
    -- Check 3: Invalid OWNER_FACTION values
    SELECT 'INVALID_OWNER_FACTION' as check_type, COUNT(*) as issues
    FROM SYSTEMS s
    WHERE s.OWNER_FACTION IS NULL
    
    UNION ALL
    
    -- Check 4: Inconsistent owner data
    SELECT 'INCONSISTENT_OWNER_DATA' as check_type, COUNT(*) as issues
    FROM SYSTEMS s
    WHERE (s.OWNER_UID IS NOT NULL AND s.OWNER_FACTION = 0)
       OR (s.OWNER_UID IS NULL AND s.OWNER_FACTION > 0)
    
    UNION ALL
    
    -- Check 5: Invalid resource data
    SELECT 'INVALID_RESOURCES' as check_type, COUNT(*) as issues
    FROM SYSTEMS s
    WHERE s.RESOURCES IS NULL OR LENGTH(s.RESOURCES) != 16
    
    UNION ALL
    
    -- Check 6: Duplicate coordinates
    SELECT 'DUPLICATE_COORDINATES' as check_type, COUNT(*) - COUNT(DISTINCT s.X || ',' || s.Y || ',' || s.Z) as issues
    FROM SYSTEMS s
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
-- System maintenance operations
UPDATE SYSTEMS 
SET OWNER_FACTION = 0 
WHERE OWNER_FACTION IS NULL;
```

```sql
-- Performance summary after maintenance
SELECT 
    'SYSTEM_MAINTENANCE_SUMMARY' as operation,
    COUNT(*) as total_systems,
    COUNT(CASE WHEN OWNER_FACTION > 0 THEN 1 END) as player_controlled_systems,
    COUNT(CASE WHEN OWNER_FACTION < 0 THEN 1 END) as NPC_controlled_systems,
    COUNT(CASE WHEN OWNER_FACTION = 0 THEN 1 END) as unclaimed_systems,
    COUNT(CASE WHEN TYPE IN (1, 2, 3) THEN 1 END) as high_value_systems,
    COUNT(DISTINCT TYPE) as unique_system_types
FROM SYSTEMS;
```

---

## Reporting and Statistics

### Comprehensive galaxy report
```sql
-- Complete galaxy statistics report
SELECT 
    'GALAXY_COMPREHENSIVE_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    COUNT(*) as total_systems,
    COUNT(DISTINCT TYPE) as unique_system_types,
    COUNT(CASE WHEN OWNER_FACTION > 0 THEN 1 END) as player_controlled_systems,
    COUNT(CASE WHEN OWNER_FACTION < 0 THEN 1 END) as NPC_controlled_systems,
    COUNT(CASE WHEN OWNER_FACTION = 0 THEN 1 END) as unclaimed_systems,
    MIN(X) as galaxy_min_x, MAX(X) as galaxy_max_x,
    MIN(Y) as galaxy_min_y, MAX(Y) as galaxy_max_y,
    MIN(Z) as galaxy_min_z, MAX(Z) as galaxy_max_z,
    COUNT(CASE WHEN TYPE IN (1, 2, 3) THEN 1 END) as strategic_systems,
    AVG(CASE WHEN STARTTIME IS NOT NULL THEN STARTTIME END) as avg_generation_time
FROM SYSTEMS;
```

```sql
-- Faction power ranking
SELECT s.OWNER_FACTION,
       COUNT(*) as controlled_systems,
       COUNT(CASE WHEN s.TYPE = 0 THEN 1 END) as sun_systems,
       COUNT(CASE WHEN s.TYPE = 1 THEN 1 END) as giant_systems,
       COUNT(CASE WHEN s.TYPE = 2 THEN 1 END) as black_hole_systems,
       COUNT(CASE WHEN s.TYPE = 3 THEN 1 END) as binary_systems,
       COUNT(CASE WHEN s.TYPE = 4 THEN 1 END) as void_systems,
       STRING_AGG(DISTINCT s.OWNER_UID, ', ') as control_bases
FROM SYSTEMS s
WHERE s.OWNER_FACTION > 0
GROUP BY s.OWNER_FACTION
ORDER BY controlled_systems DESC, giant_systems + black_hole_systems + binary_systems DESC
LIMIT 20;
```

---

## Changelog

| Version | Date       | Author       | Description                                      |
|---------|------------|--------------|--------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of SYSTEMS example queries     |

[INDEX](./INDEX.md) | [SYSTEMS](./TABLE_SYSTEMS.md)