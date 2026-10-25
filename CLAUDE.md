# GCB

The hard truths for working on GCB are in `../harness/CLAUDE.md` and, in full with their proof,
`../harness/docs/HARD-TRUTHS.md`. Read them before changing anything a builder is handed or anything in `kit/`.

Kit parts: `kit/AGENTS.md` (loaded when you work in `kit/`). In short — a part wears the drawing: looks only on a bare
part, no `!important` on a look, literals read tokens, the drawn element first, behaviour as data-attributes, and a
bare part looks exactly as it did. `node bin/kit-lint.mjs` (in gcb-pro) checks it.
