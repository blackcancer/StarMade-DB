# SECTORS - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) 2.3.4 database. **All queries focus exclusively on the SECTORS table.**

---

## Basic Sector Queries

### Find sectors by coordinates and type
```sql
-- Search sectors by specific coordinates
SELECT s.ID, s.X, s.Y, s.Z, s.TYPE, s.NAME, s.PROTECTION
FROM SECTORS s
WHERE s.X = ? AND s.Y = ? AND s.Z = ?;
```

```sql
-- Find sectors within coordinate range
SELECT s.ID, s.X, s.Y, s.Z, s.TYPE, s.NAME, s.PROTECTION, s.STELLAR
FROM SECTORS s
WHERE s.X BETWEEN ? AND ?
  AND s.Y BETWEEN ? AND ?
  AND s.Z BETWEEN ? AND ?
ORDER BY s.X, s.Y, s.Z;
```

```sql
-- Search sectors by type with descriptive names
SELECT s.X, s.Y, s.Z, s.NAME,
       CASE s.TYPE
           WHEN 0 THEN 'STAR'
           WHEN 1 THEN 'EMPTY_SPACE'
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
       s.PROTECTION
FROM SECTORS s
WHERE s.TYPE = 2  -- Planets only
ORDER BY s.X, s.Y, s.Z;
```

### Count sectors by type and protection
```sql
-- Distribution of sector types
SELECT s.TYPE,
       CASE s.TYPE
           WHEN 0 THEN 'STAR'
           WHEN 1 THEN 'EMPTY_SPACE'
           WHEN 2 THEN 'PLANET'
           WHEN 3 THEN 'STATION'
           WHEN 4 THEN 'ASTEROID_FIELD'
           WHEN 5 THEN 'NEBULA'
           WHEN 6 THEN 'WORMHOLE'
           WHEN 7 THEN 'TRADING_POST'
           WHEN 8 THEN 'PIRATE_BASE'
           WHEN 9 THEN 'DEBRIS_FIELD'
           ELSE 'UNKNOWN'
       END as type_name,
       COUNT(*) as sector_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM SECTORS), 2) as percentage
FROM SECTORS s
GROUP BY s.TYPE
ORDER BY sector_count DESC;
```

```sql
-- Sectors by protection level
SELECT s.PROTECTION,
       CASE 
           WHEN s.PROTECTION = 0 THEN 'UNPROTECTED'
           WHEN MOD(s.PROTECTION, 2) = 1 THEN 'PVP_PROTECTED'
           WHEN MOD(s.PROTECTION / 2, 2) = 1 THEN 'CREATIVE_MODE'
           WHEN MOD(s.PROTECTION / 4, 2) = 1 THEN 'BUILD_PROTECTED'
           WHEN MOD(s.PROTECTION / 8, 2) = 1 THEN 'FACTION_PROTECTED'
           WHEN MOD(s.PROTECTION / 16, 2) = 1 THEN 'PEACE_ZONE'
           WHEN MOD(s.PROTECTION / 32, 2) = 1 THEN 'ADMIN_PROTECTED'
           ELSE 'CUSTOM_PROTECTION'
       END as protection_type,
       COUNT(*) as sector_count
FROM SECTORS s
GROUP BY s.PROTECTION
ORDER BY sector_count DESC;
```

---

## Spatial Analysis

### Sector density and clustering
```sql
-- Analyze sector density in different regions
WITH sector_regions AS (
    SELECT 
        FLOOR(s.X / 10.0) * 10 as region_x,
        FLOOR(s.Y / 10.0) * 10 as region_y,
        FLOOR(s.Z / 10.0) * 10 as region_z,
        COUNT(*) as sector_count,
        COUNT(CASE WHEN s.TYPE = 2 THEN 1 END) as planet_count,
        COUNT(CASE WHEN s.TYPE = 3 THEN 1 END) as station_count,
        COUNT(CASE WHEN s.TYPE = 4 THEN 1 END) as asteroid_count,
        COUNT(CASE WHEN s.PROTECTION > 0 THEN 1 END) as protected_sectors
    FROM SECTORS s
    GROUP BY FLOOR(s.X / 10.0), FLOOR(s.Y / 10.0), FLOOR(s.Z / 10.0)
)
SELECT 
    sr.region_x || ' to ' || (sr.region_x + 9) as x_range,
    sr.region_y || ' to ' || (sr.region_y + 9) as y_range,
    sr.region_z || ' to ' || (sr.region_z + 9) as z_range,
    sr.sector_count,
    sr.planet_count,
    sr.station_count,
    sr.asteroid_count,
    sr.protected_sectors,
    CASE 
        WHEN sr.sector_count >= 50 THEN 'HIGH_DENSITY'
        WHEN sr.sector_count >= 20 THEN 'MEDIUM_DENSITY'
        WHEN sr.sector_count >= 5 THEN 'LOW_DENSITY'
        ELSE 'SPARSE'
    END as density_category
FROM sector_regions sr
WHERE sr.sector_count > 0
ORDER BY sr.sector_count DESC
LIMIT 20;
```

### Find empty regions for expansion
```sql
-- Identify sparse regions suitable for colonization
WITH coordinate_ranges AS (
    SELECT 
        MIN(s.X) as min_x, MAX(s.X) as max_x,
        MIN(s.Y) as min_y, MAX(s.Y) as max_y,
        MIN(s.Z) as min_z, MAX(s.Z) as max_z
    FROM SECTORS s
),
potential_regions AS (
    SELECT 
        x.region_x,
        y.region_y,
        z.region_z
    FROM (SELECT DISTINCT FLOOR(X / 10.0) * 10 as region_x FROM SECTORS) x
    CROSS JOIN (SELECT DISTINCT FLOOR(Y / 10.0) * 10 as region_y FROM SECTORS) y
    CROSS JOIN (SELECT DISTINCT FLOOR(Z / 10.0) * 10 as region_z FROM SECTORS) z
),
existing_sectors AS (
    SELECT 
        FLOOR(s.X / 10.0) * 10 as region_x,
        FLOOR(s.Y / 10.0) * 10 as region_y,
        FLOOR(s.Z / 10.0) * 10 as region_z,
        COUNT(*) as sector_count
    FROM SECTORS s
    GROUP BY FLOOR(s.X / 10.0), FLOOR(s.Y / 10.0), FLOOR(s.Z / 10.0)
)
SELECT 
    pr.region_x || ' to ' || (pr.region_x + 9) as x_range,
    pr.region_y || ' to ' || (pr.region_y + 9) as y_range,
    pr.region_z || ' to ' || (pr.region_z + 9) as z_range,
    COALESCE(es.sector_count, 0) as existing_sectors,
    SQRT(POWER(pr.region_x, 2) + POWER(pr.region_y, 2) + POWER(pr.region_z, 2)) as distance_from_origin
FROM potential_regions pr
LEFT JOIN existing_sectors es 
    ON pr.region_x = es.region_x 
    AND pr.region_y = es.region_y 
    AND pr.region_z = es.region_z
WHERE COALESCE(es.sector_count, 0) < 5  -- Regions with few sectors
ORDER BY distance_from_origin
LIMIT 20;
```

---

## System-Sector Relationships

### Sectors by system
```sql
-- Count sectors per system
SELECT s.STELLAR as system_id,
       COUNT(*) as sector_count,
       COUNT(CASE WHEN s.TYPE = 0 THEN 1 END) as star_sectors,
       COUNT(CASE WHEN s.TYPE = 2 THEN 1 END) as planet_sectors,
       COUNT(CASE WHEN s.TYPE = 3 THEN 1 END) as station_sectors,
       COUNT(CASE WHEN s.TYPE = 4 THEN 1 END) as asteroid_sectors,
       COUNT(CASE WHEN s.PROTECTION > 0 THEN 1 END) as protected_sectors,
       COUNT(CASE WHEN s.TRANSIENT = FALSE THEN 1 END) as persistent_sectors
FROM SECTORS s
GROUP BY s.STELLAR
ORDER BY sector_count DESC;
```

### Find isolated systems
```sql
-- Systems with unusual sector compositions
WITH system_composition AS (
    SELECT 
        s.STELLAR,
        COUNT(*) as total_sectors,
        COUNT(CASE WHEN s.TYPE = 0 THEN 1 END) as stars,
        COUNT(CASE WHEN s.TYPE = 2 THEN 1 END) as planets,
        COUNT(CASE WHEN s.TYPE = 3 THEN 1 END) as stations,
        COUNT(CASE WHEN s.TYPE = 4 THEN 1 END) as asteroids,
        COUNT(CASE WHEN s.TYPE = 6 THEN 1 END) as wormholes,
        COUNT(DISTINCT s.NAME) as unique_names
    FROM SECTORS s
    GROUP BY s.STELLAR
)
SELECT 
    sc.STELLAR as system_id,
    sc.total_sectors,
    sc.stars,
    sc.planets,
    sc.stations,
    sc.asteroids,
    sc.wormholes,
    CASE 
        WHEN sc.stars = 0 THEN 'STARLESS_SYSTEM'
        WHEN sc.planets = 0 AND sc.asteroids = 0 THEN 'BARREN_SYSTEM'
        WHEN sc.stations = 0 THEN 'UNINHABITED_SYSTEM'
        WHEN sc.wormholes > 0 THEN 'GATEWAY_SYSTEM'
        WHEN sc.planets >= 5 THEN 'PLANET_RICH'
        WHEN sc.asteroids >= 20 THEN 'MINING_SYSTEM'
        WHEN sc.stations >= 10 THEN 'DEVELOPED_SYSTEM'
        ELSE 'STANDARD_SYSTEM'
    END as system_type,
    sc.unique_names
FROM system_composition sc
ORDER BY sc.total_sectors DESC;
```

---

## Protection Analysis

### Protected sectors distribution
```sql
-- Analyze protection patterns
WITH protection_breakdown AS (
    SELECT 
        s.ID, s.X, s.Y, s.Z, s.NAME, s.TYPE, s.PROTECTION,
        CASE WHEN MOD(s.PROTECTION, 2) = 1 THEN 1 ELSE 0 END as pvp_protected,
        CASE WHEN MOD(s.PROTECTION / 2, 2) = 1 THEN 1 ELSE 0 END as creative_mode,
        CASE WHEN MOD(s.PROTECTION / 4, 2) = 1 THEN 1 ELSE 0 END as build_protected,
        CASE WHEN MOD(s.PROTECTION / 8, 2) = 1 THEN 1 ELSE 0 END as faction_protected,
        CASE WHEN MOD(s.PROTECTION / 16, 2) = 1 THEN 1 ELSE 0 END as peace_zone,
        CASE WHEN MOD(s.PROTECTION / 32, 2) = 1 THEN 1 ELSE 0 END as admin_protected
    FROM SECTORS s
    WHERE s.PROTECTION > 0
)
SELECT 
    COUNT(*) as protected_sectors,
    SUM(pb.pvp_protected) as pvp_protected_count,
    SUM(pb.creative_mode) as creative_mode_count,
    SUM(pb.build_protected) as build_protected_count,
    SUM(pb.faction_protected) as faction_protected_count,
    SUM(pb.peace_zone) as peace_zone_count,
    SUM(pb.admin_protected) as admin_protected_count,
    COUNT(CASE WHEN pb.PROTECTION = 63 THEN 1 END) as fully_protected_count
FROM protection_breakdown pb;
```

### Find protected zones
```sql
-- Locate protected sector clusters
WITH protected_clusters AS (
    SELECT 
        s1.X, s1.Y, s1.Z, s1.NAME as center_name, s1.PROTECTION,
        COUNT(DISTINCT s2.ID) as nearby_protected_sectors
    FROM SECTORS s1
    JOIN SECTORS s2 ON 
        ABS(s2.X - s1.X) <= 2 AND 
        ABS(s2.Y - s1.Y) <= 2 AND 
        ABS(s2.Z - s1.Z) <= 2 AND
        s2.PROTECTION > 0
    WHERE s1.PROTECTION > 0
    GROUP BY s1.X, s1.Y, s1.Z, s1.NAME, s1.PROTECTION
    HAVING COUNT(DISTINCT s2.ID) >= 3
)
SELECT 
    pc.X, pc.Y, pc.Z, pc.center_name,
    pc.PROTECTION,
    pc.nearby_protected_sectors,
    CASE 
        WHEN pc.nearby_protected_sectors >= 10 THEN 'MAJOR_SAFE_ZONE'
        WHEN pc.nearby_protected_sectors >= 5 THEN 'SAFE_ZONE'
        ELSE 'PROTECTED_CLUSTER'
    END as zone_type
FROM protected_clusters pc
ORDER BY pc.nearby_protected_sectors DESC
LIMIT 20;
```

---

## Resource Management

### Resource replenishment tracking
```sql
-- Sectors requiring resource replenishment
SELECT s.ID, s.X, s.Y, s.Z, s.NAME, s.TYPE,
       s.LAST_REPLENISHED,
       CASE 
           WHEN s.LAST_REPLENISHED = 0 THEN 'NEVER_REPLENISHED'
           WHEN s.LAST_REPLENISHED < (UNIX_TIMESTAMP() - 86400) * 1000 THEN 'NEEDS_REPLENISHMENT'
           WHEN s.LAST_REPLENISHED < (UNIX_TIMESTAMP() - 3600) * 1000 THEN 'RECENTLY_DEPLETED'
           ELSE 'RECENTLY_REPLENISHED'
       END as replenishment_status,
       CASE s.TYPE
           WHEN 4 THEN 'ASTEROID_FIELD'
           WHEN 5 THEN 'NEBULA'
           ELSE 'OTHER'
       END as resource_type
FROM SECTORS s
WHERE s.TYPE IN (4, 5)  -- Resource-bearing sectors
ORDER BY s.LAST_REPLENISHED;
```

### Resource sector optimization
```sql
-- Find optimal mining locations
WITH resource_analysis AS (
    SELECT 
        s.X, s.Y, s.Z, s.NAME, s.TYPE, s.PROTECTION,
        SQRT(POWER(s.X, 2) + POWER(s.Y, 2) + POWER(s.Z, 2)) as distance_from_origin,
        CASE 
            WHEN s.TYPE = 4 THEN 'ASTEROID'
            WHEN s.TYPE = 5 THEN 'NEBULA'
            ELSE 'OTHER'
        END as resource_type,
        CASE 
            WHEN s.PROTECTION = 0 THEN 'UNPROTECTED'
            WHEN s.PROTECTION > 0 THEN 'PROTECTED'
        END as access_status
    FROM SECTORS s
    WHERE s.TYPE IN (4, 5) AND s.TRANSIENT = FALSE
)
SELECT 
    ra.X, ra.Y, ra.Z, ra.NAME,
    ra.resource_type,
    ra.access_status,
    ROUND(ra.distance_from_origin, 2) as distance,
    CASE 
        WHEN ra.distance_from_origin <= 50 THEN 'CORE_REGION'
        WHEN ra.distance_from_origin <= 100 THEN 'MID_REGION'
        WHEN ra.distance_from_origin <= 200 THEN 'OUTER_REGION'
        ELSE 'FRONTIER'
    END as region_category
FROM resource_analysis ra
WHERE ra.access_status = 'UNPROTECTED'
ORDER BY ra.distance_from_origin
LIMIT 50;
```

---

## Data Validation and Maintenance

### Sector data integrity checks
```sql
-- Comprehensive data validation
WITH validation_checks AS (
    -- Check 1: Invalid coordinates (NULL or extreme values)
    SELECT 'INVALID_COORDINATES' as check_type, COUNT(*) as issues
    FROM SECTORS s
    WHERE s.X IS NULL OR s.Y IS NULL OR s.Z IS NULL
       OR ABS(s.X) > 1000000 OR ABS(s.Y) > 1000000 OR ABS(s.Z) > 1000000
    
    UNION ALL
    
    -- Check 2: Invalid TYPE values
    SELECT 'INVALID_TYPE' as check_type, COUNT(*) as issues
    FROM SECTORS s
    WHERE s.TYPE NOT IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9)
    
    UNION ALL
    
    -- Check 3: Missing or empty names
    SELECT 'MISSING_NAMES' as check_type, COUNT(*) as issues
    FROM SECTORS s
    WHERE s.NAME IS NULL OR TRIM(s.NAME) = ''
    
    UNION ALL
    
    -- Check 4: Invalid PROTECTION values (negative)
    SELECT 'INVALID_PROTECTION' as check_type, COUNT(*) as issues
    FROM SECTORS s
    WHERE s.PROTECTION < 0 OR s.PROTECTION > 63  -- Max valid bitwise combination
    
    UNION ALL
    
    -- Check 5: Invalid STELLAR references
    SELECT 'INVALID_STELLAR' as check_type, COUNT(*) as issues
    FROM SECTORS s
    WHERE s.STELLAR IS NULL
    
    UNION ALL
    
    -- Check 6: Duplicate coordinates
    SELECT 'DUPLICATE_COORDINATES' as check_type, COUNT(*) - COUNT(DISTINCT s.X || ',' || s.Y || ',' || s.Z) as issues
    FROM SECTORS s
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

### Sector maintenance operations
```sql
-- Clean up and standardize sector data
UPDATE SECTORS 
SET NAME = 'Unnamed Sector'
WHERE NAME IS NULL OR TRIM(NAME) = '';

-- Reset invalid protection values
UPDATE SECTORS 
SET PROTECTION = 0
WHERE PROTECTION < 0 OR PROTECTION > 63;

-- Update TRANSIENT status for important sectors
UPDATE SECTORS 
SET TRANSIENT = FALSE
WHERE TYPE IN (2, 3, 6)  -- Planets, stations, wormholes
OR PROTECTION > 0;       -- Protected sectors

-- Performance summary after maintenance
SELECT 
    'SECTOR_MAINTENANCE_SUMMARY' as operation,
    COUNT(*) as total_sectors,
    COUNT(CASE WHEN TRANSIENT = FALSE THEN 1 END) as persistent_sectors,
    COUNT(CASE WHEN PROTECTION > 0 THEN 1 END) as protected_sectors,
    COUNT(CASE WHEN NAME = 'Unnamed Sector' THEN 1 END) as unnamed_sectors,
    COUNT(DISTINCT STELLAR) as unique_systems,
    MIN(X) as min_x, MAX(X) as max_x,
    MIN(Y) as min_y, MAX(Y) as max_y,
    MIN(Z) as min_z, MAX(Z) as max_z
FROM SECTORS;
```

---

## Advanced Spatial Queries

### Find nearest neighbors
```sql
-- Find sectors near a specific location
WITH target_location AS (
    SELECT 0 as target_x, 0 as target_y, 0 as target_z
)
SELECT 
    s.X, s.Y, s.Z, s.NAME, s.TYPE,
    SQRT(POWER(s.X - tl.target_x, 2) + 
         POWER(s.Y - tl.target_y, 2) + 
         POWER(s.Z - tl.target_z, 2)) as distance,
    CASE s.TYPE
        WHEN 0 THEN 'STAR'
        WHEN 1 THEN 'EMPTY_SPACE'
        WHEN 2 THEN 'PLANET'
        WHEN 3 THEN 'STATION'
        WHEN 4 THEN 'ASTEROID_FIELD'
        WHEN 5 THEN 'NEBULA'
        WHEN 6 THEN 'WORMHOLE'
        WHEN 7 THEN 'TRADING_POST'
        WHEN 8 THEN 'PIRATE_BASE'
        WHEN 9 THEN 'DEBRIS_FIELD'
        ELSE 'UNKNOWN'
    END as sector_type
FROM SECTORS s, target_location tl
WHERE s.TYPE != 1  -- Exclude empty space
ORDER BY distance
LIMIT 20;
```

### Sector path analysis
```sql
-- Find sectors along a line between two points
WITH endpoints AS (
    SELECT 
        -50 as x1, -50 as y1, -50 as z1,  -- Start point
        50 as x2, 50 as y2, 50 as z2      -- End point
)
SELECT 
    s.X, s.Y, s.Z, s.NAME, s.TYPE,
    -- Calculate perpendicular distance to line
    SQRT(
        POWER((s.Y - ep.y1) * (ep.z2 - ep.z1) - (s.Z - ep.z1) * (ep.y2 - ep.y1), 2) +
        POWER((s.Z - ep.z1) * (ep.x2 - ep.x1) - (s.X - ep.x1) * (ep.z2 - ep.z1), 2) +
        POWER((s.X - ep.x1) * (ep.y2 - ep.y1) - (s.Y - ep.y1) * (ep.x2 - ep.x1), 2)
    ) / SQRT(
        POWER(ep.x2 - ep.x1, 2) + 
        POWER(ep.y2 - ep.y1, 2) + 
        POWER(ep.z2 - ep.z1, 2)
    ) as distance_from_path
FROM SECTORS s, endpoints ep
WHERE 
    -- Only sectors reasonably close to the line
    s.X BETWEEN LEAST(ep.x1, ep.x2) - 5 AND GREATEST(ep.x1, ep.x2) + 5
    AND s.Y BETWEEN LEAST(ep.y1, ep.y2) - 5 AND GREATEST(ep.y1, ep.y2) + 5
    AND s.Z BETWEEN LEAST(ep.z1, ep.z2) - 5 AND GREATEST(ep.z1, ep.z2) + 5
HAVING distance_from_path <= 5  -- Within 5 units of the path
ORDER BY 
    -- Order by position along the line
    ((s.X - ep.x1) * (ep.x2 - ep.x1) + 
     (s.Y - ep.y1) * (ep.y2 - ep.y1) + 
     (s.Z - ep.z1) * (ep.z2 - ep.z1));
```

---

## Changelog

| Version | Date       | Author       | Description                                          |
|---------|------------|--------------|------------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of SECTORS example queries          |

[INDEX](./INDEX.md) | [SECTORS](./TABLE_SECTORS.md)