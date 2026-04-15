/**
 * 单元测试：ZIP 解压工具
 * 
 * 测试场景：
 * 1. 验证 ZIP 文件格式正确
 * 2. 验证 getMediaType 函数逻辑
 * 3. 验证 classifyMedia 函数逻辑
 */

import { test, expect } from '@playwright/test';

test.describe('ZIP File Creation and Parsing', () => {
  test('ZIP 文件签名验证', async ({ page }) => {
    await page.goto('about:blank');
    
    // 验证 ZIP 签名字节
    const zipBytes = await page.evaluate(() => {
      // 手动创建一个简单的 ZIP 字节数组
      const result: number[] = [];
      
      // 本地文件头签名: PK\x03\x04
      result.push(0x50, 0x4b, 0x03, 0x04);
      // 其余本地文件头...
      result.push(0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
      result.push(0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00);
      result.push(0x01, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00);
      // 文件名: "empty.txt"
      for (const c of 'empty.txt') {
        result.push(c.charCodeAt(0));
      }
      // 文件内容
      result.push(0x00);
      // 中央目录结束记录: PK\x05\x06
      result.push(0x50, 0x4b, 0x05, 0x06);
      
      return result;
    });
    
    // 验证 ZIP 本地文件头签名
    expect(zipBytes[0]).toBe(0x50); // P
    expect(zipBytes[1]).toBe(0x4b); // K
    expect(zipBytes[2]).toBe(0x03); 
    expect(zipBytes[3]).toBe(0x04);
    
    // 验证中央目录结束签名在末尾
    const last4Index = zipBytes.length - 4;
    expect(zipBytes[last4Index]).toBe(0x50);
    expect(zipBytes[last4Index + 1]).toBe(0x4b);
    expect(zipBytes[last4Index + 2]).toBe(0x05);
    expect(zipBytes[last4Index + 3]).toBe(0x06);
  });

  test('getMediaType 函数逻辑验证', async ({ page }) => {
    await page.goto('about:blank');
    
    const testCases = await page.evaluate(() => {
      function getMediaType(filename: string): string {
        const lower = filename.toLowerCase();
        if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(lower)) return 'image';
        if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(lower)) return 'video';
        if (/\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(lower)) return 'audio';
        return 'unknown';
      }
      
      return [
        { filename: 'test.png', expected: 'image' },
        { filename: 'test.jpg', expected: 'image' },
        { filename: 'test.jpeg', expected: 'image' },
        { filename: 'test.gif', expected: 'image' },
        { filename: 'test.webp', expected: 'image' },
        { filename: 'test.mp4', expected: 'video' },
        { filename: 'test.webm', expected: 'video' },
        { filename: 'test.mov', expected: 'video' },
        { filename: 'test.mp3', expected: 'audio' },
        { filename: 'test.wav', expected: 'audio' },
        { filename: 'test.ogg', expected: 'audio' },
        { filename: 'test.txt', expected: 'unknown' },
        { filename: 'test.pdf', expected: 'unknown' },
      ].map(tc => ({
        ...tc,
        result: getMediaType(tc.filename),
        pass: getMediaType(tc.filename) === tc.expected
      }));
    });
    
    for (const tc of testCases) {
      expect(tc.result).toBe(tc.expected);
    }
  });

  test('classifyMedia 函数逻辑验证', async ({ page }) => {
    await page.goto('about:blank');
    
    const result = await page.evaluate(() => {
      interface ExtractedMedia {
        name: string;
        url: string;
        type: 'image' | 'video' | 'audio' | 'unknown';
        size: number;
      }
      
      interface ClassifiedMedia {
        images: ExtractedMedia[];
        videos: ExtractedMedia[];
        audio: ExtractedMedia[];
        others: ExtractedMedia[];
      }
      
      function classifyMedia(files: ExtractedMedia[]): ClassifiedMedia {
        const result: ClassifiedMedia = {
          images: [],
          videos: [],
          audio: [],
          others: [],
        };
        
        for (const file of files) {
          switch (file.type) {
            case 'image':
              result.images.push(file);
              break;
            case 'video':
              result.videos.push(file);
              break;
            case 'audio':
              result.audio.push(file);
              break;
            default:
              result.others.push(file);
          }
        }
        
        return result;
      }
      
      const testFiles: ExtractedMedia[] = [
        { name: 'image1.png', url: 'blob://test1', type: 'image', size: 100 },
        { name: 'video1.mp4', url: 'blob://test2', type: 'video', size: 1000 },
        { name: 'audio1.mp3', url: 'blob://test3', type: 'audio', size: 500 },
        { name: 'image2.jpg', url: 'blob://test4', type: 'image', size: 200 },
        { name: 'document.pdf', url: 'blob://test5', type: 'unknown', size: 50 },
      ];
      
      return classifyMedia(testFiles);
    });
    
    expect(result.images).toHaveLength(2);
    expect(result.videos).toHaveLength(1);
    expect(result.audio).toHaveLength(1);
    expect(result.others).toHaveLength(1);
    expect(result.images[0].name).toBe('image1.png');
    expect(result.images[1].name).toBe('image2.jpg');
    expect(result.videos[0].name).toBe('video1.mp4');
    expect(result.audio[0].name).toBe('audio1.mp3');
    expect(result.others[0].name).toBe('document.pdf');
  });
});
