---
slug: ai
title: AI workflows
section: AI workflows
order: 1
---

WordPress 7.0 provides a standardized function-calling API for AI agents [Abilities API](https://make.wordpress.org/core/), and gcb-lite exposes Gutenberg blocks through that API so an AI can discover available blocks, fill in their fields, preview them, and save them to WordPress using validated schemas rather than guessing or automating the admin UI.


> WP core ships the bus (`/wp-json/wp-abilities/v1/…`), not a chat UI. The wp-admin chat sidebar you might be picturing is plugin territory — gcb-lite registers the typed actions; any AI client (Claude Desktop, a custom agent, a WP chat plugin like AI Engine) can discover and call them.

## Abilities we register

Three abilities under the `gcblite` category. The Abilities API exposes them at `/wp-json/wp-abilities/v1/abilities/{name}/run` — POST for actions with side effects, GET for read-only data. The input always nests under an `input` key.

### `gcblite/list-blocks`

Returns every registered `gcb/*` block on the site, with each block's attribute schema and defaults. Use this first to discover what's available before composing or rendering anything.

```bash
curl -X POST https://your-site.com/wp-json/wp-abilities/v1/abilities/gcblite/list-blocks/run \
  -H "Content-Type: application/json" \
  -d '{ "input": {} }'
```

Response:

```json
{
  "blocks": {
    "gcb/saas-banner": {
      "attributes": {
        "eyebrow":  { "type": "string", "default": "" },
        "heading":  { "type": "string", "default": "Built with GCB" },
        "cta_url":  { "type": "object", "default": { "url": "", "text": "" } },
        "...": "..."
      }
    },
    "gcb/saas-projects":     { "attributes": { /* ... */ } },
    "gcb/field-showcase":    { "attributes": {} }
  }
}
```

Permission: `__return_true` — the schema is the same thing the editor already exposes to logged-in authors and isn't sensitive.

### `gcblite/render-block`

Renders a single block to HTML server-side. Either runs the block's `render.php` (if one exists) or fetches the React component-server's SSR output. Same code path as the editor preview. Returns the rendered HTML plus any wrapper attributes the renderer asked for.

```bash
curl -X POST https://your-site.com/wp-json/wp-abilities/v1/abilities/gcblite/render-block/run \
  -H "Content-Type: application/json" \
  -d '{ "input": {
    "blockName": "gcb/saas-banner",
    "attributes": {
      "eyebrow": "Beta",
      "heading": "Typed Gutenberg fields from a JSON file"
    }
  }}'
```

Permission: `edit_posts` — render performs an outbound HTTP call to the component server and writes a transient cache, so it's gated against anonymous abuse.

### `gcblite/get-control-docs`

Returns the structured documentation for a single control type — description, stored shape, supports list, config options, gotchas, example. Same canonical source as the docs site (one markdown file per control under `schemas/controls/`).

Read-only, so use GET. Pass `input[type]=color` for a specific control, or omit `type` to list every documented control.

```bash
# Get one control's full reference
curl 'https://your-site.com/wp-json/wp-abilities/v1/abilities/gcblite/get-control-docs/run?input%5Btype%5D=color'

# List every documented type
curl 'https://your-site.com/wp-json/wp-abilities/v1/abilities/gcblite/get-control-docs/run'
```

Response (with `type=color`):

```json
{
  "docs": {
    "type": "color",
    "description": "Color picker pulling its palette from the active theme.json...",
    "stored": "string — hex like \"#5956E9\", a theme palette slug, or a CSS gradient string...",
    "supports": [ "Theme palettes...", "Gradients...", "Dual-attribute mode..." ],
    "configOptions": [
      { "name": "showGradients", "type": "boolean", "default": false, "description": "..." }
    ]
  }
}
```

Permission: open. The docs are published anyway; no point gating the API behind auth when an LLM could just scrape the docs site instead.

## The agent loop

A useful pattern an agent can run end-to-end:

1. **Discover** — call `gcblite/list-blocks`. Now the agent knows the block menu and each block's typed shape.
2. **Compose** — pick a block + attribute values that fit the user's ask. The schema constrains what the LLM can output; invalid attribute shapes get caught by the input validator on the call below.
3. **Preview** — call `gcblite/render-block` to get the HTML back without writing to the database. Show it to the user, ask "does this look right?"
4. **Persist** — once approved, the agent uses `wp/v2/<post-type>` to write the composed block markup into a post or page. This step is plain WP REST, no ability needed.

The Abilities API gives you a stop-checking-types-and-just-call-it primitive on top of WP's usual REST endpoints. Everything an LLM sends is validated against the registered `input_schema`; everything it gets back conforms to `output_schema`. No hallucination-driven 500s.

## Schemas as prompt context

Every `block.fields.json` in your theme is plain JSON on disk. That's deliberate — it means an LLM with file access (Cursor, Claude with the filesystem tool, an MCP client with file-tools) can read your block schemas as part of its prompt without needing to call an API.

Pattern: paste a `block.fields.json` into the model and ask it to write the matching React component. The schema defines exactly what props it'll receive (control `attributeKey`s become prop names; stored value shapes documented in `schemas/controls/{type}.json` tell it what each prop looks like). Short, structured prompt in, working component out.

## MCP clients

Model Context Protocol clients (Claude Desktop, etc.) discover WordPress abilities via a compatible MCP adapter plugin. We don't ship one — there are several to choose from in the plugin ecosystem already, and they all read the same `/wp-abilities/v1` registry. Install one, point the client at your site, and our two abilities appear alongside whatever else is registered.

> **Auth:** `gcblite/render-block` requires `edit_posts`. MCP clients calling it need application passwords (or equivalent) attached. The list endpoint is unauthenticated; the run endpoint isn't.

## Registering your own abilities

Your theme or a companion plugin can register more abilities the same way — anything that operates on gcb-lite blocks (publish flow, content audit, bulk re-render, etc.) is a natural fit. Standard `wp_register_ability()` call inside the `wp_abilities_api_init` action.

```php
add_action('wp_abilities_api_init', function () {
    wp_register_ability('mytheme/publish-with-banner', [
        'label'        => 'Publish post with banner',
        'description'  => 'Compose a post + a gcb/saas-banner header in one go.',
        'category'     => 'gcblite',
        'input_schema' => [
            'type'       => 'object',
            'properties' => [
                'title'   => [ 'type' => 'string' ],
                'eyebrow' => [ 'type' => 'string' ],
            ],
            'required'   => ['title'],
        ],
        'output_schema'    => [
            'type'       => 'object',
            'properties' => [ 'post_id' => [ 'type' => 'integer' ] ],
        ],
        'execute_callback' => function ($input) {
            // Compose markup, wp_insert_post, return id.
        },
        'permission_callback' => function () {
            return current_user_can('publish_posts');
        },
    ]);
});
```

## Why this matters

WP shipped a typed function bus. That solves the "how does an AI call WordPress" problem at the protocol layer. The question becomes: *what do the typed functions actually operate on?* Core attributes are `string`, `number`, `boolean`, `object`, `array`. Useful, but blunt. An LLM generating an `object` isn't generating an image-with-focal-point or a repeater of testimonials.

gcb-lite's typed-field layer is the structured schema an AI agent needs to compose against. The Abilities API is the callable surface. Together: an agent can list available blocks, compose one with real focal points and gallery items and post-object references, preview it, and ship it — without your site shipping an ounce of bespoke AI code.

> **Building blocks with AI (Pro).** The Abilities API above is the *agent-facing*
> surface — for external AI clients to call existing blocks. Separately, **GCB
> Pro** ships an in-admin **AI block builder**: a chat where you describe a block
> in plain language and it designs the fields (and a starter `render.php`),
> grounded in your site's theme tokens, post types and taxonomies, and able to
> work from a reference image. That's a human-facing authoring tool, distinct
> from the typed bus described here.
