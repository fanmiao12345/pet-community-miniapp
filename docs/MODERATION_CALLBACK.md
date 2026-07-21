# 图片异步审核回调

## 工作流

1. 小程序压缩并上传图片到云存储。
2. `content.createPost` 创建 `pending` 动态。
3. 云函数为每张图片调用异步媒体审核接口。
4. `moderation_jobs` 保存 traceId、动态 ID 和文件 ID。
5. 微信平台推送审核结果。
6. `moderationCallback` 更新任务和动态状态。
7. 全部图片通过后动态变为 `approved`；任意图片未通过则变为 `rejected`。

## 微信后台配置

在云开发或小程序后台的消息推送设置中：

1. 新增消息推送。
2. 将媒体安全审核结果事件路由到 `moderationCallback`。
3. 使用真实账号发布图片并确认 traceId 能收到回调。

典型事件：

```json
{
  "Event": "wxa_media_check",
  "trace_id": "审核任务 ID",
  "result": {
    "suggest": "pass"
  }
}
```

## 状态

- `pending`：任务尚未全部结束，仅作者可见。
- `approved`：全部图片通过，进入公共信息流。
- `rejected`：至少一张未通过，仅作者可见，违规文件会尝试删除。
- `manual`：任务提交失败，进入管理员人工审核队列。

管理员可在“管理后台 → 内容审核”中通过或拒绝 pending/rejected 内容。人工拒绝后，迟到的异步通过回调不会覆盖人工结论。

## 异常处理

- 未配置回调：图片动态持续 pending。
- 回调 traceId 未匹配：安全忽略并记录返回结果。
- 重复回调：已处理任务安全忽略。
- 部分图片任务失败：动态继续 pending，交由人工审核。

## 开发验证

可在云函数控制台手工调用：

```json
{
  "trace_id": "moderation_jobs 中的 traceId",
  "result": { "suggest": "pass" }
}
```

仅用于开发验证，生产结果应来自微信消息推送。
