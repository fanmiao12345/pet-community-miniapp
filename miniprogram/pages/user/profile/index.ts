import { Pet, Post, User } from '../../../models/index';
import {
  getUser,
  isUserBlocked,
  listFeed,
  listUserPets,
  toggleBlock,
  toggleFavorite,
  toggleFollow,
  toggleLike,
} from '../../../services/repository';
import {
  toggleFavoriteUpdater,
  toggleLikeUpdater,
  updatePostInList,
} from '../../../utils/post-update';
import { chooseAndSubmitReport } from '../../../utils/report';
import { showError, showSuccess } from '../../../utils/ui';

Page({
  data: {
    userId: '',
    user: null as User | null,
    pets: [] as Pet[],
    posts: [] as Post[],
    blocked: false,
    loading: false,
  },
  onLoad(options: Record<string, string>) {
    this.setData({ userId: options.id || '' });
  },
  onShow() {
    this.load();
  },
  async load() {
    if (!this.data.userId || this.data.loading) return;
    this.setData({ loading: true });
    try {
      // getUser 与 isUserBlocked 之间无数据依赖,并行拉取。
      const [user, blockedRaw] = await Promise.all([
        getUser(this.data.userId),
        this.data.userId === getApp<IAppOption>().globalData.currentUserId
          ? Promise.resolve(false)
          : isUserBlocked(this.data.userId),
      ]);
      const blocked = user.isMe ? false : blockedRaw;
      const [pets, feed] = blocked ? [[], { items: [] as Post[], hasMore: false }] : await Promise.all([
        listUserPets(this.data.userId),
        listFeed({
          authorId: this.data.userId,
          offset: 0,
          limit: 50,
          includeOwnPending: Boolean(user.isMe),
        }),
      ]);
      wx.setNavigationBarTitle({ title: user.isMe ? '我的主页' : user.nickname });
      this.setData({ user, blocked, pets, posts: feed.items });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },
  async followUser() {
    const snapshot = this.data.user;
    if (!snapshot || snapshot.isMe || this.data.blocked) return;
    const willFollow = !snapshot.followedByMe;
    // 乐观更新:本地翻转 followedByMe 和 followerCount,API 成功后用返回值覆盖。
    this.setData({
      user: {
        ...snapshot,
        followedByMe: willFollow,
        followerCount: Math.max(0, (snapshot.followerCount || 0) + (willFollow ? 1 : -1)),
      },
    });
    try {
      const updated = await toggleFollow(snapshot.id);
      this.setData({ user: updated });
    } catch (error) {
      this.setData({ user: snapshot });
      showError(error);
    }
  },
  blockUser() {
    const snapshot = this.data.user;
    const prevBlocked = this.data.blocked;
    if (!snapshot || snapshot.isMe) return;
    const willBlock = !prevBlocked;
    wx.showModal({
      title: willBlock ? '拉黑用户' : '解除拉黑',
      content: willBlock ? '拉黑后双方关注关系会解除，你将不再看到对方内容。' : '解除后可重新查看和关注对方。',
      success: async (result: { confirm: boolean }) => {
        if (!result.confirm) return;
        // 乐观更新:本地切换 blocked 状态;拉黑后立刻清空对方帖子显示,解除后保持空列表直到下次 load。
        this.setData({ blocked: willBlock, posts: willBlock ? [] : this.data.posts });
        try {
          const blocked = await toggleBlock(snapshot.id);
          showSuccess(blocked ? '已拉黑' : '已解除拉黑');
          // 解除拉黑后需要重拉帖子(本地没有缓存);拉黑则无需拉。
          if (!blocked) await this.load();
        } catch (error) {
          this.setData({ blocked: prevBlocked, posts: this.data.posts });
          showError(error);
        }
      },
    });
  },
  async reportUser() {
    try {
      await chooseAndSubmitReport('user', this.data.userId);
    } catch (error) {
      showError(error);
    }
  },
  goRelations(event: WechatMiniprogram.TouchEvent) {
    const mode = event.currentTarget.dataset.mode as 'followers' | 'following';
    wx.navigateTo({ url: `/pages/user/relations/index?id=${this.data.userId}&mode=${mode}` });
  },
  openPet(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/pet/detail?id=${event.currentTarget.dataset.id}` });
  },
  openPost(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    wx.navigateTo({ url: `/pages/post/detail?id=${event.detail.id}` });
  },
  openAuthor(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    if (event.detail.id === this.data.userId) return;
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
