# api-contract.md — 英语变强 RPG 接口契约

> 本文件是前后端的「合同」：改接口先改这份，评审通过再动代码。
> 创建于 Day 15（2026-10-12），后续接口为**占位登记，只登记不实现**，字段待 Day 16–20 设计时确定。

## 0. 环境与 Base URL

| 项 | 值 |
|---|---|
| CloudBase 环境 ID | `zry-environment-d3f82wzy2947f766` |
| 地域 | 上海（ap-shanghai） |
| Base URL（HTTP 网关默认域名） | `https://zry-environment-d3f82wzy2947f766-1364113528.ap-shanghai.app.tcloudbase.com` |
| 前端 mock 版 | 同域名 `/site/`（静态网站托管经网关路由） |

> 注意：默认域名为开发测试用，首次访问浏览器会出现「确定访问」确认页；正式对外需绑定已备案自定义域名（Day 20 前评估）。

## 1. 通用约定

- 请求/响应均为 JSON（UTF-8），`Content-Type: application/json; charset=utf-8`。
- 统一响应包：

```json
{ "ok": true, "data": { } }
{ "ok": false, "error": "错误码或简述" }
```

- HTTP 状态码：200 成功；4xx 客户端错误；5xx 服务端错误。
- **网关转发已知事实（Day 15 实测）**：外部请求 `/api/health` 到达云函数内部时，`req.url` 变为 `/`。写业务接口的路由匹配时必须以「网关转来的实际路径」为准，不能照抄外部路径（health 函数因此对任意路径返回 200；业务函数上线时再定精确方案）。
- 缓存：健康检查与业务接口均设 `Cache-Control: no-store`。

## 2. GET /api/health — 健康检查 ✅ 已上线（Day 15）

**用途**：证明后端活着、公网可达。不做鉴权、不读数据库。

**请求**：无参数、无请求体。

**响应（200）**——真实返回示例：

```json
{
  "ok": true,
  "service": "english-rpg",
  "path": "/",
  "env": "",
  "time": "2026-10-12T01:43:09.991Z"
}
```

| 字段 | 类型 | 含义 |
|---|---|---|
| `ok` | boolean | 恒为 `true`，前端探活只看这个字段 |
| `service` | string | 项目标识 `english-rpg`，防止多环境认错服务 |
| `path` | string | 网关转发到函数内部的实际 `req.url`（观测网关行为用） |
| `env` | string | 环境变量 `TCB_ENV`（HTTP 函数中未注入，当前为空串；环境 ID 以域名中的 `zry-environment-d3f82wzy2947f766` 为准） |
| `time` | string | 服务器 UTC 时间（ISO 8601），证明非缓存响应 |

**实现**：`cloudfunctions/health/index.js`（Node.js 内置 `http` 模块，无第三方依赖）。

## 3. 待登记接口（占位，Day 16–20 实施）

> 以下仅登记存在与归属，路径、字段、错误码均在对应日期设计并回填本文件。

| 接口 | 方法（暂定） | 用途 | 计划落地 |
|---|---|---|---|
| `/api/answer` | POST | 答题判定：提交答案，返回对错与奖励（体力/装备掉落） | Day 16–17 |
| `/api/score` | POST | 提交分数：战斗结算后上报（含防作弊校验位） | Day 18 |
| `/api/rank/weekly` | GET | 周榜：按周聚合的分数排行 | Day 19 |
| `/api/titles` | GET | 称号：玩家已获称号列表与解锁条件 | Day 19–20 |

占位接口统一不对外承诺稳定性；设计定稿时在本文件补「字段说明 + 请求/响应示例 + 错误码」，并注明定稿日期。

## 4. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-12 | Day 15 创建；登记 `GET /api/health`（已上线）与 4 个占位接口 |
