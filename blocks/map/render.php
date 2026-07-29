<?php
/**
 * Map — a real Google map of a single location (Maps JS API by default,
 * NOT the static embed iframe). render.php emits a container carrying the
 * location + style JSON as data-* attributes; view.js reads them and does
 * new google.maps.Map(...) with the pasted styles array.
 *
 * The location value is the google-map field shape {address,lat,lng,zoom}.
 * The style JSON is a classic MapTypeStyle[] (from the Styling Wizard) —
 * applied via the map's `styles` option (NOT a cloud Map ID, which would
 * disable JSON styles).
 *
 * Graceful fallback: no API key → a plain notice (mirrors field-showcase).
 *
 * @var array  $attributes
 * @var string $content
 */

if (!defined('ABSPATH')) {
    exit;
}

$loc   = is_array($attributes['location'] ?? null) ? $attributes['location'] : [];
$lat   = isset($loc['lat']) && is_numeric($loc['lat']) ? (float) $loc['lat'] : null;
$lng   = isset($loc['lng']) && is_numeric($loc['lng']) ? (float) $loc['lng'] : null;
$zoom  = isset($loc['zoom']) && is_numeric($loc['zoom']) ? (int) $loc['zoom'] : 12;
$addr  = (string) ($loc['address'] ?? '');

// Normalise the pasted style JSON: decode+re-encode so only valid JSON
// (an array) reaches the attribute; anything else becomes empty. Defensive,
// and it strips stray whitespace/comments the Wizard sometimes includes.
$styles_raw = (string) ($attributes['styles'] ?? '');
$styles_json = '';
if ($styles_raw !== '') {
    $decoded = json_decode($styles_raw, true);
    if (is_array($decoded)) {
        $styles_json = wp_json_encode($decoded);
    }
}

$has_key = class_exists('\GCBLite\Integrations\GoogleMapsKey')
    && \GCBLite\Integrations\GoogleMapsKey::get() !== '';

$wrap = get_block_wrapper_attributes([
    'class'            => 'gcb-map',
    'data-map-address' => $addr,
    'data-map-lat'     => $lat === null ? '' : (string) $lat,
    'data-map-lng'     => $lng === null ? '' : (string) $lng,
    'data-map-zoom'    => (string) $zoom,
    'data-map-styles'  => $styles_json,
]);
?>
<?php if (!$has_key) : ?>
    <div class="gcb-map gcb-map--no-key">
        <?php echo esc_html__('No Google Maps API key configured — add one in Settings → GCB Lite to show the map.', 'gcb'); ?>
    </div>
<?php elseif ($lat === null || $lng === null) : ?>
    <div <?php echo $wrap; ?>>
        <div class="gcb-map__placeholder"><?php echo esc_html($addr ?: __('No location set.', 'gcb')); ?></div>
    </div>
<?php else : ?>
    <div <?php echo $wrap; ?>>
        <div class="gcb-map__canvas" aria-label="<?php echo esc_attr($addr); ?>"></div>
    </div>
<?php endif; ?>
