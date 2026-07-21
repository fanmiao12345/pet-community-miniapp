import { Report, ReportStatus } from '../../../models/index';
import { listAdminReports, resolveReport } from '../../../services/repository';
import { showError, showSuccess } from '../../../utils/ui';

Page({
  data: { reports: [] as Report[], status: 'pending' as ReportStatus, loading: false },
  onShow() { this.load(); },
  switchStatus(event: WechatMiniprogram.TouchEvent) {
    this.setData({ status: event.currentTarget.dataset.status as ReportStatus });
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try { this.setData({ reports: await listAdminReports(this.data.status) }); }
    catch (error) { showError(error); }
    finally { this.setData({ loading: false }); }
  },
  handle(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || '');
    const status = event.currentTarget.dataset.action as 'resolved' | 'dismissed';
    wx.showModal({
      title: status === 'resolved' ? '确认处理' : '驳回举报',
      editable: true,
      placeholderText: '填写处理说明',
      success: async (result: { confirm: boolean; content?: string }) => {
        if (!result.confirm) return;
        try {
          await resolveReport(id, status, result.content || (status === 'resolved' ? '已处理' : '未发现违规'));
          showSuccess('处理完成');
          await this.load();
        } catch (error) { showError(error); }
      },
    });
  },
});
