# Phase 2 — exploitation Vibe

## Invariants

- Vibe écoute uniquement sur `127.0.0.1:8899`.
- Le navigateur passe toujours par `/orbit/api/vibe/*`.
- Le code exécuté correspond au SHA consigné dans `deploy/install-vibe.sh`.
- Les outils shell restent désactivés.
- Le provider `openai-codex` utilise OAuth ChatGPT/Codex, sans clé API OpenAI.
- L’état durable vit sous `/var/lib/vibe-trading` et n’est pas supprimé lors
  d’une mise à jour ou d’un rollback.
- Le dotenv canonique `~/.vibe-trading/.env` reflète le provider réellement
  exécuté ; les secrets de service restent sous `/etc/vibe-trading`.

## Installation idempotente

```text
sudo /home/codex/agentic-os/deploy/install-vibe.sh
sudo systemctl restart orbit-os
```

## Autorisation OAuth

Cette commande doit être exécutée dans un terminal interactif une fois :

```text
sudo -u vibe-trading -H /opt/vibe-trading/venv/bin/vibe-trading provider login openai-codex
```

Elle affiche le parcours d’autorisation géré par `oauth-cli-kit`. Aucun token
obtenu ne doit être copié dans Git, un ticket ou un message.

## Vérifications

```text
systemctl is-active vibe-trading orbit-os
ss -lntp
curl -fsS http://127.0.0.1:8899/health
curl -fsS http://127.0.0.1:8899/ready
sudo -u vibe-trading -H /opt/vibe-trading/venv/bin/vibe-trading provider status
```

Après OAuth, `/ready` doit répondre 200. Avant OAuth, le code 503 avec une
raison non sensible est attendu et Orbit doit afficher « OAuth requis ».

## Mise à jour

Modifier d’abord le SHA dans le PRD et l’installeur après audit amont. Relancer
l’installeur crée une nouvelle release et un nouveau virtualenv ; les données ne
bougent pas. Ne jamais suivre une branche mobile directement en production.

## Rollback

1. arrêter et désactiver `vibe-trading.service` ;
2. restaurer l’ancienne unité Orbit si la frontière BFF doit être retirée ;
3. conserver `/var/lib/vibe-trading` et `/etc/vibe-trading` ;
4. vérifier que le port 8899 est fermé et que le reste d’Orbit reste prêt.

```text
sudo systemctl disable --now vibe-trading
sudo ss -lntp | grep ':8899' || true
```
