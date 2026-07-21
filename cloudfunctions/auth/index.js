const crypto = require('crypto');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const PHONE_HASH_SECRET = String(process.env.PHONE_HASH_SECRET || '').trim();

function maskPhone(phoneNumber) {
  const normalized = String(phoneNumber || '').replace(/\s+/g, '');
  if (normalized.length >= 7) return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
  if (normalized.length >= 4) return `${normalized.slice(0, 2)}***${normalized.slice(-2)}`;
  return '已验证';
}

function phoneKey(countryCode, phoneNumber) {
  if (!PHONE_HASH_SECRET) throw new Error('PHONE_HASH_SECRET is not configured');
  return crypto
    .createHmac('sha256', PHONE_HASH_SECRET)
    .update(`${String(countryCode || '').trim()}:${String(phoneNumber || '').trim()}`)
    .digest('hex');
}

function normalizeUser(user) {
  const { phoneKey: hiddenPhoneKey, phoneNumber, unionid, ...safe } = user;
  return {
    ...safe,
    id: user._id,
    openid: user.openid,
    phoneBound: Boolean(user.phoneVerifiedAt && hiddenPhoneKey),
    phoneNumberMasked: user.phoneNumberMasked || '',
    isMe: true,
  };
}

function extractPhoneInfo(response) {
  return response?.phoneInfo
    || response?.result?.phoneInfo
    || response?.result?.phone_info
    || response?.phone_info
    || null;
}

async function findOrCreateUser(openid, unionid) {
  const found = await db.collection('users').where({ openid }).limit(1).get();
  const now = Date.now();
  if (found.data.length) {
    const user = found.data[0];
    if (['disabled', 'deleted'].includes(user.status)) throw new Error('Account unavailable');
    await db.collection('users').doc(user._id).update({
      data: { lastLoginAt: now, updatedAt: now },
    });
    return { ...user, lastLoginAt: now, updatedAt: now };
  }

  const user = {
    openid,
    unionid: unionid || '',
    nickname: '新宠友',
    avatar: '/assets/avatar-default.png',
    bio: '',
    status: 'active',
    role: 'user',
    phoneBound: false,
    phoneNumberMasked: '',
    phoneCountryCode: '',
    phoneVerifiedAt: 0,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  const created = await db.collection('users').add({ data: user });
  return { _id: created._id, ...user };
}

async function bindPhone(user, code) {
  if (!String(code || '').trim()) throw new Error('缺少手机号授权凭证');

  const response = await cloud.openapi.phonenumber.getPhoneNumber({ code: String(code).trim() });
  const info = extractPhoneInfo(response);
  const purePhoneNumber = String(
    info?.purePhoneNumber
      || info?.pure_phone_number
      || info?.phoneNumber
      || info?.phone_number
      || '',
  ).trim();
  const countryCode = String(info?.countryCode || info?.country_code || '86').trim();
  if (!purePhoneNumber) throw new Error('微信未返回可用手机号');

  const key = phoneKey(countryCode, purePhoneNumber);
  const duplicated = await db.collection('users').where({ phoneKey: key }).limit(2).get();
  const occupied = duplicated.data.find((item) => item._id !== user._id && item.status !== 'deleted');
  if (occupied) throw new Error('该手机号已绑定其他账号');

  const now = Date.now();
  const update = {
    phoneKey: key,
    phoneBound: true,
    phoneNumberMasked: maskPhone(purePhoneNumber),
    phoneCountryCode: countryCode,
    phoneVerifiedAt: now,
    lastLoginAt: now,
    updatedAt: now,
  };
  await db.collection('users').doc(user._id).update({ data: update });
  return { ...user, ...update };
}

exports.main = async (event) => {
  try {
    if (!['initUser', 'getSession', 'bindPhone'].includes(event.action)) {
      throw new Error('Unsupported action');
    }
    const { OPENID, UNIONID } = cloud.getWXContext();
    if (!OPENID) throw new Error('Missing OPENID');

    let user = await findOrCreateUser(OPENID, UNIONID);
    if (event.action === 'bindPhone') user = await bindPhone(user, event.code);
    return { ok: true, data: normalizeUser(user) };
  } catch (error) {
    return { ok: false, message: error.message || 'Authentication failed' };
  }
};
