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
	/* WHAT THE PARTS SHARE IS LOADED ONCE (2026-10-21): every part carried its own copy of Zag, Floating UI and the kit's
	   _core — a page with a calendar, a select and the guests counter fetched the same runtime three times (390KB), and
	   two copies of one module each kept their own count (widget.js' ids). Code two parts or more use is split into
	   chunks by who shares it, each imported by its parts from beside them (`./kit-shared-<hash>.js`, a relative import:
	   no import map) — a page loads only what its parts use, once; the hash in the name means a cached old chunk never
	   runs with a new part */
	optimization: {
		...moduleConfig.optimization,
		splitChunks: {
			chunks: 'all',
			cacheGroups: {
				default: false,
				defaultVendors: false,
				shared: {
					test: /[\\/](?:node_modules|kit[\\/]_core)[\\/]/,
					name: false,
					filename: 'kit-shared-[contenthash:12].js',
					minChunks: 2,
					minSize: 4000,
					reuseExistingChunk: true,
				},
			},
		},
	},
};
