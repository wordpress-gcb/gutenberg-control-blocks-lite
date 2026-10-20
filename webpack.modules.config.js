/**
 * THE KIT'S FRONT-END SCRIPT MODULES (2026-10-19): parts a visitor's page runs, built apart from the editor bundles as
 * native ES modules — @wordpress/scripts' module config with our own entries — into build/modules/<name>.js and its
 * .asset.php. The first is the select (src/kit/select.js, Zag bundled in), shared by GCB Pro's built sections and
 * GCB Forms.
 *
 *   npm run build:modules
 */
const path = require( 'path' );

process.env.WP_EXPERIMENTAL_MODULES = 'true';
const configs = require( '@wordpress/scripts/config/webpack.config' );
const moduleConfig = Array.isArray( configs ) ? configs[ configs.length - 1 ] : configs;

module.exports = {
	...moduleConfig,
	entry: {
		'kit-select': path.resolve( __dirname, 'src/kit/select.js' ),
		'kit-slider': path.resolve( __dirname, 'src/kit/slider.js' ),
		'kit-dates': path.resolve( __dirname, 'src/kit/dates.js' ),
	},
	output: {
		...moduleConfig.output,
		path: path.resolve( __dirname, 'build/modules' ),
	},
};
