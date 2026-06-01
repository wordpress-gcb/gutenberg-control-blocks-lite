---
slug: headless/parser
title: Block parser
section: Headless rendering
order: 2
---

WordPress stores a page as a sequence of HTML comments wrapped around their rendered HTML. To get back to a tree of typed attributes you parse that markup with the same library Gutenberg uses on the server.

## Parse

Same block markup; same tree shape. The Node side uses the official `@wordpress/block-serialization-default-parser` package. The PHP side uses WP core's `parse_blocks()`.

:::codetabs
```js
// npm i @wordpress/block-serialization-default-parser
import { parse } from '@wordpress/block-serialization-default-parser';

const tree = parse(`
  <!-- wp:gcb/banner {"heading":{"text":"Hi","level":"h1"}} /-->
  <!-- wp:gcb/blog {"count":3} /-->
`);

// tree[0] === { blockName: 'gcb/banner', attrs: { ... }, innerBlocks: [], ... }
// tree[1] === { blockName: 'gcb/blog',   attrs: { count: 3 }, innerBlocks: [], ... }
```
```php
<?php
// WP core ships parse_blocks() — no extra install needed.
$tree = parse_blocks('
  <!-- wp:gcb/banner {"heading":{"text":"Hi","level":"h1"}} /-->
  <!-- wp:gcb/blog {"count":3} /-->
');

// $tree[0] === [
//   'blockName'   => 'gcb/banner',
//   'attrs'       => [ 'heading' => [...] ],
//   'innerBlocks' => [],
//   ...
// ]
```
:::

## The block shape

```ts
type Block = {
  blockName:    string | null;   // 'gcb/banner', 'core/columns', null for HTML
  attrs:        Record<string, any>;
  innerBlocks:  Block[];
  innerHTML:    string;          // HTML between wrapping comments
  innerContent: (string | null)[];
};
```

> Block markup IS HTML, so freeform HTML between blocks (raw text, custom HTML blocks) shows up as blocks with `blockName: null`. Skip them in your renderer or render their `innerHTML` as-is.

## Attribute defaults

WP only persists attributes that DIFFER from the registered defaults. So `attrs` from the parser will be missing keys an empty block actually has. Fetch the defaults from `/wp-json/gcblite/v1/blocks` and merge them in:

```js
import { getBlockDefaults } from '@/lib/wpRestClient';

const defaults = await getBlockDefaults();
// defaults['gcb/banner'] === { heading: { text: '', level: 'h1' }, body: '...' }

const merged = { ...defaults[block.blockName], ...block.attrs };
```

> gcb-next-starter does this for you in `app/[...slug]/page.jsx`. If you fork the starter you don't need to think about it.

## Styling core blocks (cover, group, columns, patterns)

If authors insert anything beyond paragraph / heading / list — a cover, group, columns, or a pattern from the inserter — your frontend needs WordPress's own block stylesheet. Without it the markup ships but cover backgrounds, group padding, button styles, and image aspect ratios all evaluate to nothing because the `.wp-block-*` selectors aren't styled on your origin.

The CSS WordPress uses to render those blocks lives at:

```
{your-wp-origin}/wp-includes/css/dist/block-library/style.min.css
```

Link it from your root layout:

```jsx
<link
  rel="stylesheet"
  href={`${process.env.NEXT_PUBLIC_WP_URL}/wp-includes/css/dist/block-library/style.min.css`}
/>
```

You get version-matched core styles without bundling anything — when WP updates, your frontend updates too because the URL is canonical.

> gcb-next-starter does this in `app/layout.jsx` for you. If your block library is gcb/* only — no core layout blocks, no patterns — delete the `<link>` and your page weight drops by a few hundred KB.

### Container blocks (cover, group)

Container blocks store their shell HTML in `innerContent` as an array with `null` placeholders where each child block goes, and the children themselves in `innerBlocks`. Reading `block.innerHTML` directly gives you the shell with the children stripped out — that's why a cover block renders as an empty inner-container.

To reassemble, walk `innerContent`: keep string segments verbatim, substitute each `null` with the corresponding child block's recursively-rendered HTML. gcb-next-starter's `BlockRenderer.jsx` does this for you via the `reconstructHtml` helper; if you fork the rendering layer, port the same logic.
