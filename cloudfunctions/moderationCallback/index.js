const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function extractTraceId(event) {
  return event.trace_id || event.traceId || '';
}

function extractSuggest(event) {
  return event.result?.suggest || event.detail?.suggest || event.suggest || (event.isrisky === 0 ? 'pass' : 'risky');
}

async function notifyAuthor(post, status) {
  const summary = status === 'approved' ? '你的动态已通过审核' : '你的动态未通过审核';
  await db.collection('notifications').add({
    data: {
      userId: post.authorId,
      actorId: 'system',
      actorSnapshot: { nickname: '宠友圈助手', avatar: '/assets/avatar-default.png' },
      type: 'moderation',
      targetId: post._id,
      targetSummary: summary,
      read: false,
      createdAt: Date.now(),
    },
  });
}

exports.main = async (event) => {
  try {
    const traceId = extractTraceId(event);
    const suggest = extractSuggest(event);
    if (!traceId) throw new Error('Missing trace id');

    const jobs = await db.collection('moderation_jobs').where({ traceId }).limit(1).get();
    if (!jobs.data.length) return { ok: true, data: { ignored: true, reason: 'Unknown trace id' } };
    const job = jobs.data[0];
    if (job.status !== 'pending') return { ok: true, data: { ignored: true, reason: 'Job already processed' } };

    const passed = suggest === 'pass';
    await db.collection('moderation_jobs').doc(job._id).update({
      data: {
        status: passed ? 'approved' : 'rejected',
        suggest,
        callbackPayload: event,
        updatedAt: Date.now(),
      },
    });

    const postResult = await db.collection('posts').doc(job.postId).get();
    const post = postResult.data;
    if (!passed) {
      await db.collection('posts').doc(job.postId).update({
        data: {
          moderationStatus: 'rejected',
          moderationReason: '图片未通过内容安全审核',
          reviewedAt: Date.now(),
        },
      });
      if (job.fileId?.startsWith('cloud://')) {
        try { await cloud.deleteFile({ fileList: [job.fileId] }); } catch (_) {}
      }
      await notifyAuthor(post, 'rejected');
      return { ok: true, data: { postId: job.postId, status: 'rejected' } };
    }

    if (post.reviewedBy && post.moderationStatus === 'rejected') {
      return { ok: true, data: { postId: job.postId, status: 'rejected', ignored: true, reason: 'Manual review takes precedence' } };
    }

    const allJobs = await db.collection('moderation_jobs').where({ postId: job.postId }).get();
    const states = allJobs.data.map((item) => item._id === job._id ? 'approved' : item.status);
    const hasRejected = states.includes('rejected');
    const hasPending = states.includes('pending') || states.includes('manual');
    if (!hasRejected && !hasPending) {
      await db.collection('posts').doc(job.postId).update({
        data: {
          moderationStatus: 'approved',
          moderationReason: '',
          reviewedAt: Date.now(),
        },
      });
      await notifyAuthor(post, 'approved');
      return { ok: true, data: { postId: job.postId, status: 'approved' } };
    }

    return { ok: true, data: { postId: job.postId, status: 'pending' } };
  } catch (error) {
    return { ok: false, message: error.message || 'Moderation callback failed' };
  }
};
