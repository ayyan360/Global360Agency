import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { YouTubeLessonPlayer } from '../components/courses/YouTubeLessonPlayer.jsx';

const playerApi = vi.hoisted(() => ({ onStateChange: null, instance: null, seeked: false, played: false }));

vi.mock('../services/youtubeIframeApi.js', () => ({
  loadYouTubeIframeApi: async () => ({
    Player: class {
      constructor(_host, options) {
        playerApi.onStateChange = options.events.onStateChange;
        playerApi.instance = this;
      }

      destroy() {}
      seekTo() { playerApi.seeked = true; }
      playVideo() { playerApi.played = true; }
    },
    PlayerState: { ENDED: 0 },
  }),
}));

describe('YouTubeLessonPlayer', () => {
  it('shows the course next lesson instead of YouTube recommendations when the video ends', async () => {
    playerApi.onStateChange = null;
    render(
      <MemoryRouter>
        <YouTubeLessonPlayer
          videoId="PkZNo7MFNFg"
          embedUrl="https://www.youtube-nocookie.com/embed/PkZNo7MFNFg?rel=0"
          title="Lesson one"
          courseUrl="/courses/web-basics"
          nextLessonUrl="/learn/web-basics/lesson-two"
          nextLessonTitle="Lesson two"
        />
      </MemoryRouter>
    );
    await waitFor(() => expect(playerApi.onStateChange).toBeTypeOf('function'));
    act(() => playerApi.onStateChange({ data: 0 }));
    expect(screen.getByRole('link', { name: 'Next lesson: Lesson two' })).toHaveAttribute('href', '/learn/web-basics/lesson-two');
    await screen.findByRole('button', { name: 'Replay' });
  });

  it('offers the course page when there is no accessible next lesson', async () => {
    render(
      <MemoryRouter>
        <YouTubeLessonPlayer
          videoId="PkZNo7MFNFg"
          embedUrl="https://www.youtube-nocookie.com/embed/PkZNo7MFNFg?rel=0"
          title="Final lesson"
          courseUrl="/courses/web-basics"
        />
      </MemoryRouter>
    );
    await waitFor(() => expect(playerApi.onStateChange).toBeTypeOf('function'));
    act(() => playerApi.onStateChange({ data: 0 }));
    expect(screen.getByRole('link', { name: 'Back to course' })).toHaveAttribute('href', '/courses/web-basics');
  });
});
