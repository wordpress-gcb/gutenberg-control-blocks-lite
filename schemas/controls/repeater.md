---
type: repeater
title: repeater
section: Field reference
order: 8
description: 'A marker tag, not a sidebar control. Emit `<repeater />` from your React component and the editor swaps it for a real WP InnerBlocks UI — Add button, drag-to-reorder, child-block scoping. Most blocks don''t need a `type: "repeater"` entry in their fields config.'
stored: 'n/a — repeater behaviour comes from the marker tag your component emits, not from a saved field value. Child data lives in `innerBlocks`.'
supports:
  - Editor-only InnerBlocks UI swap via a marker tag
  - Allowed-child-block whitelist via `allowedblocks`
  - Custom add-button label and optional template seed
configOptions:
  - name: allowedblocks
    type: string (JSON array)
    description: JSON-stringified array of allowed child block names. Set on the marker tag, not in `block.fields.json`.
  - name: addbuttonlabel
    type: string
    description: Label for the Add button. Set on the marker tag.
  - name: template
    type: string (JSON array)
    description: Optional. JSON of initial child blocks to seed the repeater with. Set on the marker tag.
gotchas:
  - '`type: "repeater"` looks like a control but isn''t rendered as an Inspector field. It exists so a block can declare an array-shaped attribute, but the editor never shows a "repeater" widget in the sidebar.'
  - 'Don''t add a `type: "repeater"` entry to `block.fields.json` just because you have a repeater marker in your component. The child blocks ARE the data — the marker alone is what you want in most cases.'
example: |
  // Emit this from your React component:
  <repeater
    allowedblocks={JSON.stringify(['gcb/accordion-item'])}
    addbuttonlabel="Add item"
  />
---

## The marker tag

Emit this from your React component:

```jsx
export default function Accordion({ attributes, innerBlocks = [] }) {
  return (
    <div className="accordion">
      {/* On the public site: render the inner blocks normally. */}
      {innerBlocks.length > 0
        ? innerBlocks.map((child) => /* dispatch via your block registry */ null)
        : (
          /* Marker — only meaningful in the editor preview. */
          /* eslint-disable-next-line react/no-unknown-property */
          <repeater
            allowedblocks={JSON.stringify(['gcb/accordion-item'])}
            addbuttonlabel="Add item"
          />
        )}
    </div>
  );
}
```

## When to actually use repeater-type

Only when you want a block-level array attribute AS WELL as the marker. In most cases the marker alone is what you want — the child blocks ARE the data. Don't add a `type: "repeater"` entry to your `block.fields.json` just because you have a repeater marker in your component.

> Look at the `accordion-test` block in the demo theme for the working pattern: marker in the component, no repeater entry in the field config, child block has its own `block.fields.json`.
