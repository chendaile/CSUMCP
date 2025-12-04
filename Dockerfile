FROM node:20-alpine

WORKDIR /app

# 安装 nginx
RUN apk add --no-cache nginx

COPY package.json .

COPY . .

RUN npm ci --only=production && npm cache clean --force

# 覆盖 nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 入口脚本
COPY entry.sh /app/entry.sh
RUN chmod +x /app/entry.sh

# 默认端口，可运行时覆盖
ENV PORT=12000
ENV MCP_PORT=13000

# 启动 Node 服务并以 nginx 前台进程作为主进程
CMD ["/app/entry.sh"]
