# API 与数据仓库接口 v1.1.0

页面统一从 `miniprogram/services/repository.ts` 调用接口。Mock 与 CloudBase 保持同名能力。除登录和隐私说明外，所有仓库接口都要求已完成手机号验证。
## 登录与手机号

- `initializeSession()`：建立 OpenID 会话，允许返回未绑定手机号的用户。
- `bindPhoneNumber(code)`：将 `getPhoneNumber` 回调的动态 code 发送到 `auth.bindPhone`。
- `ensurePhoneAuthorized()`：所有业务接口的统一前置门禁。
- `guardPhoneAuthorization()`：扫码或页面进入时跳转登录页并保存回跳地址。

`auth` 云函数动作：`initUser`、`getSession`、`bindPhone`。客户端从不提交明文手机号。


## 用户与宠物

- `getCurrentUser()`
- `getUser(userId)`
- `updateCurrentUser(input)`
- `deleteCurrentAccount()`
- `listPets()` / `listUserPets(userId)`
- `getPet(petId)` / `createPet(input)`

对应云函数：`auth`、`user`、`pet`。

## 内容

- `listTopics()`
- `listFeed(options)`
- `getPost(postId)`
- `createPost(input)`
- `deletePost(postId)`

`listFeed` 主要参数：`offset`、`limit`、`topicId`、`authorId`、`petId`、`followingOnly`、`favoritesOnly`、`includeOwnPending`。

对应云函数：`content`。

## 互动与通知

- `toggleLike(postId)`
- `toggleFavorite(postId)`
- `listComments(postId)`
- `createComment(postId, content, { parentId, replyToUserId, replyToNickname })`
- `deleteComment(commentId)`
- `toggleFollow(userId)`
- `listFollowers(userId?)` / `listFollowing(userId?)`
- `listNotifications()`
- `getUnreadNotificationCount()`
- `markNotificationRead(id)` / `markAllNotificationsRead()`

对应云函数：`interaction`、`user`。

## 治理

- `reportTarget({ targetType, targetId, reason, detail })`
- `toggleBlock(userId)`
- `isUserBlocked(userId)`
- `listBlockedUsers()`

对应云函数：`governance`。举报明细会执行文本安全检测。

## 管理员

- `getAdminStats()`
- `listAdminReports(status)`
- `resolveReport(reportId, status, resolution)`
- `listModerationQueue()`
- `reviewPost(postId, status, reason)`
- `listAdminUsers()`
- `updateUserAdmin(userId, { status, mutedUntil })`
- `listAuditLogs()`

对应云函数：`admin`。每个请求都会重新验证当前用户 `role === admin` 且 `status === active`。

## 内容安全与上传

- `checkContentSecurity(content, scene)`：调用 `contentSecurity`
- `uploadImage(path, category)` / `uploadImages(paths, category)`：压缩后调用 `wx.cloud.uploadFile`
- `moderationCallback`：微信异步媒体审核结果入口，不由页面直接调用

## 错误约定

云函数统一返回：

```ts
{ ok: true, data: T }
// 或
{ ok: false, message: string }
```

`cloud-repository` 将失败响应转换为异常，页面捕获后通过统一 UI 提示展示。
