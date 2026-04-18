// sendToActiveTab 双窗口交互
import type { TransitResource } from '@/types';

async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
}

function base64ToFile(base64: string, filename: string): File {
  const parts = base64.split(',');
  const header = parts[0] ?? '';
  const data = parts[1] ?? '';
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new File([array], filename, { type: mime });
}

async function injectAndFill(
  resourceUrl: string,
  resourceType: string,
  resourceName: string
): Promise<string> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) {
    throw new Error('未找到活动标签页');
  }

  let file: File;
  if (resourceUrl.startsWith('data:')) {
    file = base64ToFile(resourceUrl, resourceName || 'file');
  } else {
    file = await urlToFile(resourceUrl, resourceName || 'file');
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileData = Array.from(new Uint8Array(arrayBuffer));
  const fileType = file.type;
  const fileName = file.name;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (fName: string, fType: string, fData: number[], rType: string) => {
      const fileInputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
      let targetInput: HTMLInputElement | null = null;

      if (rType === 'image') {
        targetInput = Array.from(fileInputs).find((inp) => {
          const accept = inp.accept || '';
          return accept.includes('image') || accept.includes('*') || accept === '';
        }) ?? fileInputs[0] ?? null;
      } else {
        targetInput = fileInputs[0] ?? null;
      }

      if (!targetInput) {
        return;
      }

      const uint8 = new Uint8Array(fData);
      const blob = new Blob([uint8], { type: fType });
      const fileObj = new File([blob], fName, { type: fType });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(fileObj);
      targetInput.files = dataTransfer.files;

      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));

      const originalBorder = targetInput.style.border;
      targetInput.style.border = '2px solid #3b82f6';
      setTimeout(() => {
        targetInput!.style.border = originalBorder;
      }, 1000);
    },
    args: [fileName, fileType, fileData, resourceType],
  });

  return 'SENT';
}

export async function sendToActiveTab(resource: TransitResource): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
    throw new Error('Chrome Extension API 不可用，请在扩展环境中使用');
  }

  const resourceName = resource.url.split('/').pop() || `${resource.type}-resource`;
  await injectAndFill(resource.url, resource.type, resourceName);
}