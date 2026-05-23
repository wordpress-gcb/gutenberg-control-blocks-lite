#!/usr/bin/env bash
#
# Seeds a "GCB Lite Demo" page with one of each test block. Lets anyone
# cloning the repo see the demo in one command instead of building the
# page block-by-block in wp-admin.
#
# Usage (from the WP install root, where you'd normally run wp-cli):
#   bash wp-content/plugins/gcb-lite/next-frontend-example/sample-content/seed-demo-page.sh
#
# Idempotent — if the page already exists it updates the existing one
# rather than creating a duplicate.
#
# Requires: WP-CLI on PATH, WP 6.x+, gcb-lite plugin active, component
# server running at localhost:3001 (or wherever GCBLITE_COMPONENT_SERVER_URL
# points), and the three test blocks registered (which happens
# automatically when gcb-lite + control-blocks-theme are both active).

set -euo pipefail

SLUG="gcb-lite-demo"
TITLE="GCB Lite Demo"

# Block markup for the page. Each <!-- wp:gcb/... --> matches a registered
# test block. Empty attrs object means "use defaults" — gcb-lite resolves
# defaults from the registered block schema, so the page renders meaningfully
# even though no attrs are saved.
read -r -d '' CONTENT <<'EOF' || true
<!-- wp:paragraph -->
<p>This page demonstrates the three reference blocks shipped with gcb-lite. Each one renders the same React component in the editor preview and on the public frontend.</p>
<!-- /wp:paragraph -->

<!-- wp:gcb/text-image {"heading":"One component, two contexts","eyebrow":"How it works"} /-->

<!-- wp:gcb/accordion-test {"heading":"Frequently asked questions"} -->
<!-- wp:gcb/accordion-test-item {"question":"What is gcb-lite?","answer":"A WordPress plugin that turns Gutenberg into a typed-field CMS for a React frontend."} /-->
<!-- wp:gcb/accordion-test-item {"question":"Do I have to use Next.js?","answer":"No. Your frontend just needs to expose one HTTP route that returns React-rendered HTML inside a wp-block-wrapper. Use anything that can SSR React — Astro, Express, vanilla Node."} /-->
<!-- /wp:gcb/accordion-test -->

<!-- wp:gcb/gallery-test {"heading":"Sample gallery"} /-->
EOF

# WP-CLI on PHP 8+ emits dynamic-property deprecation notices to stdout —
# we want only the ID, so suppress notices and isolate numeric output.
wp_quiet() {
  wp "$@" 2>/dev/null | grep -E '^[0-9]+$' | head -1 || true
}

EXISTING_ID="$(wp_quiet post list --post_type=page --name="${SLUG}" --field=ID --format=ids)"

if [ -n "${EXISTING_ID}" ]; then
  echo "Updating existing demo page (ID ${EXISTING_ID})..."
  wp post update "${EXISTING_ID}" --post_content="${CONTENT}" --post_title="${TITLE}" 2>/dev/null
  PAGE_ID="${EXISTING_ID}"
else
  echo "Creating new demo page..."
  PAGE_ID="$(wp_quiet post create --post_type=page --post_status=publish --post_name="${SLUG}" --post_title="${TITLE}" --post_content="${CONTENT}" --porcelain)"
fi

SITEURL="$(wp option get siteurl 2>/dev/null | tail -1)"

echo ""
echo "Done. Demo page available at:"
echo "  wp-admin edit:  ${SITEURL}/wp-admin/post.php?post=${PAGE_ID}&action=edit"
echo "  public:         ${SITEURL}/${SLUG}/"
echo ""
echo "If you're running the next-frontend-example to test (localhost:3001 by default):"
echo "  http://localhost:3001/${SLUG}"
