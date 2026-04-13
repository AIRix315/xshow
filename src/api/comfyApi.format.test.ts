/**
 * ComfyUI 工作流格式测试
 * 对比正确提交和错误提交的数据类型差异
 */

import { describe, it, expect } from 'vitest';

// 模拟一个简单的 ComfyUI 工作流 JSON（文生图）
const sampleWorkflow = {
  "2": {
    "inputs": {
      "text": "a beautiful girl",  // 字符串
      "clip": ["17", 1]             // 节点引用（数组）
    },
    "class_type": "CLIPTextEncode"
  },
  "5": {
    "inputs": {
      "steps": 8,                   // 数值
      "cfg": 1.5,                   // 浮点数
      "sampler_name": "euler",      // 字符串
      "model": ["10", 0],           // 节点引用（数组）
      "positive": ["2", 0],         // 节点引用（数组）
      "negative": ["3", 0]          // 节点引用（数组）
    },
    "class_type": "KSampler"
  },
  "14": {
    "inputs": {
      "width": 1440,               // 数值
      "height": 1920,               // 数值
      "batch_size": 1              // 数值
    },
    "class_type": "EmptyLatentImage"
  },
  "17": {
    "inputs": {
      "ckpt_name": "model.safetensors",  // 字符串
      "clip_skip": -1                     // 数值
    },
    "class_type": "CheckpointLoaderSimple"
  }
};

describe('ComfyUI 工作流格式测试', () => {
  it('节点引用应该是数组，不是字符串', () => {
    // 正确格式：节点引用是数组 ["节点ID", 输出索引]
    expect(sampleWorkflow["2"].inputs.clip).toEqual(["17", 1]);
    expect(Array.isArray(sampleWorkflow["5"].inputs.model)).toBe(true);
    expect(Array.isArray(sampleWorkflow["5"].inputs.positive)).toBe(true);
    
    // 错误格式：如果转成字符串
    const wrongFormat = String(sampleWorkflow["2"].inputs.clip);
    expect(wrongFormat).toBe("17,1");  // 破坏了数组结构！
  });

  it('数值应该是数字类型，不是字符串', () => {
    // 正确格式
    expect(typeof sampleWorkflow["5"].inputs.steps).toBe('number');
    expect(sampleWorkflow["5"].inputs.steps).toBe(8);
    
    // 错误格式：转成字符串
    const wrongFormat = String(sampleWorkflow["5"].inputs.steps);
    expect(typeof wrongFormat).toBe('string');
    expect(wrongFormat).toBe("8");
    
    // 数字和字符串在 JSON 中不同
    expect(JSON.stringify({ steps: 8 })).toBe('{"steps":8}');
    expect(JSON.stringify({ steps: "8" })).toBe('{"steps":"8"}');
  });

  it('JSON.stringify 应该保留原始类型', () => {
    const workflowCopy = JSON.parse(JSON.stringify(sampleWorkflow));
    
    // 验证类型保留
    expect(typeof workflowCopy["5"].inputs.steps).toBe('number');
    expect(Array.isArray(workflowCopy["2"].inputs.clip)).toBe(true);
    expect(typeof workflowCopy["14"].inputs.width).toBe('number');
  });

  it('错误：直接赋值字符串会破坏原始类型', () => {
    const workflowCopy = JSON.parse(JSON.stringify(sampleWorkflow));
    
    // 模拟错误：直接赋值字符串
    workflowCopy["5"].inputs.steps = "8";  // 字符串，应该是数字！
    workflowCopy["2"].inputs.clip = "17,1"; // 字符串，应该是数组！
    
    // 验证类型被破坏
    expect(typeof workflowCopy["5"].inputs.steps).toBe('string');
    expect(Array.isArray(workflowCopy["2"].inputs.clip)).toBe(false);
    
    // JSON 序列化后会丢失类型
    const serialized = JSON.stringify(workflowCopy);
    expect(serialized).toContain('"steps":"8"');  // 字符串，错误！
    expect(serialized).toContain('"clip":"17,1"'); // 字符串，错误！
  });

  it('正确：不替换字段保留原始值', () => {
    const workflowCopy = JSON.parse(JSON.stringify(sampleWorkflow));
    const originalSteps = workflowCopy["5"].inputs.steps;
    const originalClip = workflowCopy["2"].inputs.clip;
    
    // 模拟：如果用户没有修改这些字段，什么都不做
    // 保留原始值
    
    expect(workflowCopy["5"].inputs.steps).toBe(originalSteps);
    expect(workflowCopy["2"].inputs.clip).toBe(originalClip);
    expect(typeof workflowCopy["5"].inputs.steps).toBe('number');
    expect(Array.isArray(workflowCopy["2"].inputs.clip)).toBe(true);
  });

  it('正确：只替换用户修改的文本字段', () => {
    const workflowCopy = JSON.parse(JSON.stringify(sampleWorkflow));
    
    // 模拟：用户修改了提示词
    const newPrompt = "a cat";
    workflowCopy["2"].inputs.text = newPrompt;
    
    // 其他字段保持原样
    expect(workflowCopy["2"].inputs.text).toBe("a cat");
    expect(Array.isArray(workflowCopy["2"].inputs.clip)).toBe(true);
    expect(typeof workflowCopy["5"].inputs.steps).toBe('number');
  });
});

describe('nodeInfoList 处理测试', () => {
  it('问题：String() 会破坏所有类型', () => {
    // 当前 generateNodeInfoList 的实现：
    const nodeValues = {
      "2": {
        "text": "a girl",
        "clip": ["17", 1]  // 数组
      },
      "5": {
        "steps": 8,          // 数字
        "model": ["10", 0]   // 数组
      }
    };
    
    // 模拟当前实现
    const wrongList: Array<{ nodeId: string; fieldName: string; defaultValue: string }> = [];
    for (const [nodeId, fields] of Object.entries(nodeValues)) {
      for (const [fieldName, value] of Object.entries(fields as Record<string, unknown>)) {
        wrongList.push({ nodeId, fieldName, defaultValue: String(value ?? '') });
      }
    }
    
    // 验证：所有值都变成了字符串
    expect(wrongList.find(n => n.fieldName === 'steps')?.defaultValue).toBe('8');
    expect(wrongList.find(n => n.fieldName === 'clip')?.defaultValue).toBe('17,1');
    expect(wrongList.find(n => n.fieldName === 'model')?.defaultValue).toBe('10,0');
  });

  it('修复：只处理用户修改的字符串字段', () => {
    // 工作流原始值
    const workflowCopy = JSON.parse(JSON.stringify(sampleWorkflow));
    
    // 模拟：用户只修改了某些字段，且通过 UI 输入（都是字符串）
    const userModifiedFields = [
      { nodeId: "2", fieldName: "text", value: "a cat" },  // 用户输入
      { nodeId: "5", fieldName: "steps", value: "" },      // 用户没修改，空字符串
      { nodeId: "5", fieldName: "sampler_name", value: "dpmpp_2m" }  // 用户输入
    ];
    
    // 应用替换：
    for (const field of userModifiedFields) {
      const node = workflowCopy[field.nodeId as keyof typeof workflowCopy];
      if (node && typeof node === 'object' && 'inputs' in node) {
        const inputs = node.inputs as Record<string, unknown>;
        // 跳过空值
        if (field.value === '' || field.value === undefined) {
          continue;  // 保留原始值
        }
        // 只替换字符串字段
        inputs[field.fieldName] = field.value;
      }
    }
    
    // 验证：
    // - 用户修改的字段被替换
    expect(workflowCopy["2"].inputs.text).toBe("a cat");
    expect(workflowCopy["5"].inputs.sampler_name).toBe("dpmpp_2m");
    // - 空值字段保留原始值
    expect(workflowCopy["5"].inputs.steps).toBe(8);  // 原始数值！
    // - 节点引用保留原始值
    expect(Array.isArray(workflowCopy["2"].inputs.clip)).toBe(true);
    expect(Array.isArray(workflowCopy["5"].inputs.model)).toBe(true);
  });
});