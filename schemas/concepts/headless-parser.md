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
