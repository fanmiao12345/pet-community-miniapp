# 手机号授权登录与扫码门禁 v1.1.0

## 1. 目标

任何用户通过普通入口、分享卡片或带页面参数的小程序码进入时，都必须先完成微信绑定手机号授权，才可以访问社区内容和业务接口。手机号验证成功后会记入账号，下次进入不重复弹授权。

## 2. 前置条件

- 使用真实小程序 AppID，游客模式只能运行 Mock 模拟授权。
- 小程序主体需要具备获取手机号能力；生产环境需按微信公众平台要求完成主体认证和权限配置。
- 已开通 CloudBase，并部署 `auth` 云函数及其 `config.json`。
- 云函数环境变量配置 `PHONE_HASH_SECRET`，建议使用至少 32 字节随机字符串。

生成示例：

```bash
openssl rand -hex 32
```

不要把该值写入小程序前端或 Git 仓库。该密钥投入生产后不要直接更换；如需轮换，必须同步迁移现有 `phoneKey`，否则重复绑定校验会失效。

## 3. 登录流程

```text
用户扫码进入任意页面
        ↓
App 捕获原始 path + query
        ↓
auth.initUser 取得 OpenID 对应用户
        ↓
未绑定手机号 → reLaunch 登录页
        ↓
用户勾选隐私说明并点击授权按钮
        ↓
button open-type=getPhoneNumber 返回动态 code
        ↓
auth.bindPhone 在云函数中消费 code
        ↓
微信 OpenAPI 返回手机号
        ↓
服务端生成 HMAC 摘要 + 脱敏号码，不保存完整号码
        ↓
标记 phoneBound / phoneVerifiedAt
        ↓
返回原扫码页面
```

## 4. 数据最小化

`users` 仅新增：

- `phoneBound`: 是否已完成手机号验证
- `phoneNumberMasked`: 脱敏展示，例如 `138****0000`
- `phoneCountryCode`: 国家或地区码
- `phoneVerifiedAt`: 验证时间
- `phoneKey`: `HMAC-SHA256(countryCode:purePhoneNumber)`，用于防重复绑定

项目不持久化完整手机号。`phoneKey` 和 OpenID 不通过公开用户接口返回。

## 5. 扫码返回原页面

`App.onLaunch` 保存扫码入口的 `path` 和 `query`。登录完成后通过 `wx.reLaunch` 回到原始页面，例如：

```text
/pages/post/detail?id=post_xxx
```

登录和隐私页属于公开路由，不会触发自身循环跳转。

## 6. 双重门禁

### 前端

- `repository.ts` 所有业务操作先调用 `ensurePhoneAuthorized()`。
- 上传、内容安全和 CloudBase 调用同样要求手机号已验证。
- 未验证时统一跳到登录页。

### 服务端

除 `auth` 外，`user`、`pet`、`content`、`interaction`、`contentSecurity`、`governance`、`admin` 均验证：

```text
phoneVerifiedAt 存在且 phoneKey 存在
```

因此即使绕过前端，也无法调用业务云函数。

## 7. 失败场景

| 场景 | 处理 |
|---|---|
| 用户拒绝授权 | 停留登录页，不开放社区能力 |
| 动态 code 为空或过期 | 提示重新点击授权 |
| AppID/主体无权限 | 提示检查主体认证与手机号权限 |
| 手机号已绑定其他账号 | 拒绝绑定，进入账号申诉流程 |
| `PHONE_HASH_SECRET` 未配置 | 云函数失败关闭，不保存不安全摘要 |
| 游客模式 | 使用 Mock 模拟授权，不读取真实手机号 |

## 8. 部署检查

1. 把 `project.config.json` 的 `appid` 替换为真实 AppID。
2. 将 `miniprogram/config/env.ts` 切换为 `cloud`。
3. 设置 `PHONE_HASH_SECRET`。
4. 上传部署 `auth` 云函数并应用 OpenAPI 权限。
5. 为 `users.openid` 创建唯一索引。
6. 为 `users.phoneKey` 创建普通索引；唯一性由云函数校验。
7. 使用两个真实微信账号分别授权，验证账号隔离和重复绑定逻辑。
8. 从动态详情小程序码进入，验证授权后回到原详情页。
9. 拒绝授权，确认无法浏览、发布或互动。
