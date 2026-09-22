---
type: point
title: point
section: Field reference
order: 12
description: 'Where something sits on the image round it — a hotspot pin, a label on a photo. Stores {x, y} in 0..1, like an image focal point, and is dragged on the picture in the sidebar. The rendering block prints it as `left:X%;top:Y%` on an absolutely positioned element.'
stored: 'object — { x, y } in 0..1'
supports:
  - Drag-to-place picker over the nearest image field (the block's own, or an ancestor block's)
  - A plain grey canvas when no image is near, so the point can still be set
configOptions:
  - name: default
    type: object
    default: '{ x: 0.5, y: 0.5 }'
    description: Where a new pin starts.
gotchas:
  - The value is a fraction of the image's box, not pixels — it keeps its place at every size.
  - The element it positions must be `position:absolute` inside the image's box; the control does not add that.
example: |
  { "id": "ctrl_pin",
    "type": "point",
    "label": "Pin position",
    "attributeKey": "pin_position",
    "default": { "x": 0.5, "y": 0.5 } }
---
