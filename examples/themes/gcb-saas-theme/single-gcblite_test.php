<?php
/**
 * single-gcblite_test.php — renders a single `gcblite_test` post as an
 * ACF-style field stack: post title at the top, every registered
 * structured field below in a clean labelled list.
 *
 * Demonstrates `gcblite_render_post_fields()` — the one-line helper any
 * theme can drop into a template to print structured field data for
 * the current post.
 *
 * @package GCB_SaaS_Theme
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();
?>
<main class="gcblite-fields-page">
    <?php while (have_posts()): the_post(); ?>
        <article>
            <header class="gcblite-fields-page__header">
                <p class="gcblite-fields-page__eyebrow">GCB Structured Content Fields</p>
                <h1 class="gcblite-fields-page__title"><?php the_title(); ?></h1>
            </header>

            <?php
            // The whole point of the page — drop the helper in and the
            // registered fields render themselves as a label/value stack.
            if (function_exists('gcblite_render_post_fields')) {
                gcblite_render_post_fields();
            }
            ?>
        </article>
    <?php endwhile; ?>
</main>

<style>
    .gcblite-fields-page {
        max-width: 880px;
        margin: 48px auto;
        padding: 0 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        color: #1e1e1e;
        line-height: 1.5;
    }
    .gcblite-fields-page__header {
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 1px solid #e5e5ea;
    }
    .gcblite-fields-page__eyebrow {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #6b6b78;
        margin: 0 0 8px;
    }
    .gcblite-fields-page__title {
        font-size: 32px;
        font-weight: 600;
        letter-spacing: -0.02em;
        margin: 0;
        color: #111114;
    }

    .gcblite-fields { display: block; }
    .gcblite-fields-empty {
        color: #6b6b78;
        background: #fafafa;
        border: 1px dashed #d4d4dc;
        padding: 16px;
        border-radius: 6px;
    }
    .gcblite-fields__panel {
        margin-bottom: 32px;
    }
    .gcblite-fields__panel-title {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #6b6b78;
        margin: 0 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e5e5ea;
    }
    .gcblite-fields__list {
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: minmax(200px, 240px) 1fr;
        gap: 12px 24px;
    }
    .gcblite-fields__row {
        display: contents;
    }
    .gcblite-fields__label {
        font-weight: 600;
        font-size: 14px;
        color: #111114;
        padding: 8px 0;
    }
    .gcblite-fields__key {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        color: #6b6b78;
        font-weight: 400;
        margin-left: 6px;
    }
    .gcblite-fields__value {
        font-size: 14px;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f4;
        margin: 0;
    }
    .gcblite-fields__row:last-child .gcblite-fields__label,
    .gcblite-fields__row:last-child .gcblite-fields__value {
        border-bottom: 0;
    }
    .gcblite-fields__empty {
        color: #aaa;
    }
    .gcblite-fields__bool--on  { color: #166534; font-weight: 600; }
    .gcblite-fields__bool--off { color: #6b6b78; }
    .gcblite-fields__swatch {
        display: inline-block;
        width: 16px; height: 16px;
        border-radius: 3px;
        border: 1px solid #d4d4dc;
        vertical-align: middle;
        margin-right: 4px;
    }
    .gcblite-fields__image img,
    .gcblite-fields__gallery img {
        max-width: 200px;
        height: auto;
        border-radius: 6px;
        border: 1px solid #e5e5ea;
    }
    .gcblite-fields__gallery {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    .gcblite-fields__richtext { font-size: 14px; }
    .gcblite-fields__code {
        background: #1e1e1e;
        color: #e5e5ea;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        padding: 10px 12px;
        border-radius: 6px;
        margin: 0;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
    }
    .gcblite-fields__code code { background: transparent; padding: 0; color: inherit; }
    .gcblite-fields__json,
    .gcblite-fields__repeater pre {
        background: #1e1e1e;
        color: #e5e5ea;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        padding: 10px 12px;
        border-radius: 6px;
        margin: 0;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
    }
    .gcblite-fields__repeater {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 8px;
    }
</style>
<?php
get_footer();
