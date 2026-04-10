// Ref: §3.2 + §6.14 — useTransitResources 测试
import { describe, it, expect, beforeEach } from 'vitest';
import { useTransitResources } from './useTransitResources';
import type { TransitResource } from '@/types';

function makeResource(id: string, type: TransitResource['type'] = 'image'): TransitResource {
  return {
    id,
    url: `https://example.com/${id}.${type === 'text' ? 'txt' : type}`,
    type,
    timestamp: Date.now(),
    pageUrl: 'https://example.com/page',
    pageTitle: 'Test Page',
    isFavorite: false,
  };
}

describe('useTransitResources', () => {
  beforeEach(() => {
    useTransitResources.setState({ resources: [] });
  });

  describe('addResource', () => {
    it('adds a resource to the list', () => {
      const resource = makeResource('r1');
      useTransitResources.getState().addResource(resource);
      expect(useTransitResources.getState().resources).toHaveLength(1);
      expect(useTransitResources.getState().resources[0]!.id).toBe('r1');
    });

    it('prepends new resources (newest first)', () => {
      const r1 = makeResource('r1');
      const r2 = makeResource('r2');
      useTransitResources.getState().addResource(r1);
      useTransitResources.getState().addResource(r2);
      expect(useTransitResources.getState().resources[0]!.id).toBe('r2');
    });

    it('deduplicates by id', () => {
      const r1 = makeResource('r1');
      const r1Updated = { ...r1, url: 'https://new.url' };
      useTransitResources.getState().addResource(r1);
      useTransitResources.getState().addResource(r1Updated);
      expect(useTransitResources.getState().resources).toHaveLength(1);
      expect(useTransitResources.getState().resources[0]!.url).toBe('https://new.url');
    });
  });

  describe('removeResource', () => {
    it('removes a resource by id', () => {
      const r1 = makeResource('r1');
      const r2 = makeResource('r2');
      useTransitResources.getState().addResource(r1);
      useTransitResources.getState().addResource(r2);
      useTransitResources.getState().removeResource('r1');
      expect(useTransitResources.getState().resources).toHaveLength(1);
      expect(useTransitResources.getState().resources[0]!.id).toBe('r2');
    });

    it('does nothing if id not found', () => {
      const r1 = makeResource('r1');
      useTransitResources.getState().addResource(r1);
      useTransitResources.getState().removeResource('nonexistent');
      expect(useTransitResources.getState().resources).toHaveLength(1);
    });
  });

  describe('toggleFavorite', () => {
    it('toggles isFavorite from false to true', () => {
      const r1 = makeResource('r1');
      useTransitResources.getState().addResource(r1);
      useTransitResources.getState().toggleFavorite('r1');
      expect(useTransitResources.getState().resources[0]!.isFavorite).toBe(true);
    });

    it('toggles isFavorite from true to false', () => {
      const r1 = { ...makeResource('r1'), isFavorite: true };
      useTransitResources.getState().addResource(r1);
      useTransitResources.getState().toggleFavorite('r1');
      expect(useTransitResources.getState().resources[0]!.isFavorite).toBe(false);
    });

    it('does nothing if id not found', () => {
      const r1 = makeResource('r1');
      useTransitResources.getState().addResource(r1);
      useTransitResources.getState().toggleFavorite('nonexistent');
      expect(useTransitResources.getState().resources).toHaveLength(1);
    });
  });

  describe('clearNonFavorites', () => {
    it('removes all non-favorite resources', () => {
      const r1 = { ...makeResource('r1'), isFavorite: true };
      const r2 = makeResource('r2');
      const r3 = { ...makeResource('r3', 'video'), isFavorite: true };
      const r4 = makeResource('r4', 'audio');
      useTransitResources.getState().addResource(r1);
      useTransitResources.getState().addResource(r2);
      useTransitResources.getState().addResource(r3);
      useTransitResources.getState().addResource(r4);
      useTransitResources.getState().clearNonFavorites();
      expect(useTransitResources.getState().resources).toHaveLength(2);
      const ids = useTransitResources.getState().resources.map((r) => r.id);
      expect(ids).toContain('r1');
      expect(ids).toContain('r3');
    });

    it('keeps all resources if all are favorites', () => {
      const r1 = { ...makeResource('r1'), isFavorite: true };
      const r2 = { ...makeResource('r2'), isFavorite: true };
      useTransitResources.getState().addResource(r1);
      useTransitResources.getState().addResource(r2);
      useTransitResources.getState().clearNonFavorites();
      expect(useTransitResources.getState().resources).toHaveLength(2);
    });

    it('removes all if none are favorites', () => {
      useTransitResources.getState().addResource(makeResource('r1'));
      useTransitResources.getState().addResource(makeResource('r2'));
      useTransitResources.getState().clearNonFavorites();
      expect(useTransitResources.getState().resources).toHaveLength(0);
    });
  });
});