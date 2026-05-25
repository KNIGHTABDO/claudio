const axios = require('axios');
require('dotenv').config();

async function searchWeb(query) {
  const token = process.env.TINYFISH_API_KEY;
  if (!token) {
    console.warn('[Tinyfish Search] TINYFISH_API_KEY is not defined in environment. Skipping web search.');
    return null;
  }

  // Format the query specifically for Tinyfish Search
  const url = `https://api.search.tinyfish.ai?query=${encodeURIComponent(query)}`;
  console.log(`[Tinyfish Search] Querying: "${query}"...`);

  try {
    const response = await axios.get(url, {
      headers: {
        'X-API-Key': token,
        'Accept': 'application/json'
      },
      timeout: 15000 // 15-second safety timeout
    });

    if (response.data && response.data.results && response.data.results.length > 0) {
      console.log(`[Tinyfish Search] Success. Retrieved ${response.data.results.length} results.`);
      
      // Parse the top 4 results into a rich, concise summary for the LLM
      const results = response.data.results.slice(0, 4).map((item, idx) => {
        const snippet = item.snippet || 'No summary available.';
        return `Result [${idx + 1}]:\nTitle: ${item.title}\nURL: ${item.url}\nSummary: ${snippet}`;
      }).join('\n\n');

      return results;
    } else {
      console.log('[Tinyfish Search] No results found.');
      return null;
    }
  } catch (error) {
    const errorData = error.response?.data;
    console.error('[Tinyfish Search] Search failed:', errorData || error.message);
    
    // Fallback: Proceed using static knowledge
    return 'Web search is temporarily unavailable. Proceed using your extensive pre-trained internal knowledge of music history, tracklists, and artists to reply to the user and curate the songs.';
  }
}

module.exports = { searchWeb };
