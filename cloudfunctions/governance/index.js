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
  return { ...safe, id: user._id };
}

function extractSuggest(response) {
  return response?.result?.suggest || response?.suggest || response?.result?.detail?.suggest || 'review';
}

async function ensureSafeText(openid, content) {
  if (!SECURITY_ENABLED || !String(content || '').trim()) return;
  try {
    const response = await cloud.openapi.security.msgSecCheck({
      content: String(content).slice(0, 500000),
      version: 2,
      scene: 2,
      openid,
    });
    if (extractSuggest(response) !== 'pass') throw new Error('Report detail rejected by security check');
  } catch (error) {
    if (SECURITY_FAIL_OPEN) return;
    throw error;
  }
}

async function resolveTarget(targetType, targetId) {
  if (targetType === 'post') {
    const result = await db.collection('posts').doc(targetId).get();
    return {
      ownerId: result.data.authorId,
      summary: String(result.data.content || '').replace(/\s+/g, ' ').slice(0, 60),
    };
  }
  if (targetType === 'comment') {
    const result = await db.collection('comments').doc(targetId).get();
    return {
      ownerId: result.data.authorId,
      summary: String(result.data.content || '').replace(/\s+/g, ' ').slice(0, 60),
    };
  }
  if (targetType === 'user') {
    const result = await db.collection('users').doc(targetId).get();
    return { ownerId: result.data._id, summary: result.data.nickname || '用户' };
  }
  throw new Error('Invalid report target type');
}

exports.main = async (event) => {
  try {
    const user = await currentUser();

    if (event.action === 'reportTarget') {
      const input = event.input || {};
      const targetType = String(input.targetType || '');
      const targetId = String(input.targetId || '');
      const reason = String(input.reason || '').trim();
      const detail = String(input.detail || '').trim();
      if (!['post', 'comment', 'user'].includes(targetType)) throw new Error('Invalid target type');
      if (!targetId || !reason || reason.length > 40 || detail.length > 300) throw new Error('Invalid report content');
      await ensureSafeText(user.openid, `${reason}\n${detail}`);
      const target = await resolveTarget(targetType, targetId);
      if (target.ownerId === user._id) throw new Error('Cannot report yourself');

      const duplicated = await db.collection('reports').where({
        reporterId: user._id,
        targetType,
        targetId,
        status: 'pending',
      }).limit(1).get();
      if (duplicated.data.length) return { ok: true, data: { ...duplicated.data[0], id: duplicated.data[0]._id } };

      const doc = {
        reporterId: user._id,
        reporterSnapshot: { nickname: user.nickname, avatar: user.avatar },
        targetType,
        targetId,
        targetOwnerId: target.ownerId,
        targetSummary: target.summary,
        reason,
        detail,
        status: 'pending',
        createdAt: Date.now(),
      };
      const result = await db.collection('reports').add({ data: doc });
      return { ok: true, data: { id: result._id, ...doc } };
    }

    if (event.action === 'toggleBlock') {
      const targetId = String(event.userId || '');
      if (!targetId || targetId === user._id) throw new Error('Invalid target user');
      const target = await db.collection('users').doc(targetId).get();
      if (target.data.status === 'deleted') throw new Error('User unavailable');
      const found = await db.collection('blocks').where({ userId: user._id, targetId }).limit(1).get();
      if (found.data.length) {
        await db.collection('blocks').doc(found.data[0]._id).remove();
        return { ok: true, data: false };
      }
      await db.collection('blocks').add({ data: { userId: user._id, targetId, createdAt: Date.now() } });
      const [outgoing, incoming] = await Promise.all([
        db.collection('follows').where({ userId: user._id, targetId }).get(),
        db.collection('follows').where({ userId: targetId, targetId: user._id }).get(),
      ]);
      await Promise.all([...outgoing.data, ...incoming.data].map((item) => db.collection('follows').doc(item._id).remove()));
      return { ok: true, data: true };
    }

    if (event.action === 'isUserBlocked') {
      const result = await db.collection('blocks').where({ userId: user._id, targetId: event.userId }).limit(1).get();
      return { ok: true, data: Boolean(result.data.length) };
    }

    if (event.action === 'listBlockedUsers') {
      const blocks = await db.collection('blocks').where({ userId: user._id }).orderBy('createdAt', 'desc').get();
      const ids = blocks.data.map((item) => item.targetId);
      if (!ids.length) return { ok: true, data: [] };
      const users = await db.collection('users').where({ _id: _.in(ids) }).get();
      const map = new Map(users.data.map((item) => [item._id, item]));
      return { ok: true, data: ids.map((id) => map.get(id)).filter(Boolean).map(publicUser) };
    }

    throw new Error('Unsupported action');
  } catch (error) {
    return { ok: false, message: error.message || 'Governance operation failed' };
  }
};
