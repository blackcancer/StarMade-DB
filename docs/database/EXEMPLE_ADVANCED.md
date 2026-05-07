# EXEMPLE_ADVANCED - Multi-Table SQL Queries & Cross-Database Operations

These examples demonstrate sophisticated multi-table queries for HSQLDB 2.3.4. **All queries utilize multiple tables and showcase advanced JOIN patterns, CTEs, window functions, and complex analytical operations.**

---

## Fleet Operations with Cross-Table Analysis

### Complete fleet composition with entity details and spatial distribution
```sql
-- Comprehensive fleet analysis with ships, stations, and geographic distribution
WITH fleet_analysis AS (
    SELECT 
        f.ID as fleet_id,
        f.NAME as fleet_name,
        f.OWNER as fleet_owner,
        f.MISSION_STRING,
        f.COMBAT_SETTING,
        e_flagship.NAME as flagship_name,
        e_flagship.TYPE as flagship_type,
        e_flagship.X as fleet_x,
        e_flagship.Y as fleet_y,
        e_flagship.Z as fleet_z,
        s.NAME as fleet_sector_name,
        sys.NAME as fleet_system_name,
        p.STARMADE_NAME as owner_display_name,
        p.FACTION as owner_faction
    FROM FLEETS f
    JOIN ENTITIES e_flagship ON f.FLAGSHIP_ID = e_flagship.ID
    LEFT JOIN SECTORS s ON e_flagship.X = s.X AND e_flagship.Y = s.Y AND e_flagship.Z = s.Z
    LEFT JOIN SYSTEMS sys ON s.STELLAR = sys.ID
    LEFT JOIN PLAYERS p ON f.OWNER = p.NAME
),
fleet_members_analysis AS (
    SELECT 
        fm.FLEET_ID,
        COUNT(*) as total_members,
        COUNT(CASE WHEN e.TYPE = 0 THEN 1 END) as ship_count,
        COUNT(CASE WHEN e.TYPE = 1 THEN 1 END) as station_count,
        COUNT(CASE WHEN e.TYPE = 12 THEN 1 END) as shop_count,
        COUNT(DISTINCT CONCAT(e.X, ',', e.Y, ',', e.Z)) as sectors_occupied,
        GROUP_CONCAT(DISTINCT e.NAME SEPARATOR ', ') as member_names
    FROM FLEET_MEMBERS fm
    JOIN ENTITIES e ON fm.ENTITY_ID = e.ID
    GROUP BY fm.FLEET_ID
)
SELECT 
    fa.fleet_id,
    fa.fleet_name,
    fa.fleet_owner,
    fa.owner_display_name,
    fa.mission_string,
    fa.combat_setting,
    fa.flagship_name,
    fa.fleet_sector_name,
    fa.fleet_system_name,
    fma.total_members,
    fma.ship_count,
    fma.station_count,
    fma.shop_count,
    fma.sectors_occupied,
    CASE 
        WHEN fma.total_members >= 50 THEN 'ARMADA'
        WHEN fma.total_members >= 20 THEN 'LARGE_FLEET'
        WHEN fma.total_members >= 10 THEN 'MEDIUM_FLEET'
        WHEN fma.total_members >= 5 THEN 'SMALL_FLEET'
        ELSE 'PATROL'
    END as fleet_size_category
FROM fleet_analysis fa
LEFT JOIN fleet_members_analysis fma ON fa.fleet_id = fma.FLEET_ID
ORDER BY fma.total_members DESC NULLS LAST, fa.fleet_name;
```

### Fleet movement and territorial control analysis
```sql
-- Analyze fleet positions and sphere of influence
WITH fleet_positions AS (
    SELECT 
        f.ID as fleet_id,
        f.NAME as fleet_name,
        f.FACTION,
        COUNT(fm.ENTITY_ID) as fleet_size,
        AVG(e.X) as avg_x,
        AVG(e.Y) as avg_y,
        AVG(e.Z) as avg_z,
        MIN(e.X) as min_x, MAX(e.X) as max_x,
        MIN(e.Y) as min_y, MAX(e.Y) as max_y,
        MIN(e.Z) as min_z, MAX(e.Z) as max_z,
        COUNT(DISTINCT s.STELLAR) as systems_present_in,
        COUNT(DISTINCT CONCAT(e.X, ',', e.Y, ',', e.Z)) as sectors_occupied
    FROM FLEETS f
    JOIN FLEET_MEMBERS fm ON f.ID = fm.FLEET_ID
    JOIN ENTITIES e ON fm.ENTITY_ID = e.ID
    LEFT JOIN SECTORS s ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
    GROUP BY f.ID, f.NAME, f.FACTION
),
faction_territories AS (
    SELECT 
        fp.FACTION,
        COUNT(DISTINCT fp.fleet_id) as fleet_count,
        SUM(fp.fleet_size) as total_ships,
        COUNT(DISTINCT fp.systems_present_in) as controlled_systems,
        SUM(fp.sectors_occupied) as total_sectors_occupied,
        AVG(fp.max_x - fp.min_x + fp.max_y - fp.min_y + fp.max_z - fp.min_z) as avg_fleet_spread
    FROM fleet_positions fp
    WHERE fp.FACTION != 0
    GROUP BY fp.FACTION
)
SELECT 
    ft.FACTION,
    CASE 
        WHEN ft.FACTION = -10000000 THEN 'TRADING_GUILD'
        WHEN ft.FACTION = -9999999 THEN 'OUTCASTS'
        WHEN ft.FACTION = -9999998 THEN 'SCAVENGERS'
        WHEN ft.FACTION > 0 THEN 'PLAYER_FACTION_' || ft.FACTION
        ELSE 'UNKNOWN_FACTION'
    END as faction_name,
    ft.fleet_count,
    ft.total_ships,
    ft.controlled_systems,
    ft.total_sectors_occupied,
    ROUND(ft.avg_fleet_spread, 2) as avg_territorial_spread,
    CASE 
        WHEN ft.controlled_systems >= 10 THEN 'DOMINANT'
        WHEN ft.controlled_systems >= 5 THEN 'MAJOR_POWER'
        WHEN ft.controlled_systems >= 2 THEN 'REGIONAL_POWER'
        ELSE 'MINOR_FACTION'
    END as faction_influence
FROM faction_territories ft
ORDER BY ft.controlled_systems DESC, ft.total_ships DESC;
```

---

## Entity Docking Hierarchies and Complex Structures

### Recursive docking tree analysis
```sql
-- Analyze complex docking structures (limited recursion for HSQLDB)
-- Note: HSQLDB 2.3.4 supports recursive CTEs but with strict syntax
WITH RECURSIVE docking_hierarchy (
    ID, UID, NAME, TYPE, FACTION, CREATOR, X, Y, Z, 
    DOCKED_TO, DOCKED_ROOT, hierarchy_depth, hierarchy_path, root_entity_id
) AS (
    -- Base case: entities not docked to anything
    SELECT 
        e.ID,
        e.UID,
        e.NAME,
        e.TYPE,
        e.FACTION,
        e.CREATOR,
        e.X,
        e.Y,
        e.Z,
        e.DOCKED_TO,
        e.DOCKED_ROOT,
        0 as hierarchy_depth,
        CAST(e.NAME AS VARCHAR) as hierarchy_path,
        e.ID as root_entity_id
    FROM ENTITIES e
    WHERE e.DOCKED_TO = -1
    
    UNION ALL
    
    -- Recursive case: entities docked to others
    SELECT 
        e.ID,
        e.UID,
        e.NAME,
        e.TYPE,
        e.FACTION,
        e.CREATOR,
        e.X,
        e.Y,
        e.Z,
        e.DOCKED_TO,
        e.DOCKED_ROOT,
        dh.hierarchy_depth + 1,
        CAST(dh.hierarchy_path || ' -> ' || e.NAME AS VARCHAR),
        dh.root_entity_id
    FROM ENTITIES e
    JOIN docking_hierarchy dh ON e.DOCKED_TO = dh.ID
    WHERE dh.hierarchy_depth < 10  -- Prevent infinite recursion
),
complex_analysis AS (
    SELECT 
        dh.root_entity_id,
        MAX(dh.hierarchy_depth) as max_depth,
        COUNT(*) as total_docked_entities,
        COUNT(CASE WHEN dh.TYPE = 0 THEN 1 END) as docked_ships,
        COUNT(CASE WHEN dh.TYPE = 1 THEN 1 END) as docked_stations,
        COUNT(CASE WHEN dh.TYPE = 12 THEN 1 END) as docked_shops,
        COUNT(DISTINCT dh.CREATOR) as unique_creators,
        COUNT(DISTINCT dh.FACTION) as unique_factions,
        GROUP_CONCAT(DISTINCT dh.NAME SEPARATOR ', ') as docked_entity_names
    FROM docking_hierarchy dh
    WHERE dh.hierarchy_depth > 0  -- Exclude root entities from counts
    GROUP BY dh.root_entity_id
)
SELECT 
    root.ID as complex_id,
    root.NAME as complex_name,
    root.TYPE as root_type,
    root.FACTION as complex_faction,
    root.CREATOR as complex_creator,
    root.X as complex_x,
    root.Y as complex_y,
    root.Z as complex_z,
    s.NAME as sector_name,
    sys.NAME as system_name,
    p.STARMADE_NAME as creator_display_name,
    tn.STATION_NAME as trade_station_name,
    tn.CREDITS as trade_station_credits,
    ca.max_depth,
    ca.total_docked_entities,
    ca.docked_ships,
    ca.docked_stations,
    ca.docked_shops,
    ca.unique_creators,
    ca.unique_factions
FROM docking_hierarchy root
LEFT JOIN complex_analysis ca ON root.ID = ca.root_entity_id
LEFT JOIN SECTORS s ON root.X = s.X AND root.Y = s.Y AND root.Z = s.Z
LEFT JOIN SYSTEMS sys ON s.STELLAR = sys.ID
LEFT JOIN PLAYERS p ON root.CREATOR = p.NAME
LEFT JOIN TRADE_NODES tn ON root.ID = tn.ID
WHERE root.hierarchy_depth = 0  -- Only root entities
  AND ca.total_docked_entities > 0  -- Has docked entities
ORDER BY ca.total_docked_entities DESC NULLS LAST, ca.max_depth DESC NULLS LAST;
```

---

## Trade Network and Economic Analysis

### Complete trade network topology
```sql
-- Analyze trade routes and economic hubs
WITH trade_connections AS (
    SELECT 
        tn1.ID as node_id,
        tn1.STATION_NAME as node_name,
        tn1.FACTION as node_faction,
        tn1.CREDITS as node_credits,
        e.X as node_x,
        e.Y as node_y,
        e.Z as node_z,
        s.NAME as sector_name,
        sys.NAME as system_name,
        sys.TYPE as system_type,
        COUNT(DISTINCT tnc.CONNECTED_ID) as connection_count,
        GROUP_CONCAT(DISTINCT tn2.STATION_NAME SEPARATOR ', ') as connected_stations
    FROM TRADE_NODES tn1
    JOIN ENTITIES e ON tn1.ID = e.ID
    LEFT JOIN SECTORS s ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
    LEFT JOIN SYSTEMS sys ON s.STELLAR = sys.ID
    LEFT JOIN TRADE_NODE_CONNECTIONS tnc ON tn1.ID = tnc.NODE_ID
    LEFT JOIN TRADE_NODES tn2 ON tnc.CONNECTED_ID = tn2.ID
    GROUP BY tn1.ID, tn1.STATION_NAME, tn1.FACTION, tn1.CREDITS, 
             e.X, e.Y, e.Z, s.NAME, sys.NAME, sys.TYPE
),
trade_hub_analysis AS (
    SELECT 
        tc.system_name,
        tc.system_type,
        COUNT(*) as stations_in_system,
        SUM(tc.node_credits) as total_system_credits,
        AVG(tc.node_credits) as avg_station_credits,
        SUM(tc.connection_count) as total_connections,
        MAX(tc.connection_count) as max_connections_single_station,
        GROUP_CONCAT(
            tc.node_name || ' (' || tc.node_credits || ' credits)' 
            SEPARATOR ', '
        ) as stations_list
    FROM trade_connections tc
    WHERE tc.node_credits > 0
    GROUP BY tc.system_name, tc.system_type
)
SELECT 
    tha.system_name,
    CASE tha.system_type
        WHEN 0 THEN 'SUN'
        WHEN 1 THEN 'GIANT'
        WHEN 2 THEN 'BLACK_HOLE'
        WHEN 3 THEN 'DOUBLE_STAR'
        WHEN 4 THEN 'VOID'
        ELSE 'UNKNOWN'
    END as system_type_name,
    tha.stations_in_system,
    tha.total_system_credits,
    ROUND(tha.avg_station_credits, 2) as avg_station_credits,
    tha.total_connections,
    tha.max_connections_single_station,
    CASE 
        WHEN tha.stations_in_system >= 10 THEN 'MAJOR_TRADE_HUB'
        WHEN tha.stations_in_system >= 5 THEN 'REGIONAL_TRADE_CENTER'
        WHEN tha.stations_in_system >= 2 THEN 'MINOR_TRADE_POST'
        ELSE 'ISOLATED_STATION'
    END as economic_classification,
    tha.stations_list
FROM trade_hub_analysis tha
ORDER BY tha.total_system_credits DESC, tha.stations_in_system DESC;
```

---

## Player Activity and Engagement Metrics

### Comprehensive player activity analysis across all systems
```sql
-- Multi-dimensional player activity tracking
WITH player_activity_timeline AS (
    SELECT 
        p.NAME as player_name,
        p.STARMADE_NAME,
        p.FACTION,
        p.PERMISSION,
        -- Entity creation activity
        (SELECT COUNT(*) FROM ENTITIES e WHERE e.CREATOR = p.NAME) as entities_created,
        (SELECT COUNT(*) FROM ENTITIES e WHERE e.CREATOR = p.NAME AND e.TYPE = 0) as ships_created,
        (SELECT COUNT(*) FROM ENTITIES e WHERE e.CREATOR = p.NAME AND e.TYPE = 1) as stations_created,
        -- Fleet command activity  
        (SELECT COUNT(*) FROM FLEETS f WHERE f.OWNER = p.NAME) as fleets_commanded,
        (SELECT COUNT(*) FROM FLEET_MEMBERS fm 
         JOIN FLEETS f ON fm.FLEET_ID = f.ID 
         WHERE f.OWNER = p.NAME) as total_fleet_ships,
        -- Communication activity
        (SELECT COUNT(*) FROM PLAYER_MESSAGES pm WHERE pm.SENDER = p.NAME) as messages_sent,
        (SELECT COUNT(*) FROM PLAYER_MESSAGES pm WHERE pm.RECEIVER = p.NAME) as messages_received,
        (SELECT MAX(pm.SENT) FROM PLAYER_MESSAGES pm WHERE pm.SENDER = p.NAME) as last_message_sent
    FROM PLAYERS p
),
fleet_mission_analysis AS (
    SELECT 
        f.OWNER,
        COUNT(CASE WHEN f.MISSION_STRING = 'ATTACK' THEN 1 END) as attacking_fleets,
        COUNT(CASE WHEN f.MISSION_STRING = 'DEFEND' THEN 1 END) as defending_fleets,
        COUNT(CASE WHEN f.COMBAT_SETTING = 'ALWAYS ENGAGE' THEN 1 END) as aggressive_fleets
    FROM FLEETS f
    GROUP BY f.OWNER
),
communication_network AS (
    SELECT 
        pm.SENDER,
        COUNT(DISTINCT pm.RECEIVER) as unique_contacts
    FROM PLAYER_MESSAGES pm
    GROUP BY pm.SENDER
),
territorial_presence AS (
    SELECT 
        e.CREATOR,
        COUNT(DISTINCT CONCAT(e.X, ',', e.Y, ',', e.Z)) as sectors_with_presence,
        COUNT(DISTINCT s.STELLAR) as systems_with_presence,
        GROUP_CONCAT(DISTINCT sys.NAME SEPARATOR ', ') as system_names,
        AVG(SQRT(POWER(e.X, 2) + POWER(e.Y, 2) + POWER(e.Z, 2))) as avg_distance_from_origin
    FROM ENTITIES e
    LEFT JOIN SECTORS s ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
    LEFT JOIN SYSTEMS sys ON s.STELLAR = sys.ID
    WHERE e.CREATOR != ''
    GROUP BY e.CREATOR
)
SELECT 
    pat.player_name,
    pat.STARMADE_NAME,
    pat.FACTION,
    pat.entities_created,
    pat.ships_created,
    pat.stations_created,
    pat.fleets_commanded,
    pat.total_fleet_ships,
    COALESCE(fma.attacking_fleets, 0) as attacking_fleets,
    COALESCE(fma.defending_fleets, 0) as defending_fleets,
    COALESCE(fma.aggressive_fleets, 0) as aggressive_fleets,
    pat.messages_sent,
    pat.messages_received,
    COALESCE(cn.unique_contacts, 0) as unique_contacts,
    COALESCE(tp.sectors_with_presence, 0) as territorial_sectors,
    COALESCE(tp.systems_with_presence, 0) as territorial_systems,
    ROUND(COALESCE(tp.avg_distance_from_origin, 0), 2) as avg_distance_from_origin,
    CASE 
        WHEN pat.last_message_sent >= (UNIX_TIMESTAMP() - 86400) * 1000 THEN 'ACTIVE_TODAY'
        WHEN pat.last_message_sent >= (UNIX_TIMESTAMP() - 604800) * 1000 THEN 'ACTIVE_THIS_WEEK'
        WHEN pat.last_message_sent >= (UNIX_TIMESTAMP() - 2592000) * 1000 THEN 'ACTIVE_THIS_MONTH'
        WHEN pat.last_message_sent IS NOT NULL THEN 'INACTIVE'
        ELSE 'NO_COMMUNICATION'
    END as communication_activity,
    CASE 
        WHEN COALESCE(fma.attacking_fleets, 0) >= 3 THEN 'HIGHLY_AGGRESSIVE'
        WHEN COALESCE(fma.attacking_fleets, 0) >= 1 THEN 'AGGRESSIVE'
        WHEN COALESCE(fma.defending_fleets, 0) >= 1 THEN 'DEFENSIVE'
        WHEN pat.fleets_commanded > 0 THEN 'PEACEFUL_FLEET_COMMANDER'
        ELSE 'NON_MILITARY'
    END as military_posture,
    CASE 
        WHEN pat.entities_created >= 100 THEN 'PROLIFIC_BUILDER'
        WHEN pat.entities_created >= 50 THEN 'ACTIVE_BUILDER'
        WHEN pat.entities_created >= 20 THEN 'MODERATE_BUILDER'
        WHEN pat.entities_created >= 5 THEN 'CASUAL_BUILDER'
        WHEN pat.entities_created > 0 THEN 'MINIMAL_BUILDER'
        ELSE 'NON_BUILDER'
    END as construction_activity,
    CASE 
        WHEN COALESCE(cn.unique_contacts, 0) >= 20 THEN 'HIGHLY_CONNECTED'
        WHEN COALESCE(cn.unique_contacts, 0) >= 10 THEN 'WELL_CONNECTED'
        WHEN COALESCE(cn.unique_contacts, 0) >= 5 THEN 'SOCIALLY_ACTIVE'
        WHEN COALESCE(cn.unique_contacts, 0) >= 1 THEN 'MINIMAL_SOCIAL'
        ELSE 'ISOLATED'
    END as social_connectivity
FROM player_activity_timeline pat
LEFT JOIN fleet_mission_analysis fma ON pat.player_name = fma.OWNER
LEFT JOIN communication_network cn ON pat.player_name = cn.SENDER
LEFT JOIN territorial_presence tp ON pat.player_name = tp.CREATOR
WHERE pat.entities_created > 0 
   OR pat.fleets_commanded > 0 
   OR pat.messages_sent > 0
ORDER BY pat.entities_created DESC, pat.fleets_commanded DESC, pat.messages_sent DESC;
```

---

## System-Wide Resource Distribution and Control

### Analyze resource distribution across systems and factions
```sql
-- System resource control and faction dominance
WITH system_entities AS (
    SELECT 
        sys.ID as system_id,
        sys.NAME as system_name,
        sys.TYPE as system_type,
        sys.OWNER_FACTION as controlling_faction,
        COUNT(DISTINCT e.ID) as total_entities,
        COUNT(DISTINCT CASE WHEN e.TYPE = 2 THEN e.ID END) as planet_count,
        COUNT(DISTINCT CASE WHEN e.TYPE = 3 THEN e.ID END) as asteroid_count,
        COUNT(DISTINCT CASE WHEN e.TYPE = 0 THEN e.ID END) as ship_count,
        COUNT(DISTINCT CASE WHEN e.TYPE = 1 THEN e.ID END) as station_count,
        COUNT(DISTINCT e.FACTION) as faction_diversity,
        COUNT(DISTINCT e.CREATOR) as creator_diversity
    FROM SYSTEMS sys
    LEFT JOIN SECTORS s ON s.STELLAR = sys.ID
    LEFT JOIN ENTITIES e ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
    GROUP BY sys.ID, sys.NAME, sys.TYPE, sys.OWNER_FACTION
),
faction_presence AS (
    SELECT 
        s.STELLAR as system_id,
        e.FACTION,
        COUNT(DISTINCT e.ID) as faction_entities,
        COUNT(DISTINCT CASE WHEN e.TYPE = 0 THEN e.ID END) as faction_ships,
        COUNT(DISTINCT CASE WHEN e.TYPE = 1 THEN e.ID END) as faction_stations,
        SUM(CASE WHEN e.TYPE = 1 THEN 1 ELSE 0 END) as infrastructure_score
    FROM ENTITIES e
    JOIN SECTORS s ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
    WHERE e.FACTION != 0
    GROUP BY s.STELLAR, e.FACTION
),
system_control_analysis AS (
    SELECT 
        se.system_id,
        se.system_name,
        CASE se.system_type
            WHEN 0 THEN 'SUN'
            WHEN 1 THEN 'GIANT'
            WHEN 2 THEN 'BLACK_HOLE'
            WHEN 3 THEN 'DOUBLE_STAR'
            WHEN 4 THEN 'VOID'
            ELSE 'UNKNOWN'
        END as system_type_name,
        se.controlling_faction,
        se.total_entities,
        se.planet_count,
        se.asteroid_count,
        se.ship_count,
        se.station_count,
        se.faction_diversity,
        COALESCE(fp.FACTION, se.controlling_faction) as dominant_faction,
        COALESCE(fp.faction_entities, 0) as dominant_faction_entities,
        COALESCE(fp.infrastructure_score, 0) as dominant_faction_infrastructure
    FROM system_entities se
    LEFT JOIN (
        SELECT 
            fp1.system_id,
            fp1.FACTION,
            fp1.faction_entities,
            fp1.infrastructure_score
        FROM faction_presence fp1
        WHERE fp1.faction_entities = (
            SELECT MAX(fp2.faction_entities)
            FROM faction_presence fp2
            WHERE fp2.system_id = fp1.system_id
        )
    ) fp ON se.system_id = fp.system_id
)
SELECT 
    sca.system_name,
    sca.system_type_name,
    CASE 
        WHEN sca.controlling_faction = -10000000 THEN 'TRADING_GUILD'
        WHEN sca.controlling_faction = -9999999 THEN 'OUTCASTS'
        WHEN sca.controlling_faction = -9999998 THEN 'SCAVENGERS'
        WHEN sca.controlling_faction = 0 THEN 'NEUTRAL'
        WHEN sca.controlling_faction > 0 THEN 'PLAYER_FACTION_' || sca.controlling_faction
        ELSE 'UNKNOWN'
    END as official_controller,
    CASE 
        WHEN sca.dominant_faction = -10000000 THEN 'TRADING_GUILD'
        WHEN sca.dominant_faction = -9999999 THEN 'OUTCASTS'
        WHEN sca.dominant_faction = -9999998 THEN 'SCAVENGERS'
        WHEN sca.dominant_faction = 0 THEN 'NEUTRAL'
        WHEN sca.dominant_faction > 0 THEN 'PLAYER_FACTION_' || sca.dominant_faction
        ELSE 'UNKNOWN'
    END as de_facto_controller,
    sca.total_entities,
    sca.planet_count,
    sca.asteroid_count,
    sca.ship_count,
    sca.station_count,
    sca.faction_diversity,
    sca.dominant_faction_entities,
    sca.dominant_faction_infrastructure,
    CASE 
        WHEN sca.controlling_faction = sca.dominant_faction THEN 'STABLE'
        WHEN sca.controlling_faction != sca.dominant_faction THEN 'CONTESTED'
        WHEN sca.faction_diversity > 5 THEN 'HIGHLY_CONTESTED'
        ELSE 'NEUTRAL_ZONE'
    END as system_stability,
    CASE 
        WHEN sca.planet_count >= 5 THEN 'RESOURCE_RICH'
        WHEN sca.asteroid_count >= 50 THEN 'MINING_SYSTEM'
        WHEN sca.station_count >= 10 THEN 'TRADE_HUB'
        WHEN sca.ship_count >= 100 THEN 'MILITARY_ZONE'
        WHEN sca.total_entities < 10 THEN 'FRONTIER'
        ELSE 'MIXED_USE'
    END as system_classification
FROM system_control_analysis sca
ORDER BY sca.total_entities DESC, sca.faction_diversity DESC;
```

---

## Cross-System Pathfinding and Navigation

### FTL jump route analysis between systems
```sql
-- Analyze FTL connectivity and optimal routes
WITH ftl_network AS (
    SELECT 
        f.FROM_X, f.FROM_Y, f.FROM_Z,
        f.TO_X, f.TO_Y, f.TO_Z,
        f.TYPE as connection_type,
        f.PERMISSION,
        s1.STELLAR as from_system,
        s2.STELLAR as to_system,
        sys1.NAME as from_system_name,
        sys2.NAME as to_system_name,
        SQRT(POWER(f.TO_X - f.FROM_X, 2) + 
             POWER(f.TO_Y - f.FROM_Y, 2) + 
             POWER(f.TO_Z - f.FROM_Z, 2)) as jump_distance
    FROM FTL f
    JOIN SECTORS s1 ON f.FROM_X = s1.X AND f.FROM_Y = s1.Y AND f.FROM_Z = s1.Z
    JOIN SECTORS s2 ON f.TO_X = s2.X AND f.TO_Y = s2.Y AND f.TO_Z = s2.Z
    LEFT JOIN SYSTEMS sys1 ON s1.STELLAR = sys1.ID
    LEFT JOIN SYSTEMS sys2 ON s2.STELLAR = sys2.ID
    WHERE f.PERMISSION = 0  -- Only unrestricted connections
),
system_connectivity AS (
    SELECT 
        fn.from_system,
        fn.from_system_name,
        COUNT(DISTINCT fn.to_system) as connected_systems,
        COUNT(*) as total_connections,
        AVG(fn.jump_distance) as avg_jump_distance,
        GROUP_CONCAT(
            DISTINCT fn.to_system_name || ' (' || 
            ROUND(fn.jump_distance, 1) || ')' 
            SEPARATOR ', '
        ) as connected_to
    FROM ftl_network fn
    GROUP BY fn.from_system, fn.from_system_name
)
SELECT 
    sc.from_system_name as system_name,
    sc.connected_systems,
    sc.total_connections,
    ROUND(sc.avg_jump_distance, 2) as avg_jump_distance,
    CASE 
        WHEN sc.connected_systems >= 10 THEN 'MAJOR_HUB'
        WHEN sc.connected_systems >= 5 THEN 'REGIONAL_HUB'
        WHEN sc.connected_systems >= 2 THEN 'CONNECTED'
        WHEN sc.connected_systems = 1 THEN 'EDGE_SYSTEM'
        ELSE 'ISOLATED'
    END as connectivity_class,
    sc.connected_to
FROM system_connectivity sc
ORDER BY sc.connected_systems DESC, sc.total_connections DESC;
```

---

## Database Health and Integrity Check

### Comprehensive database integrity validation
```sql
-- Multi-table relationship integrity and data quality assessment
WITH relationship_validation AS (
    -- Check FLEETS -> ENTITIES (flagship) relationship
    SELECT 'FLEETS_FLAGSHIP_ENTITIES' as relationship_type,
           COUNT(*) as total_records,
           COUNT(CASE WHEN e.ID IS NULL THEN 1 END) as orphaned_records,
           'FLEETS flagship references non-existent ENTITIES' as description
    FROM FLEETS f
    LEFT JOIN ENTITIES e ON f.FLAGSHIP_ID = e.ID
    
    UNION ALL
    
    -- ENTITIES docking relationships
    SELECT 'ENTITIES_DOCKING_INTEGRITY',
           COUNT(*),
           COUNT(CASE WHEN parent.ID IS NULL THEN 1 END),
           'ENTITIES docked to non-existent parent entities'
    FROM ENTITIES e
    LEFT JOIN ENTITIES parent ON e.DOCKED_TO = parent.ID
    WHERE e.DOCKED_TO != -1
    
    UNION ALL
    
    -- SECTORS -> SYSTEMS relationship
    SELECT 'SECTORS_SYSTEMS',
           COUNT(*),
           COUNT(CASE WHEN sys.ID IS NULL THEN 1 END),
           'SECTORS reference non-existent SYSTEMS'
    FROM SECTORS s
    LEFT JOIN SYSTEMS sys ON s.STELLAR = sys.ID
    
    UNION ALL
    
    -- TRADE_NODES -> ENTITIES relationship
    SELECT 'TRADE_NODES_ENTITIES',
           COUNT(*),
           COUNT(CASE WHEN e.ID IS NULL THEN 1 END),
           'TRADE_NODES reference non-existent ENTITIES'
    FROM TRADE_NODES tn
    LEFT JOIN ENTITIES e ON tn.ID = e.ID
    WHERE tn.ID IS NOT NULL
    
    UNION ALL
    
    -- EFFECTS -> ENTITIES relationship
    SELECT 'EFFECTS_ENTITIES',
           COUNT(*),
           COUNT(CASE WHEN e.ID IS NULL THEN 1 END),
           'EFFECTS reference non-existent ENTITIES'
    FROM EFFECTS ef
    LEFT JOIN ENTITIES e ON ef.ENTITY_ID = e.ID
),
spatial_consistency AS (
    -- Entities in non-existent sectors
    SELECT 'SPATIAL_CONSISTENCY' as check_type,
           COUNT(*) as total_entities,
           COUNT(CASE WHEN s.ID IS NULL THEN 1 END) as entities_in_void,
           'ENTITIES exist in sectors not defined in SECTORS table' as description
    FROM ENTITIES e
    LEFT JOIN SECTORS s ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
),
data_volume_analysis AS (
    SELECT 
        'TABLE_SIZES' as analysis_type,
        'Data volume and growth patterns' as description,
        (SELECT COUNT(*) FROM ENTITIES) as entities_count,
        (SELECT COUNT(*) FROM PLAYERS) as players_count,
        (SELECT COUNT(*) FROM FLEETS) as fleets_count,
        (SELECT COUNT(*) FROM FLEET_MEMBERS) as fleet_members_count,
        (SELECT COUNT(*) FROM SECTORS) as sectors_count,
        (SELECT COUNT(*) FROM SYSTEMS) as systems_count,
        (SELECT COUNT(*) FROM TRADE_NODES) as trade_nodes_count,
        (SELECT COUNT(*) FROM PLAYER_MESSAGES) as messages_count,
        (SELECT COUNT(*) FROM FTL) as ftl_connections_count,
        (SELECT COUNT(*) FROM EFFECTS) as effects_count
)
SELECT 
    'DATABASE_HEALTH_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    -- Relationship integrity summary
    (SELECT COUNT(*) FROM relationship_validation WHERE orphaned_records > 0) as integrity_issues,
    (SELECT SUM(orphaned_records) FROM relationship_validation) as total_orphaned_records,
    -- Spatial consistency
    (SELECT entities_in_void FROM spatial_consistency) as entities_in_undefined_sectors,
    -- Data volumes
    (SELECT entities_count FROM data_volume_analysis) as total_entities,
    (SELECT players_count FROM data_volume_analysis) as total_players,
    (SELECT fleets_count FROM data_volume_analysis) as total_fleets,
    (SELECT trade_nodes_count FROM data_volume_analysis) as total_trade_nodes,
    (SELECT messages_count FROM data_volume_analysis) as total_messages,
    -- Health assessment
    CASE 
        WHEN (SELECT COUNT(*) FROM relationship_validation WHERE orphaned_records > 0) = 0 THEN 'EXCELLENT'
        WHEN (SELECT SUM(orphaned_records) FROM relationship_validation) <= 10 THEN 'GOOD'
        WHEN (SELECT SUM(orphaned_records) FROM relationship_validation) <= 100 THEN 'FAIR'
        ELSE 'POOR'
    END as overall_health_status

UNION ALL

-- Detailed integrity issues
SELECT 
    rv.relationship_type as report_type,
    rv.description as generated_at,
    rv.orphaned_records as integrity_issues,
    rv.total_records as total_orphaned_records,
    NULL as entities_in_undefined_sectors,
    NULL as total_entities,
    NULL as total_players,
    NULL as total_fleets,
    NULL as total_trade_nodes,
    NULL as total_messages,
    CASE 
        WHEN rv.orphaned_records = 0 THEN 'HEALTHY'
        WHEN rv.orphaned_records <= 5 THEN 'MINOR_ISSUES'
        WHEN rv.orphaned_records <= 50 THEN 'MODERATE_ISSUES'
        ELSE 'CRITICAL_ISSUES'
    END as overall_health_status
FROM relationship_validation rv
WHERE rv.orphaned_records > 0
ORDER BY integrity_issues DESC;
```

---

## Faction Warfare and Conflict Analysis

### Active conflict zones identification
```sql
-- Identify areas with multi-faction military presence
WITH faction_military_presence AS (
    SELECT 
        s.X, s.Y, s.Z,
        s.NAME as sector_name,
        sys.NAME as system_name,
        e.FACTION,
        COUNT(DISTINCT e.ID) as entity_count,
        COUNT(DISTINCT CASE WHEN e.TYPE = 0 THEN e.ID END) as military_ships,
        COUNT(DISTINCT CASE WHEN e.TYPE = 1 THEN e.ID END) as bases
    FROM ENTITIES e
    JOIN SECTORS s ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
    LEFT JOIN SYSTEMS sys ON s.STELLAR = sys.ID
    WHERE e.TYPE IN (0, 1)  -- Ships and stations
      AND e.FACTION != 0     -- Not neutral
    GROUP BY s.X, s.Y, s.Z, s.NAME, sys.NAME, e.FACTION
),
contested_sectors AS (
    SELECT 
        fmp.X, fmp.Y, fmp.Z,
        fmp.sector_name,
        fmp.system_name,
        COUNT(DISTINCT fmp.FACTION) as faction_count,
        SUM(fmp.entity_count) as total_entities,
        SUM(fmp.military_ships) as total_military_ships,
        GROUP_CONCAT(
            CASE fmp.FACTION
                WHEN -10000000 THEN 'TG'
                WHEN -9999999 THEN 'OC'
                WHEN -9999998 THEN 'SC'
                ELSE 'P' || fmp.FACTION
            END || ':' || fmp.entity_count
            SEPARATOR ', '
        ) as faction_forces
    FROM faction_military_presence fmp
    GROUP BY fmp.X, fmp.Y, fmp.Z, fmp.sector_name, fmp.system_name
    HAVING COUNT(DISTINCT fmp.FACTION) >= 2  -- Multiple factions present
)
SELECT 
    cs.X, cs.Y, cs.Z,
    cs.sector_name,
    cs.system_name,
    cs.faction_count,
    cs.total_entities,
    cs.total_military_ships,
    cs.faction_forces,
    CASE 
        WHEN cs.faction_count >= 4 THEN 'HOT_WAR_ZONE'
        WHEN cs.faction_count = 3 THEN 'CONTESTED_TERRITORY'
        WHEN cs.faction_count = 2 AND cs.total_military_ships >= 20 THEN 'ACTIVE_CONFLICT'
        WHEN cs.faction_count = 2 THEN 'BORDER_TENSION'
        ELSE 'PEACEFUL'
    END as conflict_status,
    SQRT(POWER(cs.X, 2) + POWER(cs.Y, 2) + POWER(cs.Z, 2)) as distance_from_origin
FROM contested_sectors cs
ORDER BY cs.faction_count DESC, cs.total_military_ships DESC;
```

### Faction power projection analysis
```sql
-- Analyze faction military and economic strength
WITH faction_military_strength AS (
    SELECT 
        f.FACTION,
        COUNT(DISTINCT f.ID) as fleet_count,
        SUM(fm_count.member_count) as total_fleet_ships,
        COUNT(DISTINCT CASE WHEN f.MISSION_STRING = 'ATTACK' THEN f.ID END) as attack_fleets,
        COUNT(DISTINCT CASE WHEN f.COMBAT_SETTING = 'ALWAYS ENGAGE' THEN f.ID END) as aggressive_fleets
    FROM FLEETS f
    LEFT JOIN (
        SELECT FLEET_ID, COUNT(*) as member_count
        FROM FLEET_MEMBERS
        GROUP BY FLEET_ID
    ) fm_count ON f.ID = fm_count.FLEET_ID
    GROUP BY f.FACTION
),
faction_infrastructure AS (
    SELECT 
        e.FACTION,
        COUNT(DISTINCT CASE WHEN e.TYPE = 1 THEN e.ID END) as station_count,
        COUNT(DISTINCT CASE WHEN e.TYPE = 12 THEN e.ID END) as shop_count,
        COUNT(DISTINCT tn.ID) as trade_nodes
    FROM ENTITIES e
    LEFT JOIN TRADE_NODES tn ON e.ID = tn.ID
    WHERE e.FACTION != 0
    GROUP BY e.FACTION
),
faction_territory AS (
    SELECT 
        e.FACTION,
        COUNT(DISTINCT s.STELLAR) as controlled_systems,
        COUNT(DISTINCT CONCAT(e.X, ',', e.Y, ',', e.Z)) as occupied_sectors
    FROM ENTITIES e
    JOIN SECTORS s ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
    WHERE e.FACTION != 0
    GROUP BY e.FACTION
)
SELECT 
    COALESCE(fms.FACTION, fi.FACTION, ft.FACTION) as faction_id,
    CASE COALESCE(fms.FACTION, fi.FACTION, ft.FACTION)
        WHEN -10000000 THEN 'TRADING_GUILD'
        WHEN -9999999 THEN 'OUTCASTS'
        WHEN -9999998 THEN 'SCAVENGERS'
        WHEN 0 THEN 'NEUTRAL'
        ELSE 'PLAYER_FACTION_' || COALESCE(fms.FACTION, fi.FACTION, ft.FACTION)
    END as faction_name,
    -- Military metrics
    COALESCE(fms.fleet_count, 0) as fleet_count,
    COALESCE(fms.total_fleet_ships, 0) as total_fleet_ships,
    COALESCE(fms.attack_fleets, 0) as attack_fleets,
    COALESCE(fms.aggressive_fleets, 0) as aggressive_fleets,
    -- Infrastructure metrics
    COALESCE(fi.station_count, 0) as station_count,
    COALESCE(fi.shop_count, 0) as shop_count,
    COALESCE(fi.trade_nodes, 0) as trade_nodes,
    -- Territory metrics
    COALESCE(ft.controlled_systems, 0) as controlled_systems,
    COALESCE(ft.occupied_sectors, 0) as occupied_sectors,
    -- Power calculation
    (COALESCE(fms.fleet_count, 0) * 10 + 
     COALESCE(fms.total_fleet_ships, 0) + 
     COALESCE(fi.station_count, 0) * 20 +
     COALESCE(ft.controlled_systems, 0) * 50) as power_score,
    -- Classification
    CASE 
        WHEN COALESCE(ft.controlled_systems, 0) >= 10 AND COALESCE(fms.fleet_count, 0) >= 5 THEN 'SUPERPOWER'
        WHEN COALESCE(ft.controlled_systems, 0) >= 5 AND COALESCE(fms.fleet_count, 0) >= 3 THEN 'MAJOR_POWER'
        WHEN COALESCE(ft.controlled_systems, 0) >= 2 OR COALESCE(fms.fleet_count, 0) >= 2 THEN 'REGIONAL_POWER'
        WHEN COALESCE(ft.controlled_systems, 0) >= 1 OR COALESCE(fms.fleet_count, 0) >= 1 THEN 'MINOR_POWER'
        ELSE 'MINIMAL_PRESENCE'
    END as power_classification
FROM faction_military_strength fms
FULL OUTER JOIN faction_infrastructure fi ON fms.FACTION = fi.FACTION
FULL OUTER JOIN faction_territory ft ON COALESCE(fms.FACTION, fi.FACTION) = ft.FACTION
WHERE COALESCE(fms.FACTION, fi.FACTION, ft.FACTION) IS NOT NULL
ORDER BY power_score DESC;
```

---

## Trade Route Optimization

### Optimal trade route calculation
```sql
-- Find most profitable trade routes between systems
WITH trade_station_metrics AS (
    SELECT 
        tn.ID as node_id,
        tn.STATION_NAME,
        tn.CREDITS,
        tn.FACTION,
        e.X, e.Y, e.Z,
        s.STELLAR as system_id,
        sys.NAME as system_name
    FROM TRADE_NODES tn
    JOIN ENTITIES e ON tn.ID = e.ID
    JOIN SECTORS s ON e.X = s.X AND e.Y = s.Y AND e.Z = s.Z
    LEFT JOIN SYSTEMS sys ON s.STELLAR = sys.ID
    WHERE tn.CREDITS > 10000  -- Only wealthy stations
),
potential_routes AS (
    SELECT 
        tsm1.node_id as from_node,
        tsm1.STATION_NAME as from_station,
        tsm1.system_name as from_system,
        tsm1.CREDITS as from_credits,
        tsm2.node_id as to_node,
        tsm2.STATION_NAME as to_station,
        tsm2.system_name as to_system,
        tsm2.CREDITS as to_credits,
        SQRT(POWER(tsm2.X - tsm1.X, 2) + 
             POWER(tsm2.Y - tsm1.Y, 2) + 
             POWER(tsm2.Z - tsm1.Z, 2)) as distance,
        ABS(tsm2.CREDITS - tsm1.CREDITS) as credit_differential
    FROM trade_station_metrics tsm1
    CROSS JOIN trade_station_metrics tsm2
    WHERE tsm1.node_id < tsm2.node_id  -- Avoid duplicates
      AND tsm1.system_id != tsm2.system_id  -- Different systems
),
ftl_enhanced_routes AS (
    SELECT 
        pr.*,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM FTL f
                WHERE (f.FROM_X = pr.from_node AND f.TO_X = pr.to_node)
                   OR (f.FROM_X = pr.to_node AND f.TO_X = pr.from_node)
            ) THEN 'DIRECT_FTL'
            ELSE 'NO_DIRECT_FTL'
        END as ftl_connection,
        pr.credit_differential / NULLIF(pr.distance, 0) as profit_per_distance
    FROM potential_routes pr
)
SELECT 
    fer.from_station,
    fer.from_system,
    fer.to_station,
    fer.to_system,
    ROUND(fer.distance, 2) as route_distance,
    fer.credit_differential,
    fer.ftl_connection,
    ROUND(fer.profit_per_distance, 2) as efficiency_score,
    CASE 
        WHEN fer.profit_per_distance > 1000 THEN 'HIGHLY_PROFITABLE'
        WHEN fer.profit_per_distance > 500 THEN 'PROFITABLE'
        WHEN fer.profit_per_distance > 100 THEN 'MODERATE'
        ELSE 'MARGINAL'
    END as route_profitability,
    CASE 
        WHEN fer.distance < 50 THEN 'SHORT_HAUL'
        WHEN fer.distance < 200 THEN 'MEDIUM_HAUL'
        ELSE 'LONG_HAUL'
    END as route_type
FROM ftl_enhanced_routes fer
ORDER BY fer.profit_per_distance DESC
LIMIT 50;
```

---

## Performance Metrics Dashboard

### System-wide performance indicators
```sql
-- Generate comprehensive performance metrics
WITH performance_metrics AS (
    SELECT 
        'ENTITY_METRICS' as category,
        COUNT(*) as total_count,
        COUNT(CASE WHEN TOUCHED = TRUE THEN 1 END) as active_count,
        COUNT(CASE WHEN SPAWNED_ONLY_IN_DB = TRUE THEN 1 END) as db_only_count
    FROM ENTITIES
    
    UNION ALL
    
    SELECT 
        'FLEET_METRICS' as category,
        COUNT(*) as total_count,
        COUNT(CASE WHEN MISSION_STRING = 'ATTACK' THEN 1 END) as active_count,
        0 as db_only_count
    FROM FLEETS
    
    UNION ALL
    
    SELECT 
        'PLAYER_METRICS' as category,
        COUNT(*) as total_count,
        COUNT(CASE WHEN PERMISSION > 0 THEN 1 END) as active_count,
        0 as db_only_count
    FROM PLAYERS
    
    UNION ALL
    
    SELECT 
        'MESSAGE_METRICS' as category,
        COUNT(*) as total_count,
        COUNT(CASE WHEN read = TRUE THEN 1 END) as active_count,
        0 as db_only_count
    FROM PLAYER_MESSAGES
),
table_sizes AS (
    SELECT 
        'ENTITIES' as table_name,
        COUNT(*) as row_count
    FROM ENTITIES
    
    UNION ALL
    
    SELECT 'PLAYERS', COUNT(*) FROM PLAYERS
    UNION ALL
    SELECT 'FLEETS', COUNT(*) FROM FLEETS
    UNION ALL
    SELECT 'SECTORS', COUNT(*) FROM SECTORS
    UNION ALL
    SELECT 'SYSTEMS', COUNT(*) FROM SYSTEMS
    UNION ALL
    SELECT 'TRADE_NODES', COUNT(*) FROM TRADE_NODES
    UNION ALL
    SELECT 'PLAYER_MESSAGES', COUNT(*) FROM PLAYER_MESSAGES
    UNION ALL
    SELECT 'FTL', COUNT(*) FROM FTL
    UNION ALL
    SELECT 'EFFECTS', COUNT(*) FROM EFFECTS
)
SELECT 
    'PERFORMANCE_DASHBOARD' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    (SELECT SUM(row_count) FROM table_sizes) as total_database_rows,
    (SELECT row_count FROM table_sizes WHERE table_name = 'ENTITIES') as entity_count,
    (SELECT row_count FROM table_sizes WHERE table_name = 'PLAYERS') as player_count,
    (SELECT row_count FROM table_sizes WHERE table_name = 'FLEETS') as fleet_count,
    (SELECT active_count FROM performance_metrics WHERE category = 'ENTITY_METRICS') as active_entities,
    (SELECT active_count FROM performance_metrics WHERE category = 'PLAYER_METRICS') as active_players,
    ROUND((SELECT active_count * 100.0 / total_count FROM performance_metrics WHERE category = 'ENTITY_METRICS'), 2) as entity_activity_rate,
    ROUND((SELECT active_count * 100.0 / total_count FROM performance_metrics WHERE category = 'MESSAGE_METRICS'), 2) as message_read_rate;
```

---

## Changelog

| Version | Date       | Author       | Description                                               |
|---------|------------|--------------|-----------------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of advanced multi-table example queries  |

[INDEX](./INDEX.md) | [ADVANCED](./INDEX.md#advanced-queries)