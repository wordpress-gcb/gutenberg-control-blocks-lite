---
slug: headless/registry
title: Block registry
section: Headless rendering
order: 3
---

A registry maps a block name (string) to a React component. Walk the parsed tree, look each block up, render it. That's the whole dispatch layer.

## Define

```js
// components/registry.js
import SaasBanner       from './SaasBanner';
import SaasProjects     from './SaasProjects';
import SaasTestimonials from './SaasTestimonials';

export const WP_BLOCK_REGISTRY = {
  'gcb/saas-banner':       SaasBanner,
  'gcb/saas-projects':     SaasProjects,
  'gcb/saas-testimonials': SaasTestimonials,
};
```

## The renderer

A simple recursive component that walks the tree and dispatches:

```jsx
import { WP_BLOCK_REGISTRY } from './registry';

export function BlockRenderer({ blocks = [] }) {
  return blocks.map((block, i) => {
    if (!block.blockName) {
      // Freeform HTML or core blocks we don't override — pass through.
      return <div key={i} dangerouslySetInnerHTML={{ __html: block.innerHTML }} />;
    }

    const Component = WP_BLOCK_REGISTRY[block.blockName];
    if (!Component) return null; // or fall back to plugin render

    return (
      <Component
        key={i}
        attributes={block.attrs}
        innerBlocks={block.innerBlocks}
      />
    );
  });
}
```

## Handling core blocks

For core blocks like `core/columns` or `core/heading`, you can either:

1. **Render via your own components** — register them in the same registry. The gcb-next-starter does this for `core/columns` so it emits Bootstrap grid markup.
2. **Pass through** — render `innerHTML` as-is. Works for prose blocks but breaks for blocks whose markup needs your theme's classnames.
3. **Ask the plugin to render** — call `renderBlocksViaPlugin(blocks)` for any block your registry doesn't cover. The plugin's render-batch endpoint either runs the block's `render.php` or recurses back to your component server.

> The starter uses option 3 as a fallback — anything not in the registry is rendered by the plugin and the HTML is dangerously set into a wrapper div. That way you can adopt blocks one at a time.
