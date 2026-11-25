import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchYouTubeVideoDuration } from '../services/youtubeIframeApi.js';

const hadYouTube = Object.prototype.hasOwnProperty.call(window, 'YT');
const originalYouTube = window.YT;

afterEach(() => {
  document.body.replaceChildren();
  if (hadYouTube) window.YT = originalYouTube;
  else delete window.YT;
});

describe('YouTube duration lookup', () => {
  it('reads the queued video duration and cleans up its temporary player', async () => {
    let player;
    window.YT = {
      PlayerState: { CUED: 5 },
      Player: class {
        constructor(iframe, { events }) {
          player = this;
          this.destroy = vi.fn(() => iframe.remove());
          queueMicrotask(() => events.onReady({ target: { cueVideoById: vi.fn() } }));
          queueMicrotask(() => events.onStateChange({ data: 5, target: { getDuration: () => 241 } }));
        }
      },
    };

    await expect(fetchYouTubeVideoDuration('https://youtu.be/PkZNo7MFNFg')).resolves.toBe(241);
    expect(player.destroy).toHaveBeenCalledOnce();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('does not load the player for a non-YouTube URL', async () => {
    await expect(fetchYouTubeVideoDuration('https://vimeo.com/123456')).resolves.toBeNull();
  });
});
