import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, sep } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png' };
const port = Number(process.env.PORT || 5187);
createServer(async (request, response) => {
  try {
    const requestedPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const pathname = requestedPath.startsWith('/tapa/') ? requestedPath.slice(5) : requestedPath;
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep) || !types[extname(path)]) {
      response.writeHead(404); response.end('Not found'); return;
    }
    const data = await readFile(path);
    response.writeHead(200, { 'Content-Type':types[extname(path)], 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    response.end(data);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port,'127.0.0.1',()=>console.log(`Reflection preview: http://127.0.0.1:${port}`));
