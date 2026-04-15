import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Import component (default export memo-wrapped)
import RhAppNodeComponent from './RhAppNode';

// ============================================
// MOCKS
// ============================================

const mockUpdateNodeData = vi.fn();
const mockFetchRhAppNodeInfo = vi.fn();
const mockExecuteRhAppNode = vi.fn();

const mockApps = [
  { id: 'app1', name: 'Test App 1', category: 'image' },
  { id: 'app2', name: 'Test App 2', category: 'video' },
];

let mockApiKey = 'test-api-key';
let storeNodes: any[] = [];

// mockUpdateNodeData should also update storeNodes so getState() returns fresh data
mockUpdateNodeData.mockImplementation((nodeId: string, patch: Record<string, unknown>) => {
  const idx = storeNodes.findIndex((n: any) => n.id === nodeId);
  if (idx >= 0) {
    storeNodes[idx] = { ...storeNodes[idx], data: { ...storeNodes[idx].data, ...patch } };
  }
});

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
    Handle: ({ id, type, position, ...props }: any) => (
      <div
        data-testid={id ? `handle-${id}` : 'handle'}
        data-handle-type={type}
        data-position={position}
        {...props}
      />
    ),
    useUpdateNodeInternals: () => vi.fn(),
  };
});

vi.mock('@/stores/useFlowStore', () => {
  const getStoreState = () => ({
    updateNodeData: mockUpdateNodeData,
    nodes: storeNodes,
    edges: [],
  });
  return {
    useFlowStore: Object.assign(
      (selector: any) => selector(getStoreState()),
      { getState: () => getStoreState() }
    ),
  };
});

vi.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: (selector: any) => {
    const state = {
      comfyuiConfig: {
        runninghubApps: mockApps,
        runninghubApiKey: mockApiKey,
      },
    };
    return selector(state);
  },
}));

vi.mock('@/api/rhApi', () => ({
  fetchRhAppNodeInfo: (...args: any[]) => mockFetchRhAppNodeInfo(...args),
}));

vi.mock('@/store/execution/rhAppExecutor', () => ({
  executeRhAppNode: (...args: any[]) => mockExecuteRhAppNode(...args),
}));

vi.mock('./BaseNode', () => ({
  default: ({ children, title, errorMessage, ...props }: any) => (
    <div data-testid="base-node" data-title={title} {...props}>
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      {children}
    </div>
  ),
}));

// ============================================
// RENDER HELPER
// ============================================

function renderRhAppNode(overrides: Record<string, unknown> = {}) {
  const defaultData = {
    label: 'RhApp',
    configMode: true,
    config: { appId: '', nodeInfoList: [] },
    loading: false,
    progress: 0,
    outputUrl: '',
    outputUrls: [],
    textOutput: '',
    errorMessage: '',
    ...overrides,
  };
  // Reset and populate mock store nodes so getState() returns fresh data
  storeNodes = [{ id: 'rh1', data: defaultData, type: 'rhApp' }];
  return render(
    <RhAppNodeComponent
      id="rh1"
      data={defaultData}
      selected={false}
      {...({} as any)}
    />
  );
}

// ============================================
// TESTS
// ============================================

describe('RhAppNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: renders with no APP selected
  it('renders with no APP selected', () => {
    renderRhAppNode();
    // Should show the "选择 APP" dropdown
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
    // Check for the placeholder option
    expect(screen.getByText('— 选择 APP —')).toBeInTheDocument();
  });

  // Test 2: renders warning when no API key
  it('renders warning when no API key', () => {
    mockApiKey = '';
    renderRhAppNode();
    expect(screen.getByText(/请在设置中配置 API Key/i)).toBeInTheDocument();
    mockApiKey = 'test-api-key';
  });

  // Test 3: selecting APP triggers fetchRhAppNodeInfo
  it('selecting APP triggers fetchRhAppNodeInfo', async () => {
    mockFetchRhAppNodeInfo.mockResolvedValue({ nodeInfoList: [] });

    renderRhAppNode();

    const selects = screen.getAllByRole('combobox');
    // The APP selection select should be one of them
    const appSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test App 1');
    });
    expect(appSelect).toBeDefined();

    // Select app1
    fireEvent.change(appSelect!, { target: { value: 'app1' } });

    // Wait for the async operation
    await waitFor(() => {
      expect(mockFetchRhAppNodeInfo).toHaveBeenCalledWith(mockApiKey, 'app1');
    });
  });

  // Test 4: renders STRING textarea after APP selected
  it('renders STRING textarea after APP selected', async () => {
    const mockNodeInfoList = [
      {
        nodeId: 'node1',
        nodeName: 'Prompt',
        fieldName: 'prompt_text',
        fieldValue: 'default prompt',
        fieldType: 'STRING',
        description: 'Enter prompt text',
      },
    ];
    mockFetchRhAppNodeInfo.mockResolvedValue({ nodeInfoList: mockNodeInfoList });

    renderRhAppNode();

    const selects = screen.getAllByRole('combobox');
    const appSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test App 1');
    });
    fireEvent.change(appSelect!, { target: { value: 'app1' } });

    await waitFor(() => {
      const textareas = screen.getAllByRole('textbox');
      expect(textareas.length).toBeGreaterThan(0);
    });
  });

  // Test 5: renders LIST select dropdown after APP selected
  it('renders LIST select dropdown after APP selected', async () => {
    const mockNodeInfoList = [
      {
        nodeId: 'node1',
        nodeName: 'AspectRatio',
        fieldName: 'aspect_ratio',
        fieldValue: '0',
        fieldType: 'LIST',
        fieldData: '[{"name":"1:1","index":"0","description":""},{"name":"16:9","index":"1","description":""}]',
        description: 'Select aspect ratio',
      },
    ];
    mockFetchRhAppNodeInfo.mockResolvedValue({ nodeInfoList: mockNodeInfoList });

    renderRhAppNode();

    const selects = screen.getAllByRole('combobox');
    const appSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test App 1');
    });
    fireEvent.change(appSelect!, { target: { value: 'app1' } });

    await waitFor(() => {
      const listSelects = screen.getAllByRole('combobox');
      // Should have the LIST select with 2 options (excluding the APP selects)
      const listSelect = listSelects.find((sel) => {
        const options = within(sel).getAllByRole('option');
        return options.some((opt) => opt.textContent === '1:1');
      });
      expect(listSelect).toBeDefined();
      const options = within(listSelect!).getAllByRole('option');
      expect(options).toHaveLength(2);
    });
  });

  // Test 6: renders IMAGE interface hint after APP selected
  it('renders IMAGE interface hint after APP selected', async () => {
    const mockNodeInfoList = [
      {
        nodeId: 'node1',
        nodeName: 'ImageInput',
        fieldName: 'image',
        fieldValue: '',
        fieldType: 'IMAGE',
        description: 'Upload image',
      },
    ];
    mockFetchRhAppNodeInfo.mockResolvedValue({ nodeInfoList: mockNodeInfoList });

    renderRhAppNode();

    const selects = screen.getAllByRole('combobox');
    const appSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test App 1');
    });
    fireEvent.change(appSelect!, { target: { value: 'app1' } });

    await waitFor(() => {
      expect(screen.getByText(/通过 IMAGE 接口传入/)).toBeInTheDocument();
    });
  });

  // Test 7: renders image-N handles when IMAGE fields > 1 (aligned with OmniNode)
  it('renders image-N handles when IMAGE fields > 1', async () => {
    const mockNodeInfoList = [
      { nodeId: 'node1', nodeName: 'Img1', fieldName: 'image1', fieldValue: '', fieldType: 'IMAGE' },
      { nodeId: 'node2', nodeName: 'Img2', fieldName: 'image2', fieldValue: '', fieldType: 'IMAGE' },
    ];
    mockFetchRhAppNodeInfo.mockResolvedValue({ nodeInfoList: mockNodeInfoList });

    renderRhAppNode();

    const selects = screen.getAllByRole('combobox');
    const appSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test App 1');
    });
    fireEvent.change(appSelect!, { target: { value: 'app1' } });

    await waitFor(() => {
      expect(screen.getByTestId('handle-image-0')).toBeInTheDocument();
      expect(screen.getByTestId('handle-image-1')).toBeInTheDocument();
    });
  });

  // Test 8: renders no extra image handles when IMAGE fields <= 1
  it('renders no extra image handles when IMAGE fields <= 1', async () => {
    const mockNodeInfoList = [
      { nodeId: 'node1', nodeName: 'Img1', fieldName: 'image1', fieldValue: '', fieldType: 'IMAGE' },
    ];
    mockFetchRhAppNodeInfo.mockResolvedValue({ nodeInfoList: mockNodeInfoList });

    renderRhAppNode();

    const selects = screen.getAllByRole('combobox');
    const appSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test App 1');
    });
    fireEvent.change(appSelect!, { target: { value: 'app1' } });

    await waitFor(() => {
      expect(screen.queryByTestId('handle-image-0')).not.toBeInTheDocument();
    });
  });

  // Test 9: renders multi-image grid when outputUrls has multiple URLs
  it('renders multi-image grid when outputUrls has multiple URLs', async () => {
    renderRhAppNode({
      configMode: false,
      outputUrls: ['url1.png', 'url2.png'],
      outputUrl: 'url1.png',
    });

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });

  // Test 10: renders loading spinner
  it('renders loading spinner', () => {
    renderRhAppNode({
      loading: true,
    });

    expect(screen.getByText('运行中...')).toBeInTheDocument();
  });

  // Test 11: renders error message
  it('renders error message', () => {
    renderRhAppNode({
      configMode: false,
      errorMessage: 'something failed',
    });

    // Error appears in both BaseNode mock div and component preview span
    const errorElements = screen.getAllByText('something failed');
    expect(errorElements.length).toBeGreaterThan(0);
  });

  // Test 12: typing in STRING textarea updates nodeInfoList
  it('typing in STRING textarea updates nodeInfoList', async () => {
    const mockNodeInfoList = [
      {
        nodeId: 'node1',
        nodeName: 'Prompt',
        fieldName: 'prompt_text',
        fieldValue: 'default prompt',
        fieldType: 'STRING',
      },
    ];
    mockFetchRhAppNodeInfo.mockResolvedValue({ nodeInfoList: mockNodeInfoList });

    renderRhAppNode();

    const selects = screen.getAllByRole('combobox');
    const appSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test App 1');
    });
    fireEvent.change(appSelect!, { target: { value: 'app1' } });

    await waitFor(() => {
      const textareas = screen.getAllByRole('textbox');
      expect(textareas.length).toBeGreaterThan(0);
    });

    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[0]!, { target: { value: 'new prompt text' } });

    await waitFor(() => {
      expect(mockUpdateNodeData).toHaveBeenCalled();
    });
  });

  // Test 13: execute button triggers validation
  it('execute button triggers validation - no appId shows error', async () => {
    renderRhAppNode({
      config: { appId: '', nodeInfoList: [] },
    });

    const buttons = screen.getAllByRole('button');
    const executeButton = buttons.find((btn) => btn.textContent === '▶ 运行');
    expect(executeButton).toBeDefined();

    fireEvent.click(executeButton!);

    await waitFor(() => {
      expect(mockUpdateNodeData).toHaveBeenCalledWith('rh1', expect.objectContaining({ errorMessage: '请先选择 APP' }));
    });
  });

  // Test 14: execute button with appId triggers execution
  it('execute button with appId triggers execution', async () => {
    mockExecuteRhAppNode.mockResolvedValue(undefined);

    renderRhAppNode({
      config: { appId: 'app1', nodeInfoList: [] },
    });

    const buttons = screen.getAllByRole('button');
    const executeButton = buttons.find((btn) => btn.textContent === '▶ 运行');
    expect(executeButton).toBeDefined();

    fireEvent.click(executeButton!);

    await waitFor(() => {
      expect(mockExecuteRhAppNode).toHaveBeenCalled();
    });
  });
});
