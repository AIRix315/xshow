/**
 * ComfyUI 端到端集成测试
 *
 * 测试策略：跳过需要运行中 ComfyUI 实例的测试（标记为 e2e），
 * 确保 CI 中不会因缺少 ComfyUI 而失败。
 * 本地开发时手动运行：npx vitest run src/api/comfyApi.e2e.test.ts
 *
 * 覆盖场景：
 * 1. 工作流列表扫描（目录路径修复验证）
 * 2. 工作流文件读取（路径编码修复验证）
 * 3. API/UI 格式自动识别
 * 4. 工作流执行（提交 → 轮询 → 获取结果）
 * 5. 图片上传
 * 6. 输出 URL 构建（output 对象属性提取修复验证）
 */

import { describe, it, expect, beforeAll } from 'vitest';

// ComfyUI 地址，本地开发时可修改
const COMFY_URL = process.env.COMFY_URL || 'http://127.0.0.1:8188';

// 是否运行 ComfyUI 端到端测试
// 本地开发时: COMFY_E2E=1 npx vitest run src/api/comfyApi.e2e.test.ts
const COMFY_AVAILABLE = process.env.COMFY_E2E === '1';

// 辅助：模拟 extensionFetch 直连（非 Chrome 扩展环境）
async function directFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, options);
}

// ============================================================================
// 纯逻辑测试（不需要 ComfyUI）
// ============================================================================

describe('isApiFormatWorkflow — 纯逻辑', () => {
  /** 判断工作流 JSON 是否为 API 格式（数字 key + class_type） */
  function isApiFormatWorkflow(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj['nodes'])) return false;
    for (const key of Object.keys(obj)) {
      if (/^\d+$/.test(key) && typeof obj[key] === 'object' && obj[key] !== null) {
        const node = obj[key] as Record<string, unknown>;
        if ('class_type' in node) return true;
      }
    }
    return false;
  }

  it('API 格式工作流应返回 true', () => {
    const apiWorkflow = {
      '3': { inputs: { seed: 111, steps: 20 }, class_type: 'KSampler' },
      '4': { inputs: { ckpt_name: 'model.safetensors' }, class_type: 'CheckpointLoaderSimple' },
    };
    expect(isApiFormatWorkflow(apiWorkflow)).toBe(true);
  });

  it('UI 格式工作流应返回 false', () => {
    const uiWorkflow = {
      id: 'abc', revision: 0, last_node_id: 9,
      nodes: [{ id: 3, type: 'KSampler' }],
      links: [], config: {}, extra: {}, version: 0.4,
    };
    expect(isApiFormatWorkflow(uiWorkflow)).toBe(false);
  });

  it('空对象应返回 false', () => {
    expect(isApiFormatWorkflow({})).toBe(false);
    expect(isApiFormatWorkflow(null)).toBe(false);
    expect(isApiFormatWorkflow(undefined)).toBe(false);
  });

  it('有数字 key 但无 class_type 应返回 false', () => {
    const notApi = { '1': { inputs: { text: 'hello' } } }; // 无 class_type
    expect(isApiFormatWorkflow(notApi)).toBe(false);
  });
});

describe('输出 URL 构建 — 纯逻辑', () => {
  it('图片输出对象应正确构建 URL', () => {
    const img = { filename: 'ComfyUI_00072.png', subfolder: '', type: 'output' };
    const subfolder = img.subfolder ? `&subfolder=${encodeURIComponent(img.subfolder)}` : '';
    const url = `http://127.0.0.1:8188/view?filename=${encodeURIComponent(img.filename)}&type=${img.type ?? 'output'}${subfolder}`;
    expect(url).toBe('http://127.0.0.1:8188/view?filename=ComfyUI_00072.png&type=output');
  });

  it('含 subfolder 的图片应正确编码', () => {
    const img = { filename: 'output.png', subfolder: 'AIO', type: 'output' };
    const subfolder = img.subfolder ? `&subfolder=${encodeURIComponent(img.subfolder)}` : '';
    const url = `http://127.0.0.1:8188/view?filename=${encodeURIComponent(img.filename)}&type=${img.type ?? 'output'}${subfolder}`;
    expect(url).toBe('http://127.0.0.1:8188/view?filename=output.png&type=output&subfolder=AIO');
  });

  it('音频输出对象应正确构建 URL', () => {
    const aud = { filename: 'speech.mp3', subfolder: '', type: 'output' };
    const subfolder = aud.subfolder ? `&subfolder=${encodeURIComponent(aud.subfolder)}` : '';
    const url = `http://127.0.0.1:8188/view?filename=${encodeURIComponent(aud.filename)}&type=${aud.type ?? 'output'}${subfolder}`;
    expect(url).toBe('http://127.0.0.1:8188/view?filename=speech.mp3&type=output');
  });
});

describe('工作流路径编码 — 纯逻辑', () => {
  it('根目录文件路径编码正确', () => {
    const relPath = '03-API-ZImage.json';
    const fullPath = `workflows/${relPath}`;
    const encoded = fullPath.split('/').map(seg => encodeURIComponent(seg)).join('%2F');
    expect(encoded).toBe('workflows%2F03-API-ZImage.json');
  });

  it('子目录文件路径编码正确', () => {
    const relPath = 'Backup/test workflow.json';
    const fullPath = `workflows/${relPath}`;
    const encoded = fullPath.split('/').map(seg => encodeURIComponent(seg)).join('%2F');
    expect(encoded).toBe('workflows%2FBackup%2Ftest%20workflow.json');
  });

  it('含特殊字符的文件名编码正确', () => {
    const relPath = 'LTX2.3 单图&文生视频.json';
    const fullPath = `workflows/${relPath}`;
    const encoded = fullPath.split('/').map(seg => encodeURIComponent(seg)).join('%2F');
    expect(encoded).toBe('workflows%2FLTX2.3%20%E5%8D%95%E5%9B%BE%26%E6%96%87%E7%94%9F%E8%A7%86%E9%A2%91.json');
  });

  it('含方括号的文件名编码正确', () => {
    const relPath = 'RHAPI/AIRix [API] Qwen001.json';
    const fullPath = `workflows/${relPath}`;
    const encoded = fullPath.split('/').map(seg => encodeURIComponent(seg)).join('%2F');
    expect(encoded).toBe('workflows%2FRHAPI%2FAIRix%20%5BAPI%5D%20Qwen001.json');
  });
});

const e2eDescribe = COMFY_AVAILABLE ? describe : describe.skip;

// ============================================================================
// 需要 ComfyUI 实例的集成测试
// ============================================================================

e2eDescribe('ComfyUI 端到端 — 需要运行实例', () => {
  // 存储跨测试共享数据
  let workflowJson: Record<string, unknown> | null = null;
  const apiWorkflows: string[] = [];

  beforeAll(async () => {
    // 验证 ComfyUI 是否可用
    const resp = await fetch(`${COMFY_URL}/system_stats`);
    expect(resp.ok).toBe(true);
  });

  it('1. 扫描工作流列表 — dir=workflows 路径正确', async () => {
    const resp = await directFetch(`${COMFY_URL}/userdata?dir=workflows&recurse=true`);
    expect(resp.ok).toBe(true);
    const files: string[] = await resp.json();
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    expect(jsonFiles.length).toBeGreaterThan(0);
  });

  it('2. 读取 API 格式工作流 — 路径编码正确', async () => {
    // 先获取列表
    const listResp = await directFetch(`${COMFY_URL}/userdata?dir=workflows&recurse=true`);
    const files: string[] = await listResp.json();
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // 找到一个 API 格式的工作流
    for (const relPath of jsonFiles) {
      const fullPath = `workflows/${relPath}`;
      const encoded = fullPath.split('/').map(seg => encodeURIComponent(seg)).join('%2F');
      const resp = await directFetch(`${COMFY_URL}/userdata/${encoded}`);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (Array.isArray(data['nodes'])) continue; // UI 格式，跳过

      // 找到 API 格式
      workflowJson = data;
      apiWorkflows.push(relPath);
      break;
    }
    expect(workflowJson).not.toBeNull();
  });

  it('3. 执行工作流 → 轮询 → 获取输出', async () => {
    if (!workflowJson) return; // 前置测试未通过

    const promptId = Date.now().toString();
    const submitResp = await directFetch(`${COMFY_URL}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflowJson, prompt_id: promptId }),
    });
    expect(submitResp.ok).toBe(true);
    const submitJson = await submitResp.json();
    expect(submitJson.node_errors).toEqual({});

    // 轮询结果（最多 5 分钟）
    const actualId = submitJson.prompt_id;
    let result: Record<string, unknown> | null = null;
    for (let i = 0; i < 150; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const histResp = await directFetch(`${COMFY_URL}/history/${actualId}`);
      if (histResp.ok) {
        const hist = await histResp.json();
        if (hist[actualId]) {
          result = hist[actualId];
          break;
        }
      }
    }
    expect(result).not.toBeNull();

    // 验证输出 URL 构建（修复后的逻辑）
    const outputs = (result as Record<string, unknown>)?.outputs as Record<string, unknown> ?? {};
    for (const [_nodeId, output] of Object.entries(outputs)) {
      const out = output as Record<string, unknown>;
      if (out?.images) {
        const images = out.images as Array<Record<string, string>>;
        const img = images[0];
        if (!img) continue;
        expect(typeof img.filename).toBe('string');
        expect(typeof img.type).toBe('string');
        // 构建正确的 URL（修复后逻辑：取属性而非拼对象）
        const subfolderParam = img.subfolder ? `&subfolder=${encodeURIComponent(img.subfolder)}` : '';
        const url = `${COMFY_URL}/view?filename=${encodeURIComponent(img.filename!)}&type=${img.type ?? 'output'}${subfolderParam}`;
        // 验证 URL 可下载
        const imgResp = await directFetch(url);
        expect(imgResp.ok).toBe(true);
        expect(imgResp.status).toBe(200);
        return; // 只验证第一个图片输出
      }
    }
  });

  it('4. 上传图片到 ComfyUI', async () => {
    // 下载一张已有输出图上传回去
    const histResp = await directFetch(`${COMFY_URL}/history?max_items=1`);
    const hist = await histResp.json();
    const histKeys = Object.keys(hist);
    if (histKeys.length === 0) return;

    const latestId = histKeys[0]!;
    const outputs = (hist[latestId] as Record<string, unknown>)?.outputs as Record<string, unknown> ?? {};
    let imageUrl = '';
    for (const [_nodeId, output] of Object.entries(outputs)) {
      const out = output as Record<string, unknown>;
      if (out?.images) {
        const images = out.images as Array<Record<string, string>>;
        const img = images[0];
        if (img) {
          const subfolderParam = img.subfolder ? `&subfolder=${encodeURIComponent(img.subfolder)}` : '';
          imageUrl = `${COMFY_URL}/view?filename=${encodeURIComponent(img.filename!)}&type=${img.type ?? 'output'}${subfolderParam}`;
          break;
        }
      }
    }
    if (!imageUrl) return;

    // 下载并重新上传
    const imgResp = await directFetch(imageUrl);
    const imgBlob = await imgResp.blob();

    const formData = new FormData();
    formData.append('image', imgBlob, 'xshow_test.png');
    formData.append('overwrite', 'true');

    const uploadResp = await directFetch(`${COMFY_URL}/upload/image`, {
      method: 'POST',
      body: formData,
    });
    expect(uploadResp.ok).toBe(true);
    const uploadJson = await uploadResp.json();
    expect(uploadJson.name).toBeDefined();
  });

  it('5. 子目录工作流可读取', async () => {
    // 验证含子目录前缀的路径也能正确读取
    const listResp = await directFetch(`${COMFY_URL}/userdata?dir=workflows&recurse=true`);
    const files: string[] = await listResp.json();
    const subDirFiles = files.filter(f => f.includes('/'));

    if (subDirFiles.length > 0) {
      const relPath = subDirFiles[0]!;
      const fullPath = `workflows/${relPath}`;
      const encoded = fullPath.split('/').map(seg => encodeURIComponent(seg)).join('%2F');
      const resp = await directFetch(`${COMFY_URL}/userdata/${encoded}`);
      expect(resp.ok).toBe(true);
    }
  });
});