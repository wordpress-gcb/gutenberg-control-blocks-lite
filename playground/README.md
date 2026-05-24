# WordPress Playground demo

A [Playground](https://wordpress.github.io/wordpress-playground/) Blueprint
that boots a fresh WordPress install in the browser with gcb-lite plus four
demo blocks pre-installed and a demo page ready to edit.

## The "Try in your browser" link

Once this commit is on `main`, anyone can open the live demo at:

```
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/wordpress-gcb/gutenberg-control-blocks-lite/main/playground/blueprint.json
```

Visitor flow:
1. Click the link.
2. ~10–15 seconds of WASM boot + plugin install + demo-page seeding.
3. Lands directly in the block editor on the "GCB Lite Demo" page.
4. Can click any block (hero, three feature items, CTA) to see the
   typed-field Inspector on the right.
5. Everything is local to the browser tab — no backend, no persistence.

## What the Blueprint does

| Step | What it sets up |
|------|-----------------|
| `defineWpConfigConsts` | Adds `define('GCBLITE_LOAD_EXAMPLES', true);` to wp-config — opts the plugin's bundled `examples/blocks/` into block registration. |
| `installPlugin` | Pulls the latest gcb-lite release zip from GitHub and activates it. |
| `setSiteOptions` | Pretty permalinks + site title. |
| `runPHP` | Replaces WordPress's default Sample Page (ID 2) with a demo page composed from the four demo blocks. |

## Caveats

- **PHP-rendered blocks only.** Playground can't make outbound HTTP calls,
  so any block whose render path goes to an external Next.js / React
  frontend won't work here. The demo uses only the bundled `examples/blocks/`
  set, all of which use `render.php`.
- **No persistence.** Each visitor gets a fresh install. Changes are lost
  when the tab closes.
- **Pinned to v0.1.0.** The Blueprint references the `0.1.0` release zip
  by filename. Bump this when releasing a new tag.

## Testing the Blueprint locally

Before pushing changes here, paste the URL above into Playground and
verify the demo loads cleanly. The schema validator at
https://playground.wordpress.net/blueprint-schema.json catches structural
errors but the only way to confirm `runPHP` works is to run it.
