#!/bin/bash
set -e
cd "$(dirname "$0")"
PORT=8899
URL="http://localhost:${PORT}/"

if command -v python3 >/dev/null 2>&1; then
  SERVER_CMD=(python3 -m http.server "$PORT" --bind 127.0.0.1)
elif command -v php >/dev/null 2>&1; then
  SERVER_CMD=(php -S "127.0.0.1:${PORT}")
elif command -v ruby >/dev/null 2>&1; then
  SERVER_CMD=(ruby -run -e httpd . -p "$PORT" -b 127.0.0.1)
else
  echo "Could not find Python 3, PHP, or Ruby to run a local preview server."
  echo "The website is upload-ready, but it cannot be tested correctly by opening HTML files directly with file://."
  echo "Press Return to close."
  read
  exit 1
fi

echo "ERN Institute local preview"
echo "Serving this folder at: $URL"
echo "Keep this Terminal window open while testing."
echo "Press Control-C when finished."

"${SERVER_CMD[@]}" >/tmp/ern-institute-preview.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT INT TERM
sleep 1
if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
  echo "Preview server could not start. See /tmp/ern-institute-preview.log"
  cat /tmp/ern-institute-preview.log
  echo "Press Return to close."
  read
  exit 1
fi
open "$URL"
wait "$SERVER_PID"
