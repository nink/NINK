module.exports = async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    message: 'Nink ingest endpoint is live',
    has_supabase_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    has_cron_secret: Boolean(process.env.CRON_SECRET)
  }, null, 2));
};
