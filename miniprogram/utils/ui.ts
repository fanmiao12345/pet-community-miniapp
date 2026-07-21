export function showError(error: unknown, fallback = '操作失败，请重试'): void {
  const message = error instanceof Error ? error.message : fallback;
  wx.showToast({ title: message || fallback, icon: 'none' });
}

export function showSuccess(message: string): void {
  wx.showToast({ title: message, icon: 'success' });
}
