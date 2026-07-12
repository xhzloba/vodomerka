import deleteSoundUrl from './assets/delete.mp3';
import likeSoundUrl from './assets/like.mp3';
import welcomeSoundUrl from './assets/welcomePage.mp3';

export type UiSoundId = 'delete' | 'like' | 'welcome';

const UI_SOUND_URLS: Record<UiSoundId, string> = {
  delete: deleteSoundUrl,
  like: likeSoundUrl,
  welcome: welcomeSoundUrl,
};

const audioCache = new Map<UiSoundId, HTMLAudioElement>();
let uiSoundsEnabled = true;

export function setUiSoundsEnabled(enabled: boolean) {
  uiSoundsEnabled = enabled;
}

export function playUiSound(sound: UiSoundId) {
  if (!uiSoundsEnabled) {
    return;
  }

  try {
    let audio = audioCache.get(sound);

    if (!audio) {
      audio = new Audio(UI_SOUND_URLS[sound]);
      audioCache.set(sound, audio);
    }

    audio.currentTime = 0;
    void audio.play();
  } catch {
    // Ignore playback errors (autoplay restrictions, missing audio device, etc.)
  }
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
