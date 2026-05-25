// Stub module for SCSS / CSS imports during Jest runs. Jest never sees
// webpack so it can't parse stylesheet imports — exporting an empty object
// makes the imports valid but a no-op.
module.exports = {};
