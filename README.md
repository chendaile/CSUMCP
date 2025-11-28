# CSU MCP

本项目提供 CSU 校园相关 API + MCP 代理，支持两种运行方式：

- HTTP（SSE）模式：适合 HTTP 连接。
- stdio 模式：适合通过 `npx` 拉起 MCP 的客户端。

## 快速开始

1. 安装依赖  
   `npm install`

2. 启动 API（教务/图书馆等）  
   `npx csu-api`  
   默认监听 12000，可用 `PORT` 自定义。

3. 启动 MCP

- HTTP（SSE）(默认 13000 端口)：`API_BASE_URL=http://127.0.0.1:12000 npx csu-mcp-sse`
- stdio：`API_BASE_URL=http://127.0.0.1:12000 npx csu-mcp-stdio`

客户端配置示例（stdio）：

```json
"csu": {
  "command": "npx",
  "args": ["-y", "csu-mcp-stdio@0.1.0"]
}
```

## 工具列表

- csu.grade：查询成绩，可选 term（示例：2024-2025-1）。
- csu.rank：查询专业排名。
- csu.classes：课表（term，week；week=0 表示全周）。
- csu.level_exam：等级考试。
- csu.student_info：学生信息 PDF（base64）。
- csu.student_plan：培养计划。
- csu.minor_info：辅修报名与缴费。
- csu.summary：成绩 Markdown 汇总（term 隐藏，取全部学期）。
- csu.library_db_search：电子资源检索。
- csu.library_book_search：馆藏检索。
- csu.library_book_copies：复本/借阅信息。
- csu.library_seat_campuses：座位校区列表。
- csu.bus：校车查询（date，crs01/02 途径站）。
