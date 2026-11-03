#!/bin/sh
# Static PWA preview for the personal manager.
if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  exit 0
fi
cd /workspace/artifacts
python3 -m http.server 8080 --bind 0.0.0.0 >/tmp/mgh-static.log 2>&1 &
exit 0
