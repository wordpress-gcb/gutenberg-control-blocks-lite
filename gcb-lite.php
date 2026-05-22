<?php
/**
 * Plugin Name: GCB Lite
 * Description: Declarative Inspector controls for Gutenberg blocks. Author blocks as standard WP files (block.json + render.php) with a `gcb` key for controls.
 * Version: 0.1.0
 * Requires PHP: 7.4
 * License: GPL-2.0+
 */

if (!defined('ABSPATH')) {
    exit;
}

define('GCBLITE_VERSION', '0.1.0');
define('GCBLITE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('GCBLITE_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once GCBLITE_PLUGIN_DIR . 'vendor/autoload.php';

/**
 * Services initialised at plugin-load. Each service registers its own hooks
 * via a static `init()` method.
 */
function gcblite_services() {
    return [
        \GCBLite\Blocks\BlockLoader::class,
        \GCBLite\Assets\EditorAssets::class,
        \GCBLite\RestAPI\PreviewAPI::class,
        \GCBLite\RestAPI\RenderAPI::class,
        \GCBLite\RestAPI\RawBlocksField::class,
        \GCBLite\RestAPI\BlocksAPI::class,
        \GCBLite\Rendering\InnerBlocksReplacer::class,
    ];
}

function gcblite_bootstrap() {
    foreach (gcblite_services() as $service) {
        $service::init();
    }

    if (defined('WP_CLI') && WP_CLI) {
        \WP_CLI::add_command('gcblite scaffold', \GCBLite\CLI\ScaffoldCommand::class);
    }
}

gcblite_bootstrap();
