# 数据库结构 v1.1.0

业务主键使用云数据库 `_id`，返回小程序时映射为 `id`。时间字段统一使用毫秒时间戳。

## users

| 字段 | 类型 | 说明 |
|---|---|---|
| openid | string | 微信 OpenID，唯一；注销后替换为匿名标识 |
| unionid | string | 可选 UnionID |
| nickname | string | 昵称 |
| avatar | string | 本地默认资源或云 fileID |
| bio | string | 简介 |
| status | string | active / muted / disabled / deleted |
| role | string | user / admin |
| mutedUntil | number | 禁言截止时间 |
| createdAt / updatedAt | number | 创建/更新时间 |
| lastLoginAt | number | 最近登录时间 |
| phoneBound | boolean | 是否完成手机号验证 |
| phoneNumberMasked | string | 脱敏手机号，仅本人和必要管理场景展示 |
| phoneCountryCode | string | 国家或地区码 |
| phoneVerifiedAt | number | 最近手机号验证时间 |
| phoneKey | string | 服务端 HMAC 摘要，用于防重复绑定；公开接口不返回 |
| deletedAt | number | 注销时间 |

## pets

| 字段 | 类型 | 说明 |
|---|---|---|
| ownerId | string | 所属用户 ID |
| name | string | 宠物名 |
| species | string | cat / dog / other |
| breed | string | 品种 |
| gender | string | male / female / unknown |
| birthday | string | YYYY-MM-DD |
| avatar | string | 云 fileID 或默认资源 |
| bio | string | 简介 |
| createdAt / updatedAt | number | 时间 |

## topics

| 字段 | 类型 | 说明 |
|---|---|---|
| name | string | 话题名 |
| description | string | 描述 |
| icon | string | Emoji 或图标 |
| sortOrder | number | 排序 |
| status | string | active / hidden |

## posts

| 字段 | 类型 | 说明 |
|---|---|---|
| authorId / petId | string | 作者、宠物 ID |
| authorSnapshot / petSnapshot | object | 展示快照 |
| content | string | 正文，最多 1000 字 |
| images | string[] | 云 fileID，最多 9 张 |
| topicId / topicName | string | 话题及快照 |
| moderationStatus | string | pending / approved / rejected |
| moderationReason | string | 审核原因或进度 |
| moderationTraceIds | string[] | 异步审核 traceId |
| reviewedAt / reviewedBy | number / string | 人工或自动审核信息 |
| publishStatus | string | published / deleted |
| likeCount / commentCount / favoriteCount | number | 展示计数 |
| createdAt / deletedAt | number | 时间 |

## comments

| 字段 | 类型 | 说明 |
|---|---|---|
| postId / authorId | string | 动态、作者 ID |
| authorSnapshot | object | 作者快照 |
| content | string | 评论内容，最多 300 字 |
| status | string | published / deleted |
| parentId | string | 被回复评论 ID，可空 |
| replyToUserId / replyToNickname | string | 回复对象快照，可空 |
| createdAt / deletedAt | number | 时间 |

## likes / favorites / follows

| 字段 | 类型 | 说明 |
|---|---|---|
| userId | string | 发起用户 |
| targetId | string | 动态或目标用户 ID |
| createdAt | number | 创建时间 |

## blocks

| 字段 | 类型 | 说明 |
|---|---|---|
| userId | string | 拉黑发起者 |
| targetId | string | 被拉黑用户 |
| createdAt | number | 创建时间 |

## notifications

| 字段 | 类型 | 说明 |
|---|---|---|
| userId | string | 接收者 |
| actorId / actorSnapshot | string / object | 触发者或 system |
| type | string | like / comment / follow / moderation / system |
| targetId / targetSummary | string | 目标及摘要 |
| read | boolean | 是否已读 |
| createdAt | number | 创建时间 |

## moderation_jobs

| 字段 | 类型 | 说明 |
|---|---|---|
| postId / authorId / fileId | string | 关联对象 |
| traceId | string | 微信异步审核任务 ID |
| type | string | image |
| status | string | pending / approved / rejected / manual |
| suggest | string | pass / review / risky |
| reason | string | 失败原因 |
| callbackPayload | object | 原始回调，注意访问控制和保留期限 |
| createdAt / updatedAt | number | 时间 |

## reports

| 字段 | 类型 | 说明 |
|---|---|---|
| reporterId / reporterSnapshot | string / object | 举报者 |
| targetType | string | post / comment / user |
| targetId / targetOwnerId | string | 举报目标及所有者 |
| targetSummary | string | 目标摘要 |
| reason / detail | string | 原因与补充说明 |
| status | string | pending / resolved / dismissed |
| handlerId / resolution | string | 处理人和结论 |
| createdAt / handledAt | number | 时间 |

## audit_logs

| 字段 | 类型 | 说明 |
|---|---|---|
| adminId | string | 管理员 ID |
| action | string | 操作类型 |
| targetType / targetId | string | 目标 |
| detail | string | 操作详情 |
| createdAt | number | 时间 |
