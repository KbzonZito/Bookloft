#!/usr/bin/env bash
# Instala el emulador de Android y crea dos dispositivos para probar en el Mac: "Telefono" y "Tablet".
# Se corre una sola vez (descarga ~2 GB). Después: npm run android:live
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$(brew --prefix)/share/android-commandlinetools}"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
[ -x "$SDKMANAGER" ] || SDKMANAGER=sdkmanager
[ -x "$AVDMANAGER" ] || AVDMANAGER=avdmanager

IMAGE="system-images;android-36;google_apis_playstore;arm64-v8a"

yes | "$SDKMANAGER" --sdk_root="$ANDROID_HOME" --licenses >/dev/null || true
"$SDKMANAGER" --sdk_root="$ANDROID_HOME" "emulator" "platform-tools" "$IMAGE"

create() {
  local name=$1 device=$2
  if "$ANDROID_HOME/emulator/emulator" -list-avds | grep -qx "$name"; then
    echo "Ya existe el emulador $name"
  else
    echo no | "$AVDMANAGER" create avd --name "$name" --package "$IMAGE" --device "$device"
  fi
  # avdmanager crea los emuladores sin GPU: el WebView dibujaría por CPU y todo se vería trabado
  local config="$HOME/.android/avd/$name.avd/config.ini"
  sed -i '' 's/^hw.gpu.enabled=.*/hw.gpu.enabled=yes/; s/^hw.gpu.mode=.*/hw.gpu.mode=host/' "$config"
}
create Telefono pixel_9
create Tablet pixel_tablet

echo
echo "Listo. Abre uno con: \$ANDROID_HOME/emulator/emulator -avd Telefono   (o Tablet)"
