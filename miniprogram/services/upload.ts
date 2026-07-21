import { ENV } from '../config/env';
import { ensurePhoneAuthorized } from './session';

export type UploadCategory = 'avatars' | 'pets' | 'posts';

function isRemotePath(path: string): boolean {
  return path.startsWith('cloud://') || path.startsWith('https://') || path.startsWith('http://');
}

function isBundledAsset(path: string): boolean {
  return path.startsWith('/assets/');
}

function fileExtension(filePath: string): string {
  const clean = filePath.split('?')[0];
  const match = clean.match(/\.([a-zA-Z0-9]{1,8})$/);
  const extension = (match?.[1] || 'jpg').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? extension : 'jpg';
}


async function compressLocalImage(filePath: string): Promise<string> {
  if (isRemotePath(filePath) || isBundledAsset(filePath) || fileExtension(filePath) === 'gif') return filePath;
  if (!wx.compressImage) return filePath;
  try {
    const result = await wx.compressImage({ src: filePath, quality: 82 });
    return result.tempFilePath || filePath;
  } catch (_) {
    // 压缩失败(例如 Heic 等特殊格式)时回退到上传原图——宁可上传体积大一些
    // 也不要让用户因为格式问题卡在"选择图片"那一步。
    return filePath;
  }
}

function randomToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildCloudPath(category: UploadCategory, userId: string, filePath: string): string {
  const date = new Date();
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${ENV.uploadRoot}/${category}/${userId}/${month}/${randomToken()}.${fileExtension(filePath)}`;
}

export async function uploadImage(filePath: string, category: UploadCategory): Promise<string> {
  if (!filePath || isRemotePath(filePath) || isBundledAsset(filePath) || ENV.dataMode === 'mock') {
    return filePath;
  }
  if (!wx.cloud) throw new Error('当前基础库不支持云存储');

  const user = await ensurePhoneAuthorized();
  const preparedPath = await compressLocalImage(filePath);
  const result = await wx.cloud.uploadFile({
    cloudPath: buildCloudPath(category, user.id, preparedPath),
    filePath: preparedPath,
  });
  if (!result.fileID) throw new Error('图片上传失败：未返回 fileID');
  return result.fileID;
}

// 并发上传的池大小:太大可能触发云存储 QPS 限制或客户端内存压力,3 路是常见折中。
const UPLOAD_CONCURRENCY = 3;

export async function uploadImages(
  filePaths: string[],
  category: UploadCategory,
  onProgress?: (completed: number, total: number) => void,
): Promise<string[]> {
  const total = filePaths.length;
  // 用与输入顺序对齐的结果数组,避免并发完成顺序不同导致最终顺序漂移。
  const results: string[] = new Array(total);
  let completed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < total) {
      const index = cursor;
      cursor += 1;
      results[index] = await uploadImage(filePaths[index], category);
      completed += 1;
      onProgress?.(completed, total);
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(UPLOAD_CONCURRENCY, total); i += 1) {
    workers.push(worker());
  }

  try {
    await Promise.all(workers);
    return results;
  } catch (error) {
    // 任一 worker 失败时,清理已成功上传的文件,避免存储遗留垃圾。
    await deleteCloudFiles(results.filter((item): item is string => Boolean(item) && item.startsWith('cloud://')));
    throw error;
  }
}

export async function deleteCloudFiles(fileList: string[]): Promise<void> {
  const cloudFiles = fileList.filter((item) => item.startsWith('cloud://'));
  if (!cloudFiles.length || ENV.dataMode !== 'cloud' || !wx.cloud) return;
  try {
    await wx.cloud.deleteFile({ fileList: cloudFiles });
  } catch (error) {
    console.warn('Failed to clean uploaded files:', error);
  }
}
