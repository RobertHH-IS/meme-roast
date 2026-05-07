const ENCODE_MAP: Array<[RegExp, string]> = [
  [/_/g, '__'],
  [/-/g, '--'],
  [/ /g, '_'],
  [/\?/g, '~q'],
  [/&/g, '~a'],
  [/%/g, '~p'],
  [/#/g, '~h'],
  [/\//g, '~s'],
  [/\\/g, '~b'],
  [/</g, '~l'],
  [/>/g, '~g'],
  [/"/g, "''"],
  [/\n/g, '~n']
]

export function encodeCaption(text: string): string {
  if (!text) return '_'
  let out = text
  for (const [pattern, replacement] of ENCODE_MAP) {
    out = out.replace(pattern, replacement)
  }
  return out
}

export function buildMemeUrl(templateId: string, captions: string[]): string {
  const encoded = captions.map(encodeCaption).join('/')
  return `https://api.memegen.link/images/${templateId}/${encoded}.png`
}
