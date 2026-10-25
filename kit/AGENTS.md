# Working on a kit part

A kit part is worn by a drawing: an AI draws a design as HTML + Tailwind, and the part must take that drawing's look
and still work. Mark's rule: every part is versatile enough to wear the site's theme tokens, to be restyled, and to
have its behaviour changed.

1. **A look is for the bare part only.** Border, radius, background, colour, padding, size, shadow, font, gap and the
   layout of a drawn element apply only where the drawing gave no classes: `:not([data-gcb-own])`, or zero weight with
   `:where(…)` so any class wins. Mechanics (popover position, shown/hidden, focus) may stay unguarded.
2. **No `!important` on a look.** A real mechanic that must beat the theme says so on its line:
   `/* mechanic: <why> */`.
3. **Literals read tokens.** `var(--gcb-<part>-<thing>, <today's value>)`, falling back through `--gcb-kit-…` and the
   site's `--wp--preset--…`. Today's value stays the default.
4. **Use the drawn element first.** Before creating a button, arrow, dot, icon, wrapper or notice, look for one the
   drawing marked with the part's data-attribute, and keep its classes.
5. **Behaviour is a data-attribute** on the part's root, defaulting to today's behaviour.
6. **A bare part looks exactly as it did.** Widen what a drawing can do; never restyle a bare part.
7. **Say it on the reference page** (`harness/prompts/kit/<part>.md`): every token and attribute, tersely.

`node bin/kit-lint.mjs` in gcb-pro checks 1–3, for both kits. It fails only on new breaks — what was already broken is in
`kit/_lint/baseline.json` — and every message says the fix. Never silence it with a fake guard; fix the rule or mark a
real mechanic.

Why: `harness/docs/HARD-TRUTHS.md` 10 (every kit part wears the drawing and the site).
