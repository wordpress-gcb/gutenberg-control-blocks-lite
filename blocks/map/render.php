<?php
/**
 * Map — a real Google map of a single location (Maps JS API by default,
 * NOT the static embed iframe). render.php emits a container carrying the
 * location + style JSON as data-* attributes; view.js reads them and does
 * new google.maps.Map(...) with the pasted styles array.
 *
 * The location value is the google-map field shape {address,lat,lng,zoom}.
 * Styling is a Cloud Map ID (Google's forward path — the deprecated JSON
 * styles array it replaces is mutually exclusive with a Map ID). view.js
 * passes the mapId to new google.maps.Map; the style is hosted by Google.
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

// The Cloud Map ID (style). Sanitise to the id charset Google uses.
$map_id = (string) ($attributes['mapId'] ?? '');
$map_id = preg_replace('/[^A-Za-z0-9_-]/', '', $map_id);

$has_key = class_exists('\GCBLite\Integrations\GoogleMapsKey')
    && \GCBLite\Integrations\GoogleMapsKey::get() !== '';

$wrap = get_block_wrapper_attributes([
    'class'            => 'gcb-map',
    'data-map-address' => $addr,
    'data-map-lat'     => $lat === null ? '' : (string) $lat,
    'data-map-lng'     => $lng === null ? '' : (string) $lng,
    'data-map-zoom'    => (string) $zoom,
    'data-map-id'      => $map_id,
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
