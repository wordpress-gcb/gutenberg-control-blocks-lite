---
slug: headless/deploy
title: Deploy
section: Headless rendering
order: 5
---

GCB Lite splits cleanly across hosts: WordPress sits wherever WP traditionally sits (Kinsta, Pressable, WP Engine, a $5 VPS); the React component server sits wherever Next.js / Astro / Remix sits (Vercel, Netlify, Cloudflare, self-hosted Node). The two only need HTTPS reachability between them.

## Environment variables

```bash
# .env.local on the Next.js side
NEXT_PUBLIC_WP_URL=https://wp.yoursite.com
```

On the WordPress side, in *Settings → GCB Lite*, set the component server URL — for production, this is the public Vercel / Netlify URL. The plugin POSTs each block's attributes to `{component_server}/api/render` and SSRs the result back into the block editor preview.

## Pattern 1 — Vercel + WP-on-anything

- WP at `wp.yoursite.com` (managed host).
- Next.js at `yoursite.com` (Vercel).
- One DNS record points at each.

Editors log into WP at `wp.yoursite.com/wp-admin`. Public visitors land on the Vercel-hosted Next.js site, which fetches content from the WP REST API. No proxy, no rewrites, no shared infrastructure between the two.

> Make sure WP's REST endpoints are reachable from Vercel (firewall allowlist if your host has one). Editor preview also needs Vercel to be reachable from WP's server (PHP-to-Node round trip).

## Pattern 2 — Shared origin via reverse proxy

Put WP under `yoursite.com/wp/` and the Next.js app at `yoursite.com/`. Easier for the WP admin (same-origin cookies, no CORS), at the cost of host coupling.

## Caching strategy

- `getPageBySlug / getPostBySlug / getCptCollection` use `revalidate: 30` by default. Tune per call.
- `getBlockDefaults` uses `revalidate: 300` (schemas barely change).
- For instant editor previews, use Next.js's `on-demand revalidation` from a WP `save_post` hook (POST to a Next.js revalidate endpoint when the author saves).

## SSRF posture

The plugin's render endpoints proxy POST requests to your configured component server URL. Treat this as one trusted relationship: only the URL the admin configured is callable. If you fork the plugin to add multi-tenancy or accept the URL from request input, pin allowed hosts and block private/loopback ranges.
