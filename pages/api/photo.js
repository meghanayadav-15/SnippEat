export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64, mimeType = 'image/jpeg' } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

  const systemPrompt = `You are a recipe extraction expert. The user has sent you a photo of a recipe — handwritten, printed, or from a cookbook. Extract everything you can see and return ONLY valid JSON, no markdown, no extra text:
{
  "title": "Recipe title",
  "cuisine": "e.g. Italian or Unknown",
  "mealType": "Breakfast|Lunch|Dinner|Snack|Dessert",
  "diet": "None|Vegan|Vegetarian|Gluten-Free|Dairy-Free",
  "difficulty": "Easy|Medium|Hard",
  "prepTime": null,
  "cookTime": null,
  "totalTime": null,
  "servings": null,
  "calories": null,
  "image": "most relevant food emoji",
  "tags": [],
  "ingredients": ["list every ingredient with quantity"],
  "steps": ["every step in order"],
  "nutrition": {},
  "editorNote": "",
  "sourceUrl": "",
  "sourceType": "photo"
}
IMPORTANT: Always return valid JSON. Never return an error message. If you can't read something clearly, make a reasonable guess.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-4-scout-17b-16e-instruct',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Please extract the recipe from this photo.',
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  if (data.error) return res.status(500).json({ error: data.error.message });

  try {
    const raw = data.choices?.[0]?.message?.content || '';
    const recipe = JSON.parse(raw.replace(/```json|```/g, '').trim());
    recipe.sourceType = 'photo';
    res.status(200).json(recipe);
  } catch (e) {
    res.status(500).json({ error: 'Failed to parse recipe from photo' });
  }
}
