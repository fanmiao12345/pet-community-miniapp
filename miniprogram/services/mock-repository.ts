import {
  AdminStats,
  AuditLog,
  Comment,
  MockState,
  Notification,
  NotificationType,
  Pet,
  Report,
  ReportStatus,
  ReportTargetType,
  Post,
  Topic,
  User,
} from '../models/index';
import { createId } from '../utils/id';
import { formatRelativeTime } from '../utils/time';
import { checkText } from './moderation';
import { seedFollows, seedNotifications, seedState } from './mock-seed';

const STORAGE_KEY = 'pet-community-state-v1';
const CURRENT_USER_ID = 'user_me';
const STATE_VERSION = 5;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function migrateState(stored: Partial<MockState>): MockState {
  const migrated = {
    ...stored,
    version: STATE_VERSION,
    users: (stored.users || []).map((user) => ({
      ...user,
      phoneBound: user.id === CURRENT_USER_ID ? Boolean(user.phoneVerifiedAt) : (user.phoneBound ?? true),
      phoneNumberMasked: user.phoneNumberMasked || '',
    })),
    pets: stored.pets || [],
    topics: stored.topics || [],
    posts: stored.posts || [],
    comments: stored.comments || [],
    likes: stored.likes || [],
    favorites: stored.favorites || [],
    follows: stored.follows || seedFollows(CURRENT_USER_ID),
    notifications: stored.notifications || seedNotifications(CURRENT_USER_ID),
    blocks: stored.blocks || [],
    reports: stored.reports || [],
    auditLogs: stored.auditLogs || [],
  } as MockState;
  saveState(migrated);
  return migrated;
}

function loadState(): MockState {
  const stored = wx.getStorageSync(STORAGE_KEY) as Partial<MockState> | '';
  if (!stored) {
    const seeded = seedState(CURRENT_USER_ID, STATE_VERSION);
    saveState(seeded);
    return seeded;
  }
  if (stored.version !== STATE_VERSION || !stored.follows || !stored.notifications || !stored.blocks || !stored.reports) {
    return migrateState(stored);
  }
  return stored as MockState;
}

function saveState(state: MockState): void {
  wx.setStorageSync(STORAGE_KEY, state);
}

function enrichUser(state: MockState, user: User): User {
  const { phoneKey, ...safeUser } = clone(user);
  return {
    ...safeUser,
    followerCount: state.follows.filter((item) => item.targetId === user.id).length,
    followingCount: state.follows.filter((item) => item.userId === user.id).length,
    followedByMe: state.follows.some(
      (item) => item.userId === CURRENT_USER_ID && item.targetId === user.id,
    ),
    isMe: user.id === CURRENT_USER_ID,
  };
}

function enrichPost(state: MockState, post: Post): Post {
  const likedByMe = state.likes.some(
    (item) => item.userId === CURRENT_USER_ID && item.targetId === post.id,
  );
  const favoritedByMe = state.favorites.some(
    (item) => item.userId === CURRENT_USER_ID && item.targetId === post.id,
  );
  const topic = state.topics.find((item) => item.id === post.topicId);
  return {
    ...clone(post),
    likedByMe,
    favoritedByMe,
    topicName: topic?.name || '',
    createdAtText: formatRelativeTime(post.createdAt),
  };
}

function notificationMessage(type: NotificationType): string {
  if (type === 'like') return '赞了你的动态';
  if (type === 'comment') return '评论了你的动态';
  if (type === 'follow') return '关注了你';
  if (type === 'moderation') return '更新了内容审核结果';
  return '发送了一条系统通知';
}

function enrichNotification(notification: Notification): Notification {
  return {
    ...clone(notification),
    createdAtText: formatRelativeTime(notification.createdAt),
    message: notificationMessage(notification.type),
  };
}

function createNotification(
  state: MockState,
  input: Omit<Notification, 'id' | 'actorSnapshot' | 'read' | 'createdAt'>,
): void {
  if (input.userId === input.actorId) return;
  const actor = state.users.find((item) => item.id === input.actorId);
  if (!actor) return;
  state.notifications.push({
    ...input,
    id: createId('notification'),
    actorSnapshot: { nickname: actor.nickname, avatar: actor.avatar },
    read: false,
    createdAt: Date.now(),
  });
}

function postSummary(post: Post): string {
  const normalized = post.content.replace(/\s+/g, ' ').trim();
  return normalized.length > 28 ? `${normalized.slice(0, 28)}…` : normalized;
}

export function initializeDemoData(): void {
  loadState();
}

export function resetDemoData(): void {
  saveState(seedState(CURRENT_USER_ID, STATE_VERSION));
}

export async function getCurrentUser(): Promise<User> {
  return getUser(CURRENT_USER_ID);
}

export async function bindMockPhoneNumber(): Promise<User> {
  const state = loadState();
  const index = state.users.findIndex((item) => item.id === CURRENT_USER_ID);
  if (index < 0) throw new Error('用户不存在');
  state.users[index] = {
    ...state.users[index],
    phoneBound: true,
    phoneNumberMasked: '138****0000',
    phoneCountryCode: '86',
    phoneVerifiedAt: Date.now(),
    phoneKey: 'mock-current-user-phone-key',
    updatedAt: Date.now(),
  };
  saveState(state);
  return enrichUser(state, state.users[index]);
}

export async function getUser(userId: string): Promise<User> {
  const state = loadState();
  const user = state.users.find((item) => item.id === userId);
  if (!user) throw new Error('用户不存在');
  return enrichUser(state, user);
}

export async function updateCurrentUser(input: Pick<User, 'nickname' | 'bio' | 'avatar'>): Promise<User> {
  const moderation = await checkText(`${input.nickname} ${input.bio}`);
  if (!moderation.passed) throw new Error(moderation.reason);

  const state = loadState();
  const index = state.users.findIndex((item) => item.id === CURRENT_USER_ID);
  if (index < 0) throw new Error('用户不存在');
  state.users[index] = {
    ...state.users[index],
    ...input,
    updatedAt: Date.now(),
  };
  saveState(state);
  return enrichUser(state, state.users[index]);
}

export async function listTopics(): Promise<Topic[]> {
  return clone(loadState().topics).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listPets(): Promise<Pet[]> {
  return listUserPets(CURRENT_USER_ID);
}

export async function listUserPets(userId: string): Promise<Pet[]> {
  return clone(loadState().pets)
    .filter((item) => item.ownerId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPet(petId: string): Promise<Pet> {
  const pet = loadState().pets.find((item) => item.id === petId);
  if (!pet) throw new Error('宠物不存在');
  return clone(pet);
}

export async function createPet(input: Omit<Pet, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>): Promise<Pet> {
  const moderation = await checkText(`${input.name} ${input.bio}`);
  if (!moderation.passed) throw new Error(moderation.reason);

  const state = loadState();
  const pet: Pet = {
    ...input,
    id: createId('pet'),
    ownerId: CURRENT_USER_ID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.pets.push(pet);
  saveState(state);
  return clone(pet);
}

export async function listFeed(options?: {
  topicId?: string;
  offset?: number;
  limit?: number;
  authorId?: string;
  petId?: string;
  favoritesOnly?: boolean;
  followingOnly?: boolean;
  includeOwnPending?: boolean;
}): Promise<{ items: Post[]; hasMore: boolean }> {
  const state = loadState();
  const offset = options?.offset || 0;
  const limit = options?.limit || 10;
  const favoriteIds = new Set(
    state.favorites
      .filter((item) => item.userId === CURRENT_USER_ID)
      .map((item) => item.targetId),
  );
  const followingIds = new Set(
    state.follows
      .filter((item) => item.userId === CURRENT_USER_ID)
      .map((item) => item.targetId),
  );
  const blockedIds = new Set(
    state.blocks
      .filter((item) => item.userId === CURRENT_USER_ID)
      .map((item) => item.targetId),
  );

  const filtered = state.posts
    .filter((item) => item.publishStatus === 'published')
    .filter((item) =>
      item.moderationStatus === 'approved'
      || Boolean(options?.includeOwnPending && item.authorId === CURRENT_USER_ID),
    )
    .filter((item) => !options?.topicId || item.topicId === options.topicId)
    .filter((item) => !options?.authorId || item.authorId === options.authorId)
    .filter((item) => !options?.petId || item.petId === options.petId)
    .filter((item) => !options?.favoritesOnly || favoriteIds.has(item.id))
    .filter((item) => !options?.followingOnly || followingIds.has(item.authorId))
    .filter((item) => item.authorId === CURRENT_USER_ID || !blockedIds.has(item.authorId))
    .sort((a, b) => b.createdAt - a.createdAt);

  const items = filtered.slice(offset, offset + limit).map((item) => enrichPost(state, item));
  return { items, hasMore: offset + limit < filtered.length };
}

export async function getPost(postId: string): Promise<Post> {
  const state = loadState();
  const post = state.posts.find(
    (item) => item.id === postId && item.publishStatus === 'published',
  );
  if (!post) throw new Error('帖子不存在或已删除');
  const blocked = state.blocks.some((item) => item.userId === CURRENT_USER_ID && item.targetId === post.authorId);
  if (blocked && post.authorId !== CURRENT_USER_ID) throw new Error('帖子不可用');
  return enrichPost(state, post);
}

export async function createPost(input: {
  petId: string;
  topicId: string;
  content: string;
  images: string[];
}): Promise<Post> {
  // 允许纯图片发布:content 为空时跳过文本审核。
  const trimmedContent = (input.content || '').trim();
  if (trimmedContent) {
    const moderation = await checkText(trimmedContent);
    if (!moderation.passed) throw new Error(moderation.reason);
  }
  if (!trimmedContent && (!input.images || input.images.length === 0)) {
    throw new Error('请输入内容或选择图片');
  }

  const state = loadState();
  const author = state.users.find((item) => item.id === CURRENT_USER_ID);
  if (!author) throw new Error('用户不存在');
  // 宠物和话题都是可选的:不选时给空快照,UI 层据此隐藏对应展示。
  const pet = input.petId
    ? state.pets.find((item) => item.id === input.petId && item.ownerId === CURRENT_USER_ID)
    : undefined;
  const topic = input.topicId
    ? state.topics.find((item) => item.id === input.topicId)
    : undefined;

  const post: Post = {
    id: createId('post'),
    authorId: CURRENT_USER_ID,
    petId: pet ? pet.id : '',
    authorSnapshot: { nickname: author.nickname, avatar: author.avatar },
    petSnapshot: pet
      ? { name: pet.name, avatar: pet.avatar, species: pet.species }
      : { name: '', avatar: '', species: 'other' },
    content: trimmedContent,
    images: clone(input.images),
    topicId: topic ? topic.id : '',
    moderationStatus: trimmedContent.includes('[待审核]') ? 'pending' : 'approved',
    moderationReason: trimmedContent.includes('[待审核]') ? '演示模式：模拟图片异步审核' : '',
    publishStatus: 'published',
    likeCount: 0,
    commentCount: 0,
    favoriteCount: 0,
    createdAt: Date.now(),
  };
  state.posts.push(post);
  saveState(state);
  return enrichPost(state, post);
}

export async function deletePost(postId: string): Promise<void> {
  const state = loadState();
  const post = state.posts.find((item) => item.id === postId);
  if (!post) throw new Error('帖子不存在');
  if (post.authorId !== CURRENT_USER_ID) throw new Error('只能删除自己的帖子');
  post.publishStatus = 'deleted';
  state.comments = state.comments.map((comment) =>
    comment.postId === postId ? { ...comment, status: 'deleted' as const } : comment,
  );
  saveState(state);
}

export async function toggleLike(postId: string): Promise<Post> {
  const state = loadState();
  const post = state.posts.find((item) => item.id === postId);
  if (!post || post.publishStatus !== 'published') throw new Error('帖子不存在');
  const index = state.likes.findIndex(
    (item) => item.userId === CURRENT_USER_ID && item.targetId === postId,
  );
  if (index >= 0) {
    state.likes.splice(index, 1);
    post.likeCount = Math.max(0, post.likeCount - 1);
  } else {
    state.likes.push({
      id: createId('like'),
      userId: CURRENT_USER_ID,
      targetId: postId,
      createdAt: Date.now(),
    });
    post.likeCount += 1;
    createNotification(state, {
      userId: post.authorId,
      actorId: CURRENT_USER_ID,
      type: 'like',
      targetId: post.id,
      targetSummary: postSummary(post),
    });
  }
  saveState(state);
  return enrichPost(state, post);
}

export async function toggleFavorite(postId: string): Promise<Post> {
  const state = loadState();
  const post = state.posts.find((item) => item.id === postId);
  if (!post || post.publishStatus !== 'published') throw new Error('帖子不存在');
  const index = state.favorites.findIndex(
    (item) => item.userId === CURRENT_USER_ID && item.targetId === postId,
  );
  if (index >= 0) {
    state.favorites.splice(index, 1);
    post.favoriteCount = Math.max(0, post.favoriteCount - 1);
  } else {
    state.favorites.push({
      id: createId('favorite'),
      userId: CURRENT_USER_ID,
      targetId: postId,
      createdAt: Date.now(),
    });
    post.favoriteCount += 1;
  }
  saveState(state);
  return enrichPost(state, post);
}

export async function listComments(postId: string): Promise<Comment[]> {
  const state = loadState();
  return clone(state.comments)
    .filter((item) => item.postId === postId && item.status === 'published')
    .filter((item) => !state.blocks.some((block) => block.userId === CURRENT_USER_ID && block.targetId === item.authorId))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((item) => ({
      ...item,
      createdAtText: formatRelativeTime(item.createdAt),
      isMine: item.authorId === CURRENT_USER_ID,
    }));
}

export async function createComment(
  postId: string,
  content: string,
  options?: { parentId?: string; replyToUserId?: string; replyToNickname?: string },
): Promise<Comment> {
  const moderation = await checkText(content);
  if (!moderation.passed) throw new Error(moderation.reason);

  const state = loadState();
  const post = state.posts.find(
    (item) => item.id === postId && item.publishStatus === 'published',
  );
  const user = state.users.find((item) => item.id === CURRENT_USER_ID);
  if (!post) throw new Error('帖子不存在');
  if (!user) throw new Error('用户不存在');
  if (user.status === 'muted' && Number(user.mutedUntil || 0) > Date.now()) throw new Error('账号处于禁言状态');
  if (state.blocks.some((item) => item.userId === post.authorId && item.targetId === CURRENT_USER_ID)) {
    throw new Error('无法与该用户互动');
  }

  const parent = options?.parentId
    ? state.comments.find((item) => item.id === options.parentId && item.postId === postId && item.status === 'published')
    : undefined;
  if (options?.parentId && !parent) throw new Error('回复目标不存在');
  const comment: Comment = {
    id: createId('comment'),
    postId,
    authorId: CURRENT_USER_ID,
    authorSnapshot: { nickname: user.nickname, avatar: user.avatar },
    content: content.trim(),
    status: 'published',
    parentId: parent?.id,
    replyToUserId: parent?.authorId,
    replyToNickname: parent?.authorSnapshot.nickname,
    createdAt: Date.now(),
  };
  state.comments.push(comment);
  post.commentCount += 1;
  createNotification(state, {
    userId: post.authorId,
    actorId: CURRENT_USER_ID,
    type: 'comment',
    targetId: post.id,
    targetSummary: comment.content,
  });
  if (comment.replyToUserId && comment.replyToUserId !== post.authorId) {
    createNotification(state, {
      userId: comment.replyToUserId,
      actorId: CURRENT_USER_ID,
      type: 'comment',
      targetId: post.id,
      targetSummary: `回复了你：${comment.content}`,
    });
  }
  saveState(state);
  return {
    ...clone(comment),
    createdAtText: '刚刚',
    isMine: true,
  };
}

export async function deleteComment(commentId: string): Promise<void> {
  const state = loadState();
  const comment = state.comments.find((item) => item.id === commentId);
  if (!comment) throw new Error('评论不存在');
  if (comment.authorId !== CURRENT_USER_ID) throw new Error('只能删除自己的评论');
  if (comment.status === 'deleted') return;
  comment.status = 'deleted';
  const post = state.posts.find((item) => item.id === comment.postId);
  if (post) post.commentCount = Math.max(0, post.commentCount - 1);
  saveState(state);
}

export async function toggleFollow(userId: string): Promise<User> {
  if (userId === CURRENT_USER_ID) throw new Error('不能关注自己');
  const state = loadState();
  const target = state.users.find((item) => item.id === userId);
  if (!target) throw new Error('用户不存在');
  const blocked = state.blocks.some((item) =>
    (item.userId === CURRENT_USER_ID && item.targetId === userId)
    || (item.userId === userId && item.targetId === CURRENT_USER_ID),
  );
  if (blocked) throw new Error('拉黑关系下无法关注');
  const index = state.follows.findIndex(
    (item) => item.userId === CURRENT_USER_ID && item.targetId === userId,
  );
  if (index >= 0) {
    state.follows.splice(index, 1);
  } else {
    state.follows.push({
      id: createId('follow'),
      userId: CURRENT_USER_ID,
      targetId: userId,
      createdAt: Date.now(),
    });
    createNotification(state, {
      userId,
      actorId: CURRENT_USER_ID,
      type: 'follow',
      targetId: userId,
      targetSummary: '关注了你',
    });
  }
  saveState(state);
  return enrichUser(state, target);
}

export async function listFollowers(userId = CURRENT_USER_ID): Promise<User[]> {
  const state = loadState();
  const followerIds = state.follows
    .filter((item) => item.targetId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => item.userId);
  return followerIds
    .map((id) => state.users.find((item) => item.id === id))
    .filter((item): item is User => Boolean(item))
    .map((item) => enrichUser(state, item));
}

export async function listFollowing(userId = CURRENT_USER_ID): Promise<User[]> {
  const state = loadState();
  const followingIds = state.follows
    .filter((item) => item.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => item.targetId);
  return followingIds
    .map((id) => state.users.find((item) => item.id === id))
    .filter((item): item is User => Boolean(item))
    .map((item) => enrichUser(state, item));
}

export async function listNotifications(): Promise<Notification[]> {
  return loadState().notifications
    .filter((item) => item.userId === CURRENT_USER_ID)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(enrichNotification);
}

export async function getUnreadNotificationCount(): Promise<number> {
  return loadState().notifications.filter(
    (item) => item.userId === CURRENT_USER_ID && !item.read,
  ).length;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const state = loadState();
  const notification = state.notifications.find(
    (item) => item.id === notificationId && item.userId === CURRENT_USER_ID,
  );
  if (!notification) throw new Error('通知不存在');
  notification.read = true;
  saveState(state);
}

export async function markAllNotificationsRead(): Promise<void> {
  const state = loadState();
  state.notifications.forEach((item) => {
    if (item.userId === CURRENT_USER_ID) item.read = true;
  });
  saveState(state);
}


function requireMockAdmin(state: MockState): User {
  const admin = state.users.find((item) => item.id === CURRENT_USER_ID);
  if (!admin || admin.role !== 'admin') throw new Error('需要管理员权限');
  return admin;
}

function addAuditLog(
  state: MockState,
  action: string,
  targetType: string,
  targetId: string,
  detail: string,
): void {
  state.auditLogs.push({
    id: createId('audit'),
    adminId: CURRENT_USER_ID,
    action,
    targetType,
    targetId,
    detail,
    createdAt: Date.now(),
  });
}

export async function reportTarget(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  detail?: string;
}): Promise<Report> {
  const reason = String(input.reason || '').trim();
  const detail = String(input.detail || '').trim();
  if (!reason || reason.length > 40 || detail.length > 300) throw new Error('举报内容不合法');
  const moderation = await checkText(`${reason}\n${detail}`);
  if (!moderation.passed) throw new Error(moderation.reason);
  const state = loadState();
  const reporter = state.users.find((item) => item.id === CURRENT_USER_ID);
  if (!reporter) throw new Error('用户不存在');
  let targetOwnerId = '';
  let targetSummary = '';
  if (input.targetType === 'post') {
    const post = state.posts.find((item) => item.id === input.targetId);
    if (!post) throw new Error('举报目标不存在');
    targetOwnerId = post.authorId;
    targetSummary = postSummary(post);
  } else if (input.targetType === 'comment') {
    const comment = state.comments.find((item) => item.id === input.targetId);
    if (!comment) throw new Error('举报目标不存在');
    targetOwnerId = comment.authorId;
    targetSummary = comment.content.slice(0, 40);
  } else {
    const user = state.users.find((item) => item.id === input.targetId);
    if (!user) throw new Error('举报目标不存在');
    targetOwnerId = user.id;
    targetSummary = user.nickname;
  }
  if (targetOwnerId === CURRENT_USER_ID) throw new Error('不能举报自己');
  const duplicated = state.reports.find((item) =>
    item.reporterId === CURRENT_USER_ID
    && item.targetType === input.targetType
    && item.targetId === input.targetId
    && item.status === 'pending',
  );
  if (duplicated) return clone(duplicated);
  const report: Report = {
    id: createId('report'),
    reporterId: CURRENT_USER_ID,
    reporterSnapshot: { nickname: reporter.nickname, avatar: reporter.avatar },
    targetType: input.targetType,
    targetId: input.targetId,
    targetOwnerId,
    targetSummary,
    reason,
    detail,
    status: 'pending',
    createdAt: Date.now(),
  };
  state.reports.push(report);
  saveState(state);
  return clone(report);
}

export async function toggleBlock(userId: string): Promise<boolean> {
  if (userId === CURRENT_USER_ID) throw new Error('不能拉黑自己');
  const state = loadState();
  if (!state.users.some((item) => item.id === userId)) throw new Error('用户不存在');
  const index = state.blocks.findIndex((item) => item.userId === CURRENT_USER_ID && item.targetId === userId);
  if (index >= 0) {
    state.blocks.splice(index, 1);
    saveState(state);
    return false;
  }
  state.blocks.push({ id: createId('block'), userId: CURRENT_USER_ID, targetId: userId, createdAt: Date.now() });
  state.follows = state.follows.filter((item) => ![
    `${CURRENT_USER_ID}:${userId}`,
    `${userId}:${CURRENT_USER_ID}`,
  ].includes(`${item.userId}:${item.targetId}`));
  saveState(state);
  return true;
}

export async function isUserBlocked(userId: string): Promise<boolean> {
  return loadState().blocks.some((item) => item.userId === CURRENT_USER_ID && item.targetId === userId);
}

export async function listBlockedUsers(): Promise<User[]> {
  const state = loadState();
  return state.blocks
    .filter((item) => item.userId === CURRENT_USER_ID)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => state.users.find((user) => user.id === item.targetId))
    .filter((item): item is User => Boolean(item))
    .map((item) => enrichUser(state, item));
}

export async function getAdminStats(): Promise<AdminStats> {
  const state = loadState();
  requireMockAdmin(state);
  return {
    userCount: state.users.filter((item) => item.status !== 'deleted').length,
    petCount: state.pets.length,
    postCount: state.posts.filter((item) => item.publishStatus === 'published').length,
    pendingPostCount: state.posts.filter((item) => item.moderationStatus === 'pending').length,
    pendingReportCount: state.reports.filter((item) => item.status === 'pending').length,
  };
}

export async function listAdminReports(status: ReportStatus = 'pending'): Promise<Report[]> {
  const state = loadState();
  requireMockAdmin(state);
  return clone(state.reports)
    .filter((item) => !status || item.status === status)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function resolveReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
  resolution: string,
): Promise<Report> {
  const state = loadState();
  requireMockAdmin(state);
  const report = state.reports.find((item) => item.id === reportId);
  if (!report) throw new Error('举报不存在');
  report.status = status;
  report.resolution = resolution;
  report.handlerId = CURRENT_USER_ID;
  report.handledAt = Date.now();
  addAuditLog(state, 'resolve_report', 'report', reportId, `${status}: ${resolution}`);
  saveState(state);
  return clone(report);
}

export async function listModerationQueue(): Promise<Post[]> {
  const state = loadState();
  requireMockAdmin(state);
  return state.posts
    .filter((item) => item.publishStatus === 'published' && item.moderationStatus !== 'approved')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => enrichPost(state, item));
}

export async function reviewPost(
  postId: string,
  status: 'approved' | 'rejected',
  reason = '',
): Promise<Post> {
  const state = loadState();
  requireMockAdmin(state);
  const post = state.posts.find((item) => item.id === postId);
  if (!post) throw new Error('动态不存在');
  post.moderationStatus = status;
  post.moderationReason = reason;
  post.reviewedAt = Date.now();
  addAuditLog(state, 'review_post', 'post', postId, `${status}: ${reason}`);
  saveState(state);
  return enrichPost(state, post);
}

export async function listAdminUsers(): Promise<User[]> {
  const state = loadState();
  requireMockAdmin(state);
  return clone(state.users).sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateUserAdmin(
  userId: string,
  input: { status: User['status']; mutedUntil?: number },
): Promise<User> {
  const state = loadState();
  requireMockAdmin(state);
  const user = state.users.find((item) => item.id === userId);
  if (!user) throw new Error('用户不存在');
  if (user.id === CURRENT_USER_ID && input.status !== 'active') throw new Error('不能禁用当前管理员');
  user.status = input.status;
  user.mutedUntil = input.mutedUntil || 0;
  user.updatedAt = Date.now();
  addAuditLog(state, 'update_user_status', 'user', userId, JSON.stringify(input));
  saveState(state);
  return clone(user);
}

export async function listAuditLogs(): Promise<AuditLog[]> {
  const state = loadState();
  requireMockAdmin(state);
  return clone(state.auditLogs).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteCurrentAccount(): Promise<void> {
  wx.removeStorageSync?.(STORAGE_KEY);
}
