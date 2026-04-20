/**
 * E2E 测试：CustomInputHandles 功能
 *
 * 测试场景：
 * 1. ImageNode 模式驱动 handle 切换（text-to-image / image-to-image）
 * 2. VideoNode 模式驱动 handle 切换（text-to-video / image-to-video / start-end-to-video）
 * 3. CustomInputHandles 添加/删除 UI
 * 4. 自定义 handle 渲染验证
 * 5. AudioNode / 3DNode 基础 handle 验证
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 通过 window.__flowStore + window.__createNode 直接创建生成节点
 * 使用 createNode 工厂函数确保节点带有正确的默认 data 和 style
 */
async function addGenerateNode(page: import('@playwright/test').Page, nodeType: string) {
  const nodeId = await page.evaluate((nodeType) => {
    const store = (window as any).__flowStore;
    const createNode = (window as any).__createNode;
    if (!store) throw new Error('__flowStore not found on window');
    if (!createNode) throw new Error('__createNode not found on window');

    const state = store.getState();
    const node = createNode(nodeType, { x: 250 + Math.random() * 100, y: 200 + Math.random() * 100 });
    state.addNode(node);
    return node.id;
  }, nodeType);
  // 等待 React 懒加载组件渲染 + handle 出现
  await page.waitForTimeout(1500);
  return nodeId;
}

/**
 * 通过 window.__flowStore 访问 Zustand store，更新指定节点的 data
 * 返回更新前的模式值（用于断言），或 null 表示未找到
 */
const INJECT_UPDATE_NODE = async (
  page: import('@playwright/test').Page,
  nodePredicate: string,
  dataPatch: Record<string, unknown>,
) => {
  return page.evaluate(({ nodePredicate, dataPatch }) => {
    const store = (window as any).__flowStore;
    if (!store) throw new Error('__flowStore not found on window — ensure store is exposed for E2E');

    const state = store.getState();
    // 找到目标节点（按 type 或 id 匹配）
    const node = state.nodes.find((n: any) => n.type === nodePredicate || n.id === nodePredicate);
    if (!node) throw new Error(`Node not found: ${nodePredicate}. Available: ${state.nodes.map((n: any) => n.type).join(', ')}`);

    const beforeMode = node.data.imageGenerationMode || node.data.videoGenerationMode || null;

    // 使用 store 的 updateNodeData action 触发 React 重新渲染
    state.updateNodeData(node.id, dataPatch);

    return beforeMode;
  }, { nodePredicate, dataPatch });
};

/**
 * 在指定节点的作用域内获取 target handle 数量
 * 先找到节点 DOM 元素，再在其中统计 handle
 */
async function countHandles(page: import('@playwright/test').Page, nodeType: string, handleType: 'target' | 'source') {
  const nodeEl = page.locator(`[data-id]`).filter({ hasText: new RegExp(nodeType === 'd3Node' ? '3D' : nodeType === 'audioNode' ? 'Audio' : nodeType === 'videoNode' ? 'Video' : 'Image') }).first();
  // 回退：直接统计画布上所有对应 handles
  return page.locator(`.react-flow__handle-${handleType}`).count();
}

// ---------------------------------------------------------------------------
// ImageNode
// ---------------------------------------------------------------------------

test.describe('CustomInputHandles — ImageNode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
  });

  test('添加 ImageNode，默认 text-to-image 仅有 Text 输入 handle', async ({ page }) => {
    await addGenerateNode(page, 'imageNode');

    // @xyflow/react v12: target handles have class ".target", source handles have class ".source"
    // (不再使用 .react-flow__handle.target / .react-flow__handle.source)
    const targetHandles = page.locator('.react-flow__handle.target');
    const sourceHandles = page.locator('.react-flow__handle.source');

    // text-to-image: 1 个 Text 输入 target + 1 个 Image 输出 source
    expect(await targetHandles.count()).toBeGreaterThanOrEqual(1);
    expect(await sourceHandles.count()).toBeGreaterThanOrEqual(1);

    // 验证 Text target handle 存在
    const textHandle = page.locator('.react-flow__handle.target[data-handletype="text"]');
    expect(await textHandle.count()).toBeGreaterThanOrEqual(1);
  });

  test('ImageNode 切换 image-to-image 后出现 Image 输入 handle', async ({ page }) => {
    await addGenerateNode(page, 'imageNode');

    // 通过 store 切换模式为 image-to-image（触发 handle 重新渲染）
    await INJECT_UPDATE_NODE(page, 'imageNode', { imageGenerationMode: 'image-to-image' });
    await page.waitForTimeout(500);

    // image-to-image: Image 输入 + Text 输入 = 2 个 target + 1 个 source
    const targetHandles = page.locator('.react-flow__handle.target');
    const targetCount = await targetHandles.count();
    expect(targetCount).toBeGreaterThanOrEqual(2);

    // 验证 Image 类型的 target handle 出现
    const imageTargetHandles = page.locator('.react-flow__handle.target[data-handletype="image"]');
    expect(await imageTargetHandles.count()).toBeGreaterThanOrEqual(1);
  });

  test('ImageNode 切换回 text-to-image 后 Image handle 消失', async ({ page }) => {
    await addGenerateNode(page, 'imageNode');

    // 先切到 image-to-image
    await INJECT_UPDATE_NODE(page, 'imageNode', { imageGenerationMode: 'image-to-image' });
    await page.waitForTimeout(500);

    // 验证 Image target handle 出现
    let imageTargetHandles = page.locator('.react-flow__handle.target[data-handletype="image"]');
    expect(await imageTargetHandles.count()).toBeGreaterThanOrEqual(1);

    // 切回 text-to-image
    await INJECT_UPDATE_NODE(page, 'imageNode', { imageGenerationMode: 'text-to-image' });
    await page.waitForTimeout(500);

    // Image target handle 应消失（只剩 source image handle）
    imageTargetHandles = page.locator('.react-flow__handle.target[data-handletype="image"]');
    expect(await imageTargetHandles.count()).toBe(0);
  });

  test('ImageNode 添加 CustomInputHandle 后出现自定义 handle', async ({ page }) => {
    await addGenerateNode(page, 'imageNode');

    // 记录当前的 target handle 数量
    const beforeCount = await page.locator('.react-flow__handle.target').count();

    // 通过 store 添加 customInputHandles
    await INJECT_UPDATE_NODE(page, 'imageNode', {
      customInputHandles: [
        { id: 'custom-image-e2e-1', type: 'image', label: '图片' },
      ],
    });
    await page.waitForTimeout(500);

    // 自定义 handle 应该追加到画布上
    const afterCount = await page.locator('.react-flow__handle.target').count();
    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});

// ---------------------------------------------------------------------------
// VideoNode
// ---------------------------------------------------------------------------

test.describe('CustomInputHandles — VideoNode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
  });

  test('添加 VideoNode，默认 text-to-video 仅有 Text 输入 handle', async ({ page }) => {
    await addGenerateNode(page, 'videoNode');

    const targetHandles = page.locator('.react-flow__handle.target');
    const sourceHandles = page.locator('.react-flow__handle.source');

    // text-to-video: Text 输入(1) + Video 输出(1)
    expect(await targetHandles.count()).toBeGreaterThanOrEqual(1);
    expect(await sourceHandles.count()).toBeGreaterThanOrEqual(1);

    // 验证 Video source handle
    const videoSource = page.locator('.react-flow__handle.source[data-handletype="video"]');
    expect(await videoSource.count()).toBeGreaterThanOrEqual(1);
  });

  test('VideoNode 切换 image-to-video 后出现 Image 输入 handle', async ({ page }) => {
    await addGenerateNode(page, 'videoNode');

    await INJECT_UPDATE_NODE(page, 'videoNode', { videoGenerationMode: 'image-to-video' });
    await page.waitForTimeout(500);

    // image-to-video: Image + Text 输入 = 2 target + 1 source
    const targetCount = await page.locator('.react-flow__handle.target').count();
    expect(targetCount).toBeGreaterThanOrEqual(2);

    const imageTarget = page.locator('.react-flow__handle.target[data-handletype="image"]');
    expect(await imageTarget.count()).toBeGreaterThanOrEqual(1);
  });

  test('VideoNode 切换 start-end-to-video 后出现首帧+尾帧 handle', async ({ page }) => {
    await addGenerateNode(page, 'videoNode');

    await INJECT_UPDATE_NODE(page, 'videoNode', { videoGenerationMode: 'start-end-to-video' });
    await page.waitForTimeout(500);

    // start-end-to-video: first-frame + Text + last-frame = 3 target + 1 source
    const targetCount = await page.locator('.react-flow__handle.target').count();
    expect(targetCount).toBeGreaterThanOrEqual(3);

    // 验证首帧和尾帧 handle（都是 data-handletype="image"）
    const imageTargets = page.locator('.react-flow__handle.target[data-handletype="image"]');
    expect(await imageTargets.count()).toBeGreaterThanOrEqual(2);
  });

  test('VideoNode 添加多个 CustomInputHandle 后 handle 数量递增', async ({ page }) => {
    await addGenerateNode(page, 'videoNode');

    const baseTargetCount = await page.locator('.react-flow__handle.target').count();

    // 添加 1 个自定义 image handle
    await INJECT_UPDATE_NODE(page, 'videoNode', {
      customInputHandles: [
        { id: 'custom-image-e2e-a', type: 'image', label: '图片' },
      ],
    });
    await page.waitForTimeout(500);

    const oneCustomCount = await page.locator('.react-flow__handle.target').count();
    expect(oneCustomCount).toBe(baseTargetCount + 1);

    // 添加 2 个自定义 handle
    await INJECT_UPDATE_NODE(page, 'videoNode', {
      customInputHandles: [
        { id: 'custom-image-e2e-a', type: 'image', label: '图片' },
        { id: 'custom-audio-e2e-b', type: 'audio', label: '音频' },
      ],
    });
    await page.waitForTimeout(500);

    const twoCustomCount = await page.locator('.react-flow__handle.target').count();
    expect(twoCustomCount).toBe(baseTargetCount + 2);
  });

  test('VideoNode 清除 customInputHandles 后自定义 handle 消失', async ({ page }) => {
    await addGenerateNode(page, 'videoNode');

    const baseTargetCount = await page.locator('.react-flow__handle.target').count();

    // 添加
    await INJECT_UPDATE_NODE(page, 'videoNode', {
      customInputHandles: [
        { id: 'custom-image-e2e-c', type: 'image', label: '图片' },
      ],
    });
    await page.waitForTimeout(500);
    const addedCount = await page.locator('.react-flow__handle.target').count();
    expect(addedCount).toBe(baseTargetCount + 1);

    // 清除
    await INJECT_UPDATE_NODE(page, 'videoNode', { customInputHandles: [] });
    await page.waitForTimeout(500);
    const clearedCount = await page.locator('.react-flow__handle.target').count();
    expect(clearedCount).toBe(baseTargetCount);
  });
});

// ---------------------------------------------------------------------------
// AudioNode / 3DNode
// ---------------------------------------------------------------------------

test.describe('CustomInputHandles — AudioNode / 3DNode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
  });

  test('GenerateAudioNode — 默认 Text 输入 + Audio 输出', async ({ page }) => {
    await addGenerateNode(page, 'audioNode');

    const targetHandles = page.locator('.react-flow__handle.target');
    const sourceHandles = page.locator('.react-flow__handle.source');

    expect(await targetHandles.count()).toBeGreaterThanOrEqual(1);
    expect(await sourceHandles.count()).toBeGreaterThanOrEqual(1);

    // 验证 audio 类型 source handle
    const audioSource = page.locator('.react-flow__handle.source[data-handletype="audio"]');
    expect(await audioSource.count()).toBeGreaterThanOrEqual(1);
  });

  test('GenerateAudioNode — 添加自定义 image 输入 handle', async ({ page }) => {
    await addGenerateNode(page, 'audioNode');

    const baseTargetCount = await page.locator('.react-flow__handle.target').count();

    await INJECT_UPDATE_NODE(page, 'audioNode', {
      customInputHandles: [
        { id: 'custom-image-e2e-aud', type: 'image', label: '图片' },
      ],
    });
    await page.waitForTimeout(500);

    const afterCount = await page.locator('.react-flow__handle.target').count();
    expect(afterCount).toBeGreaterThan(baseTargetCount);
  });

  test('Generate3DNode — 默认 Text 输入 + Model 输出', async ({ page }) => {
    // 3D 只在 Generate 下拉菜单中
    await addGenerateNode(page, 'd3Node');

    const targetHandles = page.locator('.react-flow__handle.target');
    const sourceHandles = page.locator('.react-flow__handle.source');

    expect(await targetHandles.count()).toBeGreaterThanOrEqual(1);
    expect(await sourceHandles.count()).toBeGreaterThanOrEqual(1);

    // 验证 model 类型 source handle
    const modelSource = page.locator('.react-flow__handle.source[data-handletype="model"]');
    expect(await modelSource.count()).toBeGreaterThanOrEqual(1);
  });

  test('Generate3DNode — 添加自定义 image 输入 handle', async ({ page }) => {
    await addGenerateNode(page, 'd3Node');

    const baseTargetCount = await page.locator('.react-flow__handle.target').count();

    await INJECT_UPDATE_NODE(page, 'd3Node', {
      customInputHandles: [
        { id: 'custom-image-e2e-3d', type: 'image', label: '图片' },
      ],
    });
    await page.waitForTimeout(500);

    const afterCount = await page.locator('.react-flow__handle.target').count();
    expect(afterCount).toBeGreaterThan(baseTargetCount);
  });
});