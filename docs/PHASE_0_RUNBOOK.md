# Phase 0 — déploiement et rollback

## Invariants

- Orbit est la seule application routée publiquement.
- Le processus Orbit écoute uniquement sur `127.0.0.1:4173`.
- Caddy écoute uniquement sur `127.0.0.1:18080` et transmet `/orbit/*`, `/healthz` et `/readyz`.
- Le tunnel ngrok permanent est géré par `ngrok-orbit.service`.
- Les credentials restent exclusivement hors Git dans des fichiers root protégés.
- Les messages utilisateur sont transmis aux CLIs par stdin et ne figurent pas dans les arguments journalisés par sudo.
- Les unités, tunnels, superviseurs, conteneurs, images, réseaux et arbres applicatifs Hermes/Grafana sont supprimés après validation de la bascule.
- Le port public `10275` est fermé.

## Vérification

```text
npm test
npm run check:health
node scripts/check-health.mjs https://trailside-capacity-worst.ngrok-free.dev
systemctl is-active orbit-os ngrok-orbit
ss -lntup
```

Résultat réseau attendu :

- `127.0.0.1:4173` : Orbit ;
- `127.0.0.1:18080` : Caddy ;
- aucun `0.0.0.0:4173` ;
- aucun port `10275`.
- aucun processus `cloudflared` ni tunnel ngrok autre que `ngrok-orbit.service`.

## Rollback Caddy

Avant la bascule, l’ancien fichier est copié hors du dépôt sous
`/opt/agentic-os/docker/caddy/Caddyfile.pre-phase0`. Pour revenir en arrière :

```text
sudo cp /opt/agentic-os/docker/caddy/Caddyfile.pre-phase0 /opt/agentic-os/docker/caddy/Caddyfile
sudo docker exec agentic-os-caddy caddy validate --config /etc/caddy/Caddyfile
sudo docker exec agentic-os-caddy caddy reload --config /etc/caddy/Caddyfile
```

Le fichier est volontairement copié en place : le remplacer atomiquement casserait
le lien avec le fichier déjà monté dans le conteneur. Si ce lien a déjà été cassé,
recréez uniquement Caddy avec `sudo docker compose up -d --force-recreate caddy`
depuis `/opt/agentic-os/docker/caddy`.

## Rollback Orbit

Le service déployé est sauvegardé sous `/etc/systemd/system/orbit-os.service.pre-phase0`.

```text
sudo install -m 0644 /etc/systemd/system/orbit-os.service.pre-phase0 /etc/systemd/system/orbit-os.service
sudo systemctl daemon-reload
sudo systemctl restart orbit-os
```

## Rollback tunnel

Si `ngrok-orbit.service` ne récupère pas le domaine permanent :

```text
sudo systemctl disable --now ngrok-orbit
sudo /snap/bin/ngrok http 18080 --log=stdout --log-format=logfmt
```

Le dernier recours est volontairement interactif afin de ne pas créer un second tunnel orphelin en arrière-plan.

## Hermes

La suppression Hermes/Grafana est volontaire et explicitement autorisée. Elle n’a
pas de rollback applicatif : aucun historique ni donnée Hermes ne devait être
conservé. Le rollback Phase 0 couvre uniquement Orbit, Caddy et le tunnel public.
