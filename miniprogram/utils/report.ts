import { ReportTargetType } from '../models/index';
import { reportTarget } from '../services/repository';
import { showSuccess } from './ui';

const REASONS = ['垃圾广告', '不友善或骚扰', '虚假信息', '不当内容', '其他'];

function isUserCancelled(error: unknown): boolean {
  if (!(error instanceof Error) && (typeof error !== 'object' || error === null)) return false;
  const message = (error as { errMsg?: string }).errMsg || (error as Error).message || '';
  return /cancel/i.test(message);
}

export async function chooseAndSubmitReport(targetType: ReportTargetType, targetId: string): Promise<void> {
  let tapIndex: number;
  try {
    const result = await wx.showActionSheet({ itemList: REASONS });
    tapIndex = result.tapIndex;
  } catch (error) {
    // 用户主动取消 ActionSheet 时不应该弹错误提示,静默返回即可。
    if (isUserCancelled(error)) return;
    throw error;
  }
  const reason = REASONS[tapIndex];
  if (!reason) return;
  await reportTarget({ targetType, targetId, reason });
  showSuccess('举报已提交');
}
