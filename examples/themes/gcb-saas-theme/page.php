<?php
/**
 * Page template — renders any standard WP page.
 *
 * The block content is server-rendered by gcb-lite (calling each block's
 * render.php), producing HTML with [data-block-name] wrappers around the
 * saas-* blocks. The theme bundle (enqueued from functions.php) then
 * hydrates each wrapper with its React component on the client.
 *
 * No header / footer chrome here yet — the theme is shipping naked WP
 * pages for now. The header / footer wordmark + nav live in the
 * Next.js demo (gcb-next-starter/components/Site{Header,Footer}.jsx)
 * and would need porting if we want them on the WP path too.
 *
 * @package GCB_SaaS_Theme
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();

while (have_posts()) :
    the_post();
    ?>
    <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
        <?php the_content(); ?>
    </article>
    <?php
endwhile;

get_footer();
