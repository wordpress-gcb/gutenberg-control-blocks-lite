---
type: layout
title: layout
section: Field reference
order: 22
description: 'How a list''s items sit on a wide screen — an advanced "cards per row". Its columns, and boxes placed on them: each box stands where it was put (never over another), one to three rows tall. The list''s items take the boxes in reading order; after the last box the drawn rows repeat, so an item added later takes the next box. Opens as a small popover from the sidebar: drag a box to move it, drag its corner to resize it, click an empty cell to add one. Only the items'' places change; their markup is the design''s. Put it on the LIST (the repeater''s block), never on an item.'
stored: 'object — { cols: number, boxes: [ { x: number, y: number, w: number, h: number } ], phone: 1 | 2, minPx?: number } — x and y from 0; w and h in columns and rows (h 1–3); at most 48 boxes; minPx the list''s own narrowest item'
supports:
  - 'Columns — 1 to 12 (or the list''s minCols / maxCols). More columns are a finer grid, not narrower items: each item spans at least as many columns as the narrowest it may be needs (minItemPx against containerPx and gapPx; a person can set their own narrowest, stored as minPx). A box narrower than that is refused, and changing the columns rescales the boxes where they stand.'
  - 'Phones — 1 or 2 per row below 782px; the boxes are for 1024px and wider. Between, the design''s own classes stand.'
  - 'A short form for the AI — `cols 4; at 1,1 2x2 | 3,1 1x1 | 4,1 1x1 | 3,2 2x1; phone 1` (each box where it stands, from 1) or `cols 4; sizes 2x2 1 1 2` (sizes only, placed at the first free spot); `min 300` sets the narrowest item in px. A request the list cannot take is refused with its reason (src/controls/layout-value.js fromShort).'
  - 'Render — `\GCBLite\Contract\Fields::layout_css($value, $limits, $count, $listSelector, $itemSelector)` gives the CSS that places the list''s items (`%d` in the item selector is the item''s place, from 1); the editor places them live from the same value.'
configOptions:
  - name: cols
    type: number
    description: 'The drawn columns: where a list with nothing stored starts, one box each, in one row. A value that is just this lays nothing out — the design stands.'
  - name: minCols
    type: number
    default: 1
    description: 'The fewest columns the list may have.'
  - name: maxCols
    type: number
    description: 'The most columns the list may have; 12 without it.'
  - name: minItemPx
    type: number
    description: 'The narrowest an item may be, in px: at each column count, the fewest columns an item spans.'
  - name: containerPx
    type: number
    description: 'The list''s width on a wide screen, in px (1200 without it), for an item''s fewest columns.'
  - name: gapPx
    type: number
    description: 'The gap between items, in px.'
gotchas:
  - 'It lays out the list''s DIRECT items: the repeater''s inner blocks in the editor, the list''s children on the page.'
  - 'A box wider than the columns, a box over another, or columns past the limits make the value unsound: it renders as the drawn layout and the editor says why.'
example: |
  { "id": "ctrl_cards_layout",
    "type": "layout",
    "label": "Layout",
    "attributeKey": "layout",
    "cols": 3,
    "minItemPx": 240,
    "containerPx": 1104,
    "gapPx": 16 }
---
