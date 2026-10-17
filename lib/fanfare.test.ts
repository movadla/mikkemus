import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boomForStreak, crowdForStreak, playBoom, playHitStreakSound, playStreakFanfare } from "./fanfare";

/** Just enough of Web Audio to count what a sound starts, and to throw if anything calls something that is not there. */
const counts = { osc: 0, noise: 0, brass: 0 };
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = (extra: object = {}) => ({ connect: (n: unknown) => n, disconnect() {}, ...extra });
class FakeContext {
  state = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = node();
  resume() { return Promise.resolve(); }
  createGain() { return node({ gain: param() }); }
  createOscillator() { counts.osc++; return node({ frequency: param(), detune: param(), type: "sine", start() {}, stop() {}, setPeriodicWave() {} }); }
  createBiquadFilter() { return node({ frequency: param(), Q: param(), gain: param(), type: "lowpass" }); }
  createBufferSource() { counts.noise++; return node({ buffer: null, loop: false, playbackRate: param(), start() {}, stop() {} }); }
  createConvolver() { return node({ buffer: null }); }
  createBuffer(_c: number, length: number) { return { getChannelData: () => new Float32Array(length), length, numberOfChannels: 1 }; }
  createWaveShaper() { return node({ curve: null, oversample: "none" }); }
  createPeriodicWave() { return {}; }
}

describe("the boom of a long run", () => {
  const w = globalThis as unknown as { window?: unknown };
  const before = w.window;
  beforeAll(() => {
    w.window = { AudioContext: FakeContext };
  });
  afterAll(() => {
    w.window = before;
  });
  const oscillatorsFor = (streak: number) => {
    counts.osc = 0;
    counts.noise = 0;
    playBoom(boomForStreak(streak));
    return { osc: counts.osc, noise: counts.noise };
  };

  it("leaves the first three darts of a run as they were", () => {
    for (const s of [1, 2, 3]) expect(boomForStreak(s).power).toBe(0);
    expect(boomForStreak(1).length).toBe(3);
    expect(boomForStreak(3).length).toBe(5);
    expect(boomForStreak(3).tailScale).toBeCloseTo(1.55, 6);
  });

  it("grows past the third dart, up to a ceiling", () => {
    expect(boomForStreak(4).power).toBe(1);
    expect(boomForStreak(8).power).toBe(5);
    expect(boomForStreak(12).power).toBe(9);
    expect(boomForStreak(40).power).toBe(9);
    expect(boomForStreak(8).tailScale!).toBeGreaterThan(boomForStreak(4).tailScale!);
  });

  it("starts more layers the longer the run: an echo of the hit every third step", () => {
    expect(oscillatorsFor(3)).toEqual({ osc: 4, noise: 1 }); // body, click, octave, knock + the crack
    expect(oscillatorsFor(5)).toEqual({ osc: 4, noise: 1 }); // power 2: no echo yet
    expect(oscillatorsFor(6)).toEqual({ osc: 5, noise: 2 }); // power 3: one echo
    expect(oscillatorsFor(9)).toEqual({ osc: 6, noise: 3 }); // power 6: two
    expect(oscillatorsFor(12)).toEqual({ osc: 7, noise: 4 }); // power 9: three
  });

  it("adds a rising brass chord from the fifth dart in a row", () => {
    counts.osc = 0;
    playHitStreakSound(4);
    const four = counts.osc;
    counts.osc = 0;
    playHitStreakSound(5);
    const five = counts.osc;
    expect(five).toBeGreaterThan(four); // four brass notes, two oscillators each
    expect(five - four).toBeGreaterThanOrEqual(8);
  });

  it("plays a fanfare that gets bigger every third dart in a row", () => {
    const voices = (run: number) => {
      counts.osc = 0;
      counts.noise = 0;
      playStreakFanfare(run);
      return { osc: counts.osc, noise: counts.noise };
    };
    const three = voices(3), six = voices(6), nine = voices(9), twelve = voices(12);
    expect(three.osc).toBe(10); // five brass notes, two oscillators each
    expect(six.osc).toBeGreaterThan(three.osc);
    expect(nine.osc).toBeGreaterThan(six.osc);
    expect(twelve.osc).toBeGreaterThan(nine.osc);
    expect(three.noise + six.noise).toBe(0); // the cymbal comes in at nine
    expect(nine.noise).toBe(1);
    expect(twelve.noise).toBe(1);
    expect(voices(15).osc).toBe(twelve.osc); // the same shape, lifted a tone and louder
  });

  it("gives the fanfare the third dart and the climbing chord the ones in between", () => {
    const osc = (s: number) => { counts.osc = 0; playHitStreakSound(s); return counts.osc; };
    // 6 is a fanfare dart: no stab from the boom itself. 7 has the stab on top of a heavier boom.
    expect(osc(7)).toBeGreaterThan(osc(6));
    expect(osc(5)).toBeGreaterThan(osc(4));
  });

  it("keeps growing the crowd past the top of its scale", () => {
    expect(crowdForStreak(3)).toEqual({ darkness: 3, volume: 4, density: 4, boost: 0 });
    expect(crowdForStreak(4).boost).toBe(1);
    expect(crowdForStreak(8).boost).toBe(5);
    expect(crowdForStreak(30).boost).toBe(8);
    expect(crowdForStreak(30).volume).toBe(4); // the scales themselves stop where they did
  });
});
