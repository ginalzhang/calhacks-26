import { describe, expect, it, vi } from 'vitest';
import type { TrackingSample } from '../../src/shared/contracts';
import { drawMirroredPreview, SampleGate, SelectedHandContinuity, type AnchorResult } from '../../src/renderer/tracking';

const anchor = (x = 0.5, y = 0.5): AnchorResult => ({ valid: true, anchor: { x, y }, reason: 'valid' });
const invalid: AnchorResult = { valid: false, anchor: null, reason: 'multiple subjects' };
const sample = (frameId = 1, captureTimestamp = 100): TrackingSample => ({ generation: 4, frameId, captureTimestamp, mode: 'palm', valid: true, anchor: { x: 0.5, y: 0.5 }, qualityReason: 'valid', selectedHand: 'Left' });

describe('selected-hand continuity (synthetic, no identity claim)', () => {
  it('selects one model label and rejects ambiguity and other labels without transfer', () => {
    const hand = new SelectedHandContinuity();
    expect(hand.observe(anchor(), 'Left', 100, 100).valid).toBe(true);
    expect(hand.selectedHand).toBe('Left');
    expect(hand.observe(invalid, null, 110, 110).valid).toBe(false);
    expect(hand.observe(anchor(), 'Right', 120, 120).reason).toBe('different hand label');
    expect(hand.selectedHand).toBe('Left');
    expect(hand.observe(anchor(), null, 130, 130).valid).toBe(false);
    expect(hand.observe(anchor(), 'Left', 140, 140).valid).toBe(true);
  });
  it('rejects jumps exceeding .12 from the preceding valid anchor; invalids do not move that anchor', () => {
    const hand = new SelectedHandContinuity();
    hand.observe(anchor(0, 0), 'Left', 0, 0);
    expect(hand.observe(anchor(0.12, 0), 'Left', 10, 10).valid).toBe(true);
    expect(hand.observe(anchor(0.241, 0), 'Left', 20, 20).reason).toBe('hand anchor jump');
    expect(hand.observe(anchor(0.35, 0), 'Left', 30, 30).valid).toBe(false);
    expect(hand.observe(anchor(0.13, 0), 'Left', 40, 40).valid).toBe(true);
  });
  it('declares loss at 250ms without a new frame and requires explicit recent matching confirmation', () => {
    const hand = new SelectedHandContinuity(); hand.observe(anchor(), 'Left', 100, 100);
    expect(hand.expire(349.999)).toBe(false); expect(hand.expire(350)).toBe(true);
    expect(hand.expire(360)).toBe(false); expect(hand.confirm(360)).toBe(false);
    expect(hand.observe(anchor(0.9), 'Right', 370, 370).valid).toBe(false); expect(hand.confirm(370)).toBe(false);
    expect(hand.observe(anchor(0.9), 'Left', 380, 380).reason).toBe('confirm selected hand');
    expect(hand.confirm(630)).toBe(false);
    hand.observe(anchor(0.9), 'Left', 640, 640); expect(hand.confirm(650)).toBe(true);
    expect(hand.observe(anchor(0.91), 'Left', 660, 660).valid).toBe(true);
  });
  it('expires before processing a result that arrives after a gap, and cannot confirm an ambiguous frame', () => {
    const hand = new SelectedHandContinuity(); hand.observe(anchor(), 'Left', 100, 100);
    expect(hand.observe(anchor(), 'Left', 351, 351).reason).toBe('confirm selected hand');
    hand.observe(invalid, null, 360, 360); expect(hand.confirm(360)).toBe(false);
  });
  it('saved selections require confirmation and cannot silently choose another label', () => {
    const hand = new SelectedHandContinuity(); hand.setSelectedHand('Right');
    expect(hand.observe(anchor(), 'Left', 100, 100).reason).toBe('different hand label');
    expect(hand.confirm(100)).toBe(false);
    expect(hand.observe(anchor(), 'Right', 110, 110).reason).toBe('confirm selected hand');
    expect(hand.confirm(110)).toBe(true);
    hand.setSelectedHand(null); expect(hand.observe(anchor(), 'Left', 120, 120).valid).toBe(true);
  });
});

describe('stale inference and preview', () => {
  it('rejects stale, future, out-of-order, duplicate, replaced-generation and mode results', () => {
    const gate = new SampleGate();
    expect(gate.accept(sample(), 4, 'palm', 100)).toBe(true);
    expect(gate.accept(sample(), 4, 'palm', 101)).toBe(false);
    expect(gate.accept(sample(2, 100), 4, 'palm', 110)).toBe(false);
    expect(gate.accept(sample(2, 101), 5, 'palm', 110)).toBe(false);
    expect(gate.accept(sample(2, 101), 4, 'head', 110)).toBe(false);
    expect(gate.accept(sample(2, 101), 4, 'palm', 351)).toBe(false);
    expect(gate.accept(sample(2, 400), 4, 'palm', 399)).toBe(false);
    expect(gate.accept(sample(2, 101), 4, 'palm', 350.999)).toBe(true);
    expect(gate.accept(sample(3, NaN), 4, 'palm', 400)).toBe(false);
  });
  it('flips the preview canvas exactly once without changing the inference source', () => {
    const context = { save: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), restore: vi.fn() };
    const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
    drawMirroredPreview(canvas, video);
    expect(context.scale).toHaveBeenCalledExactlyOnceWith(-1, 1);
    expect(context.translate).toHaveBeenCalledExactlyOnceWith(640, 0);
    expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(video, 0, 0, 640, 480);
    expect(context.restore).toHaveBeenCalledOnce();
  });
});
