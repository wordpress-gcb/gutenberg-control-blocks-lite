#!/usr/bin/env bash
#
# Mirror the plugin's bundled demo theme into the two standalone theme
# repos. Source of truth is this plugin's examples/themes/gcb-saas-theme/.
#
#   ./playground/sync-themes.sh                  # local repos at ../../gcb-demo-theme and ../../gcb-saas-theme-headless
#   ./playground/sync-themes.sh --php=PATH       # override PHP variant repo path
#   ./playground/sync-themes.sh --headless=PATH  # override headless variant repo path
#   ./playground/sync-themes.sh --dry-run        # show what would change, don't write
#
# Stage-only: the script copies files and runs `git add`, but does NOT
# commit or push. You review with `git status` / `git diff` in each
# repo, then commit + push manually (push = auto-deploy to Kinsta).
#
# What's shared (synced to both repos):
#   blocks/*/block.json
#   blocks/*/block.fields.json
#   theme.json, header.php, footer.php, index.php, page.php, README.md
#
# PHP variant only (synced to gcb-demo-theme):
#   blocks/*/render.php
#   build/theme.css, build/theme.js
#   assets/
#   functions.php   (the plugin's bundled functions.php IS the PHP variant's)
#   style.css       (the plugin's bundled style.css IS the PHP variant's)
#
# Headless variant only (NEVER touched by this script):
#   functions.php   (stripped enqueue block — Vercel renders)
#   style.css       ("GCB SaaS Theme (Headless)" header)
#
# The headless variant's functions.php diverges from the canonical copy
# in well-defined ways (no theme.css/theme.js enqueue, points readers
# at the PHP variant). Treat it as a one-time fork — only re-fork when
# CPT registration changes upstream.

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$PLUGIN_DIR/examples/themes/gcb-saas-theme"

# Default repo paths assume both standalone repos sit next to the WP
# install at ~/sites/. Override with --php / --headless if your layout
# differs.
PHP_REPO="$(cd "$PLUGIN_DIR/../../../.." && pwd)/gcb-demo-theme"
HEADLESS_REPO="$(cd "$PLUGIN_DIR/../../../.." && pwd)/gcb-saas-theme-headless"
DRY_RUN=""

for arg in "$@"; do
    case "$arg" in
        --php=*)      PHP_REPO="${arg#--php=}" ;;
        --headless=*) HEADLESS_REPO="${arg#--headless=}" ;;
        --dry-run)    DRY_RUN="--dry-run" ;;
        --help|-h)
            sed -n '3,33p' "${BASH_SOURCE[0]}"
            exit 0
            ;;
        *)
            echo "Unknown arg: $arg" >&2
            echo "Run with --help for usage." >&2
            exit 1
            ;;
    esac
done

if [ ! -d "$SOURCE" ]; then
    echo "ERROR: source theme dir not found: $SOURCE" >&2
    exit 1
fi

for repo in "$PHP_REPO" "$HEADLESS_REPO"; do
    if [ ! -d "$repo/.git" ]; then
        echo "ERROR: not a git repo: $repo" >&2
        echo "Override with --php=PATH or --headless=PATH if your repos live elsewhere." >&2
        exit 1
    fi
done

# Bail if either standalone repo has uncommitted local edits we'd
# otherwise overwrite. The user can stash or commit those first, then
# re-run. We don't want to silently swallow somebody's WIP.
check_clean() {
    local repo="$1"
    if ! git -C "$repo" diff --quiet --ignore-submodules HEAD 2>/dev/null; then
        echo "ERROR: $repo has uncommitted local changes. Commit or stash first." >&2
        git -C "$repo" status --short
        exit 1
    fi
}
check_clean "$PHP_REPO"
check_clean "$HEADLESS_REPO"

# Shared rsync flags. --delete so the standalone repos drop files the
# plugin no longer ships (e.g. if a block gets removed). Excludes keep
# .git and per-variant files (LICENSE, the variant's own style.css /
# functions.php where applicable) out of the picture. Verbose only in
# dry-run mode — the real run lets `git status` do the talking.
# `-c` compares by checksum, not mtime — rsync otherwise reports every
# file as changed because the bundled copy has fresh mtimes from being
# part of the plugin checkout. Slower, but the diff afterwards reflects
# only files whose contents actually changed.
RSYNC_BASE=(rsync -ac --delete
    --exclude='.git'
    --exclude='.github'
    --exclude='.gitignore'
    --exclude='LICENSE'
    --exclude='.DS_Store'
)
[ -n "$DRY_RUN" ] && RSYNC_BASE+=(--itemize-changes --dry-run)

echo "→ Source:   $SOURCE"
echo "→ PHP:      $PHP_REPO"
echo "→ Headless: $HEADLESS_REPO"
[ -n "$DRY_RUN" ] && echo "  (dry run)"
echo ""

# --- PHP variant: full mirror ----------------------------------------
# The plugin's bundled functions.php IS the PHP variant's. style.css
# header values also match. Both get copied straight across.
echo "→ Syncing → PHP variant ($PHP_REPO)"
"${RSYNC_BASE[@]}" "$SOURCE/" "$PHP_REPO/"

# --- Headless variant: filtered mirror -------------------------------
# Strip render.php, build/, assets/ — Vercel handles render + styling.
# Preserve the headless variant's own functions.php and style.css.
#
# Exception: field-showcase/render.php is kept even on the headless
# variant. It's a demo + QA block with no React equivalent — without
# render.php WP would defer rendering to the component server (Vercel),
# but Vercel has no FieldShowcase implementation that can render from
# attributes alone (the visible markup depends on per-field-type
# server logic that lives in PHP). Shipping the render.php on both
# variants keeps /all-fields working without a parallel React port.
echo "→ Syncing → headless variant ($HEADLESS_REPO)"
"${RSYNC_BASE[@]}" \
    --include='blocks/field-showcase/render.php' \
    --exclude='blocks/*/render.php' \
    --exclude='build/' \
    --exclude='assets/' \
    --exclude='functions.php' \
    --exclude='style.css' \
    "$SOURCE/" "$HEADLESS_REPO/"

if [ -n "$DRY_RUN" ]; then
    echo ""
    echo "Dry run complete. Re-run without --dry-run to apply."
    exit 0
fi

# Stage everything so the diff is easy to review.
git -C "$PHP_REPO" add -A
git -C "$HEADLESS_REPO" add -A

echo ""
echo "=== gcb-demo-theme (PHP) ==="
git -C "$PHP_REPO" status --short
echo ""
echo "=== gcb-saas-theme-headless ==="
git -C "$HEADLESS_REPO" status --short
echo ""
echo "Done. Review with 'git diff --cached' in each repo, then commit + push to deploy."
