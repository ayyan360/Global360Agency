export function youtubeVideoId(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    let id = null;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else id = url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] || null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function youtubeThumbnailUrl(videoUrl) {
  const id = youtubeVideoId(videoUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
