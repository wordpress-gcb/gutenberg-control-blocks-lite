#!/usr/bin/env bash
#
# Seed the /all-fields demo page on a remote (or local) WordPress.
#
# Usage:
#
#   Local (Valet etc., wp-cli on $PATH, run from anywhere):
#     bash playground/seed-all-fields.sh
#
#   Local with a specific path:
#     bash playground/seed-all-fields.sh --path=/Users/me/sites/mysite
#
#   Remote via SSH (Kinsta-style):
#     bash playground/seed-all-fields.sh --ssh=user@host --path=/www/site
#
# Behaviour:
#   - The PHP that does the actual seeding lives in seed-all-fields.php
#     beside this script. It's idempotent: re-running updates the same
#     row rather than duplicating.
#   - For SSH runs, the PHP is copied to the remote /tmp dir, evaluated,
#     and removed. No persistent artefacts left behind.
#
# Requires:
#   - wp-cli installed on the target environment
#   - GCB Lite plugin + theme active (the seed references the gcb/
#     field-showcase block + the demo theme's bundled images)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHP_FILE="$SCRIPT_DIR/seed-all-fields.php"

if [ ! -f "$PHP_FILE" ]; then
    echo "ERROR: $PHP_FILE not found." >&2
    exit 1
fi

SSH=""
WP_PATH=""
for arg in "$@"; do
    case "$arg" in
        --ssh=*)  SSH="${arg#--ssh=}" ;;
        --path=*) WP_PATH="${arg#--path=}" ;;
        --help|-h)
            sed -n '3,30p' "${BASH_SOURCE[0]}"
            exit 0
            ;;
        *)
            echo "Unknown arg: $arg" >&2
            exit 1
            ;;
    esac
done

if [ -n "$SSH" ]; then
    REMOTE_PHP="/tmp/gcb-seed-all-fields-$$.php"
    echo "→ Copying $PHP_FILE to $SSH:$REMOTE_PHP"
    scp -q "$PHP_FILE" "$SSH:$REMOTE_PHP"
    PATH_FLAG=""
    [ -n "$WP_PATH" ] && PATH_FLAG="--path=$WP_PATH"
    echo "→ Running wp eval-file via SSH"
    # shellcheck disable=SC2029
    ssh "$SSH" "wp eval-file $REMOTE_PHP $PATH_FLAG; rm -f $REMOTE_PHP"
else
    PATH_FLAG=""
    [ -n "$WP_PATH" ] && PATH_FLAG="--path=$WP_PATH"
    echo "→ Running wp eval-file locally"
    # shellcheck disable=SC2086
    wp eval-file "$PHP_FILE" $PATH_FLAG
fi
