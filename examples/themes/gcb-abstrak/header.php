<?php
/**
 * Theme header — emits the doctype, <head>, and a placeholder for the
 * React SiteHeader to hydrate into.
 *
 * The theme bundle (build/theme.js) finds #gcb-site-header on
 * DOMContentLoaded and renders the SiteHeader component into it. The
 * placeholder ships empty to avoid a flash of the wrong markup before
 * React boots — the page's first paint is just blank chrome for a
 * couple hundred ms.
 *
 * @package GCB_Abstrak
 */
?><!DOCTYPE html>
<html <?php language_attributes(); ?> data-bs-theme="light">
<head>
    <meta charset="<?php bloginfo('charset'); ?>" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<div id="gcb-site-header"></div>
<main>
