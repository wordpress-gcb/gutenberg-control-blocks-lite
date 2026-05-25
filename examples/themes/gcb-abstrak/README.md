# GCB Abstrak — demo theme

A WordPress theme that **only registers content**. It doesn't render
anything — the public site lives in a separate Next.js frontend
([`gcb-next-starter`](https://github.com/wordpress-gcb/gcb-next-starter))
that reads from this install's REST API.

Pair with the [gcb-lite](https://github.com/wordpress-gcb/gutenberg-control-blocks-lite)
plugin (required — registers the typed-field controls this theme attaches
to each CPT).

## What it ships

- **`project` CPT** — portfolio / case-study items, with `cover` image
  field + `live_url`. Categorised via the `project_category` taxonomy.
- **`testimonial` CPT** — single-quote records. `quote`, `author_name`,
  `author_role`, `author_image`, `from_label`, `from_logo`.
- **`brand` CPT** — logo strip entries. Just `logo` + `website`.
- **`theme.json`** — the Abstrak palette (Primary `#5956E9`, four
  gradients, full grayscale), DM Sans / Poppins typography, and a 7-step
  spacing scale. Block editor pickers (Colour, Font size, Spacing) all
  read from this.

## Install

In the Playground blueprint or any WordPress install, copy
`examples/themes/gcb-abstrak/` into `wp-content/themes/` and activate
it. The companion `gcb-lite` plugin must be active first.

## What's intentionally NOT here

- No PHP templates beyond a placeholder `index.php`. If you load the
  site root in a browser you'll see a "use the React frontend" page.
- No editor stylesheet — `theme.json` gives the block editor the right
  palette / fonts / sizes on its own.
- No header/footer template-parts. The React frontend owns layout.

If you want a fully WP-rendered demo (no React, server-rendered HTML)
that's a different theme — file an issue and let's discuss.
