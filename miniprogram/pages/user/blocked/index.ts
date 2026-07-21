import { User } from '../../../models/index';
import { listBlockedUsers, toggleBlock } from '../../../services/repository';
import { showError, showSuccess } from '../../../utils/ui';

Page({
  data: { users: [] as User[], loading: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true });
    try { this.setData({ users: await listBlockedUsers() }); }
    catch (error) { showError(error); }
    finally { this.setData({ loading: false }); }
  },
  openUser(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/user/profile/index?id=${event.currentTarget.dataset.id}` });
  },
  unblock(event: WechatMiniprogram.TouchEvent) {
    const userId = String(event.currentTarget.dataset.id || '');
    wx.showModal({
      title: '解除拉黑',
      content: '确认解除对该用户的拉黑吗？',
      success: async (result: { confirm: boolean }) => {
        if (!result.confirm) return;
        // 乐观更新:先把用户从列表移除,失败时回滚。
        const snapshot = this.data.users;
        this.setData({ users: snapshot.filter((item) => item.id !== userId) });
        try {
          await toggleBlock(userId);
          showSuccess('已解除');
        } catch (error) {
          this.setData({ users: snapshot });
          showError(error);
        }
      },
    });
  },
});
