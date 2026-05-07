# SECTORS_ITEMS - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) database with advanced features for binary data analysis, storage optimization, and item management. **All queries focus exclusively on the SECTORS_ITEMS table.**

---

## Basic Sectors Items Queries

### Find sectors with floating items
```sql
-- List all sectors that have floating items
SELECT si.ID as sector_id,
       LENGTH(si.ITEMS) as data_size_bytes,
       FLOOR(LENGTH(si.ITEMS) / 22.0) as estimated_item_count,
       CASE 
           WHEN LENGTH(si.ITEMS) = 0 THEN 'EMPTY'
           WHEN LENGTH(si.ITEMS) < 1000 THEN 'FEW_ITEMS'
           WHEN LENGTH(si.ITEMS) < 10000 THEN 'MODERATE_ITEMS'
           ELSE 'MANY_ITEMS'
       END as item_density
FROM SECTORS_ITEMS si
WHERE si.ITEMS IS NOT NULL
ORDER BY LENGTH(si.ITEMS) DESC;
```

```sql
-- Check for specific sector items
SELECT si.ID, 
       LENGTH(si.ITEMS) as data_size,
       CASE 
           WHEN si.ITEMS IS NULL THEN 'NO_DATA'
           WHEN LENGTH(si.ITEMS) = 0 THEN 'EMPTY_SECTOR'
           ELSE 'HAS_ITEMS'
       END as status
FROM SECTORS_ITEMS si
WHERE si.ID = ?;
```

```sql
-- Find sectors with maximum item storage
SELECT si.ID,
       LENGTH(si.ITEMS) as current_size,
       22528 as max_size,
       ROUND(LENGTH(si.ITEMS) * 100.0 / 22528, 2) as storage_usage_percent,
       FLOOR(LENGTH(si.ITEMS) / 22.0) as estimated_items,
       FLOOR((22528 - LENGTH(si.ITEMS)) / 22.0) as remaining_slots
FROM SECTORS_ITEMS si
WHERE si.ITEMS IS NOT NULL
AND LENGTH(si.ITEMS) > 0
ORDER BY storage_usage_percent DESC;
```

### Storage utilization analysis
```sql
-- Comprehensive storage utilization statistics
SELECT 
    'SECTORS_ITEMS_UTILIZATION' as metric_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN si.ITEMS IS NOT NULL AND LENGTH(si.ITEMS) > 0 THEN 1 END) as sectors_with_items,
    COUNT(CASE WHEN LENGTH(si.ITEMS) = 0 THEN 1 END) as empty_sectors,
    COUNT(CASE WHEN si.ITEMS IS NULL THEN 1 END) as null_sectors,
    AVG(LENGTH(si.ITEMS)) as avg_storage_size,
    MAX(LENGTH(si.ITEMS)) as max_storage_size,
    SUM(LENGTH(si.ITEMS)) as total_storage_used,
    ROUND(AVG(LENGTH(si.ITEMS)) / 22.0, 2) as avg_items_per_sector,
    ROUND(MAX(LENGTH(si.ITEMS)) / 22.0, 0) as max_items_in_sector
FROM SECTORS_ITEMS si;
```

---

## Binary Data Analysis

### Storage size distribution
```sql
-- Analyze distribution of storage sizes
WITH size_analysis AS (
    SELECT si.ID,
           LENGTH(si.ITEMS) as storage_size,
           FLOOR(LENGTH(si.ITEMS) / 22.0) as estimated_item_count,
           CASE 
               WHEN LENGTH(si.ITEMS) = 0 THEN 'EMPTY'
               WHEN LENGTH(si.ITEMS) BETWEEN 1 AND 220 THEN 'VERY_LOW'     -- 1-10 items
               WHEN LENGTH(si.ITEMS) BETWEEN 221 AND 1100 THEN 'LOW'       -- 11-50 items
               WHEN LENGTH(si.ITEMS) BETWEEN 1101 AND 2200 THEN 'MEDIUM'   -- 51-100 items
               WHEN LENGTH(si.ITEMS) BETWEEN 2201 AND 11000 THEN 'HIGH'    -- 101-500 items
               ELSE 'VERY_HIGH'                                           -- 500+ items
           END as size_category
    FROM SECTORS_ITEMS si
    WHERE si.ITEMS IS NOT NULL
)
SELECT sa.size_category,
       COUNT(*) as sector_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM SECTORS_ITEMS WHERE ITEMS IS NOT NULL), 2) as percentage,
       MIN(sa.storage_size) as min_bytes,
       MAX(sa.storage_size) as max_bytes,
       AVG(sa.storage_size) as avg_bytes,
       MIN(sa.estimated_item_count) as min_items,
       MAX(sa.estimated_item_count) as max_items,
       AVG(sa.estimated_item_count) as avg_items
FROM size_analysis sa
GROUP BY sa.size_category
ORDER BY 
    CASE sa.size_category 
        WHEN 'EMPTY' THEN 1
        WHEN 'VERY_LOW' THEN 2
        WHEN 'LOW' THEN 3
        WHEN 'MEDIUM' THEN 4
        WHEN 'HIGH' THEN 5
        WHEN 'VERY_HIGH' THEN 6
    END;
```

### Binary data integrity checks
```sql
-- Validate binary data integrity
WITH integrity_analysis AS (
    SELECT si.ID,
           si.ITEMS,
           LENGTH(si.ITEMS) as data_length,
           CASE 
               WHEN si.ITEMS IS NULL THEN 'NULL_DATA'
               WHEN LENGTH(si.ITEMS) = 0 THEN 'EMPTY_DATA'
               WHEN LENGTH(si.ITEMS) > 22528 THEN 'OVERSIZED_DATA'
               WHEN MOD(LENGTH(si.ITEMS), 22) != 0 THEN 'MISALIGNED_DATA'
               ELSE 'VALID_DATA'
           END as integrity_status
    FROM SECTORS_ITEMS si
)
SELECT ia.integrity_status,
       COUNT(*) as sector_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM SECTORS_ITEMS), 2) as percentage,
       MIN(ia.data_length) as min_size,
       MAX(ia.data_length) as max_size,
       AVG(ia.data_length) as avg_size
FROM integrity_analysis ia
GROUP BY ia.integrity_status
ORDER BY sector_count DESC;

-- Find problematic sectors requiring attention
SELECT si.ID,
       LENGTH(si.ITEMS) as data_size,
       MOD(LENGTH(si.ITEMS), 22) as alignment_remainder,
       CASE 
           WHEN LENGTH(si.ITEMS) > 22528 THEN 'CRITICAL_OVERSIZED'
           WHEN MOD(LENGTH(si.ITEMS), 22) != 0 THEN 'WARNING_MISALIGNED'
           WHEN LENGTH(si.ITEMS) > 20000 THEN 'INFO_NEAR_CAPACITY'
           ELSE 'OK'
       END as issue_severity
FROM SECTORS_ITEMS si
WHERE si.ITEMS IS NOT NULL
AND (LENGTH(si.ITEMS) > 22528 
     OR MOD(LENGTH(si.ITEMS), 22) != 0 
     OR LENGTH(si.ITEMS) > 20000)
ORDER BY 
    CASE 
        WHEN LENGTH(si.ITEMS) > 22528 THEN 1
        WHEN MOD(LENGTH(si.ITEMS), 22) != 0 THEN 2
        WHEN LENGTH(si.ITEMS) > 20000 THEN 3
        ELSE 4
    END, LENGTH(si.ITEMS) DESC;
```

---

## Storage Optimization

### Identify optimization candidates
```sql
-- Find sectors that could benefit from optimization
WITH optimization_candidates AS (
    SELECT si.ID,
           LENGTH(si.ITEMS) as current_size,
           FLOOR(LENGTH(si.ITEMS) / 22.0) as estimated_items,
           ROUND(LENGTH(si.ITEMS) * 100.0 / 22528, 2) as capacity_usage,
           CASE 
               WHEN LENGTH(si.ITEMS) = 0 THEN 'DELETE_CANDIDATE'
               WHEN LENGTH(si.ITEMS) < 44 THEN 'CONSOLIDATION_CANDIDATE'  -- Less than 2 items
               WHEN LENGTH(si.ITEMS) > 20000 THEN 'COMPRESSION_CANDIDATE'  -- Near capacity
               WHEN MOD(LENGTH(si.ITEMS), 22) != 0 THEN 'REPAIR_CANDIDATE' -- Misaligned
               ELSE 'OPTIMAL'
           END as optimization_type
    FROM SECTORS_ITEMS si
    WHERE si.ITEMS IS NOT NULL
)
SELECT oc.optimization_type,
       COUNT(*) as sector_count,
       SUM(oc.current_size) as total_bytes,
       AVG(oc.current_size) as avg_bytes_per_sector,
       AVG(oc.estimated_items) as avg_items_per_sector,
       AVG(oc.capacity_usage) as avg_capacity_usage
FROM optimization_candidates oc
GROUP BY oc.optimization_type
ORDER BY sector_count DESC;
```

```sql
-- Storage efficiency analysis
SELECT 
    'STORAGE_EFFICIENCY_ANALYSIS' as analysis_type,
    COUNT(*) as total_sectors,
    SUM(LENGTH(si.ITEMS)) as total_bytes_used,
    COUNT(*) * 22528 as total_bytes_allocated,
    ROUND(SUM(LENGTH(si.ITEMS)) * 100.0 / (COUNT(*) * 22528), 2) as overall_efficiency_percent,
    ROUND(AVG(LENGTH(si.ITEMS)), 2) as avg_bytes_per_sector,
    COUNT(CASE WHEN LENGTH(si.ITEMS) = 0 THEN 1 END) as empty_sectors,
    COUNT(CASE WHEN LENGTH(si.ITEMS) > 11264 THEN 1 END) as over_half_full_sectors
FROM SECTORS_ITEMS si
WHERE si.ITEMS IS NOT NULL;
```

### Cleanup and maintenance operations
```sql
-- Identify sectors for cleanup (empty storage)
SELECT si.ID,
       LENGTH(si.ITEMS) as data_size,
       'CLEANUP_CANDIDATE' as action_required
FROM SECTORS_ITEMS si
WHERE si.ITEMS IS NOT NULL 
AND LENGTH(si.ITEMS) = 0
ORDER BY si.ID;
```

```sql
-- Performance impact assessment
WITH performance_analysis AS (
    SELECT si.ID,
           LENGTH(si.ITEMS) as data_size,
           FLOOR(LENGTH(si.ITEMS) / 22.0) as item_count,
           CASE 
               WHEN LENGTH(si.ITEMS) = 0 THEN 'INSTANT_LOAD'
               WHEN LENGTH(si.ITEMS) < 1000 THEN 'FAST_LOAD'
               WHEN LENGTH(si.ITEMS) < 10000 THEN 'MODERATE_LOAD'
               WHEN LENGTH(si.ITEMS) < 20000 THEN 'SLOW_LOAD'
               ELSE 'VERY_SLOW_LOAD'
           END as load_performance,
           ROUND(LENGTH(si.ITEMS) / 1024.0, 2) as size_kb
    FROM SECTORS_ITEMS si
    WHERE si.ITEMS IS NOT NULL
)
SELECT pa.load_performance,
       COUNT(*) as sector_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM SECTORS_ITEMS WHERE ITEMS IS NOT NULL), 2) as percentage,
       AVG(pa.size_kb) as avg_size_kb,
       MAX(pa.size_kb) as max_size_kb,
       AVG(pa.item_count) as avg_item_count
FROM performance_analysis pa
GROUP BY pa.load_performance
ORDER BY 
    CASE pa.load_performance
        WHEN 'INSTANT_LOAD' THEN 1
        WHEN 'FAST_LOAD' THEN 2
        WHEN 'MODERATE_LOAD' THEN 3
        WHEN 'SLOW_LOAD' THEN 4
        WHEN 'VERY_SLOW_LOAD' THEN 5
    END;
```

---

## Advanced Binary Analysis

### Hexadecimal data inspection
```sql
-- Inspect binary data structure (first few bytes)
SELECT si.ID,
       LENGTH(si.ITEMS) as total_length,
       FLOOR(LENGTH(si.ITEMS) / 22.0) as calculated_items,
       -- First 22 bytes (first item record) in hexadecimal
       CASE 
           WHEN LENGTH(si.ITEMS) >= 22 THEN 
               CONCAT('0x', RAWTOHEX(SUBSTRING(si.ITEMS, 1, 22)))
           WHEN LENGTH(si.ITEMS) > 0 THEN 
               CONCAT('0x', RAWTOHEX(si.ITEMS), ' (INCOMPLETE)')
           ELSE 'EMPTY'
       END as first_record_hex,
       -- Item type from first 2 bytes (little-endian SMALLINT)
       CASE 
           WHEN LENGTH(si.ITEMS) >= 2 THEN
               CAST(SUBSTRING(si.ITEMS, 1, 2) AS SMALLINT)
           ELSE NULL
       END as first_item_type
FROM SECTORS_ITEMS si
WHERE si.ITEMS IS NOT NULL
AND LENGTH(si.ITEMS) > 0
ORDER BY LENGTH(si.ITEMS) DESC
LIMIT 10;
```

### Data pattern analysis
```sql
-- Analyze common data patterns in item storage
WITH pattern_analysis AS (
    SELECT si.ID,
           LENGTH(si.ITEMS) as data_size,
           -- Check for repeating patterns
           CASE 
               WHEN LENGTH(si.ITEMS) >= 44 THEN
                   CASE WHEN SUBSTRING(si.ITEMS, 1, 22) = SUBSTRING(si.ITEMS, 23, 22) 
                        THEN 'DUPLICATE_ITEMS' 
                        ELSE 'VARIED_ITEMS' 
                   END
               WHEN LENGTH(si.ITEMS) = 22 THEN 'SINGLE_ITEM'
               WHEN LENGTH(si.ITEMS) = 0 THEN 'EMPTY'
               ELSE 'PARTIAL_RECORD'
           END as data_pattern,
           -- Check for null bytes (possible corruption)
           CASE 
               WHEN POSITION(CAST(0 AS BINARY(1)) IN si.ITEMS) > 0 THEN 'HAS_NULL_BYTES'
               ELSE 'NO_NULL_BYTES'
           END as null_byte_status
    FROM SECTORS_ITEMS si
    WHERE si.ITEMS IS NOT NULL
)
SELECT pa.data_pattern,
       pa.null_byte_status,
       COUNT(*) as sector_count,
       AVG(pa.data_size) as avg_data_size
FROM pattern_analysis pa
GROUP BY pa.data_pattern, pa.null_byte_status
ORDER BY sector_count DESC;
```

---

## System Performance Monitoring

### Database storage impact
```sql
-- Calculate total database storage impact
SELECT 
    'DATABASE_STORAGE_IMPACT' as metric,
    COUNT(*) as total_records,
    SUM(LENGTH(si.ITEMS)) as total_data_bytes,
    ROUND(SUM(LENGTH(si.ITEMS)) / 1024.0, 2) as total_data_kb,
    ROUND(SUM(LENGTH(si.ITEMS)) / 1048576.0, 2) as total_data_mb,
    COUNT(*) * 22528 as theoretical_max_bytes,
    ROUND((COUNT(*) * 22528) / 1048576.0, 2) as theoretical_max_mb,
    ROUND(SUM(LENGTH(si.ITEMS)) * 100.0 / (COUNT(*) * 22528), 2) as storage_efficiency_percent
FROM SECTORS_ITEMS si;
```

```sql
-- Monitor storage growth patterns
WITH storage_stats AS (
    SELECT 
        FLOOR(LENGTH(si.ITEMS) / 2252.8) as size_decile,  -- 10% increments
        COUNT(*) as sector_count,
        AVG(LENGTH(si.ITEMS)) as avg_size
    FROM SECTORS_ITEMS si
    WHERE si.ITEMS IS NOT NULL
    GROUP BY FLOOR(LENGTH(si.ITEMS) / 2252.8)
)
SELECT 
    ss.size_decile * 10 as capacity_percentage_range,
    ss.sector_count,
    ROUND(ss.avg_size, 0) as avg_bytes,
    ROUND(ss.avg_size / 22.0, 1) as avg_items
FROM storage_stats ss
ORDER BY ss.size_decile;
```

### Memory usage estimation
```sql
-- Estimate memory usage for different scenarios
WITH memory_scenarios AS (
    SELECT 
        'CURRENT_USAGE' as scenario,
        COUNT(*) as sectors,
        SUM(LENGTH(si.ITEMS)) as total_bytes,
        AVG(LENGTH(si.ITEMS)) as avg_bytes_per_sector
    FROM SECTORS_ITEMS si
    WHERE si.ITEMS IS NOT NULL
    
    UNION ALL
    
    SELECT 
        'IF_ALL_SECTORS_ACTIVE' as scenario,
        COUNT(*) as sectors,
        COUNT(*) * AVG(LENGTH(si.ITEMS)) as total_bytes,
        AVG(LENGTH(si.ITEMS)) as avg_bytes_per_sector
    FROM SECTORS_ITEMS si
    WHERE si.ITEMS IS NOT NULL AND LENGTH(si.ITEMS) > 0
    
    UNION ALL
    
    SELECT 
        'WORST_CASE_SCENARIO' as scenario,
        COUNT(*) as sectors,
        COUNT(*) * 22528 as total_bytes,
        22528 as avg_bytes_per_sector
    FROM SECTORS_ITEMS si
)
SELECT ms.scenario,
       ms.sectors,
       ROUND(ms.total_bytes / 1048576.0, 2) as estimated_mb,
       ROUND(ms.avg_bytes_per_sector, 0) as avg_bytes_per_sector,
       ROUND(ms.avg_bytes_per_sector / 22.0, 1) as avg_items_per_sector
FROM memory_scenarios ms
ORDER BY ms.total_bytes;
```

---

## Data Maintenance Operations

### Sector items maintenance
```sql
-- Comprehensive maintenance status report
WITH maintenance_analysis AS (
    SELECT si.ID,
           LENGTH(si.ITEMS) as data_size,
           CASE 
               WHEN si.ITEMS IS NULL THEN 'NULL_DATA'
               WHEN LENGTH(si.ITEMS) = 0 THEN 'EMPTY_SECTOR'
               WHEN LENGTH(si.ITEMS) > 22528 THEN 'OVERSIZED'
               WHEN MOD(LENGTH(si.ITEMS), 22) != 0 THEN 'MISALIGNED'
               WHEN LENGTH(si.ITEMS) > 20000 THEN 'NEAR_CAPACITY'
               ELSE 'NORMAL'
           END as maintenance_status,
           FLOOR(LENGTH(si.ITEMS) / 22.0) as estimated_items
    FROM SECTORS_ITEMS si
)
SELECT ma.maintenance_status,
       COUNT(*) as sector_count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM SECTORS_ITEMS), 2) as percentage,
       SUM(ma.data_size) as total_bytes,
       AVG(ma.data_size) as avg_bytes,
       SUM(ma.estimated_items) as total_estimated_items
FROM maintenance_analysis ma
GROUP BY ma.maintenance_status
ORDER BY 
    CASE ma.maintenance_status
        WHEN 'OVERSIZED' THEN 1
        WHEN 'MISALIGNED' THEN 2
        WHEN 'NEAR_CAPACITY' THEN 3
        WHEN 'EMPTY_SECTOR' THEN 4
        WHEN 'NULL_DATA' THEN 5
        WHEN 'NORMAL' THEN 6
    END;
```

```sql
-- Maintenance operations summary
SELECT 
    'MAINTENANCE_SUMMARY' as operation_type,
    COUNT(*) as total_sectors,
    COUNT(CASE WHEN si.ITEMS IS NULL THEN 1 END) as null_sectors,
    COUNT(CASE WHEN LENGTH(si.ITEMS) = 0 THEN 1 END) as empty_sectors,
    COUNT(CASE WHEN MOD(LENGTH(si.ITEMS), 22) != 0 THEN 1 END) as misaligned_sectors,
    COUNT(CASE WHEN LENGTH(si.ITEMS) > 22528 THEN 1 END) as oversized_sectors,
    COUNT(CASE WHEN LENGTH(si.ITEMS) BETWEEN 1 AND 22527 THEN 1 END) as normal_sectors
FROM SECTORS_ITEMS si;
```

### Data validation and cleanup
```sql
-- Validation queries for data integrity
-- Note: These are analysis queries; actual cleanup would require application logic

-- Find sectors with suspicious data patterns
SELECT si.ID,
       LENGTH(si.ITEMS) as data_size,
       MOD(LENGTH(si.ITEMS), 22) as alignment_check,
       CASE 
           WHEN LENGTH(si.ITEMS) > 22528 THEN 'REQUIRES_TRUNCATION'
           WHEN MOD(LENGTH(si.ITEMS), 22) != 0 THEN 'REQUIRES_PADDING_OR_TRUNCATION'
           WHEN LENGTH(si.ITEMS) = 0 THEN 'CANDIDATE_FOR_DELETION'
           ELSE 'VALID'
       END as recommended_action
FROM SECTORS_ITEMS si
WHERE si.ITEMS IS NOT NULL
AND (LENGTH(si.ITEMS) > 22528 
     OR MOD(LENGTH(si.ITEMS), 22) != 0 
     OR LENGTH(si.ITEMS) = 0)
ORDER BY 
    CASE 
        WHEN LENGTH(si.ITEMS) > 22528 THEN 1
        WHEN MOD(LENGTH(si.ITEMS), 22) != 0 THEN 2
        WHEN LENGTH(si.ITEMS) = 0 THEN 3
    END, si.ID;
```

---

## Reporting and Statistics

### Comprehensive sectors items report
```sql
-- Complete SECTORS_ITEMS statistics report
SELECT 
    'SECTORS_ITEMS_COMPREHENSIVE_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    COUNT(*) as total_sectors_items_records,
    COUNT(CASE WHEN si.ITEMS IS NOT NULL THEN 1 END) as non_null_records,
    COUNT(CASE WHEN si.ITEMS IS NOT NULL AND LENGTH(si.ITEMS) > 0 THEN 1 END) as sectors_with_items,
    SUM(LENGTH(si.ITEMS)) as total_storage_bytes,
    ROUND(SUM(LENGTH(si.ITEMS)) / 1048576.0, 3) as total_storage_mb,
    AVG(LENGTH(si.ITEMS)) as avg_storage_per_sector,
    MAX(LENGTH(si.ITEMS)) as max_storage_per_sector,
    ROUND(SUM(LENGTH(si.ITEMS)) / 22.0, 0) as estimated_total_items,
    ROUND(AVG(CASE WHEN LENGTH(si.ITEMS) > 0 THEN LENGTH(si.ITEMS) / 22.0 END), 2) as avg_items_per_active_sector
FROM SECTORS_ITEMS si;
```

---

## Changelog

| Version | Date       | Author       | Description                                           |
|---------|------------|--------------|-------------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of SECTORS_ITEMS example queries    |

[INDEX](./INDEX.md) | [SECTORS_ITEMS](./TABLE_SECTORS_ITEMS.md)