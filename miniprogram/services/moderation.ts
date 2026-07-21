export interface ModerationResult {
  passed: boolean;
  reason?: string;
}

const MOCK_SENSITIVE_WORDS = ['测试违规词', '保证治愈', '无需就医'];

export async function checkText(content: string): Promise<ModerationResult> {
  const normalized = content.trim();
  if (!normalized) {
    return { passed: false, reason: '内容不能为空' };
  }
  const matched = MOCK_SENSITIVE_WORDS.find((word) => normalized.includes(word));
  if (matched) {
    return { passed: false, reason: '内容包含不适合展示的词语' };
  }
  return { passed: true };
}
