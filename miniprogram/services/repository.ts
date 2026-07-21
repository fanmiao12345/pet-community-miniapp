import { ENV } from '../config/env';
import * as mock from './mock-repository';
import { cloudRepository } from './cloud-repository';
import { ensurePhoneAuthorized } from './session';

const repository = (ENV.dataMode === 'cloud' ? cloudRepository : mock) as Record<string, unknown>;

type AsyncFunction = (...args: any[]) => Promise<any>;

function protectedOperation<T extends AsyncFunction>(operation: T): T {
  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    await ensurePhoneAuthorized();
    return operation(...args) as Awaited<ReturnType<T>>;
  }) as T;
}

function method<T extends AsyncFunction>(name: string): T {
  const operation = repository[name];
  if (typeof operation !== 'function') throw new Error(`Repository method unavailable: ${name}`);
  return protectedOperation(operation as T);
}

export const getCurrentUser = method<typeof mock.getCurrentUser>('getCurrentUser');
export const getUser = method<typeof mock.getUser>('getUser');
export const updateCurrentUser = method<typeof mock.updateCurrentUser>('updateCurrentUser');
export const listTopics = method<typeof mock.listTopics>('listTopics');
export const listPets = method<typeof mock.listPets>('listPets');
export const listUserPets = method<typeof mock.listUserPets>('listUserPets');
export const getPet = method<typeof mock.getPet>('getPet');
export const createPet = method<typeof mock.createPet>('createPet');
export const listFeed = method<typeof mock.listFeed>('listFeed');
export const getPost = method<typeof mock.getPost>('getPost');
export const createPost = method<typeof mock.createPost>('createPost');
export const deletePost = method<typeof mock.deletePost>('deletePost');
export const toggleLike = method<typeof mock.toggleLike>('toggleLike');
export const toggleFavorite = method<typeof mock.toggleFavorite>('toggleFavorite');
export const listComments = method<typeof mock.listComments>('listComments');
export const createComment = method<typeof mock.createComment>('createComment');
export const deleteComment = method<typeof mock.deleteComment>('deleteComment');
export const toggleFollow = method<typeof mock.toggleFollow>('toggleFollow');
export const listFollowers = method<typeof mock.listFollowers>('listFollowers');
export const listFollowing = method<typeof mock.listFollowing>('listFollowing');
export const listNotifications = method<typeof mock.listNotifications>('listNotifications');
export const getUnreadNotificationCount = method<typeof mock.getUnreadNotificationCount>('getUnreadNotificationCount');
export const markNotificationRead = method<typeof mock.markNotificationRead>('markNotificationRead');
export const markAllNotificationsRead = method<typeof mock.markAllNotificationsRead>('markAllNotificationsRead');
export const reportTarget = method<typeof mock.reportTarget>('reportTarget');
export const toggleBlock = method<typeof mock.toggleBlock>('toggleBlock');
export const isUserBlocked = method<typeof mock.isUserBlocked>('isUserBlocked');
export const listBlockedUsers = method<typeof mock.listBlockedUsers>('listBlockedUsers');
export const getAdminStats = method<typeof mock.getAdminStats>('getAdminStats');
export const listAdminReports = method<typeof mock.listAdminReports>('listAdminReports');
export const resolveReport = method<typeof mock.resolveReport>('resolveReport');
export const listModerationQueue = method<typeof mock.listModerationQueue>('listModerationQueue');
export const reviewPost = method<typeof mock.reviewPost>('reviewPost');
export const listAdminUsers = method<typeof mock.listAdminUsers>('listAdminUsers');
export const updateUserAdmin = method<typeof mock.updateUserAdmin>('updateUserAdmin');
export const listAuditLogs = method<typeof mock.listAuditLogs>('listAuditLogs');
export const deleteCurrentAccount = method<typeof mock.deleteCurrentAccount>('deleteCurrentAccount');
export const resetDemoData = mock.resetDemoData;
