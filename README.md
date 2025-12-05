[![SVG Banners](https://svg-banners.vercel.app/api?type=origin&text1=CSU%20MCP&text2=BY%20Oftheloneliness&width=800&height=400)](https://github.com/Akshay090/svg-banners)

[![Website](https://img.shields.io/badge/Website-CSUMCP.com-blue)](https://cdl.migow.club/) [![NPM Version](https://img.shields.io/npm/v/csu-mcp?color=red)](https://www.npmjs.com/package/csu-mcp) [![MIT licensed](https://img.shields.io/npm/l/%40upstash%2Fcontext7-mcp)](./LICENSE)

# 中南大学 CSU 校园**API × MCP**代理

你的全能校园**数据引擎**,
教务、图书馆、校车、校园卡一站式接入，可本地调用，也可直接走 MCP。
**能做什么：**

- _自动整理成绩、排名、等级考试，一键生成简历/学习报告_
- _课表智能渲染，周视图、日视图随取_
- _校园卡流水统计，自动生成消费分析_
- _图书检索、座位参考、电子资源直达_
- _校车班次查询、路线导航可联动高德_
- _工具可返回可跳转的明细 URL，方便扩展或二次开发_

## [百宝箱智能体体验](https://tbox.alipay.com/inc/share/202512APDjTt07695207?platform=WebService)

使用百宝箱智能体 CSU Helper 进行快速体验(不过可能由于模型性能或者上下文限制出现卡死的情况)

# 快速使用（推荐）

## 无需克隆，直接用 `npx` 一键拉起 API 和 stdio MCP：

```sh
npx csu-mcp@latest
```

默认：

- API 监听本地 `12000`端口
- MCP stdio 指向 `http://127.0.0.1:12000`

可用环境变量调整：

- `PORT`：API 端口（默认 12000）
- `API_BASE_URL`：MCP 访问的 API 基址（默认 `http://127.0.0.1:<PORT>`）
- `CSU_ID` / `CSU_PWD`：统一认证学号/密码（设置后可覆盖 URL 中的 `:id/:pwd`）
- `MCP_PORT`: sse 开放的本地端口,**注意:此时并不用于 npx 的直接使用**

**客户端（stdio）配置示例**

```json
{
        "mcpServers": {
                "csu": {
                        "command": "npx",
                        "args": ["-y", "csu-mcp@latest"],
                        "env": {
                                "CSU_ID": "YOUR_CSU_ID",
                                "CSU_PWD": "YOUR_CSU_PWD",
                                "PORT": "12000",
                                "API_BASE_URL": "http://127.0.0.1:12000"
                        }
                }
        }
}
```

## 使用已经部署的 sse 服务器:

**客户端（sse）配置示例**

```json
{
        "mcpServers": {
                "csu": {
                        "type": "sse",
                        "url": "https://cdl.migow.club/mcp/"
                }
        }
}
```

> [!NOTE]
> 在百宝箱里目前不支持通过环境变量传输账号密码,只能通过对话框传输
> 上述 env 均为可选；`CSU_ID/CSU_PWD` 供需认证的功能使用；`PORT` 为本地 API 端口；`API_BASE_URL` 为 MCP 访问基址。

# 本地开发

## 克隆 [github](https://github.com/chendaile/CSUMCP.git) 仓库

```sh
git clone https://github.com/chendaile/CSUMCP.git
npm install
npm run build

PORT=<LOCAL_PORT> npm run start:api
# 启动api服务, 可选本地端口PORT, 默认12000
API_BASE_URL=<API_URL> MCP_PORT=<SSE_PORT> npm run start:mcp:sse
# 启动sse mcp服务, 可选API_BASE_URL, 默认为本地12000端口, 可选MCP_PORT SSE端口
API_BASE_URL=<API_URL> npm run start:mcp:stdio
# 启动sse mcp服务, 可选API_BASE_URL, 默认为本地12000端口
```

## Docker 本地开发

```
docker pull oft-registry.cn-shanghai.cr.aliyuncs.com/oft/csumcp:latest
```

# 能力概览

- 教务：成绩、排名、课表、等级考试、培养计划、辅修信息。
- 校园卡：账户信息、近期开销流水（含明细 URL，金额换算为元）。
- 图书馆：电子资源检索、馆藏检索（含详情 URL）、座位校区/楼层信息（以及预约 URL）。
- 校车：班次查询，返回 id、途径站、详情链接，便于跳转查看。

# 工具列表（MCP）

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
