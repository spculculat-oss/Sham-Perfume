#!/usr/bin/env bash
# «سيرفر الروبوتات» — the start of the server on Render (render.yaml / the root Dockerfile).
# Takes a copy of the site from GitHub (public: no key needed to read it), installs its libraries, then keeps the
# robots' server running (scripts/robots/server.mts). Exit 75 = the server updated its own code: start again.
# While the libraries install, a tiny page answers /health so Render knows the server is coming up.
set -u
REPO="${ROBOTS_REPO:-spculculat-oss/Sham-Perfume}"
WORK="${ROBOTS_WORK_DIR:-/work}"
PORT="${PORT:-10000}"

placeholder() {
  node -e "require('http').createServer((q,s)=>{s.writeHead(q.url==='/status'?503:200,{'Content-Type':'text/plain; charset=utf-8','Access-Control-Allow-Origin':'*'});s.end('سيرفر الروبوتات بيتجهز…')}).listen(${PORT},'0.0.0.0')" &
  echo $!
}

until [ -d "$WORK/.git" ]; do
  git clone -q --depth=50 --single-branch --branch main "https://github.com/${REPO}.git" "$WORK" && break
  echo "[boot] clone failed, retrying in 30s"; rm -rf "$WORK"; sleep 30
done
cd "$WORK" || exit 1
git config user.name "Sham robots server"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

while true; do
  pid=$(placeholder)
  for attempt in 1 2 3; do
    bun install --frozen-lockfile && break
    echo "[boot] install failed (attempt $attempt)"; sleep 20
  done
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  node --import tsx scripts/robots/server.mts
  code=$?
  echo "[boot] server stopped (exit $code)"
  [ "$code" -eq 75 ] && continue
  [ "$code" -eq 0 ] && exit 0
  sleep 15
done
