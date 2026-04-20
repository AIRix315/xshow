import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import pkg from './package.json';
import { writeFileSync, readFileSync } from 'fs';

/**
 * Vite 插件：构建后同步 package.json 版本号到 manifest.json
 * Chrome Web Store 读取 manifest.json 的 version，必须与 package.json 保持一致
 */
function syncManifestVersion() {
  return {
    name: 'sync-manifest-version',
    writeBundle() {
      const manifestPath = resolve(__dirname, 'dist/manifest.json');
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        manifest.version = pkg.version;
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      } catch {
        // manifest.json may not exist if not in public/
      }
    },
  };
}

/**
 * Vite 插件：剥离 public/background.js 中的 console 语句
 * background.js 作为静态文件不经 esbuild 处理，需单独清理
 */
function stripBackgroundConsole() {
  return {
    name: 'strip-background-console',
    writeBundle() {
      const bgPath = resolve(__dirname, 'dist/background.js');
      try {
        let code = readFileSync(bgPath, 'utf-8');
        // 移除 console.log / console.debug 行（保留 console.error / console.warn）
        code = code.replace(/^\s*console\.(log|debug)\([^]*?\);\s*$/gm, '');
        writeFileSync(bgPath, code);
      } catch {
        // background.js may not exist
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), syncManifestVersion(), stripBackgroundConsole()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    // Chrome Web Store 发布不应包含 sourcemap
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'xyflow': ['@xyflow/react'],
          'vendor': ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
  esbuild: {
    // 生产构建剥离 console.log / console.debug / debugger
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});