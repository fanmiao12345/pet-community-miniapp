# 系统架构

## 1. 总体结构

```text
微信小程序 UI
  ├─ pages / components
  ├─ repository 统一接口
  │   ├─ mock-repository：本地演示与测试
  │   └─ cloud-repository：CloudBase 调用
  ├─ session：会话与当前用户
  ├─ upload：压缩、上传、清理
  └─ content-security：发布前预检
          │
          ▼
CloudBase 云函数
  ├─ auth / user / pet
  ├─ content / interaction
  ├─ contentSecurity / moderationCallback
  ├─ governance
  └─ admin
          │
          ▼
云数据库 + 云存储 + 微信 OpenAPI
```

## 2. 设计原则

- **单一数据接口**：页面只依赖 `services/repository.ts`，不直接区分 Mock 与 CloudBase。
- **服务端权威校验**：客户端校验只改善体验，身份、归属、审核和治理规则由云函数再次执行。
- **默认安全可见性**：图片动态先进入 `pending`，仅作者和管理员可见；审核通过后才进入公共信息流。
- **最小数据暴露**：OpenID、UnionID 不返回给其他用户；数据库建议禁止客户端直接读写。
- **可恢复运营**：举报、人工审核、用户状态变更均写入审计日志。

## 3. 关键流程

### 3.1 登录

```text
App.onLaunch → auth.initUser → getWXContext.OPENID
→ 查询/创建 users → 缓存当前用户 → 页面加载
```

### 3.2 发布图文动态

```text
选择图片 → 本地压缩 → 云存储上传
→ 文本安全复检 → posts 入库
→ 无图片：approved
→ 有图片：pending + mediaCheckAsync
→ moderationCallback
→ approved / rejected + 通知
```

### 3.3 社区治理

```text
用户举报 → reports.pending
→ 管理员处理 → resolved / dismissed
→ audit_logs + 系统通知
```

```text
用户拉黑 → blocks
→ 移除双向 follows
→ 信息流、评论和主页隐藏相关内容
```

### 3.4 管理员操作

管理员身份由 `users.role = admin` 决定。`admin` 云函数在每次请求中重新验证当前用户状态与角色，不信任前端传参。

## 4. 一致性策略

- 点赞、收藏、关注使用关系集合，并以联合唯一索引避免重复。
- 计数字段用于展示性能，生产环境应通过事务或定期校准任务修正极端并发下的偏差。
- 删除内容采用软删除；账号注销同时清理或匿名化关联数据。
- 异步审核与人工审核冲突时，人工审核结论优先。

## 5. 扩展方向

- 将通知写入队列，降低互动接口延迟。
- 增加定时任务校准计数、处理长期 pending 审核任务。
- 增加对象存储生命周期与孤儿文件清理。
- 将管理后台拆分为独立 Web 控制台并接入更细粒度 RBAC。


## 手机号授权门禁

```text
扫码入口 → App 保存 path/query → initUser → 未绑定跳登录页
→ 用户主动触发 getPhoneNumber → auth.bindPhone 服务端换号
→ HMAC 摘要与脱敏存储 → 返回原扫码页面
```

前端仓库层和服务端云函数同时校验手机号绑定状态，避免仅靠页面跳转形成可绕过的权限边界。完整流程见 `docs/PHONE_AUTH.md`。
