<?php
/**
 * Minimum-viable template — WordPress requires an index.php in every
 * theme. This theme is intended to be paired with a headless React
 * frontend (gcb-next-starter), so the public site is rendered there,
 * not here. The wp-admin side and REST API are what matter.
 *
 * If you're hitting this template in a browser you've probably loaded
 * the WP install directly instead of the React frontend — point your
 * Next.js GCBLITE_WP_URL at this install and visit the React site
 * instead.
 *
 * @package GCB_Abstrak
 */

if (!defined('ABSPATH')) {
    exit;
}

get_header();
?>
<main style="font-family: -apple-system, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.5; color: #292930;">
    <h1 style="color: #5956E9;">GCB Abstrak — WordPress backend</h1>
    <p>This WordPress install is the editorial backend for a headless React frontend. The public site is rendered separately (Next.js, served from Vercel or wherever <code>gcb-next-starter</code> is deployed).</p>
    <p>If you arrived here by accident, point the <code>GCBLITE_WP_URL</code> env var of your React frontend at this install and browse there instead.</p>
    <p>Editor-side access: <a href="<?php echo esc_url(admin_url()); ?>">/wp-admin</a></p>
</main>
<?php
get_footer();
