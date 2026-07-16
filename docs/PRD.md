# PRD — Orbit Trading Agent OS

Version de cadrage : 1.0. Produit mono-utilisateur pour Paul.

## 1. Vision

Orbit est le cockpit depuis lequel un seul opérateur crée, lance, observe et améliore des équipes d’agents de trading. Les agents doivent pouvoir rechercher, générer des stratégies, backtester, comparer, documenter et exécuter des workflows avec une forte autonomie. L’utilisateur intervient pour définir l’intention, les budgets et les limites, pas pour approuver chaque étape ordinaire.

## 2. Résultat attendu

Depuis l’interface, l’utilisateur doit pouvoir :

1. décrire un objectif de trading en langage naturel ;
2. créer ou choisir une équipe d’agents et ses compétences ;
3. lancer plusieurs variantes en parallèle ;
4. suivre en direct tâches, outils, tokens, coûts, erreurs et artifacts ;
5. comparer des backtests reproductibles et statistiquement validés ;
6. faire itérer automatiquement les variantes dans un budget borné ;
7. conserver chaque hypothèse, décision, fichier, run et résultat ;
8. promouvoir un candidat vers paper trading ;
9. connecter ultérieurement un broker live avec un mandat borné et un kill switch ;
10. reprendre tout travail après fermeture du navigateur ou redémarrage du VPS.

## 3. Principes produit

- Réel ou clairement marqué indisponible : aucune métrique fictive en mode production.
- Autonomie bornée : les limites sont du code et des données, pas seulement du prompt.
- Persistance par défaut : aucune information utile ne dépend uniquement du navigateur.
- Traçabilité : toute action importante possède une provenance et un résultat inspectable.
- Reproductibilité : un backtest référence code, config, dataset, coûts et versions.
- Paper-first : aucune promotion live automatique.
- Calme visuel : interface vivante et spatiale, sans masquer l’état réel.
- Dégradation honnête : un service hors ligne produit un état explicite et une action de diagnostic.

## 4. Périmètre

### P0 — socle exploitable

- Authentification mono-utilisateur et sessions révocables.
- Vibe installé comme service localhost privé.
- Chat Vibe réel avec sessions, SSE, outils et artifacts.
- Registre persistant des agents et équipes basé sur les presets Vibe.
- Lancement, annulation, retry et observation des swarms.
- Explorateur de fichiers réel, limité à des roots autorisés.
- Runs, backtests, charts, métriques, validations et rapports réels.
- Ledger, usage tokens et coûts réels.
- Human Inbox persistante.
- Santé réelle des services.
- Sauvegarde automatique des données canoniques.
- Suppression sûre de Hermes/Grafana et fermeture des expositions inutiles.

### P1 — laboratoire autonome

- Experiment Studio pour les boucles d’apprentissage.
- Générations, variantes, fonction de score et champion/challenger.
- Registre d’hypothèses et mémoire reliés aux expériences.
- Workflows planifiés durables.
- Paper accounts et journal de trades.
- Policies par agent : outils, marchés, budgets, concurrence, permissions.
- Notifications et décisions regroupées sans bloquer les tâches indépendantes.

### P2 — trading live borné

- Connexions broker live sélectionnées.
- Mandats expirants configurés depuis l’interface.
- Ordres dans les limites du mandat, selon politique par agent.
- Kill switch global et par broker toujours visible.
- Audit live et réconciliation des ordres.
- Runner managé uniquement pour les brokers dont les garanties sont validées.

### Hors périmètre initial

- Multi-tenant, rôles d’équipe ou facturation SaaS.
- Réseau social de stratégies.
- HFT ou garanties de latence faible.
- Conservation de faux écrans uniquement décoratifs.
- Live trading avant validation paper et définition explicite des marchés/brokers.

## 5. Navigation cible

| Zone | Fonction |
|---|---|
| Observatory | situation temps réel, alertes, runs actifs, budget, risque, prochaines actions |
| Agent Lab | agents, équipes, rôles, skills, modèles, outils, budgets et policies |
| Strategy Factory | hypothèses, création de stratégie, templates et conversation Vibe |
| Experiments | boucles, variantes, générations, leaderboard et comparaison |
| Runs | swarms, backtests, logs, artifacts, reproductibilité et erreurs |
| Trading | connexions, watchlists, paper portfolio, ordres, journal, mandats et HALT |
| Files & Data | fichiers réels, datasets, snapshots, uploads et éditeur borné |
| Knowledge | graphe dérivé des agents, hypothèses, runs, fichiers et mémoires |
| Automations | workflows et horaires réellement exécutés |
| Inbox | confirmations, décisions, incidents et dépassements de budget |
| Activity & Usage | audit global, tokens, coûts, temps et ressources |
| System | santé, sauvegardes, connexions, secrets et diagnostics |
| Codex Workshop | modification du dashboard uniquement, séparée des opérations trading |

## 6. Agent Lab

Chaque agent possède au minimum :

- identité, rôle et instructions versionnées ;
- modèle/provider et paramètres ;
- skills et outils autorisés ;
- marchés et data sources ;
- budget tokens, coût, durée, itérations et retries ;
- limite de concurrence ;
- politique filesystem/réseau/trading ;
- politique de confirmation ;
- historique des versions et métriques d’exécution.

Les équipes sont des DAG versionnés. Une modification crée une nouvelle version ; les anciens runs restent rattachés à leur définition exacte.

Critères d’acceptation :

- créer une équipe depuis un des 29 presets ;
- la modifier sans altérer les runs historiques ;
- lancer une équipe et voir chaque worker en temps réel ;
- stopper/retry sans perdre les événements déjà écrits ;
- afficher la consommation réelle par worker.

## 7. Experiment Studio

### 7.1 Définition d’une expérience

- hypothèse et objectif ;
- univers, période et fréquence ;
- snapshot de données ;
- stratégie de base ;
- paramètres mutables et espace de recherche ;
- nombre maximum de générations et variantes ;
- concurrence maximale ;
- budget tokens, coût et durée ;
- métriques obligatoires ;
- contraintes éliminatoires ;
- fonction de score ;
- patience et critères d’arrêt ;
- règles de promotion.

### 7.2 Cycle canonique

```text
Hypothèse
  → génération de variantes
  → validation statique
  → backtests parallèles bornés
  → contrôles anti-leakage et hors échantillon
  → revue risque/coûts/exécution
  → classement
  → mémoire des enseignements
  → génération suivante ou arrêt
  → champion/challenger
```

### 7.3 Règles non négociables

- Même snapshot de données pour comparer une génération.
- Séparation train/validation/test et période finale intacte.
- Coûts, slippage et liquidité explicites.
- Détection des résultats manquants ou non reproductibles.
- Pas de sélection sur le seul rendement brut.
- Toute élimination et promotion est expliquée et persistée.
- Dépassement de budget : pause et Inbox, jamais poursuite silencieuse.
- Champion signifie « meilleur candidat de l’expérience », jamais « autorisé live ».

### 7.4 Critères d’acceptation P1

- lancer au moins trois variantes sur deux générations ;
- fermer le navigateur puis retrouver l’état exact ;
- reprendre ou conclure proprement après redémarrage du moteur ;
- comparer métriques, code, config et artifacts côte à côte ;
- expliquer pourquoi chaque candidat a progressé ou été éliminé ;
- stopper automatiquement au premier critère atteint : budget, patience, temps ou score.

## 8. Autonomie et confirmations

Niveaux de risque par défaut :

| Niveau | Exemples | Politique |
|---|---|---|
| A — autonome | lecture, recherche, indexation, calcul borné | exécution immédiate |
| B — autonome budgété | swarms, backtests, génération de rapports | exécution tant que budgets non dépassés |
| C — confirmation exceptionnelle | hausse importante de budget, suppression, changement infra, accès nouveau secret | Human Inbox |
| D — capital réel | mandat, démarrage runner live, ordre hors politique ou première activation | consentement explicite et audit |
| E — interdit | élargir son propre mandat, désactiver l’audit, exposer des secrets | refus structurel |

Une tâche bloquée par une confirmation ne doit pas bloquer les autres branches du DAG.

## 9. Données et rétention

Doivent être persistés :

- agents, équipes, versions, prompts, skills et policies ;
- sessions, messages, tool calls et tentatives ;
- workflows, jobs, événements et décisions ;
- stratégies, hypothèses, expériences, candidats et scores ;
- datasets référencés, snapshots et checksums ;
- code, configs, logs, trades, charts et rapports ;
- tokens, coûts, temps CPU et erreurs ;
- connexions, mandats, consentements et audit live.

Politique initiale : pas de suppression automatique. L’archivage et la purge seront explicites, prévisualisés et journalisés. Les secrets sont exclus des exports ordinaires.

## 10. Files & Data

- Roots explicites, par exemple workspace Orbit, runtime Vibe et artifacts.
- Interdiction de traversée de chemin et de symlink hors root.
- Lecture, recherche, création, édition, déplacement, upload et téléchargement.
- Diff avant sauvegarde pour les fichiers sensibles.
- Taille et extensions bornées ; binaire en lecture/téléchargement uniquement.
- Version ou backup avant écrasement.
- Lien direct depuis un run vers tous ses artifacts.

## 11. Trading

### Paper

- Connexion broker sandbox ou simulateur clairement identifiée.
- Portefeuille, positions, ordres et historique réels de la sandbox.
- Stratégie et agent à l’origine de chaque ordre.
- Réconciliation et journal de performance.

### Live

- Désactivé globalement à l’installation.
- Activation en plusieurs étapes avec affichage du broker, compte, durée et limites.
- Mandat expirant, non modifiable par un agent.
- HALT global permanent dans la navigation.
- Les confirmations par ordre ou l’autonomie dans mandat sont configurables par agent ; le défaut initial reste confirmation par ordre.
- Aucune promotion automatique depuis une expérience.

## 12. Exigences non fonctionnelles

- API privée liée à loopback ; une seule entrée publique proxyfiée.
- Secrets chiffrés au repos quand possible et toujours exclus des réponses UI.
- Migrations de base versionnées et restaurables.
- Écritures atomiques, checksums pour les artifacts importants.
- Jobs idempotents ou explicitement non répétables pour les ordres.
- SSE avec reconnexion, déduplication et reprise d’événements.
- Santé liveness/readiness séparée.
- Interface utilisable sur desktop et tablette ; mobile pour observation/HALT.
- Accessibilité clavier, réduction de mouvement et contraste maintenus.
- Aucun faux statut « LIVE », « ONLINE » ou « réussi ».

## 13. Direction design

Conserver l’identité spatiale existante mais ajouter de la vie utile :

- orbites et flux animés issus de jobs réels ;
- constellation d’agents dont les nœuds changent avec leur état ;
- timeline vivante des outils ;
- widgets repositionnables et persistés côté serveur ;
- transitions de changement d’état, pas d’animations gratuites ;
- densité variable entre cockpit et analyse détaillée ;
- skeletons, états vides, erreurs et reconnexion soignés ;
- mode réduction de mouvement pleinement fonctionnel.

## 14. Mesure du succès

- zéro donnée métier uniquement dans `localStorage` ;
- 100 % des boutons opérationnels connectés ou explicitement désactivés ;
- reprise après refresh pour 100 % des jobs longs ;
- chaque run possède config, code, données, métriques et provenance ;
- budget et consommation visibles avant, pendant et après une expérience ;
- aucun ordre live possible sans mandat valide ;
- temps médian entre une idée et trois backtests comparables inférieur à 10 minutes hors temps provider/données ;
- aucune exposition réseau non documentée hors SSH et proxy public.

## 15. Décisions encore nécessaires avant les phases trading

Ces décisions ne bloquent pas le socle P0 :

1. provider et modèles opérationnels de Vibe, avec budget mensuel cible ;
2. premier marché et premier broker paper ;
3. premier broker live éventuel ;
4. politique de sauvegarde externe et durée de rétention souhaitée.

