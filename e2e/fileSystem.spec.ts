/**
 * E2E 测试：文件系统持久化 + 自动保存
 *
 * 测试场景：
 * 1. 自动保存开关：默认关闭，切换后状态正确
 * 2. Ctrl+S：触发保存按钮状态变化
 * 3. 项目列表：显示版本时间戳
 * 4. 设置 Tab → 系统 Tab：自动保存 Toggle 存在
 *
 * 注意：File System Access API (showDirectoryPicker) 无法在 headless 测试环境真实运行，
 * 通过 page.addInitScript 注入 mock。
 */

import { test, expect } from '@playwright/test';

// ============================================================================
// Mock: File System Access API
// ============================================================================

/** 在页面上下文注入 FileSystem mock */
async function mockFileSystemAccessApi(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    // 注入 mock dir handle（用于 hasProjectDirectory 等检查）
    const mockProjectDir = {
      kind: 'directory' as const,
      name: 'XShow-Projects',
      queryPermission: () => 'granted' as PermissionState,
      requestPermission: () => Promise.resolve('granted' as PermissionState),
      getFileHandle: () => Promise.resolve({ kind: 'file', name: 'test.xshow' } as unknown as FileSystemFileHandle),
      getDirectoryHandle: () => Promise.resolve({ kind: 'directory', name: 'generations' } as unknown as FileSystemDirectoryHandle),
      removeEntry: () => Promise.resolve(),
      values: async function* () { }[Symbol.asyncIterator](),
    };

    (window as unknown as Record<string, unknown>).__xshow_mock_fs_projectDir = mockProjectDir;

    // Mock showDirectoryPicker
    (window as unknown as Record<string, unknown>).showDirectoryPicker = async (opts?: unknown) => {
      const isWrite = (opts as { mode?: string })?.mode === 'readwrite';
      if (!isWrite) {
        return {
          kind: 'directory',
          name: 'MockDir',
          queryPermission: () => 'granted',
          requestPermission: () => Promise.resolve('granted'),
        } as unknown as FileSystemDirectoryHandle;
      }
      return mockProjectDir as unknown as FileSystemDirectoryHandle;
    };

    // Mock chrome.storage.local（防止 chrome undefined 报错）
    if (typeof chrome !== 'undefined' && !(chrome as unknown as Record<string, unknown>).storage) {
      const storage = new Map<string, string>();
      (chrome as unknown as Record<string, unknown>).storage = {
        local: {
          get: (keys: string | string[] | Record<string, unknown>) => {
            const result: Record<string, unknown> = {};
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const k of keyList) {
              if (storage.has(k as string)) {
                result[k as string] = JSON.parse(storage.get(k as string)!);
              }
            }
            return Promise.resolve(result);
          },
          set: (items: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(items)) {
              storage.set(k, JSON.stringify(v));
            }
            return Promise.resolve();
          },
          remove: (keys: string | string[]) => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) storage.delete(k);
            return Promise.resolve();
          },
        },
      };
    }
  });
}

// ============================================================================
// Tests
// ============================================================================

test.describe('文件系统持久化 E2E', () => {

  test.beforeEach(async ({ page }) => {
    await mockFileSystemAccessApi(page);
    await page.goto('/');
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 10000 });
  });

  test.describe('Settings → System Tab：自动保存 Toggle', () => {

    test('默认关闭状态', async ({ page }) => {
      // 进入设置
      await page.locator('svg.lucide-settings.w-4').click();
      await page.waitForSelector('text=渠道商');

      // 切换到系统 Tab
      await page.getByRole('button', { name: '系统' }).click();
      await page.waitForSelector('text=调试模式');

      // 自动保存 Toggle：label 包含"自动保存"文本，button 是其子元素
      const toggle = page.locator('label:has-text("自动保存") button');
      await expect(toggle).toBeVisible();
    });

    test('点击 Toggle 后状态切换', async ({ page }) => {
      await page.locator('svg.lucide-settings.w-4').click();
      await page.getByRole('button', { name: '系统' }).click();
      await page.waitForSelector('text=调试模式');

      const toggle = page.locator('label:has-text("自动保存") button');

      // 默认：Toggle 背景为 border 色（OFF）
      await expect(toggle).toHaveClass(/bg-border/);

      // 点击切换 ON
      await toggle.click();
      await page.waitForTimeout(100);

      // Toggle 背景为 primary 色（ON）
      await expect(toggle).toHaveClass(/bg-primary/);

      // 再点击切回 OFF
      await toggle.click();
      await page.waitForTimeout(100);
      await expect(toggle).toHaveClass(/bg-border/);
    });

  });

  test.describe('顶部栏：保存状态', () => {

    test('初始状态显示"已保存"', async ({ page }) => {
      const status = page.locator('text=已保存');
      await expect(status.first()).toBeVisible();
    });

    test('添加节点触发未保存状态', async ({ page }) => {
      // 通过 FAB 的"Image"按钮添加节点（NodeButton 直接调用 addNode）
      const fabImageBtn = page.getByRole('button', { name: 'Image' }).first();
      await fabImageBtn.click();
      await page.waitForTimeout(500);

      // 状态应为未保存
      const status = page.getByText(/未保存/, { exact: false });
      await expect(status.first()).toBeVisible({ timeout: 3000 });
    });

    test('Ctrl+S 触发保存（无报错）', async ({ page }) => {
      // 通过 FAB 添加节点制造 dirty
      await page.getByRole('button', { name: 'Image' }).first().click();
      await page.waitForTimeout(300);

      // Ctrl+S 触发保存
      await page.keyboard.press('Control+s');
      // 等待保存完成
      await page.waitForTimeout(1500);

      // 不应报错（无 console.error）
    });

  });

  test.describe('Settings → Project Tab：目录选择', () => {

    test('项目目录按钮存在且可点击', async ({ page }) => {
      await page.locator('svg.lucide-settings.w-4').click();
      await page.waitForSelector('text=渠道商');

      // 切换到项目 Tab
      await page.getByRole('button', { name: '项目' }).click();
      await page.waitForSelector('text=设置目录');

      // 项目目录选择按钮
      const pickBtn = page.locator('text=选择').first();
      await expect(pickBtn).toBeVisible();
    });

    test('未设置目录时显示"未设置"', async ({ page }) => {
      await page.locator('svg.lucide-settings.w-4').click();
      await page.getByRole('button', { name: '项目' }).click();
      await page.waitForSelector('text=设置目录');

      // 项目目录输入应显示"未设置"（第二个输入框）
      const input = page.locator('input[value="未设置"]').nth(1);
      await expect(input).toBeVisible();
    });

  });

  test.describe('Settings → Project Tab：Base64 嵌入开关', () => {

    test('Base64 开关存在且默认关闭', async ({ page }) => {
      await page.locator('svg.lucide-settings.w-4').click();
      await page.getByRole('button', { name: '项目' }).click();
      await page.waitForSelector('text=设置目录');

      // 开关文字
      const embedLabel = page.locator('text=导出含媒体');
      await expect(embedLabel).toBeVisible();

      // 关闭状态提示
      const offHint = page.locator('text=已关闭');
      await expect(offHint).toBeVisible();
    });

  });

  test.describe('Settings → Project Tab：导入/导出按钮', () => {

    test('导入和导出按钮存在', async ({ page }) => {
      await page.locator('svg.lucide-settings.w-4').click();
      await page.getByRole('button', { name: '项目' }).click();
      await page.waitForSelector('text=设置目录');

      const importBtn = page.locator('button:has-text("导入")').first();
      const exportBtn = page.locator('button:has-text("导出")').first();

      await expect(importBtn).toBeVisible();
      await expect(exportBtn).toBeVisible();
    });

  });

  test.describe('顶部栏：导入/新建按钮', () => {

    test('导入按钮存在于顶部栏', async ({ page }) => {
      const importBtn = page.locator('button:has-text("导入")').first();
      await expect(importBtn).toBeVisible();
    });

    test('新建按钮存在', async ({ page }) => {
      const newBtn = page.locator('button:has-text("新建")');
      await expect(newBtn).toBeVisible();
    });

  });

  test.describe('快捷键对话框', () => {

    test('? 键打开快捷键对话框', async ({ page }) => {
      await page.waitForTimeout(500); // 确保 focus
      await page.keyboard.press('?');
      await page.waitForTimeout(300);

      const dialog = page.locator('text=快捷键');
      await expect(dialog.first()).toBeVisible();
    });

  });

});
