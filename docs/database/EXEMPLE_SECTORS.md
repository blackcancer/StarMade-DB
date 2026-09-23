# SECTORS queries

These read-only examples target Open `e5a3b49d8`. Sector coordinates are global.
`WORMHOLE` and `NEBULA` are not valid type names for this revision.

## Look up global coordinates

```sql
SELECT ID, X, Y, Z, TYPE, NAME, PROTECTION
FROM SECTORS WHERE X = 0 AND Y = 0 AND Z = 0;
```

## Describe the stored types

```sql
SELECT ID, NAME, TYPE,
       CASE TYPE
           WHEN 0 THEN 'SPACE_STATION'
           WHEN 1 THEN 'ASTEROID'
           WHEN 2 THEN 'PLANET'
           WHEN 3 THEN 'MAIN'
           WHEN 4 THEN 'SUN'
           WHEN 5 THEN 'BLACK_HOLE'
           WHEN 6 THEN 'VOID'
           WHEN 7 THEN 'LOW_ASTEROID'
           WHEN 8 THEN 'GIANT'
           WHEN 9 THEN 'DOUBLE_STAR'
           ELSE 'UNKNOWN'
       END AS TYPE_NAME
FROM SECTORS ORDER BY ID;
```

## Count each type

```sql
SELECT TYPE, COUNT(*) AS SECTOR_COUNT
FROM SECTORS GROUP BY TYPE ORDER BY TYPE;
```

## Find planets, stations and asteroid sectors

```sql
SELECT ID, X, Y, Z, NAME FROM SECTORS WHERE TYPE IN (0, 2) ORDER BY ID;
```

```sql
SELECT ID, X, Y, Z, TYPE, NAME
FROM SECTORS WHERE TYPE IN (1, 7) ORDER BY ID;
```

## Find a region and exact safe-zone flags

```sql
SELECT ID, X, Y, Z, TYPE FROM SECTORS
WHERE X BETWEEN -16 AND -1 AND Y BETWEEN 0 AND 15 AND Z BETWEEN 0 AND 15
ORDER BY X, Y, Z;
```

```sql
SELECT ID, X, Y, Z, NAME, PROTECTION
FROM SECTORS WHERE PROTECTION = 3 ORDER BY ID;
```

The last query selects exactly flag value 3; sectors with additional flags require
a bitwise filter. See [the table contract](TABLE_SECTORS.md).
