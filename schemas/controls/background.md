---
type: background
title: background
section: Field reference
order: 21
description: 'What a box is painted with — a colour, a gradient, a picture, or a video playing behind its contents — one field, either/or. A four-way switch over the matching picker; every pick is kept, so switching from a picture to a colour and back loses nothing. A picture may sit on a colour (a transparent pattern on green): the colour paints under it. Tag the BOX, not an <img> inside it.'
stored: 'object — { kind: "color" | "gradient" | "image" | "video", color?: string (hex or palette slug), gradient?: string (CSS gradient), image?: { url, alt, id, size?, customWidth?, isRepeat?, isFixed?, focalPoint? }, video?: { link?: string (YouTube, Vimeo or a file address), file?: { url, id }, poster?: { url, id }, autoplay?: bool, loop?: bool, phones?: "play" | "poster", pause?: bool } }'
supports:
  - 'Colour — the theme palette or a custom colour, as the color control.'
  - 'Gradient — the theme gradients or a custom one, as the color control with gradients.'
  - 'Image — the media library, with cover / contain / tile / custom width, repeat, fixed, and a focal point, as the image control; and a colour under it.'
  - 'Video — a YouTube, Vimeo or file address, or an uploaded video; a poster; play by itself (always muted — a background never makes a sound), loop, a pause button, and on phones play it or show the poster. Its poster paints the box until the player is there, and in the editor; the player is laid over the box at render. A hero that moves on the real page is this, not a picture.'
  - 'Render — `\GCBLite\Contract\Fields::background_video($value)` says what plays (src, poster, autoplay, loop, phones, pause) or null; the player is the build''s to lay over the box.'
  - 'Render — `\GCBLite\Contract\Fields::background_style($value, $scrim = null)` gives the inline style for the box; `$scrim = [color, strength]` is laid as the top layer over a picture (words over a picture need one); the editor computes the base style from `styleOf()`.'
configOptions:
  - name: default
    type: object
    default: '{ kind: "color", color: "" }'
    description: 'What a new block starts with. A build seeds it from the design: the box''s own colour, gradient or backdrop picture.'
gotchas:
  - 'The value is the whole object, never a bare colour string — though a bare string is read as one (a colour, or a gradient when it holds "gradient(").'
  - 'The box it paints must be the element tagged with the field; the control adds no markup, the render path sets the style.'
example: |
  { "id": "ctrl_backdrop",
    "type": "background",
    "label": "Background",
    "attributeKey": "backdrop",
    "default": { "kind": "color", "color": "#fff2e8" } }
---
