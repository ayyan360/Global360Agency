import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeThumbnailUrl, youtubeVideoId } from '../src/utils/youtube.js';

describe('YouTube media helpers', () => {
  it('extracts IDs from supported YouTube URLs and builds a thumbnail URL', () => {
    assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=PkZNo7MFNFg'), 'PkZNo7MFNFg');
    assert.equal(youtubeVideoId('https://youtu.be/PkZNo7MFNFg'), 'PkZNo7MFNFg');
    assert.equal(youtubeVideoId('https://www.youtube.com/shorts/PkZNo7MFNFg'), 'PkZNo7MFNFg');
    assert.equal(youtubeThumbnailUrl('https://youtu.be/PkZNo7MFNFg'), 'https://img.youtube.com/vi/PkZNo7MFNFg/hqdefault.jpg');
  });

  it('does not accept unrelated hosts or malformed IDs', () => {
    assert.equal(youtubeVideoId('https://evil.example.com/watch?v=PkZNo7MFNFg'), null);
    assert.equal(youtubeThumbnailUrl('https://youtube.com/watch?v=short'), null);
  });
});
