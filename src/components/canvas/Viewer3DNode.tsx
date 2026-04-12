// Ref: node-banana 3D Viewer Node
// 功能：加载/上传 3D 模型文件，使用 R3F 渲染
import { memo, useCallback, useRef, Suspense } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import type { Viewer3DNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function Viewer3DNode({ id, data, selected }: NodeProps<Viewer3DNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.match(/\.(glb|gltf)$/i)) {
        console.error('不支持的格式，仅支持 .glb/.gltf');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        updateNodeData(id, {
          modelUrl: result,
          modelName: file.name,
        });
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file || !file.name.match(/\.(glb|gltf)$/i)) return;

      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, {
      modelUrl: undefined,
      modelName: undefined,
    });
  }, [id, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} title="3D">
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        onChange={handleFileChange}
        className="hidden"
      />

      {data.modelUrl ? (
        <div className="relative w-full h-full overflow-hidden group rounded-lg">
          <div className="w-full h-full bg-[#1a1a1a] rounded-lg overflow-hidden">
              <Canvas
                camera={{ position: [0, 0, 5], fov: 50 }}
                style={{ background: '#1a1a1a' }}
              >
                <Suspense fallback={null}>
                  <Stage environment="city" intensity={0.5} adjustCamera={false}>
                    <GLBModel url={data.modelUrl} />
                  </Stage>
                  <OrbitControls makeDefault />
                </Suspense>
              </Canvas>
          </div>
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-600/80 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center z-10"
            title="移除模型"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="上传3D模型"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition-colors bg-[#1a1a1a] rounded-lg"
        >
          <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
          <span className="text-xs text-text-muted mt-2">点击或拖拽上传 .glb/.gltf</span>
        </div>
      )}

      <Handle type="target" position={Position.Left} id="image" style={{ top: '50%' }} data-handletype="image" />
      <Handle type="source" position={Position.Right} id="model" style={{ top: '50%' }} data-handletype="model" />
    </BaseNodeWrapper>
  );
}

// GLB 模型加载组件
function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default memo(Viewer3DNode);