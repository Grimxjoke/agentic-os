# Orbit OS — cartographie de l’existant

État observé le 16 juillet 2026. Cette carte décrit ce qui existe réellement, ce qui est simulé et ce qui peut être réutilisé. Elle ne constitue pas une promesse fonctionnelle.

## 1. Résumé exécutif

Orbit est aujourd’hui un prototype React/Vite visuellement riche, mais presque entièrement alimenté par des constantes et `localStorage`. La seule intégration serveur effective est la passerelle de chat vers PI et Codex dans `server.mjs`.

Vibe-Trading est à l’inverse un moteur de recherche quantitative complet : sessions persistantes, outils de marché, backtests, validation, hypothèses, swarms multi-agents, connecteurs brokers et garde-fous live. Son dépôt est présent sur le VPS mais il n’est ni installé, ni configuré, ni démarré. Il ne contient encore aucune donnée utilisateur.

Hermes occupe plusieurs services, conteneurs, tunnels et routes réseau. Il est déclaré obsolète et supprimable par le propriétaire. Sa suppression devra cependant être transactionnelle, car le tunnel public permanent traverse aujourd’hui le Caddy qui route aussi Orbit.

## 2. Dépôts et responsabilités

| Emplacement | État | Rôle futur |
|---|---|---|
| `/home/codex/agentic-os` | dépôt Git sans commit, application entière non suivie | source de vérité Orbit |
| `/root/Vibe-Trading` | dépôt upstream propre, commit `66ceb74` | dépendance moteur, version à épingler et déployer sous un utilisateur non-root |
| `/home/codex/Agentic OS` | dépôt presque vide | doublon à retirer après vérification |
| `/opt/agentic-os` | ancienne pile Docker/Caddy/Hermes | conserver seulement l’infrastructure encore utile |
| `/opt/hermes-*`, `/root/.hermes` | ancien produit | supprimable après bascule réseau et sauvegarde de configuration minimale |

## 3. Orbit actuel

### 3.1 Stack

- React 19, TypeScript 5.8, Vite 6, React Router 7.
- Serveur Node natif dans `server.mjs`, sans framework ni base de données.
- Authentification par jeton permanent transformé en cookie HTTP-only de 30 jours.
- Build statique servi sous `/orbit/`.
- Service systemd `orbit-os.service`, actuellement exposé sur `0.0.0.0:4173`.
- Aucun test frontend, backend ou end-to-end.

### 3.2 Matrice réel / local / simulé

| Surface | État réel | Destination produit |
|---|---|---|
| PI Chat | appel réel au CLI PI, outils en lecture seule | remplacer par un runtime d’orchestration persistant et observable |
| Codex Chat | appel réel au CLI Codex dans une unité systemd isolée | conserver uniquement comme atelier de modification du dashboard |
| Agents | CRUD `localStorage`, modèles et outils codés en dur | registre réel des agents Vibe, profils, budgets et politiques |
| Skills | CRUD et test simulé en `localStorage` | catalogue réel des 77 skills Vibe et skills Orbit |
| Cron | éditeur visuel local, proposition PI déterministe par mots-clés | workflows persistants réellement exécutés et repris après redémarrage |
| Kanban | cartes locales déplaçables | vue dérivée des objectifs, expériences, décisions et incidents |
| Files | quatre faux fichiers édités dans le navigateur | explorateur borné du VPS, versions, uploads et artifacts réels |
| Knowledge | graphe statique | index des stratégies, runs, hypothèses, agents, fichiers et mémoires |
| Memory | quatre entrées locales | mémoire Vibe durable avec provenance, correction et recherche |
| Artifacts | liste statique | rapports, code, métriques, journaux et exports réels |
| Vibe | guide documentaire simulé et données obsolètes | cockpit natif du moteur Vibe via API/SSE |
| Trading | données codées en dur, TradingView externe uniquement | paper trading, comptes, positions, ordres, risques et live borné |
| Switchboard | topologie locale modifiable | état réel des services et connexions, sans faux interrupteurs |
| Control Center | services/logs/déploiements simulés | diagnostic réel et actions strictement allowlistées |
| Activity | cinq événements statiques | ledger append-only de toutes les actions importantes |
| Usage | coûts et tokens statiques | métriques réelles par agent, modèle, run et expérience |
| Settings | apparence locale ; connexions/permissions simulées | réglages persistants, secrets côté serveur, politiques et budgets |
| Human Inbox | trois demandes en mémoire React | file persistante de décisions et confirmations exceptionnelles |
| Observatory | agrégation de toutes les données fictives | cockpit temps réel issu des sources canoniques |

### 3.3 Passerelle serveur existante

`server.mjs` fournit actuellement :

- `GET /api/health` ;
- `POST /api/chat` pour PI ou Codex ;
- limitation à une requête simultanée par agent ;
- contrôle d’origine ;
- taille de requête et de sortie bornée ;
- timeout des processus ;
- sandbox systemd différente pour les modes Plan et Build de Codex.

Limites :

- aucun stockage serveur des conversations ;
- aucune diffusion progressive, file durable ou reprise de job ;
- aucun modèle d’autorisation par action ;
- aucune API Files, Agents, Workflow, Usage ou Audit ;
- jeton global plutôt que session révocable ;
- le service écoute directement sur toutes les interfaces réseau ;
- les erreurs Codex ne sont pas encore suffisamment instrumentées pour le diagnostic depuis l’UI.

## 4. Vibe-Trading actuel

### 4.1 État de déploiement

- Dépôt upstream propre et non modifié.
- Aucun `.env`, aucune clé provider, aucune clé marché, aucun jeton Tushare.
- Aucun répertoire runtime `~/.vibe-trading`.
- Aucune session, aucun run, aucun swarm, aucune hypothèse et aucun mandat existant.
- Aucun service sur `127.0.0.1:8899`.
- Le dépôt se trouve sous `/root`, donc il est inaccessible au service Orbit exécuté par `codex`.

### 4.2 Capacités réutilisables

- API FastAPI avec authentification distante et SSE.
- Sessions et messages durables, écritures `flush + fsync`.
- 77 skills finance répartis entre données, recherche, quant, risque, reporting et exécution.
- 29 presets de swarms multi-agents.
- DAG : tâches parallèles par couche, dépendances entre couches, retries, timeout, annulation, reprise et réconciliation des runs abandonnés.
- Comptage des tokens par worker et au niveau du swarm.
- Artifacts isolés par run et par agent.
- 452 facteurs Alpha Zoo et bancs de validation.
- Backtests multi-marchés, Monte Carlo, bootstrap et walk-forward.
- Registre durable d’hypothèses lié aux runs.
- Shadow Account et analyse de journaux de trading.
- 10 familles de connecteurs : Alpaca, Binance, Dhan, Futu, IBKR, Longbridge, OKX, Robinhood, Shoonya et Tiger.
- Profils read-only, paper et live selon les garanties disponibles chez chaque broker.

### 4.3 Persistance Vibe

Le runtime par défaut est `~/.vibe-trading` :

- `sessions/<id>/session.json`, `messages.jsonl`, `attempts/` ;
- `memory/MEMORY.md` et entrées Markdown ;
- `hypotheses.json` ;
- runs de backtest et rapports ;
- `live/<broker>/mandate.json`, consentements, compteur journalier et HALT ;
- `live/audit.jsonl`, journal append-only des actions live.

Les swarms utilisent actuellement un autre root relatif, `agent/.swarm/runs`. Ce chemin devra être rendu explicite et déplacé dans le volume runtime canonique avant la production.

### 4.4 Sécurité live déjà disponible

Le canal live est structurellement séparé des outils ordinaires :

- une proposition agent ne donne aucune autorité ;
- seul un endpoint de surface privilégié peut écrire un mandat ;
- mandat immuable, expirant et associé au consentement utilisateur ;
- plafonds : financement, taille d’ordre, exposition, levier, instruments et trades/jour ;
- univers autorisé, seuils de liquidité/capitalisation et symboles exclus ;
- kill switch global ou par broker, indépendant du LLM ;
- contrôles fail-closed avant tout ordre ;
- audit redacted append-only ;
- annulation autorisée comme action de réduction de risque ;
- flatten optionnel lors d’un halt.

Le runner live persistant n’est exposé actuellement que par le profil Robinhood MCP. Plusieurs autres brokers acceptent des ordres live bornés, mais n’ont pas encore le même runner managé.

### 4.5 Écart avec la boucle d’apprentissage voulue

Vibe sait déjà : générer une stratégie, lancer un backtest, valider hors échantillon, comparer des résultats, mémoriser une hypothèse et exécuter plusieurs analystes en parallèle.

Il ne sait pas encore piloter un programme expérimental durable de bout en bout : générations successives, variantes concurrentes, dataset figé, budget global, fonction de score, élimination, champion/challenger, arrêt automatique, reprise après crash et promotion contrôlée. Cette couche appartient au futur orchestrateur Orbit, au-dessus des primitives Vibe.

## 5. Infrastructure VPS

### 5.1 Ressources

- 2 vCPU, 7,8 Gio RAM, aucun swap.
- Environ 50 Gio de disque libres.
- Node 22, Python 3.12, Docker actif.

La concurrence doit donc être bornée. Quatre workers LLM ne signifient pas quatre backtests CPU lourds simultanés.

### 5.2 Chemin public actuel

```text
Internet
  → domaine ngrok réservé
  → Caddy :18080
      ├─ /orbit/* → Orbit :4173
      ├─ /grafana/* → :3001 (route morte)
      ├─ /chat/* → ancien service
      └─ /* → Hermes WebUI :8788
```

Un second tunnel Cloudflare éphémère pointe aussi directement vers Orbit. Deux autres tunnels Cloudflare Hermes et un tunnel ngrok Hermes sont actifs.

### 5.3 Services obsolètes identifiés

- `hermes-gateway.service` ;
- `hermes-operator-ui.service` ;
- `hermes-operator-v4-preview.service` ;
- `ngrok-hermes-operator-dev.service` ;
- `cloudflared-hermes-webui.service` et un doublon `cloudflared.service` ;
- trois conteneurs Hermes ;
- route Grafana sans backend actif ;
- anciens arbres `/opt/hermes-*` et `/root/.hermes`.

### 5.4 Risques P0

- Pare-feu hôte inactif et politique INPUT permissive.
- Orbit écoute sur `0.0.0.0:4173` au lieu de loopback.
- Hermes Control Interface publie `0.0.0.0:10275`.
- Plusieurs tunnels concurrents rendent le chemin public difficile à auditer.
- Des secrets de tunnel sont intégrés en clair dans des unités systemd ; ils devront être révoqués, recréés et déplacés dans des fichiers `EnvironmentFile` en mode `0600`.
- Le tunnel ngrok principal est un processus de session utilisateur, pas une unité système de production clairement gérée.

## 6. Décisions d’architecture retenues

1. Orbit reste l’unique surface publique et l’unique source de vérité produit.
2. Vibe reste un moteur localhost privé, versionné par SHA et appelé via une passerelle serveur Orbit.
3. Aucun secret Vibe/broker/provider n’est envoyé au navigateur.
4. SQLite stocke le control-plane Orbit ; les gros artifacts restent sur disque avec métadonnées et checksums en base.
5. Les formats durables natifs de Vibe sont conservés ; Orbit les indexe au lieu de les dupliquer aveuglément.
6. Toute action est un job durable avec statut, auteur, budget, timestamps, résultat et événements.
7. Recherche, lecture et paper trading sont autonomes dans les budgets définis.
8. Dépense IA inhabituelle, changement d’infrastructure risqué et live trading passent par une politique explicite et la Human Inbox.
9. Codex ne fait pas partie des agents de trading : il reste réservé au développement d’Orbit.
10. Hermes et Grafana sont retirés seulement après bascule du proxy et vérification de rollback.

## 7. Cible logique

```text
Navigateur
  → tunnel permanent unique
  → Caddy (TLS/proxy)
  → Orbit API/BFF :4173 (loopback)
      ├─ auth + sessions
      ├─ agents + policies + budgets
      ├─ jobs + workflows + inbox
      ├─ files + artifacts + audit + usage
      ├─ experiment orchestrator
      └─ proxy Vibe authentifié
           → Vibe FastAPI :8899 (loopback)
               ├─ sessions / goals / memory
               ├─ swarms / skills / tools
               ├─ market data / backtests / alpha zoo
               └─ paper/live connectors + mandates + HALT

Stockage
  ├─ Orbit SQLite + migrations + sauvegardes
  ├─ volume artifacts/runs immutable
  ├─ volume runtime Vibe
  └─ ledger append-only + checksums
```

