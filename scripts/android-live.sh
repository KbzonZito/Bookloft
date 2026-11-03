#!/usr/bin/env bash
# Abre la app en Android con live reload: cada cambio guardado aparece al instante, sin reinstalar.
# Necesita el servidor de desarrollo corriendo en otra terminal (npm run dev).
#
#   npm run android:live                  emulador "Telefono"
#   npm run android:live -- Tablet        emulador "Tablet"
#   npm run android:live -- --phone       teléfono real conectado por USB o depuración Wi-Fi
#
# Solo hace falta recompilar (este mismo comando) al agregar o actualizar un plugin nativo.
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$(brew --prefix)/share/android-commandlinetools}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
PORT=5180

curl -s -o /dev/null "http://localhost:$PORT" || {
  echo "Primero levanta el servidor: npm run dev" >&2
  exit 1
}

if [ "${1:-}" = "--phone" ]; then
  HOST=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
  TARGET=$(adb devices | awk 'NR > 1 && $2 == "device" && $1 !~ /^emulator/ { print $1; exit }')
  [ -n "$TARGET" ] || { echo "No hay un teléfono conectado (adb devices)" >&2; exit 1; }
else
  AVD="${1:-Telefono}"
  HOST=10.0.2.2 # el Mac visto desde el emulador
  if ! adb devices | grep -q '^emulator'; then
    echo "Abriendo el emulador $AVD…"
    emulator -avd "$AVD" -no-snapshot-save >/dev/null 2>&1 &
    adb wait-for-device
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 2; done
  fi
  TARGET=$(adb devices | awk 'NR > 1 && $1 ~ /^emulator/ { print $1; exit }')
fi

npx cap run android --live-reload --host "$HOST" --port "$PORT" --target "$TARGET"
