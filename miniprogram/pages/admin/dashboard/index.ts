import { AdminStats } from '../../../models/index';
import { getAdminStats } from '../../../services/repository';
import { showError } from '../../../utils/ui';

Page({
  data: { stats: null as AdminStats | null },
  onShow() { this.load(); },
  async load() {
    try { this.setData({ stats: await getAdminStats() }); }
    catch (error) { showError(error); }
  },
  openReports() { wx.navigateTo({ url: '/pages/admin/reports/index' }); },
  openModeration() { wx.navigateTo({ url: '/pages/admin/moderation/index' }); },
  openUsers() { wx.navigateTo({ url: '/pages/admin/users/index' }); },
  openAudit() { wx.navigateTo({ url: '/pages/admin/audit/index' }); },
});
