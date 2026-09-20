# Validation des corrections

Les corrections reprennent les huit constats de l'audit initial et les régressions
supplémentaires découvertes pendant l'extension des tests. Le schéma du jeu et les
sources Java consultées uniquement en local servent de références (elles ne sont pas redistribuées) : voir [SCHEMA_VALIDATION.md](SCHEMA_VALIDATION.md).

## Constats de l'audit initial

| Constat | Correction et preuve |
| --- | --- |
| Connexion attribuée simultanément à deux emprunteurs | Réservation avant toute attente, capacité incluant les créations en cours ; tests de concurrence et de cycle de vie du pool. |
| Pool global ignorant le monde demandé | Pools appartenant à chaque factory, séparés par URL/configuration ; tests JDBC sur bases distinctes et managers partageant une base. |
| Options de transaction conservées dans le pool | Restauration des options d'origine, rollback natif correct, invalidation des contextes et discard des sessions non restaurables. |
| Collision entre requêtes différentes dans le cache | Clés conservant exactement le SQL et les limites ; invalidation autour des mutations et rejet des résultats périmés en cours de calcul. |
| Délais d'exécution non appliqués | Transmission des délais à JDBC, annulation suivie de l'attente de fin de l'opération avant réutilisation de session. |
| Validation SQL désactivée avec les métriques | Validation indépendante et refus d'exécuter en cas d'échec du validateur. |
| `require` utilisé dans des modèles ESM | Imports ESM et résolution différée des relations ; tests de décodage et de modèles. |
| Export `starmade-db/interfaces` absent | Point d'entrée créé ; résolution des six exports du paquet et de leurs déclarations vérifiée. |

Les garanties supplémentaires des contrôleurs sont décrites dans
[Contrôleurs et garanties JDBC](#controleurs-et-garanties-jdbc). Les tests couvrent notamment les
alias HSQLDB, les identifiants BIGINT, les allocations concurrentes, les clés composites,
les erreurs JDBC, les annulations et les méthodes privées.

## Méthode

`npm run validate` vérifie le typage, les descriptions JSDoc et la couverture de tous les
fichiers TypeScript exécutables de `src`, avec des seuils bloquants de 100 % des lignes
et branches **par fichier**. Seuls les fichiers de déclarations `.d.ts` sont exclus.
Aucune annotation d'exclusion de couverture n'est utilisée pour atteindre les seuils.

La vérification JSDoc parcourt les déclarations de modules et les membres de classes,
interfaces et enums, y compris les membres protégés et privés. Elle vérifie la présence
d'une description ; les guides et commentaires ont également été revus pour leur exactitude.
Les références [publique](api/reference.md) et [interne](api/internal.md) sont générées
à partir des mêmes déclarations.

Chaque exécution utilise une copie temporaire de `tests/sandbox` et des bases HSQLDB en
mémoire. Le pilote est `/srv/StarMade/lib/hsqldb.jar`. Les tests de démarrage JVM isolés
s'exécutent avant le démarrage du pont natif dans le processus principal de tests.

## Résultat vérifié le 12 septembre 2026

`npm run validate` s'est terminé avec succès : **4 413 tests réussis**, aucun échec ni
test ignoré. Les mesures c8 atteignent 100 % dans chacun des 60 fichiers source :

| Mesure | Résultat |
| --- | --- |
| Lignes | 60 461 / 60 461 — 100 % |
| Branches | 9 835 / 9 835 — 100 % |
| Fonctions | 2 322 / 2 322 — 100 % |
| Déclarations JSDoc publiques, protégées et privées | 4 997 / 4 997 — 100 % |

La compilation de production (`npm run build:prod`) et le dernier contrôle JSDoc
réussissent. L'audit npm complet signale **0 vulnérabilité**. Les six exports du paquet et leurs
fichiers de déclarations se résolvent correctement. Le rapport HTML est généré dans
`coverage/index.html` et les compteurs détaillés dans `coverage/coverage-summary.json`.

## Limites documentées

La dépendance `starmade-decoder` reste liée au dépôt voisin ; une installation indépendante
nécessite sa fourniture. Le pilote HSQLDB doit correspondre à la base. Le streaming utilise
un résultat matérialisé. Les scores d'analyse sont des estimations, les recommandations
de cache sont consultatives et l'export HTTP de métriques n'est pas pris en charge.
Ces limites sont détaillées dans le [README](../README.md) et le [guide API](API.md).

## Nettoyage et compatibilité — résultat du 20 septembre 2026

La validation sur le dépôt nettoyé et le décodeur local 1.6.0 réussit : **4 427 tests**,
aucun échec ni test ignoré. Les 60 fichiers source atteignent chacun les seuils bloquants
inchangés de 100 % des lignes et branches.

| Mesure | Résultat |
| --- | --- |
| Lignes | 60 500 / 60 500 — 100 % |
| Branches | 9 849 / 9 849 — 100 % |
| Fonctions | 2 324 / 2 324 — 100 % |
| Déclarations JSDoc publiques, protégées et privées | 4 999 / 4 999 — 100 % |

Les guides de démarrage et d'API sont réunis dans [API.md](API.md), les garanties des
contrôleurs sont regroupées ci-dessous. Les anciens prototypes JDBC, configurations
Mocha/ts-node et le projet TypeScript vide sont retirés. Le lanceur de tests, les deux
configurations de compilation utiles, l'explorateur et les références générées restent
actifs. Les caches IDE, intermédiaires de compilation, rapports et données SQL
expérimentales quittent le suivi Git ; leurs copies locales sont conservées.

Les trois échecs binaires initiaux ont été reproduits avant nettoyage, puis corrigés
après extension explicite du périmètre. Les [preuves de formats](SCHEMA_VALIDATION.md#compatibilité-du-décodeur--20-septembre-2026)
justifient les nouvelles assertions : sérialisation Java des télécommandes, erreurs
strictes sur les données tronquées, lecture des ressources 16/19 octets et refus de
conversion avec perte. La fixture HSQLDB et les données SQL restent inchangées.

Les recettes exécutées sur une copie jetable comprennent les exemples de lecture et
transaction README/API, l'exploration de PLAYERS, et un aller-retour INSERT/SELECT JDBC
vérifiant exactement les cellules de ressources à 16 octets et les télécommandes Java.
Un ObjectInputStream du JDK a aussi relu la sortie du modèle. Les références publiques
et privées ont été régénérées et les liens Markdown locaux contrôlés. Aucun fichier
source du jeu n'est ajouté ni requis pour exécuter les tests.

<a id="controleurs-et-garanties-jdbc"></a>

## Contrôleurs et garanties JDBC

This supplement describes controller behavior verified against the documented
[StarMade schema](SCHEMA_VALIDATION.md), the game Java sources consulted privately (not redistributed),
and isolated copies of the HSQLDB fixture. Tests never require writing to a running
StarMade world.

### Reads, identifiers and statistics

`findById(id, {skipCache: true})` reads the current database state without reading or
populating the controller cache. Sequence allocation uses this mode before its
compare-and-swap update.

Controller sort columns must exist in the model schema. Sort direction is `ASC` or
`DESC`; limits and offsets must be nonnegative safe integers. A zero limit means
no controller limit. Invalid options fail before cache access or SQL execution.

Computed SQL aliases use quoted lowercase names so JDBC preserves the names consumed
by controller statistics. Counts, grouped distributions and maximum identifiers are
checked against real fixture queries; JDBC uppercase column labels must not silently
turn these results into zero.

### Mutations and generated identifiers

For an auto-increment primary key omitted from `create`, when a returned record is
requested, the INSERT and identity lookup execute on the same JDBC connection before
it is released. Explicit primary keys, including zero, are preserved. BIGINT identities
returned as strings retain their exact value beyond JavaScript's safe integer range.
An unsuccessful query or unusable generated identity rejects the operation.

Nullable composite foreign keys follow SQL `MATCH SIMPLE`: if any component is null
or undefined, no parent lookup is required. StarMade's `-1` sentinel also represents
an absent reference. Fully specified references are checked against their parent.

`EffectsController.removeEffectsFromEntity`,
`PlayerMessagesController.markAllAsRead` and `VisibilityController.clearObserver`
return the affected-row count reported by JDBC, including zero.

Where a bulk operation exposes `batchSize`, it must be a positive safe integer. When their stop-on-error
option is selected, the first failure stops all subsequent batches. A bulk operation
is not automatically transactional; already completed records remain completed.

### Fleet membership and docking

Fleet membership is stored with an `ID` primary key. Composite convenience methods
resolve `(FLEET_ID, ENTITY_ID)` before changing or deleting that membership. A failed
lookup is propagated; a missing membership produces the documented missing-record
result.

Docking filters use `DOCKED_TO`, fleet membership and entity type. Stations have
`ENTITIES.TYPE = 1`. Flagship filtering compares `FLEETS.FLAGSHIP_ID` with the member's
`ENTITY_ID`; there are no `DOCKING_STATUS` or `IS_FLAGSHIP` columns.

`EntitiesController.findEntities({dockedToId})` filters children by their actual
`DOCKED_TO` parent. Dependency checks and docking-chain traversal use this relationship,
including children beyond the first 100 rows. Root, untouched and spawned predicates
remain grouped when combined with other filters.

### Coordinates and sequences

Sector coordinates are global; `(X, Y, Z)` is unique independently of `STELLAR`.
Coordinate-conflict checks preserve a zero excluded identifier. Sector protection
filters accept only documented numeric protection flags.

On HSQLDB, sequence allocation falls back to an optimistic compare-and-swap update.
An ID or range is claimed only when that update affects exactly one row. Contention
retries re-read uncached state and stop after 100 attempts. Batch sizes must be positive
safe integers and may not exceed 10,000. Concurrent allocation tests assert unique
individual IDs and disjoint ranges.
