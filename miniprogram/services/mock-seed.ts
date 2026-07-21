import {
  Comment,
  MockState,
  Notification,
  Pet,
  Post,
  Relation,
  Topic,
  User,
} from '../models/index';

/**
 * 演示数据种子。
 *
 * 抽离自 mock-repository.ts(原文件超 1000 行,种子数据占 ~170 行)。
 * 这里只持有静态/半静态数据;所有运行时写操作(点赞、评论、关注等)
 * 仍在 mock-repository.ts 中维护,通过下面的工厂函数生成初始 MockState。
 *
 * CURRENT_USER_ID 与 STATE_VERSION 由调用方传入,避免与主文件常量重复定义。
 */

export function nowMinus(minutes: number): number {
  return Date.now() - minutes * 60 * 1000;
}

export function seedFollows(currentUserId: string): Relation[] {
  return [
    {
      id: 'follow_seed_me_friend',
      userId: currentUserId,
      targetId: 'user_friend',
      createdAt: nowMinus(700),
    },
    {
      id: 'follow_seed_friend_me',
      userId: 'user_friend',
      targetId: currentUserId,
      createdAt: nowMinus(210),
    },
  ];
}

export function seedNotifications(currentUserId: string): Notification[] {
  return [
    {
      id: 'notification_seed_follow',
      userId: currentUserId,
      actorId: 'user_friend',
      actorSnapshot: { nickname: '橘猫研究员', avatar: '/assets/avatar-friend.png' },
      type: 'follow',
      targetId: currentUserId,
      targetSummary: '关注了你',
      read: false,
      createdAt: nowMinus(210),
    },
    {
      id: 'notification_seed_like',
      userId: currentUserId,
      actorId: 'user_friend',
      actorSnapshot: { nickname: '橘猫研究员', avatar: '/assets/avatar-friend.png' },
      type: 'like',
      targetId: 'post_seed_1',
      targetSummary: '今天第一次学会自己推开房门…',
      read: false,
      createdAt: nowMinus(24),
    },
    {
      id: 'notification_seed_comment',
      userId: currentUserId,
      actorId: 'user_friend',
      actorSnapshot: { nickname: '橘猫研究员', avatar: '/assets/avatar-friend.png' },
      type: 'comment',
      targetId: 'post_seed_1',
      targetSummary: '这个回头确认的动作太有画面感了。',
      read: true,
      createdAt: nowMinus(20),
    },
  ];
}

export function seedState(currentUserId: string, stateVersion: number): MockState {
  const user: User = {
    id: currentUserId,
    nickname: '恩慧',
    avatar: '/assets/avatar-default.png',
    bio: '认真记录每一段毛孩子的成长。',
    createdAt: nowMinus(5000),
    updatedAt: nowMinus(5000),
    status: 'active',
    role: 'admin',
    phoneBound: false,
    phoneNumberMasked: '',
  };

  const otherUser: User = {
    id: 'user_friend',
    nickname: '橘猫研究员',
    avatar: '/assets/avatar-friend.png',
    bio: '家有两只橘猫，持续记录科学养宠经验。',
    createdAt: nowMinus(9000),
    updatedAt: nowMinus(9000),
    status: 'active',
    role: 'user',
    phoneBound: true,
    phoneNumberMasked: '139****5678',
    phoneCountryCode: '86',
    phoneVerifiedAt: nowMinus(8800),
    phoneKey: 'mock-user-friend-phone-key',
  };

  const pets: Pet[] = [
    {
      id: 'pet_miaomiao',
      ownerId: currentUserId,
      name: '苗苗',
      species: 'cat',
      breed: '中华田园猫',
      gender: 'female',
      birthday: '2023-05-18',
      avatar: '/assets/pet-cat.png',
      bio: '爱晒太阳，也爱偷吃冻干。',
      createdAt: nowMinus(4800),
      updatedAt: nowMinus(4800),
    },
    {
      id: 'pet_doudou',
      ownerId: currentUserId,
      name: '豆豆',
      species: 'dog',
      breed: '柯基',
      gender: 'male',
      birthday: '2022-09-10',
      avatar: '/assets/pet-dog.png',
      bio: '短腿但跑得很快。',
      createdAt: nowMinus(4700),
      updatedAt: nowMinus(4700),
    },
    {
      id: 'pet_friend_cat',
      ownerId: 'user_friend',
      name: '大橘',
      species: 'cat',
      breed: '中华田园猫',
      gender: 'male',
      birthday: '2021-08-12',
      avatar: '/assets/pet-orange.png',
      bio: '饭量稳定，情绪也稳定。',
      createdAt: nowMinus(8600),
      updatedAt: nowMinus(8600),
    },
  ];

  const topics: Topic[] = [
    { id: 'topic_daily', name: '晒宠日常', description: '分享可爱的日常瞬间', icon: '📷', sortOrder: 1 },
    { id: 'topic_help', name: '养宠求助', description: '交流非诊断性的养宠经验', icon: '💬', sortOrder: 2 },
    { id: 'topic_product', name: '用品分享', description: '分享真实使用体验', icon: '🧺', sortOrder: 3 },
  ];

  const posts: Post[] = [
    {
      id: 'post_seed_1',
      authorId: currentUserId,
      petId: 'pet_miaomiao',
      authorSnapshot: { nickname: user.nickname, avatar: user.avatar },
      petSnapshot: { name: '苗苗', avatar: '/assets/pet-cat.png', species: 'cat' },
      content: '今天第一次学会自己推开房门，成功之后还回头看我，像是在确认有没有被发现。',
      images: ['/assets/demo-cat.png'],
      topicId: 'topic_daily',
      moderationStatus: 'approved',
      publishStatus: 'published',
      likeCount: 12,
      commentCount: 1,
      favoriteCount: 2,
      createdAt: nowMinus(32),
    },
    {
      id: 'post_seed_2',
      authorId: 'user_friend',
      petId: 'pet_friend_cat',
      authorSnapshot: { nickname: otherUser.nickname, avatar: otherUser.avatar },
      petSnapshot: { name: '大橘', avatar: '/assets/pet-orange.png', species: 'cat' },
      content: '换粮时我会用 7 天逐步增加新粮比例，肠胃比较敏感的猫可以把过渡期再拉长一些。仅分享个人经验。',
      images: [],
      topicId: 'topic_help',
      moderationStatus: 'approved',
      publishStatus: 'published',
      likeCount: 26,
      commentCount: 0,
      favoriteCount: 8,
      createdAt: nowMinus(180),
    },
    {
      id: 'post_seed_3',
      authorId: currentUserId,
      petId: 'pet_doudou',
      authorSnapshot: { nickname: user.nickname, avatar: user.avatar },
      petSnapshot: { name: '豆豆', avatar: '/assets/pet-dog.png', species: 'dog' },
      content: '新买的慢食碗用了三天，吃饭时间从 40 秒延长到了 4 分钟，清洗也比较方便。',
      images: ['/assets/demo-dog.png'],
      topicId: 'topic_product',
      moderationStatus: 'approved',
      publishStatus: 'published',
      likeCount: 7,
      commentCount: 0,
      favoriteCount: 3,
      createdAt: nowMinus(900),
    },
  ];

  const comments: Comment[] = [
    {
      id: 'comment_seed_1',
      postId: 'post_seed_1',
      authorId: 'user_friend',
      authorSnapshot: { nickname: otherUser.nickname, avatar: otherUser.avatar },
      content: '这个回头确认的动作太有画面感了。',
      status: 'published',
      createdAt: nowMinus(20),
    },
  ];

  return {
    version: stateVersion,
    users: [user, otherUser],
    pets,
    topics,
    posts,
    comments,
    likes: [
      {
        id: 'like_seed_friend_post_1',
        userId: 'user_friend',
        targetId: 'post_seed_1',
        createdAt: nowMinus(24),
      },
    ],
    favorites: [],
    follows: seedFollows(currentUserId),
    notifications: seedNotifications(currentUserId),
    blocks: [],
    reports: [],
    auditLogs: [],
  };
}
