import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadYouTubeIframeApi } from '../../services/youtubeIframeApi.js';

export function YouTubeLessonPlayer({ videoId, embedUrl, title, courseUrl, nextLessonUrl, nextLessonTitle, nextLessonLocked }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [ended, setEnded] = useState(false);
  const [playerUnavailable, setPlayerUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const playerHost = hostRef.current;
    setEnded(false);
    setPlayerUnavailable(false);

    const playerIframe = document.createElement('iframe');
    const playerUrl = new URL(embedUrl);
    playerUrl.searchParams.set('enablejsapi', '1');
    playerUrl.searchParams.set('origin', window.location.origin);
    playerUrl.searchParams.set('rel', '0');
    playerUrl.searchParams.set('playsinline', '1');
    playerUrl.searchParams.set('iv_load_policy', '3');
    playerIframe.src = playerUrl.toString();
    playerIframe.title = title;
    playerIframe.className = 'size-full';
    playerIframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    playerIframe.allowFullscreen = true;
    playerIframe.referrerPolicy = 'strict-origin-when-cross-origin';
    playerHost?.appendChild(playerIframe);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (!active || !playerHost) return;
        playerRef.current = new YT.Player(playerIframe, {
          events: {
            onStateChange: (event) => {
              const isEnded = event.data === YT.PlayerState.ENDED;
              playerIframe.inert = isEnded;
              if (isEnded && document.activeElement === playerIframe) playerIframe.blur();
              setEnded(isEnded);
            },
          },
        });
      })
      .catch((error) => {
        if (!active) return;
        console.error('YouTube course player could not initialize.', error);
        setPlayerUnavailable(true);
      });

    return () => {
      active = false;
      playerRef.current?.destroy();
      playerRef.current = null;
      playerHost?.replaceChildren();
    };
  }, [embedUrl, title, videoId]);

  return (
    <>
      <div className="relative aspect-video">
        {playerUnavailable ? (
          <iframe
            src={embedUrl}
            title={title}
            className="size-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div ref={hostRef} className="size-full" />
        )}
        {ended && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#17152B]/95 p-5 text-center text-white">
            <div>
              <p className="text-lg font-semibold">Lesson finished</p>
              {nextLessonUrl ? (
                <Link to={nextLessonUrl} className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
                  Next lesson: {nextLessonTitle}
                </Link>
              ) : nextLessonLocked ? (
                <Link to={courseUrl} className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
                  Enroll to continue
                </Link>
              ) : (
                <Link to={courseUrl} className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-600">
                  Back to course
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  playerRef.current?.seekTo(0);
                  playerRef.current?.playVideo();
                  setEnded(false);
                }}
                className="ml-3 rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
              >
                Replay
              </button>
            </div>
          </div>
        )}
      </div>
      {playerUnavailable && (
        <p role="status" className="mt-2 text-xs text-muted">
          Course video navigation could not load. Use the course&apos;s Next Lesson button below to continue.
        </p>
      )}
    </>
  );
}
