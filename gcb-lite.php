<?php
/**
 * Plugin Name:       GCB Lite
 * Plugin URI:        https://github.com/wordpress-gcb/gutenberg-control-blocks-lite
 * Description:       WordPress as a typed-field CMS for a React frontend. One component renders both the editor preview and the public site, with rich Inspector controls and headless-ready REST endpoints.
 * Version:           0.1.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            GCB
 * Author URI:        https://gutenbergcontrolblocks.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       gcblite
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
        \GCBLite\Abilities\AbilitiesRegistry::class,
        \GCBLite\Admin\Settings::class,
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
