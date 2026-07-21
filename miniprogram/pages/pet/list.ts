import { Pet } from '../../models/index';
import { listPets } from '../../services/repository';
import { showError } from '../../utils/ui';

Page({
  data: { pets: [] as Pet[] },
  onShow() { this.load(); },
  async load() {
    try { this.setData({ pets: await listPets() }); }
    catch (error) { showError(error); }
  },
  createPet() { wx.navigateTo({ url: '/pages/pet/create' }); },
  openPet(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/pet/detail?id=${event.currentTarget.dataset.id}` });
  },
});
