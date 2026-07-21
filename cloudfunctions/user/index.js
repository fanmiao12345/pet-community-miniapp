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

function publicUser(user) {
  const { openid, unionid, phoneKey, phoneNumber, ...safe } = user;
  return safe;
}

function extractSuggest(response) {
  return response?.result?.suggest || response?.suggest || response?.result?.detail?.suggest || 'review';
}

async function ensureSafeText(openid, content, scene = 1) {
  if (!SECURITY_ENABLED || !String(content || '').trim()) return;
  try {
    const response = await cloud.openapi.security.msgSecCheck({
      content: String(content).slice(0, 500000),
      version: 2,
      scene,
      openid,
    });
    if (extractSuggest(response) !== 'pass') throw new Error('Profile content rejected by security check');
  } catch (error) {
    if (SECURITY_FAIL_OPEN) return;
    throw error;
  }
}

async function enrichUser(user, viewerId) {
  const [followers, following, followed] = await Promise.all([
    db.collection('follows').where({ targetId: user._id }).count(),
    db.collection('follows').where({ userId: user._id }).count(),
    db.collection('follows').where({ userId: viewerId, targetId: user._id }).limit(1).get(),
  ]);
  return {
    ...publicUser(user),
    id: user._id,
    followerCount: followers.total,
    followingCount: following.total,
    followedByMe: Boolean(followed.data.length),
    isMe: user._id === viewerId,
  };
}

async function listRelationUsers(mode, userId, viewerId) {
  const field = mode === 'followers' ? 'targetId' : 'userId';
  const relationField = mode === 'followers' ? 'userId' : 'targetId';
  const relations = await db.collection('follows').where({ [field]: userId }).orderBy('createdAt', 'desc').get();
  const ids = relations.data.map((item) => item[relationField]);
  if (!ids.length) return [];
  const users = await db.collection('users').where({ _id: _.in(ids), status: _.in(['active', 'muted']) }).get();
  const userMap = new Map(users.data.map((item) => [item._id, item]));
  const orderedUsers = ids.map((id) => userMap.get(id)).filter(Boolean);
  return Promise.all(orderedUsers.map((item) => enrichUser(item, viewerId)));
}

exports.main = async (event) => {
  try {
    const viewer = await currentUser();
    if (event.action === 'updateProfile') {
      const input = event.input || {};
      const nickname = String(input.nickname || '').trim();
      const bio = String(input.bio || '').trim();
      const avatar = String(input.avatar || '');
      if (!nickname || nickname.length > 20) throw new Error('Invalid nickname');
      if (bio.length > 120) throw new Error('Bio too long');
      if (avatar && !avatar.startsWith('cloud://') && !avatar.startsWith('/assets/')) throw new Error('Invalid avatar path');
      await ensureSafeText(viewer.openid, `${nickname}\n${bio}`, 1);
      const update = { nickname, bio, avatar, updatedAt: Date.now() };
      await db.collection('users').doc(viewer._id).update({ data: update });
      return { ok: true, data: await enrichUser({ ...viewer, ...update }, viewer._id) };
    }
    if (event.action === 'getProfile') {
      const userId = event.userId || viewer._id;
      const result = await db.collection('users').doc(userId).get();
      if (['disabled', 'deleted'].includes(result.data.status) && userId !== viewer._id) throw new Error('User unavailable');
      return { ok: true, data: await enrichUser(result.data, viewer._id) };
    }
    if (event.action === 'listFollowers' || event.action === 'listFollowing') {
      const userId = event.userId || viewer._id;
      const mode = event.action === 'listFollowers' ? 'followers' : 'following';
      return { ok: true, data: await listRelationUsers(mode, userId, viewer._id) };
    }
    if (event.action === 'deleteAccount') {
      const now = Date.now();
      await Promise.all([
        db.collection('posts').where({ authorId: viewer._id }).update({ data: { publishStatus: 'deleted', deletedAt: now } }),
        db.collection('comments').where({ authorId: viewer._id }).update({ data: { status: 'deleted', deletedAt: now } }),
        db.collection('pets').where({ ownerId: viewer._id }).remove(),
        db.collection('likes').where({ userId: viewer._id }).remove(),
        db.collection('favorites').where({ userId: viewer._id }).remove(),
        db.collection('follows').where({ userId: viewer._id }).remove(),
        db.collection('follows').where({ targetId: viewer._id }).remove(),
        db.collection('blocks').where({ userId: viewer._id }).remove(),
        db.collection('blocks').where({ targetId: viewer._id }).remove(),
        db.collection('notifications').where({ userId: viewer._id }).remove(),
      ]);
      await db.collection('users').doc(viewer._id).update({
        data: {
          openid: `deleted:${viewer._id}:${now}`,
          unionid: '',
          nickname: '已注销用户',
          avatar: '/assets/avatar-default.png',
          bio: '',
          phoneKey: '',
          phoneBound: false,
          phoneNumberMasked: '',
          phoneCountryCode: '',
          phoneVerifiedAt: 0,
          status: 'deleted',
          deletedAt: now,
          updatedAt: now,
        },
      });
      return { ok: true };
    }
    throw new Error('Unsupported action');
  } catch (error) {
    return { ok: false, message: error.message || 'User operation failed' };
  }
};
