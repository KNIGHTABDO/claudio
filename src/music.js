const yts = require('yt-search');

async function searchSong(query) {
  try {
    const r = await yts(query);
    const video = r.videos[0];
    if (!video) return null;

    return {
      id: video.videoId,
      name: video.title,
      artist: video.author.name,
      album: 'Global Stream Source',
      cover: video.thumbnail,
      duration: video.seconds || 0,
      url: `/api/stream?v=${video.videoId}`
    };
  } catch (err) {
    console.error('Music search error:', err.message);
    return null;
  }
}

module.exports = { searchSong };
