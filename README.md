# CSU MCP

CSU 校园 API + MCP 代理。提供教务、图书馆、校车等工具，既可作为本地 API 也可直接通过 MCP 使用。

## 快速使用（推荐）

无需克隆，直接用 `npx` 一键拉起 API 和 stdio MCP：

```sh
npx csu-mcp@latest
```

默认：

- API 监听 `12000`
- MCP stdio 指向 `http://127.0.0.1:12000`

可用环境变量调整：

- `PORT`：API 端口（默认 12000）
- `API_BASE_URL`：MCP 访问的 API 基址（默认 `http://127.0.0.1:<PORT>`）
- `CSU_ID` / `CSU_PWD`：统一认证学号/密码（设置后可覆盖 URL 中的 `:id/:pwd`）

### 客户端（stdio）配置示例

```json
{
        "servers": {
                "csu": {
                        "command": "npx",
                        "args": ["-y", "csu-mcp@latest"],
                        "env": {
                                "CSU_ID": <YOUR_CSU_ID>(OPTINAL but some features need it),
                                "CSU_PWD": <YOUR_CSU_PWD>(OPTINAL but some features need it),
                                "PORY": <LOCAL_API_PORT>(OPTINAL),
                                "API_BASE_URL": <API_URL>(OPTINAL)
                        }
                }
        }
}
```

## 本地开发

```sh
npm install
npm run build   # 生成 dist-node 产物，bin 指向 dist-node/bin/csu-mcp.js
```

## 鉴权说明

- 所有需要学号/密码的接口都可通过环境变量注入：`CSU_ID`、`CSU_PWD`。若设置这两个变量，URL 中的 `:id/:pwd` 会被忽略。
- 课表 `TimeInWeek` 以周日为 1 起算（“第一天”是上周日），因此 4 表示周三。

## 能力概览

- 教务：成绩、排名、课表、等级考试、培养计划、辅修信息。
- 校园卡：账户信息、近期开销流水（含明细 URL，金额换算为元）。
- 图书馆：电子资源检索、馆藏检索（含详情 URL）、座位校区/楼层信息（seat2 链接）。
- 校车：班次查询，返回 id、途径站、详情链接，便于跳转查看。

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

说明：多数接口会返回可直接访问的明细 URL（如图书详情、校车班次详情、校园卡流水等），方便在外部工具中二次跳转或扩展操作；校车接口还会返回 `id`、`cross` 站点与班次详情链接。
