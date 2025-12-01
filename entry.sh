#!/bin/sh
set -euo pipefail

# 确保 nginx 运行目录存在
mkdir -p /run/nginx /var/cache/nginx
# 启动 Node 服务（后台）
node /app/dist-node/server/index.js &
node /app/dist-node/mcp/sse.js &

# 前台运行 nginx
exec nginx -g 'daemon off;'
