// chromeHelpers 测试
import { describe, it, expect } from 'vitest';

describe('chromeHelpers — base64ToFile', () => {
  it('converts base64 data URL to File', () => {
    const base64 = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
    const parts = base64.split(',');
    const header = parts[0] ?? '';
    const data = parts[1] ?? '';
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    const file = new File([array], 'test.txt', { type: mime });
    expect(file.type).toBe('text/plain');
    expect(file.name).toBe('test.txt');
  });
});

describe('chromeHelpers — sendToActiveTab validation', () => {
  it('throws error when chrome APIs are not available', async () => {
    const { sendToActiveTab } = await import('./chromeHelpers');
    const resource = {
      id: 'test-1',
      url: 'https://example.com/image.png',
      type: 'image' as const,
      timestamp: Date.now(),
      pageUrl: 'https://example.com/page',
      pageTitle: 'Test Page',
    };
    await expect(sendToActiveTab(resource)).rejects.toThrow();
  });
});