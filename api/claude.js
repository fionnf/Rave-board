export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not set in environment variables' })
  }
  try {
    // Convert Anthropic-style request → OpenAI format
    const { system, messages, max_tokens } = req.body
    const openaiMessages = []
    if (system) openaiMessages.push({ role: 'system', content: system })
    if (messages) openaiMessages.push(...messages)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: openaiMessages,
        max_tokens: max_tokens || 1000,
      }),
    })
    const data = await response.json()

    // Convert OpenAI response → Anthropic-style so frontend needs no changes
    const text = data.choices?.[0]?.message?.content ?? ''
    res.json({ content: [{ type: 'text', text }] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
