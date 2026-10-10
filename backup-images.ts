import 'dotenv/config'
import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import Rpg from './src/models/Rpg'
import User from './src/models/User'
import Review from './src/models/Review'
import EventPost from './src/models/EventPost'
import Ad from './src/models/Ad'
import Report from './src/models/Report'
import ChatMessage from './src/models/ChatMessage'
import RpgSubmission from './src/models/RpgSubmission'

const OUT = path.join(process.cwd(), 'backup-images')
const MANIFEST: Record<string, string> = {}
let ok = 0, fail = 0, skip = 0

function safeName(url: string, prefix: string, idx: number) {
  try {
    const u = new URL(url)
    const ext = path.extname(u.pathname) || '.jpg'
    const base = path.basename(u.pathname, ext).slice(0, 40) || 'img'
    return `${prefix}-${idx}-${base}${ext}`
  } catch { return `${prefix}-${idx}.jpg` }
}

async function download(url: string, dest: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  await fs.promises.writeFile(dest, buf)
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI ausente')
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Conectado. Coletando URLs...')

  const urls: { url: string; subdir: string; prefix: string }[] = []

  const rpgs = await Rpg.find()
  rpgs.forEach((r, i) => {
    if (r.image) urls.push({ url: r.image, subdir: 'rpgs', prefix: `rpg-${r.name}` })
    if (r.banner) urls.push({ url: r.banner, subdir: 'rpgs', prefix: `rpg-${r.name}-banner` })
  })
  const users = await User.find()
  users.forEach(u => { if (u.avatar) urls.push({ url: u.avatar, subdir: 'avatars', prefix: `avatar-${u.username}` }) })
  const reviews = await Review.find()
  reviews.forEach(r => { if (r.customImage) urls.push({ url: r.customImage, subdir: 'reviews', prefix: `review-${r._id}` }) })
  const posts = await EventPost.find()
  posts.forEach(p => { if (p.image) urls.push({ url: p.image, subdir: 'posts', prefix: `post-${p._id}` }) })
  const ads = await Ad.find()
  ads.forEach(a => (a.creatives || []).forEach((c, j) => { if (c.image) urls.push({ url: c.image, subdir: 'ads', prefix: `ad-${a._id}-${j}` }) }))
  const reports = await Report.find()
  reports.forEach(r => (r.evidenceImages || []).forEach((img, j) => urls.push({ url: img, subdir: 'reports', prefix: `report-${r._id}-${j}` })))
  const chats = await ChatMessage.find()
  chats.forEach(m => { if (m.image) urls.push({ url: m.image, subdir: 'chat', prefix: `chat-${m._id}` }) })
  const subs = await RpgSubmission.find()
  subs.forEach(s => {
    if (s.image) urls.push({ url: s.image, subdir: 'submissions', prefix: `sub-${s._id}` })
    if (s.banner) urls.push({ url: s.banner, subdir: 'submissions', prefix: `sub-${s._id}-banner` })
  })

  const unique = new Map<string, typeof urls[0]>()
  urls.forEach(u => { if (u.url && !unique.has(u.url)) unique.set(u.url, u) })
  const list = [...unique.values()]
  console.log(`Total URLs únicas: ${list.length} (rpgs:${rpgs.length} users:${users.length} reviews:${reviews.length})`)

  // testa 1 URL pra ver se ainda serve
  if (list[0]) {
    try {
      const r = await fetch(list[0].url, { method: 'HEAD' })
      console.log(`Teste HEAD ${list[0].url.slice(0, 80)}... -> ${r.status} ${r.statusText}`)
    } catch (e: any) { console.log('Teste HEAD falhou:', e.message) }
  }

  let idx = 0
  const concurrency = 5
  const queue = [...list.entries()]

  async function worker() {
    while (queue.length) {
      const [i, u] = queue.shift()!
      const dest = path.join(OUT, u.subdir, safeName(u.url, u.prefix.replace(/[^a-z0-9-_]/gi, '_'), i))
      try {
        await download(u.url, dest)
        MANIFEST[u.url] = path.relative(process.cwd(), dest)
        ok++
        console.log(`[${++idx}/${list.length}] OK ${u.subdir}/${path.basename(dest)}`)
      } catch (e: any) {
        fail++
        console.log(`[${++idx}/${list.length}] FAIL ${u.url.slice(0, 90)} -> ${e.message}`)
      }
      // leve pausa pra não tomar rate limit
      await new Promise(r => setTimeout(r, 80))
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  await fs.promises.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(MANIFEST, null, 2))
  console.log(`\n=== FIM === OK:${ok} FAIL:${fail} TOTAL:${list.length}`)
  console.log(`Backup em: ${OUT}`)
  console.log(`Manifesto: ${path.join(OUT, 'manifest.json')}`)
  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
