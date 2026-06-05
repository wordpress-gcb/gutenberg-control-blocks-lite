/**
 * Jest config. Extends @wordpress/scripts default preset (jsdom, babel
 * transform for JSX, the @wordpress/* mock library) and adds:
 *
 *   - testMatch       look in tests/js/ rather than src/, so production
 *                     code can stay free of __tests__ folders.
 *   - moduleNameMapper  stub the asset imports (.scss, image files) that
 *                       wp-scripts production code imports — Jest doesn't
 *                       run webpack so they'd otherwise fail to parse.
 *
 * Run via:  npm test
 */

const defaultConfig = require('@wordpress/scripts/config/jest-unit.config');

module.exports = {
	...defaultConfig,
	testMatch: [
		'<rootDir>/tests/js/**/*.test.js',
	],
	moduleNameMapper: {
		'\\.(scss|css)$':         '<rootDir>/tests/js/__mocks__/style-stub.js',
		'^@wordpress/i18n$':      '<rootDir>/tests/js/__mocks__/wordpress-i18n.js',
		'^@wordpress/components$': '<rootDir>/tests/js/__mocks__/wordpress-components.js',
		'^@wordpress/element$':   '<rootDir>/tests/js/__mocks__/wordpress-element.js',
		// @gcb/fields is the linked SDK. Map its subpaths straight to source so
		// Jest transforms them with the project's babel (node_modules — and the
		// symlinked package — are otherwise skipped by the default transform).
		'^@gcb/fields/conditional-logic$': '<rootDir>/node_modules/@gcb/fields/src/conditional-logic.js',
	},
	// The SDK source resolved above lives under a symlinked node_modules path;
	// allow babel to transform it (default config ignores all node_modules).
	transformIgnorePatterns: [
		'/node_modules/(?!@gcb/fields/)',
	],
};
