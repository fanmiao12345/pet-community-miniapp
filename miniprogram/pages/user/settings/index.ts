import { User } from '../../../models/index';
import { deleteCurrentAccount, getCurrentUser } from '../../../services/repository';
import { clearSession } from '../../../services/session';
import { showError, showSuccess } from '../../../utils/ui';

Page({
  data: {
    user: null as User | null,
  },
  onShow() {
    this.load();
  },
  async load() {
    try {
      this.setData({ user: await getCurrentUser() });
    } catch (error) {
      showError(error);
    }
  },
  openPrivacy() {
    wx.navigateTo({ url: '/pages/auth/privacy/index' });
  },
  clearCache() {
    wx.showModal({
      title: '清理本地缓存',
      content: '仅清理本地临时状态，不会删除云端账号和内容。清理后需要重新进入小程序。',
      success: (result: { confirm: boolean }) => {
        if (!result.confirm) return;
        try {
          clearSession();
          wx.clearStorageSync();
          showSuccess('已清理');
          setTimeout(() => wx.reLaunch({ url: '/pages/auth/login/index' }), 300);
        } catch (error) { showError(error); }
      },
    });
  },
  deleteAccount() {
    wx.showModal({
      title: '注销账号',
      content: '账号资料、手机号绑定、宠物和已发布内容将被删除或匿名化。此操作不可恢复。',
      confirmText: '确认注销',
      confirmColor: '#b44236',
      success: async (result: { confirm: boolean }) => {
        if (!result.confirm) return;
        try {
          await deleteCurrentAccount();
          clearSession();
          wx.clearStorageSync();
          showSuccess('账号已注销');
          setTimeout(() => wx.reLaunch({ url: '/pages/auth/login/index' }), 500);
        } catch (error) { showError(error); }
      },
    });
  },
});
