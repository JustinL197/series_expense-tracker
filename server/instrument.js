// Sentry must initialize before Express and Prisma are required so it can
// instrument them — index.js requires this file on its very first line.
// No SENTRY_DSN (e.g. local dev) means Sentry stays inert.
require('dotenv').config();
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',

  // Errors only. Tracing would burn the free-tier quota on transaction
  // volume, and we want that headroom spent on real exceptions.
  sendDefaultPii: false,

  // Expense titles and amounts are the user's private data, and the login
  // screen promises we don't spread it around — so strip request bodies and
  // headers. URL, method and stack trace are enough to debug from.
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
    }
    return event;
  },
});

module.exports = Sentry;
