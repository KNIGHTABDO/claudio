const axios = require('axios');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { getContextData } = require('./context');
const { searchWeb } = require('./search');
require('dotenv').config();

const tools = [
  {
    type: 'function',
    function: {
      name: 'searchWeb',
      description: 'Search the web using Jina AI to research music, artist facts, new albums, release dates, tracklists, or real-time cultural knowledge.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to send to Jina AI (e.g., "Moroccan rapper STORMY new album" or "dizzy dross omar track list").'
          }
        },
        required: ['query']
      }
    }
  }
];

async function getDJResponse(userInput = null) {
  // 1. Fetch message history first
  let recentMessages = [];
  try {
    recentMessages = await db.getRecentMessages(10);
  } catch (dbErr) {
    console.error('[DJ Brain] Failed to fetch message history:', dbErr);
  }

  // 2. Fetch structured environment context
  let ctxData;
  try {
    ctxData = await getContextData();
  } catch (err) {
    console.error('[DJ Brain] Failed to fetch context data:', err);
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

  // 3. Assemble dynamic System Prompt
  let systemPrompt = `You are Claudio, a personalized, 24-hour online AI radio station and DJ.
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
You have access to the \`searchWeb\` tool which searches the web using Jina AI. 
If the user asks about an artist, song, album, tracklist, or release date you do not fully know, or if you need real-time data to verify music facts (such as whether an artist is a pop singer or rapper), you MUST call the \`searchWeb\` tool with a highly specific search query.
Once you receive the tool response, weave the returned facts into your DJ introduction speech. Keep it natural and conversational!

[OUTPUT FORMAT]
You MUST output a strictly valid JSON object matching the following schema at all times (do not include markdown code block formatting like \`\`\`json, just return the raw JSON object directly):
{
  "say": "The DJ's intro speech (extremely concise (1-2 sentences), addressing the listener as 'sir')",
  "play": ["Song Name - Artist", ...],
  "reason": "Why these songs were picked (or conversational rationale)",
  "segue": "Transition text between songs (or empty string if just chatting)"
}
`;

  // 4. Construct standard messages array with history
  const messages = [{ role: 'system', content: systemPrompt }];
  
  recentMessages.forEach(msg => {
    messages.push({
      role: msg.role === 'claudio' ? 'assistant' : 'user',
      content: msg.content
    });
  });

  // Safety check: Ensure the current user input is at the end of the history
  const lastMsg = messages[messages.length - 1];
  const isLastMsgUserCurrent = lastMsg && lastMsg.role === 'user' && lastMsg.content === userInput;
  if (userInput !== null && !isLastMsgUserCurrent) {
    messages.push({
      role: 'user',
      content: userInput
    });
  } else if (userInput === null) {
    // Session startup curation: Always append startup prompt
    messages.push({
      role: 'user',
      content: 'The radio is starting up. Introduce yourself and play something that fits the current vibe.'
    });
  }

  try {
    console.log('[DJ Brain] Initiating API call to Groq...');
    let response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let messageObj = response.data.choices[0].message;

    // 5. Handle native Tool Calls
    if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
      const toolCall = messageObj.tool_calls[0];
      if (toolCall.function.name === 'searchWeb') {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[DJ Brain] Model requested tool searchWeb for query: "${args.query}"`);
        
        // Execute search with Jina AI Search API
        const searchResults = await searchWeb(args.query);
        console.log(`[DJ Brain] Tool execution finished. Character length: ${searchResults ? searchResults.length : 0}`);

        // Append tool call and response to messages history
        messages.push(messageObj);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: 'searchWeb',
          content: searchResults || 'Search timed out or returned no results. Proceed with your static knowledge and persona guardrails.'
        });

        // Resend to Groq to generate the final response incorporating the search findings
        console.log('[DJ Brain] Resending query to Groq with research findings...');
        response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.7
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        messageObj = response.data.choices[0].message;
      }
    }

    console.log('[DJ Brain] Final decision generated.');
    
    // 6. Resilient JSON formatting safety check
    try {
      let cleanContent = messageObj.content.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      return JSON.parse(cleanContent);
    } catch (parseErr) {
      console.warn('[DJ Brain] First call did not return valid JSON. Formatting via fast second call...');
      
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
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: formatMessages,
          response_format: { type: "json_object" },
          temperature: 0.2
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return JSON.parse(formatResponse.data.choices[0].message.content);
    }
  } catch (err) {
    console.error('Groq AI Error:', err.response?.data || err.message);
    
    // Attempt to recover from Groq's native tool-use parsing failures
    const failedGen = err.response?.data?.error?.failed_generation;
    if (failedGen) {
      try {
        console.log('[DJ Brain] Attempting to recover from Groq failed_generation error...');
        let cleanGen = failedGen.trim();
        
        // Find the boundaries of the JSON block (either array or object)
        const firstBrace = cleanGen.indexOf('{');
        const firstBracket = cleanGen.indexOf('[');
        const lastBrace = cleanGen.lastIndexOf('}');
        const lastBracket = cleanGen.lastIndexOf(']');
        
        let jsonStart = -1;
        let jsonEnd = -1;
        
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
          jsonStart = firstBrace;
          jsonEnd = lastBrace;
        } else if (firstBracket !== -1) {
          jsonStart = firstBracket;
          jsonEnd = lastBracket;
        }
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const jsonSubStr = cleanGen.substring(jsonStart, jsonEnd + 1).trim();
          const parsed = JSON.parse(jsonSubStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log('[DJ Brain] Successfully recovered JSON array from failed_generation substring!');
            return parsed[0];
          } else if (parsed) {
            console.log('[DJ Brain] Successfully recovered JSON object from failed_generation substring!');
            return parsed;
          }
        } else {
          console.warn('[DJ Brain] No JSON block structures found in failed_generation.');
        }
      } catch (recoveryErr) {
        console.warn('[DJ Brain] Failed to recover JSON from failed_generation:', recoveryErr.message);
      }
    }

    // Return a safe fallback if AI fails completely
    return {
      say: "Hey there! I'm having a little trouble thinking right now, but let's keep the music moving.",
      play: ["Blinding Lights - The Weeknd"],
      intent: "append",
      reason: "API Fallback",
      segue: "Back to the hits."
    };
  }
}

module.exports = { getDJResponse };

