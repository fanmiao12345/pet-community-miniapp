import { Topic } from '../../models/index';
import { listTopics } from '../../services/repository';
import { showError } from '../../utils/ui';

Page({
  data: { topics: [] as Topic[] },
  onShow() { this.load(); },
  async load() {
    try { this.setData({ topics: await listTopics() }); }
    catch (error) { showError(error); }
  },
  openTopic(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    wx.navigateTo({ url: `/pages/topic/detail?id=${id}` });
  },
});
