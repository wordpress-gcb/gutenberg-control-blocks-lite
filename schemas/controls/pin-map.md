---
type: pin-map
title: pin-map
section: Field reference
order: 13
description: 'A picture you click to place the block''s repeater children on — touchpoints on a site map, hotspots on a product shot. The field stores only the picture; the pins belong to real child blocks. Single mode: one `point` per child. Grouped mode (`pointsKey`): each child has a repeater field of locations, so one card can sit at several places (pins 03a, 03b …). Opens as a popover from the sidebar: click the image to add a pin, click a pin first to add another location to its card, drag a pin to move it, Edit selects that child, × removes it.'
stored: 'object — { id, url, alt, width, height }'
supports:
  - Media-library image chooser; the picture is drawn at its own aspect ratio so a click lands where the eye put it
  - Click to add a repeater child with its point set; drag or arrow-key a dot to move it; remove from the list
  - Each child's own `point` control drags over the same picture (it finds the parent's image)
configOptions:
  - name: childBlock
    type: string
    description: 'The child block the map places. Defaults to the block type scoped to this block by its <Repeater allowedBlocks> marker.'
  - name: pointKey
    type: string
    default: point
    description: The child attribute (a `point` field) that holds where it sits.
  - name: pointsKey
    type: string
    description: 'Grouped mode: the child''s `repeater` field of locations. Each row holds its own {x, y}; a card with several rows gets lettered pins. Turns grouped mode on (pointKey is then unused).'
  - name: rowPointKey
    type: string
    default: point
    description: 'Grouped mode: the `point` sub-field inside a location row.'
  - name: rowLabelKey
    type: string
    default: area
    description: 'Grouped mode: the sub-field naming a location in the popover list.'
  - name: labelKey
    type: string
    default: title
    description: The child attribute shown as a card's name in the popover.
gotchas:
  - 'The block needs a `<Repeater>` marker and the child needs a `point` field named by `pointKey` — the map places children, it does not store pins itself. (For pins kept inside one field, use `hotspots`.)'
  - 'The repeater it fills loses its canvas Add button — a card is added by clicking the map, where it belongs. Put `addButton="show"` on the `<Repeater>` marker to keep it.'
  - 'Render each child at `left:X%;top:Y%` of a box with the image''s aspect ratio — the value is a fraction of the picture, not of a cropped frame.'
example: |
  { "id": "ctrl_map",
    "type": "pin-map",
    "label": "Site map",
    "attributeKey": "map",
    "pointKey": "point",
    "labelKey": "title" }
---
