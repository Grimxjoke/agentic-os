# Phase 2 — plan technique exécutable

## Tranche A — runtime reproductible

1. Épingler le SHA amont et fournir un installeur idempotent.
2. Créer l’utilisateur, les répertoires privés et le virtualenv Python.
3. Installer les dépendances depuis le lockfile avec vérification de hashes.
4. Relier les répertoires de données natifs Vibe au runtime persistant.
5. Installer et durcir l’unité systemd loopback-only.
6. Tester version, bind réseau, droits et restart.

## Tranche B — client BFF sécurisé

1. Ajouter un client Vibe Node avec timeout, taille maximale et redaction.
2. Définir une allowlist de contrats REST distincte d’un proxy générique.
3. Relayer le SSE avec backpressure et `Last-Event-ID`.
4. Ajouter santé/capacités, sessions/messages, skills/presets et ressources.
5. Tester upstream indisponible, timeout, erreur JSON, payload trop grand,
   route inconnue et fuite de credential.

## Tranche C — cockpit réel

1. Remplacer les constantes et le chat `localStorage` de `VibePage`.
2. Construire un workspace session/sidebar/chat persistant.
3. Afficher les événements outils et tentative en direct.
4. Ajouter création, renommage, suppression et annulation.
5. Brancher skills/presets, uploads et artifacts disponibles.
6. Soigner les états OAuth requis, offline, reconnecting, empty et failed.

## Tranche D — autorisation ChatGPT/Codex

1. Configurer `LANGCHAIN_PROVIDER=openai-codex` sans clé API.
2. Exécuter le login OAuth sous l’utilisateur de service.
3. Vérifier l’état provider sans exposer le token.
4. Envoyer une recherche minimale, recevoir les événements et relire l’historique.

## Tranche E — validation et production

1. Exécuter les tests Vibe ciblés auth/session/SSE/security.
2. Exécuter build et suite Orbit à chaque tranche.
3. Tester persistance et flux pendant restart Vibe.
4. Déployer Orbit, puis vérifier les probes internes et publiques.
5. Scanner code, diff, logs et artefacts Git pour les secrets.
6. Documenter exploitation/rollback, commit, push et PR.
