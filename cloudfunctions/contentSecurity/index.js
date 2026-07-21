const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SECURITY_ENABLED = process.env.CONTENT_SECURITY_ENABLED !== 'false';
const SECURITY_FAIL_OPEN = process.env.CONTENT_SECURITY_FAIL_OPEN === 'true';

async function currentUser() {
  const { OPENID } = cloud.getWXContext();
  const result = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!result.data.length) throw new Error('User not initialized');
  if (result.data[0].status === 'disabled') throw new Error('Account disabled');
  if (!result.data[0].phoneVerifiedAt || !result.data[0].phoneKey) throw new Error('PHONE_AUTH_REQUIRED');
  return result.data[0];
}

function extractSuggest(response) {
  return response?.result?.suggest || response?.suggest || response?.result?.detail?.suggest || 'review';
}

function extractTraceId(response) {
  return response?.trace_id || response?.traceId || response?.result?.trace_id || response?.result?.traceId || '';
}

exports.main = async (event) => {
  try {
    const user = await currentUser();
    if (event.action === 'checkText') {
      const content = String(event.content || '').trim();
      if (!content) return { ok: true, data: { passed: true, suggest: 'pass', reason: '' } };
      if (!SECURITY_ENABLED) {
        return { ok: true, data: { passed: true, suggest: 'unavailable', reason: '内容安全检查已在环境变量中关闭' } };
      }
      try {
        const response = await cloud.openapi.security.msgSecCheck({
          content: content.slice(0, 500000),
          version: 2,
          scene: Number(event.scene || 3),
          openid: user.openid,
        });
        const suggest = extractSuggest(response);
        return {
          ok: true,
          data: {
            passed: suggest === 'pass',
            suggest,
            reason: suggest === 'pass' ? '' : '内容未通过微信内容安全检查',
          },
        };
      } catch (error) {
        if (!SECURITY_FAIL_OPEN) throw error;
        return {
          ok: true,
          data: { passed: true, suggest: 'unavailable', reason: '内容安全服务暂时不可用，已按配置放行' },
        };
      }
    }

    if (event.action === 'submitMedia') {
      const fileId = String(event.fileId || '');
      if (!fileId.startsWith('cloud://')) throw new Error('Cloud fileID required');
      const temp = await cloud.getTempFileURL({ fileList: [fileId] });
      const mediaUrl = temp.fileList?.[0]?.tempFileURL;
      if (!mediaUrl) throw new Error('Unable to create media URL');
      const response = await cloud.openapi.security.mediaCheckAsync({
        media_url: mediaUrl,
        media_type: 2,
        version: 2,
        scene: Number(event.scene || 3),
        openid: user.openid,
      });
      const traceId = extractTraceId(response);
      if (!traceId) throw new Error('Missing moderation trace id');
      return { ok: true, data: { traceId } };
    }

    throw new Error('Unsupported action');
  } catch (error) {
    return { ok: false, message: error.message || 'Content security operation failed' };
  }
};
