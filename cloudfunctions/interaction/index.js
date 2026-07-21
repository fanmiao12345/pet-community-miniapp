const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const SECURITY_ENABLED = process.env.CONTENT_SECURITY_ENABLED !== 'false';
const SECURITY_FAIL_OPEN = process.env.CONTENT_SECURITY_FAIL_OPEN === 'true';

async function currentUser() {
  const { OPENID } = cloud.getWXContext();
  const result = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!result.data.length) throw new Error('User not initialized');
  if (['disabled', 'deleted'].includes(result.data[0].status)) throw new Error('Account unavailable');
  if (!result.data[0].phoneVerifiedAt || !result.data[0].phoneKey) throw new Error('PHONE_AUTH_REQUIRED');
  return result.data[0];
}

function formatRelativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - Number(timestamp || 0)) / 1000));
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}天前`;
  return new Date(Number(timestamp)).toISOString().slice(0, 10);
}

function extractSuggest(response) {
  return response?.result?.suggest || response?.suggest || response?.result?.detail?.suggest || 'review';
}

async function ensureSafeText(openid, content) {
  if (!SECURITY_ENABLED) return;
  try {
    const response = await cloud.openapi.security.msgSecCheck({
      content: String(content).slice(0, 500000),
      version: 2,
      scene: 2,
      openid,
    });
    if (extractSuggest(response) !== 'pass') throw new Error('Comment rejected by security check');
  } catch (error) {
    if (SECURITY_FAIL_OPEN) return;
    throw error;
  }
}

async function createNotification({ userId, actor, type, targetId, targetSummary }) {
  if (!userId || userId === actor._id) return;
  await db.collection('notifications').add({
    data: {
      userId,
      actorId: actor._id,
      actorSnapshot: { nickname: actor.nickname, avatar: actor.avatar },
      type,
      targetId,
      targetSummary,
      read: false,
      createdAt: Date.now(),
    },
  });
}

function postSummary(post) {
  const content = String(post.content || '').replace(/\s+/g, ' ').trim();
  return content.length > 28 ? `${content.slice(0, 28)}…` : content;
}

async function getPublicPost(postId) {
  const result = await db.collection('posts').doc(postId).get();
  const post = result.data;
  if (post.publishStatus !== 'published' || post.moderationStatus !== 'approved') {
    throw new Error('Post unavailable');
  }
  return post;
}

async function enrichPost(post, userId) {
  const [liked, favorited] = await Promise.all([
    db.collection('likes').where({ userId, targetId: post._id }).limit(1).get(),
    db.collection('favorites').where({ userId, targetId: post._id }).limit(1).get(),
  ]);
  return {
    ...post,
    id: post._id,
    createdAtText: formatRelativeTime(post.createdAt),
    likedByMe: Boolean(liked.data.length),
    favoritedByMe: Boolean(favorited.data.length),
  };
}

exports.main = async (event) => {
  try {
    const user = await currentUser();
    if (event.action === 'toggleLike' || event.action === 'toggleFavorite') {
      const collectionName = event.action === 'toggleLike' ? 'likes' : 'favorites';
      const countField = event.action === 'toggleLike' ? 'likeCount' : 'favoriteCount';
      const post = await getPublicPost(event.postId);
      const found = await db.collection(collectionName).where({ userId: user._id, targetId: event.postId }).limit(1).get();
      if (found.data.length) {
        await db.collection(collectionName).doc(found.data[0]._id).remove();
        await db.collection('posts').doc(event.postId).update({ data: { [countField]: _.inc(-1) } });
      } else {
        await db.collection(collectionName).add({ data: { userId: user._id, targetId: event.postId, createdAt: Date.now() } });
        await db.collection('posts').doc(event.postId).update({ data: { [countField]: _.inc(1) } });
        if (event.action === 'toggleLike') {
          await createNotification({
            userId: post.authorId,
            actor: user,
            type: 'like',
            targetId: event.postId,
            targetSummary: postSummary(post),
          });
        }
      }
      const refreshed = await db.collection('posts').doc(event.postId).get();
      return { ok: true, data: await enrichPost(refreshed.data, user._id) };
    }

    if (event.action === 'listComments') {
      await getPublicPost(event.postId);
      const [result, blocked] = await Promise.all([
        db.collection('comments').where({ postId: event.postId, status: 'published' }).orderBy('createdAt', 'asc').get(),
        db.collection('blocks').where({ userId: user._id }).get(),
      ]);
      const blockedIds = new Set(blocked.data.map((item) => item.targetId));
      return {
        ok: true,
        data: result.data.filter((item) => !blockedIds.has(item.authorId)).map((item) => ({
          ...item,
          id: item._id,
          createdAtText: formatRelativeTime(item.createdAt),
          isMine: item.authorId === user._id,
        })),
      };
    }

    if (event.action === 'createComment') {
      const content = String(event.content || '').trim();
      const options = event.options || {};
      if (!content || content.length > 300) throw new Error('Invalid comment');
      const post = await getPublicPost(event.postId);
      if (user.status === 'muted' && Number(user.mutedUntil || 0) > Date.now()) throw new Error('Account muted');
      const blockedByAuthor = await db.collection('blocks').where({ userId: post.authorId, targetId: user._id }).limit(1).get();
      if (blockedByAuthor.data.length) throw new Error('Unable to interact with this user');
      await ensureSafeText(user.openid, content);
      let replyMeta = { parentId: '', replyToUserId: '', replyToNickname: '' };
      if (options.parentId) {
        const parent = await db.collection('comments').doc(String(options.parentId)).get();
        if (parent.data.postId !== event.postId || parent.data.status !== 'published') throw new Error('Reply target unavailable');
        replyMeta = {
          parentId: parent.data._id,
          replyToUserId: parent.data.authorId,
          replyToNickname: parent.data.authorSnapshot?.nickname || '',
        };
      }
      const doc = {
        postId: event.postId,
        authorId: user._id,
        authorSnapshot: { nickname: user.nickname, avatar: user.avatar },
        content,
        status: 'published',
        ...replyMeta,
        createdAt: Date.now(),
      };
      const result = await db.collection('comments').add({ data: doc });
      await db.collection('posts').doc(event.postId).update({ data: { commentCount: _.inc(1) } });
      await createNotification({
        userId: post.authorId,
        actor: user,
        type: 'comment',
        targetId: event.postId,
        targetSummary: content,
      });
      if (doc.replyToUserId && doc.replyToUserId !== post.authorId) {
        await createNotification({
          userId: doc.replyToUserId,
          actor: user,
          type: 'comment',
          targetId: event.postId,
          targetSummary: `回复了你：${content}`,
        });
      }
      return { ok: true, data: { id: result._id, ...doc, createdAtText: '刚刚', isMine: true } };
    }

    if (event.action === 'deleteComment') {
      const result = await db.collection('comments').doc(event.commentId).get();
      if (result.data.authorId !== user._id) throw new Error('Forbidden');
      if (result.data.status !== 'deleted') {
        await db.collection('comments').doc(event.commentId).update({ data: { status: 'deleted', deletedAt: Date.now() } });
        await db.collection('posts').doc(result.data.postId).update({ data: { commentCount: _.inc(-1) } });
      }
      return { ok: true };
    }

    if (event.action === 'toggleFollow') {
      if (!event.userId || event.userId === user._id) throw new Error('Invalid target user');
      const target = await db.collection('users').doc(event.userId).get();
      if (['disabled', 'deleted'].includes(target.data.status)) throw new Error('User unavailable');
      const [blockedByMe, blockedByTarget] = await Promise.all([
        db.collection('blocks').where({ userId: user._id, targetId: event.userId }).limit(1).get(),
        db.collection('blocks').where({ userId: event.userId, targetId: user._id }).limit(1).get(),
      ]);
      if (blockedByMe.data.length || blockedByTarget.data.length) throw new Error('Blocked users cannot follow each other');
      const found = await db.collection('follows').where({ userId: user._id, targetId: event.userId }).limit(1).get();
      if (found.data.length) {
        await db.collection('follows').doc(found.data[0]._id).remove();
      } else {
        await db.collection('follows').add({ data: { userId: user._id, targetId: event.userId, createdAt: Date.now() } });
        await createNotification({
          userId: event.userId,
          actor: user,
          type: 'follow',
          targetId: event.userId,
          targetSummary: '关注了你',
        });
      }
      const [followers, following, followed] = await Promise.all([
        db.collection('follows').where({ targetId: event.userId }).count(),
        db.collection('follows').where({ userId: event.userId }).count(),
        db.collection('follows').where({ userId: user._id, targetId: event.userId }).limit(1).get(),
      ]);
      const { openid, unionid, ...safeTarget } = target.data;
      return {
        ok: true,
        data: {
          ...safeTarget,
          id: target.data._id,
          followerCount: followers.total,
          followingCount: following.total,
          followedByMe: Boolean(followed.data.length),
          isMe: false,
        },
      };
    }

    if (event.action === 'listNotifications') {
      const result = await db.collection('notifications').where({ userId: user._id }).orderBy('createdAt', 'desc').limit(100).get();
      const messageMap = {
        like: '赞了你的动态',
        comment: '评论了你的动态',
        follow: '关注了你',
        moderation: '更新了内容审核结果',
        system: '发送了一条系统通知',
      };
      return {
        ok: true,
        data: result.data.map((item) => ({
          ...item,
          id: item._id,
          createdAtText: formatRelativeTime(item.createdAt),
          message: messageMap[item.type] || '与你互动了',
        })),
      };
    }

    if (event.action === 'getUnreadNotificationCount') {
      const result = await db.collection('notifications').where({ userId: user._id, read: false }).count();
      return { ok: true, data: result.total };
    }

    if (event.action === 'markNotificationRead') {
      const result = await db.collection('notifications').doc(event.notificationId).get();
      if (result.data.userId !== user._id) throw new Error('Forbidden');
      await db.collection('notifications').doc(event.notificationId).update({ data: { read: true } });
      return { ok: true };
    }

    if (event.action === 'markAllNotificationsRead') {
      await db.collection('notifications').where({ userId: user._id, read: false }).update({ data: { read: true } });
      return { ok: true };
    }

    throw new Error('Unsupported action');
  } catch (error) {
    return { ok: false, message: error.message || 'Interaction operation failed' };
  }
};
