import type { RendererAudioCue } from "../renderer/simulationBridge";
import type { CardInstanceId, GameEvent, MatchState } from "../simulation/types";

export type AudioCueName =
  | "card.destroy"
  | "card.discard"
  | "card.draw"
  | "card.hover"
  | "card.play"
  | "clear-weather"
  | "horn"
  | "leader"
  | "match.loss"
  | "match.music"
  | "match.win"
  | "medic"
  | "muster"
  | "pass"
  | "redraw"
  | "round.draw"
  | "round.loss"
  | "round.start"
  | "round.win"
  | "scorch"
  | "slain-slash"
  | "spy"
  | "turn"
  | "ui.click"
  | "weather";

export type AudioSettings = {
  masterVolume: number;
  muted: boolean;
};

export type UiAudioCue = {
  cue: "ui.click";
};

export type CardHoverAudioCue = {
  cardInstanceId: CardInstanceId;
  cue: "card.hover";
};

export type AudioEngine = {
  beginMatch: (state: MatchState) => void;
  dispose: () => void;
  getSettings: () => AudioSettings;
  handleMatchState: (state: MatchState) => void;
  playCue: (cueName: AudioCueName) => void;
  playRendererCue: (cue: RendererAudioCue | CardHoverAudioCue | unknown) => void;
  setMasterVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  stopMatch: () => void;
};

type MatchMusic = {
  gain: GainNode;
  intervalId: number;
  nextStepAt: number;
  step: number;
};

const MUSIC_TEMPO_BPM = 136;
const MUSIC_STEP_SECONDS = 60 / MUSIC_TEMPO_BPM / 4;
const MUSIC_LOOKAHEAD_SECONDS = 0.34;
const MUSIC_GAIN_TARGET = 0.84;
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.84,
  muted: false,
};

export function createAudioEngine(root: HTMLElement, initialSettings: Partial<AudioSettings> = {}): AudioEngine {
  let settings = normalizeSettings({
    ...DEFAULT_AUDIO_SETTINGS,
    ...initialSettings,
  });
  let audioContext: AudioContext | undefined;
  let masterGain: GainNode | undefined;
  let matchMusic: MatchMusic | undefined;
  let lastMatchId: string | undefined;
  let lastEventSequence = Number.NEGATIVE_INFINITY;
  let latestMatchState: MatchState | undefined;

  const handleUiClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const control = target?.closest("button, input, select, textarea");

    if (!control || isDisabledControl(control)) {
      return;
    }

    playCue("ui.click");
  };

  root.addEventListener("click", handleUiClick);

  const engine: AudioEngine = {
    beginMatch(state) {
      lastMatchId = state.id;
      lastEventSequence = getLatestEventSequence(state);
      latestMatchState = state;
      syncMatchMusicFromState(state);
    },
    dispose() {
      root.removeEventListener("click", handleUiClick);
      stopMatchMusic();

      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close().catch(() => undefined);
      }
    },
    getSettings() {
      return { ...settings };
    },
    handleMatchState(state) {
      if (state.id !== lastMatchId) {
        engine.beginMatch(state);
        return;
      }

      latestMatchState = state;
      const newEvents = state.eventLog
        .filter((event) => event.sequence > lastEventSequence)
        .sort((a, b) => a.sequence - b.sequence);

      for (const event of newEvents) {
        for (const cueName of getAudioCuesForGameEvent(event, state)) {
          playCue(cueName);
        }
      }

      lastEventSequence = getLatestEventSequence(state);
      syncMatchMusicFromState(state);
    },
    playCue,
    playRendererCue(cue) {
      const cueName = getAudioCueFromRendererCue(cue);

      if (cueName) {
        playCue(cueName);
      }
    },
    setMasterVolume(volume) {
      settings = {
        ...settings,
        masterVolume: clampVolume(volume),
      };
      applyMasterVolume();
      syncMatchMusicFromState(latestMatchState);
    },
    setMuted(muted) {
      settings = {
        ...settings,
        muted,
      };
      applyMasterVolume();
      syncMatchMusicFromState(latestMatchState);
    },
    stopMatch() {
      lastMatchId = undefined;
      lastEventSequence = Number.NEGATIVE_INFINITY;
      latestMatchState = undefined;
      stopMatchMusic();
    },
  };

  function playCue(cueName: AudioCueName) {
    emitAudioDiagnostic(cueName, settings);

    if (settings.muted) {
      return;
    }

    const context = ensureAudioContext();

    if (!context || !masterGain) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    scheduleCue(context, masterGain, cueName);
  }

  function ensureAudioContext(): AudioContext | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (audioContext && audioContext.state !== "closed") {
      return audioContext;
    }

    const AudioContextConstructor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return undefined;
    }

    audioContext = new AudioContextConstructor();
    masterGain = audioContext.createGain();
    const masterCompressor = audioContext.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-12, audioContext.currentTime);
    masterCompressor.knee.setValueAtTime(18, audioContext.currentTime);
    masterCompressor.ratio.setValueAtTime(8, audioContext.currentTime);
    masterCompressor.attack.setValueAtTime(0.004, audioContext.currentTime);
    masterCompressor.release.setValueAtTime(0.18, audioContext.currentTime);
    masterGain.connect(masterCompressor);
    masterCompressor.connect(audioContext.destination);
    applyMasterVolume();

    return audioContext;
  }

  function applyMasterVolume() {
    if (!audioContext || !masterGain) {
      return;
    }

    const targetVolume = settings.muted ? 0.0001 : Math.max(settings.masterVolume, 0.0001);
    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
    masterGain.gain.setTargetAtTime(targetVolume, audioContext.currentTime, 0.02);
  }

  function syncMatchMusicFromState(state?: MatchState) {
    if (!state || state.phase === "match-complete" || settings.muted) {
      stopMatchMusic();
      return;
    }

    startMatchMusic();
  }

  function startMatchMusic() {
    if (matchMusic) {
      return;
    }

    const context = ensureAudioContext();

    if (!context || !masterGain) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(MUSIC_GAIN_TARGET, now + 0.75);
    gain.connect(masterGain);

    matchMusic = {
      gain,
      intervalId: window.setInterval(() => {
        if (audioContext && matchMusic) {
          scheduleMusicSteps(audioContext, matchMusic);
        }
      }, 70),
      nextStepAt: now + 0.03,
      step: 0,
    };
    scheduleMusicSteps(context, matchMusic);
    emitAudioDiagnostic("match.music", settings);
  }

  function stopMatchMusic() {
    if (!audioContext || !matchMusic) {
      matchMusic = undefined;
      return;
    }

    window.clearInterval(matchMusic.intervalId);
    const music = matchMusic;
    const stopAt = audioContext.currentTime + 0.9;
    music.gain.gain.cancelScheduledValues(audioContext.currentTime);
    music.gain.gain.setValueAtTime(Math.max(0.0001, music.gain.gain.value), audioContext.currentTime);
    music.gain.gain.linearRampToValueAtTime(0.0001, stopAt);
    window.setTimeout(() => {
      try {
        music.gain.disconnect();
      } catch {
        // The AudioContext may already be closed during page teardown.
      }
    }, 1100);
    matchMusic = undefined;
  }

  return engine;
}

export function normalizeSettings(settings: AudioSettings): AudioSettings {
  return {
    masterVolume: clampVolume(settings.masterVolume),
    muted: settings.muted,
  };
}

export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return DEFAULT_AUDIO_SETTINGS.masterVolume;
  }

  return Math.min(1, Math.max(0, volume));
}

export function getAudioCuesForGameEvent(event: GameEvent, state: MatchState): AudioCueName[] {
  switch (event.type) {
    case "card.drawn":
      return event.payload.reason === "redraw" ? ["redraw", "card.draw"] : ["card.draw"];
    case "card.played":
      return getCardPlayedCues(event, state);
    case "card.revived":
      return ["medic"];
    case "card.destroyed":
      return event.payload.reason === "scorch" ? [] : ["card.destroy"];
    case "leader.used":
      return [];
    case "player.passed":
      return ["pass"];
    case "weather.applied":
      return [];
    case "weather.cleared":
      return [];
    case "row.buff.applied":
      return [];
    case "round.ended":
      return ["card.discard", ...getOutcomeCue(event, "round")];
    case "match.ended":
      return getOutcomeCue(event, "match");
    case "turn.changed":
      return ["turn"];
    case "match.created":
    case "phase.changed":
      return event.payload.phase === "playing" ? ["round.start"] : [];
    default:
      return assertNever(event.type);
  }
}

export function getAudioCueFromRendererCue(cue: RendererAudioCue | CardHoverAudioCue | unknown): AudioCueName | undefined {
  if (!isRecord(cue) || typeof cue.cue !== "string") {
    return undefined;
  }

  if (cue.cue === "slain-slash" && cue.reason !== "scorch") {
    return "slain-slash";
  }

  if (cue.cue === "card.hover") {
    return "card.hover";
  }

  return undefined;
}

function getCardPlayedCues(event: GameEvent, state: MatchState): AudioCueName[] {
  const cardInstanceId = getPayloadString(event, "cardInstanceId");
  const definition = cardInstanceId ? state.cardDefinitions[state.cards[cardInstanceId]?.definitionId] : undefined;

  if (!definition) {
    return ["card.play"];
  }

  if (definition.type === "special") {
    return [];
  }

  const cues: AudioCueName[] = ["card.play"];

  if (definition.abilities.includes("spy")) {
    cues.push("spy");
  }

  if (definition.abilities.includes("muster") || event.payload.reason === "muster") {
    cues.push("muster");
  }

  return cues;
}

function getOutcomeCue(event: GameEvent, outcome: "match" | "round"): AudioCueName[] {
  if (outcome === "match") {
    return event.payload.winnerId === "player" ? ["match.win"] : ["match.loss"];
  }

  const winnerIds = event.payload.winnerIds;

  if (!Array.isArray(winnerIds) || winnerIds.length !== 1) {
    return ["round.draw"];
  }

  return winnerIds[0] === "player" ? ["round.win"] : ["round.loss"];
}

function scheduleCue(context: AudioContext, destination: AudioNode, cueName: AudioCueName) {
  switch (cueName) {
    case "card.hover":
      playTone(context, destination, 720, 0.055, 0.035, "triangle", { endFrequency: 880 });
      break;
    case "ui.click":
      playTone(context, destination, 520, 0.045, 0.04, "square", { endFrequency: 640 });
      break;
    case "card.draw":
      playNoise(context, destination, 0.11, 0.04, { filterFrequency: 1800 });
      playTone(context, destination, 330, 0.12, 0.045, "triangle", { delay: 0.04, endFrequency: 510 });
      break;
    case "redraw":
      playNoise(context, destination, 0.18, 0.035, { filterFrequency: 2600 });
      playTone(context, destination, 440, 0.12, 0.035, "triangle", { endFrequency: 700 });
      break;
    case "card.play":
      playNoise(context, destination, 0.08, 0.045, { filterFrequency: 780 });
      playTone(context, destination, 116, 0.18, 0.08, "sine", { endFrequency: 72 });
      break;
    case "card.discard":
      playNoise(context, destination, 0.2, 0.052, { filterFrequency: 820 });
      playNoise(context, destination, 0.13, 0.038, { delay: 0.055, filterFrequency: 2600 });
      playTone(context, destination, 164, 0.24, 0.04, "triangle", { delay: 0.035, endFrequency: 104 });
      break;
    case "card.destroy":
      playNoise(context, destination, 0.24, 0.07, { filterFrequency: 3100 });
      playTone(context, destination, 142, 0.2, 0.055, "sawtooth", { endFrequency: 70 });
      break;
    case "turn":
      playTone(context, destination, 392, 0.08, 0.028, "triangle");
      playTone(context, destination, 587, 0.09, 0.026, "triangle", { delay: 0.08 });
      break;
    case "pass":
      playTone(context, destination, 196, 0.18, 0.055, "sawtooth", { endFrequency: 118 });
      break;
    case "round.start":
      playNoise(context, destination, 0.18, 0.032, { filterFrequency: 1900 });
      playChord(context, destination, [196, 294, 392], 0.26, 0.058, "triangle");
      break;
    case "weather":
    case "clear-weather":
    case "horn":
    case "leader":
    case "scorch":
      break;
    case "medic":
      playTone(context, destination, 320, 0.16, 0.045, "sine", { endFrequency: 520 });
      playTone(context, destination, 520, 0.22, 0.04, "sine", { delay: 0.08, endFrequency: 720 });
      break;
    case "muster":
      playTone(context, destination, 260, 0.08, 0.035, "triangle");
      playTone(context, destination, 326, 0.08, 0.035, "triangle", { delay: 0.07 });
      playTone(context, destination, 392, 0.08, 0.035, "triangle", { delay: 0.14 });
      break;
    case "spy":
      playTone(context, destination, 392, 0.12, 0.035, "sine", { endFrequency: 262 });
      playNoise(context, destination, 0.16, 0.022, { delay: 0.06, filterFrequency: 1200 });
      break;
    case "slain-slash":
      playNoise(context, destination, 0.16, 0.08, { filterFrequency: 3800 });
      playTone(context, destination, 960, 0.12, 0.06, "sawtooth", { endFrequency: 240 });
      break;
    case "round.win":
      playChord(context, destination, [392, 494, 659], 0.46, 0.055, "triangle");
      break;
    case "round.loss":
      playChord(context, destination, [220, 185, 146], 0.5, 0.05, "sawtooth");
      break;
    case "round.draw":
      playChord(context, destination, [294, 330], 0.32, 0.04, "triangle");
      break;
    case "match.win":
      playChord(context, destination, [262, 392, 523, 784], 0.78, 0.07, "triangle");
      break;
    case "match.loss":
      playChord(context, destination, [196, 147, 98], 0.82, 0.065, "sawtooth");
      break;
    case "match.music":
      break;
    default:
      assertNever(cueName);
  }
}

function scheduleMusicSteps(context: AudioContext, music: MatchMusic) {
  while (music.nextStepAt < context.currentTime + MUSIC_LOOKAHEAD_SECONDS) {
    scheduleMusicStep(context, music.gain, music.step, music.nextStepAt);
    music.step += 1;
    music.nextStepAt += MUSIC_STEP_SECONDS;
  }
}

function scheduleMusicStep(
  context: AudioContext,
  destination: AudioNode,
  step: number,
  startAt: number,
) {
  const position = step % 64;
  const beat = Math.floor(position / 4);
  const bassLine = [73.42, 73.42, 55, 65.41, 73.42, 87.31, 65.41, 55];
  const warChords = [
    [146.83, 220, 293.66],
    [116.54, 174.61, 233.08],
    [130.81, 196, 261.63],
    [110, 164.81, 220],
  ];
  const stringPulse = [293.66, 329.63, 349.23, 392, 349.23, 329.63, 293.66, 261.63];
  const reedLine = [587.33, 523.25, 440, 392, 440, 523.25, 440, 349.23];

  if (position % 16 === 0) {
    playWarDrone(context, destination, startAt, bassLine[(beat / 4) % bassLine.length], position === 0);
  }

  if (position % 4 === 0) {
    const accented = position % 16 === 0;
    playPercussionHit(context, destination, startAt, accented ? 0.2 : 0.15, accented ? 118 : 96, 36);
    playScheduledNoise(context, destination, accented ? 0.18 : 0.12, accented ? 0.052 : 0.036, startAt, {
      filterFrequency: 520,
      type: "lowpass",
    });
  }

  if (position % 4 === 2) {
    playPercussionHit(context, destination, startAt, position % 8 === 6 ? 0.11 : 0.08, 178, 74);
    playScheduledNoise(context, destination, 0.075, 0.04, startAt + 0.006, {
      filterFrequency: 2300,
      type: "bandpass",
    });
  }

  if (position % 2 === 1) {
    playMetalTick(context, destination, startAt, position % 8 === 7 ? 0.045 : 0.032);
  }

  if (position % 4 === 0) {
    const bassNote = bassLine[beat % bassLine.length];
    playScheduledTone(context, destination, bassNote, 0.38, 0.09, "sawtooth", startAt, {
      endFrequency: bassLine[(beat + 1) % bassLine.length],
    });
  }

  if (position % 2 === 0) {
    playPizzicatoString(
      context,
      destination,
      startAt + 0.008,
      stringPulse[Math.floor(position / 2) % stringPulse.length],
      position % 8 === 0,
    );
  }

  if (position % 4 === 1 || position % 4 === 3) {
    playAcousticStrum(
      context,
      destination,
      startAt + 0.006,
      warChords[Math.floor(position / 16) % warChords.length],
      position % 16 === 1,
    );
  }

  if (position === 0 || position === 16 || position === 32 || position === 48) {
    playWarHorn(
      context,
      destination,
      startAt + 0.015,
      [146.83, 174.61, 196, 164.81][Math.floor(position / 16)],
      position === 0 || position === 32,
    );
  }

  if (position === 10 || position === 26 || position === 42 || position === 58) {
    playWarHorn(
      context,
      destination,
      startAt,
      [220, 196, 261.63, 220][Math.floor(position / 16)],
      false,
    );
  }

  if (position % 8 === 6) {
    playWoodwindNote(
      context,
      destination,
      startAt + 0.02,
      reedLine[Math.floor(position / 8) % reedLine.length],
      "square",
      0.026,
      0.16,
    );
  }

  if (position === 14 || position === 30 || position === 46 || position === 62) {
    playScheduledNoise(context, destination, 0.18, 0.045, startAt, {
      filterFrequency: 4800,
      type: "highpass",
    });
  }
}

function playWarDrone(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  rootFrequency: number,
  accented: boolean,
) {
  playScheduledTone(context, destination, rootFrequency / 2, accented ? 1.8 : 1.2, accented ? 0.072 : 0.052, "sawtooth", startAt, {
    endFrequency: rootFrequency / 2 * 0.996,
  });
  playScheduledTone(context, destination, rootFrequency, accented ? 1.4 : 0.92, accented ? 0.042 : 0.03, "triangle", startAt + 0.025, {
    endFrequency: rootFrequency * 1.004,
  });
}

function playWarHorn(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  rootFrequency: number,
  accented: boolean,
) {
  const duration = accented ? 0.72 : 0.46;
  const gain = accented ? 0.082 : 0.058;
  playScheduledTone(context, destination, rootFrequency, duration, gain, "sawtooth", startAt, {
    endFrequency: rootFrequency * 1.01,
  });
  playScheduledTone(context, destination, rootFrequency * 1.5, duration * 0.82, gain * 0.46, "triangle", startAt + 0.018, {
    endFrequency: rootFrequency * 1.5 * 0.998,
  });
  playScheduledNoise(context, destination, 0.18, gain * 0.32, startAt, {
    filterFrequency: 900,
    type: "bandpass",
  });
}

function playAcousticStrum(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  chord: number[],
  accented: boolean,
) {
  chord.forEach((frequency, index) => {
    playScheduledTone(context, destination, frequency, 0.09, accented ? 0.028 : 0.019, "triangle", startAt + index * 0.012, {
      endFrequency: frequency * 1.012,
    });
    playScheduledTone(context, destination, frequency * 2, 0.055, accented ? 0.012 : 0.008, "sawtooth", startAt + index * 0.012, {
      endFrequency: frequency * 2.02,
    });
  });
  playScheduledNoise(context, destination, 0.04, accented ? 0.012 : 0.008, startAt, {
    filterFrequency: 2800,
    type: "highpass",
  });
}

function playPizzicatoString(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  frequency: number,
  accented: boolean,
) {
  playScheduledTone(context, destination, frequency, 0.07, accented ? 0.028 : 0.021, "triangle", startAt, {
    endFrequency: frequency * 0.996,
  });
}

function playWoodwindNote(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  frequency: number,
  oscillatorType: OscillatorType,
  gain: number,
  duration: number,
) {
  playScheduledTone(context, destination, frequency, duration, gain, oscillatorType, startAt, {
    endFrequency: frequency * 1.006,
  });
}

function playChord(
  context: AudioContext,
  destination: AudioNode,
  frequencies: number[],
  duration: number,
  gain: number,
  oscillatorType: OscillatorType,
) {
  frequencies.forEach((frequency, index) => {
    playTone(context, destination, frequency, duration + index * 0.03, gain / frequencies.length, oscillatorType, {
      delay: index * 0.035,
    });
  });
}

function playTone(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  duration: number,
  gain: number,
  oscillatorType: OscillatorType,
  options: {
    delay?: number;
    endFrequency?: number;
  } = {},
) {
  const startAt = context.currentTime + (options.delay ?? 0);
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = oscillatorType;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), startAt + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.linearRampToValueAtTime(gain, startAt + Math.min(0.025, duration * 0.25));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
}

function playScheduledTone(
  context: AudioContext,
  destination: AudioNode,
  frequency: number,
  duration: number,
  gain: number,
  oscillatorType: OscillatorType,
  startAt: number,
  options: {
    endFrequency?: number;
  } = {},
) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const filter = context.createBiquadFilter();

  oscillator.type = oscillatorType;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  if (options.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), startAt + duration);
  }

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(680, startAt);
  filter.frequency.linearRampToValueAtTime(1400, startAt + Math.min(0.12, duration));
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.linearRampToValueAtTime(gain, startAt + Math.min(0.025, duration * 0.25));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
}

function playNoise(
  context: AudioContext,
  destination: AudioNode,
  duration: number,
  gain: number,
  options: {
    delay?: number;
    filterFrequency?: number;
  } = {},
) {
  const startAt = context.currentTime + (options.delay ?? 0);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gainNode = context.createGain();

  source.buffer = createNoiseBuffer(context, duration);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(options.filterFrequency ?? 1200, startAt);
  filter.Q.setValueAtTime(0.9, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.linearRampToValueAtTime(gain, startAt + Math.min(0.025, duration * 0.3));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);
  source.start(startAt);
  source.stop(startAt + duration + 0.03);
}

function playScheduledNoise(
  context: AudioContext,
  destination: AudioNode,
  duration: number,
  gain: number,
  startAt: number,
  options: {
    filterFrequency?: number;
    type?: BiquadFilterType;
  } = {},
) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gainNode = context.createGain();

  source.buffer = createNoiseBuffer(context, duration);
  filter.type = options.type ?? "bandpass";
  filter.frequency.setValueAtTime(options.filterFrequency ?? 1200, startAt);
  filter.Q.setValueAtTime(1.2, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.linearRampToValueAtTime(gain, startAt + Math.min(0.018, duration * 0.3));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);
  source.start(startAt);
  source.stop(startAt + duration + 0.03);
}

function playPercussionHit(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  gain: number,
  startFrequency: number,
  endFrequency: number,
) {
  playScheduledTone(context, destination, startFrequency, 0.14, gain, "sine", startAt, {
    endFrequency,
  });
  playScheduledNoise(context, destination, 0.08, gain * 0.45, startAt, {
    filterFrequency: 760,
    type: "lowpass",
  });
}

function playMetalTick(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  gain: number,
) {
  playScheduledTone(context, destination, 1660, 0.045, gain, "triangle", startAt, {
    endFrequency: 2600,
  });
  playScheduledNoise(context, destination, 0.045, gain * 0.5, startAt, {
    filterFrequency: 5200,
    type: "highpass",
  });
}

function createNoiseBuffer(context: AudioContext, duration: number): AudioBuffer {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

function emitAudioDiagnostic(cueName: AudioCueName, settings: AudioSettings) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("oathbound:audio-played", {
    detail: {
      cue: cueName,
      muted: settings.muted,
      volume: settings.masterVolume,
    },
  }));
}

function getLatestEventSequence(state: MatchState): number {
  return state.eventLog.reduce((latest, event) => Math.max(latest, event.sequence), Number.NEGATIVE_INFINITY);
}

function getPayloadString(event: GameEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function isDisabledControl(control: Element): boolean {
  return control instanceof HTMLButtonElement ||
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement
    ? control.disabled
    : false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled audio cue: ${value}`);
}
