# FTL - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) 2.3.4 database. **All queries focus exclusively on the FTL table.**

---

## Basic FTL Queries

### Find jump connections by coordinates and type
```sql
-- Search FTL connections by origin coordinates
SELECT f.ID, f.FROM_X, f.FROM_Y, f.FROM_Z, f.TO_X, f.TO_Y, f.TO_Z, 
       f.FROM_UID, f.TO_UID, f.TYPE, f.PERMISSION
FROM FTL f
WHERE f.FROM_X = ? AND f.FROM_Y = ? AND f.FROM_Z = ?;
```

```sql
-- Find connections by destination coordinates
SELECT f.ID, f.FROM_X, f.FROM_Y, f.FROM_Z, f.TO_X, f.TO_Y, f.TO_Z,
       f.FROM_UID, f.TO_UID, f.TYPE, f.PERMISSION
FROM FTL f
WHERE f.TO_X = ? AND f.TO_Y = ? AND f.TO_Z = ?
ORDER BY f.FROM_X, f.FROM_Y, f.FROM_Z;
```

```sql
-- Search connections by type with descriptive names
SELECT f.FROM_X, f.FROM_Y, f.FROM_Z, f.TO_X, f.TO_Y, f.TO_Z,
       CASE f.TYPE
           WHEN 0 THEN 'WARP_GATE'
           WHEN 1 THEN 'WORM_HOLE'
           WHEN 2 THEN 'RACE_WAY'
           ELSE 'UNKNOWN'
       END as connection_type,
       f.FROM_UID, f.TO_UID, f.PERMISSION
FROM FTL f
WHERE f.TYPE = 1  -- Wormholes only
ORDER BY f.FROM_X, f.FROM_Y, f.FROM_Z;
```

### Count connections by type and permission
```sql
-- Distribution of FTL connection types
SELECT f.TYPE,
       CASE f.TYPE
           WHEN 0 THEN 'WARP_GATE'
           WHEN 1 THEN 'WORM_HOLE'
           WHEN 2 THEN 'RACE_WAY'
           ELSE 'UNKNOWN'
       END as type_name,
       COUNT(*) as connection_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM FTL), 2) as percentage
FROM FTL f
GROUP BY f.TYPE
ORDER BY connection_count DESC;
```

```sql
-- Connections by permission level
SELECT f.PERMISSION,
       CASE 
           WHEN f.PERMISSION = 0 THEN 'OPEN_ACCESS'
           WHEN MOD(f.PERMISSION, 2) = 1 AND MOD(f.PERMISSION / 2, 2) = 1 THEN 'PEACE_ZONE'
           WHEN MOD(f.PERMISSION / 4, 2) = 1 THEN 'ENTRY_RESTRICTED'
           WHEN MOD(f.PERMISSION / 8, 2) = 1 THEN 'EXIT_BLOCKED'
           WHEN MOD(f.PERMISSION / 4, 2) = 1 AND MOD(f.PERMISSION / 8, 2) = 1 THEN 'FULLY_LOCKED'
           ELSE 'CUSTOM_PERMISSIONS'
       END as permission_type,
       COUNT(*) as connection_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM FTL), 2) as percentage
FROM FTL f
GROUP BY f.PERMISSION
ORDER BY connection_count DESC;
```

---

## Network Topology Analysis

### FTL network structure and connectivity
```sql
-- Comprehensive network connectivity analysis
WITH network_nodes AS (
    -- Get all unique sectors involved in FTL network
    SELECT DISTINCT f.FROM_X as X, f.FROM_Y as Y, f.FROM_Z as Z
    FROM FTL f
    UNION
    SELECT DISTINCT f.TO_X as X, f.TO_Y as Y, f.TO_Z as Z
    FROM FTL f
),
node_connections AS (
    SELECT 
        nn.X, nn.Y, nn.Z,
        COUNT(DISTINCT f_out.ID) as outgoing_connections,
        COUNT(DISTINCT f_in.ID) as incoming_connections,
        COUNT(DISTINCT f_out.ID) + COUNT(DISTINCT f_in.ID) as total_connections
    FROM network_nodes nn
    LEFT JOIN FTL f_out ON nn.X = f_out.FROM_X AND nn.Y = f_out.FROM_Y AND nn.Z = f_out.FROM_Z
    LEFT JOIN FTL f_in ON nn.X = f_in.TO_X AND nn.Y = f_in.TO_Y AND nn.Z = f_in.TO_Z
    GROUP BY nn.X, nn.Y, nn.Z
)
SELECT 
    nc.X, nc.Y, nc.Z,
    nc.outgoing_connections,
    nc.incoming_connections,
    nc.total_connections,
    SQRT(POWER(nc.X, 2) + POWER(nc.Y, 2) + POWER(nc.Z, 2)) as distance_from_origin,
    CASE 
        WHEN nc.total_connections >= 10 THEN 'MAJOR_HUB'
        WHEN nc.total_connections >= 5 THEN 'REGIONAL_HUB'
        WHEN nc.total_connections >= 3 THEN 'MINOR_HUB'
        WHEN nc.total_connections = 2 THEN 'TRANSIT_POINT'
        WHEN nc.total_connections = 1 THEN 'ENDPOINT'
        ELSE 'ISOLATED'
    END as node_type
FROM node_connections nc
ORDER BY nc.total_connections DESC, distance_from_origin
LIMIT 50;
```

### FTL route analysis
```sql
-- Analyze most used FTL routes and corridors
WITH route_usage AS (
    SELECT 
        f.FROM_X, f.FROM_Y, f.FROM_Z,
        f.TO_X, f.TO_Y, f.TO_Z,
        f.TYPE,
        COUNT(*) as duplicate_connections,
        GROUP_CONCAT(f.FROM_UID || '->' || f.TO_UID SEPARATOR ', ') as connection_details,
        MIN(f.PERMISSION) as most_open_permission,
        MAX(f.PERMISSION) as most_restricted_permission
    FROM FTL f
    GROUP BY f.FROM_X, f.FROM_Y, f.FROM_Z, f.TO_X, f.TO_Y, f.TO_Z, f.TYPE
),
route_characteristics AS (
    SELECT 
        ru.*,
        SQRT(POWER(ru.TO_X - ru.FROM_X, 2) + 
             POWER(ru.TO_Y - ru.FROM_Y, 2) + 
             POWER(ru.TO_Z - ru.FROM_Z, 2)) as jump_distance,
        CASE 
            WHEN ru.duplicate_connections > 1 THEN 'REDUNDANT_ROUTE'
            ELSE 'SINGLE_CONNECTION'
        END as route_redundancy,
        CASE ru.TYPE
            WHEN 0 THEN 'WARP_GATE'
            WHEN 1 THEN 'WORM_HOLE'
            WHEN 2 THEN 'RACE_WAY'
            ELSE 'UNKNOWN'
        END as connection_type
    FROM route_usage ru
)
SELECT 
    rc.FROM_X, rc.FROM_Y, rc.FROM_Z,
    rc.TO_X, rc.TO_Y, rc.TO_Z,
    rc.connection_type,
    rc.duplicate_connections,
    ROUND(rc.jump_distance, 2) as jump_distance,
    rc.route_redundancy,
    CASE 
        WHEN rc.most_open_permission = 0 THEN 'FULLY_OPEN'
        WHEN rc.most_restricted_permission = 0 THEN 'PARTIALLY_OPEN'
        ELSE 'RESTRICTED'
    END as access_level,
    rc.connection_details
FROM route_characteristics rc
ORDER BY rc.duplicate_connections DESC, rc.jump_distance DESC
LIMIT 50;
```

---

## Strategic FTL Analysis

### Faction-controlled FTL networks
```sql
-- Analyze FTL connections by controlling factions
WITH ftl_ownership AS (
    SELECT 
        f.ID, f.FROM_X, f.FROM_Y, f.FROM_Z, f.TO_X, f.TO_Y, f.TO_Z,
        f.FROM_UID, f.TO_UID, f.TYPE, f.PERMISSION,
        CASE 
            WHEN f.FROM_UID LIKE 'NPC-HOMEBASE_%' THEN -10000000  -- Trading Guild
            WHEN f.FROM_UID LIKE 'OUTCASTS_%' THEN -9999999
            WHEN f.FROM_UID LIKE 'SCAVENGERS_%' THEN -9999998
            WHEN f.FROM_UID LIKE 'PLAYER_%' THEN 1  -- Player faction placeholder
            ELSE 0  -- Neutral
        END as controlling_faction
    FROM FTL f
),
faction_network_stats AS (
    SELECT 
        fo.controlling_faction,
        COUNT(*) as connection_count,
        COUNT(DISTINCT fo.FROM_X || ',' || fo.FROM_Y || ',' || fo.FROM_Z) as controlled_nodes,
        COUNT(CASE WHEN fo.TYPE = 0 THEN 1 END) as warp_gates,
        COUNT(CASE WHEN fo.TYPE = 1 THEN 1 END) as worm_holes,
        COUNT(CASE WHEN fo.TYPE = 2 THEN 1 END) as race_ways,
        COUNT(CASE WHEN fo.PERMISSION = 0 THEN 1 END) as open_connections,
        COUNT(CASE WHEN fo.PERMISSION > 0 THEN 1 END) as restricted_connections
    FROM ftl_ownership fo
    GROUP BY fo.controlling_faction
)
SELECT 
    CASE fns.controlling_faction
        WHEN -10000000 THEN 'TRADING_GUILD'
        WHEN -9999999 THEN 'OUTCASTS'
        WHEN -9999998 THEN 'SCAVENGERS'
        WHEN 1 THEN 'PLAYER_FACTIONS'
        WHEN 0 THEN 'NEUTRAL'
        ELSE 'UNKNOWN'
    END as faction_name,
    fns.connection_count,
    fns.controlled_nodes,
    fns.warp_gates,
    fns.worm_holes,
    fns.race_ways,
    fns.open_connections,
    fns.restricted_connections,
    ROUND(fns.open_connections * 100.0 / NULLIF(fns.connection_count, 0), 2) as open_percentage,
    CASE 
        WHEN fns.controlled_nodes >= 20 THEN 'DOMINANT_NETWORK'
        WHEN fns.controlled_nodes >= 10 THEN 'MAJOR_NETWORK'
        WHEN fns.controlled_nodes >= 5 THEN 'REGIONAL_NETWORK'
        ELSE 'MINOR_NETWORK'
    END as network_size
FROM faction_network_stats fns
ORDER BY fns.connection_count DESC;
```

### Critical chokepoints and strategic nodes
```sql
-- Identify critical nodes whose removal would fragment the network
WITH node_importance AS (
    SELECT 
        f.FROM_X as X, f.FROM_Y as Y, f.FROM_Z as Z,
        COUNT(DISTINCT f.TO_X || ',' || f.TO_Y || ',' || f.TO_Z) as direct_connections,
        COUNT(DISTINCT f.ID) as total_routes
    FROM FTL f
    WHERE f.PERMISSION = 0  -- Only consider open routes
    GROUP BY f.FROM_X, f.FROM_Y, f.FROM_Z
    
    UNION ALL
    
    SELECT 
        f.TO_X as X, f.TO_Y as Y, f.TO_Z as Z,
        COUNT(DISTINCT f.FROM_X || ',' || f.FROM_Y || ',' || f.FROM_Z) as direct_connections,
        COUNT(DISTINCT f.ID) as total_routes
    FROM FTL f
    WHERE f.PERMISSION = 0
    GROUP BY f.TO_X, f.TO_Y, f.TO_Z
),
critical_nodes AS (
    SELECT 
        ni.X, ni.Y, ni.Z,
        SUM(ni.direct_connections) as connection_count,
        SUM(ni.total_routes) as route_count,
        COUNT(*) as appearance_count  -- How many times this node appears (from/to)
    FROM node_importance ni
    GROUP BY ni.X, ni.Y, ni.Z
)
SELECT 
    cn.X, cn.Y, cn.Z,
    cn.connection_count,
    cn.route_count,
    cn.appearance_count,
    SQRT(POWER(cn.X, 2) + POWER(cn.Y, 2) + POWER(cn.Z, 2)) as distance_from_origin,
    CASE 
        WHEN cn.connection_count >= 10 AND cn.appearance_count = 2 THEN 'CRITICAL_HUB'
        WHEN cn.connection_count >= 5 AND cn.appearance_count = 2 THEN 'IMPORTANT_NODE'
        WHEN cn.connection_count >= 3 THEN 'TRANSIT_NODE'
        WHEN cn.appearance_count = 1 THEN 'EDGE_NODE'
        ELSE 'STANDARD_NODE'
    END as strategic_importance,
    -- Check if it's a bridge node (only connection between regions)
    CASE 
        WHEN cn.connection_count = 2 AND cn.route_count = 2 THEN 'POTENTIAL_BRIDGE'
        ELSE 'NORMAL'
    END as topology_role
FROM critical_nodes cn
ORDER BY cn.connection_count DESC, cn.route_count DESC
LIMIT 50;
```

---

## Permission and Access Control Analysis

### FTL access patterns
```sql
-- Analyze permission patterns and access restrictions
WITH permission_breakdown AS (
    SELECT 
        f.ID, f.FROM_X, f.FROM_Y, f.FROM_Z, f.TO_X, f.TO_Y, f.TO_Z,
        f.PERMISSION,
        CASE WHEN MOD(f.PERMISSION, 2) = 1 THEN 1 ELSE 0 END as no_damage,
        CASE WHEN MOD(f.PERMISSION / 2, 2) = 1 THEN 1 ELSE 0 END as peace_mode,
        CASE WHEN MOD(f.PERMISSION / 4, 2) = 1 THEN 1 ELSE 0 END as enter_locked,
        CASE WHEN MOD(f.PERMISSION / 8, 2) = 1 THEN 1 ELSE 0 END as exit_locked
    FROM FTL f
)
SELECT 
    COUNT(*) as total_connections,
    SUM(pb.no_damage) as no_damage_zones,
    SUM(pb.peace_mode) as peace_mode_zones,
    SUM(pb.enter_locked) as enter_locked_connections,
    SUM(pb.exit_locked) as exit_locked_connections,
    SUM(CASE WHEN pb.enter_locked = 1 AND pb.exit_locked = 1 THEN 1 ELSE 0 END) as fully_locked,
    SUM(CASE WHEN pb.PERMISSION = 0 THEN 1 ELSE 0 END) as completely_open,
    SUM(CASE WHEN pb.PERMISSION = 3 THEN 1 ELSE 0 END) as safe_zones,
    ROUND(SUM(CASE WHEN pb.PERMISSION = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as open_percentage
FROM permission_breakdown pb;
```

### Restricted route analysis
```sql
-- Find restricted FTL routes and their patterns
SELECT 
    f.FROM_X, f.FROM_Y, f.FROM_Z,
    f.TO_X, f.TO_Y, f.TO_Z,
    f.FROM_UID, f.TO_UID,
    f.PERMISSION,
    CASE f.TYPE
        WHEN 0 THEN 'WARP_GATE'
        WHEN 1 THEN 'WORM_HOLE'
        WHEN 2 THEN 'RACE_WAY'
    END as connection_type,
    CASE 
        WHEN f.PERMISSION = 12 THEN 'FULLY_LOCKED'
        WHEN MOD(f.PERMISSION / 8, 2) = 1 THEN 'EXIT_BLOCKED'
        WHEN MOD(f.PERMISSION / 4, 2) = 1 THEN 'ENTRY_BLOCKED'
        WHEN f.PERMISSION = 3 THEN 'PEACE_ZONE'
        ELSE 'CUSTOM_RESTRICTION'
    END as restriction_type,
    SQRT(POWER(f.TO_X - f.FROM_X, 2) + 
         POWER(f.TO_Y - f.FROM_Y, 2) + 
         POWER(f.TO_Z - f.FROM_Z, 2)) as jump_distance
FROM FTL f
WHERE f.PERMISSION > 0
ORDER BY f.PERMISSION DESC, jump_distance DESC
LIMIT 50;
```

---

## Data Validation and Maintenance

### FTL data integrity checks
```sql
-- Comprehensive data validation
WITH validation_checks AS (
    -- Check 1: Self-referencing connections
    SELECT 'SELF_REFERENCING' as check_type, COUNT(*) as issues
    FROM FTL f
    WHERE f.FROM_X = f.TO_X AND f.FROM_Y = f.TO_Y AND f.FROM_Z = f.TO_Z
    
    UNION ALL
    
    -- Check 2: Invalid TYPE values
    SELECT 'INVALID_TYPE' as check_type, COUNT(*) as issues
    FROM FTL f
    WHERE f.TYPE NOT IN (0, 1, 2)
    
    UNION ALL
    
    -- Check 3: Missing or empty UIDs
    SELECT 'MISSING_UIDS' as check_type, COUNT(*) as issues
    FROM FTL f
    WHERE f.FROM_UID IS NULL OR TRIM(f.FROM_UID) = ''
       OR f.TO_UID IS NULL OR TRIM(f.TO_UID) = ''
    
    UNION ALL
    
    -- Check 4: Invalid permission values
    SELECT 'INVALID_PERMISSIONS' as check_type, COUNT(*) as issues
    FROM FTL f
    WHERE f.PERMISSION < 0 OR f.PERMISSION > 15  -- Max 4-bit value
    
    UNION ALL
    
    -- Check 5: Duplicate connections
    SELECT 'DUPLICATE_CONNECTIONS' as check_type, 
           COUNT(*) - COUNT(DISTINCT f.FROM_X || ',' || f.FROM_Y || ',' || f.FROM_Z || ',' ||
                                    f.TO_X || ',' || f.TO_Y || ',' || f.TO_Z || ',' || f.TYPE) as issues
    FROM FTL f
    
    UNION ALL
    
    -- Check 6: Extreme coordinates
    SELECT 'EXTREME_COORDINATES' as check_type, COUNT(*) as issues
    FROM FTL f
    WHERE ABS(f.FROM_X) > 1000000 OR ABS(f.FROM_Y) > 1000000 OR ABS(f.FROM_Z) > 1000000
       OR ABS(f.TO_X) > 1000000 OR ABS(f.TO_Y) > 1000000 OR ABS(f.TO_Z) > 1000000
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

### Network statistics and performance metrics
```sql
-- FTL network performance and statistics summary
SELECT 
    'FTL_NETWORK_SUMMARY' as metric_type,
    COUNT(*) as total_connections,
    COUNT(DISTINCT f.FROM_X || ',' || f.FROM_Y || ',' || f.FROM_Z) as origin_nodes,
    COUNT(DISTINCT f.TO_X || ',' || f.TO_Y || ',' || f.TO_Z) as destination_nodes,
    COUNT(DISTINCT f.FROM_X || ',' || f.FROM_Y || ',' || f.FROM_Z || ',' ||
                   f.TO_X || ',' || f.TO_Y || ',' || f.TO_Z) as unique_routes,
    COUNT(CASE WHEN f.TYPE = 0 THEN 1 END) as warp_gates,
    COUNT(CASE WHEN f.TYPE = 1 THEN 1 END) as worm_holes,
    COUNT(CASE WHEN f.TYPE = 2 THEN 1 END) as race_ways,
    COUNT(CASE WHEN f.PERMISSION = 0 THEN 1 END) as open_connections,
    COUNT(CASE WHEN f.PERMISSION > 0 THEN 1 END) as restricted_connections,
    ROUND(AVG(SQRT(POWER(f.TO_X - f.FROM_X, 2) + 
                   POWER(f.TO_Y - f.FROM_Y, 2) + 
                   POWER(f.TO_Z - f.FROM_Z, 2))), 2) as avg_jump_distance,
    MAX(SQRT(POWER(f.TO_X - f.FROM_X, 2) + 
             POWER(f.TO_Y - f.FROM_Y, 2) + 
             POWER(f.TO_Z - f.FROM_Z, 2))) as max_jump_distance
FROM FTL f;
```

---

## Changelog

| Version | Date       | Author       | Description                                      |
|---------|------------|--------------|--------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of FTL example queries          |

[INDEX](./INDEX.md) | [FTL](./TABLE_FTL.md)