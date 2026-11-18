// Debug helper: node infra/ai/fixtures/peek.mjs r10 r14   (prints what the model transcribed and what the checks made of it)
import { readFileSync } from 'node:fs'
import { normalise, readReport } from '../report.mjs'

for (const id of process.argv.slice(2)) {
  const image = `data:image/jpeg;base64,${readFileSync(new URL(`./reports/${id}.jpg`, import.meta.url)).toString('base64')}`
  const out = await readReport(image)
  console.log(`--- ${id}`)
  if (!out.ok) {
    console.log(out)
    continue
  }
  for (const v of out.model.values) console.log(`  ${v.field.padEnd(26)} ${String(v.value).padEnd(7)} ${JSON.stringify(v.unit).padEnd(22)} printed ${JSON.stringify(v.printed)}`)
  console.log('  unreadable:', out.model.unreadable.join(', ') || '-')
  const n = normalise(out.model)
  console.log('  =>', JSON.stringify(n.values), n.notes.join(','))
}
