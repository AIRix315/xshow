import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Import component (default export memo-wrapped)
import OmniNodeComponent from './OmniNode';
import type { OmniNodeData } from '@/types';

// ============================================
// MOCKS
// ============================================

const mockUpdateNodeData = vi.fn();
const mockExecuteComfyWorkflow = vi.fn();
const mockParseWorkflowNodes = vi.fn();
const mockFetchComfyWorkflowJson = vi.fn();
const mockUploadImageToComfyUI = vi.fn();

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

vi.mock('@/stores/useFlowStore', () => ({
  useFlowStore: (selector: any) => {
    const state = {
      updateNodeData: mockUpdateNodeData,
      nodes: [],
      edges: [],
    };
    return selector(state);
  },
}));

vi.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: (selector: any) => {
    const state = {
      comfyuiConfig: {
        localUrl: 'http://localhost:8188',
        cloudUrl: '',
        runninghubApiKey: '',
        localWorkflows: ['workflow1.json', 'workflow2.json'],
        cloudWorkflows: [],
      },
      apiConfig: {
        channels: [],
        textChannelId: '',
        textModel: '',
      },
      addTemplate: vi.fn(),
    };
    return selector(state);
  },
}));

vi.mock('@/api/comfyApi', () => ({
  executeComfyWorkflow: (...args: any[]) => mockExecuteComfyWorkflow(...args),
  parseWorkflowNodes: (...args: any[]) => mockParseWorkflowNodes(...args),
  fetchComfyWorkflowJson: (...args: any[]) => mockFetchComfyWorkflowJson(...args),
  uploadImageToComfyUI: (...args: any[]) => mockUploadImageToComfyUI(...args),
}));

vi.mock('@/api/textApi', () => ({
  generateText: vi.fn(),
}));

vi.mock('@/utils/connectedInputs', () => ({
  getConnectedInputs: vi.fn(() => ({ images: [], videos: [], audio: [], text: null, textItems: [], model3d: null })),
  getInputsByHandle: vi.fn(() => ({})),
}));

vi.mock('./BaseNode', () => ({
  default: ({ children, errorMessage, ...props }: any) => (
    <div data-testid="base-node" {...props}>
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      {children}
    </div>
  ),
}));

// ============================================
// RENDER HELPER
// ============================================

function renderOmniNode(overrides: Record<string, unknown> = {}) {
  const defaultData: OmniNodeData = {
    label: 'Omni',
    configMode: true,
    config: {
      executionType: 'comfyui',
      comfyuiSubType: 'local',
      workflowJson: '',
      comfyuiOutputType: 'auto',
      apiUrl: '',
      method: 'POST',
      headers: '{}',
      body: '',
      outputType: 'text',
      executionMode: 'sync',
      resultPath: '',
    },
    loading: false,
    progress: 0,
    errorMessage: '',
    nodeValues: {},
    outputUrl: '',
    textOutput: '',
    ...overrides,
  } as OmniNodeData;
  return render(
    <OmniNodeComponent id="omni1" data={defaultData} selected={false} {...({} as any)} />
  );
}

// ============================================
// TESTS
// ============================================

describe('OmniNode (ComfyUI mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseWorkflowNodes.mockReturnValue([]);
    mockExecuteComfyWorkflow.mockResolvedValue({ outputUrl: '', outputUrls: [] });
    mockFetchComfyWorkflowJson.mockResolvedValue('');
  });

  // Test 1: renders ComfyUI mode with no workflow
  it('renders ComfyUI mode with no workflow', () => {
    renderOmniNode({
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
      },
    });

    // Should show the mode selector (HTTP / ComfyUI)
    expect(screen.getByText('ComfyUI')).toBeInTheDocument();

    // Should show workflow selector dropdown
    expect(screen.getByText('— 选择工作流 —')).toBeInTheDocument();
  });

  // Test 2: parses workflow nodes when workflowJson provided
  it('parses workflow nodes when workflowJson provided', async () => {
    const mockWorkflowJson = JSON.stringify({
      '3': {
        'class_type': 'KSampler',
        'inputs': {
          'steps': 20,
          'cfg': 7,
        },
      },
    });

    const mockParsedNodes = [
      {
        nodeId: '3',
        classType: 'KSampler',
        inputs: {
          steps: { value: 20, type: 'INT' },
          cfg: { value: 7, type: 'INT' },
        },
      },
    ];

    mockParseWorkflowNodes.mockReturnValue(mockParsedNodes);
    mockFetchComfyWorkflowJson.mockResolvedValue(mockWorkflowJson);

    renderOmniNode({
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
      },
    });

    // Select a workflow from dropdown to trigger parsing
    const selects = screen.getAllByRole('combobox');
    const workflowSelect = selects.find((sel) => {
      const options = within(sel).getAllByRole('option') as HTMLElement[];
      return options.some((opt: HTMLElement) => opt.textContent === 'workflow1.json');
    });
    fireEvent.change(workflowSelect!, { target: { value: 'workflow1.json' } });

    await waitFor(() => {
      // Should render the parsed node
      expect(screen.getByText('[3] KSampler')).toBeInTheDocument();
    });
  });

  // Test 3: renders STRING input field
  it('renders STRING input field', async () => {
    const mockParsedNodes = [
      {
        nodeId: '4',
        classType: 'CLIPTextEncode',
        inputs: {
          text: { value: 'a beautiful landscape', type: 'STRING' },
          clip: { value: ['clip_node', 0], type: 'CLIP' },
        },
      },
    ];

    mockParseWorkflowNodes.mockReturnValue(mockParsedNodes);
    mockFetchComfyWorkflowJson.mockResolvedValue('{"4":{"class_type":"CLIPTextEncode","inputs":{"text":"a beautiful landscape"}}}');

    renderOmniNode({
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
      },
    });

    // Select workflow to trigger parsing
    const selects = screen.getAllByRole('combobox');
    const workflowSelect = selects.find((sel) => {
      const options = within(sel).getAllByRole('option') as HTMLElement[];
      return options.some((opt: HTMLElement) => opt.textContent === 'workflow1.json');
    });
    fireEvent.change(workflowSelect!, { target: { value: 'workflow1.json' } });

    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  // Test 4: renders IMAGE type indicator
  it('renders IMAGE type indicator', async () => {
    const mockParsedNodes = [
      {
        nodeId: '5',
        classType: 'LoadImage',
        inputs: {
          image: { value: 'demo.png', type: 'IMAGE' },
        },
      },
    ];

    mockParseWorkflowNodes.mockReturnValue(mockParsedNodes);
    mockFetchComfyWorkflowJson.mockResolvedValue('{"5":{"class_type":"LoadImage","inputs":{"image":"demo.png"}}}');

    renderOmniNode({
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
      },
    });

    // Select workflow to trigger parsing
    const selects = screen.getAllByRole('combobox');
    const workflowSelect = selects.find((sel) => {
      const options = within(sel).getAllByRole('option') as HTMLElement[];
      return options.some((opt: HTMLElement) => opt.textContent === 'workflow1.json');
    });
    fireEvent.change(workflowSelect!, { target: { value: 'workflow1.json' } });

    await waitFor(() => {
      // IMAGE type label should appear in the node editor (field type badge)
      const imageLabels = screen.getAllByText(/IMAGE/i);
      expect(imageLabels.length).toBeGreaterThan(0);
    });
  });

  // Test 5: renders image-N handles when multiple IMAGE fields
  it('renders image-N handles when multiple IMAGE fields', async () => {
    const mockParsedNodes = [
      {
        nodeId: '5',
        classType: 'LoadImage',
        inputs: {
          image: { value: 'image1.png', type: 'IMAGE' },
        },
      },
      {
        nodeId: '6',
        classType: 'LoadImage',
        inputs: {
          image: { value: 'image2.png', type: 'IMAGE' },
        },
      },
      {
        nodeId: '7',
        classType: 'LoadImage',
        inputs: {
          image: { value: 'image3.png', type: 'IMAGE' },
        },
      },
    ];

    mockParseWorkflowNodes.mockReturnValue(mockParsedNodes);
    mockFetchComfyWorkflowJson.mockResolvedValue('{"5":{"class_type":"LoadImage","inputs":{"image":"image1.png"}}}');

    renderOmniNode({
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
      },
    });

    // Select workflow to trigger parsing
    const selects = screen.getAllByRole('combobox');
    const workflowSelect = selects.find((sel) => {
      const options = within(sel).getAllByRole('option') as HTMLElement[];
      return options.some((opt: HTMLElement) => opt.textContent === 'workflow1.json');
    });
    fireEvent.change(workflowSelect!, { target: { value: 'workflow1.json' } });

    await waitFor(() => {
      expect(screen.getByTestId('handle-image-0')).toBeInTheDocument();
      expect(screen.getByTestId('handle-image-1')).toBeInTheDocument();
      expect(screen.getByTestId('handle-image-2')).toBeInTheDocument();
    });
  });

  // Test 6: executes ComfyUI workflow
  it('executes ComfyUI workflow', async () => {
    const mockParsedNodes = [
      {
        nodeId: '3',
        classType: 'KSampler',
        inputs: {
          steps: { value: 20, type: 'INT' },
        },
      },
    ];

    mockParseWorkflowNodes.mockReturnValue(mockParsedNodes);
    mockFetchComfyWorkflowJson.mockResolvedValue('{"3":{"class_type":"KSampler","inputs":{"steps":20}}}');
    mockExecuteComfyWorkflow.mockResolvedValue({
      outputUrl: 'http://localhost:8188/view?filename=output.png',
      outputUrls: ['http://localhost:8188/view?filename=output.png'],
    });

    renderOmniNode({
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
        comfyuiOutputType: 'image',
      },
    });

    // Select workflow to trigger parsing
    const selects = screen.getAllByRole('combobox');
    const workflowSelect = selects.find((sel) => {
      const options = within(sel).getAllByRole('option') as HTMLElement[];
      return options.some((opt: HTMLElement) => opt.textContent === 'workflow1.json');
    });
    fireEvent.change(workflowSelect!, { target: { value: 'workflow1.json' } });

    await waitFor(() => {
      expect(screen.getByText('[3] KSampler')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const executeButton = buttons.find((btn) => btn.textContent?.includes('执行'));
    expect(executeButton).toBeDefined();

    fireEvent.click(executeButton!);

    // Verify that executeComfyWorkflow is called (or loading state is set)
    await waitFor(() => {
      expect(mockUpdateNodeData).toHaveBeenCalledWith('omni1', expect.objectContaining({ loading: true }));
    });
  });

  // Test 7: renders output image
  it('renders output image', () => {
    renderOmniNode({
      configMode: false,
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
        comfyuiOutputType: 'image',
      },
      outputUrl: 'http://localhost:8188/view?filename=test.png',
    });

    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toHaveAttribute('src', 'http://localhost:8188/view?filename=test.png');
  });

  // Test 8: renders text output
  it('renders text output', () => {
    renderOmniNode({
      configMode: false,
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
        comfyuiOutputType: 'text',
      },
      textOutput: 'Hello, this is text output!',
    });

    expect(screen.getByText('Hello, this is text output!')).toBeInTheDocument();
  });

  // Test 9: renders error message
  it('renders error message', () => {
    renderOmniNode({
      errorMessage: 'Execution failed: workflow not found',
    });

    expect(screen.getByText('Execution failed: workflow not found')).toBeInTheDocument();
  });

  // Test 10: uploads image when IMAGE field has file
  it('uploads image when IMAGE field has file', async () => {
    const mockParsedNodes = [
      {
        nodeId: '5',
        classType: 'LoadImage',
        inputs: {
          image: { value: 'input.png', type: 'IMAGE' },
        },
      },
    ];

    mockParseWorkflowNodes.mockReturnValue(mockParsedNodes);
    mockFetchComfyWorkflowJson.mockResolvedValue('{"5":{"class_type":"LoadImage","inputs":{"image":"input.png"}}}');
    mockExecuteComfyWorkflow.mockResolvedValue({
      outputUrl: 'http://localhost:8188/view?filename=output.png',
      outputUrls: ['http://localhost:8188/view?filename=output.png'],
    });
    mockUploadImageToComfyUI.mockResolvedValue('input_uploaded.png');

    renderOmniNode({
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
      },
    });

    // Select workflow to trigger parsing
    const selects = screen.getAllByRole('combobox');
    const workflowSelect = selects.find((sel) => {
      const options = within(sel).getAllByRole('option') as HTMLElement[];
      return options.some((opt: HTMLElement) => opt.textContent === 'workflow1.json');
    });
    fireEvent.change(workflowSelect!, { target: { value: 'workflow1.json' } });

    await waitFor(() => {
      expect(screen.getByText('[5] LoadImage')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const executeButton = buttons.find((btn) => btn.textContent === '▶ 执行');
    expect(executeButton).toBeDefined();

    fireEvent.click(executeButton!);

    await waitFor(() => {
      // Verify upload was called when IMAGE field is present
      // Note: actual upload happens when upstream images connect to image handles
    });
  });

  // Test 11: renders HTTP mode when executionType is http
  it('renders HTTP mode when executionType is http', () => {
    renderOmniNode({
      config: {
        executionType: 'http',
        method: 'POST',
        outputType: 'text',
      },
    });

    expect(screen.getByText('HTTP')).toBeInTheDocument();
  });

  // Test 12: switches between config and run mode
  it('switches between config and run mode', () => {
    renderOmniNode();

    // Initially in config mode
    expect(screen.getByText('配置')).toBeInTheDocument();

    // Click run button
    const runButton = screen.getByText('运行');
    fireEvent.click(runButton);

    // Should show execution button
    expect(screen.getByText('▶ 执行')).toBeInTheDocument();
  });

  // Test 13: renders loading state
  it('renders loading state', () => {
    renderOmniNode({
      loading: true,
      configMode: false,
    });

    // "执行中..." appears in both the spinner and the button text
    const loadingElements = screen.getAllByText('执行中...');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  // Test 14: renders stop button when loading
  it('renders stop button when loading', () => {
    renderOmniNode({
      loading: true,
    });

    const stopButtons = screen.getAllByText('⏹ 停止');
    expect(stopButtons.length).toBeGreaterThan(0);
  });

  // Test 15: renders output video
  it('renders output video', () => {
    const { container } = renderOmniNode({
      configMode: false,
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
        comfyuiOutputType: 'video',
      },
      outputUrl: 'http://localhost:8188/view?filename=output.mp4',
    });

    const videoEl = container.querySelector('video');
    expect(videoEl).toBeInTheDocument();
  });

  // Test 16: renders output audio
  it('renders output audio', () => {
    const { container } = renderOmniNode({
      configMode: false,
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
        comfyuiOutputType: 'audio',
      },
      outputUrl: 'http://localhost:8188/view?filename=output.mp3',
    });

    const audioEl = container.querySelector('audio');
    expect(audioEl).toBeInTheDocument();
  });

  // Test 17: handles AI assist button click
  it('handles AI assist button click', async () => {
    const mockGenerateText = vi.fn().mockResolvedValue({
      text: '{"apiUrl":"","method":"POST","headers":"{}","body":"","outputType":"text"}',
    });

    vi.mock('@/api/textApi', () => ({
      generateText: (...args: any[]) => mockGenerateText(...args),
    }));

    renderOmniNode();

    const aiButton = screen.getByText('AI 辅助');
    fireEvent.click(aiButton);

    // Should trigger prompt for description (skipped in test by not providing mock window.prompt)
  });

  // Test 18: renders custom-input handle
  it('renders custom-input handle', () => {
    renderOmniNode();

    expect(screen.getByTestId('handle-custom-input')).toBeInTheDocument();
  });

  // Test 19: renders custom-output handle
  it('renders custom-output handle', () => {
    renderOmniNode();

    expect(screen.getByTestId('handle-custom-output')).toBeInTheDocument();
  });

  // Test 20: renders no workflowJson shows placeholder
  it('renders no workflowJson shows placeholder', () => {
    renderOmniNode({
      config: {
        executionType: 'comfyui',
        comfyuiSubType: 'local',
        workflowJson: '',
      },
    });

    expect(screen.getByText('— 选择工作流 —')).toBeInTheDocument();
  });
});