const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function currentAdmin() {
  const { OPENID } = cloud.getWXContext();
  const result = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!result.data.length) throw new Error('User not initialized');
  const user = result.data[0];
  if (user.status !== 'active' || user.role !== 'admin') throw new Error('Admin permission required');
  if (!user.phoneVerifiedAt || !user.phoneKey) throw new Error('PHONE_AUTH_REQUIRED');
  return user;
}

function publicUser(user) {
  const { openid, unionid, phoneKey, phoneNumber, ...safe } = user;
  return { ...safe, id: user._id };
}

function normalizePost(post) {
  return { ...post, id: post._id };
}

async function audit(adminId, action, targetType, targetId, detail) {
  await db.collection('audit_logs').add({
    data: { adminId, action, targetType, targetId, detail, createdAt: Date.now() },
  });
}

async function notify(userId, targetId, summary) {
  await db.collection('notifications').add({
    data: {
      userId,
      actorId: 'system',
      actorSnapshot: { nickname: '宠友圈助手', avatar: '/assets/avatar-default.png' },
      type: 'system',
      targetId,
      targetSummary: summary,
      read: false,
      createdAt: Date.now(),
    },
  });
}

exports.main = async (event) => {
  try {
    const admin = await currentAdmin();

    if (event.action === 'getStats') {
      const [users, pets, posts, pendingPosts, pendingReports] = await Promise.all([
        db.collection('users').where({ status: _.neq('deleted') }).count(),
        db.collection('pets').count(),
        db.collection('posts').where({ publishStatus: 'published' }).count(),
        db.collection('posts').where({ publishStatus: 'published', moderationStatus: 'pending' }).count(),
        db.collection('reports').where({ status: 'pending' }).count(),
      ]);
      return {
        ok: true,
        data: {
          userCount: users.total,
          petCount: pets.total,
          postCount: posts.total,
          pendingPostCount: pendingPosts.total,
          pendingReportCount: pendingReports.total,
        },
      };
    }

    if (event.action === 'listReports') {
      const status = event.status || 'pending';
      const result = await db.collection('reports').where(status ? { status } : {}).orderBy('createdAt', 'desc').limit(100).get();
      return { ok: true, data: result.data.map((item) => ({ ...item, id: item._id })) };
    }

    if (event.action === 'resolveReport') {
      if (!['resolved', 'dismissed'].includes(event.status)) throw new Error('Invalid report status');
      const result = await db.collection('reports').doc(event.reportId).get();
      const update = {
        status: event.status,
        resolution: String(event.resolution || '').slice(0, 300),
        handlerId: admin._id,
        handledAt: Date.now(),
      };
      await db.collection('reports').doc(event.reportId).update({ data: update });
      await audit(admin._id, 'resolve_report', 'report', event.reportId, JSON.stringify(update));
      await notify(result.data.reporterId, result.data.targetId, `你的举报已处理：${update.resolution || update.status}`);
      return { ok: true, data: { ...result.data, ...update, id: result.data._id } };
    }

    if (event.action === 'listModerationQueue') {
      const result = await db.collection('posts').where({ publishStatus: 'published', moderationStatus: _.in(['pending', 'rejected']) }).orderBy('createdAt', 'desc').limit(100).get();
      return { ok: true, data: result.data.map(normalizePost) };
    }

    if (event.action === 'reviewPost') {
      if (!['approved', 'rejected'].includes(event.status)) throw new Error('Invalid moderation status');
      const result = await db.collection('posts').doc(event.postId).get();
      const update = {
        moderationStatus: event.status,
        moderationReason: String(event.reason || '').slice(0, 300),
        reviewedAt: Date.now(),
        reviewedBy: admin._id,
      };
      await db.collection('posts').doc(event.postId).update({ data: update });
      await audit(admin._id, 'review_post', 'post', event.postId, JSON.stringify(update));
      await notify(result.data.authorId, event.postId, event.status === 'approved' ? '你的动态已通过人工审核' : '你的动态未通过人工审核');
      return { ok: true, data: normalizePost({ ...result.data, ...update }) };
    }

    if (event.action === 'listAuditLogs') {
      const result = await db.collection('audit_logs').orderBy('createdAt', 'desc').limit(200).get();
      return { ok: true, data: result.data.map((item) => ({ ...item, id: item._id })) };
    }

    if (event.action === 'listUsers') {
      const result = await db.collection('users').orderBy('createdAt', 'desc').limit(200).get();
      return { ok: true, data: result.data.map(publicUser) };
    }

    if (event.action === 'updateUser') {
      const target = await db.collection('users').doc(event.userId).get();
      if (target.data._id === admin._id && event.input?.status !== 'active') throw new Error('Cannot disable current admin');
      const status = event.input?.status;
      if (!['active', 'disabled', 'muted'].includes(status)) throw new Error('Invalid user status');
      const update = {
        status,
        mutedUntil: status === 'muted' ? Number(event.input?.mutedUntil || Date.now() + 86400000) : 0,
        updatedAt: Date.now(),
      };
      await db.collection('users').doc(event.userId).update({ data: update });
      await audit(admin._id, 'update_user_status', 'user', event.userId, JSON.stringify(update));
      await notify(event.userId, event.userId, status === 'active' ? '你的账号状态已恢复' : status === 'muted' ? '你的账号已被禁言' : '你的账号已被停用');
      return { ok: true, data: publicUser({ ...target.data, ...update }) };
    }

    throw new Error('Unsupported action');
  } catch (error) {
    return { ok: false, message: error.message || 'Admin operation failed' };
  }
};
