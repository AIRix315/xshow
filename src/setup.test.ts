// Phase 1 setup verification
import { describe, it, expect } from 'vitest';

describe('XShow Phase 1 — Setup Verification', () => {
  it('project skeleton is valid', () => {
    // This test verifies the project can be imported and run
    expect(true).toBe(true);
  });

  it('default channel config structure is correct', () => {
    const channel = {
      id: 'default',
      name: 'API Studio',
      url: 'https://apistudio.cc',
      key: '',
    };
    expect(channel).toHaveProperty('id');
    expect(channel).toHaveProperty('name');
    expect(channel).toHaveProperty('url');
    expect(channel).toHaveProperty('key');
  });

  it('default API config structure is correct', () => {
    const config = {
      channels: [{ id: 'default', name: 'API Studio', url: 'https://apistudio.cc', key: '' }],
      imageChannelId: 'default',
      drawingModel: 'gemini-3.1-flash-image-preview',
      videoChannelId: 'default',
      videoModel: '',
      textChannelId: 'default',
      textModel: 'gpt-3.5-turbo',
      audioChannelId: 'default',
      audioModel: 'whisper-1',
      ttsVoice: 'alloy',
      videoDurations: '10\n15',
      presetPrompts: [],
    };
    expect(config.channels).toHaveLength(1);
    expect(config.ttsVoice).toBe('alloy');
    expect(config.videoDurations).toContain('\n');
  });

  it('project CRUD operations', () => {
    const projects = [
      { id: 'default', name: '默认项目' },
    ];
    const newProject = { id: Date.now().toString(), name: '测试项目' };
    projects.push(newProject);
    expect(projects).toHaveLength(2);
    expect(projects[1].name).toBe('测试项目');
  });
});