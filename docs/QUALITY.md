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
[CONTROLLER_VALIDATION.md](CONTROLLER_VALIDATION.md). Les tests couvrent notamment les
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
