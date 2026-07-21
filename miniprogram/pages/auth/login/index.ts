import { ENV } from '../../../config/env';
import {
  bindPhoneNumber,
  consumePendingEntryUrl,
  initializeSession,
  isPhoneAuthorized,
} from '../../../services/session';
import { showError, showSuccess } from '../../../utils/ui';

Page({
  data: {
    isCloud: ENV.dataMode === 'cloud',
    loading: true,
    authorizing: false,
    agreed: false,
    statusText: '正在检查登录状态…',
  },
  redirectUrl: '',
  onLoad(options: Record<string, string>) {
    try {
      this.redirectUrl = options.redirect ? decodeURIComponent(options.redirect) : '';
    } catch (_) {
      this.redirectUrl = '';
    }
  },
  onShow() {
    this.checkSession();
  },
  async checkSession() {
    this.setData({ loading: true, statusText: '正在检查登录状态…' });
    try {
      const user = await initializeSession();
      if (isPhoneAuthorized(user)) {
        this.enterApp();
        return;
      }
      this.setData({ statusText: '授权微信绑定手机号后即可进入宠友圈' });
    } catch (error) {
      this.setData({ statusText: '登录状态检查失败，请稍后重试' });
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },
  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },
  openPrivacy() {
    wx.navigateTo({ url: '/pages/auth/privacy/index' });
  },
  async authorizePhone(event: WechatMiniprogram.CustomEvent<{ code?: string; errMsg?: string }>) {
    if (!this.data.agreed || this.data.authorizing) return;
    const code = event.detail?.code;
    if (!code) {
      const errMsg = String(event.detail?.errMsg || '');
      if (errMsg.includes('deny')) {
        showError(new Error('你取消了手机号授权，授权后才能继续使用'));
      } else if (errMsg.includes('no permission') || errMsg.includes('operateWXData')) {
        showError(new Error('当前 AppID 或小程序主体未开通手机号能力，请检查认证与权限配置'));
      } else {
        showError(new Error('未获取到授权凭证，请重试'));
      }
      return;
    }
    await this.completeAuthorization(code);
  },
  async simulateAuthorization() {
    if (!this.data.agreed || this.data.authorizing) return;
    await this.completeAuthorization();
  },
  async completeAuthorization(code?: string) {
    this.setData({ authorizing: true, statusText: '正在验证手机号…' });
    try {
      await bindPhoneNumber(code);
      showSuccess('登录成功');
      setTimeout(() => this.enterApp(), 250);
    } catch (error) {
      this.setData({ statusText: '手机号验证失败，请重新授权' });
      showError(error);
    } finally {
      this.setData({ authorizing: false });
    }
  },
  enterApp() {
    const target = consumePendingEntryUrl(this.redirectUrl || '/pages/feed/index');
    wx.reLaunch({ url: target });
  },
});
