# Control docs

Canonical JSON for each gcb-lite control type. Consumed by:

- `examples/themes/gcb-saas-theme/blocks/field-showcase/render.php` — renders a `<details>` block per field row on the `/all-fields` demo so the rendered value sits next to its own documentation.
- `gcb-next-starter` docs site (`app/docs/fields/{type}/page.jsx`) — picks up the same JSON at build time and renders the canonical view at `/docs/fields/{type}`.

Single source of truth. **Do not maintain prose copies of these fields in either consumer.** Edit the JSON and both sides update.

## Schema

Each `{type}.json` describes one control type. Fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | string | yes | Must match the filename and match the value authors put in `block.fields.json` `"type"`. |
| `description` | string | yes | One-paragraph summary. Renders above everything else. |
| `stored` | string | yes | Free-form description of the stored attribute shape (e.g. `"string"`, `"{ url, alt, focalPoint, ... }"`). |
| `supports` | string[] | no | Bullet list of features the control supports. Useful for "does it support gradients" / "does it support multi-select" answers. |
| `configOptions` | array | no | Each entry `{ name, type, default?, description }`. Documents author-facing config keys read by the control. |
| `gotchas` | string[] | no | Surprising behaviour worth flagging. |
| `example` | string | no | A `block.fields.json` snippet, JSON-stringified. |

## Adding a new control

1. Create `schemas/controls/{type}.json`.
2. The field-showcase block picks it up automatically (`render.php` reads via `file_get_contents`).
3. To make it surface on the docs site, sync the file into `gcb-next-starter/lib/control-docs/{type}.json` (see `playground/sync-control-docs.sh`).

## Adding a new field to the schema

Add it here AND in both consumers. Schema changes are rare — be conservative; the value of having one source of truth is being able to add information once.
