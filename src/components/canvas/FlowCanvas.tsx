// Ref: @xyflow/react ^12.10 + node-banana WorkflowCanvas.tsx + §6.1 + §6.12 + §6.15
// Ref: §4.2 — 画布状态持久化（保存/加载）
import { useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type OnConnectEnd,
  useOnSelectionChange,
} from '@xyflow/react';
import { nodeTypes } from '@/utils/nodeFactory';
import { createNode } from '@/utils/nodeFactory';
import { useFlowStore } from '@/stores/useFlowStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { saveCanvasState, loadCanvasState } from '@/utils/canvasState';
import FloatingActionBar from './FloatingActionBar';
import ConnectionDropMenu from './ConnectionDropMenu';
import ReferenceEdge from '../edges/ReferenceEdge';
import '@xyflow/react/dist/style.css';

// =============================================================================
// 自定义边类型注册
// =============================================================================

const edgeTypes = {
  reference: ReferenceEdge,
};

// =============================================================================
// 连接验证：Handle 数据类型兼容性检查
// =============================================================================

/** Handle 数据类型 */
type HandleDataType = 'image' | 'text' | 'audio' | 'video' | 'model' | 'value' | 'reference' | 'any';

/** 从 Handle ID 提取数据类型（参考 node-banana getHandleType） */
function getHandleType(handleId: string | null | undefined): HandleDataType {
  if (!handleId) return 'any';
  // 精确匹配
  if (handleId === 'image' || handleId === 'text' || handleId === 'audio' || handleId === 'video' || handleId === 'model' || handleId === 'value' || handleId === 'reference' || handleId === 'input') {
    return handleId === 'input' ? 'any' : handleId as HandleDataType;
  }
  // cell-* 格式 (GridSplitNode 的输出句柄，如 cell-0-0, cell-1-0)
  if (handleId.startsWith('cell-')) return 'image';
  // 包含匹配 (如 "source-image", "cropped-image", "video-0", "image-left")
  if (handleId.includes('image')) return 'image';
  if (handleId.includes('text')) return 'text';
  if (handleId.includes('audio')) return 'audio';
  if (handleId.includes('video')) return 'video';
  if (handleId.includes('model')) return 'model';
  if (handleId.includes('value')) return 'value';
  // 特殊前缀
  if (handleId.startsWith('output') || handleId.startsWith('rule') || handleId.startsWith('default') || handleId.startsWith('on') || handleId.startsWith('off')) return 'any';
  return 'any';
}

/** 从 Handle ID 中提取数据类型前缀 */
function extractHandleType(handleId: string | null): HandleDataType | null {
  if (!handleId) return null;
  // 精确匹配
  if (handleId === 'image' || handleId === 'text' || handleId === 'audio' || handleId === 'video' || handleId === 'model' || handleId === 'value' || handleId === 'any' || handleId === 'reference' || handleId === 'input') {
    return handleId === 'input' ? 'any' : handleId as HandleDataType;
  }
  // 前缀匹配 (如 "video-0", "image-left", "output-1", "rule-0")
  if (handleId.startsWith('image')) return 'image';
  if (handleId.startsWith('text')) return 'text';
  if (handleId.startsWith('audio')) return 'audio';
  if (handleId.startsWith('video')) return 'video';
  if (handleId.startsWith('model')) return 'model';
  if (handleId.startsWith('value')) return 'value';
  if (handleId.startsWith('output') || handleId.startsWith('rule') || handleId.startsWith('default') || handleId.startsWith('on') || handleId.startsWith('off')) return 'any';
  return null;
}

/** 检查两个数据类型是否兼容 */
function isDataTypeCompatible(sourceType: HandleDataType, targetType: HandleDataType): boolean {
  if (sourceType === 'any' || targetType === 'any') return true;
  // model 输出可以连到 image 输入 (3D模型→图片展示)
  if (sourceType === 'model' && targetType === 'image') return true;
  // value 类型可与 text 兼容
  if ((sourceType === 'value' && targetType === 'text') || (sourceType === 'text' && targetType === 'value')) return true;
  return sourceType === targetType;
}

/** 连接验证函数 */
function validateConnection(connection: Connection): boolean {
  const { source, target, sourceHandle, targetHandle } = connection;
  
  console.log('[validateConnection] connection:', { source, target, sourceHandle, targetHandle });
  
  if (!source || !target) {
    console.log('[validateConnection] 拒绝: source或target为空');
    return false;
  }
  if (source === target) {
    console.log('[validateConnection] 拒绝: source === target');
    return false;
  }
  
  const sourceType = extractHandleType(sourceHandle);
  const targetType = extractHandleType(targetHandle);
  
  console.log('[validateConnection] types:', { sourceType, targetType });
  
  // 如果两边都识别到类型，检查兼容性
  if (sourceType && targetType) {
    const compatible = isDataTypeCompatible(sourceType, targetType);
    console.log('[validateConnection] 兼容性:', compatible);
    return compatible;
  }
  
  // 未知类型默认允许（宽松模式）
  console.log('[validateConnection] 未知类型，默认允许');
  return true;
}

// =============================================================================
// 自动连接映射：根据源 handle 类型 + 目标节点类型，确定目标 handle ID
// =============================================================================

/** 给定源 handle 数据类型和目标节点类型，推导目标节点的输入 handle ID */
function resolveTargetHandleId(handleType: HandleDataType, nodeType: string): string | null {
  // 特殊节点：逻辑/路由节点透传
  if (nodeType === 'routerNode') return handleType as string;
  if (nodeType === 'switchNode') return 'input';
  if (nodeType === 'conditionalSwitchNode') return 'input';
  if (nodeType === 'omniNode' || nodeType === 'rhAppNode' || nodeType === 'rhWfNode') return 'any-input';

  // 输出节点：多类型输入
  if (nodeType === 'outputNode') {
    if (handleType === 'video') return 'video';
    if (handleType === 'audio') return 'audio';
    return 'image'; // image/text/any 都接 image handle
  }
  if (nodeType === 'outputGalleryNode') {
    if (handleType === 'video') return 'video';
    if (handleType === 'audio') return 'audio';
    if (handleType === 'text') return 'text';
    return 'image';
  }

  // 特殊 ID 映射
  if (nodeType === 'gridSplitNode') return 'source-image';
  if (nodeType === 'videoStitchNode') return 'video-0';
  if (nodeType === 'imageCompareNode') return 'image-left';
  if (nodeType === 'viewer3DNode') return handleType === 'model' ? 'image' : null;

  // 通用匹配：handleType 与节点默认输入同名（image→image, text→text, video→video, audio→audio）
  if (handleType === 'image') {
    if (['annotateNode', 'imageInputNode'].includes(nodeType)) return 'image';
    if (nodeType === 'gridMergeNode') return 'source-image';
    return 'image';
  }
  if (handleType === 'text') {
    if (['generateAudioNode', 'generate3DNode', 'promptConstructorNode', 'textInputNode'].includes(nodeType)) return 'text';
    return 'text';
  }
  if (handleType === 'video') {
    if (['videoTrimNode', 'frameGrabNode', 'videoInputNode'].includes(nodeType)) return 'video';
    return 'video';
  }
  if (handleType === 'audio') {
    return 'audio';
  }
  // any 或未知类型：尝试匹配节点默认输入
  if (handleType === 'any' || handleType === 'value') {
    // 对于 any 类型，找节点的第一个输入 handle
    if (nodeType === 'videoStitchNode') return 'video-0';
    if (nodeType === 'imageCompareNode') return 'image-left';
    return null; // 无法确定，让用户手动连接
  }
  return null;
}

/** 给定源 handle 数据类型和新节点类型，推导新节点的输出 handle ID（反向拖拽用） */
function resolveSourceHandleId(handleType: HandleDataType, nodeType: string): string | null {
  // 输入节点：输出类型固定
  if (nodeType === 'imageInputNode') return 'image';
  if (nodeType === 'textInputNode') return 'text';
  if (nodeType === 'videoInputNode') return 'video';
  if (nodeType === 'generateAudioNode') return 'audio';
  if (nodeType === 'generate3DNode') return 'model';
  if (nodeType === 'promptConstructorNode') return 'text';
  if (nodeType === 'easeCurveNode') return 'value';
  if (nodeType === 'annotateNode') return 'image';
  if (nodeType === 'frameGrabNode') return 'image';
  if (nodeType === 'imageCompareNode') return 'image';

  // 路由/逻辑节点透传
  if (nodeType === 'routerNode') return handleType as string;

  // 通用匹配：输出 handle ID = handleType
  return handleType as string | null;
}

function FlowCanvasInner() {
  const [dropMenuState, setDropMenuState] = useState<{
    position: { x: number; y: number } | null;
    sourceHandleType: string | null;
    /** 拖拽起点的节点 ID */
    sourceNodeId: string | null;
    /** 拖拽起点的 handle ID（如 "any-output", "image" 等） */
    sourceHandleId: string | null;
    /** 拖拽方向：从 output(source) 拖出 vs 从 input(target) 拖出 */
    connectionType: 'source' | 'target' | null;
  }>({ position: null, sourceHandleType: null, sourceNodeId: null, sourceHandleId: null, connectionType: null });
  // 追踪选中节点 ID（用于复制/粘贴）
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // 追踪选中节点
  useOnSelectionChange({
    onChange: ({ nodes: selected }) => {
      setSelectedNodeIds(selected.map((n) => n.id));
    },
  });

  // 全局键盘快捷键（复制/粘贴/撤销/重做）
  useEffect(() => {
    const pushUndo = useFlowStore.getState().pushUndo;
    const copySelectedNodes = useFlowStore.getState().copySelectedNodes;
    const pasteNodes = useFlowStore.getState().pasteNodes;
    const undo = useFlowStore.getState().undo;
    const redo = useFlowStore.getState().redo;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // Ctrl+Z / Ctrl+Shift+Z 撤销/重做
      if (e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        // Ctrl+Y 也支持重做
        if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          redo();
          return;
        }
        // Ctrl+C 复制
        if ((e.key === 'c' || e.key === 'C') && selectedNodeIds.length > 0) {
          e.preventDefault();
          pushUndo();
          copySelectedNodes(selectedNodeIds);
          return;
        }
        // Ctrl+V 粘贴
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          pushUndo();
          pasteNodes();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // 记录连接拖拽起点的信息
  const connectingInfo = useRef<{
    nodeId: string;
    handleType: string;
    handleId: string;
  } | null>(null);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const highlightedNodeId = useFlowStore((s) => s.highlightedNodeId);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const flowAddNode = useFlowStore((s) => s.addNode);
  const addEdge = useFlowStore((s) => s.addEdge);
  const setHighlightedNode = useFlowStore((s) => s.setHighlightedNode);
  const setNodes = useFlowStore((s) => s.setNodes);
  const setEdges = useFlowStore((s) => s.setEdges);
  const currentProjectId = useSettingsStore((s) => s.currentProjectId);
  const cs = useSettingsStore((s) => s.canvasSettings);
  const reactFlowInstance = useRef<ReturnType<typeof Object> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCanvasState(currentProjectId).then((state) => {
      if (cancelled || !state) return;
      setNodes(state.nodes);
      setEdges(state.edges);
    });
    return () => { cancelled = true; };
  }, [currentProjectId, setNodes, setEdges]);

  // 节点/边变化时自动保存
  useEffect(() => {
    saveCanvasState(currentProjectId, nodes, edges);
  }, [currentProjectId, nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      // 连接验证：检查数据类型兼容性
      if (!validateConnection(connection)) {
        // 可选：可以在这里显示 toast 提示用户
        console.warn('连接验证失败：数据类型不兼容');
        return;
      }
      addEdge({
        id: `${connection.source}-${connection.sourceHandle ?? ''}-${connection.target}-${connection.targetHandle ?? ''}-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      });
      // 连接成功后清除连接信息
      connectingInfo.current = null;
    },
    [addEdge, nodes]
  );

  // 连接开始时记录起点信息
  const onConnectStart = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_event: unknown, _params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
      // 空回调，不需要额外记录信息
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // 使用 nativeEvent 获取原生的 DataTransfer 对象
    const nativeEvent = event.nativeEvent as DragEvent;
    nativeEvent.dataTransfer && (nativeEvent.dataTransfer.dropEffect = 'move');
  }, []);

  // 监听原生 DOM 事件处理拖拽（React onDrop 有时无法获取 DataTransfer）
  useEffect(() => {
    const handleNativeDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    document.addEventListener('dragover', handleNativeDragOver);
    
    const handleNativeDrop = (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer?.getData('application/reactflow');
      
      if (type && reactFlowInstance.current) {
        const instance = reactFlowInstance.current as { screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number } };
        const position = instance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        const newNode = createNode(type, position);
        flowAddNode(newNode);
      }
    };
    document.addEventListener('drop', handleNativeDrop);
    return () => {
      document.removeEventListener('dragover', handleNativeDragOver);
      document.removeEventListener('drop', handleNativeDrop);
    };
  }, [flowAddNode]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      // React onDrop 有时无法获取 DataTransfer，依赖原生事件处理
    },
    [flowAddNode],
  );

  // 用于防止 onPaneClick 立即清除 onConnectEnd 设置的菜单
  const menuOpenedByConnectEnd = useRef(false);

  const onPaneClick = useCallback(() => {
    // 如果刚通过 onConnectEnd 打开了菜单，忽略此次点击
    if (menuOpenedByConnectEnd.current) {
      menuOpenedByConnectEnd.current = false;
      return;
    }
    setHighlightedNode(null);
    setDropMenuState({ position: null, sourceHandleType: null, sourceNodeId: null, sourceHandleId: null, connectionType: null });
  }, [setHighlightedNode]);

  // 连接拖拽结束时，如果未连接到目标节点，弹出 ConnectionDropMenu
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      // 如果连接成功（isValid 为 true），不弹菜单
      if (connectionState.isValid) {
        return;
      }

      // 如果没有起始节点，不弹菜单
      if (!connectionState.fromNode) {
        return;
      }

      // 获取鼠标位置
      const { clientX, clientY } = event as MouseEvent;

      // 从 fromHandle.id 获取 handle 类型（使用 getHandleType 从 ID 推断数据类型）
      const fromHandleId = connectionState.fromHandle?.id || null;
      const handleType = getHandleType(fromHandleId);

      // 从 fromHandle 判断拖拽方向
      const isFromSource = connectionState.fromHandle?.type === 'source';

      setDropMenuState({
        position: { x: clientX, y: clientY },
        sourceHandleType: handleType,
        sourceNodeId: connectionState.fromNode.id,
        sourceHandleId: fromHandleId,
        connectionType: isFromSource ? 'source' : 'target',
      });
      menuOpenedByConnectEnd.current = true;
    },
    [],
  );

  // 从 ConnectionDropMenu 选择节点后创建节点并自动连接
  const handleDropMenuSelect = useCallback(
    (nodeType: string) => {
      if (!dropMenuState.position || !reactFlowInstance.current) {
        setDropMenuState({ position: null, sourceHandleType: null, sourceNodeId: null, sourceHandleId: null, connectionType: null });
        return;
      }
      const instance = reactFlowInstance.current as { screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number } };
      const position = instance.screenToFlowPosition(dropMenuState.position);
      const newNode = createNode(nodeType, position);
      flowAddNode(newNode);

      // 自动连接：从源节点到新创建的节点
      const { sourceNodeId, sourceHandleId, sourceHandleType, connectionType } = dropMenuState;
      if (sourceNodeId && connectionType) {
        const handleType = sourceHandleType as HandleDataType;

        if (connectionType === 'source') {
          // 正向拖拽：从 output handle 拖出 → 新节点的输入
          const targetHandleId = resolveTargetHandleId(handleType, nodeType);
          if (targetHandleId) {
            addEdge({
              id: `${sourceNodeId}-${sourceHandleId ?? ''}-${newNode.id}-${targetHandleId}-${Date.now()}`,
              source: sourceNodeId,
              sourceHandle: sourceHandleId ?? undefined,
              target: newNode.id,
              targetHandle: targetHandleId,
            });
          }
        } else {
          // 反向拖拽：从 input handle 拖出 → 新节点的输出
          const sourceHandleForNewNode = resolveSourceHandleId(handleType, nodeType);
          if (sourceHandleForNewNode) {
            addEdge({
              id: `${newNode.id}-${sourceHandleForNewNode}-${sourceNodeId}-${sourceHandleId ?? ''}-${Date.now()}`,
              source: newNode.id,
              sourceHandle: sourceHandleForNewNode,
              target: sourceNodeId,
              targetHandle: sourceHandleId ?? undefined,
            });
          }
        }
      }

      setDropMenuState({ position: null, sourceHandleType: null, sourceNodeId: null, sourceHandleId: null, connectionType: null });
    },
    [dropMenuState, flowAddNode, addEdge],
  );

  // Ref: §6.12 — 高亮节点样式：应用到 node style 中
  const styledNodes = nodes.map((n) => ({
    ...n,
    style: {
      ...n.style,
      ...(n.id === highlightedNodeId
        ? { outline: '2px solid #3b82f6', outlineOffset: '2px' }
        : {}),
    },
  }));

  return (
    <div
      className="flex h-full w-full relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      data-testid="flow-canvas"
    >
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(instance: unknown) => {
            reactFlowInstance.current = instance;
          }}
          onDragOver={onDragOver}
          onPaneClick={onPaneClick}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode="Shift"
          selectionOnDrag={false}
          selectionKeyCode="Shift"
          panOnDrag={[1]}
          selectNodesOnDrag={false}
          nodeDragThreshold={5}
          nodeClickDistance={5}
          zoomOnScroll={false}
          zoomOnPinch={true}
          minZoom={0.1}
          maxZoom={4}
          className="bg-neutral-900"
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'default', animated: false }}
          snapToGrid={cs.snapToGrid}
          snapGrid={[20, 20]}
        >
          {cs.showGrid && <Background color="#404040" gap={20} size={1} />}
          <Controls className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg [&>button]:bg-neutral-800 [&>button]:border-neutral-700 [&>button]:text-neutral-300 [&>button:hover]:bg-neutral-700 [&>button:hover]:text-neutral-100" />
          {cs.minimapPosition !== 'off' && <MiniMap
            position={cs.minimapPosition === 'top-right' ? 'top-right' : 'bottom-right'}
            className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg"
            maskColor="rgba(0, 0, 0, 0.6)"
            pannable
            zoomable
            nodeColor={(node) => {
              switch (node.type) {
                case 'imageNode':
                  return '#10b981';
                case 'textNode':
                  return '#f97316';
                case 'videoNode':
                  return '#9333ea';
                case 'audioNode':
                  return '#d946ef';
                case 'cropNode':
                  return '#60a5fa';
                case 'gridSplitNode':
                  return '#f59e0b';
                case 'gridMergeNode':
                  return '#f97316';
                case 'omniNode':
                  return '#06b6d4';
                // Input
                case 'viewer3DNode':
                  return '#22d3ee';
                // Text
                case 'promptConstructorNode':
                  return '#fb923c';
                // Generate
                case 'generateAudioNode':
                  return '#e879f9';
                case 'generate3DNode':
                  return '#2dd4bf';
                // Process
                case 'annotateNode':
                  return '#4ade80';
                case 'videoStitchNode':
                  return '#a78bfa';
                case 'videoTrimNode':
                  return '#818cf8';
                case 'easeCurveNode':
                  return '#fbbf24';
                case 'frameGrabNode':
                  return '#f472b6';
                case 'imageCompareNode':
                  return '#34d399';
                // Route
                case 'routerNode':
                  return '#fb7185';
                case 'switchNode':
                  return '#38bdf8';
                case 'conditionalSwitchNode':
                  return '#c084fc';
                // Output
                case 'outputNode':
                  return '#a3e635';
                case 'outputGalleryNode':
                  return '#facc15';
                default:
                  return '#94a3b8';
              }
            }}
          />}
        </ReactFlow>
      </div>
      <FloatingActionBar />
      <ConnectionDropMenu
        position={dropMenuState.position}
        sourceHandleType={dropMenuState.sourceHandleType}
        connectionType={dropMenuState.connectionType}
        nodes={nodes}
        onSelect={handleDropMenuSelect}
        onClose={() => setDropMenuState({ position: null, sourceHandleType: null, sourceNodeId: null, sourceHandleId: null, connectionType: null })}
      />
    </div>
  );
}

export default function FlowCanvas() {
  return <FlowCanvasInner />;
}