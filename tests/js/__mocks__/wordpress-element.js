// @wordpress/element is a thin shell around React/ReactDOM. For unit
// tests we just hand back the real bindings — they're already a transitive
// dep of @wordpress/scripts/jest-preset-default.
const React = require('react');
const ReactDOM = require('react-dom/client');

module.exports = {
	...React,
	createRoot: ReactDOM.createRoot,
	render: ReactDOM.render || (() => {}),
};
