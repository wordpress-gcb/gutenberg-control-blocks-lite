---
type: page-link
title: page-link
section: Field reference
order: 63
description: 'Placeholder type — currently falls through to the `url` control. The original GCB referenced this type but never shipped a real implementation, so for now it''s an alias for `url`.'
stored: '{ url: string, text: string, opensInNewTab: boolean } — same as `url`'
supports:
  - All `url` features (display text, opens-in-new-tab toggle)
configOptions:
  - name: default
    type: object
    description: 'Initial value, e.g. `{ "url": "", "text": "Read more", "opensInNewTab": false }`.'
gotchas:
  - 'Today this is an alias for `url`. If you need to pick from existing site pages specifically, fall back to `post-object` with `postType: "page"`.'
example: |
  { "id": "ctrl_page",
    "type": "page-link",
    "label": "Linked page",
    "attributeKey": "page",
    "parentPanelId": "panel" }
---
