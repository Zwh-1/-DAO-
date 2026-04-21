# 身份切换与 activeRole

## 两个概念

| 字段 | 含义 |
|------|------|
| **`roles`（JWT 内）** | 该钱包地址**当前拥有的能力集合**，来自登录/刷新时后端按 `ROLES_SOURCE` 解析（内存表或链上）。 |
| **`activeRole`** | 用户**当前以哪个身份使用产品**（侧栏、工作台、钱包页），须在 `roles` 之内；与导航/展示上下文相关。 |

## 谁能切到哪个身份

- **只能**切换到 JWT 的 `roles` 里已有的角色；没有的角色在 UI 上不可选（禁用或不下发）。
- **篡改本地存储**中的 `activeRole` **不会**获得 API 权限：敏感接口仍用 `requireRole("oracle")` 等校验 **JWT 中的 `roles`**。
- 若希望服务端与客户端对「当前身份」一致，JWT 载荷内包含 **`activeRole`**（见后端 `signJwt`），切换身份时调用 **`POST /v1/auth/active-role`** 换取新 Token。

## 如何获得新角色（非 Admin）

- 生产环境：链上 `PlatformRoleRegistry` / `ArbitratorPool` 等授予后，使用 **「同步链上角色」**（`POST /v1/auth/refresh-roles`）或重新登录，使 JWT 内 `roles` 更新。
- 详见 [链上角色与权限.md](../链上角色与权限.md)。

## 与前端枚举的差异

- 导航里若使用 `dao_admin` 而后端使用 `dao`，可能导致菜单过滤不一致；见 [后端路由矩阵.md](./后端路由矩阵.md) 文末「JWT 角色与路由层缺口」。

## 相关文档

- [成员权限.md](./成员权限.md) — member 与可调用 API 关系
- [后端路由矩阵.md](./后端路由矩阵.md) — HTTP 鉴权类型
- [链上角色与权限.md](../链上角色与权限.md) — `ROLES_SOURCE` 与链上判定
