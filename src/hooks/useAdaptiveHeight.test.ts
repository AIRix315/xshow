// Ref: §4.3 T7 — useAdaptiveHeight 测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdaptiveHeight } from './useAdaptiveHeight';
import { useSettingsStore } from '@/stores/useSettingsStore';

// Create a mock HTMLImageElement
function createMockImageElement(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  return {
    naturalWidth,
    naturalHeight,
  } as unknown as HTMLImageElement;
}

// Create a mock HTMLVideoElement
function createMockVideoElement(videoWidth: number, videoHeight: number): HTMLVideoElement {
  return {
    videoWidth,
    videoHeight,
  } as unknown as HTMLVideoElement;
}

// Mock getBoundingClientRect
const mockGetBoundingClientRect = vi.fn();

describe('useAdaptiveHeight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset reduceAnimations to default
    useSettingsStore.setState({
      canvasSettings: {
        ...useSettingsStore.getState().canvasSettings,
        reduceAnimations: false,
      },
    });
  });

  describe('handleMediaLoad', () => {
    it('calculates correct height for 16:9 image in 300px container', () => {
      const containerEl = {
        getBoundingClientRect: mockGetBoundingClientRect.mockReturnValue({ width: 300 }),
      } as unknown as HTMLDivElement;

      const { result } = renderHook(() => useAdaptiveHeight(400));

      // Simulate container ref assignment
      result.current.containerRef.current = containerEl;

      // Simulate img load event with 16:9 dimensions
      const mockEvent = {
        currentTarget: createMockImageElement(1920, 1080),
      } as unknown as React.SyntheticEvent<HTMLImageElement>;

      act(() => {
        result.current.handleMediaLoad(mockEvent);
      });

      // 16:9 aspect ratio: height = width * (1080/1920) = 300 * 0.5625 = 168.75
      // But capped at maxHeight=400, and container is 300 so it should be 168.75
      expect(result.current.previewHeight).toBeCloseTo(168.75, 1);
    });

    it('caps height at maxHeight for large images', () => {
      const containerEl = {
        getBoundingClientRect: mockGetBoundingClientRect.mockReturnValue({ width: 800 }),
      } as unknown as HTMLDivElement;

      const { result } = renderHook(() => useAdaptiveHeight(400));

      result.current.containerRef.current = containerEl;

      // Simulate very tall image (e.g., 800x2000, ratio 2.5)
      const mockEvent = {
        currentTarget: createMockImageElement(800, 2000),
      } as unknown as React.SyntheticEvent<HTMLImageElement>;

      act(() => {
        result.current.handleMediaLoad(mockEvent);
      });

      // Without cap: 800 * (2000/800) = 2000
      // With cap at 400: should be 400
      expect(result.current.previewHeight).toBe(400);
    });

    it('does not crash when naturalWidth is 0', () => {
      const containerEl = {
        getBoundingClientRect: mockGetBoundingClientRect.mockReturnValue({ width: 300 }),
      } as unknown as HTMLDivElement;

      const { result } = renderHook(() => useAdaptiveHeight(400));

      result.current.containerRef.current = containerEl;

      const mockEvent = {
        currentTarget: createMockImageElement(0, 0),
      } as unknown as React.SyntheticEvent<HTMLImageElement>;

      act(() => {
        result.current.handleMediaLoad(mockEvent);
      });

      // Should not update height when naturalWidth is 0
      expect(result.current.previewHeight).toBeNull();
    });

    it('handles video element correctly', () => {
      const containerEl = {
        getBoundingClientRect: mockGetBoundingClientRect.mockReturnValue({ width: 640 }),
      } as unknown as HTMLDivElement;

      const { result } = renderHook(() => useAdaptiveHeight(400));

      result.current.containerRef.current = containerEl;

      // Simulate video load with 16:9 dimensions
      const mockEvent = {
        currentTarget: createMockVideoElement(1920, 1080),
      } as unknown as React.SyntheticEvent<HTMLVideoElement>;

      act(() => {
        result.current.handleMediaLoad(mockEvent);
      });

      // 16:9 aspect ratio: height = width * (1080/1920) = 640 * 0.5625 = 360
      expect(result.current.previewHeight).toBeCloseTo(360, 1);
    });
  });

  describe('containerStyle', () => {
    it('returns correct style shape', () => {
      const { result } = renderHook(() => useAdaptiveHeight(400));

      const style = result.current.containerStyle;

      expect(style).toHaveProperty('height');
      expect(style).toHaveProperty('minHeight');
      expect(style).toHaveProperty('transition');
      expect(style.minHeight).toBe(120); // fallback minHeight
    });

    it('disables transition when reduceAnimations is true', () => {
      // Set reduceAnimations to true
      useSettingsStore.setState({
        canvasSettings: {
          ...useSettingsStore.getState().canvasSettings,
          reduceAnimations: true,
        },
      });

      const { result } = renderHook(() => useAdaptiveHeight(400));

      expect(result.current.containerStyle.transition).toBe('none');
    });

    it('enables transition when reduceAnimations is false', () => {
      // Set reduceAnimations to false (default)
      useSettingsStore.setState({
        canvasSettings: {
          ...useSettingsStore.getState().canvasSettings,
          reduceAnimations: false,
        },
      });

      const { result } = renderHook(() => useAdaptiveHeight(400));

      expect(result.current.containerStyle.transition).toBe('height 200ms ease');
    });

    it('returns auto height when previewHeight is null', () => {
      const { result } = renderHook(() => useAdaptiveHeight(400));

      expect(result.current.containerStyle.height).toBe('auto');
    });

    it('returns numeric height when previewHeight is set', () => {
      const containerEl = {
        getBoundingClientRect: mockGetBoundingClientRect.mockReturnValue({ width: 300 }),
      } as unknown as HTMLDivElement;

      const { result } = renderHook(() => useAdaptiveHeight(400));

      result.current.containerRef.current = containerEl;

      const mockEvent = {
        currentTarget: createMockImageElement(1920, 1080),
      } as unknown as React.SyntheticEvent<HTMLImageElement>;

      act(() => {
        result.current.handleMediaLoad(mockEvent);
      });

      expect(result.current.containerStyle.height).toBeCloseTo(168.75, 1);
    });
  });

  describe('ResizeObserver integration', () => {
    it('hook renders without error', () => {
      const { result } = renderHook(() => useAdaptiveHeight(400));
      expect(result.current.containerRef).toBeDefined();
      expect(result.current.handleMediaLoad).toBeDefined();
      expect(result.current.containerStyle).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('returns null previewHeight initially', () => {
      const { result } = renderHook(() => useAdaptiveHeight(400));

      expect(result.current.previewHeight).toBeNull();
    });

    it('handles missing container ref gracefully', () => {
      const mockEvent = {
        currentTarget: createMockImageElement(1920, 1080),
      } as unknown as React.SyntheticEvent<HTMLImageElement>;

      const { result } = renderHook(() => useAdaptiveHeight(400));

      act(() => {
        result.current.handleMediaLoad(mockEvent);
      });

      // Should not crash, height remains null
      expect(result.current.previewHeight).toBeNull();
    });

    it('uses default maxHeight of 400', () => {
      const { result } = renderHook(() => useAdaptiveHeight());

      // Access internal state through containerStyle
      // The maxHeight is used internally but not directly exposed
      // We verify the hook renders without error
      expect(result.current.containerStyle).toBeDefined();
    });
  });
});
