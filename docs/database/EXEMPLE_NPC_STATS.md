# NPC_STATS - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) database with advanced features including NPC activity analysis, strategic intelligence gathering, and server performance monitoring. **All queries focus exclusively on the NPC_STATS table.**

---

## Basic NPC Statistics Queries

### Find systems by activity level and coordinates
```sql
-- Search NPC activity by specific system coordinates
SELECT ns.ID, ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
       ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
       ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_spawns
FROM NPC_STATS ns
WHERE ns.SYS_X = ? AND ns.SYS_Y = ? AND ns.SYS_Z = ?  -- Specific system
ORDER BY total_spawns DESC;
```

```sql
-- Find systems with high NPC fleet activity
SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
       ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
       ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_activity,
       SQRT(POWER(ns.SYS_X, 2) + POWER(ns.SYS_Y, 2) + POWER(ns.SYS_Z, 2)) as distance_from_origin
FROM NPC_STATS ns
WHERE ns.FLEET_SPAWNS >= ?  -- Minimum fleet spawn threshold
ORDER BY ns.FLEET_SPAWNS DESC, total_activity DESC;
```

```sql
-- Search systems by total NPC activity range
SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
       ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
       ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_spawns,
       CASE 
           WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 1000 THEN 'EXTREME_ACTIVITY'
           WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 500 THEN 'VERY_HIGH_ACTIVITY'
           WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 100 THEN 'HIGH_ACTIVITY'
           WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 50 THEN 'MODERATE_ACTIVITY'
           WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 10 THEN 'LOW_ACTIVITY'
           ELSE 'MINIMAL_ACTIVITY'
       END as activity_level
FROM NPC_STATS ns
WHERE ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS BETWEEN ? AND ?  -- Activity range
ORDER BY total_spawns DESC;
```

```sql
-- Find systems by fleet vs entity spawn ratio
SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
       ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
       CASE 
           WHEN ns.ENTITY_SPAWNS = 0 THEN 999
           ELSE ROUND(ns.FLEET_SPAWNS * 1.0 / ns.ENTITY_SPAWNS, 2)
       END as fleet_to_entity_ratio,
       CASE 
           WHEN ns.ENTITY_SPAWNS = 0 AND ns.FLEET_SPAWNS > 0 THEN 'FLEET_ONLY'
           WHEN ns.FLEET_SPAWNS = 0 AND ns.ENTITY_SPAWNS > 0 THEN 'ENTITY_ONLY'
           WHEN ns.FLEET_SPAWNS > ns.ENTITY_SPAWNS THEN 'FLEET_DOMINANT'
           WHEN ns.ENTITY_SPAWNS > ns.FLEET_SPAWNS THEN 'ENTITY_DOMINANT'
           WHEN ns.FLEET_SPAWNS = ns.ENTITY_SPAWNS THEN 'BALANCED'
           ELSE 'NO_ACTIVITY'
       END as activity_pattern
FROM NPC_STATS ns
WHERE ns.FLEET_SPAWNS > 0 OR ns.ENTITY_SPAWNS > 0
ORDER BY fleet_to_entity_ratio DESC;
```

### Count and analyze NPC activity distribution
```sql
-- NPC activity distribution by spawn levels
SELECT 
    CASE 
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 1000 THEN 'EXTREME (1000+)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 500 THEN 'VERY_HIGH (500-999)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 200 THEN 'HIGH (200-499)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 100 THEN 'MODERATE (100-199)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 50 THEN 'LOW (50-99)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 10 THEN 'MINIMAL (10-49)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0 THEN 'TRACE (1-9)'
        ELSE 'INACTIVE (0)'
    END as activity_category,
    COUNT(*) as system_count,
    AVG(ns.FLEET_SPAWNS) as avg_fleet_spawns,
    AVG(ns.ENTITY_SPAWNS) as avg_entity_spawns,
    SUM(ns.FLEET_SPAWNS) as total_fleet_spawns,
    SUM(ns.ENTITY_SPAWNS) as total_entity_spawns,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM NPC_STATS), 2) as percentage_of_systems
FROM NPC_STATS ns
GROUP BY 
    CASE 
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 1000 THEN 'EXTREME (1000+)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 500 THEN 'VERY_HIGH (500-999)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 200 THEN 'HIGH (200-499)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 100 THEN 'MODERATE (100-199)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 50 THEN 'LOW (50-99)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS >= 10 THEN 'MINIMAL (10-49)'
        WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0 THEN 'TRACE (1-9)'
        ELSE 'INACTIVE (0)'
    END
ORDER BY AVG(ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS) DESC;
```

```sql
-- Geographic distribution of NPC activity
SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
       COUNT(*) as recorded_systems,
       SUM(ns.FLEET_SPAWNS) as total_fleet_spawns,
       SUM(ns.ENTITY_SPAWNS) as total_entity_spawns,
       AVG(ns.FLEET_SPAWNS) as avg_fleet_spawns,
       AVG(ns.ENTITY_SPAWNS) as avg_entity_spawns,
       MAX(ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS) as peak_activity
FROM NPC_STATS ns
GROUP BY ns.SYS_X, ns.SYS_Y, ns.SYS_Z
HAVING SUM(ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS) > 0
ORDER BY total_fleet_spawns + total_entity_spawns DESC;
```

```sql
-- Fleet vs entity spawn balance analysis
SELECT 
    CASE 
        WHEN ns.FLEET_SPAWNS = 0 AND ns.ENTITY_SPAWNS = 0 THEN 'NO_ACTIVITY'
        WHEN ns.FLEET_SPAWNS = 0 THEN 'ENTITY_ONLY'
        WHEN ns.ENTITY_SPAWNS = 0 THEN 'FLEET_ONLY'
        WHEN ns.FLEET_SPAWNS > ns.ENTITY_SPAWNS * 2 THEN 'FLEET_HEAVY'
        WHEN ns.ENTITY_SPAWNS > ns.FLEET_SPAWNS * 2 THEN 'ENTITY_HEAVY'
        WHEN ABS(ns.FLEET_SPAWNS - ns.ENTITY_SPAWNS) <= 5 THEN 'BALANCED'
        ELSE 'MIXED_ACTIVITY'
    END as spawn_pattern,
    COUNT(*) as system_count,
    AVG(ns.FLEET_SPAWNS) as avg_fleet_spawns,
    AVG(ns.ENTITY_SPAWNS) as avg_entity_spawns,
    SUM(ns.FLEET_SPAWNS) as total_fleets,
    SUM(ns.ENTITY_SPAWNS) as total_entities
FROM NPC_STATS ns
GROUP BY 
    CASE 
        WHEN ns.FLEET_SPAWNS = 0 AND ns.ENTITY_SPAWNS = 0 THEN 'NO_ACTIVITY'
        WHEN ns.FLEET_SPAWNS = 0 THEN 'ENTITY_ONLY'
        WHEN ns.ENTITY_SPAWNS = 0 THEN 'FLEET_ONLY'
        WHEN ns.FLEET_SPAWNS > ns.ENTITY_SPAWNS * 2 THEN 'FLEET_HEAVY'
        WHEN ns.ENTITY_SPAWNS > ns.FLEET_SPAWNS * 2 THEN 'ENTITY_HEAVY'
        WHEN ABS(ns.FLEET_SPAWNS - ns.ENTITY_SPAWNS) <= 5 THEN 'BALANCED'
        ELSE 'MIXED_ACTIVITY'
    END
ORDER BY system_count DESC;
```

---

## Strategic Intelligence and Activity Analysis

### NPC activity hotspots and strategic importance
```sql
-- Comprehensive NPC activity hotspot analysis
WITH activity_analysis AS (
    SELECT ns.*,
           ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_activity,
           SQRT(POWER(ns.SYS_X, 2) + POWER(ns.SYS_Y, 2) + POWER(ns.SYS_Z, 2)) as distance_from_origin,
           CASE 
               WHEN ABS(ns.SYS_X) <= 5 AND ABS(ns.SYS_Y) <= 5 AND ABS(ns.SYS_Z) <= 5 THEN 'CORE_REGION'
               WHEN ABS(ns.SYS_X) <= 15 AND ABS(ns.SYS_Y) <= 15 AND ABS(ns.SYS_Z) <= 15 THEN 'INNER_REGION'
               WHEN ABS(ns.SYS_X) <= 30 AND ABS(ns.SYS_Y) <= 30 AND ABS(ns.SYS_Z) <= 30 THEN 'MIDDLE_REGION'
               WHEN ABS(ns.SYS_X) <= 50 AND ABS(ns.SYS_Y) <= 50 AND ABS(ns.SYS_Z) <= 50 THEN 'OUTER_REGION'
               ELSE 'FRONTIER_REGION'
           END as strategic_region
    FROM NPC_STATS ns
    WHERE ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0
)
SELECT aa.SYS_X, aa.SYS_Y, aa.SYS_Z,
       aa.FLEET_SPAWNS, aa.ENTITY_SPAWNS, aa.total_activity,
       aa.strategic_region,
       ROUND(aa.distance_from_origin, 2) as distance_from_origin,
       CASE 
           WHEN aa.total_activity >= 1000 THEN 'CRITICAL_HOTSPOT'
           WHEN aa.total_activity >= 500 THEN 'MAJOR_HOTSPOT'
           WHEN aa.total_activity >= 200 THEN 'SIGNIFICANT_HOTSPOT'
           WHEN aa.total_activity >= 100 THEN 'MODERATE_HOTSPOT'
           WHEN aa.total_activity >= 50 THEN 'MINOR_HOTSPOT'
           ELSE 'LOW_ACTIVITY'
       END as hotspot_classification,
       CASE 
           WHEN aa.FLEET_SPAWNS > aa.ENTITY_SPAWNS * 3 THEN 'MILITARY_FOCUS'
           WHEN aa.ENTITY_SPAWNS > aa.FLEET_SPAWNS * 3 THEN 'INFRASTRUCTURE_FOCUS'
           WHEN aa.FLEET_SPAWNS > aa.ENTITY_SPAWNS THEN 'FLEET_DOMINANT'
           WHEN aa.ENTITY_SPAWNS > aa.FLEET_SPAWNS THEN 'ENTITY_DOMINANT'
           ELSE 'BALANCED_ACTIVITY'
       END as activity_focus
FROM activity_analysis aa
ORDER BY aa.total_activity DESC, aa.distance_from_origin;
```

```sql
-- Regional NPC activity summary and strategic assessment
WITH regional_stats AS (
    SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
           ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
           ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_activity,
           CASE 
               WHEN ABS(ns.SYS_X) <= 10 AND ABS(ns.SYS_Y) <= 10 AND ABS(ns.SYS_Z) <= 10 THEN 'CORE'
               WHEN ABS(ns.SYS_X) <= 25 AND ABS(ns.SYS_Y) <= 25 AND ABS(ns.SYS_Z) <= 25 THEN 'INNER'
               WHEN ABS(ns.SYS_X) <= 50 AND ABS(ns.SYS_Y) <= 50 AND ABS(ns.SYS_Z) <= 50 THEN 'MIDDLE'
               WHEN ABS(ns.SYS_X) <= 100 AND ABS(ns.SYS_Y) <= 100 AND ABS(ns.SYS_Z) <= 100 THEN 'OUTER'
               ELSE 'FRONTIER'
           END as region
    FROM NPC_STATS ns
)
SELECT rs.region,
       COUNT(*) as systems_tracked,
       COUNT(CASE WHEN rs.total_activity > 0 THEN 1 END) as active_systems,
       SUM(rs.FLEET_SPAWNS) as total_fleet_spawns,
       SUM(rs.ENTITY_SPAWNS) as total_entity_spawns,
       SUM(rs.total_activity) as total_NPC_activity,
       AVG(rs.FLEET_SPAWNS) as avg_fleet_spawns,
       AVG(rs.ENTITY_SPAWNS) as avg_entity_spawns,
       MAX(rs.total_activity) as peak_system_activity,
       ROUND(COUNT(CASE WHEN rs.total_activity > 0 THEN 1 END) * 100.0 / COUNT(*), 2) as activity_percentage
FROM regional_stats rs
GROUP BY rs.region
ORDER BY SUM(rs.total_activity) DESC;
```

### NPC deployment patterns and strategic analysis
```sql
-- NPC deployment strategy analysis
WITH deployment_patterns AS (
    SELECT ns.*,
           ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_spawns,
           CASE 
               WHEN ns.FLEET_SPAWNS >= 100 AND ns.ENTITY_SPAWNS >= 100 THEN 'MAJOR_DEPLOYMENT'
               WHEN ns.FLEET_SPAWNS >= 50 OR ns.ENTITY_SPAWNS >= 50 THEN 'SIGNIFICANT_DEPLOYMENT'
               WHEN ns.FLEET_SPAWNS >= 20 OR ns.ENTITY_SPAWNS >= 20 THEN 'MODERATE_DEPLOYMENT'
               WHEN ns.FLEET_SPAWNS >= 5 OR ns.ENTITY_SPAWNS >= 5 THEN 'MINOR_DEPLOYMENT'
               WHEN ns.FLEET_SPAWNS > 0 OR ns.ENTITY_SPAWNS > 0 THEN 'MINIMAL_DEPLOYMENT'
               ELSE 'NO_DEPLOYMENT'
           END as deployment_scale,
           CASE 
               WHEN ns.FLEET_SPAWNS > 0 AND ns.ENTITY_SPAWNS = 0 THEN 'FLEET_EXCLUSIVE'
               WHEN ns.ENTITY_SPAWNS > 0 AND ns.FLEET_SPAWNS = 0 THEN 'ENTITY_EXCLUSIVE'
               WHEN ns.FLEET_SPAWNS > ns.ENTITY_SPAWNS * 2 THEN 'FLEET_PRIORITY'
               WHEN ns.ENTITY_SPAWNS > ns.FLEET_SPAWNS * 2 THEN 'ENTITY_PRIORITY'
               WHEN ns.FLEET_SPAWNS > 0 AND ns.ENTITY_SPAWNS > 0 THEN 'MIXED_DEPLOYMENT'
               ELSE 'INACTIVE'
           END as deployment_type
    FROM NPC_STATS ns
)
SELECT dp.deployment_scale,
       dp.deployment_type,
       COUNT(*) as system_count,
       AVG(dp.FLEET_SPAWNS) as avg_fleet_spawns,
       AVG(dp.ENTITY_SPAWNS) as avg_entity_spawns,
       SUM(dp.total_spawns) as total_NPC_spawns,
       MAX(dp.total_spawns) as max_system_spawns,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM NPC_STATS), 2) as percentage_of_systems
FROM deployment_patterns dp
GROUP BY dp.deployment_scale, dp.deployment_type
ORDER BY SUM(dp.total_spawns) DESC;
```

```sql
-- High-value target identification based on NPC activity
WITH target_analysis AS (
    SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
           ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
           ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_activity,
           SQRT(POWER(ns.SYS_X, 2) + POWER(ns.SYS_Y, 2) + POWER(ns.SYS_Z, 2)) as distance_from_origin,
           -- Strategic value calculation
           CASE 
               WHEN ns.FLEET_SPAWNS >= 200 THEN 5  -- High military value
               WHEN ns.FLEET_SPAWNS >= 100 THEN 4
               WHEN ns.FLEET_SPAWNS >= 50 THEN 3
               WHEN ns.FLEET_SPAWNS >= 20 THEN 2
               WHEN ns.FLEET_SPAWNS >= 5 THEN 1
               ELSE 0
           END +
           CASE 
               WHEN ns.ENTITY_SPAWNS >= 200 THEN 3  -- High infrastructure value
               WHEN ns.ENTITY_SPAWNS >= 100 THEN 2
               WHEN ns.ENTITY_SPAWNS >= 50 THEN 1
               ELSE 0
           END as strategic_value
    FROM NPC_STATS ns
    WHERE ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0
)
SELECT ta.SYS_X, ta.SYS_Y, ta.SYS_Z,
       ta.FLEET_SPAWNS, ta.ENTITY_SPAWNS, ta.total_activity,
       ROUND(ta.distance_from_origin, 2) as distance_from_origin,
       ta.strategic_value,
       CASE 
           WHEN ta.strategic_value >= 7 THEN 'CRITICAL_TARGET'
           WHEN ta.strategic_value >= 5 THEN 'HIGH_VALUE_TARGET'
           WHEN ta.strategic_value >= 3 THEN 'MEDIUM_VALUE_TARGET'
           WHEN ta.strategic_value >= 1 THEN 'LOW_VALUE_TARGET'
           ELSE 'MINIMAL_VALUE'
       END as target_priority,
       CASE 
           WHEN ta.distance_from_origin <= 10 THEN 'CORE_POSITION'
           WHEN ta.distance_from_origin <= 25 THEN 'STRATEGIC_POSITION'
           WHEN ta.distance_from_origin <= 50 THEN 'REGIONAL_POSITION'
           ELSE 'REMOTE_POSITION'
       END as positional_value
FROM target_analysis ta
WHERE ta.strategic_value > 0
ORDER BY ta.strategic_value DESC, ta.total_activity DESC;
```

---

## Performance and Resource Analysis

### Server performance impact assessment
```sql
-- Server performance impact analysis from NPC activity
WITH performance_analysis AS (
    SELECT ns.*,
           ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_load,
           -- Performance impact estimation
           ns.FLEET_SPAWNS * 10 + ns.ENTITY_SPAWNS * 3 as estimated_cpu_load,
           ns.FLEET_SPAWNS * 5 + ns.ENTITY_SPAWNS * 2 as estimated_memory_load,
           ns.FLEET_SPAWNS * 8 + ns.ENTITY_SPAWNS * 1 as estimated_network_load
    FROM NPC_STATS ns
    WHERE ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0
)
SELECT 
    CASE 
        WHEN pa.total_load >= 1000 THEN 'CRITICAL_LOAD'
        WHEN pa.total_load >= 500 THEN 'VERY_HIGH_LOAD'
        WHEN pa.total_load >= 200 THEN 'HIGH_LOAD'
        WHEN pa.total_load >= 100 THEN 'MODERATE_LOAD'
        WHEN pa.total_load >= 50 THEN 'LOW_LOAD'
        ELSE 'MINIMAL_LOAD'
    END as load_category,
    COUNT(*) as system_count,
    SUM(pa.total_load) as total_NPC_load,
    AVG(pa.estimated_cpu_load) as avg_cpu_impact,
    AVG(pa.estimated_memory_load) as avg_memory_impact,
    AVG(pa.estimated_network_load) as avg_network_impact,
    SUM(pa.estimated_cpu_load) as total_cpu_load,
    SUM(pa.estimated_memory_load) as total_memory_load,
    SUM(pa.estimated_network_load) as total_network_load
FROM performance_analysis pa
GROUP BY 
    CASE 
        WHEN pa.total_load >= 1000 THEN 'CRITICAL_LOAD'
        WHEN pa.total_load >= 500 THEN 'VERY_HIGH_LOAD'
        WHEN pa.total_load >= 200 THEN 'HIGH_LOAD'
        WHEN pa.total_load >= 100 THEN 'MODERATE_LOAD'
        WHEN pa.total_load >= 50 THEN 'LOW_LOAD'
        ELSE 'MINIMAL_LOAD'
    END
ORDER BY SUM(pa.total_load) DESC;
```

```sql
-- Resource utilization and optimization recommendations
WITH resource_analysis AS (
    SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
           ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
           ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_spawns,
           -- Resource efficiency metrics
           CASE 
               WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS = 0 THEN 0
               ELSE ROUND(ns.FLEET_SPAWNS * 100.0 / (ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS), 2)
           END as fleet_percentage,
           -- Performance impact score
           (ns.FLEET_SPAWNS * 15 + ns.ENTITY_SPAWNS * 5) as performance_score
    FROM NPC_STATS ns
    WHERE ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0
)
SELECT ra.SYS_X, ra.SYS_Y, ra.SYS_Z,
       ra.FLEET_SPAWNS, ra.ENTITY_SPAWNS, ra.total_spawns,
       ra.fleet_percentage,
       ra.performance_score,
       CASE 
           WHEN ra.performance_score >= 10000 THEN 'IMMEDIATE_OPTIMIZATION_REQUIRED'
           WHEN ra.performance_score >= 5000 THEN 'HIGH_PRIORITY_OPTIMIZATION'
           WHEN ra.performance_score >= 2000 THEN 'MEDIUM_PRIORITY_OPTIMIZATION'
           WHEN ra.performance_score >= 1000 THEN 'LOW_PRIORITY_OPTIMIZATION'
           ELSE 'ACCEPTABLE_PERFORMANCE'
       END as optimization_priority,
       CASE 
           WHEN ra.FLEET_SPAWNS > 200 THEN 'REDUCE_FLEET_SPAWNS'
           WHEN ra.ENTITY_SPAWNS > 500 THEN 'REDUCE_ENTITY_SPAWNS'
           WHEN ra.total_spawns > 300 THEN 'BALANCE_SPAWN_TYPES'
           WHEN ra.fleet_percentage > 80 THEN 'DIVERSIFY_WITH_ENTITIES'
           WHEN ra.fleet_percentage < 20 THEN 'ADD_FLEET_PRESENCE'
           ELSE 'MAINTAIN_CURRENT_LEVELS'
       END as optimization_recommendation
FROM resource_analysis ra
ORDER BY ra.performance_score DESC;
```

### NPC population efficiency and balance analysis
```sql
-- NPC population distribution efficiency
WITH efficiency_metrics AS (
    SELECT ns.*,
           ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_spawns,
           CASE 
               WHEN ns.ENTITY_SPAWNS = 0 THEN NULL
               ELSE ROUND(ns.FLEET_SPAWNS * 1.0 / ns.ENTITY_SPAWNS, 2)
           END as fleet_to_entity_ratio,
           SQRT(POWER(ns.SYS_X, 2) + POWER(ns.SYS_Y, 2) + POWER(ns.SYS_Z, 2)) as distance_from_core
    FROM NPC_STATS ns
    WHERE ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0
)
SELECT 
    CASE 
        WHEN em.distance_from_core <= 15 THEN 'CORE_SYSTEMS'
        WHEN em.distance_from_core <= 35 THEN 'INNER_SYSTEMS'
        WHEN em.distance_from_core <= 65 THEN 'MIDDLE_SYSTEMS'
        WHEN em.distance_from_core <= 100 THEN 'OUTER_SYSTEMS'
        ELSE 'FRONTIER_SYSTEMS'
    END as system_zone,
    COUNT(*) as system_count,
    SUM(em.total_spawns) as total_NPC_population,
    AVG(em.total_spawns) as avg_spawns_per_system,
    AVG(em.FLEET_SPAWNS) as avg_fleet_spawns,
    AVG(em.ENTITY_SPAWNS) as avg_entity_spawns,
    AVG(em.fleet_to_entity_ratio) as avg_fleet_entity_ratio,
    MAX(em.total_spawns) as max_system_population,
    MIN(em.total_spawns) as min_system_population,
    STDDEV_POP(em.total_spawns) as population_variance
FROM efficiency_metrics em
GROUP BY 
    CASE 
        WHEN em.distance_from_core <= 15 THEN 'CORE_SYSTEMS'
        WHEN em.distance_from_core <= 35 THEN 'INNER_SYSTEMS'
        WHEN em.distance_from_core <= 65 THEN 'MIDDLE_SYSTEMS'
        WHEN em.distance_from_core <= 100 THEN 'OUTER_SYSTEMS'
        ELSE 'FRONTIER_SYSTEMS'
    END
ORDER BY AVG(em.total_spawns) DESC;
```

```sql
-- System load balancing analysis
WITH load_analysis AS (
    SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
           ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
           ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as system_load,
           AVG(ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS) OVER() as global_avg_load,
           STDDEV_POP(ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS) OVER() as global_load_stddev
    FROM NPC_STATS ns
    WHERE ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0
)
SELECT la.SYS_X, la.SYS_Y, la.SYS_Z,
       la.FLEET_SPAWNS, la.ENTITY_SPAWNS, la.system_load,
       ROUND(la.global_avg_load, 2) as global_average,
       ROUND(la.system_load - la.global_avg_load, 2) as load_deviation,
       CASE 
           WHEN la.system_load > la.global_avg_load + (2 * la.global_load_stddev) THEN 'SEVERELY_OVERLOADED'
           WHEN la.system_load > la.global_avg_load + la.global_load_stddev THEN 'OVERLOADED'
           WHEN la.system_load > la.global_avg_load THEN 'ABOVE_AVERAGE'
           WHEN la.system_load < la.global_avg_load - la.global_load_stddev THEN 'UNDERLOADED'
           WHEN la.system_load < la.global_avg_load - (2 * la.global_load_stddev) THEN 'SEVERELY_UNDERLOADED'
           ELSE 'BALANCED'
       END as load_status,
       CASE 
           WHEN la.system_load > la.global_avg_load + (2 * la.global_load_stddev) THEN 'REDISTRIBUTE_NPCS_OUT'
           WHEN la.system_load < la.global_avg_load - la.global_load_stddev THEN 'INCREASE_NPC_PRESENCE'
           ELSE 'MAINTAIN_CURRENT_LOAD'
       END as balancing_recommendation
FROM load_analysis la
ORDER BY load_deviation DESC;
```

---

## Data Management and Validation

### NPC statistics data validation and integrity
```sql
-- Comprehensive NPC statistics validation
WITH validation_checks AS (
    -- Check 1: Invalid ID values (should always be -10000000)
    SELECT 'INVALID_ID_VALUES' as check_type, COUNT(*) as issues
    FROM NPC_STATS ns
    WHERE ns.ID != -10000000
    
    UNION ALL
    
    -- Check 2: Negative spawn counts
    SELECT 'NEGATIVE_SPAWN_COUNTS' as check_type, COUNT(*) as issues
    FROM NPC_STATS ns
    WHERE ns.FLEET_SPAWNS < 0 OR ns.ENTITY_SPAWNS < 0
    
    UNION ALL
    
    -- Check 3: NULL coordinate values
    SELECT 'NULL_COORDINATES' as check_type, COUNT(*) as issues
    FROM NPC_STATS ns
    WHERE ns.SYS_X IS NULL OR ns.SYS_Y IS NULL OR ns.SYS_Z IS NULL
    
    UNION ALL
    
    -- Check 4: Extreme coordinate values (beyond reasonable bounds)
    SELECT 'EXTREME_COORDINATES' as check_type, COUNT(*) as issues
    FROM NPC_STATS ns
    WHERE ABS(ns.SYS_X) > 1000 OR ABS(ns.SYS_Y) > 1000 OR ABS(ns.SYS_Z) > 1000
    
    UNION ALL
    
    -- Check 5: Impossibly high spawn counts
    SELECT 'EXCESSIVE_SPAWN_COUNTS' as check_type, COUNT(*) as issues
    FROM NPC_STATS ns
    WHERE ns.FLEET_SPAWNS > 50000 OR ns.ENTITY_SPAWNS > 100000
    
    UNION ALL
    
    -- Check 6: Duplicate coordinate combinations
    SELECT 'DUPLICATE_COORDINATES' as check_type, 
           COUNT(*) - COUNT(DISTINCT CONCAT(ns.SYS_X, ',', ns.SYS_Y, ',', ns.SYS_Z)) as issues
    FROM NPC_STATS ns
    
    UNION ALL
    
    -- Check 7: Inconsistent spawn patterns (both spawns are 0 but record exists)
    SELECT 'ZERO_ACTIVITY_RECORDS' as check_type, COUNT(*) as issues
    FROM NPC_STATS ns
    WHERE ns.FLEET_SPAWNS = 0 AND ns.ENTITY_SPAWNS = 0
)
SELECT 
    vc.check_type,
    vc.issues,
    CASE 
        WHEN vc.issues = 0 THEN 'PASS'
        WHEN vc.issues < 5 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status,
    CASE vc.check_type
        WHEN 'INVALID_ID_VALUES' THEN 'All ID values should be -10000000'
        WHEN 'NEGATIVE_SPAWN_COUNTS' THEN 'Spawn counts cannot be negative'
        WHEN 'NULL_COORDINATES' THEN 'System coordinates must not be NULL'
        WHEN 'EXTREME_COORDINATES' THEN 'Coordinates exceed reasonable galaxy bounds'
        WHEN 'EXCESSIVE_SPAWN_COUNTS' THEN 'Spawn counts exceed realistic limits'
        WHEN 'DUPLICATE_COORDINATES' THEN 'Multiple records for same system coordinates'
        WHEN 'ZERO_ACTIVITY_RECORDS' THEN 'Records with no NPC activity should be cleaned'
        ELSE 'Unknown validation issue'
    END as description
FROM validation_checks vc
ORDER BY 
    CASE vc.status 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'WARNING' THEN 2 
        ELSE 3 
    END, vc.issues DESC;
```

```sql
-- NPC statistics system analysis and health metrics
SELECT 
    'NPC_STATISTICS_ANALYSIS' as metric_type,
    COUNT(*) as total_system_records,
    COUNT(CASE WHEN ns.FLEET_SPAWNS > 0 OR ns.ENTITY_SPAWNS > 0 THEN 1 END) as active_systems,
    COUNT(CASE WHEN ns.FLEET_SPAWNS = 0 AND ns.ENTITY_SPAWNS = 0 THEN 1 END) as inactive_systems,
    SUM(ns.FLEET_SPAWNS) as total_fleet_spawns,
    SUM(ns.ENTITY_SPAWNS) as total_entity_spawns,
    AVG(ns.FLEET_SPAWNS) as avg_fleet_spawns_per_system,
    AVG(ns.ENTITY_SPAWNS) as avg_entity_spawns_per_system,
    MAX(ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS) as highest_system_activity,
    MIN(CASE WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0 THEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS END) as lowest_active_system,
    STDDEV_POP(ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS) as activity_variance
FROM NPC_STATS ns;
```

### Maintenance operations and data cleanup
```sql
-- Identify cleanup and optimization candidates
-- Note: These are analysis queries; actual cleanup requires careful consideration

-- Find systems with no NPC activity for potential cleanup
SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
       ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
       'INACTIVE_SYSTEM_CLEANUP' as cleanup_reason
FROM NPC_STATS ns
WHERE ns.FLEET_SPAWNS = 0 AND ns.ENTITY_SPAWNS = 0
ORDER BY ns.SYS_X, ns.SYS_Y, ns.SYS_Z;
```

```sql
-- Find systems with suspicious spawn patterns
SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
       ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
       ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_spawns,
       CASE 
           WHEN ns.FLEET_SPAWNS > 10000 THEN 'EXCESSIVE_FLEET_SPAWNS'
           WHEN ns.ENTITY_SPAWNS > 20000 THEN 'EXCESSIVE_ENTITY_SPAWNS'
           WHEN ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 15000 THEN 'EXCESSIVE_TOTAL_SPAWNS'
           ELSE 'SUSPICIOUS_PATTERN'
       END as issue_type
FROM NPC_STATS ns
WHERE ns.FLEET_SPAWNS > 10000 
   OR ns.ENTITY_SPAWNS > 20000 
   OR ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 15000
ORDER BY total_spawns DESC;
```

```sql
-- Find systems with invalid coordinate patterns
SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
       ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
       'COORDINATE_VALIDATION_ISSUE' as issue_type,
       CASE 
           WHEN ABS(ns.SYS_X) > 500 OR ABS(ns.SYS_Y) > 500 OR ABS(ns.SYS_Z) > 500 THEN 'EXTREME_COORDINATES'
           WHEN ns.ID != -10000000 THEN 'INVALID_ID'
           ELSE 'OTHER_COORDINATE_ISSUE'
       END as specific_issue
FROM NPC_STATS ns
WHERE ABS(ns.SYS_X) > 500 
   OR ABS(ns.SYS_Y) > 500 
   OR ABS(ns.SYS_Z) > 500
   OR ns.ID != -10000000
ORDER BY ABS(ns.SYS_X) + ABS(ns.SYS_Y) + ABS(ns.SYS_Z) DESC;
```

```sql
-- Performance summary after maintenance
SELECT 
    'NPC_STATS_MAINTENANCE_SUMMARY' as operation,
    COUNT(*) as total_records,
    COUNT(CASE WHEN FLEET_SPAWNS > 0 OR ENTITY_SPAWNS > 0 THEN 1 END) as records_with_activity,
    COUNT(CASE WHEN FLEET_SPAWNS = 0 AND ENTITY_SPAWNS = 0 THEN 1 END) as inactive_records,
    SUM(FLEET_SPAWNS) as total_fleet_spawns_tracked,
    SUM(ENTITY_SPAWNS) as total_entity_spawns_tracked,
    COUNT(CASE WHEN FLEET_SPAWNS + ENTITY_SPAWNS > 1000 THEN 1 END) as high_activity_systems,
    AVG(FLEET_SPAWNS + ENTITY_SPAWNS) as avg_total_spawns_per_system
FROM NPC_STATS;
```

---

## Reporting and Strategic Intelligence

### Comprehensive NPC activity intelligence report
```sql
-- Complete NPC activity system report
SELECT 
    'NPC_ACTIVITY_INTELLIGENCE_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    COUNT(*) as total_systems_tracked,
    COUNT(CASE WHEN FLEET_SPAWNS > 0 OR ENTITY_SPAWNS > 0 THEN 1 END) as systems_with_NPC_activity,
    SUM(FLEET_SPAWNS) as total_fleets_spawned,
    SUM(ENTITY_SPAWNS) as total_entities_spawned,
    AVG(FLEET_SPAWNS) as avg_fleet_spawns_per_system,
    AVG(ENTITY_SPAWNS) as avg_entity_spawns_per_system,
    MAX(FLEET_SPAWNS + ENTITY_SPAWNS) as highest_system_activity,
    COUNT(CASE WHEN FLEET_SPAWNS + ENTITY_SPAWNS >= 1000 THEN 1 END) as critical_activity_systems,
    COUNT(CASE WHEN FLEET_SPAWNS + ENTITY_SPAWNS >= 500 THEN 1 END) as high_activity_systems,
    COUNT(CASE WHEN FLEET_SPAWNS + ENTITY_SPAWNS >= 100 THEN 1 END) as moderate_activity_systems
FROM NPC_STATS;
```

```sql
-- Top NPC activity systems summary
SELECT ns.SYS_X, ns.SYS_Y, ns.SYS_Z,
       ns.FLEET_SPAWNS, ns.ENTITY_SPAWNS,
       ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS as total_activity,
       ROUND(SQRT(POWER(ns.SYS_X, 2) + POWER(ns.SYS_Y, 2) + POWER(ns.SYS_Z, 2)), 2) as distance_from_origin,
       CASE 
           WHEN ns.FLEET_SPAWNS > ns.ENTITY_SPAWNS * 2 THEN 'MILITARY_DOMINATED'
           WHEN ns.ENTITY_SPAWNS > ns.FLEET_SPAWNS * 2 THEN 'INFRASTRUCTURE_DOMINATED'
           WHEN ns.FLEET_SPAWNS > ns.ENTITY_SPAWNS THEN 'FLEET_LEANING'
           WHEN ns.ENTITY_SPAWNS > ns.FLEET_SPAWNS THEN 'ENTITY_LEANING'
           ELSE 'BALANCED'
       END as activity_composition
FROM NPC_STATS ns
WHERE ns.FLEET_SPAWNS + ns.ENTITY_SPAWNS > 0
ORDER BY total_activity DESC
LIMIT 25;
```

---

## Changelog

| Version | Date       | Author       | Description                                     |
|---------|------------|--------------|-----------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of NPC_STATS example queries |

[INDEX](./INDEX.md) | [NPC_STATS](./TABLE_NPC_STATS.md)