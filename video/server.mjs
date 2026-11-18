// Local server for recording: the production build at /app/, the stage at /, fonts, and /api proxied to the AI dev server.
import { readFile } from 'node:fs/promises'
import { createServer, request } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MOUNTS = [
  ['/app/', join(ROOT, 'dist')],
  ['/fonts/plex/', join(ROOT, 'node_modules/@fontsource/ibm-plex-sans/files')],
  ['/fonts/plex-ar/', join(ROOT, 'node_modules/@fontsource/ibm-plex-sans-arabic/files')],
  ['/', join(ROOT, 'video/stage')],
]
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.png': 'image/png',
}

export function startServer({ port = 8899, ai = process.env.AI_PROXY_URL || 'http://localhost:8787' } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local')
    if (url.pathname.startsWith('/api/')) {
      const target = new URL(url.pathname + url.search, ai)
      const up = request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers)
        r.pipe(res)
      })
      up.on('error', () => {
        res.writeHead(502)
        res.end()
      })
      req.pipe(up)
      return
    }
    for (const [prefix, dir] of MOUNTS) {
      if (!url.pathname.startsWith(prefix)) continue
      let rel = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html'
      if (rel.endsWith('/')) rel += 'index.html'
      const file = normalize(join(dir, rel))
      if (!file.startsWith(dir + sep)) break
      try {
        const body = await readFile(file)
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
        res.end(body)
      } catch {
        res.writeHead(404)
        res.end('not found')
      }
      return
    }
    res.writeHead(404)
    res.end()
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}
