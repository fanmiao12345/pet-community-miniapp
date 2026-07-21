import { User } from '../../../models/index';
import { listAdminUsers, updateUserAdmin } from '../../../services/repository';
import { showError, showSuccess } from '../../../utils/ui';

Page({
  data: { users: [] as User[], loading: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true });
    try { this.setData({ users: await listAdminUsers() }); }
    catch (error) { showError(error); }
    finally { this.setData({ loading: false }); }
  },
  manage(event: WechatMiniprogram.TouchEvent) {
    const userId = String(event.currentTarget.dataset.id || '');
    wx.showActionSheet({
      itemList: ['恢复正常', '禁言 24 小时', '停用账号'],
      success: async (result: { tapIndex: number }) => {
        try {
          if (result.tapIndex === 0) await updateUserAdmin(userId, { status: 'active' });
          if (result.tapIndex === 1) await updateUserAdmin(userId, { status: 'muted', mutedUntil: Date.now() + 86400000 });
          if (result.tapIndex === 2) await updateUserAdmin(userId, { status: 'disabled' });
          showSuccess('状态已更新');
          await this.load();
        } catch (error) { showError(error); }
      },
    });
  },
});
