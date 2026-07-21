import { ENV } from '../config/env';
import { SecurityCheckResult } from '../models/index';
import { checkText as checkMockText } from './moderation';
import { ensurePhoneAuthorized } from './session';

export type SecurityScene = 'profile' | 'comment' | 'forum' | 'social';

const sceneMap: Record<SecurityScene, number> = {
  profile: 1,
  comment: 2,
  forum: 3,
  social: 4,
};

export async function checkTextBeforeSubmit(
  content: string,
  scene: SecurityScene = 'forum',
): Promise<SecurityCheckResult> {
  if (ENV.dataMode === 'mock') {
    const result = await checkMockText(content);
    return {
      passed: result.passed,
      suggest: result.passed ? 'pass' : 'risky',
      reason: result.passed ? '' : (result.reason || '内容未通过安全检查'),
    };
  }
  if (!wx.cloud) throw new Error('当前基础库不支持云开发');
  await ensurePhoneAuthorized();
  const result = await wx.cloud.callFunction({
    name: 'contentSecurity',
    data: { action: 'checkText', content, scene: sceneMap[scene] || ENV.securityScene },
  });
  const payload = result.result as { ok: boolean; data?: SecurityCheckResult; message?: string };
  if (!payload?.ok || !payload.data) throw new Error(payload?.message || '内容安全检查失败');
  return payload.data;
}

export function moderationStatusText(status: 'pending' | 'approved' | 'rejected'): string {
  if (status === 'pending') return '内容正在审核，仅自己可见';
  if (status === 'rejected') return '内容未通过审核，仅自己可见';
  return '';
}
