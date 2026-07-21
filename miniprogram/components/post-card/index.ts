Component({
  properties: {
    post: { type: Object, value: null },
  },
  methods: {
    openPost() {
      const post = this.data.post as { id: string };
      this.triggerEvent('open', { id: post.id });
    },
    openAuthor() {
      const post = this.data.post as { authorId: string };
      this.triggerEvent('author', { id: post.authorId });
    },
    toggleLike() {
      const post = this.data.post as { id: string };
      this.triggerEvent('like', { id: post.id });
    },
    toggleFavorite() {
      const post = this.data.post as { id: string };
      this.triggerEvent('favorite', { id: post.id });
    },
    previewImage(event: WechatMiniprogram.TouchEvent) {
      const current = event.currentTarget.dataset.src as string;
      const post = this.data.post as { images: string[] };
      wx.previewImage({ current, urls: post.images });
    },
  },
});
