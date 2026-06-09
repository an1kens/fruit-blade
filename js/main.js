import { Game } from './engine/Game.js';
import { UIManager } from './ui/UIManager.js';

/**
 * Application entry point — webcam menu starts immediately on load.
 */
async function main() {
  const canvas = document.getElementById('game-canvas');
  const video = document.getElementById('webcam');
  const app = document.getElementById('app');

  const ui = new UIManager(app);
  const game = new Game(canvas, video, ui);

  await game.init();
  ui.setVolumeSliders(game.audio.musicVolume, game.audio.sfxVolume);

  // Unregister any cached service worker so code updates apply immediately.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) reg.unregister();
    });
    if (window.caches?.keys) {
      caches.keys().then((keys) => {
        for (const key of keys) caches.delete(key);
      });
    }
  }

  ui.on('pause', () => game.pause());
  ui.on('resume', () => game.resume());
  ui.on('restart', () => game.restart());
  ui.on('home', () => game.goHome());
  ui.on('leaderboard', () => game.showLeaderboard());
  ui.on('enableCamera', () => game.enableCamera());
  ui.on('mouseFallback', () => game.enableMouseFallback());
  ui.on('bootRetry', () => window.location.reload());

  ui.on('settingsChange', () => game.applyUiSettings());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.updateHandTrackingInterval?.();
    } else {
      game.applyUiSettings();
    }
  });

  ui.on('musicVolume', (v) => {
    game.audio.setMusicVolume(v);
    ui.setVolumeSliders(game.audio.musicVolume, game.audio.sfxVolume);
  });
  ui.on('sfxVolume', (v) => {
    game.audio.setSfxVolume(v);
    ui.setVolumeSliders(game.audio.musicVolume, game.audio.sfxVolume);
  });

  document.addEventListener('keydown', (e) => {
    if (game.handleKeyboardNav?.(e.key)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (game.state === 'playing') game.pause();
      else if (game.state === 'paused') game.resume();
    }
  });
}

main().catch(console.error);
