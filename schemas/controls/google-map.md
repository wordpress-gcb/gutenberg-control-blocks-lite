---
type: google-map
title: google-map
section: Field reference
order: 70
description: Address autocomplete plus a draggable map marker. Needs a Google Maps JS API key — without one, it falls back to a plain address input that only fills `address`.
stored: '{ address: string, lat: number | null, lng: number | null, zoom: number }'
supports:
  - Places Autocomplete for address search
  - Interactive map preview with draggable marker
  - Graceful fallback to plain address input when no API key is configured
configOptions:
  - name: helpText
    type: string
    description: One-line description shown below the control.
gotchas:
  - 'Requires an API key exposed via `window.gcbLite.googleMaps.apiKey`. Set it server-side using the `gcb_google_maps_api_key` filter.'
  - 'Without an API key the control still works — but `lat`/`lng` will be `null` and there is no map preview.'
  - Default zoom is 14 if not present on the saved value.
example: |
  { "id": "ctrl_location",
    "type": "google-map",
    "label": "Office location",
    "attributeKey": "location",
    "parentPanelId": "panel" }
---
