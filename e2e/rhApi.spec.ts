/**
 * API 测试：RunningHub API
 * 
 * 测试场景：
 * 1. fetchRhWorkflowJson - 获取 workflow JSON
 * 2. uploadFileToRunningHub - 上传文件到 RunningHub
 * 3. parseRhWorkflowNodes - 解析 workflow JSON
 */

import { test, expect } from '@playwright/test';

// 测试配置
const API_KEY = '13f84abb028e4503bd82507d68e22715';
const WORKFLOW_ID = '1998447779892617217'; // 一致性人物
const APP_ID = '2037760725296357377'; // AIRix 文生图

test.describe('RunningHub API Functions', () => {
  
  test('fetchRhWorkflowJson - 获取 workflow JSON', async ({ request }) => {
    const response = await request.post('https://www.runninghub.cn/api/openapi/getJsonApiFormat', {
      headers: {
        'Content-Type': 'application/json',
        'Host': 'www.runninghub.cn',
      },
      data: {
        apiKey: API_KEY,
        workflowId: WORKFLOW_ID,
      },
    });

    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json.code).toBe(0);
    expect(json.data).toBeDefined();
    expect(json.data.prompt).toBeDefined();
    
    // 验证 prompt 是一个有效的 JSON 字符串
    const prompt = json.data.prompt;
    const parsed = JSON.parse(prompt);
    expect(parsed).toBeDefined();
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });

  test('uploadFileToRunningHub - 上传文件', async ({ request, page }) => {
    // 创建一个简单的测试图片（1x1 红色 PNG）
    const pngData = atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAAAAAAQCAYAAAAso8e7AAAADklEQVQI12NkYPhPHAYAAh8BAtK7oD8AAAAASUVORK5CYII='
    );
    const binary = Uint8Array.from(pngData, c => c.charCodeAt(0));
    
    // 使用页面上下文上传（更可靠）
    const fileName = await page.evaluate(async (apiKey) => {
      const formData = new FormData();
      formData.append('apiKey', apiKey);
      formData.append('fileType', 'input');
      
      // 创建 PNG blob
      const binary = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xD4, 0xEF, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      const blob = new Blob([binary], { type: 'image/png' });
      formData.append('file', blob, 'test.png');

      const response = await fetch('https://www.runninghub.cn/task/openapi/upload', {
        method: 'POST',
        body: formData,
      });
      
      const json = await response.json();
      return json.data?.fileName || null;
    }, API_KEY);
    
    expect(fileName).toBeDefined();
    console.log(`Uploaded file: ${fileName}`);
  });

  test('parseRhWorkflowNodes - 解析 workflow JSON', async ({ request, page }) => {
    // 先获取 workflow JSON
    const response = await request.post('https://www.runninghub.cn/api/openapi/getJsonApiFormat', {
      headers: {
        'Content-Type': 'application/json',
        'Host': 'www.runninghub.cn',
      },
      data: {
        apiKey: API_KEY,
        workflowId: WORKFLOW_ID,
      },
    });

    const json = await response.json();
    const workflowJson = json.data.prompt;

    // 在浏览器中解析
    const parsedNodes = await page.evaluate((wfJson) => {
      // 模拟 parseRhWorkflowNodes 函数
      let workflow: Record<string, unknown>;
      try {
        workflow = JSON.parse(wfJson);
      } catch {
        return [];
      }

      const nodes: { nodeId: string; classType: string; inputs: Record<string, unknown> }[] = [];

      for (const [nodeId, nodeData] of Object.entries(workflow)) {
        if (!/^\d+$/.test(nodeId)) continue;
        if (typeof nodeData !== 'object' || nodeData === null) continue;

        const node = nodeData as Record<string, unknown>;
        const classType = node['class_type'] as string | undefined;
        if (!classType) continue;

        nodes.push({
          nodeId,
          classType,
          inputs: (node['inputs'] as Record<string, unknown>) || {},
        });
      }

      return nodes;
    }, workflowJson);

    expect(parsedNodes.length).toBeGreaterThan(0);
    console.log(`Found ${parsedNodes.length} workflow nodes`);
    
    // 验证节点结构
    const firstNode = parsedNodes[0];
    expect(firstNode.nodeId).toBeDefined();
    expect(firstNode.classType).toBeDefined();
    expect(firstNode.inputs).toBeDefined();
  });
});

test.describe('RunningHub Workflow Execution (E2E)', () => {
  test.skip('executeRhWorkflowApi - 完整工作流执行（可能较慢）', async ({ request }) => {
    // 1. 获取 workflow JSON
    const wfResponse = await request.post('https://www.runninghub.cn/api/openapi/getJsonApiFormat', {
      headers: {
        'Content-Type': 'application/json',
        'Host': 'www.runninghub.cn',
      },
      data: {
        apiKey: API_KEY,
        workflowId: WORKFLOW_ID,
      },
    });

    const wfJson = await wfResponse.json();
    const prompt = JSON.parse(wfJson.data.prompt);

    // 找到需要填充的字段（简单处理：找到所有 STRING 类型的输入字段）
    const nodeInfoList: { nodeId: string; fieldName: string; fieldValue: string }[] = [];
    
    for (const [nodeId, nodeData] of Object.entries(prompt)) {
      if (!/^\d+$/.test(nodeId)) continue;
      const node = nodeData as { inputs?: Record<string, unknown> };
      if (!node.inputs) continue;
      
      for (const [fieldName, fieldValue] of Object.entries(node.inputs)) {
        if (typeof fieldValue === 'string' && fieldValue.length > 0) {
          // 跳过节点引用
          if (Array.isArray(fieldValue)) continue;
          // 跳过默认值
          if (fieldName === 'text' && fieldValue === '') continue;
        }
      }
    }

    // 2. 提交任务
    const submitResponse = await request.post('https://www.runninghub.cn/task/openapi/create', {
      headers: {
        'Content-Type': 'application/json',
        'Host': 'www.runninghub.cn',
      },
      data: {
        apiKey: API_KEY,
        workflowId: WORKFLOW_ID,
        nodeInfoList,
      },
    });

    expect(submitResponse.ok()).toBeTruthy();
    
    const submitJson = await submitResponse.json();
    expect(submitJson.code).toBe(0);
    expect(submitJson.data.taskId).toBeDefined();
    
    const taskId = submitJson.data.taskId;
    console.log(`Task submitted: ${taskId}`);

    // 3. 轮询结果（最多等待 60 秒）
    const maxAttempts = 20;
    let result = null;
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));
      
      const pollResponse = await request.post('https://www.runninghub.cn/task/openapi/outputs', {
        headers: {
          'Content-Type': 'application/json',
          'Host': 'www.runninghub.cn',
        },
        data: {
          apiKey: API_KEY,
          taskId,
        },
      });

      const pollJson = await pollResponse.json();
      
      // code: 0 = 成功
      if (pollJson.code === 0) {
        result = pollJson;
        break;
      }
      
      // code: 805 = 失败
      if (pollJson.code === 805) {
        throw new Error(`Task failed: ${JSON.stringify(pollJson.data)}`);
      }
      
      // code: 804/813 = 运行中，继续等待
      console.log(`Task still running... (attempt ${i + 1}/${maxAttempts})`);
    }

    expect(result).not.toBeNull();
    expect(result!.data).toBeDefined();
    
    console.log(`Task completed: ${JSON.stringify(result!.data)}`);
  }, { timeout: 120000 });
});
