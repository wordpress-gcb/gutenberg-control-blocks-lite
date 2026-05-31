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

$props = [
    'eyebrow'      => (string) ($attributes['eyebrow'] ?? ''),
    // Heading + body both live in the single InnerBlocks slot below —
    // authored inline as core/heading + core/paragraph blocks. Neither
    // has a scalar value to pass to the React frontend; that side reads
    // children-HTML from the rendered output.
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

$primary_href   = $props['primaryCta']['url']  ?? '#';
$primary_label  = $props['primaryCta']['text'] ?? 'View on GitHub';
$primary_target = !empty($props['primaryCta']['opensInNewTab']) ? '_blank' : '';
$primary_rel    = $primary_target ? 'noopener noreferrer' : '';

// Resolve image-base URL for hardcoded /images/* paths from the React
// design. Theme assets/images/ holds the bundled Saas decoration
// shapes (bubble-29, line-7) the banner uses.
$image_base = get_stylesheet_directory_uri() . '/assets/images';

// Heading + body are both authored as InnerBlocks. Default template
// seeds a single core/heading followed by two paragraphs so a fresh
// banner reads as finished, not empty — the author can rewrite the
// heading text inline like any heading block, change its level via the
// block toolbar, and edit / replace the paragraphs freely.
$body_template = wp_json_encode([
    ['core/heading', ['level' => 1, 'className' => 'title', 'content' => 'Your headline here']],
    ['core/paragraph', ['content' => 'Replace this paragraph with your own copy.']],
]);
$body_allowed = wp_json_encode([
    'core/paragraph', 'core/heading', 'core/list', 'core/buttons',
    'core/image', 'core/quote', 'core/separator',
]);

// Media: prefer authored content, fall back to the bundled sample.
// The image field accepts video uploads too — the control is mime-agnostic
// (any uploaded URL stores fine), so we pick <img> or <video> here based
// on the extension. Hits the common WP-uploaded video formats.
$media_url   = !empty($props['image']['url']) ? $props['image']['url'] : ($image_base . '/banner/banner-thumb-7.png');
$media_alt   = $props['image']['alt'] ?? '';
$media_ext   = strtolower(pathinfo(parse_url($media_url, PHP_URL_PATH) ?: '', PATHINFO_EXTENSION));
$is_video    = in_array($media_ext, ['mp4', 'webm', 'mov', 'm4v', 'ogv'], true);
?>
<div <?php echo $wrap; ?>>
    <div class="container">
        <div class="banner-content">
            <?php if ($props['eyebrow']) : ?>
                <span class="subtitle" <?php gcb_focus('eyebrow'); ?>><?php echo esc_html($props['eyebrow']); ?></span>
            <?php endif; ?>
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
                <?php if ($is_video) : ?>
                    <video
                        src="<?php echo esc_url($media_url); ?>"
                        autoplay
                        muted
                        loop
                        playsinline
                        preload="metadata"
                        aria-label="<?php echo esc_attr($media_alt); ?>"
                    ></video>
                <?php else : ?>
                    <img src="<?php echo esc_url($media_url); ?>" alt="<?php echo esc_attr($media_alt); ?>" />
                <?php endif; ?>
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
