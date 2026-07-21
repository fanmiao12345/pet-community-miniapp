import { Post, Topic } from '../../models/index';
import { listFeed, listTopics, toggleFavorite, toggleLike } from '../../services/repository';
import {
  toggleFavoriteUpdater,
  toggleLikeUpdater,
  updatePostInList,
} from '../../utils/post-update';
import { showError } from '../../utils/ui';

Page({
  data: { topicId: '', topic: null as Topic | null, posts: [] as Post[] },
  onLoad(options: Record<string, string>) {
    this.setData({ topicId: options.id || '' });
    this.load();
  },
  async load() {
    try {
      const [topics, result] = await Promise.all([
        listTopics(),
        listFeed({ topicId: this.data.topicId, offset: 0, limit: 50 }),
      ]);
      const topic = topics.find((item) => item.id === this.data.topicId) || null;
      if (topic) wx.setNavigationBarTitle({ title: topic.name });
      this.setData({ topic, posts: result.items });
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
