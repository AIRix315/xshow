import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Import component (default export memo-wrapped)
import RhWfNodeComponent from './RhWfNode';

// ============================================
// MOCKS
// ============================================

const mockUpdateNodeData = vi.fn();
const mockFetchRhWorkflowJson = vi.fn();
const mockParseRhWorkflowNodes = vi.fn();
const mockExecuteRhWorkflowApi = vi.fn();
const mockUploadFileToRunningHub = vi.fn();

const mockWorkflows = [
  { id: 'wf1', name: 'Test Workflow 1' },
  { id: 'wf2', name: 'Test Workflow 2' },
];

const mockApiKey = 'test-api-key';

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
        runninghubWorkflows: mockWorkflows,
        runninghubApiKey: mockApiKey,
      },
    };
    return selector(state);
  },
}));

vi.mock('@/api/rhApi', () => ({
  fetchRhWorkflowJson: (...args: any[]) => mockFetchRhWorkflowJson(...args),
  parseRhWorkflowNodes: (...args: any[]) => mockParseRhWorkflowNodes(...args),
  executeRhWorkflowApi: (...args: any[]) => mockExecuteRhWorkflowApi(...args),
  uploadFileToRunningHub: (...args: any[]) => mockUploadFileToRunningHub(...args),
}));

vi.mock('@/utils/connectedInputs', () => ({
  getConnectedInputs: vi.fn(() => ({ images: [], videos: [], audio: [], text: null, textItems: [], model3d: null })),
  getInputsByHandle: vi.fn(() => ({})),
}));

vi.mock('@/utils/zipExtractor', () => ({
  extractZipContents: vi.fn(),
  classifyMedia: vi.fn(),
}));

vi.mock('./BaseNode', () => ({
  default: ({ children, title, ...props }: any) => (
    <div data-testid="base-node" data-title={title} {...props}>{children}</div>
  ),
}));

// ============================================
// RENDER HELPER
// ============================================

function renderRhWfNode(overrides: Record<string, unknown> = {}) {
  const defaultData = {
    label: 'RhWf',
    configMode: true,
    config: { workflowId: '', workflowJson: '' },
    loading: false,
    progress: 0,
    outputUrl: '',
    textOutput: '',
    errorMessage: '',
    nodeValues: {},
    ...overrides,
  };
  return render(
    <RhWfNodeComponent
      id="wf1"
      data={defaultData}
      selected={false}
      {...({} as any)}
    />
  );
}

// ============================================
// TESTS
// ============================================

describe('RhWfNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: renders with no Workflow selected
  it('renders with no Workflow selected', () => {
    renderRhWfNode();
    // Should show the "选择 Workflow" dropdown
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
    // Check for the placeholder option
    expect(screen.getByText('— 选择 Workflow —')).toBeInTheDocument();
  });

  // Test 2: renders workflow dropdown and workflow list
  it('renders workflow dropdown with available workflows', () => {
    renderRhWfNode();

    // Should show both workflows from the mock
    expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
    expect(screen.getByText('Test Workflow 2')).toBeInTheDocument();
  });

  // Test 3: selecting Workflow triggers fetch+parse
  it('selecting Workflow triggers fetch+parse', async () => {
    mockFetchRhWorkflowJson.mockResolvedValue('{}');
    mockParseRhWorkflowNodes.mockReturnValue([]);

    renderRhWfNode();

    const selects = screen.getAllByRole('combobox');
    // The Workflow selection select should be one of them
    const wfSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test Workflow 1');
    });
    expect(wfSelect).toBeDefined();

    // Select wf1
    fireEvent.change(wfSelect!, { target: { value: 'wf1' } });

    // Wait for the async operation
    await waitFor(() => {
      expect(mockFetchRhWorkflowJson).toHaveBeenCalledWith(mockApiKey, 'wf1');
    });

    await waitFor(() => {
      expect(mockParseRhWorkflowNodes).toHaveBeenCalled();
    });
  });

  // Test 4: renders parsed node editors
  it('renders parsed node editors', async () => {
    const mockParsedNodes = [
      {
        nodeId: '6',
        classType: 'CLIPTextEncode',
        inputs: {
          text: { name: 'text', value: '', type: 'STRING' },
        },
      },
    ];
    mockFetchRhWorkflowJson.mockResolvedValue('{}');
    mockParseRhWorkflowNodes.mockReturnValue(mockParsedNodes);

    renderRhWfNode();

    const selects = screen.getAllByRole('combobox');
    const wfSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test Workflow 1');
    });
    fireEvent.change(wfSelect!, { target: { value: 'wf1' } });

    await waitFor(() => {
      // Should show the classType label
      expect(screen.getByText(/CLIPTextEncode/)).toBeInTheDocument();
    });

    // Should render an input element for the text field
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
  });

  // Test 5: typing in node field updates nodeValues
  it('typing in node field updates nodeValues', async () => {
    const mockParsedNodes = [
      {
        nodeId: '6',
        classType: 'CLIPTextEncode',
        inputs: {
          text: { name: 'text', value: '', type: 'STRING' },
        },
      },
    ];
    mockFetchRhWorkflowJson.mockResolvedValue('{}');
    mockParseRhWorkflowNodes.mockReturnValue(mockParsedNodes);

    renderRhWfNode();

    const selects = screen.getAllByRole('combobox');
    const wfSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test Workflow 1');
    });
    fireEvent.change(wfSelect!, { target: { value: 'wf1' } });

    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
    });

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: 'new prompt text' } });

    await waitFor(() => {
      expect(mockUpdateNodeData).toHaveBeenCalled();
    });
  });

  // Test 6: renders image handles when IMAGE fields > 2
  it('renders image handles when IMAGE fields > 2', async () => {
    const mockParsedNodes = [
      {
        nodeId: '6',
        classType: 'LoadImage',
        inputs: {
          image: { name: 'image', value: '', type: 'IMAGE' },
        },
      },
      {
        nodeId: '7',
        classType: 'LoadImage',
        inputs: {
          image: { name: 'image', value: '', type: 'IMAGE' },
        },
      },
      {
        nodeId: '8',
        classType: 'LoadImage',
        inputs: {
          image: { name: 'image', value: '', type: 'IMAGE' },
        },
      },
    ];
    mockFetchRhWorkflowJson.mockResolvedValue('{}');
    mockParseRhWorkflowNodes.mockReturnValue(mockParsedNodes);

    renderRhWfNode();

    const selects = screen.getAllByRole('combobox');
    const wfSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test Workflow 1');
    });
    fireEvent.change(wfSelect!, { target: { value: 'wf1' } });

    await waitFor(() => {
      expect(screen.getByTestId('handle-image-0')).toBeInTheDocument();
      expect(screen.getByTestId('handle-image-1')).toBeInTheDocument();
      expect(screen.getByTestId('handle-image-2')).toBeInTheDocument();
    });
  });

  // Test 7: renders no extra image handles when IMAGE fields <= 2
  it('renders no extra image handles when IMAGE fields <= 2', async () => {
    const mockParsedNodes = [
      {
        nodeId: '6',
        classType: 'LoadImage',
        inputs: {
          image: { name: 'image', value: '', type: 'IMAGE' },
        },
      },
      {
        nodeId: '7',
        classType: 'LoadImage',
        inputs: {
          image: { name: 'image', value: '', type: 'IMAGE' },
        },
      },
    ];
    mockFetchRhWorkflowJson.mockResolvedValue('{}');
    mockParseRhWorkflowNodes.mockReturnValue(mockParsedNodes);

    renderRhWfNode();

    const selects = screen.getAllByRole('combobox');
    const wfSelect = selects.find((select) => {
      const options = within(select).getAllByRole('option');
      return options.some((opt) => opt.textContent === 'Test Workflow 1');
    });
    fireEvent.change(wfSelect!, { target: { value: 'wf1' } });

    await waitFor(() => {
      expect(screen.queryByTestId('handle-image-0')).not.toBeInTheDocument();
    });
  });

  // Test 8: execute button calls executeRhWorkflowApi
  it('execute button calls executeRhWorkflowApi', async () => {
    mockExecuteRhWorkflowApi.mockResolvedValue({ outputUrl: 'http://example.com/output.png' });

    renderRhWfNode({
      config: { workflowId: 'wf1', workflowJson: '{}' },
      nodeValues: {
        '6': { text: 'test prompt' },
      },
    });

    const buttons = screen.getAllByRole('button');
    const executeButton = buttons.find((btn) => btn.textContent?.includes('执行'));
    expect(executeButton).toBeDefined();

    fireEvent.click(executeButton!);

    await waitFor(() => {
      expect(mockExecuteRhWorkflowApi).toHaveBeenCalled();
    });
  });

  // Test 9: renders loading spinner
  it('renders loading spinner', () => {
    renderRhWfNode({
      loading: true,
    });

    expect(screen.getByText('执行中...')).toBeInTheDocument();
  });

  // Test 10: renders error message
  it('renders error message', () => {
    renderRhWfNode({
      configMode: false,
      errorMessage: 'something failed',
    });

    expect(screen.getByText('something failed')).toBeInTheDocument();
  });

  // Test 11: renders output image
  it('renders output image', () => {
    renderRhWfNode({
      configMode: false,
      outputUrl: 'http://example.com/test.png',
    });

    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThan(0);
  });

  // Test 12: renders video output
  it('renders video output', () => {
    renderRhWfNode({
      configMode: false,
      outputUrl: 'http://example.com/test.mp4',
      config: { workflowId: 'wf1', workflowJson: '{}', outputType: 'video' },
    });

    // Video element exists with correct src
    const videoEl = document.querySelector('video[src="http://example.com/test.mp4"]');
    expect(videoEl).toBeInTheDocument();
  });
});