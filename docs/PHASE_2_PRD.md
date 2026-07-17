# Phase 2 — moteur Vibe réel

Statut : contrat d’implémentation du 17 juillet 2026.

## 1. Objectif

Remplacer entièrement le cockpit Vibe simulé par un moteur privé, persistant et
observable. Orbit reste l’unique frontière publique et le navigateur ne reçoit
ni credential provider, ni clé de service, ni chemin absolu du VPS.

Cette phase fournit le laboratoire conversationnel Vibe. Elle ne lance aucun
ordre, ne connecte aucun broker live et ne construit pas encore l’éditeur
d’agents versionnés de Phase 3.

## 2. Décision provider

L’utilisateur possède un abonnement ChatGPT incluant Codex. Vibe utilise donc le
provider `openai-codex` et son OAuth ChatGPT dédié, sans `OPENAI_API_KEY` et sans
facturation API OpenAI séparée. L’autorisation initiale est une opération locale
unique, stockée dans le HOME privé de l’utilisateur de service Vibe.

Tant que cette autorisation n’est pas terminée, l’interface doit distinguer :

- moteur démarré ;
- provider configuré ;
- provider autorisé ;
- session prête à exécuter.

## 3. Déploiement et isolation

- Révision Vibe épinglée : `86f6012e00120e3fa5c3f0e15be8c94abe732dcf`.
- Cette révision est postérieure à `v0.1.11` et contient les correctifs de
  sécurité, de provider et de sessions retenus pendant l’audit.
- Utilisateur système dédié sans shell interactif.
- Code et environnement Python sous `/opt/vibe-trading`.
- État durable sous `/var/lib/vibe-trading`, permissions privées.
- Configuration sensible sous `/etc/vibe-trading`, hors Git.
- Écoute stricte sur `127.0.0.1:8899`.
- Outils shell explicitement désactivés.
- Vibe n’est jamais routé directement par Caddy/ngrok.
- Service systemd durci et redémarré automatiquement.

## 4. Frontière Orbit ↔ Vibe

Orbit expose une API allowlistée sous `/api/vibe`, authentifiée par la session
Orbit et protégée par le contrôle d’origine existant. Le proxy :

- borne les délais, tailles de requête et tailles de réponse ;
- ajoute le credential interne uniquement côté serveur ;
- ne transmet aucun header arbitraire du navigateur ;
- relaie les événements SSE sans buffering ;
- conserve `Last-Event-ID` pour la reconnexion ;
- transforme les erreurs réseau en états explicites et expurgés ;
- interdit les routes inconnues et les changements de settings/provider depuis
  le navigateur pendant cette phase.

Routes produit : santé/capacités, skills, presets, sessions, messages, annulation,
événements, uploads et artifacts/runs en lecture.

## 5. Expérience utilisateur

La page Vibe affiche uniquement des données réelles :

1. santé moteur et état provider ;
2. création, sélection, renommage et suppression de sessions ;
3. historique persistant des messages ;
4. envoi d’un objectif de recherche ;
5. flux temps réel des tentatives, outils, résultats et erreurs ;
6. annulation d’une tentative active ;
7. catalogue réel des skills et presets ;
8. uploads et artifacts disponibles lorsque le moteur les expose ;
9. états vide, chargement, reconnexion, indisponible et non autorisé.

Il ne reste aucun texte qui prétend simuler une réponse, un run ou un statut.

## 6. Persistance et reprise

- Les sessions/messages Vibe restent la source canonique de la conversation.
- Les données survivent au restart de Vibe, d’Orbit et du VPS.
- Un flux SSE peut reprendre depuis son dernier identifiant connu sans dupliquer
  les événements déjà affichés.
- Un restart pendant une tentative se termine par un état récupéré ou une erreur
  honnête ; jamais par un spinner permanent.
- Aucune purge automatique n’est activée.

## 7. Sécurité et garde-fous

- Aucun secret dans Git, les réponses JSON, les logs ou le frontend.
- Aucun accès direct du navigateur à `:8899`.
- Aucun proxy générique vers Vibe.
- Outils shell désactivés même pour les requêtes loopback.
- Trading live et actions broker hors périmètre.
- Taille d’un message : 5 000 caractères maximum, comme le contrat Vibe.
- Uploads bornés au contrat Vibe et jamais servis par chemin arbitraire.
- Les erreurs sont expurgées avant audit et réponse.

## 8. Critères d’acceptation

La phase est acceptée si :

1. Vibe est actif après restart et n’écoute que sur loopback ;
2. la révision réellement exécutée correspond au SHA épinglé ;
3. aucun `OPENAI_API_KEY` n’est nécessaire ;
4. santé, skills et presets sont relus via Orbit ;
5. une session et ses messages survivent à un restart ;
6. les événements SSE traversent Orbit et se reconnectent sans duplication ;
7. l’absence d’OAuth produit un état guidé, sans crash ni faux « ready » ;
8. les routes Vibe non allowlistées sont inaccessibles ;
9. les tests Orbit et les tests Vibe ciblés sont verts ;
10. le lien public Orbit reste fonctionnel et aucun secret n’est publié.

## 9. Rollback

Le rollback arrête et désactive `vibe-trading.service`, restaure l’unité Orbit
précédente si nécessaire et retire les variables `VIBE_*` d’Orbit. Les données
de `/var/lib/vibe-trading` sont conservées. Aucun rollback ne doit supprimer les
sessions, tokens OAuth ou artifacts sans action explicite.
