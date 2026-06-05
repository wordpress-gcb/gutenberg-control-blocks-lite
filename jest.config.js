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
		// @wordpress-gcb/fields ships compiled JS in dist/. Map the subpath to the
		// published dist file so tests exercise what consumers actually get
		// (works for both the linked checkout and a real npm install).
		'^@wordpress-gcb/fields/conditional-logic$': '<rootDir>/node_modules/@wordpress-gcb/fields/dist/conditional-logic.js',
	},
};
