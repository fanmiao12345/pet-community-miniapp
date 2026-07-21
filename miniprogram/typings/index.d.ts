interface IAppOption {
  globalData: {
    currentUserId: string;
    openid: string;
    phoneAuthorized: boolean;
    pendingEntryUrl: string;
    sessionReady: Promise<any> | null;
  };
}
