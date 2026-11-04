#!/usr/bin/env bash
# APK de prueba local, firmado con la misma clave que las releases de GitHub: se instala como
# actualización de la app del teléfono. No sube nada.
#
#   scripts/build-apk.sh           compila e instala si hay un teléfono conectado por USB/Wi-Fi
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$(brew --prefix)/share/android-commandlinetools}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

KEYDIR="$HOME/.config/biblioteca"
if [ -f "$KEYDIR/release.p12" ]; then
  source "$KEYDIR/signing.env"
  export KEYSTORE_PATH="$KEYDIR/release.p12" KEYSTORE_PASSWORD KEY_ALIAS
else
  echo "Aviso: falta la clave en $KEYDIR (scripts/setup-signing.sh); el APK no se instalará encima de la app." >&2
fi

VERSION=$(node -p "require('./package.json').version")
SUFFIX="-test.$(git rev-parse --short HEAD)"
[ -n "$(git status --porcelain)" ] && SUFFIX="$SUFFIX-wip"
export VERSION_SUFFIX="$SUFFIX"

npm run build
npx cap sync android
(cd android && ./gradlew assembleRelease --quiet)

mkdir -p builds
APK="builds/bookloft-$VERSION$SUFFIX.apk"
cp android/app/build/outputs/apk/release/app-release.apk "$APK"
echo
echo "APK de prueba: $APK"

if command -v adb >/dev/null && adb get-state >/dev/null 2>&1; then
  echo "Instalando en el dispositivo conectado…"
  adb install -r "$APK"
fi
