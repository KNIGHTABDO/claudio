const axios = require('axios');
const db = require('./db');
const { getContextData } = require('./context');
const { searchWeb } = require('./search');
require('dotenv').config();

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = () => process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const groqHeaders = () => ({
  'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
  'Content-Type': 'application/json'
});

const tools = [
  {
    type: 'function',
    function: {
      name: 'searchWeb',
      description: 'Search the web to research music, artist facts, new albums, release dates, tracklists, or real-time cultural knowledge.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query (e.g., "Moroccan rapper STORMY new album").'
          }
        },
        required: ['query']
      }
    }
  }
];

async function getDJResponse(userInput = null, options = {}) {
  let recentMessages = [];
  try {
    recentMessages = await db.getRecentMessages(10);
  } catch (dbErr) {
    console.error('History fetch failed:', dbErr.message);
  }

  let ctxData;
  try {
    ctxData = await getContextData();
    if (options.ignoreTaste) {
      ctxData.taste = 'No saved taste profile for this session. Curate from current global trends and broad international appeal.';
      ctxData.routines = '';
      ctxData.moodRules = '';
      ctxData.playHistory = '';
      ctxData.favorites = '';
    }
  } catch (err) {
    console.error('Context fetch failed:', err.message);
    ctxData = {
      taste: 'Reflective, soft rock, neo-classical.',
      routines: '',
      moodRules: '',
      persona: 'You are Claudio, the AI DJ.',
      weather: 'Unknown',
      playHistory: '',
      favorites: '',
      currentTime: new Date().toLocaleTimeString()
    };
  }

  const systemPrompt = `You are Claudio, a personalized, 24-hour online AI radio station and DJ.
Analyze the provided context (time, weather, tastes, routines, rules, recently played) and the conversation history.
Your goal is to act as a professional, vibe-setting DJ. Your speech should be natural, engaging, and empathetic.

${ctxData.persona}

[USER MUSIC TASTES]
${ctxData.taste}

[USER ROUTINES]
${ctxData.routines}

[MOOD & ENVIRONMENT RULES]
${ctxData.moodRules}

[CURRENT ENVIRONMENT]
Location: ${process.env.CITY || 'Casablanca'}
Current Time: ${ctxData.currentTime}
Current Weather: ${ctxData.weather}
Recently Played (AVOID REPEATING): ${ctxData.playHistory || 'None yet'}
User Favorites Playlist:
${ctxData.favorites}

[AVAILABLE TOOLS]
You have access to the \`searchWeb\` tool.
If the user asks about an artist, song, album, tracklist, or release date you do not fully know, or if you need real-time data to verify music facts, you MUST call the \`searchWeb\` tool with a highly specific search query.
Once you receive the tool response, weave the returned facts into your DJ introduction speech. Keep it natural and conversational!

[OUTPUT FORMAT]
You MUST output a strictly valid JSON object matching the following schema at all times (do not include markdown code block formatting like \`\`\`json, just return the raw JSON object directly):
{
  "say": "The DJ's intro speech (extremely concise (1-2 sentences), addressing the listener as 'sir')",
  "play": ["Song Name - Artist", ...],
  "reason": "Why these songs were picked (or conversational rationale)",
  "segue": "Transition text between songs (or empty string if just chatting)"
}

[ANTI-LOOPING DIRECTIVE]
Do NOT copy or repeat your previous assistant responses from the conversation history. If the history shows that you have repeated the exact same speech or track curations in previous turns, you MUST immediately break the pattern by changing your response and acknowledging the user's latest message naturally. If the user says "thanks", "thank you", or greets you, leave the "play" list strictly empty [] so the music continues playing without any interruption!
`;

  const messages = [{ role: 'system', content: systemPrompt }];

  recentMessages.forEach(msg => {
    messages.push({
      role: msg.role === 'claudio' ? 'assistant' : 'user',
      content: msg.content
    });
  });

  const lastMsg = messages[messages.length - 1];
  const isLastMsgUserCurrent = lastMsg && lastMsg.role === 'user' && lastMsg.content === userInput;
  if (userInput !== null && !isLastMsgUserCurrent) {
    messages.push({ role: 'user', content: userInput });
  } else if (userInput === null) {
    messages.push({
      role: 'user',
      content: 'The radio is starting up. Introduce yourself and play something that fits the current vibe.'
    });
  }

  try {
    let response = await axios.post(
      GROQ_URL,
      {
        model: GROQ_MODEL(),
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.7
      },
      { headers: groqHeaders() }
    );

    let messageObj = response.data.choices[0].message;

    if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
      const toolCall = messageObj.tool_calls[0];
      if (toolCall.function.name === 'searchWeb') {
        const args = JSON.parse(toolCall.function.arguments);
        const searchResults = await searchWeb(args.query);

        messages.push(messageObj);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: 'searchWeb',
          content: searchResults || 'Search timed out or returned no results. Proceed with your static knowledge and persona guardrails.'
        });

        response = await axios.post(
          GROQ_URL,
          {
            model: GROQ_MODEL(),
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.7
          },
          { headers: groqHeaders() }
        );

        messageObj = response.data.choices[0].message;
      }
    }

    try {
      let cleanContent = messageObj.content.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      return JSON.parse(cleanContent);
    } catch (parseErr) {
      const formatMessages = [
        {
          role: 'system',
          content: `You are a helper that formats DJ instructions into a strictly valid JSON object.
You MUST strictly extract the DJ speech text from the raw response and place it in the "say" field.
Address the listener as "sir" in the "say" field and ensure it is extremely concise (1-2 sentences).
CRITICAL RULE: Set the "play" array to an empty array [] unless the raw response explicitly requests or names a new song to be played next. DO NOT fabricate or select any similar songs if none were explicitly requested in the raw response.
Return ONLY a JSON object matching this schema:
{
  "say": "The DJ's speech (extremely concise (1-2 sentences), addressing the listener as 'sir')",
  "play": ["Song Name - Artist", ...],
  "reason": "Why these songs were picked (or conversational rationale)",
  "segue": "Transition text between songs (or empty string if just chatting)"
}`
        },
        {
          role: 'user',
          content: `Please format the following raw DJ response into the JSON schema, keeping the play list empty [] if no new track was requested:

Raw Response: ${messageObj.content}`
        }
      ];

      const formatResponse = await axios.post(
        GROQ_URL,
        {
          model: GROQ_MODEL(),
          messages: formatMessages,
          response_format: { type: 'json_object' },
          temperature: 0.2
        },
        { headers: groqHeaders() }
      );

      return JSON.parse(formatResponse.data.choices[0].message.content);
    }
  } catch (err) {
    console.error('Groq AI error:', err.response?.data || err.message);

    const failedGen = err.response?.data?.error?.failed_generation;
    if (failedGen) {
      try {
        const cleanGen = failedGen.trim();
        const firstBrace = cleanGen.indexOf('{');
        const firstBracket = cleanGen.indexOf('[');
        let jsonStart = -1;

        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
          jsonStart = firstBrace;
        } else if (firstBracket !== -1) {
          jsonStart = firstBracket;
        }

        if (jsonStart !== -1) {
          const rawJsonBlock = cleanGen.substring(jsonStart).trim();
          try {
            const parsed = JSON.parse(rawJsonBlock);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
            if (parsed) return parsed;
          } catch {
            try {
              const parsed = JSON.parse(autoCloseJSON(rawJsonBlock));
              if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
              if (parsed) return parsed;
            } catch (repairErr) {
              console.warn('JSON repair failed:', repairErr.message);
            }
          }
        }
      } catch (recoveryErr) {
        console.warn('Recovery failed:', recoveryErr.message);
      }
    }

    return {
      say: "Hey there! I'm having a little trouble thinking right now, but let's keep the music moving.",
      play: ['Blinding Lights - The Weeknd'],
      intent: 'append',
      reason: 'API Fallback',
      segue: 'Back to the hits.'
    };
  }
}

function autoCloseJSON(str) {
  let clean = str.trim();
  if (clean.length === 0) return clean;

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }
  }

  if (inString) clean += '"';

  clean = clean.trim();
  if (clean.endsWith(',')) clean = clean.slice(0, -1).trim();

  while (openBrackets > 0) {
    clean += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    clean += '}';
    openBraces--;
  }

  return clean;
}

module.exports = { getDJResponse };
