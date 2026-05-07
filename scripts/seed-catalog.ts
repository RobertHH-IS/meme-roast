// Pulls every template from memegen.link and emits a skeleton catalog so you
// can pick the funny ones and fill in the `when` field. Run with `npm run seed:catalog`.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

type ApiTemplate = {
  id: string
  name: string
  lines: number
  keywords?: string[]
}

async function main() {
  const res = await fetch('https://api.memegen.link/templates/')
  if (!res.ok) throw new Error('failed: ' + res.status)
  const all = (await res.json()) as ApiTemplate[]

  const skeleton = all.map((t) => ({
    id: t.id,
    name: t.name,
    slots: t.lines,
    when: '' // fill these in for the funny ones
  }))

  const out = join(process.cwd(), 'src/renderer/src/memes/catalog.full.json')
  writeFileSync(out, JSON.stringify(skeleton, null, 2))
  console.log(`Wrote ${skeleton.length} templates to ${out}`)
  console.log('Pick ~50-75, fill `when` fields, save as catalog.json.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
