// Food Basics — automatic flyer ingest via Flipp (replaces blocked HTML scrape)
const base = require('./ingest-flipp');

module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'https://www.nink.com');
  url.pathname = '/api/ingest-flipp';
  url.searchParams.set('store', 'foodbasics');
  req.url = `${url.pathname}?${url.searchParams.toString()}`;
  return base(req, res);
};
