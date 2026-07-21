import { Post } from '../../../models/index';
import { listModerationQueue, reviewPost } from '../../../services/repository';
import { showError, showSuccess } from '../../../utils/ui';

Page({
  data: { posts: [] as Post[], loading: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loading: true });
    try { this.setData({ posts: await listModerationQueue() }); }
    catch (error) { showError(error); }
    finally { this.setData({ loading: false }); }
  },
  openPost(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/post/detail?id=${event.currentTarget.dataset.id}` });
  },
  review(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || '');
    const status = event.currentTarget.dataset.status as 'approved' | 'rejected';
    wx.showModal({
      title: status === 'approved' ? '通过内容' : '拒绝内容',
      editable: status === 'rejected',
      placeholderText: '填写拒绝原因',
      success: async (result: { confirm: boolean; content?: string }) => {
        if (!result.confirm) return;
        try {
          await reviewPost(id, status, result.content || '');
          showSuccess(status === 'approved' ? '已通过' : '已拒绝');
          await this.load();
        } catch (error) { showError(error); }
      },
    });
  },
});
