# Phase 3 — plan technique exécutable

Statut : tranches A à E terminées et validées le 17 juillet 2026.

## Tranche A — registre d’agents versionné

1. Migrer les identités et versions d’agents vers SQLite.
2. Rendre les versions immuables au niveau de la base.
3. Valider définitions, budgets et policies côté serveur.
4. Exposer liste, création, historique et nouvelle version via Orbit.
5. Remplacer l’Agent Lab `localStorage` par l’API réelle.
6. Tester rollback transactionnel, immutabilité, restart et contrats HTTP.

## Tranche B — équipes DAG versionnées

1. Ajouter identités, versions, nœuds et arêtes d’équipes.
2. Implémenter validation topologique et bornes de concurrence.
3. Construire l’éditeur à partir des agents et presets Vibe.
4. Prévisualiser ordre d’exécution, budgets agrégés et erreurs.
5. Tester cycles, références stale et versionnement immuable.

## Tranche C — orchestrateur de runs

1. Ajouter runs, workers, tentatives et événements dédiés.
2. Matérialiser un snapshot d’équipe au lancement.
3. Planifier les nœuds prêts avec concurrence bornée.
4. Brancher cancel, timeout, retry et réconciliation après restart.
5. Tester avec un runtime factice déterministe et sans coût.

## Tranche D — timeline temps réel

1. Exposer détail de run et événements SSE reprenables.
2. Dédupliquer les événements après reconnexion.
3. Afficher workers, tentatives, outils, erreurs et artifacts.
4. Distinguer explicitement les métriques inconnues des zéros.
5. Tester refresh, restart, flux interrompu et run stale.

## Tranche E — Observatory et production

1. Alimenter les cartes globales depuis les runs réels.
2. Mesurer tokens, coût, durée et taux d’échec.
3. Documenter sauvegarde, exploitation et rollback Phase 3.
4. Exécuter build, tests, migrations et scans de secrets.
5. Déployer, smoke tester, commit, push et ouvrir la PR.
