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
  const time = Number(timestamp || 0);
  if (!time) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}天前`;
  return new Date(time).toISOString().slice(0, 10);
}

function normalizePost(post) {
  return { ...post, id: post._id, createdAtText: formatRelativeTime(post.createdAt) };
}

function extractSuggest(response) {
  return response?.result?.suggest || response?.suggest || response?.result?.detail?.suggest || 'review';
}

function extractTraceId(response) {
  return response?.trace_id || response?.traceId || response?.result?.trace_id || response?.result?.traceId || '';
}

async function ensureSafeText(openid, content, scene = 3) {
  if (!SECURITY_ENABLED) return { suggest: 'pass' };
  try {
    const response = await cloud.openapi.security.msgSecCheck({
      content: String(content).slice(0, 500000),
      version: 2,
      scene,
      openid,
    });
    const suggest = extractSuggest(response);
    if (suggest !== 'pass') throw new Error('Content rejected by security check');
    return { suggest };
  } catch (error) {
    if (SECURITY_FAIL_OPEN) return { suggest: 'unavailable' };
    throw error;
  }
}

async function enrichPosts(posts, userId) {
  if (!posts.length) return [];
  const ids = posts.map((item) => item._id);
  const [likes, favorites] = await Promise.all([
    db.collection('likes').where({ userId, targetId: _.in(ids) }).get(),
    db.collection('favorites').where({ userId, targetId: _.in(ids) }).get(),
  ]);
  const likedIds = new Set(likes.data.map((item) => item.targetId));
  const favoriteIds = new Set(favorites.data.map((item) => item.targetId));
  return posts.map((item) => ({
    ...normalizePost(item),
    likedByMe: likedIds.has(item._id),
    favoritedByMe: favoriteIds.has(item._id),
  }));
}

function validatePostInput(input) {
  const content = String(input.content || '').trim();
  const images = Array.isArray(input.images) ? input.images.slice(0, 9).map(String) : [];
  // 允许纯图片发布:文字或图片至少一项。文字长度上限仍保留 1000。
  if (content.length > 1000) throw new Error('Content too long');
  if (!content && images.length === 0) throw new Error('Content or images required');
  // 宠物和话题都是可选的:不选时为空字符串。
  if (images.some((item) => !item.startsWith('cloud://'))) throw new Error('Post images must be uploaded to cloud storage first');
  return { content, images };
}

async function submitImageModeration({ postId, author, images }) {
  if (!images.length) return { traceIds: [], failures: [] };
  if (!SECURITY_ENABLED) return { traceIds: [], failures: [] };

  const urlResult = await cloud.getTempFileURL({ fileList: images });
  const urlMap = new Map(
    (urlResult.fileList || []).map((item) => [item.fileID, item.tempFileURL || '']),
  );
  const traceIds = [];
  const failures = [];

  for (const fileId of images) {
    const mediaUrl = urlMap.get(fileId);
    if (!mediaUrl) {
      failures.push({ fileId, reason: 'Unable to create temporary media URL' });
      continue;
    }
    try {
      const response = await cloud.openapi.security.mediaCheckAsync({
        media_url: mediaUrl,
        media_type: 2,
        version: 2,
        scene: 3,
        openid: author.openid,
      });
      const traceId = extractTraceId(response);
      if (!traceId) throw new Error('Missing moderation trace id');
      traceIds.push(traceId);
      await db.collection('moderation_jobs').add({
        data: {
          postId,
          authorId: author._id,
          fileId,
          traceId,
          type: 'image',
          status: 'pending',
          suggest: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });
    } catch (error) {
      failures.push({ fileId, reason: error.message || 'Image moderation submission failed' });
      await db.collection('moderation_jobs').add({
        data: {
          postId,
          authorId: author._id,
          fileId,
          traceId: '',
          type: 'image',
          status: 'manual',
          suggest: 'review',
          reason: error.message || 'Image moderation submission failed',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });
    }
  }
  return { traceIds, failures };
}

exports.main = async (event) => {
  try {
    if (event.action === 'listTopics') {
      const result = await db.collection('topics').where({ status: _.neq('hidden') }).orderBy('sortOrder', 'asc').get();
      return { ok: true, data: result.data.map((item) => ({ ...item, id: item._id })) };
    }

    const user = await currentUser();
    if (event.action === 'getFeed') {
      const options = event.options || {};
      const includeOwnPending = Boolean(
        options.includeOwnPending && options.authorId && options.authorId === user._id,
      );
      const where = { publishStatus: 'published' };
      if (!includeOwnPending) where.moderationStatus = 'approved';
      const blocked = await db.collection('blocks').where({ userId: user._id }).get();
      const blockedIds = blocked.data.map((item) => item.targetId);
      if (options.topicId) where.topicId = options.topicId;
      if (options.authorId) {
        if (blockedIds.includes(options.authorId) && options.authorId !== user._id) {
          return { ok: true, data: { items: [], hasMore: false } };
        }
        where.authorId = options.authorId;
      } else if (blockedIds.length) {
        where.authorId = _.nin(blockedIds);
      }
      if (options.petId) where.petId = options.petId;

      if (options.followingOnly) {
        const follows = await db.collection('follows').where({ userId: user._id }).get();
        const authorIds = follows.data.map((item) => item.targetId).filter((id) => !blockedIds.includes(id));
        if (!authorIds.length) return { ok: true, data: { items: [], hasMore: false } };
        where.authorId = _.in(authorIds);
      }

      if (options.favoritesOnly) {
        const favorites = await db.collection('favorites').where({ userId: user._id }).get();
        const postIds = favorites.data.map((item) => item.targetId);
        if (!postIds.length) return { ok: true, data: { items: [], hasMore: false } };
        where._id = _.in(postIds);
      }

      const limit = Math.min(Number(options.limit || 10), 50);
      const offset = Math.max(Number(options.offset || 0), 0);
      const result = await db.collection('posts').where(where).orderBy('createdAt', 'desc').skip(offset).limit(limit + 1).get();
      const hasMore = result.data.length > limit;
      const items = await enrichPosts(result.data.slice(0, limit), user._id);
      return { ok: true, data: { items, hasMore } };
    }

    if (event.action === 'getPostDetail') {
      const result = await db.collection('posts').doc(event.postId).get();
      const post = result.data;
      if (post.publishStatus !== 'published') throw new Error('Post unavailable');
      const blocked = await db.collection('blocks').where({ userId: user._id, targetId: post.authorId }).limit(1).get();
      if (blocked.data.length && post.authorId !== user._id && user.role !== 'admin') throw new Error('Post unavailable');
      if (post.moderationStatus !== 'approved' && post.authorId !== user._id && user.role !== 'admin') throw new Error('Post unavailable');
      const items = await enrichPosts([post], user._id);
      return { ok: true, data: items[0] };
    }

    if (event.action === 'createPost') {
      if (user.status === 'muted' && Number(user.mutedUntil || 0) > Date.now()) throw new Error('Account muted');
      const input = event.input || {};
      const { content, images } = validatePostInput(input);
      // 宠物和话题都是可选的:只在传入非空 id 时才查询并校验。
      const petId = String(input.petId || '').trim();
      const topicId = String(input.topicId || '').trim();
      const petResult = petId ? await db.collection('pets').doc(petId).get() : null;
      const topicResult = topicId ? await db.collection('topics').doc(topicId).get() : null;
      if (petResult && petResult.data.ownerId !== user._id) throw new Error('Forbidden pet');
      if (content) await ensureSafeText(user.openid, content, 3);

      const now = Date.now();
      const initialStatus = images.length && SECURITY_ENABLED ? 'pending' : 'approved';
      const doc = {
        authorId: user._id,
        petId,
        authorSnapshot: { nickname: user.nickname, avatar: user.avatar },
        petSnapshot: petResult
          ? { name: petResult.data.name, avatar: petResult.data.avatar, species: petResult.data.species }
          : { name: '', avatar: '', species: 'other' },
        content,
        images,
        topicId,
        topicName: topicResult ? topicResult.data.name : '',
        moderationStatus: initialStatus,
        moderationReason: initialStatus === 'pending' ? '图片正在异步审核' : '',
        moderationTraceIds: [],
        publishStatus: 'published',
        likeCount: 0,
        commentCount: 0,
        favoriteCount: 0,
        createdAt: now,
      };
      const result = await db.collection('posts').add({ data: doc });

      if (images.length && SECURITY_ENABLED) {
        const moderation = await submitImageModeration({ postId: result._id, author: user, images });
        const update = {
          moderationTraceIds: moderation.traceIds,
          moderationReason: moderation.failures.length
            ? '部分图片审核任务未成功提交，等待人工审核'
            : '图片正在异步审核',
        };
        await db.collection('posts').doc(result._id).update({ data: update });
        Object.assign(doc, update);
      }

      return {
        ok: true,
        data: {
          id: result._id,
          ...doc,
          createdAtText: '刚刚',
          likedByMe: false,
          favoritedByMe: false,
        },
      };
    }

    if (event.action === 'deletePost') {
      const result = await db.collection('posts').doc(event.postId).get();
      if (result.data.authorId !== user._id) throw new Error('Forbidden');
      await db.collection('posts').doc(event.postId).update({ data: { publishStatus: 'deleted', deletedAt: Date.now() } });
      return { ok: true };
    }

    throw new Error('Unsupported action');
  } catch (error) {
    return { ok: false, message: error.message || 'Content operation failed' };
  }
};
