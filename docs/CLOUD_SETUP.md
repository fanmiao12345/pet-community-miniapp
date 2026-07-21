# CloudBase 配置指南 v1.1.0

## 1. 开通环境

1. 在微信开发者工具中开通云开发。
2. 创建开发环境和生产环境，记录环境 ID。
3. 将目标环境 ID 写入 `miniprogram/config/env.ts`。
4. 开发验收完成后将 `dataMode` 改为 `cloud`。
5. 使用真实且具备手机号能力的小程序 AppID，游客模式不能验证真实手机号。

## 2. 创建集合

- `users`
- `pets`
- `topics`
- `posts`
- `comments`
- `likes`
- `favorites`
- `follows`
- `notifications`
- `moderation_jobs`
- `reports`
- `blocks`
- `audit_logs`

建议所有集合默认禁止小程序客户端直接读写，仅允许云函数访问。

## 3. 初始化话题

在 `topics` 中创建：

```json
{
  "name": "晒宠日常",
  "description": "分享可爱的日常瞬间",
  "icon": "📷",
  "sortOrder": 1,
  "status": "active"
}
```

另建“养宠求助”“用品分享”等话题。

## 4. 部署云函数

先为 `auth` 云函数设置环境变量：

- `PHONE_HASH_SECRET`：至少 32 字节随机字符串，用于生成手机号 HMAC 摘要。

然后逐个执行“上传并部署：云端安装依赖”：

- `auth`
- `user`
- `pet`
- `content`
- `interaction`
- `contentSecurity`
- `moderationCallback`
- `governance`
- `admin`

带 `config.json` 的云函数需要确认 OpenAPI 权限已成功应用。

## 5. 环境变量

- `CONTENT_SECURITY_ENABLED=false`：仅用于开发联调，关闭内容安全调用。
- `CONTENT_SECURITY_FAIL_OPEN=true`：安全接口异常时放行，仅用于临时排错，不建议生产使用。

生产环境建议默认启用内容安全并失败关闭。

## 6. 索引

| 集合 | 索引 | 约束 |
|---|---|---|
| users | `openid` | 唯一 |
| users | `phoneKey` | 普通；重复绑定由云函数校验 |
| pets | `ownerId + createdAt desc` | 普通 |
| posts | `moderationStatus + publishStatus + createdAt desc` | 普通 |
| posts | `authorId + publishStatus + createdAt desc` | 普通 |
| posts | `topicId + moderationStatus + createdAt desc` | 普通 |
| comments | `postId + status + createdAt asc` | 普通 |
| likes | `userId + targetId` | 唯一 |
| favorites | `userId + targetId` | 唯一 |
| follows | `userId + targetId` | 唯一 |
| follows | `targetId + createdAt desc` | 普通 |
| notifications | `userId + read + createdAt desc` | 普通 |
| moderation_jobs | `traceId` | 唯一（空值任务需注意） |
| moderation_jobs | `postId + status` | 普通 |
| reports | `status + createdAt desc` | 普通 |
| reports | `reporterId + targetType + targetId + status` | 普通 |
| blocks | `userId + targetId` | 唯一 |
| audit_logs | `adminId + createdAt desc` | 普通 |

## 7. 创建管理员

首次以目标微信账号打开小程序，让 `auth` 创建用户。然后在云数据库中将该用户设置为：

```json
{
  "role": "admin",
  "status": "active"
}
```

普通用户保持 `role: "user"`。管理员云函数会在服务端验证角色，前端入口不是权限边界。

## 8. 图片审核回调

含图片动态创建后为 `pending`。必须按 `docs/MODERATION_CALLBACK.md` 配置消息推送，否则状态不会自动变成 `approved` 或 `rejected`。

## 9. 验收

- 首次打开后 `users` 自动新增 OpenID 对应记录，默认角色为 user 且未绑定手机号。
- 未授权手机号只能访问登录页和隐私说明页。
- 授权完成后保存脱敏号码、国家码、验证时间和 HMAC 摘要。
- 头像、宠物头像和动态图片保存为 `cloud://` fileID。
- 纯文字动态通过文本审核后公开。
- 图片动态先仅本人可见，回调通过后进入公共首页。
- 举报写入 `reports`，拉黑写入 `blocks`。
- 管理员能处理举报、审核内容和管理用户，操作写入 `audit_logs`。
