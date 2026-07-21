import { ENV } from './config/env';
import { initializeDemoData } from './services/mock-repository';
import { guardPhoneAuthorization, initializeSession } from './services/session';

function launchEntryUrl(options: { path?: string; query?: Record<string, unknown> }): string {
  const path = options.path || '';
  if (!path || path.startsWith('pages/auth/')) return '';
  const query = Object.keys(options.query || {})
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(options.query?.[key] ?? ''))}`)
    .join('&');
  return `/${path}${query ? `?${query}` : ''}`;
}

App<IAppOption>({
  globalData: {
    currentUserId: '',
    openid: '',
    phoneAuthorized: false,
    pendingEntryUrl: '',
    sessionReady: null,
  },
  onLaunch(options: { path?: string; query?: Record<string, unknown> }) {
    this.globalData.pendingEntryUrl = launchEntryUrl(options);

    if (ENV.dataMode === 'cloud' && wx.cloud) {
      wx.cloud.init({
        env: ENV.cloudEnvId || undefined,
        traceUser: true,
      });
    } else {
      initializeDemoData();
    }

    this.globalData.sessionReady = initializeSession().catch((error) => {
      console.error('Session initialization failed:', error);
      throw error;
    });
  },
  onShow() {
    const ready = this.globalData.sessionReady || initializeSession();
    ready
      .then(() => guardPhoneAuthorization())
      .catch((error: unknown) => console.error('Phone authorization guard failed:', error));
  },
});
