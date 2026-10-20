/**
 * THE KIT'S SCRIPT MODULES (2026-10-19; one folder a part, 2026-10-20): every kit/<part>/view.js is a part a visitor's
 * page runs as a native ES module, built apart from the editor bundles — @wordpress/scripts' module config — into
 * build/kit/<part>.js and its .asset.php (the modules it imports, and a version). Found by their folders, never listed:
 * includes/Kit/Registry.php loads each where a block draws its part.
 *
 *   npm run build:modules
 */
const path = require( 'path' );
const { readdirSync, existsSync } = require( 'fs' );

process.env.WP_EXPERIMENTAL_MODULES = 'true';
const configs = require( '@wordpress/scripts/config/webpack.config' );
const moduleConfig = Array.isArray( configs ) ? configs[ configs.length - 1 ] : configs;

module.exports = {
	...moduleConfig,
	entry: Object.fromEntries(
		readdirSync( path.resolve( __dirname, 'kit' ) )
			.map( ( part ) => [ part, path.resolve( __dirname, 'kit', part, 'view.js' ) ] )
			.filter( ( [ , file ] ) => existsSync( file ) )
	),
	output: {
		...moduleConfig.output,
		path: path.resolve( __dirname, 'build/kit' ),
	},
};
