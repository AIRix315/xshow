// Ref: §5.3 — 视频生成 API 测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitVideoTask, pollVideoTask, generateVideo } from './videoApi';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('videoApi — submitVideoTask', () => {
  it('sends FormData POST to channel URL with correct fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'task-123' }),
    });

    await submitVideoTask({
      channelUrl: 'https://api.example.com',
      channelKey: 'test-key',
      model: 'video-model',
      prompt: '一只飞翔的鸟',
      size: '1280x720',
      seconds: '10',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(callOptions.method).toBe('POST');
    expect(callOptions.headers).toHaveProperty('Authorization', 'Bearer test-key');
    expect(callOptions.body).toBeInstanceOf(FormData);
  });

  it('returns taskId on successful submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'task-456' }),
    });

    const taskId = await submitVideoTask({
      channelUrl: 'https://api.example.com',
      channelKey: 'key',
      model: 'm',
      prompt: 'p',
      size: '1280x720',
      seconds: '5',
    });

    expect(taskId).toBe('task-456');
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
    });

    await expect(submitVideoTask({
      channelUrl: 'https://api.example.com',
      channelKey: 'key',
      model: 'm',
      prompt: 'p',
      size: '1280x720',
      seconds: '5',
    })).rejects.toThrow('视频任务提交失败: 500');
  });

  it('throws when response has no taskId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'queued' }),
    });

    await expect(submitVideoTask({
      channelUrl: 'https://api.example.com',
      channelKey: 'key',
      model: 'm',
      prompt: 'p',
      size: '1280x720',
      seconds: '5',
    })).rejects.toThrow('无 taskId');
  });
});

describe('videoApi — pollVideoTask', () => {
  it('returns video result when status is completed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'completed',
        video_url: 'https://cdn.example.com/video.mp4',
        thumbnail_url: 'https://cdn.example.com/thumb.jpg',
      }),
    });

    const result = await pollVideoTask('https://api.example.com', 'key', 'task-123');
    expect(result.videoUrl).toBe('https://cdn.example.com/video.mp4');
    expect(result.thumbnailUrl).toBe('https://cdn.example.com/thumb.jpg');
  });

  it('throws when polling returns failed status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: 'failed', error: 'GPU OOM' }),
    });

    await expect(pollVideoTask('https://api.example.com', 'key', 'task-123'))
      .rejects.toThrow('视频生成失败: GPU OOM');
  });
});

describe('videoApi — generateVideo (full flow)', () => {
  it('submits then polls for result', async () => {
    // submitVideoTask
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'task-flow' }),
    });
    // pollVideoTask - single poll returns completed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'completed',
        video_url: 'https://cdn/video.mp4',
        thumbnail_url: 'https://cdn/thumb.jpg',
      }),
    });

    const result = await generateVideo({
      channelUrl: 'https://api.example.com',
      channelKey: 'key',
      model: 'm',
      prompt: 'p',
      size: '1280x720',
      seconds: '5',
    });

    expect(result.videoUrl).toBe('https://cdn/video.mp4');
  });
});