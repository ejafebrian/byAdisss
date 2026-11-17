import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let cachedApp = null;
let bootError = null;

export default function handler(req, res) {
  if (!cachedApp && !bootError) {
    try {
      const mod = require('./_app.cjs');
      cachedApp = mod.default || mod;
    } catch (err) {
      bootError = err;
      console.error('Vercel serverless boot error:', err);
    }
  }

  if (bootError || !cachedApp) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: `Backend gagal diinisialisasi: ${bootError?.message || 'Serverless bundle tidak ditemukan'}`,
      })
    );
    return;
  }

  return cachedApp(req, res);
}
