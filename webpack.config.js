/**
 * Extend @wordpress/scripts default config to emit three bundles:
 *   - build/index.*           — block editor (Inspector, render-batch client)
 *   - build/post-fields.*     — meta-box for CPT typed fields
 *   - build/sidebar-fields.*  — block-editor sidebar panel for CPT typed
 *                               fields (used when 'has_body' => true on
 *                               gcblite_register_post_fields). Same control
 *                               library, different mount surface.
 *
 * All three share the same control library code in src/controls/ via tree-shaking.
 */

const defaultConfig = require('@wordpress/scripts/config/webpack.config');

module.exports = {
	...defaultConfig,
	entry: {
		index:            './src/index.js',
		'post-fields':    './src/post-fields.js',
		'sidebar-fields': './src/sidebar-fields.js',
	},
};
