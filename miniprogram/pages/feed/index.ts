import { ENV } from '../../config/env';
import { Post } from '../../models/index';
import { listFeed, toggleFavorite, toggleLike } from '../../services/repository';
import {
  toggleFavoriteUpdater,
  toggleLikeUpdater,
  updatePostInList,
} from '../../utils/post-update';
import { showError } from '../../utils/ui';

Page({
  data: {
    posts: [] as Post[],
    loading: false,
    hasMore: true,
    offset: 0,
    feedMode: 'all' as 'all' | 'following',
    errorMessage: '',
  },
  onShow() {
    this.refresh();
  },
  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh());
  },
  onReachBottom() {
    this.loadMore();
  },
  switchFeed(event: WechatMiniprogram.TouchEvent) {
    const feedMode = event.currentTarget.dataset.mode as 'all' | 'following';
    if (feedMode === this.data.feedMode) return;
    this.setData({ feedMode });
    this.refresh();
  },
  async refresh() {
    this.setData({ loading: true, offset: 0, hasMore: true, errorMessage: '' });
    try {
      const result = await listFeed({
        offset: 0,
        limit: ENV.pageSize,
        followingOnly: this.data.feedMode === 'following',
      });
      this.setData({ posts: result.items, hasMore: result.hasMore, offset: result.items.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载失败';
      this.setData({ errorMessage: message });
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },
  retry() {
    this.refresh();
  },
  goPublish() {
    wx.switchTab({ url: '/pages/post/create' });
  },
  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const result = await listFeed({
        offset: this.data.offset,
        limit: ENV.pageSize,
        followingOnly: this.data.feedMode === 'following',
      });
      this.setData({
        posts: [...this.data.posts, ...result.items],
        hasMore: result.hasMore,
        offset: this.data.offset + result.items.length,
      });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
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
    // 乐观更新:先在 UI 上翻转状态,避免操作后整页重拉破坏滚动位置。
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
    const snapshot = this.applyPostUpdate(postId, toggleFavoriteUpdater);
    try {
      const updated = await toggleFavorite(postId);
      this.applyPostUpdate(postId, () => updated);
    } catch (error) {
      if (snapshot) this.applyPostUpdate(postId, () => snapshot);
      showError(error);
    }
  },
});
