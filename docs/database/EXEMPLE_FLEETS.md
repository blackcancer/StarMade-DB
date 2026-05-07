# FLEETS - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) database with advanced features including fleet command analysis, tactical coordination, and strategic fleet management. **All queries focus exclusively on the FLEETS table.**

---

## Basic Fleet Queries

### Find fleets by ownership, status, and composition
```sql
-- Search fleets by specific owner
SELECT f.ID, f.NAME, f.FLAGSHIP_ID, f.MISSION_STRING, f.COMBAT_SETTING, f.FACTION_ACCESS
FROM FLEETS f
WHERE f.OWNER = ?  -- Specific player UID
ORDER BY f.ID;
```

```sql
-- Find fleets by mission status
SELECT f.ID, f.NAME, f.OWNER, f.FLAGSHIP_ID, f.MISSION_STRING, f.COMBAT_SETTING
FROM FLEETS f
WHERE f.MISSION_STRING LIKE '%ATTACKING%'
   OR f.MISSION_STRING LIKE '%DEFENDING%'
   OR f.MISSION_STRING LIKE '%PATROLLING%'
ORDER BY f.MISSION_STRING, f.NAME;
```

```sql
-- Search fleets by combat setting
SELECT f.ID, f.NAME, f.OWNER, f.MISSION_STRING, f.COMBAT_SETTING,
       CASE f.COMBAT_SETTING
           WHEN 'PASSIVE' THEN 'DEFENSIVE_ONLY'
           WHEN 'SOMETIMES ENGAGE' THEN 'SELECTIVE_COMBAT'
           WHEN 'ALWAYS ENGAGE' THEN 'AGGRESSIVE'
           WHEN 'ALWAYS FLEE' THEN 'NON_COMBATANT'
           ELSE 'UNKNOWN'
       END as combat_behavior
FROM FLEETS f
WHERE f.COMBAT_SETTING = ?  -- Specific combat setting
ORDER BY f.NAME;
```

```sql
-- Find fleets with specific access levels
SELECT f.ID, f.NAME, f.OWNER, f.FACTION_ACCESS,
       CASE f.FACTION_ACCESS
           WHEN 0 THEN 'OWNER_ONLY'
           WHEN 1 THEN 'OFFICER_ACCESS'
           WHEN 2 THEN 'COMMANDER_ACCESS'
           WHEN 3 THEN 'MEMBER_ACCESS'
           WHEN 4 THEN 'RECRUIT_ACCESS'
           WHEN 5 THEN 'PUBLIC_ACCESS'
           ELSE 'UNKNOWN'
       END as access_level
FROM FLEETS f
WHERE f.FACTION_ACCESS >= ?  -- Minimum access level
ORDER BY f.FACTION_ACCESS, f.NAME;
```

### Count fleets by mission and combat settings
```sql
-- Distribution of fleet missions
SELECT f.MISSION_STRING,
       COUNT(*) as fleet_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM FLEETS), 2) as percentage
FROM FLEETS f
WHERE f.MISSION_STRING IS NOT NULL
GROUP BY f.MISSION_STRING
ORDER BY fleet_count DESC;
```

```sql
-- Combat settings analysis
SELECT f.COMBAT_SETTING,
       COUNT(*) as fleet_count,
       COUNT(CASE WHEN f.MISSION_STRING LIKE '%ATTACK%' THEN 1 END) as attacking_fleets,
       COUNT(CASE WHEN f.MISSION_STRING LIKE '%DEFEND%' THEN 1 END) as defending_fleets,
       COUNT(CASE WHEN f.MISSION_STRING LIKE '%IDLE%' THEN 1 END) as idle_fleets
FROM FLEETS f
WHERE f.COMBAT_SETTING IS NOT NULL
GROUP BY f.COMBAT_SETTING
ORDER BY fleet_count DESC;
```

```sql
-- Fleet access level distribution
SELECT 
    CASE f.FACTION_ACCESS
        WHEN 0 THEN 'OWNER_ONLY'
        WHEN 1 THEN 'OFFICER_ACCESS'
        WHEN 2 THEN 'COMMANDER_ACCESS'
        WHEN 3 THEN 'MEMBER_ACCESS'
        WHEN 4 THEN 'RECRUIT_ACCESS'
        WHEN 5 THEN 'PUBLIC_ACCESS'
        ELSE 'UNKNOWN'
    END as access_level,
    COUNT(*) as fleet_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM FLEETS), 2) as percentage
FROM FLEETS f
GROUP BY f.FACTION_ACCESS
ORDER BY f.FACTION_ACCESS;
```

---

## Fleet Hierarchy and Organization Analysis

### Fleet hierarchy structures and command chains
```sql
-- Comprehensive fleet hierarchy analysis
WITH fleet_hierarchy AS (
    SELECT f.ID as fleet_id,
           f.NAME as fleet_name,
           f.OWNER,
           f.PARENT_FLEET,
           f.MISSION_STRING,
           f.COMBAT_SETTING,
           CASE 
               WHEN f.PARENT_FLEET = -1 OR f.PARENT_FLEET IS NULL THEN 'TOP_LEVEL'
               ELSE 'SUB_FLEET'
           END as hierarchy_level
    FROM FLEETS f
)
SELECT fh.hierarchy_level,
       COUNT(*) as fleet_count,
       COUNT(DISTINCT fh.OWNER) as unique_owners,
       COUNT(CASE WHEN fh.MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) as active_fleets,
       STRING_AGG(DISTINCT fh.COMBAT_SETTING, ', ') as combat_settings_used
FROM fleet_hierarchy fh
GROUP BY fh.hierarchy_level
ORDER BY fleet_count DESC;
```

```sql
-- Parent-child fleet relationships
WITH fleet_relationships AS (
    SELECT parent.ID as parent_id,
           parent.NAME as parent_name,
           parent.OWNER as parent_owner,
           parent.MISSION_STRING as parent_mission,
           child.ID as child_id,
           child.NAME as child_name,
           child.MISSION_STRING as child_mission,
           child.COMBAT_SETTING as child_combat_setting
    FROM FLEETS parent
    JOIN FLEETS child ON parent.ID = child.PARENT_FLEET
)
SELECT fr.parent_name,
       fr.parent_owner,
       fr.parent_mission,
       COUNT(*) as sub_fleet_count,
       STRING_AGG(fr.child_name, ', ') as sub_fleet_names,
       STRING_AGG(DISTINCT fr.child_combat_setting, ', ') as child_combat_settings
FROM fleet_relationships fr
GROUP BY fr.parent_id, fr.parent_name, fr.parent_owner, fr.parent_mission
ORDER BY sub_fleet_count DESC, fr.parent_name;
```

```sql
-- Command chain depth analysis
WITH RECURSIVE command_chain AS (
    -- Start with top-level fleets
    SELECT f.ID, f.NAME, f.OWNER, f.PARENT_FLEET, 0 as depth
    FROM FLEETS f
    WHERE f.PARENT_FLEET = -1 OR f.PARENT_FLEET IS NULL
    
    UNION ALL
    
    -- Recursively find sub-fleets
    SELECT f.ID, f.NAME, f.OWNER, f.PARENT_FLEET, cc.depth + 1
    FROM FLEETS f
    JOIN command_chain cc ON f.PARENT_FLEET = cc.ID
    WHERE cc.depth < 5  -- Prevent infinite recursion
)
SELECT cc.depth,
       COUNT(*) as fleets_at_depth,
       COUNT(DISTINCT cc.OWNER) as unique_owners_at_depth,
       AVG(LENGTH(cc.NAME)) as avg_name_length
FROM command_chain cc
GROUP BY cc.depth
ORDER BY cc.depth;
```

### Fleet ownership and player analysis
```sql
-- Fleet ownership concentration analysis
WITH fleet_ownership AS (
    SELECT f.OWNER,
           COUNT(*) as total_fleets,
           COUNT(CASE WHEN f.PARENT_FLEET = -1 OR f.PARENT_FLEET IS NULL THEN 1 END) as top_level_fleets,
           COUNT(CASE WHEN f.PARENT_FLEET != -1 AND f.PARENT_FLEET IS NOT NULL THEN 1 END) as sub_fleets,
           COUNT(CASE WHEN f.MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) as active_fleets,
           STRING_AGG(DISTINCT f.COMBAT_SETTING, ', ') as combat_settings,
           STRING_AGG(DISTINCT f.MISSION_STRING, '; ') as current_missions
    FROM FLEETS f
    WHERE f.OWNER IS NOT NULL
    GROUP BY f.OWNER
)
SELECT fo.OWNER,
       fo.total_fleets,
       fo.top_level_fleets,
       fo.sub_fleets,
       fo.active_fleets,
       ROUND(fo.active_fleets * 100.0 / fo.total_fleets, 2) as activity_percentage,
       fo.combat_settings,
       CASE 
           WHEN fo.total_fleets >= 10 THEN 'FLEET_ADMIRAL'
           WHEN fo.total_fleets >= 5 THEN 'FLEET_COMMANDER'
           WHEN fo.total_fleets >= 3 THEN 'SQUADRON_LEADER'
           WHEN fo.total_fleets >= 2 THEN 'WING_COMMANDER'
           ELSE 'SINGLE_FLEET_OWNER'
       END as command_classification
FROM fleet_ownership fo
ORDER BY fo.total_fleets DESC, fo.active_fleets DESC;
```

---

## Mission and Combat Analysis

### Fleet mission patterns and operational analysis
```sql
-- Comprehensive mission analysis by type
WITH mission_categories AS (
    SELECT f.*,
           CASE 
               WHEN f.MISSION_STRING LIKE '%ATTACK%' THEN 'OFFENSIVE'
               WHEN f.MISSION_STRING LIKE '%DEFEND%' OR f.MISSION_STRING LIKE '%SENTRY%' THEN 'DEFENSIVE'
               WHEN f.MISSION_STRING LIKE '%PATROL%' THEN 'PATROL'
               WHEN f.MISSION_STRING LIKE '%MINING%' THEN 'ECONOMIC'
               WHEN f.MISSION_STRING LIKE '%TRADING%' THEN 'COMMERCIAL'
               WHEN f.MISSION_STRING LIKE '%ESCORT%' THEN 'SUPPORT'
               WHEN f.MISSION_STRING LIKE '%REPAIR%' THEN 'MAINTENANCE'
               WHEN f.MISSION_STRING LIKE '%MOVING%' THEN 'TRANSIT'
               WHEN f.MISSION_STRING LIKE '%IDLE%' THEN 'STANDBY'
               WHEN f.MISSION_STRING LIKE '%CLOAK%' OR f.MISSION_STRING LIKE '%JAM%' THEN 'STEALTH'
               ELSE 'OTHER'
           END as mission_category
    FROM FLEETS f
    WHERE f.MISSION_STRING IS NOT NULL
)
SELECT mc.mission_category,
       COUNT(*) as fleet_count,
       COUNT(DISTINCT mc.OWNER) as unique_commanders,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM FLEETS WHERE MISSION_STRING IS NOT NULL), 2) as percentage,
       STRING_AGG(DISTINCT mc.COMBAT_SETTING, ', ') as combat_settings_used,
       COUNT(CASE WHEN mc.FACTION_ACCESS >= 3 THEN 1 END) as publicly_accessible
FROM mission_categories mc
GROUP BY mc.mission_category
ORDER BY fleet_count DESC;
```

```sql
-- Combat readiness and engagement analysis
WITH combat_analysis AS (
    SELECT f.*,
           CASE 
               WHEN f.COMBAT_SETTING = 'ALWAYS ENGAGE' THEN 'HIGH_AGGRESSION'
               WHEN f.COMBAT_SETTING = 'SOMETIMES ENGAGE' THEN 'MODERATE_AGGRESSION'
               WHEN f.COMBAT_SETTING = 'PASSIVE' THEN 'DEFENSIVE'
               WHEN f.COMBAT_SETTING = 'ALWAYS FLEE' THEN 'NON_COMBATANT'
               ELSE 'UNKNOWN'
           END as aggression_level,
           CASE 
               WHEN f.MISSION_STRING LIKE '%ATTACK%' OR f.MISSION_STRING LIKE '%PATROL%' THEN 'COMBAT_READY'
               WHEN f.MISSION_STRING LIKE '%DEFEND%' OR f.MISSION_STRING LIKE '%SENTRY%' THEN 'DEFENSIVE_READY'
               WHEN f.MISSION_STRING LIKE '%IDLE%' THEN 'STANDBY'
               WHEN f.MISSION_STRING LIKE '%MINING%' OR f.MISSION_STRING LIKE '%TRADING%' THEN 'CIVILIAN'
               ELSE 'SUPPORT'
           END as readiness_status
    FROM FLEETS f
    WHERE f.COMBAT_SETTING IS NOT NULL AND f.MISSION_STRING IS NOT NULL
)
SELECT ca.aggression_level,
       ca.readiness_status,
       COUNT(*) as fleet_count,
       COUNT(DISTINCT ca.OWNER) as unique_commanders,
       COUNT(CASE WHEN ca.PARENT_FLEET = -1 OR ca.PARENT_FLEET IS NULL THEN 1 END) as independent_fleets,
       COUNT(CASE WHEN ca.FACTION_ACCESS = 0 THEN 1 END) as private_fleets
FROM combat_analysis ca
GROUP BY ca.aggression_level, ca.readiness_status
ORDER BY fleet_count DESC;
```

### Mission coordination and tactical analysis
```sql
-- Coordinated operations analysis (fleets with similar missions)
WITH mission_coordination AS (
    SELECT f.MISSION_STRING,
           f.OWNER,
           COUNT(*) as coordinated_fleets,
           STRING_AGG(f.NAME, ', ') as fleet_names,
           STRING_AGG(DISTINCT f.COMBAT_SETTING, ', ') as combat_settings
    FROM FLEETS f
    WHERE f.MISSION_STRING IS NOT NULL
      AND f.MISSION_STRING NOT LIKE '%IDLE%'
    GROUP BY f.MISSION_STRING, f.OWNER
    HAVING COUNT(*) > 1
)
SELECT mc.MISSION_STRING,
       mc.OWNER,
       mc.coordinated_fleets,
       mc.fleet_names,
       mc.combat_settings,
       CASE 
           WHEN mc.coordinated_fleets >= 5 THEN 'MAJOR_OPERATION'
           WHEN mc.coordinated_fleets >= 3 THEN 'COORDINATED_OPERATION'
           ELSE 'SMALL_OPERATION'
       END as operation_scale
FROM mission_coordination mc
ORDER BY mc.coordinated_fleets DESC, mc.MISSION_STRING;
```

```sql
-- Fleet command efficiency analysis
SELECT f.OWNER,
       COUNT(DISTINCT f.MISSION_STRING) as mission_variety,
       COUNT(*) as total_fleets,
       COUNT(CASE WHEN f.MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) as active_fleets,
       COUNT(CASE WHEN f.COMBAT_SETTING = 'ALWAYS ENGAGE' THEN 1 END) as aggressive_fleets,
       COUNT(CASE WHEN f.FACTION_ACCESS >= 3 THEN 1 END) as shared_command_fleets,
       ROUND(COUNT(CASE WHEN f.MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) * 100.0 / COUNT(*), 2) as activity_rate
FROM FLEETS f
WHERE f.OWNER IS NOT NULL
GROUP BY f.OWNER
HAVING COUNT(*) >= 2
ORDER BY activity_rate DESC, total_fleets DESC;
```

---

## Command Structure and Access Analysis

### Fleet access control and sharing patterns
```sql
-- Fleet access control distribution analysis
WITH access_analysis AS (
    SELECT f.*,
           CASE f.FACTION_ACCESS
               WHEN 0 THEN 'PRIVATE'
               WHEN 1 THEN 'OFFICER_SHARED'
               WHEN 2 THEN 'COMMAND_SHARED'
               WHEN 3 THEN 'FACTION_SHARED'
               WHEN 4 THEN 'RECRUIT_SHARED'
               WHEN 5 THEN 'PUBLIC'
               ELSE 'UNKNOWN'
           END as sharing_level
    FROM FLEETS f
)
SELECT aa.sharing_level,
       COUNT(*) as fleet_count,
       COUNT(DISTINCT aa.OWNER) as unique_owners,
       COUNT(CASE WHEN aa.MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) as active_shared_fleets,
       STRING_AGG(DISTINCT aa.COMBAT_SETTING, ', ') as combat_settings,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM FLEETS), 2) as percentage_of_total
FROM access_analysis aa
GROUP BY aa.sharing_level, aa.FACTION_ACCESS
ORDER BY aa.FACTION_ACCESS;
```

```sql
-- Command authority concentration
WITH command_authority AS (
    SELECT f.OWNER,
           COUNT(*) as owned_fleets,
           COUNT(CASE WHEN f.FACTION_ACCESS = 0 THEN 1 END) as private_fleets,
           COUNT(CASE WHEN f.FACTION_ACCESS >= 3 THEN 1 END) as shared_fleets,
           COUNT(CASE WHEN f.PARENT_FLEET = -1 OR f.PARENT_FLEET IS NULL THEN 1 END) as top_level_commands,
           AVG(f.FACTION_ACCESS) as avg_sharing_level
    FROM FLEETS f
    WHERE f.OWNER IS NOT NULL
    GROUP BY f.OWNER
)
SELECT ca.OWNER,
       ca.owned_fleets,
       ca.private_fleets,
       ca.shared_fleets,
       ca.top_level_commands,
       ROUND(ca.avg_sharing_level, 2) as avg_sharing_level,
       ROUND(ca.shared_fleets * 100.0 / ca.owned_fleets, 2) as sharing_percentage,
       CASE 
           WHEN ca.shared_fleets * 100.0 / ca.owned_fleets >= 75 THEN 'COLLABORATIVE_COMMANDER'
           WHEN ca.shared_fleets * 100.0 / ca.owned_fleets >= 50 THEN 'BALANCED_COMMANDER'
           WHEN ca.shared_fleets * 100.0 / ca.owned_fleets >= 25 THEN 'SELECTIVE_SHARER'
           ELSE 'PRIVATE_COMMANDER'
       END as command_style
FROM command_authority ca
WHERE ca.owned_fleets >= 2
ORDER BY ca.owned_fleets DESC, sharing_percentage DESC;
```

### Binary command analysis
```sql
-- Command field analysis (binary data patterns)
SELECT 
    'COMMAND_DATA_ANALYSIS' as metric_type,
    COUNT(*) as total_fleets,
    COUNT(CASE WHEN f.COMMAND IS NOT NULL THEN 1 END) as fleets_with_commands,
    COUNT(CASE WHEN f.SAVED_REMOTES IS NOT NULL THEN 1 END) as fleets_with_remotes,
    AVG(LENGTH(f.COMMAND)) as avg_command_size,
    AVG(LENGTH(f.SAVED_REMOTES)) as avg_remotes_size,
    MAX(LENGTH(f.COMMAND)) as max_command_size,
    MAX(LENGTH(f.SAVED_REMOTES)) as max_remotes_size
FROM FLEETS f;
```

```sql
-- Fleet automation level analysis
WITH automation_analysis AS (
    SELECT f.*,
           CASE 
               WHEN f.COMMAND IS NOT NULL AND f.SAVED_REMOTES IS NOT NULL THEN 'FULLY_AUTOMATED'
               WHEN f.COMMAND IS NOT NULL THEN 'COMMAND_AUTOMATED'
               WHEN f.SAVED_REMOTES IS NOT NULL THEN 'REMOTE_AUTOMATED'
               ELSE 'MANUAL_CONTROL'
           END as automation_level,
           LENGTH(f.COMMAND) as command_complexity,
           LENGTH(f.SAVED_REMOTES) as remote_complexity
    FROM FLEETS f
)
SELECT aa.automation_level,
       COUNT(*) as fleet_count,
       COUNT(DISTINCT aa.OWNER) as unique_owners,
       AVG(aa.command_complexity) as avg_command_complexity,
       AVG(aa.remote_complexity) as avg_remote_complexity,
       COUNT(CASE WHEN aa.MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) as active_automated_fleets
FROM automation_analysis aa
GROUP BY aa.automation_level
ORDER BY fleet_count DESC;
```

---

## Fleet Performance and Strategic Analysis

### Fleet operational efficiency metrics
```sql
-- Fleet operational status overview
WITH operational_metrics AS (
    SELECT f.*,
           CASE 
               WHEN f.MISSION_STRING LIKE '%IDLE%' THEN 'IDLE'
               WHEN f.MISSION_STRING LIKE '%ATTACK%' OR f.MISSION_STRING LIKE '%DEFEND%' THEN 'COMBAT'
               WHEN f.MISSION_STRING LIKE '%MINING%' OR f.MISSION_STRING LIKE '%TRADING%' THEN 'ECONOMIC'
               WHEN f.MISSION_STRING LIKE '%PATROL%' OR f.MISSION_STRING LIKE '%ESCORT%' THEN 'SECURITY'
               WHEN f.MISSION_STRING LIKE '%MOVING%' OR f.MISSION_STRING LIKE '%REPAIR%' THEN 'SUPPORT'
               ELSE 'SPECIAL'
           END as operational_role
    FROM FLEETS f
    WHERE f.MISSION_STRING IS NOT NULL
)
SELECT om.operational_role,
       COUNT(*) as fleet_count,
       COUNT(DISTINCT om.OWNER) as unique_commanders,
       COUNT(CASE WHEN om.COMBAT_SETTING = 'ALWAYS ENGAGE' THEN 1 END) as aggressive_fleets,
       COUNT(CASE WHEN om.FACTION_ACCESS >= 3 THEN 1 END) as shared_access_fleets,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM FLEETS WHERE MISSION_STRING IS NOT NULL), 2) as role_percentage
FROM operational_metrics om
GROUP BY om.operational_role
ORDER BY fleet_count DESC;
```

```sql
-- Strategic fleet distribution by owner
WITH strategic_analysis AS (
    SELECT f.OWNER,
           COUNT(*) as total_fleets,
           COUNT(CASE WHEN f.MISSION_STRING LIKE '%ATTACK%' THEN 1 END) as offensive_fleets,
           COUNT(CASE WHEN f.MISSION_STRING LIKE '%DEFEND%' OR f.MISSION_STRING LIKE '%SENTRY%' THEN 1 END) as defensive_fleets,
           COUNT(CASE WHEN f.MISSION_STRING LIKE '%MINING%' OR f.MISSION_STRING LIKE '%TRADING%' THEN 1 END) as economic_fleets,
           COUNT(CASE WHEN f.MISSION_STRING LIKE '%PATROL%' THEN 1 END) as patrol_fleets,
           COUNT(CASE WHEN f.MISSION_STRING LIKE '%IDLE%' THEN 1 END) as idle_fleets
    FROM FLEETS f
    WHERE f.OWNER IS NOT NULL AND f.MISSION_STRING IS NOT NULL
    GROUP BY f.OWNER
    HAVING COUNT(*) >= 3  -- Only analyze significant fleet owners
)
SELECT sa.OWNER,
       sa.total_fleets,
       sa.offensive_fleets,
       sa.defensive_fleets,
       sa.economic_fleets,
       sa.patrol_fleets,
       sa.idle_fleets,
       ROUND(sa.offensive_fleets * 100.0 / sa.total_fleets, 2) as offensive_percentage,
       ROUND(sa.defensive_fleets * 100.0 / sa.total_fleets, 2) as defensive_percentage,
       ROUND(sa.economic_fleets * 100.0 / sa.total_fleets, 2) as economic_percentage,
       CASE 
           WHEN sa.offensive_fleets > sa.defensive_fleets AND sa.offensive_fleets > sa.economic_fleets THEN 'AGGRESSIVE_STRATEGY'
           WHEN sa.defensive_fleets > sa.offensive_fleets AND sa.defensive_fleets > sa.economic_fleets THEN 'DEFENSIVE_STRATEGY'
           WHEN sa.economic_fleets > sa.offensive_fleets AND sa.economic_fleets > sa.defensive_fleets THEN 'ECONOMIC_STRATEGY'
           ELSE 'BALANCED_STRATEGY'
       END as strategic_focus
FROM strategic_analysis sa
ORDER BY sa.total_fleets DESC, offensive_percentage DESC;
```

---

## Data Management and Maintenance

### Fleet data validation and integrity
```sql
-- Comprehensive fleet data validation
WITH validation_checks AS (
    -- Check 1: Missing flagship references
    SELECT 'MISSING_FLAGSHIP' as check_type, COUNT(*) as issues
    FROM FLEETS f
    WHERE f.FLAGSHIP_ID IS NULL
    
    UNION ALL
    
    -- Check 2: Invalid parent fleet references
    SELECT 'INVALID_PARENT_FLEET' as check_type, COUNT(*) as issues
    FROM FLEETS f
    WHERE f.PARENT_FLEET IS NOT NULL 
      AND f.PARENT_FLEET != -1
      AND f.PARENT_FLEET NOT IN (SELECT ID FROM FLEETS)
    
    UNION ALL
    
    -- Check 3: Circular parent references
    SELECT 'CIRCULAR_REFERENCES' as check_type, COUNT(*) as issues
    FROM FLEETS f
    WHERE f.PARENT_FLEET = f.ID
    
    UNION ALL
    
    -- Check 4: Invalid faction access values
    SELECT 'INVALID_FACTION_ACCESS' as check_type, COUNT(*) as issues
    FROM FLEETS f
    WHERE f.FACTION_ACCESS < 0 OR f.FACTION_ACCESS > 5
    
    UNION ALL
    
    -- Check 5: Missing owner information
    SELECT 'MISSING_OWNER' as check_type, COUNT(*) as issues
    FROM FLEETS f
    WHERE f.OWNER IS NULL OR TRIM(f.OWNER) = ''
    
    UNION ALL
    
    -- Check 6: Orphaned flagship entities
    SELECT 'ORPHANED_FLAGSHIP' as check_type, COUNT(*) as issues
    FROM FLEETS f
    WHERE f.FLAGSHIP_ID IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ENTITIES e WHERE e.ID = f.FLAGSHIP_ID)
)
SELECT 
    vc.check_type,
    vc.issues,
    CASE 
        WHEN vc.issues = 0 THEN 'PASS'
        WHEN vc.issues < 3 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status
FROM validation_checks vc
ORDER BY vc.issues DESC;
```

```sql
-- Fleet performance and storage analysis
SELECT 
    'FLEET_STORAGE_ANALYSIS' as metric_type,
    COUNT(*) as total_fleets,
    COUNT(DISTINCT OWNER) as unique_owners,
    COUNT(CASE WHEN PARENT_FLEET != -1 AND PARENT_FLEET IS NOT NULL THEN 1 END) as sub_fleets,
    COUNT(CASE WHEN COMMAND IS NOT NULL THEN 1 END) as fleets_with_commands,
    COUNT(CASE WHEN SAVED_REMOTES IS NOT NULL THEN 1 END) as fleets_with_remotes,
    COUNT(CASE WHEN MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) as active_fleets,
    AVG(LENGTH(NAME)) as avg_name_length,
    SUM(LENGTH(COMMAND)) as total_command_bytes,
    SUM(LENGTH(SAVED_REMOTES)) as total_remotes_bytes
FROM FLEETS;
```

### Maintenance operations and optimization
```sql
-- Identify cleanup candidates
-- Note: These are analysis queries; actual cleanup requires careful consideration

-- Find fleets with broken flagship references
SELECT f.ID, f.NAME, f.OWNER, f.FLAGSHIP_ID, f.MISSION_STRING,
       'BROKEN_FLAGSHIP_REFERENCE' as issue_type
FROM FLEETS f
WHERE f.FLAGSHIP_ID IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ENTITIES e WHERE e.ID = f.FLAGSHIP_ID)
ORDER BY f.ID;
```

```sql
-- Find fleets with invalid parent references
SELECT f.ID, f.NAME, f.OWNER, f.PARENT_FLEET, f.MISSION_STRING,
       'INVALID_PARENT_REFERENCE' as issue_type
FROM FLEETS f
WHERE f.PARENT_FLEET IS NOT NULL 
  AND f.PARENT_FLEET != -1
  AND f.PARENT_FLEET NOT IN (SELECT ID FROM FLEETS)
ORDER BY f.ID;
```

```sql
-- Find long-idle fleets (potential cleanup candidates)
SELECT f.ID, f.NAME, f.OWNER, f.MISSION_STRING, f.COMBAT_SETTING,
       'LONG_IDLE_FLEET' as cleanup_reason
FROM FLEETS f
WHERE f.MISSION_STRING LIKE '%IDLE%'
  AND (f.COMMAND IS NULL OR LENGTH(f.COMMAND) = 0)
  AND (f.SAVED_REMOTES IS NULL OR LENGTH(f.SAVED_REMOTES) = 0)
ORDER BY f.NAME;
```

```sql
-- Performance summary after maintenance
SELECT 
    'FLEET_MAINTENANCE_SUMMARY' as operation,
    COUNT(*) as total_fleets,
    COUNT(DISTINCT OWNER) as active_commanders,
    COUNT(CASE WHEN PARENT_FLEET = -1 OR PARENT_FLEET IS NULL THEN 1 END) as top_level_fleets,
    COUNT(CASE WHEN MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) as active_fleets,
    COUNT(CASE WHEN COMBAT_SETTING = 'ALWAYS ENGAGE' THEN 1 END) as aggressive_fleets,
    COUNT(CASE WHEN FACTION_ACCESS >= 3 THEN 1 END) as shared_access_fleets
FROM FLEETS;
```

---

## Reporting and Strategic Intelligence

### Comprehensive fleet command report
```sql
-- Complete fleet command system report
SELECT 
    'FLEET_COMMAND_SYSTEM_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    COUNT(*) as total_fleets,
    COUNT(DISTINCT OWNER) as unique_commanders,
    COUNT(CASE WHEN PARENT_FLEET = -1 OR PARENT_FLEET IS NULL THEN 1 END) as independent_fleets,
    COUNT(CASE WHEN PARENT_FLEET != -1 AND PARENT_FLEET IS NOT NULL THEN 1 END) as subordinate_fleets,
    COUNT(CASE WHEN MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) as active_fleets,
    COUNT(CASE WHEN COMBAT_SETTING = 'ALWAYS ENGAGE' THEN 1 END) as aggressive_fleets,
    COUNT(CASE WHEN FACTION_ACCESS >= 3 THEN 1 END) as publicly_accessible_fleets,
    COUNT(CASE WHEN COMMAND IS NOT NULL THEN 1 END) as automated_fleets
FROM FLEETS;
```

```sql
-- Top fleet commanders summary
SELECT f.OWNER,
       COUNT(*) as total_fleets,
       COUNT(CASE WHEN f.PARENT_FLEET = -1 OR f.PARENT_FLEET IS NULL THEN 1 END) as independent_commands,
       COUNT(CASE WHEN f.MISSION_STRING NOT LIKE '%IDLE%' THEN 1 END) as active_fleets,
       STRING_AGG(DISTINCT f.COMBAT_SETTING, ', ') as combat_doctrines,
       STRING_AGG(DISTINCT f.MISSION_STRING, '; ') as current_operations
FROM FLEETS f
WHERE f.OWNER IS NOT NULL
GROUP BY f.OWNER
ORDER BY total_fleets DESC
LIMIT 20;
```

---

## Changelog

| Version | Date       | Author       | Description                                     |
|---------|------------|--------------|-----------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of FLEETS example queries   |

[INDEX](./INDEX.md) | [FLEETS](./TABLE_FLEETS.md)