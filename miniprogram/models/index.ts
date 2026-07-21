export type Species = 'cat' | 'dog' | 'other';
export type Gender = 'male' | 'female' | 'unknown';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type NotificationType = 'like' | 'comment' | 'follow' | 'moderation' | 'system';
export type UserStatus = 'active' | 'disabled' | 'muted' | 'deleted';
export type UserRole = 'user' | 'admin';
export type ReportTargetType = 'post' | 'comment' | 'user';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface User {
  id: string;
  openid?: string;
  nickname: string;
  avatar: string;
  bio: string;
  status?: UserStatus;
  role?: UserRole;
  mutedUntil?: number;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
  phoneBound?: boolean;
  phoneNumberMasked?: string;
  phoneCountryCode?: string;
  phoneVerifiedAt?: number;
  phoneKey?: string;
  followerCount?: number;
  followingCount?: number;
  followedByMe?: boolean;
  isMe?: boolean;
}

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breed: string;
  gender: Gender;
  birthday: string;
  avatar: string;
  bio: string;
  createdAt: number;
  updatedAt: number;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
}

export interface AuthorSnapshot {
  nickname: string;
  avatar: string;
}

export interface PetSnapshot {
  name: string;
  avatar: string;
  species: Species;
}

export interface Post {
  id: string;
  authorId: string;
  petId: string;
  authorSnapshot: AuthorSnapshot;
  petSnapshot: PetSnapshot;
  content: string;
  images: string[];
  topicId: string;
  moderationStatus: ModerationStatus;
  moderationReason?: string;
  moderationTraceIds?: string[];
  reviewedAt?: number;
  publishStatus: 'published' | 'deleted';
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  createdAt: number;
  likedByMe?: boolean;
  favoritedByMe?: boolean;
  topicName?: string;
  createdAtText?: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorSnapshot: AuthorSnapshot;
  content: string;
  status: 'published' | 'deleted';
  parentId?: string;
  replyToUserId?: string;
  replyToNickname?: string;
  createdAt: number;
  createdAtText?: string;
  isMine?: boolean;
}

export interface Relation {
  id: string;
  userId: string;
  targetId: string;
  createdAt: number;
}


export interface BlockRelation {
  id: string;
  userId: string;
  targetId: string;
  createdAt: number;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId: string;
  reason: string;
  detail: string;
  status: ReportStatus;
  createdAt: number;
  handledAt?: number;
  handlerId?: string;
  resolution?: string;
  targetSummary?: string;
  reporterSnapshot?: AuthorSnapshot;
}

export interface AdminStats {
  userCount: number;
  petCount: number;
  postCount: number;
  pendingPostCount: number;
  pendingReportCount: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  createdAt: number;
}

export interface Notification {
  id: string;
  userId: string;
  actorId: string;
  actorSnapshot: AuthorSnapshot;
  type: NotificationType;
  targetId: string;
  targetSummary: string;
  read: boolean;
  createdAt: number;
  createdAtText?: string;
  message?: string;
}

export interface SecurityCheckResult {
  passed: boolean;
  suggest: 'pass' | 'review' | 'risky' | 'unavailable';
  reason: string;
}

export interface MockState {
  version: number;
  users: User[];
  pets: Pet[];
  topics: Topic[];
  posts: Post[];
  comments: Comment[];
  likes: Relation[];
  favorites: Relation[];
  follows: Relation[];
  notifications: Notification[];
  blocks: BlockRelation[];
  reports: Report[];
  auditLogs: AuditLog[];
}
