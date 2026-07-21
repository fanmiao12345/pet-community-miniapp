import { Comment, Post, User } from '../../models/index';
import {
  createComment,
  deleteComment,
  deletePost,
  getPost,
  getUser,
  listComments,
  toggleFavorite,
  toggleFollow,
  toggleLike,
} from '../../services/repository';
import { chooseAndSubmitReport } from '../../utils/report';
import { showError, showSuccess } from '../../utils/ui';

Page({
  data: {
    postId: '',
    post: null as Post | null,
    author: null as User | null,
    comments: [] as Comment[],
    commentText: '',
    replyTarget: null as Comment | null,
    submitting: false,
    isMine: false,
  },
  onLoad(options: Record<string, string>) {
    this.setData({ postId: options.id || '' });
    this.load();
  },
  async load() {
    try {
      const post = await getPost(this.data.postId);
      // getPost 返回后,getUser 与 listComments 之间无数据依赖,并行拉取可省一次 RTT。
      const [author, comments] = await Promise.all([
        getUser(post.authorId),
        post.moderationStatus === 'approved' ? listComments(this.data.postId) : Promise.resolve([] as Comment[]),
      ]);
      this.setData({ post, author, comments, isMine: Boolean(author.isMe) });
    } catch (error) {
      showError(error);
    }
  },
  openAuthor() {
    if (!this.data.post) return;
    wx.navigateTo({ url: `/pages/user/profile/index?id=${this.data.post.authorId}` });
  },
  async followAuthor() {
    const snapshot = this.data.author;
    if (!snapshot || snapshot.isMe) return;
    const willFollow = !snapshot.followedByMe;
    // 乐观更新:本地翻转按钮状态,API 成功后用返回值覆盖。
    this.setData({
      author: {
        ...snapshot,
        followedByMe: willFollow,
        followerCount: Math.max(0, (snapshot.followerCount || 0) + (willFollow ? 1 : -1)),
      },
    });
    try {
      const updated = await toggleFollow(snapshot.id);
      this.setData({ author: updated });
    } catch (error) {
      this.setData({ author: snapshot });
      showError(error);
    }
  },
  async reportPost() {
    try {
      await chooseAndSubmitReport('post', this.data.postId);
    } catch (error) {
      showError(error);
    }
  },
  async reportComment(event: WechatMiniprogram.TouchEvent) {
    try {
      await chooseAndSubmitReport('comment', String(event.currentTarget.dataset.id || ''));
    } catch (error) {
      showError(error);
    }
  },
  previewImage(event: WechatMiniprogram.TouchEvent) {
    const current = event.currentTarget.dataset.src as string;
    if (this.data.post) wx.previewImage({ current, urls: this.data.post.images });
  },
  onCommentInput(event: WechatMiniprogram.Input) {
    this.setData({ commentText: event.detail.value });
  },
  onCommentConfirm() {
    // 键盘"发送"键确认提交(对应 input 的 confirm-type="send")。
    this.submitComment();
  },
  startReply(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || '');
    const comment = this.data.comments.find((item: Comment) => item.id === id) || null;
    this.setData({ replyTarget: comment });
  },
  cancelReply() {
    this.setData({ replyTarget: null });
  },
  async submitComment() {
    if (this.data.submitting || !this.data.commentText.trim()) return;
    this.setData({ submitting: true });
    try {
      const reply = this.data.replyTarget;
      const comment = await createComment(this.data.postId, this.data.commentText, reply ? {
        parentId: reply.parentId || reply.id,
        replyToUserId: reply.authorId,
        replyToNickname: reply.authorSnapshot.nickname,
      } : undefined);
      // 乐观更新:用返回的 Comment 直接插到列表顶部,本地 commentCount +1,
      // 避免重新拉取整页(getPost + getUser + listComments 三次请求)。
      const post = this.data.post ? { ...this.data.post, commentCount: (this.data.post.commentCount || 0) + 1 } : this.data.post;
      this.setData({
        commentText: '',
        replyTarget: null,
        comments: [comment, ...this.data.comments],
        post,
      });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ submitting: false });
    }
  },
  async likePost() {
    const snapshot = this.data.post;
    if (!snapshot) return;
    // 乐观更新:先翻转 UI,API 成功后用返回值覆盖,失败回滚。
    this.setData({
      post: {
        ...snapshot,
        likedByMe: !snapshot.likedByMe,
        likeCount: Math.max(0, (snapshot.likeCount || 0) + (snapshot.likedByMe ? -1 : 1)),
      },
    });
    try {
      const updated = await toggleLike(this.data.postId);
      this.setData({ post: updated });
    } catch (error) {
      this.setData({ post: snapshot });
      showError(error);
    }
  },
  async favoritePost() {
    const snapshot = this.data.post;
    if (!snapshot) return;
    this.setData({
      post: {
        ...snapshot,
        favoritedByMe: !snapshot.favoritedByMe,
        favoriteCount: Math.max(0, (snapshot.favoriteCount || 0) + (snapshot.favoritedByMe ? -1 : 1)),
      },
    });
    try {
      const updated = await toggleFavorite(this.data.postId);
      this.setData({ post: updated });
    } catch (error) {
      this.setData({ post: snapshot });
      showError(error);
    }
  },
  deleteComment(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    wx.showModal({
      title: '删除评论',
      content: '确认删除这条评论吗？',
      success: async (result: { confirm: boolean }) => {
        if (!result.confirm) return;
        // 乐观更新:先从本地列表过滤掉,commentCount -1;失败时重新 load 兜底。
        const prevComments = this.data.comments;
        const prevPost = this.data.post;
        const nextComments = prevComments.filter((item: Comment) => item.id !== id);
        const post = prevPost ? { ...prevPost, commentCount: Math.max(0, (prevPost.commentCount || 0) - 1) } : prevPost;
        this.setData({ comments: nextComments, post });
        try {
          await deleteComment(id);
        } catch (error) {
          this.setData({ comments: prevComments, post: prevPost });
          showError(error);
        }
      },
    });
  },
  deletePost() {
    wx.showModal({
      title: '删除动态',
      content: '删除后将从首页和宠物时间线移除。',
      success: async (result: { confirm: boolean }) => {
        if (!result.confirm) return;
        try {
          await deletePost(this.data.postId);
          showSuccess('已删除');
          setTimeout(() => wx.navigateBack(), 300);
        } catch (error) {
          showError(error);
        }
      },
    });
  },
});
