# Phase 1 — fondation persistante et System réel

Statut : contrat d’implémentation validé le 16 juillet 2026.

## 1. Objectif

Remplacer le prototype sans mémoire serveur par un control-plane persistant,
observable et testable. Cette phase ne démarre ni Vibe, ni un broker, ni une
commande de trading. Elle rend fiables les fonctions déjà réellement exposées :
l’accès mono-utilisateur, PI, Codex, les conversations et l’état du dashboard.

## 2. Résultats utilisateur

À la fin de la phase :

1. une reconnexion ou un redémarrage du navigateur retrouve les conversations ;
2. le cookie permanent ne contient plus le secret d’accès principal ;
3. chaque appareil possède une session révocable, expirante et auditée ;
4. chaque requête PI/Codex crée un job et des événements persistants ;
5. la page System affiche uniquement des états mesurés par le backend ;
6. l’utilisateur peut déclencher une sauvegarde SQLite locale ;
7. aucun clic ordinaire ne produit le toast global trompeur « simulé » ;
8. un service non encore installé est indiqué comme indisponible ou différé.

## 3. Périmètre fonctionnel

### 3.1 Persistance canonique

SQLite en mode WAL conserve :

- versions de migrations ;
- sessions d’accès, sous forme de hash seulement ;
- conversations et messages PI/Codex ;
- jobs, événements et décisions ;
- entrées d’audit append-only ;
- réglages serveur futurs sous forme clé/valeur JSON.

La base de production et ses sauvegardes vivent dans `/var/lib/orbit-os`, hors
Git et hors build statique. Les tests utilisent exclusivement des répertoires
temporaires.

### 3.2 Authentification

Le jeton permanent sert uniquement à initialiser un appareil. Orbit émet ensuite
un jeton aléatoire opaque de 256 bits, n’en stocke que le SHA-256 et le place dans
un cookie `HttpOnly`, `SameSite=Strict`, limité à 30 jours. Une session peut être
révoquée. L’ancien cookie Phase 0 est converti lors du prochain chargement GET.

### 3.3 Conversations

- Liste et création de conversations par runtime (`pi` ou `codex`).
- Messages stockés avant et après l’appel au runtime.
- Identifiant de reprise du runtime conservé côté serveur, jamais requis dans le
  navigateur.
- Si un rollout Codex a disparu, Orbit repart sur un nouveau thread et actualise
  la conversation existante.
- Les erreurs sont enregistrées dans le job et l’audit sans stocker de secret.

### 3.4 System

La première page réellement opérationnelle expose :

- disponibilité Orbit, SQLite, PI, Codex et Vibe ;
- uptime et mémoire du processus Orbit ;
- version du schéma et taille de la base ;
- nombres réels de sessions, conversations, jobs, événements et décisions ;
- événements récents expurgés ;
- création manuelle d’une sauvegarde locale.

Les actions système dangereuses, les redémarrages et le terminal restent hors
périmètre : aucun bouton décoratif ne prétend les exécuter.

## 4. API de la phase

| Méthode | Route | Fonction |
|---|---|---|
| GET | `/api/session` | métadonnées non sensibles de la session courante |
| DELETE | `/api/session` | révoquer la session courante |
| GET | `/api/conversations?agent=` | lister les conversations |
| POST | `/api/conversations` | créer une conversation |
| GET | `/api/conversations/:id/messages` | charger ses messages |
| POST | `/api/chat` | exécuter PI/Codex et persister le cycle |
| GET | `/api/system/overview` | état réel et compteurs |
| POST | `/api/system/backups` | créer une sauvegarde cohérente |
| GET | `/api/activity` | événements/audit récents expurgés |

Toutes les écritures exigent une origine identique et des payloads strictement
validés. Les erreurs API ont un code stable et un message utilisateur borné.

## 5. Hors périmètre

- Déploiement ou intégration Vibe (Phase 2, différée selon la décision produit).
- CRUD d’agents, workflows et expériences.
- Accès fichiers, terminal ou commandes systemd depuis le navigateur.
- Paper/live trading.
- Migration de toutes les pages de démonstration en une seule fois.
- Refonte graphique finale ; la Phase 1 apporte toutefois les vrais états de
  chargement, indisponibilité, santé et activité.

## 6. Contraintes de sécurité

- Aucun secret, token, chemin sensible ou variable d’environnement dans l’API.
- Hash de session comparé à valeur constante par recherche exacte en base.
- Sessions expirées ou révoquées refusées.
- Transactions atomiques pour les transitions job/événement.
- Payload JSON et chaînes bornés avant écriture.
- Base et sauvegardes créées avec un umask restrictif.
- Le service reste lié à `127.0.0.1` et conserve son sandbox systemd.

## 7. Critères d’acceptation

- Migrations idempotentes sur base vide et base déjà migrée.
- Une transaction interrompue ne laisse ni job partiel ni événement orphelin.
- Le jeton d’accès permanent et le token de session sont absents des lignes SQL,
  réponses API et événements d’audit en clair.
- Une conversation survit au redémarrage du serveur de test.
- Une session révoquée ne peut plus appeler l’API.
- L’erreur Codex `no rollout found` reste récupérée automatiquement.
- La page System n’importe aucune donnée de `mockData` ou de `localStorage`.
- Build TypeScript/Vite, tests unitaires et intégration verts.
- Déploiement production, healthchecks et accès protégé validés.

## 8. Rollback

Le rollback applicatif consiste à restaurer le commit Phase 0 et l’ancienne unité
systemd. La base Phase 1 reste intacte et inutilisée. Avant toute migration future
destructive, une sauvegarde SQLite est obligatoire ; aucune migration destructive
n’est introduite dans cette phase.
