// Minimal Jest mock for @react-google-maps/api used in unit tests.
const React = require('react');

exports.LoadScript = ({ children }) => React.createElement('div', null, children);
exports.GoogleMap = ({ children }) => React.createElement('div', null, children);
exports.Marker = () => React.createElement('div', null, null);
exports.useLoadScript = () => ({ isLoaded: true, loadError: null });

module.exports = exports;
