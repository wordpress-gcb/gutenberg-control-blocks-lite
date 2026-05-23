/**
 * Editor-only CSS overrides served as a stable URL.
 *
 *   GET /wordpress/editor.css
 *
 * Loaded by the plugin via enqueue_block_editor_assets — i.e. only inside
 * the WordPress block editor (canvas iframe). It does NOT ship to the
 * public frontend, where these overrides would change behaviour (e.g.
 * forcing accordions open).
 *
 * Everything here is scoped to `.editor-styles-wrapper` (the canvas root
 * class that WP applies inside the editor iframe).
 *
 * Why we serve this from a route rather than a static file:
 *   - Lives next to the components that need editor-only treatment.
 *   - Future editor-only overrides can be added without touching the plugin.
 */

export const dynamic = 'force-dynamic';

const CSS = `
/*
 * Force-open Radix accordion items in the editor.
 *
 * The editor preview is static SSR — no client-side hydration runs, so
 * Radix's "click to toggle" handler is never attached. Accordions render
 * with data-state="closed" and would stay invisible.
 *
 * The closed state is what we have to override. Radix sets data-state="closed"
 * on every element in the item chain (item, header, trigger, content). Our
 * AccordionItem uses Tailwind's data-[state=closed]:hidden on the Content
 * element, which compiles to a rule like
 *     .data-\\[state\\=closed\\]\\:hidden[data-state="closed"] { display: none }
 * We need a more-specific rule that wins.
 */
.editor-styles-wrapper [data-state="closed"] {
  /* Keep Radix Content visible even when "closed". */
}

/*
 * Make sure the Content panel is actually visible, regardless of which
 * variant of hide-when-closed the component used. Two layered overrides:
 *
 *   1. Untoggle Tailwind's display:none (data-[state=closed]:hidden).
 *      We target the specific compiled class name plus the state attr so
 *      we don't accidentally reveal other Radix primitives that legitimately
 *      hide on close.
 *
 *   2. Force the implicit \`height: 0\` Radix sets via CSS vars.
 */
.editor-styles-wrapper .\\[data-state\\=closed\\]\\:hidden[data-state="closed"],
.editor-styles-wrapper .data-\\[state\\=closed\\]\\:hidden[data-state="closed"] {
  display: block !important;
}

/*
 * Radix uses --radix-accordion-content-height for the open height. In the
 * static SSR HTML the height defaults to 0 because the JS hasn't measured
 * the content yet. Override to auto so the content takes its natural size.
 */
.editor-styles-wrapper [data-state="closed"][role="region"],
.editor-styles-wrapper [data-state="closed"].overflow-hidden {
  height: auto !important;
  overflow: visible !important;
}

/*
 * Rotate the chevron to its open position so the visual matches the open
 * state we've forced. Tailwind's group-data-[state=open]:rotate-180 only
 * fires when the trigger has data-state="open" — which it doesn't, in SSR.
 */
.editor-styles-wrapper [data-state="closed"] .lucide-chevron-down {
  transform: rotate(180deg);
}
`.trim();

export function GET() {
  return new Response(CSS, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
