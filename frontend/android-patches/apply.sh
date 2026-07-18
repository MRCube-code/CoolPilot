#!/usr/bin/env bash
# Run this once after `npx cap add android` (and again any time you delete
# and regenerate the android/ folder — `cap add android` doesn't know about
# this, it's not something Capacitor's own template includes since it's
# specific to talking to an unencrypted local backend).
#
# Usage: bash android-patches/apply.sh
set -euo pipefail

MANIFEST="android/app/src/main/AndroidManifest.xml"
XML_DIR="android/app/src/main/res/xml"
CONFIG_DEST="$XML_DIR/network_security_config.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "Error: $MANIFEST not found. Run 'npx cap add android' first, from the frontend/ directory." >&2
  exit 1
fi

mkdir -p "$XML_DIR"
cp "$(dirname "$0")/network_security_config.xml" "$CONFIG_DEST"
echo "Copied network_security_config.xml -> $CONFIG_DEST"

if grep -q 'android:networkSecurityConfig' "$MANIFEST"; then
  echo "AndroidManifest.xml already references a networkSecurityConfig — leaving it alone."
else
  # Capacitor's template always emits a single-line or multi-line
  # <application ...> opening tag starting with exactly "<application".
  # Insert the attribute right after that token, on its own line, right
  # before the following android:* attributes rather than depending on
  # any specific existing attribute being present to anchor against.
  sed -i.bak 's/<application/<application\n        android:networkSecurityConfig="@xml\/network_security_config"/' "$MANIFEST"
  rm -f "$MANIFEST.bak"
  echo "Patched $MANIFEST to reference @xml/network_security_config"
fi

echo "Done. Verify by opening $MANIFEST and $CONFIG_DEST if anything looks off."
