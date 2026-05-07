const ENDPOINT = 'https://api.openai.com/v1/realtime/client_secrets'

export type EphemeralKey = {
  value: string
  expires_at: number
  session: { id: string; model: string }
}

export async function mintEphemeralKey(): Promise<EphemeralKey> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !apiKey.startsWith('sk-')) {
    throw new Error(
      'OPENAI_API_KEY missing or malformed. Copy .env.example to .env and paste your key.'
    )
  }

  const model = process.env.OPENAI_REALTIME_MODEL ?? 'gpt-realtime'

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model,
        output_modalities: ['text']
      }
    })
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ephemeral key request failed: ${res.status} ${body}`)
  }

  return (await res.json()) as EphemeralKey
}
