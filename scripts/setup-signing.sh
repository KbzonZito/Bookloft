#!/usr/bin/env bash
# Crea una clave de firma permanente y la guarda como secretos de GitHub, para que todos los APK
# que compila CI tengan la misma firma y se instalen como actualización del anterior.
#
#   scripts/setup-signing.sh [dueño/repo]
#
# Respalda ~/.config/biblioteca fuera del Mac (gestor de contraseñas): sin la clave no se puede
# actualizar la app instalada.
set -euo pipefail

REPO="${1:-KbzonZito/library_app}"
DIR="$HOME/.config/biblioteca"
mkdir -p "$DIR" && chmod 700 "$DIR"

if [ ! -f "$DIR/release.p12" ]; then
  PASS=$(openssl rand -hex 16)
  openssl req -x509 -newkey rsa:2048 -nodes -days 10000 -subj "/CN=Biblioteca" \
    -keyout "$DIR/key.pem" -out "$DIR/cert.pem" 2>/dev/null
  openssl pkcs12 -export -name biblioteca -inkey "$DIR/key.pem" -in "$DIR/cert.pem" \
    -out "$DIR/release.p12" -passout "pass:$PASS"
  rm "$DIR/key.pem"
  printf 'KEYSTORE_PASSWORD=%s\nKEY_ALIAS=biblioteca\n' "$PASS" > "$DIR/signing.env"
  chmod 600 "$DIR"/*
  echo "Clave creada en $DIR (respáldala: sin ella no podrás actualizar la app instalada)."
fi

source "$DIR/signing.env"
base64 < "$DIR/release.p12" | gh secret set KEYSTORE_BASE64 -R "$REPO"
gh secret set KEYSTORE_PASSWORD -R "$REPO" --body "$KEYSTORE_PASSWORD"
gh secret set KEY_ALIAS -R "$REPO" --body "$KEY_ALIAS"
echo "Secretos configurados en $REPO."
