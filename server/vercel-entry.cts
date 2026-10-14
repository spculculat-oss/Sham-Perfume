import app from './app';

// Vercel's Node handler receives the original request, including /api/... and body.
// It is an HTTP handler, not a long-running listener.
module.exports = app;
