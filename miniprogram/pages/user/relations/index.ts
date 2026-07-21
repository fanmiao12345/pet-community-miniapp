import { User } from '../../../models/index';
import { listFollowers, listFollowing, toggleFollow } from '../../../services/repository';
import { showError } from '../../../utils/ui';

Page({
  data: {
    userId: '',
    mode: 'following' as 'followers' | 'following',
    users: [] as User[],
  },
  onLoad(options: Record<string, string>) {
    const mode = options.mode === 'followers' ? 'followers' : 'following';
    this.setData({ userId: options.id || getApp<IAppOption>().globalData.currentUserId, mode });
    wx.setNavigationBarTitle({ title: mode === 'followers' ? '粉丝' : '关注' });
  },
  onShow() {
    this.load();
  },
  async load() {
    try {
      const users = this.data.mode === 'followers'
        ? await listFollowers(this.data.userId)
        : await listFollowing(this.data.userId);
      this.setData({ users });
    } catch (error) {
      showError(error);
    }
  },
  openUser(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: `/pages/user/profile/index?id=${event.currentTarget.dataset.id}` });
  },
  async followUser(event: WechatMiniprogram.TouchEvent) {
    const userId = event.currentTarget.dataset.id as string;
    const snapshot = this.data.users;
    // 乐观更新:在 following 列表里取消关注,API 成功后把该用户从列表移除;
    // 在 followers 列表里则只更新 followedByMe 标志位,不动列表成员。
    const target = snapshot.find((item) => item.id === userId);
    const willFollow = target ? !target.followedByMe : true;
    if (target) {
      this.setData({
        users: snapshot.map((item) => item.id === userId ? { ...item, followedByMe: willFollow } : item),
      });
    }
    try {
      const updated = await toggleFollow(userId);
      if (this.data.mode === 'following' && !updated.followedByMe) {
        this.setData({ users: this.data.users.filter((item) => item.id !== userId) });
      } else if (target) {
        this.setData({
          users: this.data.users.map((item) => item.id === userId ? { ...item, followedByMe: updated.followedByMe } : item),
        });
      }
    } catch (error) {
      this.setData({ users: snapshot });
      showError(error);
    }
  },
});
