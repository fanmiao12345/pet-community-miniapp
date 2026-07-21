import { checkTextBeforeSubmit } from '../../services/content-security';
import { getCurrentUser, updateCurrentUser } from '../../services/repository';
import { deleteCloudFiles, uploadImage } from '../../services/upload';
import { showError, showSuccess } from '../../utils/ui';

Page({
  data: { nickname: '', bio: '', avatar: '/assets/avatar-default.png', originalAvatar: '', saving: false },
  async onLoad() {
    try {
      const user = await getCurrentUser();
      this.setData({ nickname: user.nickname, bio: user.bio, avatar: user.avatar, originalAvatar: user.avatar });
    } catch (error) { showError(error); }
  },
  onNickname(event: WechatMiniprogram.Input) { this.setData({ nickname: event.detail.value }); },
  onBio(event: WechatMiniprogram.Input) { this.setData({ bio: event.detail.value }); },
  async chooseAvatar() {
    try {
      const result = await wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] });
      this.setData({ avatar: result.tempFiles[0].tempFilePath });
    } catch (_) {}
  },
  async save() {
    if (!this.data.nickname.trim()) return showError(new Error('请输入昵称'));
    this.setData({ saving: true });
    let uploadedAvatar = '';
    try {
      const security = await checkTextBeforeSubmit(`${this.data.nickname}\n${this.data.bio}`, 'profile');
      if (!security.passed) throw new Error(security.reason || '资料内容未通过安全检查');
      uploadedAvatar = await uploadImage(this.data.avatar, 'avatars');
      await updateCurrentUser({ nickname: this.data.nickname.trim(), bio: this.data.bio.trim(), avatar: uploadedAvatar });
      showSuccess('保存成功');
      setTimeout(() => wx.navigateBack(), 300);
    } catch (error) {
      if (uploadedAvatar && uploadedAvatar !== this.data.originalAvatar) await deleteCloudFiles([uploadedAvatar]);
      showError(error);
    } finally { this.setData({ saving: false }); }
  },
});
