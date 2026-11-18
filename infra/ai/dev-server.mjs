// Local API for development: `npm run ai:dev`, then `AI_PROXY_URL=http://localhost:8787 npm run dev`.
// Serves the same functions as Vercel's /api folder. Reads Azure settings from .env.local (never committed).
// The hand-off and feedback use an in-memory store here, which is emptied when this server stops.
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { handler as feedback } from '../server/feedback.mjs'
import { toVercel } from '../server/http.mjs'
import { guarded } from '../server/limits.mjs'
import { handler as share } from '../server/share.mjs'
import { handler as explain } from './index.mjs'
import { handler as navigate } from './navigate.mjs'
import { handler as report } from './report.mjs'

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env.local', import.meta.url)))
} catch {
  console.log('No .env.local found: the AI functions answer 503 (not configured) unless AZURE_OPENAI_* is set in the environment.')
}
if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) process.env.STORE ||= 'memory'

const ROUTES = {
  '/api/explain': toVercel(guarded('explain', explain)),
  '/api/read-report': toVercel(report),
  '/api/navigate': toVercel(navigate),
  '/api/share': toVercel(share),
  '/api/feedback': toVercel(feedback),
}

const port = Number(process.env.AI_PORT || 8787)
createServer((req, res) => {
  const route = ROUTES[new URL(req.url, 'http://localhost').pathname]
  if (route) return void route(req, res)
  res.writeHead(404, { 'content-type': 'application/json' })
  res.end('{"error":"not_found"}')
}).listen(port, () => console.log(`API listening on http://localhost:${port} (${Object.keys(ROUTES).join(', ')})`))
