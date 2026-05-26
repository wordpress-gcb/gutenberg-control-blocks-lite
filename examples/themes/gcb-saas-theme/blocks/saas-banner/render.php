<?php
/**
 * Saas Banner — hero section.
 *
 * Renders the polished Saas markup directly in PHP — same classnames
 * (.banner banner-style-4, .container, .banner-content) the React
 * component produces. Theme CSS (gcb-demo-theme/build/theme.css) styles
 * it identically on the editor side and the frontend side.
 *
 * On the frontend the React hydration bundle still re-mounts the
 * SaasBanner component into this wrapper as a progressive
 * enhancement layer (adds the react-icons social SVGs, any animations).
 * In the editor the React bundle short-circuits (see entry.jsx
 * isWpEditor) so this PHP output is what authors see.
 *
 * Resolved data-block-name + data-props are still emitted on the
 * wrapper so the React side can read them.
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$heading_data = is_array($attributes['heading'] ?? null) ? $attributes['heading'] : [];

$props = [
    'eyebrow'      => (string) ($attributes['eyebrow'] ?? ''),
    'heading'      => [
        'text'  => (string) ($heading_data['text']  ?? ''),
        'level' => (string) ($heading_data['level'] ?? 'h1'),
    ],
    // Body is now an InnerBlocks slot — the React frontend reads
    // children-HTML from the rendered output, not a typed string field.
    // Kept out of $props because there's no scalar value to pass.
    'primaryCta'   => is_array($attributes['primary_cta']   ?? null) ? $attributes['primary_cta']   : null,
    'secondaryCta' => is_array($attributes['secondary_cta'] ?? null) ? $attributes['secondary_cta'] : null,
    'image'        => is_array($attributes['image'] ?? null) ? $attributes['image'] : null,
    'facebook'     => is_array($attributes['facebook'] ?? null) ? $attributes['facebook'] : null,
    'twitter'      => is_array($attributes['twitter']  ?? null) ? $attributes['twitter']  : null,
    'linkedin'     => is_array($attributes['linkedin'] ?? null) ? $attributes['linkedin'] : null,
];

$wrap = get_block_wrapper_attributes([
    'class'           => 'banner banner-style-4 gcb-saas-banner',
    'data-block-name' => 'saas-banner',
    'data-props'      => wp_json_encode($props),
]);

$heading_tag = in_array($props['heading']['level'], ['h1','h2','h3','h4','h5','h6'], true)
    ? $props['heading']['level']
    : 'h1';

$primary_href   = $props['primaryCta']['url']  ?? '#';
$primary_label  = $props['primaryCta']['text'] ?? 'View on GitHub';
$primary_target = !empty($props['primaryCta']['opensInNewTab']) ? '_blank' : '';
$primary_rel    = $primary_target ? 'noopener noreferrer' : '';

// Resolve image-base URL for hardcoded /images/* paths from the React
// design. Theme assets/images/ holds the bundled Saas decoration
// shapes (bubble-29, line-7) the banner uses.
$image_base = get_stylesheet_directory_uri() . '/assets/images';

// Body is now authored as InnerBlocks rather than a textarea field.
// Default template seeds two paragraphs so a fresh banner reads as
// finished, not empty — the author can rewrite or replace freely.
$body_template = wp_json_encode([
    ['core/paragraph', ['content' => "One JSON file defines your fields. 30+ premium controls render natively in the Inspector — image focal points, galleries, repeaters, post relationships, conditional logic."]],
    ['core/paragraph', ['content' => "Go headless: write one React component, get pixel-perfect 1:1 previews in wp-admin and on your public site. Or render in PHP if React's overkill. Your choice, per block."]],
]);
$body_allowed = wp_json_encode([
    'core/paragraph', 'core/heading', 'core/list', 'core/buttons',
    'core/image', 'core/quote', 'core/separator',
]);

// Image: prefer authored content, fall back to the bundled sample.
$image_url = !empty($props['image']['url']) ? $props['image']['url'] : ($image_base . '/banner/banner-thumb-7.png');
$image_alt = $props['image']['alt'] ?? '';
?>
<div <?php echo $wrap; ?>>
    <div class="container">
        <div class="banner-content">
            <?php if ($props['eyebrow']) : ?>
                <span class="subtitle" <?php gcb_focus('eyebrow'); ?>><?php echo esc_html($props['eyebrow']); ?></span>
            <?php endif; ?>
            <<?php echo esc_attr($heading_tag); ?> class="title" <?php gcb_focus('heading'); ?>>
                <?php echo esc_html($props['heading']['text']); ?>
            </<?php echo esc_attr($heading_tag); ?>>
            <div class="banner-body gcb-banner-innerblocks">
                <innerblocks
                    allowedblocks='<?php echo esc_attr($body_allowed); ?>'
                    template='<?php echo esc_attr($body_template); ?>'
                ></innerblocks>
            </div>
            <?php if ($primary_href) : ?>
                <div <?php gcb_focus('primary_cta'); ?>>
                    <a
                        href="<?php echo esc_url($primary_href); ?>"
                        <?php if ($primary_target): ?>target="<?php echo esc_attr($primary_target); ?>"<?php endif; ?>
                        <?php if ($primary_rel): ?>rel="<?php echo esc_attr($primary_rel); ?>"<?php endif; ?>
                        class="axil-btn btn-fill-primary btn-large"
                    >
                        <?php echo esc_html($primary_label); ?>
                    </a>
                </div>
            <?php endif; ?>
        </div>
        <div class="banner-thumbnail" <?php gcb_focus('image'); ?>>
            <div class="large-thumb">
                <img src="<?php echo esc_url($image_url); ?>" alt="<?php echo esc_attr($image_alt); ?>" />
            </div>
        </div>
        <?php
        // Social icons emit text-only on the PHP side. The frontend
        // React hydration replaces them with react-icons SVGs. The
        // editor (where React doesn't hydrate) sees plain text labels —
        // structurally honest, just not iconified.
        $socials = array_filter([
            'Facebook' => $props['facebook']['url'] ?? '',
            'Twitter'  => $props['twitter']['url']  ?? '',
            'Linkedin' => $props['linkedin']['url'] ?? '',
        ]);
        if (!empty($socials)) : ?>
            <div class="banner-social">
                <div class="border-line"></div>
                <ul class="list-unstyled social-icon">
                    <?php foreach ($socials as $label => $url) : ?>
                        <li><a href="<?php echo esc_url($url); ?>"><?php echo esc_html($label); ?></a></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>
    </div>
    <ul class="list-unstyled shape-group-19">
        <li class="shape shape-1"><img src="<?php echo esc_url($image_base); ?>/others/bubble-29.png" alt="" /></li>
        <li class="shape shape-2"><img src="<?php echo esc_url($image_base); ?>/others/line-7.png" alt="" /></li>
    </ul>
</div>
