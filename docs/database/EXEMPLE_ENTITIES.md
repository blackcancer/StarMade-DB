# ENTITIES - Advanced SQL Queries & Operations

These examples target HyperSQL (HSQLDB) 2.3.4 database. **All queries focus exclusively on the ENTITIES table.**

---

## Database Administration

### Manual checkpoint and transaction control
```sql
-- Force database checkpoint for persistence
CHECKPOINT;
```

```sql
-- Set transaction isolation level
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

```sql
-- Enable autocommit (default)
SET AUTOCOMMIT TRUE;
```

```sql
-- Disable autocommit for complex operations
SET AUTOCOMMIT FALSE;
```

### Performance optimization settings
```sql
-- Set memory cache size (in MB)
SET DATABASE DEFAULT TABLE TYPE CACHED;
SET FILES CACHE SIZE 50000;
```

```sql
-- Configure write delay for better performance
SET FILES WRITE DELAY 2;
```

```sql
-- Enable NIO for large files
SET FILES NIO ON;
```

---

## Advanced Transactions

### Safe entity creation with rollback
```sql
-- Start transaction
SET AUTOCOMMIT FALSE;

BEGIN;

-- Create new entity with validation
INSERT INTO ENTITIES (ID, UID, X, Y, Z, TYPE, NAME, FACTION, CREATOR, TOUCHED)
VALUES (NEXT VALUE FOR ID_GEN_TABLE.ID_GEN, 
        'PLAYER_SHIP_' || CURRENT_TIMESTAMP, 
        0, 0, 0, 0, 'New Ship', 12345, 'PlayerName', TRUE);

-- Validate insertion was successful
SELECT CASE 
    WHEN COUNT(*) = 1 THEN 'SUCCESS'
    ELSE 'FAILED'
END AS validation_result
FROM ENTITIES 
WHERE UID LIKE 'PLAYER_SHIP_%' 
AND CREATOR = 'PlayerName'
AND ID = (SELECT MAX(ID) FROM ENTITIES);

-- Commit or rollback based on validation
-- COMMIT;
-- ROLLBACK;
```

### Bulk update with safety checks
```sql
SET AUTOCOMMIT FALSE;

BEGIN;

-- Update multiple entities with validation
UPDATE ENTITIES 
SET TOUCHED = TRUE,
    LAST_MOD = CURRENT_TIMESTAMP
WHERE FACTION = 12345
AND TYPE = 0
AND SPAWNED_ONLY_IN_DB = FALSE;

-- Check affected rows
SELECT COUNT(*) as entities_updated
FROM ENTITIES
WHERE FACTION = 12345
AND TYPE = 0
AND TOUCHED = TRUE
AND LAST_MOD IS NOT NULL;

-- Proceed with commit if satisfied
-- COMMIT;
```

---

## Complex Query Patterns

### Entity hierarchical analysis with docking chains
```sql
-- Find all docking chains and their depths
WITH RECURSIVE docking_tree (id, uid, name, docked_to, level, path) AS (
    -- Base case: entities not docked to anything
    SELECT e.ID, e.UID, e.NAME, e.DOCKED_TO, 0, CAST(e.NAME AS VARCHAR)
    FROM ENTITIES e
    WHERE e.DOCKED_TO = -1
    
    UNION ALL
    
    -- Recursive case: entities docked to others
    SELECT e.ID, e.UID, e.NAME, e.DOCKED_TO, dt.level + 1, 
           CAST(dt.path || ' -> ' || e.NAME AS VARCHAR)
    FROM ENTITIES e
    INNER JOIN docking_tree dt ON e.DOCKED_TO = dt.id
    WHERE dt.level < 10  -- Prevent infinite recursion
)
SELECT dt.id, dt.uid, dt.name, dt.docked_to, dt.level, dt.path
FROM docking_tree dt
WHERE dt.level > 0
ORDER BY dt.level DESC, dt.id;
```

### Advanced entity clustering by location
```sql
-- Find entity clusters within specified distance
WITH entity_distances AS (
    SELECT 
        e1.ID as entity1_id,
        e1.NAME as entity1_name,
        e2.ID as entity2_id,
        e2.NAME as entity2_name,
        SQRT(POWER(e2.X - e1.X, 2) + POWER(e2.Y - e1.Y, 2) + POWER(e2.Z - e1.Z, 2)) as distance
    FROM ENTITIES e1
    CROSS JOIN ENTITIES e2
    WHERE e1.ID < e2.ID  -- Avoid duplicates and self-joins
    AND e1.TYPE IN (0, 1)  -- Ships and stations
    AND e2.TYPE IN (0, 1)
    AND SQRT(POWER(e2.X - e1.X, 2) + POWER(e2.Y - e1.Y, 2) + POWER(e2.Z - e1.Z, 2)) <= 50
)
SELECT 
    ed.entity1_id,
    ed.entity1_name,
    COUNT(DISTINCT ed.entity2_id) as nearby_entities,
    AVG(ed.distance) as avg_distance,
    MIN(ed.distance) as closest_entity_distance
FROM entity_distances ed
GROUP BY ed.entity1_id, ed.entity1_name
HAVING COUNT(DISTINCT ed.entity2_id) >= 3
ORDER BY nearby_entities DESC;
```

---

## Performance Optimization Queries

### Index effectiveness analysis
```sql
-- Analyze query patterns for ENTITIES table
SELECT 
    'QUERY_PATTERN_ANALYSIS' as analysis_type,
    COUNT(CASE WHEN e.FACTION != 0 THEN 1 END) as faction_filtered_entities,
    COUNT(CASE WHEN e.TYPE = 0 THEN 1 END) as ship_type_queries,
    COUNT(CASE WHEN e.TOUCHED = TRUE THEN 1 END) as active_entities,
    COUNT(CASE WHEN e.SPAWNED_ONLY_IN_DB = TRUE THEN 1 END) as db_only_entities,
    COUNT(CASE WHEN e.DOCKED_TO != -1 THEN 1 END) as docked_entities
FROM ENTITIES e;
```

### Partition strategy analysis
```sql
-- Analyze entity distribution for potential partitioning
WITH distribution_analysis AS (
    SELECT 
        e.TYPE,
        e.FACTION,
        COUNT(*) as entity_count,
        AVG(CASE WHEN e.DIM IS NOT NULL THEN CARDINALITY(e.DIM) ELSE 0 END) as avg_dimensions,
        COUNT(CASE WHEN e.TOUCHED = TRUE THEN 1 END) as active_count
    FROM ENTITIES e
    GROUP BY e.TYPE, e.FACTION
)
SELECT 
    da.TYPE,
    CASE da.TYPE
        WHEN 0 THEN 'SHIP'
        WHEN 1 THEN 'SPACE_STATION'
        WHEN 2 THEN 'PLANET'
        WHEN 3 THEN 'ASTEROID'
        ELSE 'OTHER'
    END as type_name,
    COUNT(DISTINCT da.FACTION) as faction_variety,
    SUM(da.entity_count) as total_entities,
    SUM(da.active_count) as total_active
FROM distribution_analysis da
GROUP BY da.TYPE
ORDER BY total_entities DESC;
```

---

## Data Maintenance and Cleanup

### Comprehensive ENTITIES data validation
```sql
-- Multi-check data integrity validation
WITH integrity_checks AS (
    -- Check 1: Orphaned docking references
    SELECT 'ORPHANED_DOCKING' as check_type, COUNT(*) as issues
    FROM ENTITIES e
    WHERE e.DOCKED_TO != -1 
    AND e.DOCKED_TO NOT IN (SELECT ID FROM ENTITIES)
    
    UNION ALL
    
    -- Check 2: Invalid faction references
    SELECT 'INVALID_FACTION' as check_type, COUNT(*) as issues
    FROM ENTITIES e
    WHERE e.FACTION NOT IN (0, -10000000, -9999999, -9999998)
    AND e.FACTION NOT IN (SELECT DISTINCT FACTION FROM ENTITIES WHERE FACTION > 0)
    
    UNION ALL
    
    -- Check 3: Future generation timestamps
    SELECT 'FUTURE_GEN_ID' as check_type, COUNT(*) as issues
    FROM ENTITIES e
    WHERE e.GEN_ID > UNIX_TIMESTAMP()
    
    UNION ALL
    
    -- Check 4: Null critical fields
    SELECT 'NULL_CRITICAL_FIELDS' as check_type, COUNT(*) as issues
    FROM ENTITIES e
    WHERE e.UID IS NULL OR e.NAME IS NULL OR e.TYPE IS NULL
    
    UNION ALL
    
    -- Check 5: Inconsistent entity states
    SELECT 'INCONSISTENT_STATES' as check_type, COUNT(*) as issues
    FROM ENTITIES e
    WHERE e.SPAWNED_ONLY_IN_DB = TRUE AND e.TOUCHED = TRUE
    
    UNION ALL
    
    -- Check 6: Missing or invalid UIDs
    SELECT 'INVALID_UIDS' as check_type, COUNT(*) as issues
    FROM ENTITIES e
    WHERE e.UID IS NULL OR TRIM(e.UID) = ''
    
    UNION ALL
    
    -- Check 7: Invalid entity types
    SELECT 'INVALID_TYPES' as check_type, COUNT(*) as issues
    FROM ENTITIES e
    WHERE e.TYPE NOT IN (0,1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,17,18)
)
SELECT 
    check_type,
    issues,
    CASE 
        WHEN issues = 0 THEN 'PASS'
        WHEN issues < 10 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status
FROM integrity_checks
ORDER BY issues DESC;
```

### Automated ENTITIES maintenance procedure
```sql
-- Comprehensive maintenance routine for ENTITIES table only
SET AUTOCOMMIT FALSE;

BEGIN;

-- Step 1: Update missing names with UIDs
UPDATE ENTITIES 
SET NAME = COALESCE(NULLIF(TRIM(NAME), ''), UID)
WHERE NAME IS NULL OR TRIM(NAME) = '';

-- Step 2: Fix orphaned docking references
UPDATE ENTITIES 
SET DOCKED_TO = -1, DOCKED_ROOT = -1
WHERE DOCKED_TO != -1 
AND DOCKED_TO NOT IN (SELECT ID FROM ENTITIES);

-- Step 3: Clean up database-only entities older than 7 days
DELETE FROM ENTITIES
WHERE SPAWNED_ONLY_IN_DB = TRUE
AND TOUCHED = FALSE
AND TYPE NOT IN (2, 14, 15, 16) -- Preserve celestial objects
AND GEN_ID < (UNIX_TIMESTAMP() - 604800); -- 7 days in seconds

-- Step 4: Update entity touch status for modified entities
UPDATE ENTITIES 
SET TOUCHED = TRUE
WHERE LAST_MOD IS NOT NULL 
AND LAST_MOD != CREATOR
AND TOUCHED = FALSE;

-- Step 5: Normalize faction values for invalid references
UPDATE ENTITIES 
SET FACTION = 0
WHERE FACTION NOT IN (0, -10000000, -9999999, -9999998)
AND FACTION NOT IN (SELECT DISTINCT FACTION FROM ENTITIES WHERE FACTION > 0);

-- Validate maintenance operations
SELECT 
    'MAINTENANCE_SUMMARY' as operation,
    COUNT(*) as total_entities,
    COUNT(CASE WHEN TOUCHED = TRUE THEN 1 END) as active_entities,
    COUNT(CASE WHEN SPAWNED_ONLY_IN_DB = TRUE THEN 1 END) as db_only_entities,
    COUNT(CASE WHEN DOCKED_TO != -1 THEN 1 END) as docked_entities
FROM ENTITIES;

-- COMMIT;
```

---

## Advanced Analytics

### Entity lifecycle analysis
```sql
-- Analyze entity creation and modification patterns
WITH entity_lifecycle AS (
    SELECT 
        e.ID,
        e.UID,
        e.TYPE,
        e.CREATOR,
        e.LAST_MOD,
        e.GEN_ID,
        e.TOUCHED,
        e.SPAWNED_ONLY_IN_DB,
        CASE 
            WHEN e.GEN_ID > (UNIX_TIMESTAMP() - 3600) THEN 'LAST_HOUR'
            WHEN e.GEN_ID > (UNIX_TIMESTAMP() - 86400) THEN 'LAST_DAY'
            WHEN e.GEN_ID > (UNIX_TIMESTAMP() - 604800) THEN 'LAST_WEEK'
            WHEN e.GEN_ID > (UNIX_TIMESTAMP() - 2592000) THEN 'LAST_MONTH'
            ELSE 'OLDER'
        END as age_category,
        CASE 
            WHEN e.LAST_MOD IS NULL THEN 'NEVER_MODIFIED'
            WHEN e.LAST_MOD = e.CREATOR THEN 'CREATOR_ONLY'
            ELSE 'MODIFIED_BY_OTHERS'
        END as modification_status
    FROM ENTITIES e
)
SELECT 
    el.age_category,
    el.modification_status,
    COUNT(*) as entity_count,
    COUNT(CASE WHEN el.TOUCHED = TRUE THEN 1 END) as active_count,
    COUNT(CASE WHEN el.SPAWNED_ONLY_IN_DB = TRUE THEN 1 END) as db_only_count,
    ROUND(COUNT(CASE WHEN el.TOUCHED = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as active_percentage
FROM entity_lifecycle el
GROUP BY el.age_category, el.modification_status
ORDER BY 
    CASE el.age_category
        WHEN 'LAST_HOUR' THEN 1
        WHEN 'LAST_DAY' THEN 2
        WHEN 'LAST_WEEK' THEN 3
        WHEN 'LAST_MONTH' THEN 4
        ELSE 5
    END,
    el.modification_status;
```

### Entity type evolution tracking
```sql
-- Track entity type distribution changes
SELECT 
    e.TYPE,
    CASE e.TYPE
        WHEN 0 THEN 'SHIP'
        WHEN 1 THEN 'SPACE_STATION'
        WHEN 2 THEN 'PLANET'
        WHEN 3 THEN 'ASTEROID'
        WHEN 4 THEN 'FLOAT_ROCK'
        WHEN 5 THEN 'SHIP_CORE'
        WHEN 6 THEN 'ASTEROID_MANAGED'
        WHEN 7 THEN 'SPACE_CREATURE'
        WHEN 8 THEN 'PLANET_ICO'
        WHEN 10 THEN 'ASTRONAUT'
        WHEN 11 THEN 'NPC'
        WHEN 12 THEN 'SHOP'
        ELSE 'OTHER'
    END as type_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN e.GEN_ID > (UNIX_TIMESTAMP() - 86400) THEN 1 END) as created_24h,
    COUNT(CASE WHEN e.TOUCHED = TRUE THEN 1 END) as active_entities,
    COUNT(CASE WHEN e.SPAWNED_ONLY_IN_DB = TRUE THEN 1 END) as db_only,
    AVG(SQRT(POWER(e.X, 2) + POWER(e.Y, 2) + POWER(e.Z, 2))) as avg_distance_from_origin
FROM ENTITIES e
GROUP BY e.TYPE
ORDER BY total_count DESC;
```

---

## Changelog

| Version | Date       | Author       | Description                                               |
|---------|------------|--------------|-----------------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of advanced ENTITIES example queries     |

[INDEX](./INDEX.md) | [ENTITIES](./TABLE_ENTITIES.md)