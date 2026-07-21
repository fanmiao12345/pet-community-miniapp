import { Pet, Post, Topic } from '../../models/index';
import { checkTextBeforeSubmit } from '../../services/content-security';
import { createPost, listPets, listTopics } from '../../services/repository';
import { deleteCloudFiles, uploadImages } from '../../services/upload';
import { showError, showSuccess } from '../../utils/ui';

Page({
  data: {
    pets: [] as Pet[],
    topics: [] as Topic[],
    petIndex: -1,
    topicIndex: -1,
    content: '',
    images: [] as string[],
    submitting: false,
    progressText: '',
  },
  onShow() { this.loadOptions(); },
  async loadOptions() {
    try {
      const [pets, topics] = await Promise.all([listPets(), listTopics()]);
      // 不自动选中,宠物和话题都是可选的;只有已经选过的情况下保留原选择。
      this.setData({ pets, topics });
    } catch (error) { showError(error); }
  },
  onPetChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ petIndex: Number(event.detail.value) });
  },
  onTopicChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ topicIndex: Number(event.detail.value) });
  },
  onContentInput(event: WechatMiniprogram.Input) {
    this.setData({ content: event.detail.value });
  },
  async chooseImages() {
    try {
      const remain = 9 - this.data.images.length;
      if (remain <= 0) return;
      const result = await wx.chooseMedia({ count: remain, mediaType: ['image'], sourceType: ['album', 'camera'] });
      this.setData({ images: [...this.data.images, ...result.tempFiles.map((item: { tempFilePath: string }) => item.tempFilePath)] });
    } catch (_) {
      // 用户取消选择时不提示错误。
    }
  },
  removeImage(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images });
  },
  goCreatePet() {
    wx.navigateTo({ url: '/pages/pet/create' });
  },
  async submit() {
    if (this.data.submitting) return;
    // 宠物、话题、文字、图片全部可选,只要"文字或图片"至少一项即可发布。
    const pet = this.data.pets[this.data.petIndex];
    const topic = this.data.topics[this.data.topicIndex];
    const hasText = Boolean(this.data.content.trim());
    const hasImages = this.data.images.length > 0;
    if (!hasText && !hasImages) return showError(new Error('请输入动态内容或选择图片'));

    this.setData({ submitting: true, progressText: hasText ? '正在检查文字内容…' : '正在上传图片…' });
    let uploadedImages: string[] = [];
    try {
      if (hasText) {
        const security = await checkTextBeforeSubmit(this.data.content.trim(), 'forum');
        if (!security.passed) throw new Error(security.reason || '内容未通过安全检查');
      }

      this.setData({ progressText: this.data.images.length ? '正在上传图片…' : '正在发布…' });
      uploadedImages = await uploadImages(this.data.images, 'posts', (completed, total) => {
        this.setData({ progressText: `正在上传图片 ${completed}/${total}` });
      });

      this.setData({ progressText: '正在提交内容审核…' });
      const post = await createPost({
        petId: pet ? pet.id : '',
        topicId: topic ? topic.id : '',
        content: this.data.content,
        images: uploadedImages,
      }) as Post;
      showSuccess(post.moderationStatus === 'pending' ? '已提交审核' : '发布成功');
      this.setData({ content: '', images: [], petIndex: -1, topicIndex: -1, progressText: '' });
      setTimeout(() => wx.switchTab({ url: '/pages/me/index' }), 350);
    } catch (error) {
      await deleteCloudFiles(uploadedImages);
      showError(error);
    } finally {
      this.setData({ submitting: false, progressText: '' });
    }
  },
});
