import { describe, it, expect } from 'vitest';
import { toEmbedUrl, pct, formatDuration, formatBytes, initials } from '../utils/format.js';
import { statusInfo } from '../constants/status.js';

describe('format utilities', () => {
  it('converts only YouTube/Vimeo URLs into privacy-friendly embeds', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=PkZNo7MFNFg')).toBe('https://www.youtube-nocookie.com/embed/PkZNo7MFNFg?rel=0');
    expect(toEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123?rel=0');
    expect(toEmbedUrl('https://vimeo.com/123456')).toBe('https://player.vimeo.com/video/123456');
    expect(toEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(toEmbedUrl('https://evil.example.com/video.mp4')).toBeNull();
    expect(toEmbedUrl(null)).toBeNull();
  });

  it('formats percentages, durations and sizes', () => {
    expect(pct(70)).toBe('70%');
    expect(pct(84.93, 2)).toBe('84.93%');
    expect(pct(null)).toBe('—');
    expect(formatDuration(3900)).toBe('1 h 5 min');
    expect(formatDuration(600)).toBe('10 min');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(initials('Ayaan Demo Khan')).toBe('AD');
  });

  it('maps every workflow status to a human label', () => {
    expect(statusInfo('completed_not_qualified').label).toBe('Completed — Not Qualified');
    expect(statusInfo('revision_required').label).toBe('Revision Required');
    expect(statusInfo('some_unknown_state').label).toBe('some unknown state');
  });
});
