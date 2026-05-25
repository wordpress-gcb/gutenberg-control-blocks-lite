#!/usr/bin/env bash
#
# Build the gcb-lite plugin zip for the Playground demo.
#
# Run from the plugin root:
#   bash playground/build-plugin.sh
#
# Output: playground/dist/gcb-lite.zip
# Committed to the repo so jsdelivr can serve it (raw.githubusercontent
# strips CORS on binary content; jsdelivr doesn't).
#
# Different from build-release.sh: this zip is for the Playground "try
# it" link, which needs the example blocks bundled (they're the demo).
# build-release.sh builds the wp.org SVN release, which uses .distignore
# to leave examples/ out by default.

set -euo pipefail

DIST_DIR="playground/dist"
ZIP_NAME="gcb-lite.zip"
STAGE_DIR="${DIST_DIR}/gcb-lite"

mkdir -p "${DIST_DIR}"
ABS_ZIP="$(pwd)/${DIST_DIR}/${ZIP_NAME}"
rm -f "${ABS_ZIP}"
rm -rf "${STAGE_DIR}"

# Install production composer deps so vendor/ gets staged. The plugin's
# main file does `require vendor/autoload.php` and the autoload section
# of composer.json wires up PSR-4 for includes/, so we need the
# generated autoloader.
composer install --no-dev --quiet --optimize-autoloader

rsync -a \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.vscode' \
  --exclude='node_modules' \
  --exclude='tests' \
  --exclude='dist' \
  --exclude='playground' \
  --exclude='.distignore' \
  --exclude='.DS_Store' \
  --exclude='.gitignore' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='composer.json' \
  --exclude='composer.lock' \
  --exclude='src' \
  --exclude='build-release.sh' \
  --exclude='phpunit.xml*' \
  --exclude='phpcs.xml' \
  --exclude='*.test.js' \
  ./ "${STAGE_DIR}/"

(cd "${DIST_DIR}" && zip -rq "${ZIP_NAME}" "gcb-lite" -x '*/.DS_Store')
rm -rf "${STAGE_DIR}"

echo "✓ Built ${DIST_DIR}/${ZIP_NAME}"
ls -la "${DIST_DIR}/${ZIP_NAME}"
