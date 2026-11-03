import { describe, expect, it } from 'vitest';
import { fixedClock, offsetClock, resolveClock, resolveSimOffset } from './clock';

describe('fixedClock', () => {
  it('never moves', () => {
    const clock = fixedClock(1_000);
    expect(clock.now()).toBe(1_000);
    expect(clock.now()).toBe(1_000);
  });
});

describe('offsetClock', () => {
  it('shifts its base', () => {
    expect(offsetClock(fixedClock(1_000), 500).now()).toBe(1_500);
    expect(offsetClock(fixedClock(1_000), -250).now()).toBe(750);
  });
});

describe('resolveSimOffset', () => {
  it('reads the offset from the query string', () => {
    expect(resolveSimOffset('?simOffset=90000')).toBe(90_000);
  });

  it('defaults to zero when absent or unparseable', () => {
    expect(resolveSimOffset('')).toBe(0);
    expect(resolveSimOffset('?simOffset=')).toBe(0);
    expect(resolveSimOffset('?simOffset=soon')).toBe(0);
  });
});

describe('resolveClock', () => {
  const base = fixedClock(10_000);

  it('uses the base clock when nothing is set', () => {
    expect(resolveClock('', base).now()).toBe(10_000);
  });

  it('shifts the clock for simOffset', () => {
    expect(resolveClock('?simOffset=5000', base).now()).toBe(15_000);
  });

  it('pins the clock for simTime, which is what makes e2e deterministic', () => {
    expect(resolveClock('?simTime=7200000', base).now()).toBe(7_200_000);
  });

  it('prefers an absolute simTime over a relative simOffset', () => {
    expect(resolveClock('?simTime=7200000&simOffset=5000', base).now()).toBe(7_200_000);
  });

  it('ignores values that are not numbers', () => {
    expect(resolveClock('?simTime=later', base).now()).toBe(10_000);
  });
});
