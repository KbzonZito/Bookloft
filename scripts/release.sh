#!/usr/bin/env bash
# Publica una versión probada: fija la versión, fecha su sección del CHANGELOG, hace commit,
# etiqueta y sube. GitHub Actions compila el APK y crea la release.
#
#   scripts/release.sh 0.2.0
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:?Uso: scripts/release.sh MAJOR.MINOR.PATCH}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Versión inválida: $VERSION" >&2; exit 1; }
[ "$(git branch --show-current)" = main ] || { echo "Hay que estar en main" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Hay cambios sin commitear" >&2; exit 1; }
git rev-parse "v$VERSION" >/dev/null 2>&1 && { echo "La versión v$VERSION ya existe" >&2; exit 1; }

# La sección [Unreleased] pasa a ser la nota de esta versión
NOTES=$(awk '/^## \[Unreleased\]/{p=1; next} /^## /{p=0} p' CHANGELOG.md | grep -v '^\s*$' || true)
[ -n "$NOTES" ] || { echo "CHANGELOG.md no tiene nada en [Unreleased]" >&2; exit 1; }
# La app muestra las novedades en su idioma: el CHANGELOG en inglés tiene que ir a la par
NOTES_EN=$(awk '/^## \[Unreleased\]/{p=1; next} /^## /{p=0} p' CHANGELOG.en.md | grep -v '^\s*$' || true)
[ "$(printf '%s\n' "$NOTES" | grep -c '^- ')" = "$(printf '%s\n' "$NOTES_EN" | grep -c '^- ')" ] || {
  echo "CHANGELOG.en.md no tiene las mismas novedades que CHANGELOG.md en [Unreleased]" >&2
  exit 1
}

npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
TODAY=$(date +%Y-%m-%d)
for f in CHANGELOG.md CHANGELOG.en.md; do
  awk -v v="$VERSION" -v d="$TODAY" '
    /^## \[Unreleased\]/ { print; print ""; print "## [" v "] - " d; next }
    { print }
  ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done

git add package.json package-lock.json CHANGELOG.md CHANGELOG.en.md
git commit -m "Release v$VERSION"
git tag -a "v$VERSION" -m "Bookloft $VERSION"
git push origin main "v$VERSION"
echo "Publicado v$VERSION. GitHub Actions creará la release con el APK en unos minutos."
