# FLEET_MEMBERS - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) database with advanced features including fleet composition analysis, tactical formation optimization, and member role management. **All queries focus exclusively on the FLEET_MEMBERS table.**

---

## Basic Fleet Member Queries

### Find members by fleet, entity, and position
```sql
-- Search fleet members by specific fleet
SELECT fm.ID, fm.ENTITY_ID, fm.MISSION_STRING, fm.LIST_INDEX, fm.DOCKED_TO, fm.FACTION
FROM FLEET_MEMBERS fm
WHERE fm.FLEET_ID = ?  -- Specific fleet ID
ORDER BY fm.LIST_INDEX;
```

```sql
-- Find fleets containing specific entity
SELECT fm.FLEET_ID, fm.LIST_INDEX, fm.MISSION_STRING, fm.DOCKED_TO, fm.FACTION
FROM FLEET_MEMBERS fm
WHERE fm.ENTITY_ID = ?  -- Specific entity ID
ORDER BY fm.FLEET_ID, fm.LIST_INDEX;
```

```sql
-- Search members by position in fleet
SELECT fm.FLEET_ID, fm.ENTITY_ID, fm.MISSION_STRING, fm.DOCKED_TO, fm.FACTION
FROM FLEET_MEMBERS fm
WHERE fm.LIST_INDEX BETWEEN ? AND ?  -- Position range
ORDER BY fm.FLEET_ID, fm.LIST_INDEX;
```

```sql
-- Find docked fleet members
SELECT fm.FLEET_ID, fm.ENTITY_ID, fm.DOCKED_TO, fm.LIST_INDEX, fm.MISSION_STRING
FROM FLEET_MEMBERS fm
WHERE fm.DOCKED_TO != -1  -- Currently docked
ORDER BY fm.DOCKED_TO, fm.LIST_INDEX;
```

### Count members by fleet composition and docking status
```sql
-- Fleet size distribution analysis
SELECT 
    CASE 
        WHEN member_count = 1 THEN 'SOLO'
        WHEN member_count BETWEEN 2 AND 3 THEN 'PAIR/WING'
        WHEN member_count BETWEEN 4 AND 8 THEN 'SQUADRON'
        WHEN member_count BETWEEN 9 AND 16 THEN 'FLIGHT'
        WHEN member_count BETWEEN 17 AND 32 THEN 'WING'
        ELSE 'TASK_FORCE'
    END as fleet_size_category,
    COUNT(*) as fleet_count,
    AVG(member_count) as avg_members,
    MIN(member_count) as min_members,
    MAX(member_count) as max_members
FROM (
    SELECT fm.FLEET_ID, COUNT(*) as member_count
    FROM FLEET_MEMBERS fm
    GROUP BY fm.FLEET_ID
) fleet_sizes
GROUP BY 
    CASE 
        WHEN member_count = 1 THEN 'SOLO'
        WHEN member_count BETWEEN 2 AND 3 THEN 'PAIR/WING'
        WHEN member_count BETWEEN 4 AND 8 THEN 'SQUADRON'
        WHEN member_count BETWEEN 9 AND 16 THEN 'FLIGHT'
        WHEN member_count BETWEEN 17 AND 32 THEN 'WING'
        ELSE 'TASK_FORCE'
    END
ORDER BY MIN(member_count);
```

```sql
-- Docking status analysis
SELECT 
    CASE 
        WHEN fm.DOCKED_TO = -1 THEN 'INDEPENDENT'
        ELSE 'DOCKED'
    END as docking_status,
    COUNT(*) as member_count,
    COUNT(DISTINCT fm.FLEET_ID) as affected_fleets,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM FLEET_MEMBERS), 2) as percentage
FROM FLEET_MEMBERS fm
GROUP BY 
    CASE 
        WHEN fm.DOCKED_TO = -1 THEN 'INDEPENDENT'
        ELSE 'DOCKED'
    END
ORDER BY member_count DESC;
```

```sql
-- Faction distribution in fleet members
SELECT fm.FACTION,
       CASE 
           WHEN fm.FACTION = 0 THEN 'NEUTRAL'
           WHEN fm.FACTION = -10000000 THEN 'TRADING_GUILD'
           WHEN fm.FACTION = -9999999 THEN 'OUTCASTS'
           WHEN fm.FACTION = -9999998 THEN 'SCAVENGERS'
           WHEN fm.FACTION > 0 THEN 'PLAYER_FACTION_' || fm.FACTION
           ELSE 'UNKNOWN'
       END as faction_type,
       COUNT(*) as member_count,
       COUNT(DISTINCT fm.FLEET_ID) as fleets_with_faction,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM FLEET_MEMBERS), 2) as percentage
FROM FLEET_MEMBERS fm
GROUP BY fm.FACTION
ORDER BY member_count DESC;
```

---

## Fleet Composition and Structure Analysis

### Fleet composition patterns and member roles
```sql
-- Comprehensive fleet composition analysis
WITH fleet_composition AS (
    SELECT fm.FLEET_ID,
           COUNT(*) as total_members,
           COUNT(CASE WHEN fm.DOCKED_TO = -1 THEN 1 END) as independent_members,
           COUNT(CASE WHEN fm.DOCKED_TO != -1 THEN 1 END) as docked_members,
           COUNT(DISTINCT fm.FACTION) as faction_diversity,
           COUNT(CASE WHEN fm.MISSION_STRING IS NOT NULL THEN 1 END) as members_with_missions,
           MIN(fm.LIST_INDEX) as min_index,
           MAX(fm.LIST_INDEX) as max_index,
           AVG(fm.LIST_INDEX) as avg_index
    FROM FLEET_MEMBERS fm
    GROUP BY fm.FLEET_ID
)
SELECT fc.FLEET_ID,
       fc.total_members,
       fc.independent_members,
       fc.docked_members,
       ROUND(fc.docked_members * 100.0 / fc.total_members, 2) as docking_percentage,
       fc.faction_diversity,
       fc.members_with_missions,
       CASE 
           WHEN fc.docked_members * 100.0 / fc.total_members >= 75 THEN 'CARRIER_BASED'
           WHEN fc.docked_members * 100.0 / fc.total_members >= 50 THEN 'MIXED_FORMATION'
           WHEN fc.docked_members * 100.0 / fc.total_members >= 25 THEN 'SOME_DOCKING'
           ELSE 'INDEPENDENT_FORMATION'
       END as formation_type,
       CASE 
           WHEN fc.faction_diversity = 1 THEN 'HOMOGENEOUS'
           WHEN fc.faction_diversity <= 3 THEN 'MIXED'
           ELSE 'DIVERSE'
       END as faction_composition
FROM fleet_composition fc
ORDER BY fc.total_members DESC, fc.docking_percentage DESC;
```

```sql
-- Member role analysis based on mission strings
WITH role_analysis AS (
    SELECT fm.*,
           CASE 
               WHEN fm.MISSION_STRING LIKE '%COMMAND%' OR fm.MISSION_STRING LIKE '%FLAGSHIP%' THEN 'COMMAND'
               WHEN fm.MISSION_STRING LIKE '%ATTACK%' OR fm.MISSION_STRING LIKE '%ASSAULT%' THEN 'ASSAULT'
               WHEN fm.MISSION_STRING LIKE '%DEFENSE%' OR fm.MISSION_STRING LIKE '%GUARD%' THEN 'DEFENSE'
               WHEN fm.MISSION_STRING LIKE '%ESCORT%' OR fm.MISSION_STRING LIKE '%PROTECT%' THEN 'ESCORT'
               WHEN fm.MISSION_STRING LIKE '%SCOUT%' OR fm.MISSION_STRING LIKE '%RECON%' THEN 'RECONNAISSANCE'
               WHEN fm.MISSION_STRING LIKE '%SUPPORT%' OR fm.MISSION_STRING LIKE '%REPAIR%' THEN 'SUPPORT'
               WHEN fm.MISSION_STRING LIKE '%MINING%' OR fm.MISSION_STRING LIKE '%HARVEST%' THEN 'ECONOMIC'
               WHEN fm.MISSION_STRING LIKE '%FIGHTER%' OR fm.MISSION_STRING LIKE '%INTERCEPT%' THEN 'FIGHTER'
               WHEN fm.MISSION_STRING IS NULL THEN 'UNASSIGNED'
               ELSE 'OTHER'
           END as role_category
    FROM FLEET_MEMBERS fm
)
SELECT ra.role_category,
       COUNT(*) as member_count,
       COUNT(DISTINCT ra.FLEET_ID) as fleets_with_role,
       AVG(ra.LIST_INDEX) as avg_position_index,
       COUNT(CASE WHEN ra.DOCKED_TO != -1 THEN 1 END) as docked_in_role,
       ROUND(COUNT(CASE WHEN ra.DOCKED_TO != -1 THEN 1 END) * 100.0 / COUNT(*), 2) as docking_rate_in_role
FROM role_analysis ra
GROUP BY ra.role_category
ORDER BY member_count DESC;
```

### Fleet hierarchy and command structure analysis
```sql
-- Fleet command hierarchy based on LIST_INDEX
WITH command_hierarchy AS (
    SELECT fm.FLEET_ID,
           fm.ENTITY_ID,
           fm.LIST_INDEX,
           fm.MISSION_STRING,
           fm.DOCKED_TO,
           CASE 
               WHEN fm.LIST_INDEX = 0 THEN 'FLAGSHIP'
               WHEN fm.LIST_INDEX BETWEEN 1 AND 3 THEN 'SENIOR_COMMAND'
               WHEN fm.LIST_INDEX BETWEEN 4 AND 8 THEN 'FIELD_COMMAND'
               WHEN fm.LIST_INDEX BETWEEN 9 AND 16 THEN 'SQUADRON_LEVEL'
               ELSE 'ENLISTED'
           END as command_level
    FROM FLEET_MEMBERS fm
)
SELECT ch.command_level,
       COUNT(*) as member_count,
       COUNT(DISTINCT ch.FLEET_ID) as fleets_with_level,
       AVG(ch.LIST_INDEX) as avg_index_in_level,
       COUNT(CASE WHEN ch.DOCKED_TO != -1 THEN 1 END) as docked_members,
       COUNT(CASE WHEN ch.MISSION_STRING IS NOT NULL THEN 1 END) as members_with_missions
FROM command_hierarchy ch
GROUP BY ch.command_level
ORDER BY AVG(ch.LIST_INDEX);
```

```sql
-- Fleet size impact on structure
WITH fleet_structure AS (
    SELECT fm.FLEET_ID,
           COUNT(*) as fleet_size,
           MAX(fm.LIST_INDEX) as max_index,
           COUNT(CASE WHEN fm.LIST_INDEX <= 5 THEN 1 END) as core_members,
           COUNT(CASE WHEN fm.DOCKED_TO != -1 THEN 1 END) as docked_members,
           COUNT(DISTINCT fm.FACTION) as faction_count
    FROM FLEET_MEMBERS fm
    GROUP BY fm.FLEET_ID
)
SELECT 
    CASE 
        WHEN fs.fleet_size <= 3 THEN 'SMALL'
        WHEN fs.fleet_size <= 8 THEN 'MEDIUM'
        WHEN fs.fleet_size <= 16 THEN 'LARGE'
        ELSE 'MASSIVE'
    END as size_category,
    COUNT(*) as fleet_count,
    AVG(fs.fleet_size) as avg_size,
    AVG(fs.max_index) as avg_max_index,
    AVG(fs.core_members) as avg_core_members,
    AVG(fs.docked_members) as avg_docked_members,
    AVG(fs.faction_count) as avg_faction_diversity
FROM fleet_structure fs
GROUP BY 
    CASE 
        WHEN fs.fleet_size <= 3 THEN 'SMALL'
        WHEN fs.fleet_size <= 8 THEN 'MEDIUM'
        WHEN fs.fleet_size <= 16 THEN 'LARGE'
        ELSE 'MASSIVE'
    END
ORDER BY AVG(fs.fleet_size);
```

---

## Docking Hierarchies and Carrier Operations

### Docking relationship analysis and carrier structures
```sql
-- Comprehensive docking hierarchy analysis
WITH docking_relationships AS (
    SELECT fm.FLEET_ID,
           fm.ENTITY_ID,
           fm.DOCKED_TO,
           fm.LIST_INDEX,
           fm.MISSION_STRING,
           CASE 
               WHEN fm.DOCKED_TO = -1 THEN 'INDEPENDENT'
               ELSE 'DOCKED'
           END as docking_status
    FROM FLEET_MEMBERS fm
),
carrier_analysis AS (
    SELECT dr.DOCKED_TO as carrier_entity,
           COUNT(*) as docked_count,
           dr.FLEET_ID,
           STRING_AGG(dr.ENTITY_ID::TEXT, ', ') as docked_entities
    FROM docking_relationships dr
    WHERE dr.docking_status = 'DOCKED'
    GROUP BY dr.DOCKED_TO, dr.FLEET_ID
)
SELECT ca.FLEET_ID,
       ca.carrier_entity,
       ca.docked_count,
       CASE 
           WHEN ca.docked_count >= 10 THEN 'SUPERCARRIER'
           WHEN ca.docked_count >= 5 THEN 'CARRIER'
           WHEN ca.docked_count >= 3 THEN 'ESCORT_CARRIER'
           WHEN ca.docked_count >= 2 THEN 'SMALL_CARRIER'
           ELSE 'SINGLE_DOCK'
       END as carrier_class,
       ca.docked_entities
FROM carrier_analysis ca
ORDER BY ca.docked_count DESC, ca.FLEET_ID;
```

```sql
-- Docking chain depth analysis
WITH RECURSIVE docking_chain AS (
    -- Start with independent vessels (carriers/motherships)
    SELECT fm.FLEET_ID, fm.ENTITY_ID, fm.DOCKED_TO, fm.LIST_INDEX, 0 as dock_depth
    FROM FLEET_MEMBERS fm
    WHERE fm.DOCKED_TO = -1
    
    UNION ALL
    
    -- Recursively find docked vessels
    SELECT fm.FLEET_ID, fm.ENTITY_ID, fm.DOCKED_TO, fm.LIST_INDEX, dc.dock_depth + 1
    FROM FLEET_MEMBERS fm
    JOIN docking_chain dc ON fm.DOCKED_TO = dc.ENTITY_ID
    WHERE dc.dock_depth < 5  -- Prevent infinite recursion
)
SELECT dc.dock_depth,
       COUNT(*) as entities_at_depth,
       COUNT(DISTINCT dc.FLEET_ID) as fleets_with_depth,
       AVG(dc.LIST_INDEX) as avg_list_index_at_depth
FROM docking_chain dc
GROUP BY dc.dock_depth
ORDER BY dc.dock_depth;
```

```sql
-- Carrier efficiency analysis
WITH carrier_efficiency AS (
    SELECT fm_carrier.FLEET_ID,
           fm_carrier.ENTITY_ID as carrier_id,
           COUNT(fm_docked.ENTITY_ID) as carried_vessels,
           fm_carrier.LIST_INDEX as carrier_index,
           fm_carrier.MISSION_STRING as carrier_mission
    FROM FLEET_MEMBERS fm_carrier
    LEFT JOIN FLEET_MEMBERS fm_docked ON fm_carrier.ENTITY_ID = fm_docked.DOCKED_TO
    WHERE fm_carrier.DOCKED_TO = -1  -- Only independent carriers
    GROUP BY fm_carrier.FLEET_ID, fm_carrier.ENTITY_ID, fm_carrier.LIST_INDEX, fm_carrier.MISSION_STRING
    HAVING COUNT(fm_docked.ENTITY_ID) > 0  -- Only actual carriers
)
SELECT ce.FLEET_ID,
       ce.carrier_id,
       ce.carried_vessels,
       ce.carrier_index,
       ce.carrier_mission,
       CASE 
           WHEN ce.carried_vessels >= 8 THEN 'HIGH_CAPACITY'
           WHEN ce.carried_vessels >= 4 THEN 'MEDIUM_CAPACITY'
           WHEN ce.carried_vessels >= 2 THEN 'LOW_CAPACITY'
           ELSE 'MINIMAL_CAPACITY'
       END as capacity_rating
FROM carrier_efficiency ce
ORDER BY ce.carried_vessels DESC, ce.FLEET_ID;
```

### Tactical formation analysis
```sql
-- Formation pattern recognition based on LIST_INDEX distribution
WITH formation_analysis AS (
    SELECT fm.FLEET_ID,
           COUNT(*) as total_members,
           MIN(fm.LIST_INDEX) as min_index,
           MAX(fm.LIST_INDEX) as max_index,
           AVG(fm.LIST_INDEX) as avg_index,
           STDDEV_POP(fm.LIST_INDEX) as index_spread,
           COUNT(CASE WHEN fm.DOCKED_TO = -1 THEN 1 END) as independent_count,
           COUNT(CASE WHEN fm.LIST_INDEX <= 3 THEN 1 END) as command_tier_count
    FROM FLEET_MEMBERS fm
    GROUP BY fm.FLEET_ID
    HAVING COUNT(*) >= 3  -- Only analyze fleets with meaningful formations
)
SELECT fa.FLEET_ID,
       fa.total_members,
       fa.independent_count,
       fa.command_tier_count,
       ROUND(fa.avg_index, 2) as avg_position,
       ROUND(fa.index_spread, 2) as formation_spread,
       CASE 
           WHEN fa.index_spread <= 2 THEN 'TIGHT_FORMATION'
           WHEN fa.index_spread <= 5 THEN 'STANDARD_FORMATION'
           WHEN fa.index_spread <= 10 THEN 'LOOSE_FORMATION'
           ELSE 'DISPERSED_FORMATION'
       END as formation_type,
       CASE 
           WHEN fa.command_tier_count * 100.0 / fa.total_members >= 50 THEN 'COMMAND_HEAVY'
           WHEN fa.command_tier_count * 100.0 / fa.total_members >= 25 THEN 'BALANCED_COMMAND'
           ELSE 'ENLISTED_HEAVY'
       END as command_structure
FROM formation_analysis fa
ORDER BY fa.total_members DESC, formation_spread;
```

```sql
-- Wing and squadron organization analysis
WITH squadron_organization AS (
    SELECT fm.FLEET_ID,
           CASE 
               WHEN fm.LIST_INDEX % 4 = 0 THEN 'ALPHA_WING'
               WHEN fm.LIST_INDEX % 4 = 1 THEN 'BETA_WING'
               WHEN fm.LIST_INDEX % 4 = 2 THEN 'GAMMA_WING'
               ELSE 'DELTA_WING'
           END as wing_assignment,
           COUNT(*) as wing_size,
           AVG(fm.LIST_INDEX) as avg_wing_index,
           COUNT(CASE WHEN fm.DOCKED_TO != -1 THEN 1 END) as docked_in_wing
    FROM FLEET_MEMBERS fm
    GROUP BY fm.FLEET_ID, 
             CASE 
                 WHEN fm.LIST_INDEX % 4 = 0 THEN 'ALPHA_WING'
                 WHEN fm.LIST_INDEX % 4 = 1 THEN 'BETA_WING'
                 WHEN fm.LIST_INDEX % 4 = 2 THEN 'GAMMA_WING'
                 ELSE 'DELTA_WING'
             END
    HAVING COUNT(*) >= 2  -- Only meaningful wing sizes
)
SELECT so.wing_assignment,
       COUNT(*) as fleet_count_with_wing,
       AVG(so.wing_size) as avg_wing_size,
       AVG(so.docked_in_wing) as avg_docked_per_wing,
       ROUND(AVG(so.docked_in_wing * 100.0 / so.wing_size), 2) as avg_docking_rate_in_wing
FROM squadron_organization so
GROUP BY so.wing_assignment
ORDER BY so.wing_assignment;
```

---

## Mission Assignment and Role Management

### Member mission distribution and specialization
```sql
-- Mission assignment patterns analysis
WITH mission_patterns AS (
    SELECT fm.*,
           CASE 
               WHEN fm.MISSION_STRING IS NULL THEN 'NO_MISSION'
               WHEN LENGTH(fm.MISSION_STRING) <= 20 THEN 'SHORT_MISSION'
               WHEN LENGTH(fm.MISSION_STRING) <= 50 THEN 'STANDARD_MISSION'
               ELSE 'DETAILED_MISSION'
           END as mission_complexity,
           CASE 
               WHEN fm.LIST_INDEX <= 2 THEN 'COMMAND_LEVEL'
               WHEN fm.LIST_INDEX <= 8 THEN 'OFFICER_LEVEL'
               ELSE 'ENLISTED_LEVEL'
           END as hierarchy_level
    FROM FLEET_MEMBERS fm
)
SELECT mp.mission_complexity,
       mp.hierarchy_level,
       COUNT(*) as member_count,
       COUNT(DISTINCT mp.FLEET_ID) as fleets_affected,
       AVG(LENGTH(mp.MISSION_STRING)) as avg_mission_length,
       COUNT(CASE WHEN mp.DOCKED_TO != -1 THEN 1 END) as docked_members
FROM mission_patterns mp
GROUP BY mp.mission_complexity, mp.hierarchy_level
ORDER BY member_count DESC;
```

```sql
-- Specialization analysis based on mission keywords
WITH specialization_analysis AS (
    SELECT fm.*,
           CASE 
               WHEN fm.MISSION_STRING LIKE '%ATTACK%' OR fm.MISSION_STRING LIKE '%ASSAULT%' THEN 'OFFENSIVE'
               WHEN fm.MISSION_STRING LIKE '%DEFEND%' OR fm.MISSION_STRING LIKE '%GUARD%' THEN 'DEFENSIVE'
               WHEN fm.MISSION_STRING LIKE '%SCOUT%' OR fm.MISSION_STRING LIKE '%RECON%' THEN 'INTELLIGENCE'
               WHEN fm.MISSION_STRING LIKE '%SUPPORT%' OR fm.MISSION_STRING LIKE '%REPAIR%' THEN 'LOGISTICS'
               WHEN fm.MISSION_STRING LIKE '%MINING%' OR fm.MISSION_STRING LIKE '%HARVEST%' THEN 'ECONOMIC'
               WHEN fm.MISSION_STRING LIKE '%TRANSPORT%' OR fm.MISSION_STRING LIKE '%CARGO%' THEN 'TRANSPORT'
               WHEN fm.MISSION_STRING LIKE '%ELECTRONIC%' OR fm.MISSION_STRING LIKE '%ECM%' THEN 'ELECTRONIC_WARFARE'
               WHEN fm.MISSION_STRING IS NULL THEN 'UNSPECIALIZED'
               ELSE 'OTHER_SPECIALTY'
           END as specialization
    FROM FLEET_MEMBERS fm
)
SELECT sa.specialization,
       COUNT(*) as specialist_count,
       COUNT(DISTINCT sa.FLEET_ID) as fleets_with_specialty,
       AVG(sa.LIST_INDEX) as avg_position_index,
       COUNT(CASE WHEN sa.DOCKED_TO != -1 THEN 1 END) as docked_specialists,
       ROUND(COUNT(CASE WHEN sa.DOCKED_TO != -1 THEN 1 END) * 100.0 / COUNT(*), 2) as docking_rate
FROM specialization_analysis sa
GROUP BY sa.specialization
ORDER BY specialist_count DESC;
```

```sql
-- Fleet specialization diversity
WITH fleet_diversity AS (
    SELECT fm.FLEET_ID,
           COUNT(*) as total_members,
           COUNT(DISTINCT 
               CASE 
                   WHEN fm.MISSION_STRING LIKE '%ATTACK%' THEN 'OFFENSIVE'
                   WHEN fm.MISSION_STRING LIKE '%DEFEND%' THEN 'DEFENSIVE'
                   WHEN fm.MISSION_STRING LIKE '%SCOUT%' THEN 'INTELLIGENCE'
                   WHEN fm.MISSION_STRING LIKE '%SUPPORT%' THEN 'LOGISTICS'
                   WHEN fm.MISSION_STRING LIKE '%MINING%' THEN 'ECONOMIC'
                   WHEN fm.MISSION_STRING LIKE '%TRANSPORT%' THEN 'TRANSPORT'
                   WHEN fm.MISSION_STRING IS NULL THEN 'UNSPECIALIZED'
                   ELSE 'OTHER'
               END
           ) as specialization_types,
           COUNT(CASE WHEN fm.MISSION_STRING IS NOT NULL THEN 1 END) as specialized_members
    FROM FLEET_MEMBERS fm
    GROUP BY fm.FLEET_ID
    HAVING COUNT(*) >= 3
)
SELECT fd.FLEET_ID,
       fd.total_members,
       fd.specialization_types,
       fd.specialized_members,
       ROUND(fd.specialized_members * 100.0 / fd.total_members, 2) as specialization_rate,
       CASE 
           WHEN fd.specialization_types >= 5 THEN 'HIGHLY_DIVERSE'
           WHEN fd.specialization_types >= 3 THEN 'DIVERSE'
           WHEN fd.specialization_types >= 2 THEN 'MODERATELY_DIVERSE'
           ELSE 'SPECIALIZED'
       END as diversity_classification
FROM fleet_diversity fd
ORDER BY fd.specialization_types DESC, fd.total_members DESC;
```

---

## Cross-Fleet and Entity Integration Analysis

### Multi-fleet entity participation and shared resources
```sql
-- Entities participating in multiple fleets (unusual but possible)
WITH multi_fleet_entities AS (
    SELECT fm.ENTITY_ID,
           COUNT(DISTINCT fm.FLEET_ID) as fleet_count,
           STRING_AGG(DISTINCT fm.FLEET_ID::TEXT, ', ') as fleet_list,
           AVG(fm.LIST_INDEX) as avg_position,
           COUNT(CASE WHEN fm.DOCKED_TO != -1 THEN 1 END) as docked_instances
    FROM FLEET_MEMBERS fm
    GROUP BY fm.ENTITY_ID
    HAVING COUNT(DISTINCT fm.FLEET_ID) > 1
)
SELECT mfe.ENTITY_ID,
       mfe.fleet_count,
       mfe.fleet_list,
       ROUND(mfe.avg_position, 2) as avg_position,
       mfe.docked_instances,
       'MULTI_FLEET_ENTITY' as status
FROM multi_fleet_entities mfe
ORDER BY mfe.fleet_count DESC, mfe.ENTITY_ID;
```

```sql
-- Fleet interconnectedness through shared entities
WITH fleet_connections AS (
    SELECT fm1.FLEET_ID as fleet1,
           fm2.FLEET_ID as fleet2,
           COUNT(*) as shared_entities
    FROM FLEET_MEMBERS fm1
    JOIN FLEET_MEMBERS fm2 ON fm1.ENTITY_ID = fm2.ENTITY_ID
    WHERE fm1.FLEET_ID < fm2.FLEET_ID  -- Avoid duplicates
    GROUP BY fm1.FLEET_ID, fm2.FLEET_ID
)
SELECT fc.fleet1,
       fc.fleet2,
       fc.shared_entities,
       CASE 
           WHEN fc.shared_entities >= 5 THEN 'HIGHLY_CONNECTED'
           WHEN fc.shared_entities >= 3 THEN 'MODERATELY_CONNECTED'
           WHEN fc.shared_entities >= 2 THEN 'LIGHTLY_CONNECTED'
           ELSE 'MINIMALLY_CONNECTED'
       END as connection_strength
FROM fleet_connections fc
ORDER BY fc.shared_entities DESC;
```

```sql
-- Cross-faction fleet analysis
WITH cross_faction_fleets AS (
    SELECT fm.FLEET_ID,
           COUNT(DISTINCT fm.FACTION) as faction_count,
           COUNT(*) as total_members,
           STRING_AGG(DISTINCT fm.FACTION::TEXT, ', ') as faction_list,
           COUNT(CASE WHEN fm.FACTION = 0 THEN 1 END) as neutral_members
    FROM FLEET_MEMBERS fm
    GROUP BY fm.FLEET_ID
    HAVING COUNT(DISTINCT fm.FACTION) > 1
)
SELECT cff.FLEET_ID,
       cff.faction_count,
       cff.total_members,
       cff.faction_list,
       cff.neutral_members,
       ROUND(cff.neutral_members * 100.0 / cff.total_members, 2) as neutral_percentage,
       CASE 
           WHEN cff.faction_count >= 4 THEN 'MULTI_FACTION_COALITION'
           WHEN cff.faction_count = 3 THEN 'TRI_FACTION_ALLIANCE'
           ELSE 'BI_FACTION_COOPERATION'
       END as cooperation_type
FROM cross_faction_fleets cff
ORDER BY cff.faction_count DESC, cff.total_members DESC;
```

---

## Data Management and Maintenance

### Fleet member data validation and integrity
```sql
-- Comprehensive fleet member data validation
WITH validation_checks AS (
    -- Check 1: Orphaned fleet references
    SELECT 'ORPHANED_FLEET_REFERENCES' as check_type, COUNT(*) as issues
    FROM FLEET_MEMBERS fm
    WHERE NOT EXISTS (SELECT 1 FROM FLEETS f WHERE f.ID = fm.FLEET_ID)
    
    UNION ALL
    
    -- Check 2: Orphaned entity references
    SELECT 'ORPHANED_ENTITY_REFERENCES' as check_type, COUNT(*) as issues
    FROM FLEET_MEMBERS fm
    WHERE NOT EXISTS (SELECT 1 FROM ENTITIES e WHERE e.ID = fm.ENTITY_ID)
    
    UNION ALL
    
    -- Check 3: Invalid docking references
    SELECT 'INVALID_DOCKING_REFERENCES' as check_type, COUNT(*) as issues
    FROM FLEET_MEMBERS fm
    WHERE fm.DOCKED_TO != -1
      AND NOT EXISTS (SELECT 1 FROM ENTITIES e WHERE e.ID = fm.DOCKED_TO)
    
    UNION ALL
    
    -- Check 4: Circular docking references
    SELECT 'CIRCULAR_DOCKING_REFERENCES' as check_type, COUNT(*) as issues
    FROM FLEET_MEMBERS fm
    WHERE fm.DOCKED_TO = fm.ENTITY_ID
    
    UNION ALL
    
    -- Check 5: Negative list indices
    SELECT 'NEGATIVE_LIST_INDICES' as check_type, COUNT(*) as issues
    FROM FLEET_MEMBERS fm
    WHERE fm.LIST_INDEX < 0
    
    UNION ALL
    
    -- Check 6: Duplicate memberships (same entity in same fleet)
    SELECT 'DUPLICATE_MEMBERSHIPS' as check_type, 
           COUNT(*) - COUNT(DISTINCT fm.FLEET_ID || ',' || fm.ENTITY_ID) as issues
    FROM FLEET_MEMBERS fm
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
-- Fleet member storage and performance analysis
SELECT 
    'FLEET_MEMBER_STORAGE_ANALYSIS' as metric_type,
    COUNT(*) as total_members,
    COUNT(DISTINCT FLEET_ID) as unique_fleets,
    COUNT(DISTINCT ENTITY_ID) as unique_entities,
    COUNT(CASE WHEN DOCKED_TO != -1 THEN 1 END) as docked_members,
    COUNT(CASE WHEN MISSION_STRING IS NOT NULL THEN 1 END) as members_with_missions,
    COUNT(DISTINCT FACTION) as unique_factions,
    AVG(LIST_INDEX) as avg_list_index,
    MAX(LIST_INDEX) as max_list_index,
    AVG(LENGTH(MISSION_STRING)) as avg_mission_length
FROM FLEET_MEMBERS;
```

### Maintenance operations and optimization
```sql
-- Identify cleanup candidates
-- Note: These are analysis queries; actual cleanup requires careful consideration

-- Find members with broken fleet references
SELECT fm.ID, fm.FLEET_ID, fm.ENTITY_ID, fm.LIST_INDEX,
       'BROKEN_FLEET_REFERENCE' as issue_type
FROM FLEET_MEMBERS fm
WHERE NOT EXISTS (SELECT 1 FROM FLEETS f WHERE f.ID = fm.FLEET_ID)
ORDER BY fm.FLEET_ID, fm.LIST_INDEX;
```

```sql
-- Find members with broken entity references
SELECT fm.ID, fm.FLEET_ID, fm.ENTITY_ID, fm.LIST_INDEX,
       'BROKEN_ENTITY_REFERENCE' as issue_type
FROM FLEET_MEMBERS fm
WHERE NOT EXISTS (SELECT 1 FROM ENTITIES e WHERE e.ID = fm.ENTITY_ID)
ORDER BY fm.FLEET_ID, fm.LIST_INDEX;
```

```sql
-- Find members with invalid docking references
SELECT fm.ID, fm.FLEET_ID, fm.ENTITY_ID, fm.DOCKED_TO,
       'INVALID_DOCKING_REFERENCE' as issue_type
FROM FLEET_MEMBERS fm
WHERE fm.DOCKED_TO != -1
  AND NOT EXISTS (SELECT 1 FROM ENTITIES e WHERE e.ID = fm.DOCKED_TO)
ORDER BY fm.FLEET_ID, fm.LIST_INDEX;
```

```sql
-- Performance summary after maintenance
SELECT 
    'FLEET_MEMBER_MAINTENANCE_SUMMARY' as operation,
    COUNT(*) as total_members,
    COUNT(DISTINCT FLEET_ID) as active_fleets,
    COUNT(DISTINCT ENTITY_ID) as unique_entities,
    COUNT(CASE WHEN DOCKED_TO != -1 THEN 1 END) as docked_members,
    COUNT(CASE WHEN MISSION_STRING IS NOT NULL THEN 1 END) as specialized_members,
    COUNT(CASE WHEN FACTION != 0 THEN 1 END) as factioned_members
FROM FLEET_MEMBERS;
```

---

## Reporting and Tactical Intelligence

### Comprehensive fleet composition report
```sql
-- Complete fleet composition system report
SELECT 
    'FLEET_COMPOSITION_SYSTEM_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    COUNT(*) as total_fleet_members,
    COUNT(DISTINCT FLEET_ID) as active_fleets,
    COUNT(DISTINCT ENTITY_ID) as unique_entities_in_fleets,
    COUNT(CASE WHEN DOCKED_TO != -1 THEN 1 END) as docked_members,
    COUNT(CASE WHEN MISSION_STRING IS NOT NULL THEN 1 END) as members_with_missions,
    COUNT(DISTINCT FACTION) as factions_represented,
    AVG(LIST_INDEX) as avg_formation_position,
    MAX(LIST_INDEX) as largest_fleet_size_indicator
FROM FLEET_MEMBERS;
```

```sql
-- Top fleet compositions by size and complexity
WITH fleet_metrics AS (
    SELECT fm.FLEET_ID,
           COUNT(*) as member_count,
           COUNT(CASE WHEN fm.DOCKED_TO != -1 THEN 1 END) as docked_count,
           COUNT(CASE WHEN fm.MISSION_STRING IS NOT NULL THEN 1 END) as specialized_count,
           COUNT(DISTINCT fm.FACTION) as faction_diversity,
           MAX(fm.LIST_INDEX) as formation_depth
    FROM FLEET_MEMBERS fm
    GROUP BY fm.FLEET_ID
)
SELECT fm.FLEET_ID,
       fm.member_count,
       fm.docked_count,
       fm.specialized_count,
       fm.faction_diversity,
       fm.formation_depth,
       ROUND(fm.docked_count * 100.0 / fm.member_count, 2) as docking_percentage,
       ROUND(fm.specialized_count * 100.0 / fm.member_count, 2) as specialization_percentage
FROM fleet_metrics fm
ORDER BY fm.member_count DESC, fm.formation_depth DESC
LIMIT 20;
```

---

## Changelog

| Version | Date       | Author       | Description                                          |
|---------|------------|--------------|------------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of FLEET_MEMBERS example queries   |

[INDEX](./INDEX.md) | [FLEET_MEMBERS](./TABLE_FLEET_MEMBERS.md)