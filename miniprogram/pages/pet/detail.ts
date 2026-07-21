import { Pet, Post } from '../../models/index';
import { getPet, listFeed, toggleFavorite, toggleLike } from '../../services/repository';
import { showError } from '../../utils/ui';

Page({
  data: { petId: '', pet: null as Pet | null, posts: [] as Post[] },
  onLoad(options: Record<string, string>) {
    this.setData({ petId: options.id || '' });
    this.load();
  },
  async load() {
    try {
      const [pet, result] = await Promise.all([
        getPet(this.data.petId),
        listFeed({ petId: this.data.petId, offset: 0, limit: 100 }),
      ]);
      wx.setNavigationBarTitle({ title: pet.name });
      this.setData({ pet, posts: result.items });
    } catch (error) { showError(error); }
  },
  openPost(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    wx.navigateTo({ url: `/pages/post/detail?id=${event.detail.id}` });
  },
  openAuthor(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    wx.navigateTo({ url: `/pages/user/profile/index?id=${event.detail.id}` });
  },
  async likePost(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    try { await toggleLike(event.detail.id); await this.load(); } catch (error) { showError(error); }
  },
  async favoritePost(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    try { await toggleFavorite(event.detail.id); await this.load(); } catch (error) { showError(error); }
  },
});
