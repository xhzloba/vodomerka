import deleteSoundUrl from './assets/delete.mp3';
import likeSoundUrl from './assets/like.mp3';
import menuSoundUrl from './assets/menu.mp3';
import submenuSoundUrl from './assets/submenu.mp3';
import welcomeSoundUrl from './assets/welcomePage.mp3';

export type UiSoundId = 'delete' | 'like' | 'menu' | 'submenu' | 'welcome';

const UI_SOUND_URLS: Record<UiSoundId, string> = {
  delete: deleteSoundUrl,
  like: likeSoundUrl,
  menu: menuSoundUrl,
  submenu: submenuSoundUrl,
  welcome: welcomeSoundUrl,
};

let uiSoundsEnabled = true;
let audioCtx: AudioContext | null = null;
const bufferCache = new Map<UiSoundId, AudioBuffer>();
const loadingBuffers = new Map<UiSoundId, Promise<AudioBuffer | null>>();
const htmlAudioCache = new Map<UiSoundId, HTMLAudioElement>();

export function setUiSoundsEnabled(enabled: boolean) {
  uiSoundsEnabled = enabled;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctx) {
    return null;
  }

  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctx();
  }

  return audioCtx;
}

async function loadBuffer(sound: UiSoundId): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(sound);
  if (cached) {
    return cached;
  }

  const pending = loadingBuffers.get(sound);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const ctx = getAudioContext();
    if (!ctx) {
      return null;
    }

    try {
      const response = await fetch(UI_SOUND_URLS[sound]);
      const bytes = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(bytes.slice(0));
      bufferCache.set(sound, buffer);
      return buffer;
    } catch {
      return null;
    } finally {
      loadingBuffers.delete(sound);
    }
  })();

  loadingBuffers.set(sound, task);
  return task;
}

function playHtmlFallback(sound: UiSoundId) {
  try {
    let audio = htmlAudioCache.get(sound);
    if (!audio) {
      audio = new Audio(UI_SOUND_URLS[sound]);
      audio.preload = 'auto';
      htmlAudioCache.set(sound, audio);
    }

    const playback = audio.cloneNode(true) as HTMLAudioElement;
    playback.volume = 1;
    playback.currentTime = 0;
    void playback.play().catch(() => {
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    });
  } catch {
    // ignore
  }
}

function playBuffer(sound: UiSoundId, buffer: AudioBuffer) {
  const ctx = getAudioContext();
  if (!ctx) {
    playHtmlFallback(sound);
    return;
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 1;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
}

/**
 * Разблокировка на user-gesture (dragstart/pointerdown).
 * После resume() Web Audio играет даже из setTimeout/DnD drop.
 */
export function unlockUiSounds() {
  if (!uiSoundsEnabled) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }

  // Прогрев like заранее — основной звук для drag-to-island
  void loadBuffer('like');
}

export function playUiSound(sound: UiSoundId) {
  if (!uiSoundsEnabled) {
    return;
  }

  const ctx = getAudioContext();
  if (ctx?.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }

  const cached = bufferCache.get(sound);
  if (cached) {
    try {
      playBuffer(sound, cached);
      return;
    } catch {
      playHtmlFallback(sound);
      return;
    }
  }

  void loadBuffer(sound).then((buffer) => {
    if (!buffer) {
      playHtmlFallback(sound);
      return;
    }
    try {
      playBuffer(sound, buffer);
    } catch {
      playHtmlFallback(sound);
    }
  });
}

export function playDeleteSound() {
  playUiSound('delete');
}

export function playLikeSound() {
  playUiSound('like');
}

export function playWelcomeSound() {
  playUiSound('welcome');
}

export function playMenuSound() {
  playUiSound('menu');
}

export function playSubmenuSound() {
  playUiSound('submenu');
}
