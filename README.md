# 宠友圈 v1.1.0

一个面向个人开发者、课程实践和作品展示场景的微信宠物社区小程序。项目采用 **微信原生小程序 + TypeScript + CloudBase**，保留本地 Mock 模式，未配置云环境时也能演示完整社区闭环。

## 已实现能力

### 用户与宠物

- OpenID 会话初始化、手机号强制授权登录、用户自动注册和状态校验
- 用户资料、头像、隐私设置与账号注销
- 宠物创建、列表、详情和成长时间线
- 粉丝、关注、拉黑和用户主页

### 内容与互动

- 图文动态、话题、推荐流和关注流
- 点赞、评论、评论回复、收藏和删除
- 点赞、评论、关注、审核及系统通知
- 图片压缩、云存储上传和失败清理

### 安全与治理

- 客户端预检与云函数文本复检
- 图片异步内容安全审核
- pending / approved / rejected 审核状态
- 举报帖子、评论和用户
- 拉黑后隐藏内容并解除双向关注
- 禁言、停用、人工审核、举报处理和审计日志

### 运营与工程化

- 管理员 Dashboard、举报队列、审核队列和用户管理
- Mock / CloudBase 双数据源
- 深色模式基础、骨架屏、错误重试和无障碍标签
- TypeScript 类型检查、契约测试、Mock 集成测试和 GitHub Actions
- 部署、数据库、安全、隐私和发布检查文档

## 快速运行

### Mock 模式

1. 使用微信开发者工具导入项目根目录。
2. AppID 使用测试号或自己的小程序 AppID。
3. 保持 `miniprogram/config/env.ts` 中 `dataMode: 'mock'`。
4. 编译运行。

首次启动先进入手机号登录页。Mock 模式点击“模拟手机号授权”后会生成演示用户、宠物、话题、动态、关系、通知和管理员身份。管理员入口位于“我的”。

### CloudBase 模式

编辑 `miniprogram/config/env.ts`：

```ts
export const ENV = {
  dataMode: 'cloud' as 'mock' | 'cloud',
  cloudEnvId: '你的云环境 ID',
  pageSize: 10,
  uploadRoot: 'pet-community',
  securityScene: 3,
} as const;
```

CloudBase 模式必须使用真实 AppID，并在云函数 `auth` 中配置 `PHONE_HASH_SECRET`。然后依次阅读并执行：

- `docs/PHONE_AUTH.md`
- `docs/CLOUD_SETUP.md`
- `docs/CLOUD_SECURITY_RULES.md`
- `docs/MODERATION_CALLBACK.md`
- `docs/DEPLOYMENT.md`

## 云函数

| 云函数 | 职责 |
|---|---|
| auth | OpenID 会话、手机号动态 code 换号、强制登录门禁 |
| user | 用户资料、关系列表、账号注销 |
| pet | 宠物档案 |
| content | 话题、信息流、动态和图片审核任务 |
| interaction | 点赞、收藏、评论、回复、关注、通知 |
| contentSecurity | 客户端预检对应的云端安全入口 |
| moderationCallback | 异步图片审核回调 |
| governance | 举报、拉黑、黑名单 |
| admin | 统计、人工审核、举报处理、用户管理、审计 |

## 开发验证

```bash
npm install
npm run verify
```

其中：

```bash
npm run check       # 结构、JSON、页面资产、云函数语法
npm run typecheck   # TypeScript
npm test            # 契约测试 + Mock 集成测试
```

## 文档索引

- `docs/PHONE_AUTH.md`：手机号授权登录与扫码门禁
- `docs/ARCHITECTURE.md`：系统架构与关键流程
- `docs/API.md`：前端仓库接口与云函数动作
- `docs/DATABASE_SCHEMA.md`：集合与索引
- `docs/CLOUD_SETUP.md`：云环境部署
- `docs/CLOUD_SECURITY_RULES.md`：权限与安全基线
- `docs/MODERATION_CALLBACK.md`：图片审核回调
- `docs/PRIVACY_POLICY_TEMPLATE.md`：隐私说明模板
- `docs/TEST_CASES.md`：回归用例
- `docs/RELEASE_CHECKLIST.md`：发布检查清单
- `docs/DEPLOYMENT.md`：部署与回滚
- `docs/FINAL_ACCEPTANCE.md`：最终验收结果

## 核心演示路径

扫码或打开小程序 → 手机号授权登录 → 自动建立会话 → 创建宠物 → 发布图文动态 → 内容安全审核 → 首页查看 → 点赞、回复、收藏、关注 → 通知中心 → 举报或拉黑 → 管理员处理举报与审核 → 用户状态管理。

## 使用边界

这是完整的个人项目实现，但真实公开运营仍需结合主体资质、类目要求、隐私政策、用户协议、内容安全回调、数据库权限、真机兼容性、告警和运营审核进行部署。含图片动态在异步审核完成前仅作者可见；未正确配置回调时会停留在“审核中”。
