/**
 * Extend @wordpress/scripts default config to emit four bundles:
 *   - build/index.*           — block editor (Inspector, render-batch client)
 *   - build/post-fields.*     — meta-box for CPT typed fields
 *   - build/sidebar-fields.*  — block-editor sidebar panel for CPT typed
 *                               fields (used when 'has_body' => true on
 *                               gcblite_register_post_fields). Same control
 *                               library, different mount surface.
 *   - build/builder.*         — wp-admin Schema Builder page. Isolated
 *                               from the editor bundles because Monaco
 *                               is ~600KB and only loads on its own
 *                               admin route.
 *
 * The first three share the control library in src/controls/ via tree-shaking.
 * The builder bundle is independent on purpose.
 */

const defaultConfig = require('@wordpress/scripts/config/webpack.config');

module.exports = {
	...defaultConfig,
	entry: {
		index:            './src/index.js',
		'post-fields':    './src/post-fields.js',
		'sidebar-fields': './src/sidebar-fields.js',
		builder:          './src/builder.jsx',
	},
};
