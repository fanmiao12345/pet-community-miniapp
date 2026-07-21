import { Post } from '../../models/index';
import { listFeed, toggleFavorite, toggleLike } from '../../services/repository';
import {
  toggleFavoriteUpdater,
  toggleLikeUpdater,
  updatePostInList,
} from '../../utils/post-update';
import { showError } from '../../utils/ui';

Page({
  data: { posts: [] as Post[] },
  onShow() { this.load(); },
  async load() {
    try {
      const result = await listFeed({ favoritesOnly: true, offset: 0, limit: 100 });
      this.setData({ posts: result.items });
    } catch (error) { showError(error); }
  },
  openPost(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    wx.navigateTo({ url: `/pages/post/detail?id=${event.detail.id}` });
  },
  openAuthor(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    wx.navigateTo({ url: `/pages/user/profile/index?id=${event.detail.id}` });
  },
  applyPostUpdate(postId: string, updater: (post: Post) => Post): Post | null {
    return updatePostInList(this.data, (data) => this.setData(data), postId, updater);
  },
  async likePost(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const postId = event.detail.id;
    const snapshot = this.applyPostUpdate(postId, toggleLikeUpdater);
    try {
      const updated = await toggleLike(postId);
      this.applyPostUpdate(postId, () => updated);
    } catch (error) {
      if (snapshot) this.applyPostUpdate(postId, () => snapshot);
      showError(error);
    }
  },
  async favoritePost(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const postId = event.detail.id;
    // 收藏页里取消收藏后,该帖应从列表移除;API 成功后再做一次清理更稳妥。
    const snapshot = this.applyPostUpdate(postId, toggleFavoriteUpdater);
    try {
      const updated = await toggleFavorite(postId);
      if (!updated.favoritedByMe) {
        this.setData({ posts: this.data.posts.filter((item) => item.id !== postId) });
      } else {
        this.applyPostUpdate(postId, () => updated);
      }
    } catch (error) {
      if (snapshot) this.applyPostUpdate(postId, () => snapshot);
      showError(error);
    }
  },
});
