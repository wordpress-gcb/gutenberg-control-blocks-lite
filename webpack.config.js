/**
 * Extend @wordpress/scripts default config to emit two bundles:
 *   - build/index.*        — block editor (Inspector, render-batch client)
 *   - build/post-fields.*  — meta-box for CPT typed fields
 *
 * Both share the same control library code in src/controls/ via tree-shaking.
 */

const defaultConfig = require('@wordpress/scripts/config/webpack.config');

module.exports = {
	...defaultConfig,
	entry: {
		index:         './src/index.js',
		'post-fields': './src/post-fields.js',
	},
};
