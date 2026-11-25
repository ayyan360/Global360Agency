import { getYouTubeVideoId } from '../utils/format.js';

let apiPromise;

export function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') previousReady();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube player API did not initialize.'));
    };

    let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('error', () => reject(new Error('YouTube player API could not be loaded.')), { once: true });
  }).catch((error) => {
    apiPromise = null;
    throw error;
  });

  return apiPromise;
}

export async function fetchYouTubeVideoDuration(videoUrl) {
  const videoId = getYouTubeVideoId(videoUrl);
  if (!videoId) return null;

  const YT = await loadYouTubeIframeApi();
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    url.searchParams.set('enablejsapi', '1');
    url.searchParams.set('origin', window.location.origin);
    iframe.src = url.toString();
    iframe.title = 'Video duration lookup';
    iframe.width = '200';
    iframe.height = '200';
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, { position: 'fixed', left: '-220px', top: '0', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(iframe);

    let player;
    let settled = false;
    let timeout;
    const finish = (error, duration) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      player?.destroy();
      iframe.remove();
      if (error) reject(error);
      else resolve(duration);
    };
    timeout = setTimeout(() => finish(new Error('Timed out while reading the YouTube video duration.')), 12000);

    try {
      player = new YT.Player(iframe, {
        events: {
          onReady: (event) => event.target.cueVideoById(videoId),
          onStateChange: (event) => {
            if (event.data !== YT.PlayerState.CUED) return;
            const duration = event.target.getDuration();
            finish(null, Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null);
          },
          onError: (event) => finish(new Error(`YouTube could not load this video (error ${event.data}).`)),
        },
      });
    } catch (error) {
      finish(error);
    }
  });
}
