# Phase 3 — Agent Lab et Runs

Statut : implémenté et validé le 17 juillet 2026.

## 1. Objectif

Transformer les agents décoratifs du dashboard en définitions persistantes,
versionnées et exécutables. Une équipe devient un DAG immuable au moment du
lancement ; chaque run conserve sa définition, ses workers, ses événements, ses
budgets, ses erreurs et ses artifacts.

## 2. Tranche initiale — registre d’agents

La première tranche remplace `localStorage` et les fixtures de l’Agent Lab par :

- une identité stable par agent ;
- des versions immuables et ordonnées ;
- un modèle/provider, des instructions, tools et skills explicites ;
- des budgets tokens, coût, durée et retries ;
- des policies filesystem, réseau et trading ;
- une API Orbit validée et auditée ;
- une interface honnête pour créer et réviser un agent.

Modifier un agent ne réécrit jamais sa version précédente. Les futurs runs
référenceront l’identifiant exact de la version utilisée.

## 3. Équipes et DAG

Une équipe possède une identité stable et des versions immuables. Chaque version
contient des nœuds qui référencent une version d’agent et des arêtes de
dépendance. Le serveur refuse :

- les cycles ;
- les références inconnues ou archivées ;
- les nœuds sans identifiant unique ;
- les budgets supérieurs aux limites opérateur ;
- une concurrence incompatible avec la capacité configurée.

## 4. Runs

Un lancement matérialise un snapshot d’équipe et crée un run durable. Les états
canoniques sont `queued`, `running`, `degraded`, `completed`, `failed` et
`cancelled`. Chaque worker possède sa propre tentative et sa timeline.

Le control-plane doit supporter lancement, annulation, retry borné, reprise après
refresh navigateur et réconciliation après restart. Les tokens, coûts, erreurs et
artifacts sont des données mesurées ; une valeur indisponible reste `null`.

## 5. Temps réel et observabilité

- événements ordonnés et dédupliqués ;
- flux SSE reprenable avec le dernier identifiant connu ;
- timeline par worker et timeline globale ;
- progression calculée depuis les états persistés ;
- Observatory alimenté par les runs, sans fixture parallèle ;
- audit des créations, révisions, lancements, retries et annulations.

## 6. Sécurité

- aucune commande shell arbitraire depuis l’éditeur ;
- tools et skills stockés comme identifiants, jamais comme code exécutable ;
- trading désactivé dans les policies de cette phase ;
- budgets validés côté serveur ;
- secrets exclus des définitions et événements ;
- versions historiques non modifiables, même par une mise à jour SQL ordinaire.

## 7. Critères d’acceptation

1. créer un agent puis une nouvelle version sans altérer la première ;
2. retrouver le registre après restart ;
3. créer une équipe valide et refuser un DAG cyclique ;
4. lancer une équipe et suivre chaque worker en temps réel ;
5. annuler et retry sans perdre les événements antérieurs ;
6. rafraîchir le navigateur pendant un run et retrouver l’état exact ;
7. borner la concurrence pour le VPS 2 vCPU ;
8. présenter tokens, coût, artifacts et erreurs réels ;
9. alimenter Observatory depuis les mêmes données canoniques ;
10. maintenir build, migrations et tests au vert.

## 8. Hors périmètre

- génération et backtests quantitatifs complets (Phase 5) ;
- boucle évolutionnaire autonome (Phase 6) ;
- connexion broker paper ou live (Phases 7 et 8) ;
- édition de fichiers et mémoire unifiée (Phase 4).

## 9. Validation réalisée

- agents et équipes versionnés avec immutabilité SQLite ;
- DAG cycliques et références inconnues refusés ;
- concurrence réelle bornée à deux workers ;
- exécution Vibe privée avec tool policies, budgets et trading interdit ;
- cancel, retry et reprise après restart testés ;
- événements append-only et SSE reprenable sans duplication ;
- métriques inconnues conservées à `null` ;
- chemins privés Vibe retirés des artifacts exposés ;
- Agent Lab, Teams & Runs, Activity et Observatory connectés aux APIs réelles ;
- build TypeScript/Vite et 37 tests unitaires/intégration réussis.
