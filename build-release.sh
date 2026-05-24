#!/usr/bin/env bash
#
# Builds a release zip ready for the wp.org SVN tag.
#
# Why this exists: wp.org wants vendor/ shipped (so the plugin runs
# standalone), but our git repo has vendor/ gitignored. This script
# installs production composer deps, builds the editor JS bundle,
# stages a clean directory using .distignore, and zips it.
#
# Usage:
#   bash build-release.sh
#
# Output: ./dist/gcb-lite-<version>.zip
# Requires: composer, npm, rsync, zip.

set -euo pipefail

# Read version from the plugin header. Single source of truth.
VERSION=$(awk -F': *' '/^[[:space:]]*\*[[:space:]]*Version:/ {gsub(/[[:space:]]/,"",$2); print $2; exit}' gcb-lite.php)
if [ -z "$VERSION" ]; then
  echo "Could not read Version from gcb-lite.php" >&2
  exit 1
fi

NAME="gcb-lite"
SLUG="${NAME}-${VERSION}"
STAGE="dist/${SLUG}"
ZIP="dist/${SLUG}.zip"

echo "==> Building ${SLUG}"

# Build the editor JS (writes to build/).
echo "==> npm run build"
npm run build

# Install production composer deps into vendor/.
echo "==> composer install --no-dev"
composer install --no-dev --optimize-autoloader

# Stage the release directory using .distignore as the exclude list.
echo "==> Staging ${STAGE}"
rm -rf dist
mkdir -p "${STAGE}"

# rsync with --exclude-from for the .distignore patterns.
rsync -a \
  --exclude-from='.distignore' \
  --exclude='dist' \
  ./ "${STAGE}/"

# Sanity: confirm vendor/ made it into the stage.
if [ ! -f "${STAGE}/vendor/autoload.php" ]; then
  echo "ERROR: vendor/autoload.php missing from staged release." >&2
  exit 1
fi

# Sanity: confirm src/ did NOT.
if [ -d "${STAGE}/src" ]; then
  echo "ERROR: src/ should not be in the release (only build/ ships)." >&2
  exit 1
fi

echo "==> zipping ${ZIP}"
( cd dist && zip -qr "${SLUG}.zip" "${SLUG}" )

# Restore dev dependencies for normal development.
echo "==> composer install (restoring dev deps)"
composer install --quiet

echo ""
echo "Done. Release ready at:"
echo "  $(pwd)/${ZIP}"
echo ""
echo "Next: extract this zip into your wp.org SVN /trunk and tag /tags/${VERSION}."
