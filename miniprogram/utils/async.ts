import { showError } from './ui';

/**
 * 包装一个异步事件处理函数,统一捕获错误并 showError。
 *
 * 用于消除页面里大量重复的 try/catch + showError 模板:
 *
 *   // 之前
 *   async likePost() {
 *     try { await toggleLike(id); } catch (e) { showError(e); }
 *   }
 *
 *   // 之后
 *   likePost: withError(async () => { await toggleLike(id); })
 *
 * 注意:不会吞掉异常,catch 后不重新 throw(showToast 已经给了用户反馈)。
 * 调用方需要明确这个语义——仅适合"失败仅需 toast,不需要后续补救"的场景。
 * 乐观更新场景请手动 try/catch,因为需要回滚状态。
 */
export function withError<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<unknown>,
  fallback = '操作失败，请重试',
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    try {
      await handler(...args);
    } catch (error) {
      showError(error, fallback);
    }
  };
}
