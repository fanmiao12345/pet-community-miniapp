import { Pet, Post, User } from '../../models/index';
import {
  getCurrentUser,
  getUnreadNotificationCount,
  listFeed,
  listPets,
  resetDemoData,
} from '../../services/repository';
import { clearSession } from '../../services/session';
import { showError, showSuccess } from '../../utils/ui';

Page({
  data: {
    user: null as User | null,
    pets: [] as Pet[],
    posts: [] as Post[],
    unreadCount: 0,
  },
  onShow() {
    this.load();
  },
  async load() {
    try {
      const user = await getCurrentUser();
      const [pets, result, unreadCount] = await Promise.all([
        listPets(),
        listFeed({ authorId: user.id, offset: 0, limit: 20, includeOwnPending: true }),
        getUnreadNotificationCount(),
      ]);
      this.setData({ user, pets, posts: result.items, unreadCount });
    } catch (error) {
      showError(error);
    }
  },
  goProfile() {
    if (!this.data.user) return;
    wx.navigateTo({ url: `/pages/user/profile/index?id=${this.data.user.id}` });
  },
  goPets() {
    wx.navigateTo({ url: '/pages/pet/list' });
  },
  editProfile() {
    wx.navigateTo({ url: '/pages/user/edit' });
  },
  goFavorites() {
    wx.navigateTo({ url: '/pages/user/favorites' });
  },
  goNotifications() {
    wx.navigateTo({ url: '/pages/notification/index' });
  },
  goBlocked() {
    wx.navigateTo({ url: '/pages/user/blocked/index' });
  },
  goSettings() {
    wx.navigateTo({ url: '/pages/user/settings/index' });
  },
  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/dashboard/index' });
  },
  goRelations(event: WechatMiniprogram.TouchEvent) {
    if (!this.data.user) return;
    const mode = event.currentTarget.dataset.mode as 'followers' | 'following';
    wx.navigateTo({ url: `/pages/user/relations/index?id=${this.data.user.id}&mode=${mode}` });
  },
  openPost(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/post/detail?id=${event.currentTarget.dataset.id}` });
  },
  resetData() {
    wx.showModal({
      title: '重置演示数据',
      content: '本地新增的宠物、动态、互动和通知都会被清除。云模式下此操作不会删除云端数据。',
      success: (result: { confirm: boolean }) => {
        if (!result.confirm) return;
        resetDemoData();
        clearSession();
        showSuccess('已重置');
        setTimeout(() => wx.reLaunch({ url: '/pages/auth/login/index' }), 300);
      },
    });
  },
});
