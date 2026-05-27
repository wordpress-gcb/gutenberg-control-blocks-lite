#!/usr/bin/env bash
#
# Convenience wrapper around `wp gcblite seed-showcase`.
#
# The seed itself is a real WP-CLI command shipped by the plugin —
# you can run it directly:
#
#   wp gcblite seed-showcase                       # local
#   ssh user@host 'wp gcblite seed-showcase'       # remote
#
# This wrapper just adds optional --ssh + --path conveniences so the
# usage looks consistent with build-plugin.sh / build-theme.sh.

set -euo pipefail

SSH=""
WP_PATH=""
for arg in "$@"; do
    case "$arg" in
        --ssh=*)  SSH="${arg#--ssh=}" ;;
        --path=*) WP_PATH="${arg#--path=}" ;;
        --help|-h)
            sed -n '3,15p' "${BASH_SOURCE[0]}"
            exit 0
            ;;
        *)
            echo "Unknown arg: $arg" >&2
            exit 1
            ;;
    esac
done

CMD="wp gcblite seed-showcase"
[ -n "$WP_PATH" ] && CMD="$CMD --path=$WP_PATH"

if [ -n "$SSH" ]; then
    echo "→ Running on $SSH"
    ssh "$SSH" "$CMD"
else
    echo "→ Running locally"
    $CMD
fi
