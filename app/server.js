#!/usr/bin/env node

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const AUDITS_ROOT = path.resolve(__dirname, "../audits");
const PORT = Number(process.env.PORT || 5173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

function send(response, status, body, type = "text/plain; charset=utf-8") {
  response.writeHead(status, { "content-type": type });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  const isAuditAsset = cleanPath.startsWith("audits/");
  const basePath = isAuditAsset ? path.resolve(AUDITS_ROOT, cleanPath.replace(/^audits\//, "")) : path.resolve(ROOT, cleanPath);
  const filePath = basePath;
  const allowedRoot = isAuditAsset ? AUDITS_ROOT : ROOT;

  if (!filePath.startsWith(allowedRoot)) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(response, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath);
    fs.readFile(filePath, (readError, body) => {
      if (readError) {
        send(response, 500, "Server error");
        return;
      }
      send(response, 200, body, types[ext] || "application/octet-stream");
    });
  });
});

server.listen(PORT, () => {
  console.log(`Huck Finch Audits running at http://localhost:${PORT}`);
});
