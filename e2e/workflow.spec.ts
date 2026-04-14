/**
 * E2E 测试：工作流执行与数据流
 * 
 * 测试场景：
 * 1. 画布初始化
 * 2. 侧边栏交互
 * 3. 节点拖拽
 * 4. 标签页切换
 */

import { test, expect } from '@playwright/test';

test.describe('Workflow Execution', () => {
  test.beforeEach(async ({ page }) => {
    // 访问应用
    await page.goto('/');
    
    // 等待画布加载完成
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
  });

  test('canvas initializes with empty state', async ({ page }) => {
    // 检查画布存在
    const canvas = page.locator('[data-testid="flow-canvas"]');
    await expect(canvas).toBeVisible();
    
    // 检查顶部栏存在
    const header = page.locator('header');
    await expect(header).toBeVisible();
    
    // 检查"节点"按钮存在
    const nodeButton = page.getByRole('button', { name: '节点' });
    await expect(nodeButton).toBeVisible();
  });

  test('can open node sidebar', async ({ page }) => {
    // 点击"节点"按钮
    const nodeButton = page.getByRole('button', { name: '节点' });
    await nodeButton.click();

    // 等待侧边栏打开
    const sidebar = page.locator('[data-testid="node-sidebar"]');
    await expect(sidebar).toBeVisible();

    // 验证侧边栏包含可见的节点分类（只有 COMMON 常用默认展开，显示输入类节点）
    await expect(sidebar.locator('text=COMMON 常用')).toBeVisible();
    await expect(sidebar.locator('text=图片')).toBeVisible();
  });

  test('can add node to canvas via FAB', async ({ page }) => {
    // 获取添加前的节点数
    const beforeNodes = await page.locator('.react-flow__node').count();

    // 通过 FAB 的"Image"按钮直接添加节点
    await page.getByRole('button', { name: 'Image' }).first().click();
    await page.waitForTimeout(300);

    // 验证画布上有新节点
    const afterNodes = await page.locator('.react-flow__node').count();
    expect(afterNodes).toBeGreaterThan(beforeNodes);
  });

  test('sidebar closes on outside click', async ({ page }) => {
    // 打开侧边栏
    await page.getByRole('button', { name: '节点' }).click();
    
    const sidebar = page.locator('[data-testid="node-sidebar"]');
    await expect(sidebar).toBeVisible();
    
    // 点击遮罩层关闭
    const overlay = page.locator('.fixed.bg-black\\/30');
    await overlay.click();
    
    // 验证侧边栏有 -translate-x-full 类（隐藏状态）
    await expect(sidebar).toHaveClass(/-translate-x-full/);
  });
});

test.describe('Settings Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
  });

  test('can switch to settings tab', async ({ page }) => {
    // 点击顶部栏的设置按钮（齿轮图标 w-4）
    const settingsIcon = page.locator('svg.lucide-settings.w-4');
    await settingsIcon.click();
    
    // 验证设置面板显示（使用精确的 Tab 按钮文本）
    const modelTab = page.getByRole('button', { name: '模型', exact: true });
    await expect(modelTab).toBeVisible();
    
    // 验证渠道商标题存在
    const channelSection = page.locator('text=渠道商');
    await expect(channelSection).toBeVisible();
  });

  test('can switch back to canvas tab', async ({ page }) => {
    // 先进入设置
    await page.locator('svg.lucide-settings.w-4').click();
    await page.waitForSelector('text=渠道商');
    
    // 再次点击设置按钮返回画布
    await page.locator('svg.lucide-settings.w-4').click();
    
    // 验证画布显示
    const canvas = page.locator('[data-testid="flow-canvas"]');
    await expect(canvas).toBeVisible();
  });
});

test.describe('Data Flow (Integration Tests)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
  });

  test('application loads without errors', async ({ page }) => {
    // 验证控制台无错误
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // 等待一段时间检查错误
    await page.waitForTimeout(2000);
    
    // 过滤掉已知的非关键错误（如 favicon）
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('manifest') &&
      !e.includes('chrome-extension')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('canvas renders react-flow correctly', async ({ page }) => {
    // 验证 ReactFlow 组件渲染
    const reactFlow = page.locator('.react-flow');
    await expect(reactFlow).toBeVisible();
    
    // 验证控制按钮存在
    const controls = page.locator('.react-flow__controls');
    await expect(controls).toBeVisible();
    
    // 验证小地图存在
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible();
    
    // 验证背景网格存在
    const background = page.locator('.react-flow__background');
    await expect(background).toBeVisible();
  });
});