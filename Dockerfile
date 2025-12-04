FROM node:20-alpine

WORKDIR /app

# 安装 nginx
RUN apk add --no-cache nginx

COPY package.json .

COPY . .

# 安装后端依赖（仅生产）
RUN npm ci --only=production && npm cache clean --force

# 构建前端
WORKDIR /app/frontend
RUN npm ci && npm run build
WORKDIR /app

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
