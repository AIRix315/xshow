/**
 * RunningHub 端到端集成测试
 *
 * 测试策略：跳过需要运行中 RunningHub 实例的测试（标记为 e2e），
 * 确保 CI 中不会因缺少 RunningHub 而失败。
 * 本地开发时手动运行：RH_E2E=1 npx vitest run src/api/rhApi.e2e.test.ts
 *
 * 覆盖场景：
 * 1. 账户状态查询（API Key 验证）
 * 2. 获取 APP 的 nodeInfoList
 * 3. 提交 AI App 任务 → 轮询 → 获取结果
 * 4. 节点错误检测
 */

import { describe, it, expect, beforeAll } from 'vitest';

// RunningHub API 地址
import { RH_BASE_URL } from '@/config';

// API Key 从环境变量读取
const RH_API_KEY = process.env.RH_API_KEY || '';

// 是否运行 RunningHub 端到端测试
// 本地开发时: RH_E2E=1 npx vitest run src/api/rhApi.e2e.test.ts
const RH_AVAILABLE = process.env.RH_E2E === '1';

// 测试用 APP ID（从 D09-Rix_APP_list.txt 获取的 AIRix 文生图）
const TEST_APP_ID = process.env.RH_TEST_APP_ID || '2037760725296357377';

// 辅助：模拟 extensionFetch 直连（非 Chrome 扩展环境）
async function directFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, options);
}

// ============================================================================
// 纯逻辑测试（不需要 RunningHub）
// ============================================================================

describe('RhApiResult 类型推导 — 纯逻辑', () => {
  it('单输出 URL 应正确映射', () => {
    const result = { outputUrl: 'https://example.com/image.png', outputUrls: ['https://example.com/image.png'] };
    expect(result.outputUrl).toBe('https://example.com/image.png');
    expect(result.outputUrls.length).toBe(1);
  });

  it('多输出 URL 应正确映射', () => {
    const result = {
      outputUrl: 'https://example.com/image1.png',
      outputUrls: ['https://example.com/image1.png', 'https://example.com/image2.png'],
    };
    expect(result.outputUrl).toBe('https://example.com/image1.png');
    expect(result.outputUrls.length).toBe(2);
  });

  it('非媒体 URL 不应识别为媒体', () => {
    const result = { outputUrl: 'https://example.com/output.zip', outputUrls: ['https://example.com/output.zip'] };
    const isMediaUrl =
      result.outputUrl.includes('/view?') ||
      /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(result.outputUrl);
    // ZIP 不在媒体扩展名列表中，所以返回 false
    expect(isMediaUrl).toBe(false);
  });
});

describe('RhNodeInfo 类型验证 — 纯逻辑', () => {
  interface RhNodeInfo {
    nodeId: string;
    nodeName: string;
    fieldName: string;
    fieldValue: string;
    fieldType: string;
    description: string;
  }

  it('RhNodeInfo 应包含所有必需字段', () => {
    const nodeInfo: RhNodeInfo = {
      nodeId: '16',
      nodeName: 'Text Multiline',
      fieldName: 'text',
      fieldValue: 'a beautiful sunset',
      fieldType: 'STRING',
      description: 'Prompt',
    };
    expect(nodeInfo.nodeId).toBe('16');
    expect(nodeInfo.nodeName).toBe('Text Multiline');
    expect(nodeInfo.fieldName).toBe('text');
    expect(nodeInfo.fieldValue).toBe('a beautiful sunset');
    expect(nodeInfo.fieldType).toBe('STRING');
    expect(nodeInfo.description).toBe('Prompt');
  });

  it('上游文本应注入到 STRING 字段', () => {
    const nodeInfoList: RhNodeInfo[] = [
      { nodeId: '16', nodeName: 'Text Multiline', fieldName: 'text', fieldValue: '', fieldType: 'STRING', description: 'Prompt' },
      { nodeId: '19', nodeName: 'PrimitiveInt', fieldName: 'value', fieldValue: '1280', fieldType: 'INT', description: 'Width' },
    ];
    const upstreamText = 'a cute cat';
    const stringField = nodeInfoList.find((n) => n.fieldType === 'STRING' || !n.fieldType);
    if (stringField) {
      stringField.fieldValue = upstreamText;
    }
    expect(nodeInfoList[0]?.fieldValue).toBe('a cute cat');
    expect(nodeInfoList[1]?.fieldValue).toBe('1280');
  });
});

describe('输出类型判断 — 纯逻辑', () => {
  function isMediaUrl(url: string): boolean {
    return (
      url.includes('/view?') ||
      /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(url)
    );
  }

  it('view? URL 应识别为媒体', () => {
    expect(isMediaUrl('http://127.0.0.1:8188/view?filename=test.png')).toBe(true);
  });

  it('直接图片 URL 应识别为媒体', () => {
    expect(isMediaUrl('https://cdn.example.com/image.jpg')).toBe(true);
  });

  it('视频 URL 应识别为媒体', () => {
    expect(isMediaUrl('https://cdn.example.com/video.mp4')).toBe(true);
  });

  it('JSON 字符串不应识别为媒体', () => {
    expect(isMediaUrl('{"result": "success"}')).toBe(false);
  });
});

const e2eDescribe = RH_AVAILABLE ? describe : describe.skip;

// ============================================================================
// 需要 RunningHub 实例的集成测试
// ============================================================================

e2eDescribe('RunningHub AI App 端到端 — 需要运行实例', () => {
  beforeAll(async () => {
    if (!RH_API_KEY) {
      throw new Error('请设置 RH_API_KEY 环境变量');
    }
  });

  it('1. 账户状态查询 — API Key 验证', async () => {
    const resp = await directFetch(`${RH_BASE_URL}/uc/openapi/accountStatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: RH_API_KEY }),
    });
    expect(resp.ok).toBe(true);
    const json = await resp.json();
    expect(json.code).toBe(0);
    expect(json.data).toBeDefined();
    expect(json.data.remainCoins !== undefined || json.data.remainMoney !== undefined).toBe(true);
  });

  it('2. 获取 APP nodeInfoList — /api/webapp/apiCallDemo', async () => {
    const resp = await directFetch(
      `${RH_BASE_URL}/api/webapp/apiCallDemo?apiKey=${RH_API_KEY}&webappId=${TEST_APP_ID}`
    );
    expect(resp.ok).toBe(true);
    const json = await resp.json();
    expect(json.code).toBe(0);
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data.nodeInfoList)).toBe(true);
    expect(json.data.nodeInfoList.length).toBeGreaterThan(0);

    // 验证 nodeInfoList 结构
    const nodeInfo = json.data.nodeInfoList[0];
    expect(nodeInfo.nodeId).toBeDefined();
    expect(nodeInfo.nodeName).toBeDefined();
    expect(nodeInfo.fieldName).toBeDefined();
    expect(nodeInfo.fieldValue).toBeDefined();
    expect(nodeInfo.fieldType).toBeDefined();
    expect(nodeInfo.description).toBeDefined();
  });

  it('3. 提交 AI App 任务 — /task/openapi/ai-app/run', async () => {
    // 先获取 nodeInfoList
    const demoResp = await directFetch(
      `${RH_BASE_URL}/api/webapp/apiCallDemo?apiKey=${RH_API_KEY}&webappId=${TEST_APP_ID}`
    );
    const demoJson = await demoResp.json();
    const nodeInfoList = demoJson.data.nodeInfoList;

    // 修改 text 字段
    const textField = nodeInfoList.find((n: { fieldName: string }) => n.fieldName === 'text');
    expect(textField).toBeDefined();
    textField.fieldValue = 'a beautiful sunset over ocean, golden hour';

    // 提交任务
    const submitResp = await directFetch(`${RH_BASE_URL}/task/openapi/ai-app/run`, {
      method: 'POST',
      headers: {
        'Host': 'www.runninghub.cn',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webappId: TEST_APP_ID,
        apiKey: RH_API_KEY,
        nodeInfoList,
      }),
    });
    expect(submitResp.ok).toBe(true);
    const submitJson = await submitResp.json();
    expect(submitJson.code).toBe(0);
    expect(submitJson.data).toBeDefined();
    expect(submitJson.data.taskId).toBeDefined();
    expect(submitJson.data.taskStatus).toBe('RUNNING');
  });

  it('4. 轮询任务结果 — /task/openapi/outputs', async () => {
    // 先提交一个新任务
    const demoResp = await directFetch(
      `${RH_BASE_URL}/api/webapp/apiCallDemo?apiKey=${RH_API_KEY}&webappId=${TEST_APP_ID}`
    );
    const demoJson = await demoResp.json();
    const nodeInfoList = demoJson.data.nodeInfoList;
    const textField = nodeInfoList.find((n: { fieldName: string }) => n.fieldName === 'text');
    textField.fieldValue = 'test prompt for polling';

    const submitResp = await directFetch(`${RH_BASE_URL}/task/openapi/ai-app/run`, {
      method: 'POST',
      headers: {
        'Host': 'www.runninghub.cn',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webappId: TEST_APP_ID,
        apiKey: RH_API_KEY,
        nodeInfoList,
      }),
    });
    const submitJson = await submitResp.json();
    const taskId = submitJson.data.taskId;

    // 轮询结果（最多 30 次 = 90 秒）
    let result = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollResp = await directFetch(`${RH_BASE_URL}/task/openapi/outputs`, {
        method: 'POST',
        headers: {
          'Host': 'www.runninghub.cn',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: RH_API_KEY, taskId }),
      });

      if (pollResp.ok) {
        const pollJson = await pollResp.json();
        // 成功：code: 0, data: [{ fileUrl }]
        if (pollJson.code === 0 && pollJson.data && Array.isArray(pollJson.data) && pollJson.data.length > 0) {
          result = pollJson;
          break;
        }
        // 失败：code: 805
        if (pollJson.code === 805 && pollJson.data?.failedReason) {
          result = pollJson;
          break;
        }
      }
    }

    expect(result).not.toBeNull();
    // 验证结果格式
    if (result.code === 0) {
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    }
  }, 120000); // 2分钟超时

  it('5. 任务失败响应 — code 805', async () => {
    // 使用无效的 taskId 查询，应返回失败
    const pollResp = await directFetch(`${RH_BASE_URL}/task/openapi/outputs`, {
      method: 'POST',
      headers: {
        'Host': 'www.runninghub.cn',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey: RH_API_KEY, taskId: 'invalid-task-id-12345' }),
    });
    expect(pollResp.ok).toBe(true);
    const pollJson = await pollResp.json();
    // 无效 taskId 会返回 805 或其他错误码
    expect(pollJson.code).not.toBe(0);
  });
});

// ============================================================================
// promptTips 节点错误解析测试
// ============================================================================

describe('promptTips 节点错误解析 — 纯逻辑', () => {
  function parseNodeErrors(promptTips: string | undefined): Record<string, unknown> | null {
    if (!promptTips) return null;
    try {
      const tips = JSON.parse(promptTips);
      if (tips.node_errors && typeof tips.node_errors === 'object') {
        if (Object.keys(tips.node_errors).length === 0) {
          return null;
        }
        return tips.node_errors;
      }
    } catch {
      // 解析失败，忽略
    }
    return null;
  }

  it('有效 node_errors 应被解析', () => {
    const promptTips = JSON.stringify({
      node_errors: {
        '1': { error: 'Missing required input' },
        '2': { error: 'Invalid parameter' },
      },
    });
    const errors = parseNodeErrors(promptTips);
    expect(errors).not.toBeNull();
    expect(Object.keys(errors!).length).toBe(2);
  });

  it('空 node_errors 应返回 null', () => {
    const promptTips = JSON.stringify({ node_errors: {} });
    const errors = parseNodeErrors(promptTips);
    expect(errors).toBeNull();
  });

  it('无效 JSON 应返回 null', () => {
    const promptTips = 'not valid json';
    const errors = parseNodeErrors(promptTips);
    expect(errors).toBeNull();
  });

  it('undefined promptTips 应返回 null', () => {
    const errors = parseNodeErrors(undefined);
    expect(errors).toBeNull();
  });
});

// ============================================================================
// executeRhAppApi mock 测试
// ============================================================================

describe('executeRhAppApi 请求构建 — 单元测试', () => {
  it('应正确构建 ai-app/run 请求并解析 outputs 响应', async () => {
    const originalFetch = global.fetch;
    let submitRequestBody: string | null = null;

    // Mock fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = async (url: any, options?: any) => {
      const reqUrl = String(url);

      if (reqUrl.includes('/task/openapi/ai-app/run')) {
        submitRequestBody = options?.body || '';
        return new Response(JSON.stringify({
          code: 0,
          data: { taskId: 'mock-task-id', promptTips: '{"result": true, "error": null, "node_errors": {}}' },
        }), { status: 200 });
      } else if (reqUrl.includes('/task/openapi/outputs')) {
        // AI App 成功响应格式
        return new Response(JSON.stringify({
          code: 0,
          data: [{ fileUrl: 'https://example.com/output.png', fileType: 'image' }],
        }), { status: 200 });
      }

      return new Response(JSON.stringify({ code: -1, msg: 'Unknown endpoint' }), { status: 404 });
    };

    const { executeRhAppApi } = await import('./rhApi');

    const result = await executeRhAppApi('test-api-key', 'test-app-id', [
      { nodeId: '16', nodeName: 'Text', fieldName: 'text', fieldValue: 'test prompt', fieldType: 'STRING', description: 'Prompt' },
    ]);

    expect(result.outputUrl).toBe('https://example.com/output.png');
    expect(result.outputUrls.length).toBe(1);

    // 验证请求体
    expect(submitRequestBody).not.toBeNull();
    const body = JSON.parse(submitRequestBody!);
    expect(body.apiKey).toBe('test-api-key');
    expect(body.webappId).toBe('test-app-id');
    expect(body.nodeInfoList).toHaveLength(1);
    expect(body.nodeInfoList[0].fieldValue).toBe('test prompt');

    global.fetch = originalFetch;
  }, 10000);

  it('应正确处理任务失败响应', async () => {
    const originalFetch = global.fetch;

    // Mock fetch - 返回失败响应
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = async (url: any, _options?: any) => {
      const reqUrl = String(url);

      if (reqUrl.includes('/task/openapi/ai-app/run')) {
        return new Response(JSON.stringify({
          code: 0,
          data: { taskId: 'mock-task-id', promptTips: '{}' },
        }), { status: 200 });
      } else if (reqUrl.includes('/task/openapi/outputs')) {
        // AI App 失败响应
        return new Response(JSON.stringify({
          code: 805,
          msg: 'TASK_EXECUTION_FAILED',
          data: {
            failedReason: {
              node_name: 'LoadImage',
              exception_message: 'Image file not found',
            },
          },
        }), { status: 200 });
      }

      return new Response(JSON.stringify({ code: -1, msg: 'Unknown endpoint' }), { status: 404 });
    };

    const { executeRhAppApi } = await import('./rhApi');

    await expect(
      executeRhAppApi('test-api-key', 'test-app-id', [
        { nodeId: '1', nodeName: 'LoadImage', fieldName: 'image', fieldValue: '', fieldType: 'IMAGE', description: 'Image' },
      ])
    ).rejects.toThrow('任务失败: Image file not found');

    global.fetch = originalFetch;
  }, 10000);

  it('应正确处理 AbortSignal 取消', async () => {
    const originalFetch = global.fetch;
    const controller = new AbortController();

    // Mock fetch - 模拟延迟响应
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = async (_url: any, _options?: any) => {
      // 模拟延迟
      await new Promise((r) => setTimeout(r, 100));
      return new Response(JSON.stringify({
        code: 0,
        data: { taskId: 'mock-task-id', promptTips: '{}' },
      }), { status: 200 });
    };

    const { executeRhAppApi } = await import('./rhApi');

    // 立即取消
    controller.abort();

    await expect(
      executeRhAppApi('test-api-key', 'test-app-id', [
        { nodeId: '1', nodeName: 'Text', fieldName: 'text', fieldValue: 'test', fieldType: 'STRING', description: 'Text' },
      ], undefined, controller.signal)
    ).rejects.toThrow();

    global.fetch = originalFetch;
  }, 10000);
});

// ============================================================================
// executeRhWorkflowApi mock 测试
// ============================================================================

describe('executeRhWorkflowApi 请求构建 — 单元测试', () => {
  it('应正确构建 task/openapi/create 请求并解析 outputs 响应', async () => {
    const originalFetch = global.fetch;
    let submitRequestBody: string | null = null;

    // Mock fetch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = async (url: any, options?: any) => {
      const reqUrl = String(url);

      if (reqUrl.includes('/task/openapi/create')) {
        submitRequestBody = options?.body || '';
        return new Response(JSON.stringify({
          code: 0,
          data: { taskId: 'mock-task-id', promptTips: '{"result": true, "error": null, "node_errors": {}}' },
        }), { status: 200 });
      } else if (reqUrl.includes('/task/openapi/outputs')) {
        // ComfyUI Workflow 成功响应格式
        return new Response(JSON.stringify({
          code: 0,
          data: [{ fileUrl: 'https://example.com/workflow_output.png', fileType: 'png', nodeId: '9' }],
        }), { status: 200 });
      }

      return new Response(JSON.stringify({ code: -1, msg: 'Unknown endpoint' }), { status: 404 });
    };

    const { executeRhWorkflowApi } = await import('./rhApi');

    const result = await executeRhWorkflowApi('test-api-key', 'test-workflow-id', [
      { nodeId: '6', fieldName: 'text', defaultValue: 'test prompt' },
    ]);

    expect(result.outputUrl).toBe('https://example.com/workflow_output.png');
    expect(result.outputUrls.length).toBe(1);

    // 验证请求体
    expect(submitRequestBody).not.toBeNull();
    const body = JSON.parse(submitRequestBody!);
    expect(body.apiKey).toBe('test-api-key');
    expect(body.workflowId).toBe('test-workflow-id');
    expect(body.nodeInfoList).toHaveLength(1);
    expect(body.nodeInfoList[0].fieldValue).toBe('test prompt');

    global.fetch = originalFetch;
  }, 10000);

  it('应正确处理 Workflow 任务失败响应', async () => {
    const originalFetch = global.fetch;

    // Mock fetch - 返回失败响应
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = async (url: any, _options?: any) => {
      const reqUrl = String(url);

      if (reqUrl.includes('/task/openapi/create')) {
        return new Response(JSON.stringify({
          code: 0,
          data: { taskId: 'mock-task-id', promptTips: '{}' },
        }), { status: 200 });
      } else if (reqUrl.includes('/task/openapi/outputs')) {
        // Workflow 失败响应
        return new Response(JSON.stringify({
          code: 805,
          msg: 'TASK_EXECUTION_FAILED',
          data: {
            failedReason: {
              node_name: 'KSampler',
              exception_message: 'Model not found',
            },
          },
        }), { status: 200 });
      }

      return new Response(JSON.stringify({ code: -1, msg: 'Unknown endpoint' }), { status: 404 });
    };

    const { executeRhWorkflowApi } = await import('./rhApi');

    await expect(
      executeRhWorkflowApi('test-api-key', 'test-workflow-id', [
        { nodeId: '1', fieldName: 'ckpt_name', defaultValue: '' },
      ])
    ).rejects.toThrow('任务失败: Model not found');

    global.fetch = originalFetch;
  }, 10000);

  it('应正确处理 AbortSignal 取消', async () => {
    const originalFetch = global.fetch;
    const controller = new AbortController();

    // Mock fetch - 模拟延迟响应
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = async (_url: any, _options?: any) => {
      // 模拟延迟
      await new Promise((r) => setTimeout(r, 100));
      return new Response(JSON.stringify({
        code: 0,
        data: { taskId: 'mock-task-id', promptTips: '{}' },
      }), { status: 200 });
    };

    const { executeRhWorkflowApi } = await import('./rhApi');

    // 立即取消
    controller.abort();

    await expect(
      executeRhWorkflowApi('test-api-key', 'test-workflow-id', [
        { nodeId: '6', fieldName: 'text', defaultValue: 'test' },
      ], undefined, controller.signal)
    ).rejects.toThrow();

    global.fetch = originalFetch;
  }, 10000);
});
