# CSU MCP

CSU 校园 API + MCP 代理。提供教务、图书馆、校车等工具，既可作为本地 API 也可直接通过 MCP 使用。

## 快速使用（推荐）

无需克隆，直接用 `npx` 一键拉起 API 和 stdio MCP：

```sh
npx csu-mcp
```

默认：

- API 监听 `12000`
- MCP stdio 指向 `http://127.0.0.1:12000`

可用环境变量调整：

- `PORT`：API 端口（默认 12000）
- `API_BASE_URL`：MCP 访问的 API 基址（默认 `http://127.0.0.1:<PORT>`）

要求：Node 20+。

### 客户端（stdio）配置示例

```json
"csu": {
  "command": "npx",
  "args": ["-y", "csu-mcp"],
  "env": {}
}
```

## 本地开发

```sh
npm install
npm run build   # 生成 dist-node 产物，bin 指向 dist-node/bin/csu-mcp.js
```

## 工具列表（MCP）

- `csu.grade`：成绩（term 可选，如 2024-2025-1）
- `csu.rank`：专业排名
- `csu.classes`：课表（term，week；week=0 为全周）
- `csu.level_exam`：等级考试
- `csu.student_plan`：培养计划
- `csu.minor_info`：辅修报名与缴费
- `csu.library_db_search`：电子资源检索
- `csu.library_book_search`：馆藏检索
- `csu.library_seat_campuses`：座位校区列表
- `csu.ecard_card`：校园卡信息（余额等）
- `csu.ecard_turnover`：校园卡流水（支持日期/金额范围筛选，返回简化字段与明细 URL）
- `csu.bus`：校车查询（date，crs01/02 途径站）

说明：多数接口会返回可直接访问的明细 URL（如图书详情、校车班次详情、校园卡流水等），方便在外部工具中二次跳转或扩展操作。
