import { Gender, Species } from '../../models/index';
import { checkTextBeforeSubmit } from '../../services/content-security';
import { createPet } from '../../services/repository';
import { deleteCloudFiles, uploadImage } from '../../services/upload';
import { showError, showSuccess } from '../../utils/ui';

const speciesOptions = [
  { label: '猫', value: 'cat' as Species },
  { label: '狗', value: 'dog' as Species },
  { label: '其他', value: 'other' as Species },
];
const genderOptions = [
  { label: '未知', value: 'unknown' as Gender },
  { label: '弟弟', value: 'male' as Gender },
  { label: '妹妹', value: 'female' as Gender },
];

Page({
  data: {
    name: '', breed: '', bio: '', birthday: '', avatar: '/assets/pet-default.png',
    speciesOptions, genderOptions, speciesIndex: 0, genderIndex: 0, saving: false,
  },
  onName(event: WechatMiniprogram.Input) { this.setData({ name: event.detail.value }); },
  onBreed(event: WechatMiniprogram.Input) { this.setData({ breed: event.detail.value }); },
  onBio(event: WechatMiniprogram.Input) { this.setData({ bio: event.detail.value }); },
  onBirthday(event: WechatMiniprogram.PickerChange) { this.setData({ birthday: event.detail.value }); },
  onSpecies(event: WechatMiniprogram.PickerChange) { this.setData({ speciesIndex: Number(event.detail.value) }); },
  onGender(event: WechatMiniprogram.PickerChange) { this.setData({ genderIndex: Number(event.detail.value) }); },
  async chooseAvatar() {
    try {
      const result = await wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] });
      this.setData({ avatar: result.tempFiles[0].tempFilePath });
    } catch (_) {}
  },
  async save() {
    if (!this.data.name.trim()) return showError(new Error('请输入宠物名称'));
    this.setData({ saving: true });
    let uploadedAvatar = '';
    try {
      const security = await checkTextBeforeSubmit(
        `${this.data.name}\n${this.data.breed}\n${this.data.bio}`,
        'profile',
      );
      if (!security.passed) throw new Error(security.reason || '宠物资料未通过安全检查');
      uploadedAvatar = await uploadImage(this.data.avatar, 'pets');
      await createPet({
        name: this.data.name.trim(),
        species: this.data.speciesOptions[this.data.speciesIndex].value,
        breed: this.data.breed.trim(),
        gender: this.data.genderOptions[this.data.genderIndex].value,
        birthday: this.data.birthday,
        avatar: uploadedAvatar,
        bio: this.data.bio.trim(),
      });
      showSuccess('创建成功');
      setTimeout(() => wx.navigateBack(), 300);
    } catch (error) {
      await deleteCloudFiles(uploadedAvatar ? [uploadedAvatar] : []);
      showError(error);
    } finally { this.setData({ saving: false }); }
  },
});
