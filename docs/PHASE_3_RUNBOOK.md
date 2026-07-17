# Phase 3 — runbook Agent Lab et Runs

## 1. Périmètre

La Phase 3 ajoute au control-plane Orbit :

- agents et équipes versionnés de façon immuable ;
- DAG validés côté serveur, concurrence maximale de deux workers ;
- runs, workers, tentatives, événements et références d’artifacts persistants ;
- exécution privée par Vibe, annulation, retry et reprise après restart ;
- timeline SSE reprenable et Observatory alimenté par les données réelles.

Le trading reste interdit. Les chemins privés Vibe sont transformés en références
opaques avant exposition au navigateur.

## 2. Données canoniques

La migration `003_teams_and_runs.sql` crée :

- `teams` et `team_versions` ;
- `runs`, `run_workers` et `run_events` ;
- `run_artifacts`.

Les versions d’équipes sont immuables et les événements de run append-only via
triggers SQLite. Les snapshots contiennent la version exacte de chaque agent.

## 3. Déploiement

1. Vérifier que le worktree est propre et que la branche attendue est checkout.
2. Exécuter `npm test`.
3. Créer une sauvegarde cohérente dans le répertoire de données réellement
   déclaré par systemd. Sur le VPS actuel :
   `sudo env ORBIT_DATA_DIR=/var/lib/orbit-os npm run db:backup`.
4. Exécuter `npm run db:migrate` ou redémarrer Orbit, qui applique les migrations
   forward-only au démarrage.
5. Redémarrer `orbit-os.service`.
6. Vérifier `/healthz`, `/readyz`, `/api/system/overview`, `/api/agents`,
   `/api/teams`, `/api/runs` et `/api/observatory` via la frontière authentifiée.
7. Vérifier que Vibe reste loopback-only et prêt.

## 4. Smoke test déterministe

Le smoke test sans coût utilise un exécuteur factice et vérifie :

1. création d’un agent ;
2. création d’une équipe à deux nœuds ;
3. refus d’un cycle ;
4. lancement et terminaison du run ;
5. relay SSE sans doublon ;
6. tokens, coût et artifacts mesurés ;
7. retry depuis le snapshot initial ;
8. agrégats Observatory.

Le smoke test LLM réel doit rester minimal : une petite équipe, un objectif court,
aucun tool d’écriture et suppression explicite des sessions de test côté Vibe.

## 5. Reprise et incidents

- Au démarrage, tout worker `running` est marqué échoué avec une cause de restart.
- Une nouvelle tentative est mise en file si le budget de retries le permet.
- Le run passe `degraded`, puis l’orchestrateur reprend les branches disponibles.
- Si le budget est épuisé, le run devient `failed` sans effacer les événements.
- Une absence de métrique provider reste `null` et s’affiche « — ».
- Une déconnexion SSE reprend depuis `Last-Event-ID`.

## 6. Rollback

1. Arrêter `orbit-os.service`.
2. Restaurer le commit applicatif précédent.
3. Conserver le schéma v3 : les anciennes versions d’Orbit ignorent les nouvelles
   tables et aucune migration destructive n’est nécessaire.
4. Si les données Phase 3 doivent également revenir à l’état antérieur, restaurer
   la sauvegarde SQLite réalisée avant déploiement.
5. Redémarrer Orbit et vérifier health/readiness.

Ne jamais supprimer manuellement `run_events`, `agent_versions` ou
`team_versions`. Toute purge future devra être explicite, prévisualisée et auditée.
