# EFFECTS - Example SQL Queries & Operations

These examples target HyperSQL (HSQLDB) 2.3.4 database. **All queries focus exclusively on the EFFECTS table.**

---

## Basic Effect Queries

### Find effects by entity or type
```sql
-- Search effects applied to a specific entity
SELECT eff.ID, eff.ENTITY_ID, eff.TYPE, eff.EFFECT_UID
FROM EFFECTS eff
WHERE eff.ENTITY_ID = ?
ORDER BY eff.TYPE, eff.EFFECT_UID;
```

```sql
-- Find all entities with a specific effect
SELECT eff.ID, eff.ENTITY_ID, eff.TYPE, eff.EFFECT_UID
FROM EFFECTS eff
WHERE eff.EFFECT_UID = 'SPEED_BOOST'
ORDER BY eff.ENTITY_ID;
```

```sql
-- Search effects by type
SELECT eff.ID, eff.ENTITY_ID, eff.EFFECT_UID,
       CASE eff.TYPE
           WHEN 0 THEN 'STRUCTURE'
           WHEN 1 THEN 'ENTITY_WIDE'
           WHEN 2 THEN 'SECTOR'
           WHEN 3 THEN 'SYSTEM'
           ELSE 'UNKNOWN'
       END as effect_scope
FROM EFFECTS eff
WHERE eff.TYPE = 1  -- Entity-wide effects only
ORDER BY eff.EFFECT_UID, eff.ENTITY_ID;
```

### Count effects by type and UID
```sql
-- Distribution of effect types
SELECT eff.TYPE,
       CASE eff.TYPE
           WHEN 0 THEN 'STRUCTURE'
           WHEN 1 THEN 'ENTITY_WIDE'
           WHEN 2 THEN 'SECTOR'
           WHEN 3 THEN 'SYSTEM'
           ELSE 'UNKNOWN'
       END as scope_name,
       COUNT(*) as effect_count,
       COUNT(DISTINCT eff.ENTITY_ID) as affected_entities,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM EFFECTS), 2) as percentage
FROM EFFECTS eff
GROUP BY eff.TYPE
ORDER BY effect_count DESC;
```

```sql
-- Most common effect UIDs
SELECT eff.EFFECT_UID,
       COUNT(*) as usage_count,
       COUNT(DISTINCT eff.ENTITY_ID) as entities_affected,
       COUNT(DISTINCT eff.TYPE) as scope_variety
FROM EFFECTS eff
WHERE eff.EFFECT_UID IS NOT NULL
GROUP BY eff.EFFECT_UID
ORDER BY usage_count DESC
LIMIT 20;
```

---

## Entity Effect Analysis

### Entities with multiple effects
```sql
-- Find entities with the most effects applied
WITH entity_effect_counts AS (
    SELECT 
        eff.ENTITY_ID,
        COUNT(*) as total_effects,
        COUNT(DISTINCT eff.TYPE) as effect_types,
        COUNT(DISTINCT eff.EFFECT_UID) as unique_effects
    FROM EFFECTS eff
    GROUP BY eff.ENTITY_ID
)
SELECT 
    eec.ENTITY_ID,
    eec.total_effects,
    eec.effect_types,
    eec.unique_effects,
    CASE 
        WHEN eec.total_effects >= 10 THEN 'HEAVILY_BUFFED'
        WHEN eec.total_effects >= 5 THEN 'MULTI_BUFFED'
        WHEN eec.total_effects >= 3 THEN 'BUFFED'
        WHEN eec.total_effects = 2 THEN 'DUAL_EFFECT'
        ELSE 'SINGLE_EFFECT'
    END as buff_level
FROM entity_effect_counts eec
ORDER BY eec.total_effects DESC, eec.unique_effects DESC
LIMIT 50;
```

### Effect combination analysis
```sql
-- Common effect combinations on the same entities
WITH entity_effects AS (
    SELECT 
        eff.ENTITY_ID,
        GROUP_CONCAT(eff.EFFECT_UID ORDER BY eff.EFFECT_UID SEPARATOR '|') as effect_combination
    FROM EFFECTS eff
    WHERE eff.EFFECT_UID IS NOT NULL
    GROUP BY eff.ENTITY_ID
    HAVING COUNT(DISTINCT eff.EFFECT_UID) > 1
)
SELECT 
    ee.effect_combination,
    COUNT(*) as entity_count,
    ROUND(COUNT(*) * 100.0 / 
          (SELECT COUNT(DISTINCT ENTITY_ID) FROM EFFECTS), 2) as percentage
FROM entity_effects ee
GROUP BY ee.effect_combination
ORDER BY entity_count DESC
LIMIT 20;
```

---

## Effect Category Analysis

### Movement and speed effects
```sql
-- Analyze movement-related effects
SELECT 
    eff.EFFECT_UID,
    COUNT(*) as usage_count,
    COUNT(DISTINCT eff.ENTITY_ID) as entities_affected,
    CASE eff.TYPE
        WHEN 0 THEN 'STRUCTURE'
        WHEN 1 THEN 'ENTITY_WIDE'
        WHEN 2 THEN 'SECTOR'
        WHEN 3 THEN 'SYSTEM'
    END as most_common_scope
FROM EFFECTS eff
WHERE eff.EFFECT_UID IN ('SPEED_BOOST', 'JUMP_DRIVE_CHARGE', 'THRUST_EFFECTIVENESS')
GROUP BY eff.EFFECT_UID, eff.TYPE
ORDER BY usage_count DESC;
```

### Defense and protection effects
```sql
-- Analyze defensive effect distribution
WITH defense_effects AS (
    SELECT 
        eff.ENTITY_ID,
        COUNT(CASE WHEN eff.EFFECT_UID = 'SHIELD_RECHARGE' THEN 1 END) as shield_recharge,
        COUNT(CASE WHEN eff.EFFECT_UID = 'SHIELD_CAPACITY' THEN 1 END) as shield_capacity,
        COUNT(CASE WHEN eff.EFFECT_UID = 'ARMOR_EFFECTIVENESS' THEN 1 END) as armor_boost,
        COUNT(CASE WHEN eff.EFFECT_UID = 'ION_RESISTANCE' THEN 1 END) as ion_resist
    FROM EFFECTS eff
    WHERE eff.EFFECT_UID IN ('SHIELD_RECHARGE', 'SHIELD_CAPACITY', 'ARMOR_EFFECTIVENESS', 'ION_RESISTANCE')
    GROUP BY eff.ENTITY_ID
)
SELECT 
    CASE 
        WHEN de.shield_recharge > 0 AND de.shield_capacity > 0 THEN 'FULL_SHIELD_ENHANCEMENT'
        WHEN de.shield_recharge > 0 OR de.shield_capacity > 0 THEN 'PARTIAL_SHIELD_ENHANCEMENT'
        WHEN de.armor_boost > 0 THEN 'ARMOR_FOCUSED'
        WHEN de.ion_resist > 0 THEN 'ION_PROTECTED'
        ELSE 'NO_DEFENSE_BUFFS'
    END as defense_configuration,
    COUNT(*) as entity_count
FROM defense_effects de
GROUP BY 
    CASE 
        WHEN de.shield_recharge > 0 AND de.shield_capacity > 0 THEN 'FULL_SHIELD_ENHANCEMENT'
        WHEN de.shield_recharge > 0 OR de.shield_capacity > 0 THEN 'PARTIAL_SHIELD_ENHANCEMENT'
        WHEN de.armor_boost > 0 THEN 'ARMOR_FOCUSED'
        WHEN de.ion_resist > 0 THEN 'ION_PROTECTED'
        ELSE 'NO_DEFENSE_BUFFS'
    END
ORDER BY entity_count DESC;
```

### Stealth and reconnaissance effects
```sql
-- Analyze stealth and detection capabilities
SELECT 
    eff.EFFECT_UID,
    eff.TYPE,
    COUNT(*) as instances,
    COUNT(DISTINCT eff.ENTITY_ID) as entities_with_effect,
    CASE 
        WHEN eff.EFFECT_UID IN ('STEALTH', 'CLOAKING') THEN 'CONCEALMENT'
        WHEN eff.EFFECT_UID IN ('SCANNER_RANGE', 'JAMMING') THEN 'DETECTION'
        ELSE 'OTHER'
    END as capability_type
FROM EFFECTS eff
WHERE eff.EFFECT_UID IN ('STEALTH', 'CLOAKING', 'SCANNER_RANGE', 'JAMMING')
GROUP BY eff.EFFECT_UID, eff.TYPE
ORDER BY instances DESC;
```

---

## Scope-Based Analysis

### Effects by scope level
```sql
-- Analyze effect distribution across different scopes
WITH scope_analysis AS (
    SELECT 
        eff.TYPE as scope_type,
        eff.EFFECT_UID,
        COUNT(*) as effect_count,
        COUNT(DISTINCT eff.ENTITY_ID) as unique_entities
    FROM EFFECTS eff
    WHERE eff.EFFECT_UID IS NOT NULL
    GROUP BY eff.TYPE, eff.EFFECT_UID
)
SELECT 
    CASE sa.scope_type
        WHEN 0 THEN 'STRUCTURE'
        WHEN 1 THEN 'ENTITY_WIDE'
        WHEN 2 THEN 'SECTOR'
        WHEN 3 THEN 'SYSTEM'
    END as scope_name,
    sa.EFFECT_UID,
    sa.effect_count,
    sa.unique_entities,
    ROUND(sa.effect_count * 100.0 / 
          SUM(sa.effect_count) OVER (PARTITION BY sa.EFFECT_UID), 2) as percentage_of_effect
FROM scope_analysis sa
ORDER BY sa.EFFECT_UID, sa.scope_type;
```

### System-wide effects impact
```sql
-- Find entities benefiting from system-wide effects
SELECT 
    eff.ENTITY_ID,
    eff.EFFECT_UID,
    COUNT(*) as system_effects_count
FROM EFFECTS eff
WHERE eff.TYPE = 3  -- System-wide effects
GROUP BY eff.ENTITY_ID, eff.EFFECT_UID
ORDER BY system_effects_count DESC, eff.ENTITY_ID;
```

---

## Effect Profiles

### Entity effect profiles
```sql
-- Categorize entities based on their effect profiles
WITH effect_profiles AS (
    SELECT 
        eff.ENTITY_ID,
        COUNT(*) as total_effects,
        COUNT(CASE WHEN eff.EFFECT_UID IN ('SPEED_BOOST', 'THRUST_EFFECTIVENESS', 'JUMP_DRIVE_CHARGE') THEN 1 END) as mobility_effects,
        COUNT(CASE WHEN eff.EFFECT_UID IN ('SHIELD_RECHARGE', 'SHIELD_CAPACITY', 'ARMOR_EFFECTIVENESS', 'ION_RESISTANCE') THEN 1 END) as defensive_effects,
        COUNT(CASE WHEN eff.EFFECT_UID IN ('DAMAGE_MULTIPLIER', 'POWER_GENERATION', 'POWER_CAPACITY') THEN 1 END) as offensive_effects,
        COUNT(CASE WHEN eff.EFFECT_UID IN ('MINING_EFFECTIVENESS', 'SCANNER_RANGE') THEN 1 END) as utility_effects,
        COUNT(CASE WHEN eff.EFFECT_UID IN ('STEALTH', 'CLOAKING', 'JAMMING') THEN 1 END) as stealth_effects,
        COUNT(CASE WHEN eff.TYPE = 0 THEN 1 END) as structure_effects,
        COUNT(CASE WHEN eff.TYPE = 1 THEN 1 END) as entity_effects,
        COUNT(CASE WHEN eff.TYPE = 2 THEN 1 END) as sector_effects,
        COUNT(CASE WHEN eff.TYPE = 3 THEN 1 END) as system_effects
    FROM EFFECTS eff
    GROUP BY eff.ENTITY_ID
),
profile_categories AS (
    SELECT 
        ep.*,
        CASE 
            WHEN ep.stealth_effects > 0 THEN 'STEALTH_SPECIALIST'
            WHEN ep.defensive_effects > ep.offensive_effects THEN 'DEFENSIVE_FOCUSED'
            WHEN ep.offensive_effects > 2 THEN 'OFFENSE_HEAVY'
            WHEN ep.mobility_effects > 2 THEN 'SPEED_DEMON'
            WHEN ep.utility_effects > 0 THEN 'UTILITY_CRAFT'
            WHEN ep.system_effects > 0 THEN 'SYSTEM_WIDE'
            WHEN ep.sector_effects > 0 THEN 'SECTOR_BASED'
            WHEN ep.structure_effects > 0 THEN 'STRUCTURE_ONLY'
            ELSE 'MINIMAL_EFFECTS'
        END as profile_category
    FROM effect_profiles ep
)
SELECT 
    pc.profile_category,
    COUNT(*) as entity_count,
    AVG(pc.total_effects) as avg_total_effects,
    AVG(pc.mobility_effects) as avg_mobility_effects,
    AVG(pc.defensive_effects) as avg_defensive_effects,
    AVG(pc.offensive_effects) as avg_offensive_effects,
    AVG(pc.stealth_effects) as avg_stealth_effects
FROM profile_categories pc
GROUP BY pc.profile_category
ORDER BY entity_count DESC;
```

---

## Data Maintenance and Integrity

### Effect data integrity check
```sql
-- Comprehensive data integrity validation for EFFECTS table
WITH integrity_checks AS (
    -- Check 1: Missing ENTITY_ID
    SELECT 'MISSING_ENTITY_ID' as check_type, COUNT(*) as issues
    FROM EFFECTS eff
    WHERE eff.ENTITY_ID IS NULL
    
    UNION ALL
    
    -- Check 2: Invalid TYPE values
    SELECT 'INVALID_TYPE' as check_type, COUNT(*) as issues
    FROM EFFECTS eff
    WHERE eff.TYPE NOT IN (0, 1, 2, 3)
    
    UNION ALL
    
    -- Check 3: Empty or NULL EFFECT_UID
    SELECT 'EMPTY_EFFECT_UID' as check_type, COUNT(*) as issues
    FROM EFFECTS eff
    WHERE eff.EFFECT_UID IS NULL OR TRIM(eff.EFFECT_UID) = ''
    
    UNION ALL
    
    -- Check 4: Unrecognized EFFECT_UID values
    SELECT 'UNRECOGNIZED_EFFECT_UID' as check_type, COUNT(*) as issues
    FROM EFFECTS eff
    WHERE eff.EFFECT_UID IS NOT NULL 
    AND eff.EFFECT_UID NOT IN (
        'SPEED_BOOST', 'JUMP_DRIVE_CHARGE', 'THRUST_EFFECTIVENESS',
        'SHIELD_RECHARGE', 'SHIELD_CAPACITY', 'ARMOR_EFFECTIVENESS', 'ION_RESISTANCE',
        'DAMAGE_MULTIPLIER', 'POWER_GENERATION', 'POWER_CAPACITY',
        'MINING_EFFECTIVENESS', 'SCANNER_RANGE', 'STEALTH', 'JAMMING', 'CLOAKING'
    )
    
    UNION ALL
    
    -- Check 5: Duplicate effects on same entity
    SELECT 'DUPLICATE_EFFECTS' as check_type, COUNT(*) as issues
    FROM (
        SELECT eff.ENTITY_ID, eff.EFFECT_UID
        FROM EFFECTS eff
        WHERE eff.EFFECT_UID IS NOT NULL
        GROUP BY eff.ENTITY_ID, eff.EFFECT_UID
        HAVING COUNT(*) > 1
    ) duplicates
)
SELECT 
    ic.check_type,
    ic.issues,
    CASE 
        WHEN ic.issues = 0 THEN 'PASS'
        WHEN ic.issues < 10 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status
FROM integrity_checks ic
ORDER BY ic.issues DESC;
```

### Effect performance analysis
```sql
-- Analyze effect table performance patterns
SELECT 
    'EFFECTS_PERFORMANCE_ANALYSIS' as analysis_type,
    CURRENT_TIMESTAMP as execution_time,
    COUNT(*) as total_effects,
    COUNT(DISTINCT ENTITY_ID) as affected_entities,
    COUNT(DISTINCT TYPE) as effect_types_used,
    COUNT(DISTINCT EFFECT_UID) as unique_effect_uids,
    COUNT(CASE WHEN EFFECT_UID IS NOT NULL THEN 1 END) as effects_with_uid,
    COUNT(CASE WHEN EFFECT_UID IS NULL THEN 1 END) as effects_without_uid
FROM EFFECTS;
```

### Effect index optimization analysis
```sql
-- Analyze query patterns for index recommendations
WITH entity_effect_stats AS (
    SELECT 
        eff.ENTITY_ID,
        COUNT(*) as effect_count,
        MIN(eff.ID) as first_effect_id,
        MAX(eff.ID) as last_effect_id
    FROM EFFECTS eff
    GROUP BY eff.ENTITY_ID
)
SELECT 
    'INDEX_RECOMMENDATION' as metric_type,
    COUNT(CASE WHEN ees.effect_count = 1 THEN 1 END) as single_effect_entities,
    COUNT(CASE WHEN ees.effect_count BETWEEN 2 AND 5 THEN 1 END) as moderate_effect_entities,
    COUNT(CASE WHEN ees.effect_count > 5 THEN 1 END) as heavy_effect_entities,
    AVG(ees.effect_count) as avg_effects_per_entity,
    MAX(ees.effect_count) as max_effects_per_entity
FROM entity_effect_stats ees;
```

---

## Advanced Effect Queries

### Effect stacking analysis
```sql
-- Identify entities with stacked effects of the same type
WITH stacked_effects AS (
    SELECT 
        eff.ENTITY_ID,
        eff.EFFECT_UID,
        eff.TYPE,
        COUNT(*) as stack_count
    FROM EFFECTS eff
    WHERE eff.EFFECT_UID IS NOT NULL
    GROUP BY eff.ENTITY_ID, eff.EFFECT_UID, eff.TYPE
    HAVING COUNT(*) > 1
)
SELECT 
    se.EFFECT_UID,
    se.TYPE,
    CASE se.TYPE
        WHEN 0 THEN 'STRUCTURE'
        WHEN 1 THEN 'ENTITY_WIDE'
        WHEN 2 THEN 'SECTOR'
        WHEN 3 THEN 'SYSTEM'
    END as scope_name,
    COUNT(DISTINCT se.ENTITY_ID) as entities_with_stacks,
    AVG(se.stack_count) as avg_stack_size,
    MAX(se.stack_count) as max_stack_size
FROM stacked_effects se
GROUP BY se.EFFECT_UID, se.TYPE
ORDER BY entities_with_stacks DESC, se.EFFECT_UID;
```

### Cross-scope effect analysis
```sql
-- Analyze entities benefiting from multiple scope levels
WITH entity_scope_coverage AS (
    SELECT 
        eff.ENTITY_ID,
        COUNT(DISTINCT eff.TYPE) as scope_variety,
        COUNT(CASE WHEN eff.TYPE = 0 THEN 1 END) as structure_effects,
        COUNT(CASE WHEN eff.TYPE = 1 THEN 1 END) as entity_effects,
        COUNT(CASE WHEN eff.TYPE = 2 THEN 1 END) as sector_effects,
        COUNT(CASE WHEN eff.TYPE = 3 THEN 1 END) as system_effects,
        COUNT(*) as total_effects
    FROM EFFECTS eff
    GROUP BY eff.ENTITY_ID
)
SELECT 
    esc.scope_variety,
    COUNT(*) as entity_count,
    AVG(esc.total_effects) as avg_total_effects,
    CASE 
        WHEN esc.scope_variety = 4 THEN 'FULL_SCOPE_COVERAGE'
        WHEN esc.scope_variety = 3 THEN 'MULTI_SCOPE_COVERAGE'
        WHEN esc.scope_variety = 2 THEN 'DUAL_SCOPE_COVERAGE'
        WHEN esc.scope_variety = 1 THEN 'SINGLE_SCOPE_COVERAGE'
        ELSE 'NO_EFFECTS'
    END as coverage_type
FROM entity_scope_coverage esc
GROUP BY esc.scope_variety
ORDER BY esc.scope_variety DESC;
```

### Effect efficiency analysis
```sql
-- Analyze most efficient effect combinations
WITH effect_combinations AS (
    SELECT 
        eff.ENTITY_ID,
        COUNT(*) as effect_count,
        COUNT(DISTINCT eff.EFFECT_UID) as unique_effects,
        GROUP_CONCAT(DISTINCT eff.EFFECT_UID ORDER BY eff.EFFECT_UID SEPARATOR '+') as effect_combo
    FROM EFFECTS eff
    WHERE eff.EFFECT_UID IS NOT NULL
    GROUP BY eff.ENTITY_ID
    HAVING COUNT(DISTINCT eff.EFFECT_UID) >= 2
),
combo_stats AS (
    SELECT 
        ec.effect_combo,
        COUNT(*) as usage_count,
        AVG(ec.effect_count) as avg_effect_count,
        AVG(ec.unique_effects) as avg_unique_effects
    FROM effect_combinations ec
    GROUP BY ec.effect_combo
)
SELECT 
    cs.effect_combo,
    cs.usage_count,
    ROUND(cs.avg_effect_count, 2) as avg_effect_count,
    ROUND(cs.avg_unique_effects, 2) as avg_unique_effects,
    CASE 
        WHEN cs.usage_count >= 10 THEN 'POPULAR_COMBO'
        WHEN cs.usage_count >= 5 THEN 'COMMON_COMBO'
        WHEN cs.usage_count >= 2 THEN 'UNCOMMON_COMBO'
        ELSE 'RARE_COMBO'
    END as combo_popularity
FROM combo_stats cs
ORDER BY cs.usage_count DESC
LIMIT 30;
```

---

## Reporting and Statistics

### Comprehensive effect system report
```sql
-- Complete effect system analysis report
WITH effect_summary AS (
    SELECT 
        COUNT(*) as total_effects,
        COUNT(DISTINCT ENTITY_ID) as unique_entities,
        COUNT(DISTINCT EFFECT_UID) as unique_effect_types,
        COUNT(DISTINCT TYPE) as scope_types_used
    FROM EFFECTS
),
effect_distribution AS (
    SELECT 
        COUNT(CASE WHEN TYPE = 0 THEN 1 END) as structure_effects,
        COUNT(CASE WHEN TYPE = 1 THEN 1 END) as entity_effects,
        COUNT(CASE WHEN TYPE = 2 THEN 1 END) as sector_effects,
        COUNT(CASE WHEN TYPE = 3 THEN 1 END) as system_effects
    FROM EFFECTS
),
effect_categories AS (
    SELECT 
        COUNT(CASE WHEN EFFECT_UID IN ('SPEED_BOOST', 'THRUST_EFFECTIVENESS', 'JUMP_DRIVE_CHARGE') THEN 1 END) as mobility_effects,
        COUNT(CASE WHEN EFFECT_UID IN ('SHIELD_RECHARGE', 'SHIELD_CAPACITY', 'ARMOR_EFFECTIVENESS', 'ION_RESISTANCE') THEN 1 END) as defense_effects,
        COUNT(CASE WHEN EFFECT_UID IN ('DAMAGE_MULTIPLIER', 'POWER_GENERATION', 'POWER_CAPACITY') THEN 1 END) as offense_effects,
        COUNT(CASE WHEN EFFECT_UID IN ('MINING_EFFECTIVENESS', 'SCANNER_RANGE') THEN 1 END) as utility_effects,
        COUNT(CASE WHEN EFFECT_UID IN ('STEALTH', 'CLOAKING', 'JAMMING') THEN 1 END) as stealth_effects
    FROM EFFECTS
    WHERE EFFECT_UID IS NOT NULL
)
SELECT 
    'EFFECT_SYSTEM_REPORT' as report_type,
    CURRENT_TIMESTAMP as generated_at,
    es.total_effects,
    es.unique_entities,
    es.unique_effect_types,
    es.scope_types_used,
    ed.structure_effects,
    ed.entity_effects,
    ed.sector_effects,
    ed.system_effects,
    ec.mobility_effects,
    ec.defense_effects,
    ec.offense_effects,
    ec.utility_effects,
    ec.stealth_effects,
    ROUND(es.total_effects * 1.0 / NULLIF(es.unique_entities, 0), 2) as avg_effects_per_entity
FROM effect_summary es, effect_distribution ed, effect_categories ec;
```

### Top effect users report
```sql
-- Identify entities with the most diverse effect portfolios
WITH entity_effect_diversity AS (
    SELECT 
        eff.ENTITY_ID,
        COUNT(*) as total_effects,
        COUNT(DISTINCT eff.EFFECT_UID) as unique_effect_types,
        COUNT(DISTINCT eff.TYPE) as scope_types,
        GROUP_CONCAT(DISTINCT eff.EFFECT_UID ORDER BY eff.EFFECT_UID SEPARATOR ', ') as effect_list
    FROM EFFECTS eff
    WHERE eff.EFFECT_UID IS NOT NULL
    GROUP BY eff.ENTITY_ID
)
SELECT 
    eed.ENTITY_ID,
    eed.total_effects,
    eed.unique_effect_types,
    eed.scope_types,
    ROUND(eed.unique_effect_types * 1.0 / NULLIF(eed.total_effects, 0) * 100, 2) as diversity_percentage,
    eed.effect_list,
    CASE 
        WHEN eed.unique_effect_types >= 8 THEN 'ULTRA_DIVERSE'
        WHEN eed.unique_effect_types >= 5 THEN 'HIGHLY_DIVERSE'
        WHEN eed.unique_effect_types >= 3 THEN 'MODERATELY_DIVERSE'
        WHEN eed.unique_effect_types >= 2 THEN 'SLIGHTLY_DIVERSE'
        ELSE 'SPECIALIZED'
    END as diversity_category
FROM entity_effect_diversity eed
ORDER BY eed.unique_effect_types DESC, eed.total_effects DESC
LIMIT 50;
```

---

## Changelog

| Version | Date       | Author       | Description                                      |
|---------|------------|--------------|--------------------------------------------------|
| `1.0`   | 2025-01-09 | InitSysRev   | Initial creation of EFFECTS example queries      |

[INDEX](./INDEX.md) | [EFFECTS](./TABLE_EFFECTS.md)