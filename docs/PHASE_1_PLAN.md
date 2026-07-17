# Phase 1 — plan technique exécutable

## Tranche A — modules et données

1. Extraire configuration, HTTP, schémas, runtimes et application de
   `server.mjs`.
2. Ajouter un gestionnaire SQLite, des migrations SQL ordonnées et des
   repositories à requêtes préparées.
3. Tester migrations, transactions, repositories et redaction.

## Tranche B — accès révocable

1. Émettre une session opaque après validation du jeton permanent.
2. Convertir le cookie Phase 0 au premier GET authentifié.
3. Ajouter inspection et révocation de session.
4. Tester expiration, révocation, cookie sécurisé et absence de token en clair.

## Tranche C — jobs et conversations

1. Persister conversation, messages et identifiant runtime.
2. Encapsuler chaque appel PI/Codex dans un job durable.
3. Émettre événements de début, succès, récupération et erreur.
4. Exposer les routes de lecture nécessaires au frontend.
5. Conserver le fallback Codex pour les rollouts disparus.

## Tranche D — System réel et design

1. Remplacer Control Center simulé par une page System en lecture réelle.
2. Afficher services, stockage, compteurs et activité avec états loading/error.
3. Ajouter la sauvegarde manuelle avec feedback local et vérifiable.
4. Remplacer les badges globaux fixes et retirer le toast automatique simulé.
5. Conserver le mouvement spatial, mais le relier aux statuts réellement reçus.

## Tranche E — production

1. Construire et exécuter toute la suite de tests.
2. Créer `/var/lib/orbit-os` avec propriétaire et permissions restrictives.
3. Installer l’unité systemd mise à jour puis redémarrer Orbit.
4. Vérifier migrations, probes, auth, API, Codex et page System.
5. Scanner le diff et Git pour les secrets, documenter et publier.
