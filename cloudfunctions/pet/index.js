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

function normalize(doc) {
  return { ...doc, id: doc._id };
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
      scene: 1,
      openid,
    });
    if (extractSuggest(response) !== 'pass') throw new Error('Pet profile rejected by security check');
  } catch (error) {
    if (SECURITY_FAIL_OPEN) return;
    throw error;
  }
}

exports.main = async (event) => {
  try {
    const owner = await currentUser();
    if (event.action === 'listMine' || event.action === 'listByOwner') {
      const targetOwnerId = event.action === 'listMine' ? owner._id : event.userId;
      if (!targetOwnerId) throw new Error('Owner required');
      const result = await db.collection('pets').where({ ownerId: targetOwnerId }).orderBy('createdAt', 'desc').get();
      return { ok: true, data: result.data.map(normalize) };
    }
    if (event.action === 'get') {
      const result = await db.collection('pets').doc(event.petId).get();
      return { ok: true, data: normalize(result.data) };
    }
    if (event.action === 'create') {
      const input = event.input || {};
      const name = String(input.name || '').trim();
      const breed = String(input.breed || '').trim();
      const bio = String(input.bio || '').trim();
      const avatar = String(input.avatar || '/assets/pet-default.png');
      if (!name || name.length > 20) throw new Error('Invalid pet name');
      if (breed.length > 30 || bio.length > 120) throw new Error('Pet profile too long');
      if (!['cat', 'dog', 'other'].includes(input.species)) throw new Error('Invalid species');
      if (!['male', 'female', 'unknown'].includes(input.gender)) throw new Error('Invalid gender');
      if (avatar && !avatar.startsWith('cloud://') && !avatar.startsWith('/assets/')) throw new Error('Invalid avatar path');
      await ensureSafeText(owner.openid, `${name}\n${breed}\n${bio}`);
      const now = Date.now();
      const doc = {
        name,
        breed,
        bio,
        avatar,
        species: input.species,
        gender: input.gender,
        birthday: String(input.birthday || ''),
        ownerId: owner._id,
        createdAt: now,
        updatedAt: now,
      };
      const result = await db.collection('pets').add({ data: doc });
      return { ok: true, data: { id: result._id, ...doc } };
    }
    throw new Error('Unsupported action');
  } catch (error) {
    return { ok: false, message: error.message || 'Pet operation failed' };
  }
};
