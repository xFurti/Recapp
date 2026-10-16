import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const categories = new Set(['feature', 'improvement', 'fix'])
const fail = (message) => { throw new Error(message) }
function localized(value, name) {
  for (const lang of ['it', 'en']) {
    if (typeof value?.[lang] !== 'string' || !value[lang].trim()) fail(`${name}: missing ${lang} text`)
  }
}
function safeLink(value, image = false) {
  if (typeof value !== 'string' || !(/^(https:\/\/[^\s]+|\/(?!\/)[^\s\\]*)$/).test(value)) fail(`Unsafe URL: ${value}`)
  if (image && !value.startsWith('/')) fail('Images must ship with the app')
}
export function collect(directory = resolve(root, 'release-notes')) {
  const records = readdirSync(directory).filter((name) => name.endsWith('.json')).map((name) => {
    const note = JSON.parse(readFileSync(resolve(directory, name), 'utf8'))
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(note.id)) fail(`${name}: invalid release id`)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(note.published_at) || !Number.isFinite(Date.parse(note.published_at))) fail(`${name}: invalid date`)
    if (note.visibility === 'internal') {
      localized(note.reason, `${name} reason (Nessuna novità da mostrare)`)
      return note
    }
    if (note.visibility !== 'public') fail(`${name}: choose public or internal`)
    localized(note.title, `${name} title`)
    if (!Array.isArray(note.summary) || note.summary.length < 3 || note.summary.length > 5) fail(`${name}: provide 3–5 summary points`)
    note.summary.forEach((point) => localized(point, `${name} summary`))
    if (!Array.isArray(note.entries) || !note.entries.length) fail(`${name}: empty release`)
    for (const entry of note.entries) {
      if (!categories.has(entry.category)) fail(`${name}: invalid category`)
      localized(entry.title, `${name} entry title`)
      localized(entry.body, `${name} entry body`)
      if (entry.link) {
        safeLink(entry.link.href)
        localized(entry.link.label, `${name} link label`)
        if (typeof entry.link.requires_login !== 'boolean') fail(`${name}: declare link access`)
      }
      if (entry.image) {
        safeLink(entry.image.src, true)
        localized(entry.image.alt, `${name} image alt`)
      }
    }
    return note
  }).sort((a, b) => b.published_at.localeCompare(a.published_at) || b.id.localeCompare(a.id))
  if (new Set(records.map((note) => note.id)).size !== records.length) fail('Duplicate release id')
  return { current: records[0]?.visibility === 'public' ? records[0].id : null, releases: records.filter((note) => note.visibility === 'public') }
}

// The team's PR review approves the text. CI requires a new note (or an explicit
// internal declaration) and prevents silently rewriting already released history.
if (process.argv.includes('--check-pr')) {
  const base = process.argv[process.argv.indexOf('--check-pr') + 1]
  const changes = execFileSync('git', ['diff', '--name-status', `${base}...HEAD`, '--', 'release-notes/*.json'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  if (!changes.length) fail('Add release-notes/<unique-id>.json, or declare Nessuna novità da mostrare with visibility: internal')
  if (changes.some((line) => !line.startsWith('A\t'))) fail('Released notes are immutable: add a new file instead of editing history')
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = collect(process.env.RELEASE_NOTES_DIR)
  process.stdout.write(process.argv.includes('--json') ? JSON.stringify(manifest) : `Release notes validated: ${manifest.releases.length} public release(s)\n`)
}
