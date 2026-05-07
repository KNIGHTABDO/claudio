const yts = require('yt-search');
require('dotenv').config();

const PORT = process.env.PORT || 8080;

async function searchSong(query) {
  try {
    console.log(`[Music Engine] Searching YouTube for: ${query}`);
    const r = await yts(query);
    const video = r.videos[0];

    if (!video) {
      console.warn(`No results found on YouTube for: ${query}`);
      return null;
    }

    console.log(`[Music Engine] Found Match: ${video.title}`);

    // Instead of a direct link, we point to our internal streaming endpoint
    // This allows us to use yt-dlp on the backend for high-quality, reliable streaming.
    const internalStreamUrl = `/api/stream?v=${video.videoId}`;
    
    return {
      id: video.videoId,
      name: video.title,
      artist: video.author.name,
      album: 'Global Stream Source',
      cover: video.thumbnail,
      url: internalStreamUrl
    };
  } catch (err) {
    console.error(`Music API Error: ${err.message}`);
    return null;
  }
}

module.exports = { searchSong };
