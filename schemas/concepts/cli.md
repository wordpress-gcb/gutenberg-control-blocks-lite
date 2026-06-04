---
slug: cli
title: CLI scaffolding
section: Getting started
order: 3
---

Everything the visual builder does, the command line does too. `wp gcblite scaffold` writes the same `block.json` + `block.fields.json` into your theme, through the exact same scaffolder the admin UI calls, so the output is identical either way. Reach for it when you're in a terminal, scripting a setup, running in CI, or piping a spec in from another process (an AI agent, a generator, anything).

> Requires [WP-CLI](https://wp-cli.org/). Run from anywhere inside your WordPress install. Blocks land in the **active theme**'s `blocks/{name}/` by default.

## Quickest start

Give it a name and a comma-separated list of controls:

```bash
wp gcblite scaffold hello-world \
  --title="Hello World" \
  --controls="name:text:Name,intro:textarea:Intro"
```

That writes `blocks/hello-world/block.json` and `blocks/hello-world/block.fields.json`, then prints where they went.

## The `--controls` format

Each control is `attributeKey:type:Label`, entries joined by commas:

```
name:text:Name,intro:textarea:Intro,cta:url:Call to action
```

- **`attributeKey`** (required) — the key you'll read when rendering.
- **`type`** — any control type (`text`, `textarea`, `url`, `image`, `select`, …). Defaults to `text` if omitted.
- **`Label`** — the Inspector label. Defaults to a title-cased version of the key (`hero_text` → "Hero Text") if omitted.

So `name:text` and `name:text:Name` produce the same control; `name` alone gives you a text control labelled "Name".

## Options

| Flag | What it does |
| --- | --- |
| `<name>` | Block slug — lowercase, hyphenated. Required unless you pass `--spec` or `--stdin`. |
| `--title=<title>` | Display title. Defaults to a title-cased `<name>`. |
| `--description=<text>` | Block description. |
| `--icon=<dashicon>` | Dashicon name. Default `admin-generic`. |
| `--category=<cat>` | Block category. Default `widgets`. |
| `--controls=<csv>` | Controls in the `attributeKey:type:Label` format above. |
| `--spec=<file>` | Read a JSON spec from a file (see below). |
| `--stdin` | Read a JSON spec from stdin — the path built for agents/pipes. |
| `--force` | Overwrite an existing block directory. |
| `--dry-run` | Print the resolved `block.json` and the files it *would* write, without touching disk. |

Always safe to preview first:

```bash
wp gcblite scaffold hello-world --controls="name:text" --dry-run
```

## JSON specs (files & pipes)

For anything past a couple of simple controls, describe the block as JSON. The shape:

```json
{
  "block_name": "hello-world",
  "meta": {
    "title": "Hello World",
    "description": "A friendly greeting block.",
    "icon": "smiley",
    "category": "widgets"
  },
  "gcb": {
    "controls": [
      { "id": "ctrl_name",  "type": "text",     "label": "Name",  "attributeKey": "name",  "default": "world" },
      { "id": "ctrl_intro", "type": "textarea", "label": "Intro", "attributeKey": "intro",
        "validation": { "maxLength": 200 } }
    ]
  }
}
```

`block_name` is the only required key; `meta` and `gcb` fill in defaults if omitted. Because `gcb.controls` is the same array that lands in `block.fields.json`, you get the full control vocabulary here — defaults, validation, conditional logic, groups — not just the three fields the inline `--controls` shorthand exposes.

Point at a file:

```bash
wp gcblite scaffold --spec=./hello-world.json
```

Or pipe it in on stdin — handy when the spec is generated rather than stored:

```bash
cat hello-world.json | wp gcblite scaffold --stdin

# or straight from a generator / agent
echo '{"block_name":"hello-world","gcb":{"controls":[
  {"attributeKey":"name","type":"text","label":"Name","default":"world"}
]}}' | wp gcblite scaffold --stdin
```

## After scaffolding

You've got the folder and its two files — same state as clicking **+ New** in the admin. From here it's identical to the [Quickstart](/docs/quickstart): add or refine fields (in the file or the visual builder, your choice), then give the block its markup. To render it, see step 4 of the Quickstart.

> Driving GCB from an AI agent rather than a shell? The same `--stdin` path works for piped specs, and agents can also introspect and render blocks over the WP Abilities API — see [AI workflows](/docs/ai).
