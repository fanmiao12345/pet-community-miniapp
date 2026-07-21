import { ENV } from '../config/env';
import { User } from '../models/index';
import {
  bindMockPhoneNumber,
  getCurrentUser as getMockCurrentUser,
} from './mock-repository';

const PHONE_LOGIN_ROUTE = 'pages/auth/login';
const PHONE_PRIVACY_ROUTE = 'pages/auth/privacy';
const DEFAULT_HOME_URL = '/pages/feed/index';

let cachedUser: User | null = null;
let sessionPromise: Promise<User> | null = null;
let redirectingToLogin = false;

function normalizeCloudUser(payload: User): User {
  if (!payload?.id) throw new Error('云端用户数据缺少 id');
  return payload;
}

function isPublicAuthRoute(route: string): boolean {
  return route === PHONE_LOGIN_ROUTE || route === PHONE_PRIVACY_ROUTE;
}

function serializeOptions(options: Record<string, unknown> = {}): string {
  return Object.keys(options)
    .filter((key) => options[key] !== undefined && options[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(options[key]))}`)
    .join('&');
}

export function currentPageUrl(): string {
  const pages = getCurrentPages() as Array<{ route?: string; options?: Record<string, unknown> }>;
  const page = pages[pages.length - 1];
  if (!page?.route || isPublicAuthRoute(page.route)) return DEFAULT_HOME_URL;
  const query = serializeOptions(page.options || {});
  return `/${page.route}${query ? `?${query}` : ''}`;
}

function safeRedirectUrl(url?: string): string {
  if (!url || !url.startsWith('/pages/') || url.includes('/pages/auth/')) return DEFAULT_HOME_URL;
  return url;
}

async function initializeCloudSession(): Promise<User> {
  if (!wx.cloud) throw new Error('当前基础库不支持云开发');
  const result = await wx.cloud.callFunction({ name: 'auth', data: { action: 'initUser' } });
  const payload = result.result as { ok: boolean; data?: User; message?: string };
  if (!payload?.ok || !payload.data) throw new Error(payload?.message || '用户登录失败');
  return normalizeCloudUser(payload.data);
}

export function setSessionUser(user: User): User {
  cachedUser = user;
  const app = getApp<IAppOption>();
  app.globalData.currentUserId = user.id;
  app.globalData.openid = user.openid || '';
  app.globalData.phoneAuthorized = Boolean(user.phoneBound && user.phoneVerifiedAt);
  return user;
}

export async function initializeSession(): Promise<User> {
  if (cachedUser) return cachedUser;
  if (sessionPromise) return sessionPromise;

  sessionPromise = (ENV.dataMode === 'cloud' ? initializeCloudSession() : getMockCurrentUser())
    .then(setSessionUser)
    .catch((error) => {
      sessionPromise = null;
      throw error;
    });
  return sessionPromise;
}

export function isPhoneAuthorized(user: User | null | undefined): boolean {
  return Boolean(user?.phoneBound && user.phoneVerifiedAt);
}

export function routeToPhoneLogin(redirectUrl?: string): void {
  const pages = getCurrentPages() as Array<{ route?: string }>;
  const currentRoute = pages[pages.length - 1]?.route || '';
  if (isPublicAuthRoute(currentRoute) || redirectingToLogin) return;

  const app = getApp<IAppOption>();
  const target = safeRedirectUrl(redirectUrl || currentPageUrl());
  app.globalData.pendingEntryUrl = target;
  redirectingToLogin = true;
  wx.reLaunch({
    url: `/pages/auth/login/index?redirect=${encodeURIComponent(target)}`,
    complete: () => {
      redirectingToLogin = false;
    },
  });
}

export async function guardPhoneAuthorization(redirectUrl?: string): Promise<boolean> {
  const user = await initializeSession();
  if (isPhoneAuthorized(user)) return true;
  routeToPhoneLogin(redirectUrl);
  return false;
}

export async function ensurePhoneAuthorized(): Promise<User> {
  const user = await initializeSession();
  if (isPhoneAuthorized(user)) return user;
  routeToPhoneLogin();
  throw new Error('请先授权手机号后再使用');
}

export async function bindPhoneNumber(code?: string): Promise<User> {
  let user: User;
  if (ENV.dataMode === 'mock') {
    user = await bindMockPhoneNumber();
  } else {
    if (!wx.cloud) throw new Error('当前基础库不支持云开发');
    if (!code) throw new Error('未获取到手机号授权凭证，请重新授权');
    const result = await wx.cloud.callFunction({
      name: 'auth',
      data: { action: 'bindPhone', code },
    });
    const payload = result.result as { ok: boolean; data?: User; message?: string };
    if (!payload?.ok || !payload.data) throw new Error(payload?.message || '手机号授权失败');
    user = normalizeCloudUser(payload.data);
  }
  sessionPromise = Promise.resolve(user);
  return setSessionUser(user);
}

export async function ensureSession(): Promise<User> {
  return initializeSession();
}

export function getCachedSessionUser(): User | null {
  return cachedUser;
}

export function consumePendingEntryUrl(fallback = DEFAULT_HOME_URL): string {
  const app = getApp<IAppOption>();
  const target = safeRedirectUrl(app.globalData.pendingEntryUrl || fallback);
  app.globalData.pendingEntryUrl = '';
  return target;
}

export function clearSession(): void {
  cachedUser = null;
  sessionPromise = null;
  redirectingToLogin = false;
  const app = getApp<IAppOption>();
  app.globalData.currentUserId = '';
  app.globalData.openid = '';
  app.globalData.phoneAuthorized = false;
  app.globalData.pendingEntryUrl = '';
  app.globalData.sessionReady = null;
}
