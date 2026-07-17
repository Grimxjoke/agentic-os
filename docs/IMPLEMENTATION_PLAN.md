# Plan d’implémentation — Orbit Trading Agent OS

Le développement suit des tranches verticales démontrables. Une phase n’est terminée que si ses tests, migrations, observabilité et rollback sont en place.

## 0. Règles de travail

- Établir un baseline Git avant tout refactor.
- Une fonctionnalité réelle remplace complètement sa simulation ; ne pas maintenir deux vérités.
- Commits petits, intentionnels et réversibles.
- Aucun nettoyage Hermes avant que le nouveau chemin public soit testé.
- Aucun secret dans Git, les logs ou le navigateur.
- Aucun live trading pendant P0/P1.
- Tests continus à chaque tranche, pas en fin de projet.

## 1. Architecture technique cible

### Orbit BFF

Le serveur Node reste la frontière publique :

- session mono-utilisateur ;
- API Orbit ;
- proxy Vibe authentifié, y compris SSE ;
- stockage SQLite du control-plane ;
- accès filesystem borné ;
- jobs, policies, Inbox, audit et usage ;
- aucune commande shell arbitraire depuis l’UI.

### Vibe Engine

- checkout propre sous un chemin accessible à un utilisateur de service dédié ;
- version upstream épinglée par SHA dans la configuration de déploiement ;
- environnement Python isolé ;
- `HOME`/runtime explicite dans `/var/lib/vibe-trading` ;
- API sur `127.0.0.1:8899` avec clé interne ;
- shell tools désactivés au démarrage ;
- service systemd durci et volume sauvegardé.

### Stockage

- SQLite WAL pour agents, workflows, jobs, policies, Inbox, liens et métadonnées.
- Runtime natif Vibe pour sessions, mémoire, hypothèses et live.
- Artifacts sur disque, avec checksum et index en base.
- Ledger append-only pour événements sensibles.
- Sauvegarde cohérente base + fichiers.

## 2. Phases

### Phase 0 — baseline et sécurité réseau

État au 16 juillet 2026 : socle déployé et tests de restart réussis. La seule action externe restante est la confirmation de révocation des anciens tokens de tunnels dans les consoles fournisseurs.

Livrables :

- premier commit de l’état actuel ;
- inventaire des secrets sans les afficher ;
- rotation des jetons de tunnels exposés dans les unités ;
- Orbit lié à `127.0.0.1` ;
- fermeture du port Hermes Control public ;
- tunnel permanent géré par une seule unité systemd ;
- healthcheck interne et externe ;
- procédure de rollback.

Tests :

- build TypeScript/Vite ;
- test HTTP auth/cookie/origin ;
- scan des ports attendus ;
- redémarrage du VPS simulé par restart des unités ;
- vérification du lien public et des deep links.

Validation réalisée :

- build TypeScript/Vite et six tests d’intégration verts ;
- Orbit et Caddy limités à loopback ; port Hermes Control fermé ;
- unique tunnel applicatif ngrok géré par systemd ;
- domaine permanent, auth, deep links, PI et Codex retestés après restart simultané ;
- anciennes unités/tunnels Hermes arrêtés, désactivés et retirés ;
- conteneurs, images, réseaux, superviseurs et arbres Hermes/Grafana supprimés après validation ;
- historique, arbre et diff Git scannés sans secret détecté.

### Phase 1 — fondation testable et persistante

État au 16 juillet 2026 : implémentation, suite locale et validation production terminées sur la branche Phase 1.

Livrables :

- découpage de `server.mjs` en modules testables ;
- validation de schéma des entrées API ;
- SQLite, migrations et repositories ;
- sessions serveur révocables ;
- modèle Job/Event/Decision/Audit ;
- runner de migrations et sauvegarde locale ;
- suppression du toast global « simulé ».

Tests :

- unitaires repositories et policies ;
- intégration API sur base temporaire ;
- migrations forward sur base vide et snapshot ;
- crash pendant écriture ;
- redaction et absence de secrets dans les réponses.

Validation réalisée :

- build TypeScript/Vite et dix-huit tests unitaires/intégration verts ;
- migration et sauvegarde SQLite réelles sous `/var/lib/orbit-os` ;
- session publique initialisée puis révoquée sans exposer le jeton permanent ;
- page System validée sur l’API publique protégée ;
- appel Codex Plan réel, job et messages relus depuis SQLite ;
- service épinglé sur Node 22 et probes internes/publiques vertes.

### Phase 2 — Vibe réel

État au 17 juillet 2026 : moteur, BFF, interface, OAuth ChatGPT/Codex, tests,
smoke test LLM et déploiement production terminés.

Livrables :

- déploiement systemd Vibe ;
- proxy `/api/vibe/*` et streaming SSE ;
- page santé/configuration provider sans révéler les clés ;
- sessions et chat Vibe réels ;
- liste réelle des 87 skills et 30 presets observés sur la révision épinglée ;
- upload et artifacts ;
- instrumentation des erreurs et timeouts.

Tests :

- suite backend Vibe ciblée auth/session/SSE/security ;
- contrats proxy Orbit↔Vibe ;
- reconnexion/déduplication SSE ;
- restart Vibe pendant une session ;
- provider mock pour tests sans coût.

Validation réalisée :

- 26 tests Orbit et 92 tests Vibe ciblés verts ;
- provider `openai-codex/gpt-5.4` prêt sans `OPENAI_API_KEY` ;
- persistance confirmée après restart Vibe ;
- réponse réelle et flux SSE complet relayés via Orbit ;
- trois services actifs et probes internes/publiques vertes.

### Phase 3 — Agent Lab et Runs

État au 17 juillet 2026 : démarrée. La première tranche verticale (registre
d’agents SQLite, versions immuables, budgets/policies, API et Agent Lab réel) est
implémentée et validée localement. Les équipes DAG et l’orchestrateur de runs
restent à construire.

Livrables :

- registre d’agents versionné ;
- éditeur d’équipes/DAG à partir des presets ;
- budgets et policies ;
- lancement, cancel, retry et détail swarm ;
- timeline temps réel par worker ;
- tokens, coût, artifacts et erreurs réels ;
- observatoire alimenté par les jobs réels.

Tests :

- versionnement immuable ;
- DAG invalide/cyclique ;
- concurrence bornée sur 2 vCPU ;
- timeout, retry, cancel et run stale ;
- refresh navigateur pendant run ;
- snapshots UI des états pending/running/degraded/failed/completed.

### Phase 4 — Files, Artifacts, Memory, Knowledge

Livrables :

- navigateur filesystem allowlisté ;
- édition avec diff et backup ;
- index unifié des artifacts Vibe ;
- mémoire réelle avec provenance ;
- registre d’hypothèses ;
- graphe de connaissance dérivé, pas édité comme une fausse topologie.

Tests :

- traversée `..`, symlinks, extensions et tailles ;
- écriture atomique et restauration backup ;
- index après ajout/suppression ;
- fichiers binaires ;
- recherche et liens cassés.

### Phase 5 — Backtests et Strategy Factory

Livrables :

- création de stratégie depuis un objectif ;
- run reproductible avec snapshot/config/code ;
- pages RunDetail/Compare/Correlation/Alpha Zoo intégrées au design Orbit ;
- validations Monte Carlo/bootstrap/walk-forward ;
- hypothèses liées aux runs ;
- journal des avertissements de données et d’overfit.

Tests :

- dataset et code synthétiques déterministes ;
- fuite future et lookahead ;
- métriques connues ;
- artifact manquant/corrompu ;
- comparaison incompatible ;
- absence de réseau via fixtures pour la CI.

### Phase 6 — Experiment Studio

Livrables :

- modèles Experiment/Generation/Candidate/Evaluation ;
- orchestrateur durable au-dessus de Vibe ;
- file de backtests avec concurrence CPU distincte de la concurrence LLM ;
- budgets globaux et par génération ;
- score configurable et contraintes éliminatoires ;
- champion/challenger ;
- patience, arrêt et pause Inbox ;
- reprise après crash ;
- mémoire des enseignements injectée dans la génération suivante.

Tests :

- boucle déterministe avec provider et backtester factices ;
- trois variantes, deux générations ;
- budget tokens/coût/temps ;
- candidats incomplets ;
- égalités et score NaN ;
- crash/restart entre chaque transition ;
- idempotence des reprises ;
- aucune promotion paper/live implicite.

### Phase 7 — Automations et Human Inbox

Livrables :

- workflow builder mappé sur un schéma exécutable ;
- scheduler durable ;
- branches indépendantes non bloquées par une décision ;
- notifications et expirations ;
- Kanban dérivé des objectifs/jobs/décisions.

Tests :

- heure UTC/fuseau et changement d’heure ;
- exécution manquée pendant downtime ;
- déduplication ;
- approbation/rejet/expiration ;
- retry sans double effet.

### Phase 8 — Paper Trading

Livrables :

- premier connecteur paper choisi ;
- compte, positions, ordres, quotes et historique ;
- ordre paper depuis une stratégie promue manuellement ;
- journal, réconciliation et PnL ;
- attribution agent/stratégie/run.

Tests :

- sandbox uniquement ;
- host/key mismatch fail-closed ;
- ordre, annulation, rejet et timeout ;
- restart avant accusé broker ;
- aucune route vers un host live dans les tests paper.

### Phase 9 — Live borné, uniquement après validation séparée

Livrables :

- UI consentement/mandat ;
- policies confirmation par ordre ou autonomie dans mandat ;
- HALT global toujours accessible ;
- audit et réconciliation ;
- runner seulement pour connecteur validé.

Tests obligatoires :

- absence/expiration/corruption du mandat ;
- dépassement de chaque plafond ;
- symbole/instrument/univers interdit ;
- kill switch avant et pendant une activité ;
- quote indisponible ;
- double soumission ;
- redaction de tous les secrets ;
- simulation chaos avec broker factice avant toute clé réelle.

### Phase 10 — design propre et consolidation

Le design est amélioré au fil des phases, puis consolidé :

- widgets serveur et disposition persistante ;
- animations pilotées par événements réels ;
- constellation d’agents ;
- responsive et réduction de mouvement ;
- états vides/erreur/offline/reconnexion ;
- audit final de cohérence visuelle et accessibilité.

## 3. Nettoyage Hermes

Ordre imposé :

1. créer le nouveau Caddyfile où Orbit devient la racine ;
2. valider la configuration ;
3. basculer le tunnel permanent ;
4. vérifier Orbit, auth, API, SSE et deep links ;
5. arrêter/désactiver services et conteneurs Hermes ;
6. observer une fenêtre de stabilité ;
7. supprimer les unités, conteneurs, images et répertoires explicitement listés ;
8. retirer routes Grafana/chat ;
9. rescanner ports, processus, secrets et espace disque ;
10. documenter le rollback devenu inutile et révoquer les anciens jetons.

## 4. Pyramide de tests

- Unitaires : règles métier, policies, score, paths, redaction.
- Intégration : API + SQLite + filesystem temporaire + Vibe mock/réel ciblé.
- Contrats : payloads Orbit/Vibe et événements SSE.
- End-to-end : navigateur sur build production, refresh/restart/offline.
- Sécurité : auth, CSRF/origin, traversal, secret scan, ports et live gates.
- Résilience : crash, stale job, retry, idempotence et backup/restore.
- Visuel : screenshots des pages et états critiques.

Commandes qualité cibles :

```text
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
pytest -q <suites Vibe ciblées>
```

## 5. Definition of Done d’une tranche

- comportement réel connecté ;
- aucune donnée de démonstration présentée comme réelle ;
- schéma et migration inclus ;
- erreurs et chargement conçus ;
- audit et usage émis ;
- tests unitaires et intégration verts ;
- test manuel production effectué ;
- sécurité et permissions revues ;
- documentation et rollback à jour.

## 6. Première tranche recommandée

Commencer par Phase 0 puis Phase 1, sans intégrer tout Vibe en une fois. Le premier résultat visible doit être :

1. un lien public unique et durable ;
2. une page System qui affiche la vraie santé ;
3. une base persistante et testée ;
4. plus aucun faux toast global ;
5. un socle sur lequel le chat Vibe et les swarms pourront être branchés sans refaire l’architecture.
