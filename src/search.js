const axios = require('axios');
require('dotenv').config();

async function searchWeb(query) {
  const token = process.env.JINA_API_KEY;
  if (!token) {
    console.warn('[Jina Search] JINA_API_KEY is not defined in environment. Skipping web search.');
    return null;
  }

  // Format the query specifically for Jina Search
  const url = `https://s.jina.ai/${encodeURIComponent(query)}`;
  console.log(`[Jina Search] Querying: "${query}"...`);

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 15000 // 15-second safety timeout
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      console.log(`[Jina Search] Success. Retrieved ${response.data.data.length} results.`);
      
      // Parse the top 4 results into a rich, concise summary for the LLM
      const results = response.data.data.slice(0, 4).map((item, idx) => {
        const snippet = item.description || item.content.substring(0, 200).replace(/\n/g, ' ');
        return `Result [${idx + 1}]:\nTitle: ${item.title}\nURL: ${item.url}\nSummary: ${snippet}`;
      }).join('\n\n');

      return results;
    } else {
      console.log('[Jina Search] No results found.');
      return null;
    }
  } catch (error) {
    console.error('[Jina Search] Search failed:', error.response?.data || error.message);
    return null;
  }
}

module.exports = { searchWeb };
