import { Post } from '../models/index';

/**
 * 在页面 data.posts 数组里就地更新某条 post。
 * 返回更新前的快照,便于乐观更新失败时回滚:
 *
 *   const snapshot = applyPostUpdate(this.data, this.setData.bind(this), id, updater);
 *   try { ... } catch { applyPostUpdate(..., () => snapshot); }
 *
 * 之所以放在 utils 而不是各 page 内联,是因为 feed / topic-detail / favorites /
 * user-profile 四个页面都有完全一样的列表+点赞+收藏结构,统一抽工具避免漂移。
 */
export type PostListData = { posts: Post[] };
export type PageSetter<T extends PostListData> = (data: Partial<T>) => void;

export function updatePostInList<T extends PostListData>(
  data: T,
  setData: PageSetter<T>,
  postId: string,
  updater: (post: Post) => Post,
): Post | null {
  const index = data.posts.findIndex((item) => item.id === postId);
  if (index < 0) return null;
  const prev = data.posts[index];
  const next = updater(prev);
  const posts = [...data.posts];
  posts[index] = next;
  setData({ posts });
  return prev;
}

/** 翻转点赞的乐观更新算子。 */
export function toggleLikeUpdater(post: Post): Post {
  return {
    ...post,
    likedByMe: !post.likedByMe,
    likeCount: Math.max(0, (post.likeCount || 0) + (post.likedByMe ? -1 : 1)),
  };
}

/** 翻转收藏的乐观更新算子。 */
export function toggleFavoriteUpdater(post: Post): Post {
  return {
    ...post,
    favoritedByMe: !post.favoritedByMe,
    favoriteCount: Math.max(0, (post.favoriteCount || 0) + (post.favoritedByMe ? -1 : 1)),
  };
}
