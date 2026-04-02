export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userContent, originalUrl } = req.body;

  let contentToSend = userContent;
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const ytMatch = userContent.match(youtubeRegex);

  if (ytMatch) {
    const videoId = ytMatch[1];
    try {
      const apiRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`
      );
      const apiData = await apiRes.json();
      const snippet = apiData.items?.[0]?.snippet;

      if (snippet) {
        const title = snippet.title || '';
        const description = snippet.description || '';
        contentToSend = `YouTube recipe video titled "${title}". Source URL: ${originalUrl || ''}. Extract the recipe if possible from this description, otherwise just use the title as the recipe name:\n\n${description}`;
      }
    } catch (e) {
      // Silent fail — Groq will handle the raw URL
    }
  }

  const systemPrompt = `You are a recipe extraction expert. Always return valid JSON no matter what — even if there is no recipe, return a card with whatever info is available.

Return ONLY valid JSON, no markdown, no extra text:
{
  "title": "Recipe or video title",
  "cuisine": "e.g. Italian or Unknown",
  "mealType": "Breakfast|Lunch|Dinner|Snack|Dessert",
  "diet": "None|Vegan|Vegetarian|Gluten-Free|Dairy-Free",
  "difficulty": "Easy|Medium|Hard",
  "prepTime": null,
  "cookTime": null,
  "totalTime": null,
  "servings": null,
  "calories": null,
  "image": "most relevant food emoji, or 🍽️ if unknown",
  "tags": [],
  "ingredients": [],
  "steps": [],
  "nutrition": {},
  "editorNote": "",
  "sourceUrl": "always include the original URL here if available",
  "sourceType": "website|youtube|text"
}

IMPORTANT RULES:
- NEVER return an error. Always return JSON.
- If no recipe is found, leave ingredients and steps as empty arrays.
- Always set sourceUrl to the original URL passed in.
- Always pick a reasonable food emoji for image.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentToSend }
      ],
    }),
  });

  const data = await response.json();
  if (data.error) return res.status(500).json({ error: data.error.message });

  try {
    const raw = data.choices?.[0]?.message?.content || '';
    const recipe = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (originalUrl && !recipe.sourceUrl) recipe.sourceUrl = originalUrl;
    res.status(200).json(recipe);
  } catch(e) {
    res.status(500).json({ error: 'Failed to parse recipe response' });
  }
}

  
