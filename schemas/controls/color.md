---
type: color
title: color
section: Field reference
order: 20
description: Color picker pulling its palette from the active theme.json. Renders as a small swatch that opens a popover with the theme palette and (optionally) a gradients tab.
stored: 'string — hex like "#5956E9", a theme palette slug, or a CSS gradient string when gradients are enabled.'
supports:
  - 'Theme palettes — values from `settings.color.palette` in theme.json appear automatically.'
  - 'Gradients — when `showGradients: true`, a second tab lets the author pick a CSS gradient. Stored in the same attribute as the color (string).'
  - 'Dual-attribute mode — set `gradientAttributeKey` to write color and gradient to separate attributes if your render path needs them apart.'
configOptions:
  - name: showGradients
    type: boolean
    default: false
    description: Show the gradient picker tab. When false (default) the popover is color-only.
  - name: gradientAttributeKey
    type: string
    description: Optional. If set, the gradient value is stored in this attribute instead of the same one as the color. Useful when your render.php / React component expects color and gradient as separate props.
gotchas:
  - 'Stored value is a single string — `"#5956E9"` (color) OR `"linear-gradient(...)"` (gradient). Renderers should accept either shape unless dual-attribute mode is in use.'
example: |
  { "id": "ctrl_accent",
    "type": "color",
    "label": "Accent",
    "attributeKey": "accent",
    "default": "#5956E9",
    "showGradients": true,
    "parentPanelId": "panel" }
---
