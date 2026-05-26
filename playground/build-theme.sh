#!/usr/bin/env bash
#
# Build the gcb-saas-theme theme zip for the Playground demo.
#
# Run from the plugin root:
#   bash playground/build-theme.sh
#
# Output: playground/dist/gcb-saas-theme.zip
# The zip is committed to the repo so jsdelivr can serve it via the
# same CORS-friendly path the plugin uses (raw.githubusercontent.com
# strips CORS on binary content).

set -euo pipefail

SOURCE_DIR="examples/themes/gcb-saas-theme"
DIST_DIR="playground/dist"
ZIP_NAME="gcb-saas-theme.zip"

if [ ! -d "${SOURCE_DIR}" ]; then
  echo "Source not found at ${SOURCE_DIR} (run from plugin root)" >&2
  exit 1
fi

mkdir -p "${DIST_DIR}"
ABS_ZIP="$(pwd)/${DIST_DIR}/${ZIP_NAME}"
rm -f "${ABS_ZIP}"

# Zip from the parent of the theme dir so the archive contains
# `gcb-saas-theme/...` as a top-level dir (what WP expects).
SOURCE_PARENT="$(dirname "${SOURCE_DIR}")"
SOURCE_BASENAME="$(basename "${SOURCE_DIR}")"

(cd "${SOURCE_PARENT}" && zip -rq "${ABS_ZIP}" "${SOURCE_BASENAME}" \
  -x '*.DS_Store' '*/.git/*' '*/node_modules/*')

echo "✓ Built ${DIST_DIR}/${ZIP_NAME}"
ls -la "${DIST_DIR}/${ZIP_NAME}"
