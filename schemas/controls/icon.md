---
type: icon
title: icon
section: Field reference
order: 53
description: 'Visual picker over the WP 7.0+ icon registry. Authors pick from a searchable grid; storage is just the icon name. The server resolves to SVG at render time via `WP_Icons_Registry`.'
stored: '{ source: "wp", name: string }'
supports:
  - Searchable grid of icons from the WP icon registry
  - 'Namespace filter — only show icons whose name starts with `${namespace}/`'
  - 'Explicit allow-list via `filter` for hand-curated subsets'
  - 'Backwards-compat read of v1 dashicon values: `{ source: "dashicon", icon }` still renders, but the picker only writes the new `{ source: "wp", name }` shape.'
configOptions:
  - name: namespace
    type: string
    description: 'Restrict the picker to icons whose name starts with `${namespace}/`. Forward-compat with WP 7.1''s `register_block_icon` API.'
  - name: filter
    type: string[]
    description: 'Explicit allow-list of full icon names. Takes precedence over `namespace`. Use for hand-curated subsets per block.'
gotchas:
  - 'Requires WP 7.0+. On older WP the REST endpoint 404s and the picker shows a "needs WordPress 7.0" message.'
  - 'On vanilla WP 7.0 only `core/*` icons are registered; a `namespace: "icomoon"` filter is a no-op until something registers icons under that namespace.'
  - 'Storage is just the name — render.php must call into the icon registry server-side to get the actual SVG. Don''t store SVG content in post_content.'
example: |
  { "id": "ctrl_marker",
    "type": "icon",
    "label": "Bullet icon",
    "attributeKey": "marker",
    "namespace": "core",
    "parentPanelId": "panel" }
---
