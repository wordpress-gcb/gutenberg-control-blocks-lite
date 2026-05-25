// Minimal stub for @wordpress/i18n. Production: provided as a wp.i18n
// global by WP at runtime, mapped by webpack to a wp-i18n external. Jest
// has no webpack, so we shim the two functions we use.
module.exports = {
	__: (text) => text,
	sprintf: (format, ...args) => {
		let i = 0;
		return String(format).replace(/%[ds]/g, () => String(args[i++] ?? ''));
	},
	_n: (single, plural, count) => (count === 1 ? single : plural),
};
