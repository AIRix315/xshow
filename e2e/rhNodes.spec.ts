/**
 * E2E 测试：RunningHub 节点 (rhAppNode, rhWfNode)
 * 
 * 测试场景：
 * 1. RH 节点在侧边栏中可见
 * 2. 可以添加 rhAppNode 到画布
 * 3. 可以添加 rhWfNode 到画布
 * 4. rhAppNode 配置模式可以正常切换
 * 5. rhWfNode 配置模式可以正常切换
 */

import { test, expect } from '@playwright/test';

test.describe('RunningHub Nodes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
  });

  test('RH nodes appear in the All nodes dropdown', async ({ page }) => {
    // 打开"All nodes"下拉菜单
    const allNodesButton = page.getByRole('button', { name: 'All nodes' });
    await allNodesButton.click();

    // 等待下拉菜单打开
    await page.waitForSelector('text=RH');

    // 验证 RH 分类存在（使用更精确的定位器）
    const rhCategory = page.locator('div:text-is("RH")').first();
    await expect(rhCategory).toBeVisible();

    // 验证 RH APP 节点可见
    const rhAppNodeButton = page.getByRole('button', { name: 'RH APP' });
    await expect(rhAppNodeButton).toBeVisible();

    // 验证 RH Workflow 节点可见
    const rhWfNodeButton = page.getByRole('button', { name: 'RH Workflow' });
    await expect(rhWfNodeButton).toBeVisible();
  });

  test('can add rhAppNode to canvas', async ({ page }) => {
    // 打开"All nodes"下拉菜单
    const allNodesButton = page.getByRole('button', { name: 'All nodes' });
    await allNodesButton.click();

    // 等待下拉菜单打开
    await page.waitForSelector('text=RH');

    // 点击 RH APP 节点
    const rhAppNodeButton = page.locator('button:has-text("RH APP")');
    await rhAppNodeButton.click();

    // 等待节点添加到画布
    await page.waitForTimeout(500);

    // 验证画布上有 rhAppNode 节点
    const reactFlowNodes = page.locator('.react-flow__node');
    const nodeCount = await reactFlowNodes.count();
    expect(nodeCount).toBeGreaterThan(0);

    // 验证节点包含 "RH APP" 标签
    const rhAppNode = page.locator('.react-flow__node:has-text("RH APP")');
    await expect(rhAppNode).toBeVisible();
  });

  test('can add rhWfNode to canvas', async ({ page }) => {
    // 打开"All nodes"下拉菜单
    const allNodesButton = page.getByRole('button', { name: 'All nodes' });
    await allNodesButton.click();

    // 等待下拉菜单打开
    await page.waitForSelector('text=RH');

    // 点击 RH Workflow 节点
    const rhWfNodeButton = page.locator('button:has-text("RH Workflow")');
    await rhWfNodeButton.click();

    // 等待节点添加到画布
    await page.waitForTimeout(500);

    // 验证画布上有 rhWfNode 节点
    const reactFlowNodes = page.locator('.react-flow__node');
    const nodeCount = await reactFlowNodes.count();
    expect(nodeCount).toBeGreaterThan(0);

    // 验证节点包含 "RH Workflow" 标签
    const rhWfNode = page.locator('.react-flow__node:has-text("RH Workflow")');
    await expect(rhWfNode).toBeVisible();
  });

  test('rhAppNode has config mode toggle', async ({ page }) => {
    // 添加 rhAppNode
    const allNodesButton = page.getByRole('button', { name: 'All nodes' });
    await allNodesButton.click();
    await page.waitForSelector('text=RH');
    await page.locator('button:has-text("RH APP")').click();
    await page.waitForTimeout(500);

    // 查找配置模式相关的按钮（齿轮图标或配置切换）
    const rhAppNode = page.locator('.react-flow__node:has-text("RH APP")');
    await expect(rhAppNode).toBeVisible();

    // 查找配置按钮（齿轮图标）
    const configButton = rhAppNode.locator('[class*="lucide-settings"]').first();
    await expect(configButton).toBeVisible();
  });

  test('rhWfNode has config mode toggle', async ({ page }) => {
    // 添加 rhWfNode
    const allNodesButton = page.getByRole('button', { name: 'All nodes' });
    await allNodesButton.click();
    await page.waitForSelector('text=RH');
    await page.locator('button:has-text("RH Workflow")').click();
    await page.waitForTimeout(500);

    // 查找配置模式相关的按钮（齿轮图标或配置切换）
    const rhWfNode = page.locator('.react-flow__node:has-text("RH Workflow")');
    await expect(rhWfNode).toBeVisible();

    // 查找配置按钮（齿轮图标）
    const configButton = rhWfNode.locator('[class*="lucide-settings"]').first();
    await expect(configButton).toBeVisible();
  });
});

test.describe('RH Nodes Data Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
  });

  test('application loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // 过滤掉已知的非关键错误
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('manifest') &&
      !e.includes('chrome-extension') &&
      !e.includes('ReactFlow') // ReactFlow 的一些警告可以忽略
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
