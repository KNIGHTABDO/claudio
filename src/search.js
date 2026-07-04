const axios = require('axios');
require('dotenv').config();

async function searchWeb(query) {
  const token = process.env.TINYFISH_API_KEY;
  if (!token) return null;

  const url = `https://api.search.tinyfish.ai?query=${encodeURIComponent(query)}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'X-API-Key': token,
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    if (response.data && response.data.results && response.data.results.length > 0) {
      return response.data.results.slice(0, 4).map((item, idx) => {
        const snippet = item.snippet || 'No summary available.';
        return `Result [${idx + 1}]:\nTitle: ${item.title}\nURL: ${item.url}\nSummary: ${snippet}`;
      }).join('\n\n');
    }
    return null;
  } catch (error) {
    console.error('Web search failed:', error.response?.data || error.message);
    return 'Web search is temporarily unavailable. Proceed using your extensive pre-trained internal knowledge of music history, tracklists, and artists to reply to the user and curate the songs.';
  }
}

module.exports = { searchWeb };
