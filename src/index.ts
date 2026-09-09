import dns from 'node:dns';

dns.setServers([
  '8.8.8.8',
  '8.8.4.4',
]);

import 'dotenv/config'
import express from 'express'
import path from 'path'
import { v2 as cloudinary } from 'cloudinary'
import publicRouter, { getPageData } from './routes/public'
import apiRouter from './routes/api'
import authRouter from './routes/auth'
import { connectDatabase } from './database'
import { toSlug, getRpgs, recordVisit, cleanupOrphans } from './data'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const app = express()

app.set('trust proxy', 1)
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

app.get('/robots.txt', function(req, res) {
  const host = req.get('host')
  const base = req.protocol + '://' + host
  res.type('text/plain')
  res.send('User-agent: *\nAllow: /\nSitemap: ' + base + '/sitemap.xml\n')
})

app.get('/sitemap.xml', function(req, res, next) {
  Promise.resolve().then(async function() {
    const rpgs = await getRpgs()
    const host = req.get('host')
    const base = req.protocol + '://' + host
    const urls = rpgs.map(r => `  <url>\n    <loc>${base}/rpg/${toSlug(r.name)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`).join('\n')
    res.header('Content-Type', 'application/xml')
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${base}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n${urls}\n</urlset>`)
  }).catch(next)
})

app.get('/rpg/:slug', function(req, res, next) {
  Promise.resolve().then(async function() {
    const { slug: rawSlug } = req.params
    if (!rawSlug) { res.redirect('/'); return }
    const slug = toSlug(rawSlug)
    const rpgs = await getRpgs()
    const rpg = rpgs.find(r => toSlug(r.name) === slug)
    if (!rpg) {
      const data = await getPageData()
      res.status(404).render('public', {
        ...data,
        metaTitle: 'RPG não encontrado | Rpflix',
        metaDescription: 'O RPG que você procura não existe ou foi removido.',
        canonicalUrl: `/rpg/${slug}`,
        ogImage: '',
        ogUrl: `/rpg/${slug}`,
      })
      return
    }

    const data = await getPageData()
    const desc = rpg.description.substring(0, 160)
    recordVisit('rpgview', { rpg: rpg.name })
    res.render('public', {
      ...data,
      initialRpg: rpg.name,
      metaTitle: `${rpg.name} — Avaliações e Críticas | Rpflix`,
      metaDescription: desc,
      canonicalUrl: `/rpg/${slug}`,
      ogImage: rpg.image,
      ogUrl: `/rpg/${slug}`,
    })
  }).catch(next)
})

app.use('/', publicRouter)
app.use('/public', publicRouter)
app.use('/api', apiRouter)
app.use('/api/auth', authRouter)

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`App is running on http://localhost:${PORT}`)
})

// 2. Chame a conexão do banco em segundo plano de forma independente
console.log('Tentando conectar ao banco de dados...')
connectDatabase()
  .then(async () => {
    console.log('MongoDB conectado com sucesso!')
    try {
      const r = await cleanupOrphans()
      const total = r.reviews + r.replies + r.eventPosts + r.visits
      if (total > 0) console.log(`Limpeza automática de órfãos: ${JSON.stringify(r)}`)
    } catch (e) {
      console.error('Falha na limpeza automática de órfãos:', e)
    }
  })
  .catch((err) => {
    console.error('Erro crítico ao conectar no MongoDB:', err)
  })
