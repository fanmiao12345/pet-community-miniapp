import { Notification } from '../../models/index';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/repository';
import { showError, showSuccess } from '../../utils/ui';

Page({
  data: {
    notifications: [] as Notification[],
    unreadCount: 0,
  },
  onShow() {
    this.load();
  },
  async load() {
    try {
      const notifications = await listNotifications();
      this.setData({
        notifications,
        unreadCount: notifications.filter((item) => !item.read).length,
      });
    } catch (error) {
      showError(error);
    }
  },
  async markAllRead() {
    if (!this.data.unreadCount) return;
    try {
      await markAllNotificationsRead();
      showSuccess('已全部标为已读');
      await this.load();
    } catch (error) {
      showError(error);
    }
  },
  async openNotification(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    const type = event.currentTarget.dataset.type as Notification['type'];
    const targetId = event.currentTarget.dataset.target as string;
    const actorId = event.currentTarget.dataset.actor as string;
    try {
      await markNotificationRead(id);
      if (type === 'follow') {
        wx.navigateTo({ url: `/pages/user/profile/index?id=${actorId}` });
      } else if (type === 'system') {
        await this.load();
      } else {
        wx.navigateTo({ url: `/pages/post/detail?id=${targetId}` });
      }
    } catch (error) {
      showError(error);
    }
  },
});
