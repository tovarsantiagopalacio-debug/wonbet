// Servidor estático mínimo, sin dependencias externas.
// Solo sirve los archivos de esta carpeta (index.html, style.css, app.js).
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5500;

// En local no hace falta nada: app.js ya trae 'http://localhost:3000' como default.
// Desplegado en Railway, GATEWAY_URL apunta al dominio público del gateway — se
// inyecta como script inline en index.html, sin agregar ningún paso de build.
const GATEWAY_URL = process.env.GATEWAY_URL || '';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const ruta = req.url === '/' ? '/index.html' : req.url;
  const archivo = path.join(__dirname, ruta);

  fs.readFile(archivo, (err, contenido) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 - No encontrado');
    }
    const ext = path.extname(archivo);
    let cuerpo = contenido;
    if (ruta === '/index.html' && GATEWAY_URL) {
      const script = `<script>window.__GATEWAY_URL__=${JSON.stringify(GATEWAY_URL)};</script>`;
      cuerpo = Buffer.from(contenido.toString('utf-8').replace('</head>', `${script}</head>`));
    }
    res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream' });
    res.end(cuerpo);
  });
});

server.listen(PORT, () => {
  console.log(`🖥️  Frontend de WonBet corriendo en http://localhost:${PORT}`);
});
