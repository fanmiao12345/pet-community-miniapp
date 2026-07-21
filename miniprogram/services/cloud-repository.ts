import { AdminStats, AuditLog, Comment, Notification, Pet, Post, Report, ReportStatus, ReportTargetType, Topic, User } from '../models/index';
import { ensurePhoneAuthorized, setSessionUser } from './session';

async function call<T>(name: string, action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!wx.cloud) throw new Error('当前基础库不支持云开发');
  if (name !== 'auth') await ensurePhoneAuthorized();
  const result = await wx.cloud.callFunction({ name, data: { action, ...data } });
  const payload = result.result as { ok: boolean; data?: T; message?: string };
  if (!payload?.ok) throw new Error(payload?.message || '云函数调用失败');
  return payload.data as T;
}

export const cloudRepository = {
  getCurrentUser: () => ensurePhoneAuthorized(),
  getUser: (userId: string) => call<User>('user', 'getProfile', { userId }),
  updateCurrentUser: async (input: Pick<User, 'nickname' | 'bio' | 'avatar'>) => {
    const user = await call<User>('user', 'updateProfile', { input });
    return setSessionUser(user);
  },
  listTopics: () => call<Topic[]>('content', 'listTopics'),
  listPets: () => call<Pet[]>('pet', 'listMine'),
  listUserPets: (userId: string) => call<Pet[]>('pet', 'listByOwner', { userId }),
  getPet: (petId: string) => call<Pet>('pet', 'get', { petId }),
  createPet: (input: Omit<Pet, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) =>
    call<Pet>('pet', 'create', { input }),
  listFeed: (options: Record<string, unknown> = {}) =>
    call<{ items: Post[]; hasMore: boolean }>('content', 'getFeed', { options }),
  getPost: (postId: string) => call<Post>('content', 'getPostDetail', { postId }),
  createPost: (input: Record<string, unknown>) => call<Post>('content', 'createPost', { input }),
  deletePost: (postId: string) => call<void>('content', 'deletePost', { postId }),
  toggleLike: (postId: string) => call<Post>('interaction', 'toggleLike', { postId }),
  toggleFavorite: (postId: string) => call<Post>('interaction', 'toggleFavorite', { postId }),
  listComments: (postId: string) => call<Comment[]>('interaction', 'listComments', { postId }),
  createComment: (
    postId: string,
    content: string,
    options?: { parentId?: string; replyToUserId?: string; replyToNickname?: string },
  ) => call<Comment>('interaction', 'createComment', { postId, content, options }),
  deleteComment: (commentId: string) => call<void>('interaction', 'deleteComment', { commentId }),
  toggleFollow: (userId: string) => call<User>('interaction', 'toggleFollow', { userId }),
  listFollowers: (userId?: string) => call<User[]>('user', 'listFollowers', { userId }),
  listFollowing: (userId?: string) => call<User[]>('user', 'listFollowing', { userId }),
  listNotifications: () => call<Notification[]>('interaction', 'listNotifications'),
  getUnreadNotificationCount: () => call<number>('interaction', 'getUnreadNotificationCount'),
  markNotificationRead: (notificationId: string) =>
    call<void>('interaction', 'markNotificationRead', { notificationId }),
  markAllNotificationsRead: () => call<void>('interaction', 'markAllNotificationsRead'),
  reportTarget: (input: { targetType: ReportTargetType; targetId: string; reason: string; detail?: string }) =>
    call<Report>('governance', 'reportTarget', { input }),
  toggleBlock: (userId: string) => call<boolean>('governance', 'toggleBlock', { userId }),
  isUserBlocked: (userId: string) => call<boolean>('governance', 'isUserBlocked', { userId }),
  listBlockedUsers: () => call<User[]>('governance', 'listBlockedUsers'),
  getAdminStats: () => call<AdminStats>('admin', 'getStats'),
  listAdminReports: (status: ReportStatus = 'pending') => call<Report[]>('admin', 'listReports', { status }),
  resolveReport: (reportId: string, status: 'resolved' | 'dismissed', resolution: string) =>
    call<Report>('admin', 'resolveReport', { reportId, status, resolution }),
  listModerationQueue: () => call<Post[]>('admin', 'listModerationQueue'),
  reviewPost: (postId: string, status: 'approved' | 'rejected', reason = '') =>
    call<Post>('admin', 'reviewPost', { postId, status, reason }),
  listAdminUsers: () => call<User[]>('admin', 'listUsers'),
  updateUserAdmin: (userId: string, input: { status: User['status']; mutedUntil?: number }) =>
    call<User>('admin', 'updateUser', { userId, input }),
  listAuditLogs: () => call<AuditLog[]>('admin', 'listAuditLogs'),
  deleteCurrentAccount: () => call<void>('user', 'deleteAccount'),
};
