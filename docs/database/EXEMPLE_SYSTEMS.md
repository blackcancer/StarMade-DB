# SYSTEMS queries

These read-only examples use the Open `e5a3b49d8` schema and central-sector
ordinals. They replace the obsolete examples based on a separate 0–4 type enum.
Coordinates here identify systems; sector coordinates use a different grid.

## Look up a system

```sql
SELECT ID, X, Y, Z, TYPE, NAME, OWNER_FACTION
FROM SYSTEMS WHERE X = 0 AND Y = 0 AND Z = 0;
```

## Describe the stored types

```sql
SELECT ID, NAME, TYPE,
       CASE TYPE
           WHEN 4 THEN 'SUN'
           WHEN 8 THEN 'GIANT'
           WHEN 5 THEN 'BLACK_HOLE'
           WHEN 9 THEN 'DOUBLE_STAR'
           WHEN 6 THEN 'VOID'
           ELSE 'UNKNOWN'
       END AS TYPE_NAME
FROM SYSTEMS ORDER BY ID;
```

## Count each type

```sql
SELECT TYPE, COUNT(*) AS SYSTEM_COUNT
FROM SYSTEMS GROUP BY TYPE ORDER BY TYPE;
```

## Find ordinary stars and owned systems

```sql
SELECT ID, X, Y, Z, NAME FROM SYSTEMS WHERE TYPE = 4 ORDER BY ID;
```

```sql
SELECT ID, NAME, OWNER_UID, OWNER_FACTION
FROM SYSTEMS WHERE OWNER_UID IS NOT NULL AND OWNER_UID <> '' ORDER BY ID;
```

## Inspect binary column widths

```sql
SELECT ID, OCTET_LENGTH(INFOS) AS INFO_BYTES,
       OCTET_LENGTH(RESOURCES) AS RESOURCE_BYTES
FROM SYSTEMS ORDER BY ID;
```

Current game cells use 8192 info bytes and 16 resource bytes. Binary decoding
requires the selected game profile; see [the table contract](TABLE_SYSTEMS.md)
and [binary compatibility](../API.md#binary-database-compatibility).
