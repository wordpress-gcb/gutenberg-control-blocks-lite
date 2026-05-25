// Minimal stub for @wordpress/components used by inspector.js. We don't
// actually render PanelBody in unit tests — we only call inspector's
// helper functions — so a hollow shim suffices.
const React = require('react');

const passthrough = (name) =>
	function MockComponent({ children }) {
		return React.createElement('div', { 'data-mock': name }, children);
	};

module.exports = new Proxy(
	{},
	{
		get(_target, prop) {
			if (prop === '__esModule') return true;
			return passthrough(String(prop));
		},
	},
);
