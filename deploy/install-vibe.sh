#!/usr/bin/env bash
set -euo pipefail

VIBE_SHA="86f6012e00120e3fa5c3f0e15be8c94abe732dcf"
VIBE_REPOSITORY="https://github.com/HKUDS/Vibe-Trading.git"
INSTALL_ROOT="/opt/vibe-trading"
STATE_ROOT="/var/lib/vibe-trading"
CONFIG_ROOT="/etc/vibe-trading"
SERVICE_USER="vibe-trading"
RELEASE="$INSTALL_ROOT/releases/$VIBE_SHA"
VENV="$INSTALL_ROOT/venvs/$VIBE_SHA"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "install-vibe.sh doit être exécuté en root" >&2
  exit 1
fi

umask 077
if ! getent passwd "$SERVICE_USER" >/dev/null; then
  useradd --system --home-dir "$STATE_ROOT" --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

install -d -m 0755 "$INSTALL_ROOT/releases" "$INSTALL_ROOT/venvs"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0700 \
  "$STATE_ROOT" "$STATE_ROOT/runtime" "$STATE_ROOT/runtime/runs" \
  "$STATE_ROOT/runtime/sessions" "$STATE_ROOT/runtime/uploads" \
  "$STATE_ROOT/runtime/swarm-runs" "$STATE_ROOT/.vibe-trading"
install -d -m 0700 "$CONFIG_ROOT"

if [[ ! -d "$RELEASE/.git" ]]; then
  git clone --filter=blob:none --no-checkout "$VIBE_REPOSITORY" "$RELEASE"
  git -C "$RELEASE" fetch --depth 1 origin "$VIBE_SHA"
  git -C "$RELEASE" checkout --detach "$VIBE_SHA"
fi

actual_sha=$(git -C "$RELEASE" rev-parse HEAD)
if [[ "$actual_sha" != "$VIBE_SHA" ]]; then
  echo "Révision Vibe inattendue: $actual_sha" >&2
  exit 1
fi

for mapping in \
  "runs:$STATE_ROOT/runtime/runs" \
  "sessions:$STATE_ROOT/runtime/sessions" \
  "uploads:$STATE_ROOT/runtime/uploads"; do
  name=${mapping%%:*}
  target=${mapping#*:}
  path="$RELEASE/agent/$name"
  if [[ -e "$path" && ! -L "$path" ]]; then
    echo "Le chemin runtime existe déjà et n'est pas un lien: $path" >&2
    exit 1
  fi
  ln -sfn "$target" "$path"
done
install -d -m 0755 "$RELEASE/agent/.swarm"
ln -sfn "$STATE_ROOT/runtime/swarm-runs" "$RELEASE/agent/.swarm/runs"

if [[ ! -x "$VENV/bin/python" ]]; then
  python3 -m venv "$VENV"
fi
"$VENV/bin/python" -m pip install --disable-pip-version-check --require-hashes -r "$RELEASE/requirements-lock.txt"
"$VENV/bin/python" -m pip install --disable-pip-version-check --no-deps -e "$RELEASE"
"$VENV/bin/python" -c "import api_server, cli, src; print('Vibe imports: ok')"

# L'umask protège les fichiers créés pendant l'installation. Le code et le
# virtualenv doivent ensuite rester traversables/lisibles par l'utilisateur de
# service ; les données et credentials demeurent privés sous /var et /etc.
chmod -R a+rX "$RELEASE" "$VENV"

ln -sfn "$RELEASE" "$INSTALL_ROOT/current"
ln -sfn "$VENV" "$INSTALL_ROOT/venv"

if [[ ! -f "$CONFIG_ROOT/vibe.env" ]]; then
  internal_key=$(openssl rand -hex 32)
  install -m 0600 /dev/null "$CONFIG_ROOT/vibe.env"
  printf '%s\n' \
    'LANGCHAIN_PROVIDER=openai-codex' \
    'LANGCHAIN_MODEL_NAME=openai-codex/gpt-5.4' \
    'OPENAI_CODEX_BASE_URL=https://chatgpt.com/backend-api/codex/responses' \
    'ENABLE_SESSION_RUNTIME=true' \
    'VIBE_TRADING_ENABLE_SHELL_TOOLS=0' \
    'VIBE_TRADING_ENABLE_SCHEDULER=0' \
    "API_AUTH_KEY=$internal_key" > "$CONFIG_ROOT/vibe.env"
fi
chown root:"$SERVICE_USER" "$CONFIG_ROOT/vibe.env"
chmod 0640 "$CONFIG_ROOT/vibe.env"

# L'API settings lit le dotenv canonique du HOME avant l'environnement du
# service. Le maintenir évite qu'elle affiche les valeurs de .env.example tout
# en préservant d'éventuels credentials de sources de données ajoutés plus tard.
user_env="$STATE_ROOT/.vibe-trading/.env"
touch "$user_env"
upsert_user_env() {
  local key=$1 value=$2
  if grep -q "^${key}=" "$user_env"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$user_env"
  else
    printf '%s=%s\n' "$key" "$value" >> "$user_env"
  fi
}
upsert_user_env LANGCHAIN_PROVIDER openai-codex
upsert_user_env LANGCHAIN_MODEL_NAME openai-codex/gpt-5.4
upsert_user_env OPENAI_CODEX_BASE_URL https://chatgpt.com/backend-api/codex/responses
upsert_user_env ENABLE_SESSION_RUNTIME true
upsert_user_env VIBE_TRADING_ENABLE_SHELL_TOOLS 0
upsert_user_env VIBE_TRADING_ENABLE_SCHEDULER 0
chown "$SERVICE_USER":"$SERVICE_USER" "$user_env"
chmod 0600 "$user_env"

internal_key=$(sed -n 's/^API_AUTH_KEY=//p' "$CONFIG_ROOT/vibe.env" | head -1)
if [[ -z "$internal_key" ]]; then
  echo "API_AUTH_KEY absent de $CONFIG_ROOT/vibe.env" >&2
  exit 1
fi

orbit_env="/etc/agentic-os/orbit.env"
if [[ ! -f "$orbit_env" ]]; then
  echo "$orbit_env est absent" >&2
  exit 1
fi
tmp_env=$(mktemp "$CONFIG_ROOT/orbit.env.XXXXXX")
grep -vE '^VIBE_(BASE_URL|API_KEY)=' "$orbit_env" > "$tmp_env" || true
printf 'VIBE_BASE_URL=http://127.0.0.1:8899\nVIBE_API_KEY=%s\n' "$internal_key" >> "$tmp_env"
install -o root -g root -m 0600 "$tmp_env" "$orbit_env"
rm -f "$tmp_env"

install -o root -g root -m 0644 \
  "$(dirname "$0")/vibe-trading.service" \
  /etc/systemd/system/vibe-trading.service
systemctl daemon-reload
systemctl enable --now vibe-trading.service

echo "Vibe-Trading $VIBE_SHA installé sur 127.0.0.1:8899"
echo "OAuth restant: sudo -u $SERVICE_USER -H $INSTALL_ROOT/venv/bin/vibe-trading provider login openai-codex"
