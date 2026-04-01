export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userContent } = req.body;

  let contentToSend = userContent;
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const ytMatch = userContent.match(youtubeRegex);

  if (ytMatch) {
    const videoId = ytMatch[1];
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      const html = await pageRes.text();

      // Try to extract description
      const descMatch = html.match(/"attributedDescriptionBodyText":\{"content":"([\s\S]*?)","commandRuns/);
      const desc = descMatch
        ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
        : null;

      if (desc && desc.length > 100) {
        contentToSend = `YouTube recipe video description. Extract the recipe:\n\n${desc}`;
      } else {
        // Fall back to video title only
        const titleMatch = html.match(/"title":"(.*?)","lengthSeconds"/);
        const title = titleMatch ? titleMatch[1] : 'YouTube recipe';
        contentToSend = `Extract a recipe for: ${title}`;
      }
    } catch (e) {
      // Silent fail — Groq will handle the raw URL
    }
  }

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
        { role: 'system', content: 'You are a recipe extraction expert. Extract and structure recipes into clean JSON. Return ONLY valid JSON, no markdown: {"title":"Recipe title","cuisine":"e.g. Italian","mealType":"Breakfast|Lunch|Dinner|Snack|Dessert","diet":"None|Vegan|Vegetarian|Gluten-Free|Dairy-Free","difficulty":"Easy|Medium|Hard","prepTime":15,"cookTime":30,"totalTime":45,"servings":4,"calories":450,"image":"food emoji","tags":["tag1","tag2"],"ingredients":["200g ingredient"],"steps":["Step one."],"nutrition":{"calories":450,"protein":"20g","carbs":"45g","fat":"15g"},"editorNote":"One useful tip.","sourceUrl":"url or empty","sourceType":"website|youtube|text"}' },
        { role: 'user', content: contentToSend }
      ],
    }),
  });

  const data = await response.json();
  if (data.error) return res.status(500).json({ error: data.error.message });

  const raw = data.choices?.[0]?.message?.content || '';
  const recipe = JSON.parse(raw.replace(/```json|```/g, '').trim());
  res.status(200).json(recipe);
}
