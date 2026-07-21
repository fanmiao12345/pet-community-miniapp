// 同进程内自增计数器,消除同一毫秒内并发生成 ID 的碰撞风险。
// 单机单实例场景下,与 Date.now() + 随机后缀组合后碰撞概率可忽略不计。
let sequenceCounter = 0;

export function createId(prefix: string): string {
  sequenceCounter = (sequenceCounter + 1) % 0x100000;
  const timestamp = Date.now().toString(36);
  const sequence = sequenceCounter.toString(36).padStart(4, '0');
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timestamp}_${sequence}_${random}`;
}
