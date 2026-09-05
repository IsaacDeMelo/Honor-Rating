import { Router, Request, Response } from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'
import { getReviews, getRecentReviews, getPendingReviews, addReview, approveReview, rejectReview, deleteReviewById, addRpg, updateRpg, deleteRpg, getRpgs, getRpgByName, getUserByToken, toggleFeaturedRpg, setFeaturedOrder, getRpgRatings, attachRpgs, recordVisit, getAnalyticsSummary, getAds, getAllAds, addAd, updateAd, deleteAd, setUserCreators, isCreatorOf, getEventPosts, getEventPostsPaginated, addEventPost, deleteEventPost, getReviewReplies, addReviewReply, deleteReviewReply, getCreatorStats, addReport, getReports, getPendingReportsCount, resolveReport, ReportReason } from '../data'
import ReviewModel from '../models/Review'
import { ReviewInput, RPG } from '../types'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Formato de imagem inválido. Use jpg, png, webp ou gif.'))
    }
  },
})

function uploadToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'rpg-reviewer', resource_type: 'image' },
      (err, result) => {
        if (err) reject(err)
        else resolve(result!.secure_url)
      },
    )
    Readable.from(buffer).pipe(stream)
  })
}

const router = Router()

router.get('/rpgs', async (_req: Request, res: Response) => {
  res.json(await getRpgs())
})

router.get('/rpgs/ratings', async (_req: Request, res: Response) => {
  res.json(await getRpgRatings())
})

router.get('/rpgs/:name', async (req: Request, res: Response) => {
  const rpg = await getRpgByName(String(req.params.name))
  if (!rpg) { res.status(404).json({ error: 'RPG não encontrado.' }); return }
  res.json(rpg)
})

router.get('/reviews', async (req: Request, res: Response) => {
  const rpgFilter = req.query.rpg as string | undefined
  let reviews = await getReviews()
  if (rpgFilter) {
    reviews = reviews.filter(r => r.rpg.name === rpgFilter)
  }
  res.json(reviews)
})

router.post('/reviews', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: 'Autenticação necessária. Faça login primeiro.' })
    return
  }

  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) {
    res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' })
    return
  }

  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'Imagem muito grande. Máximo 5MB.' })
        return
      }
      res.status(400).json({ error: err.message })
      return
    }

    const { rpgName, rating, comment } = req.body

    if (!rpgName || !rating || !comment) {
      res.status(400).json({ error: 'Todos os campos são obrigatórios.' })
      return
    }

    const rpg = await getRpgByName(rpgName)
    if (!rpg) {
      res.status(400).json({ error: 'RPG não encontrado.' })
      return
    }

    const input: ReviewInput = {
      rpgName,
      rating: Number(rating),
      comment,
    }

    if (req.file) {
      try {
        input.customImage = await uploadToCloudinary(req.file.buffer)
      } catch {
        res.status(500).json({ error: 'Erro ao fazer upload da imagem.' })
        return
      }
    }

    const review = await addReview(input, user.username)
    res.status(201).json(review)
  })
})

router.get('/reviews/pending', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const pending = await getPendingReviews()
  res.json(pending)
})

router.patch('/reviews/:id/approve', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const review = await approveReview(String(req.params.id))
  if (!review) { res.status(404).json({ error: 'Avaliação não encontrada.' }); return }
  res.json(review)
})

router.patch('/reviews/:id/reject', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const ok = await rejectReview(String(req.params.id))
  if (!ok) { res.status(404).json({ error: 'Avaliação não encontrada.' }); return }
  res.json({ message: 'Avaliação rejeitada.' })
})

router.delete('/reviews/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) { res.status(401).json({ error: 'Sessão inválida.' }); return }
  const ok = await deleteReviewById(String(req.params.id), user.username, user.role === 'admin')
  if (!ok) { res.status(403).json({ error: 'Não autorizado ou avaliação não encontrada.' }); return }
  res.json({ message: 'Avaliação excluída.' })
})

function uploadRpgImage(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (err, result) => { if (err) reject(err); else resolve(result!.secure_url) },
    )
    Readable.from(buffer).pipe(stream)
  })
}

router.post('/rpgs', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    res.status(401).json({ error: 'Autenticação necessária.' })
    return
  }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) {
    res.status(401).json({ error: 'Sessão inválida.' })
    return
  }

  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ])(req, res, async (err) => {
    if (err) { res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Imagem muito grande. Máximo 30MB.' : 'Erro no upload de imagem.' }); return }

    const { name, owner, genre, year, ageRating, description, link, whatsapp, tags } = req.body
    if (!name || !owner || !genre || !ageRating || !description) {
      res.status(400).json({ error: 'Campos obrigatórios: name, owner, genre, ageRating, description.' })
      return
    }

    const existing = await getRpgByName(name)
    if (existing) {
      res.status(400).json({ error: 'Já existe um RPG com este nome.' })
      return
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

    try {
      let imageUrl = req.body.image || ''
      let bannerUrl = req.body.banner || ''

      if (files?.image?.[0]) imageUrl = await uploadRpgImage(files.image[0].buffer, 'rpg-reviewer/rpgs')
      if (files?.banner?.[0]) bannerUrl = await uploadRpgImage(files.banner[0].buffer, 'rpg-reviewer/rpgs')

      if (!imageUrl) { res.status(400).json({ error: 'Imagem é obrigatória.' }); return }

      let parsedTags
      if (typeof tags === 'string') {
        try { parsedTags = JSON.parse(tags) } catch { parsedTags = undefined }
      } else {
        parsedTags = tags
      }

      const rpg = await addRpg({
        name, owner, genre, year, ageRating, image: imageUrl, banner: bannerUrl || undefined, description, link, whatsapp, tags: parsedTags,
        blurImage: req.body.blurImage === 'true',
        limitedEdition: req.body.limitedEdition === 'true',
        slotsTotal: req.body.slotsTotal !== undefined && req.body.slotsTotal !== '' ? Number(req.body.slotsTotal) : undefined,
        slotsFilled: req.body.slotsFilled !== undefined && req.body.slotsFilled !== '' ? Number(req.body.slotsFilled) : 0,
        closed: req.body.closed === 'true',
      })
      res.status(201).json(rpg)
    } catch {
      res.status(500).json({ error: 'Erro ao fazer upload das imagens.' })
    }
  })
})

router.patch('/rpgs/:name', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores podem editar sistemas.' }); return }

  const rpgName = String(req.params.name)
  const existing = await getRpgByName(rpgName)
  if (!existing) { res.status(404).json({ error: 'Sistema não encontrado.' }); return }

  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ])(req, res, async (err) => {
    if (err) { res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Imagem muito grande. Máximo 30MB.' : 'Erro no upload.' }); return }

    const { owner, genre, year, ageRating, description, link, whatsapp, tags } = req.body
    const updates: Partial<RPG> = {}

    if (owner) updates.owner = owner
    if (genre) updates.genre = genre
    if (year) updates.year = year
    if (ageRating) updates.ageRating = ageRating
    if (description) updates.description = description
    if (link !== undefined) updates.link = link || undefined
    if (whatsapp !== undefined) updates.whatsapp = whatsapp || undefined
    if (req.body.blurImage !== undefined) updates.blurImage = req.body.blurImage === 'true'
    if (req.body.limitedEdition !== undefined) updates.limitedEdition = req.body.limitedEdition === 'true'
    if (req.body.slotsTotal !== undefined) updates.slotsTotal = req.body.slotsTotal === '' ? undefined : Number(req.body.slotsTotal)
    if (req.body.slotsFilled !== undefined) updates.slotsFilled = req.body.slotsFilled === '' ? 0 : Number(req.body.slotsFilled)
    if (req.body.closed !== undefined) updates.closed = req.body.closed === 'true'
    if (tags !== undefined) {
      if (typeof tags === 'string') {
        try { updates.tags = JSON.parse(tags) } catch { /* ignore */ }
      } else {
        updates.tags = tags
      }
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

    try {
      if (files?.image?.[0]) updates.image = await uploadRpgImage(files.image[0].buffer, 'rpg-reviewer/rpgs')
      if (files?.banner?.[0]) updates.banner = await uploadRpgImage(files.banner[0].buffer, 'rpg-reviewer/rpgs')

      const rpg = await updateRpg(rpgName, updates)
      if (!rpg) { res.status(500).json({ error: 'Erro ao atualizar.' }); return }
      res.json(rpg)
    } catch (e) {
      console.error('Erro ao atualizar RPG:', e)
      res.status(500).json({ error: 'Erro ao fazer upload das imagens.' })
    }
  })
})

router.patch('/rpgs/:name/featured', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const rpg = await toggleFeaturedRpg(String(req.params.name))
  if (!rpg) { res.status(404).json({ error: 'RPG não encontrado.' }); return }
  res.json(rpg)
})

router.patch('/rpgs/featured-order', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const { orders } = req.body || {}
  if (!Array.isArray(orders)) { res.status(400).json({ error: 'orders deve ser uma lista [{name, order}].' }); return }
  const clean = orders
    .filter(o => o && typeof o.name === 'string' && typeof o.order === 'number')
    .map(o => ({ name: String(o.name), order: Number(o.order) }))
  await setFeaturedOrder(clean)
  res.json({ ok: true, updated: clean.length })
})

router.delete('/rpgs/:name', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores podem excluir sistemas.' }); return }

  const ok = await deleteRpg(String(req.params.name))
  if (!ok) { res.status(404).json({ error: 'Sistema não encontrado.' }); return }
  res.json({ message: 'Sistema excluído.' })
})

router.get('/reviews/feed', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
  const skip = parseInt(req.query.skip as string) || 0
  const docs = await ReviewModel.find({ status: 'approved' }).sort({ createdAt: -1 }).skip(skip).limit(limit)
  res.json(await attachRpgs(docs))
})

router.get('/feed/events', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
  const skip = parseInt(req.query.skip as string) || 0
  res.json(await getEventPostsPaginated(skip, limit))
})

router.post('/analytics', async (req: Request, res: Response) => {
  const { type, rpg, query } = req.body || {}
  if (type === 'rpgview' && typeof rpg === 'string' && rpg) {
    recordVisit('rpgview', { rpg })
  } else if (type === 'search' && typeof query === 'string' && query) {
    recordVisit('search', { query })
  }
  res.json({ ok: true })
})

router.get('/analytics/summary', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  res.json(await getAnalyticsSummary())
})

// ── ADS ──
function parseCreativeArray(raw: any): any[] {
  if (!raw) return []
  let arr = raw
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(arr)) return []
  return arr
}

function parseCreativeMeta(raw: any): { placement?: 'hero' | 'catalog' | 'both'; slot?: number; format?: 'wide' | 'square' | 'poster' } {
  if (!raw) return {}
  let obj = raw
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw) } catch { return {} }
  }
  return {
    placement: ['hero', 'catalog', 'both'].includes(obj.placement) ? obj.placement : undefined,
    slot: obj.slot !== undefined && obj.slot !== '' ? Number(obj.slot) : undefined,
    format: ['wide', 'square', 'poster'].includes(obj.format) ? obj.format : undefined,
  }
}

router.get('/ads', async (_req: Request, res: Response) => {
  res.json(await getAds())
})

router.get('/ads/all', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  res.json(await getAllAds())
})

router.post('/ads', upload.array('images', 10), async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const { title, link, description } = req.body
  if (!title) { res.status(400).json({ error: 'Campo obrigatório: title.' }); return }
  const files = (req.files as Express.Multer.File[]) || []
  if (!files.length) { res.status(400).json({ error: 'Envie ao menos uma imagem para o anúncio.' }); return }
  const metas = parseCreativeArray(req.body.creatives)
  const creatives: Array<{ image: string; placement: 'hero' | 'catalog' | 'both'; slot: number; format: 'wide' | 'square' | 'poster' }> = []
  for (let i = 0; i < files.length; i++) {
    let image: string
    try {
      image = await uploadToCloudinary(files[i].buffer)
    } catch {
      res.status(500).json({ error: 'Falha ao enviar a imagem.' }); return
    }
    const m = metas[i] || {}
    creatives.push({
      image,
      placement: m.placement === 'catalog' || m.placement === 'both' || m.placement === 'hero' ? m.placement : 'hero',
      slot: m.slot !== undefined && m.slot !== '' ? Number(m.slot) : 0,
      format: m.format === 'square' || m.format === 'poster' ? m.format : 'wide',
    })
  }
  const ad = await addAd({ title, link, description, active: req.body.active === 'false' ? false : true, creatives })
  res.status(201).json(ad)
})

router.patch('/ads/:id', upload.array('images', 10), async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const update: { title?: string; description?: string; link?: string; active?: boolean; creatives?: Array<{ image: string; placement: 'hero' | 'catalog' | 'both'; slot: number; format: 'wide' | 'square' | 'poster' }> } = {}
  if (req.body.title !== undefined) update.title = req.body.title
  if (req.body.link !== undefined) update.link = req.body.link
  if (req.body.description !== undefined) update.description = req.body.description
  if (req.body.active !== undefined) update.active = req.body.active === true || req.body.active === 'true'
  const files = (req.files as Express.Multer.File[]) || []
  if (files.length || req.body.removeCreatives !== undefined || req.body.creativesMeta !== undefined || req.body.addCreatives !== undefined) {
    const all = await getAllAds()
    const ad = all.find(a => a.id === String(req.params.id))
    if (!ad) { res.status(404).json({ error: 'Anúncio não encontrado.' }); return }
    const creatives = ad.creatives.map(c => ({ ...c }))
    if (req.body.creativesMeta !== undefined) {
      const meta = parseCreativeArray(req.body.creativesMeta)
      for (const m of meta) {
        const mm = parseCreativeMeta(m)
        const idx = Number(m && m.index)
        if (m && typeof idx === 'number' && creatives[idx]) {
          if (mm.placement) creatives[idx].placement = mm.placement
          if (mm.format) creatives[idx].format = mm.format
          if (mm.slot !== undefined) creatives[idx].slot = mm.slot
        }
      }
    }
    if (req.body.removeCreatives !== undefined) {
      let idxs: number[] = []
      try { idxs = JSON.parse(req.body.removeCreatives) } catch { idxs = [] }
      update.creatives = creatives.filter((_c, i) => !idxs.includes(i))
    } else {
      update.creatives = creatives
    }
    const adds = parseCreativeArray(req.body.addCreatives)
    for (let i = 0; i < files.length; i++) {
      let image: string
      try {
        image = await uploadToCloudinary(files[i].buffer)
      } catch {
        res.status(500).json({ error: 'Falha ao enviar a imagem.' }); return
      }
      const m = adds[i] || {}
      update.creatives.push({
        image,
        placement: m.placement === 'catalog' || m.placement === 'both' || m.placement === 'hero' ? m.placement : 'hero',
        slot: m.slot !== undefined && m.slot !== '' ? Number(m.slot) : 0,
        format: m.format === 'square' || m.format === 'poster' ? m.format : 'wide',
      })
    }
  }
  const ad = await updateAd(String(req.params.id), update)
  if (!ad) { res.status(404).json({ error: 'Anúncio não encontrado.' }); return }
  res.json(ad)
})

router.delete('/ads/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const ok = await deleteAd(String(req.params.id))
  if (!ok) { res.status(404).json({ error: 'Anúncio não encontrado.' }); return }
  res.json({ message: 'Anúncio excluído.' })
})

// ── CRIADORES (Selo) ──
router.patch('/creators/:username', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const rpgNames = req.body.rpgNames
  if (!Array.isArray(rpgNames)) { res.status(400).json({ error: 'rpgNames deve ser uma lista.' }); return }
  const updated = await setUserCreators(String(req.params.username), rpgNames)
  if (!updated) { res.status(404).json({ error: 'Usuário não encontrado.' }); return }
  res.json(updated)
})

router.get('/creators/:username/stats', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) { res.status(401).json({ error: 'Sessão inválida.' }); return }
  if (user.username !== String(req.params.username) && user.role !== 'admin') { res.status(403).json({ error: 'Apenas o próprio criador ou administradores.' }); return }
  const stats = await getCreatorStats(String(req.params.username))
  if (!stats) { res.status(404).json({ error: 'Usuário não encontrado.' }); return }
  res.json(stats)
})

// ── POSTAGENS DE EVENTOS ──
router.get('/posts', async (_req: Request, res: Response) => {
  res.json(await getEventPosts())
})

router.post('/posts', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) { res.status(401).json({ error: 'Sessão inválida.' }); return }
  const { rpgName, title, content } = req.body
  if (!rpgName || !title || !content) { res.status(400).json({ error: 'Campos obrigatórios: rpgName, title, content.' }); return }
  if (!isCreatorOf(user, rpgName)) { res.status(403).json({ error: 'Apenas criadores do sistema podem postar eventos.' }); return }
  const post = await addEventPost({ username: user.username, rpgName, title, content })
  res.status(201).json(post)
})

router.delete('/posts/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) { res.status(401).json({ error: 'Sessão inválida.' }); return }
  const ok = await deleteEventPost(String(req.params.id), user.username, user.role === 'admin')
  if (!ok) { res.status(403).json({ error: 'Sem permissão ou postagem não encontrada.' }); return }
  res.json({ message: 'Postagem excluída.' })
})

// ── RESPOSTAS A AVALIAÇÕES ──
router.get('/reviews/:id/replies', async (req: Request, res: Response) => {
  res.json(await getReviewReplies(String(req.params.id)))
})

router.post('/reviews/:id/replies', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) { res.status(401).json({ error: 'Sessão inválida.' }); return }
  const { content } = req.body
  if (!content) { res.status(400).json({ error: 'Conteúdo da resposta é obrigatório.' }); return }
  const review = await ReviewModel.findById(String(req.params.id))
  if (!review) { res.status(404).json({ error: 'Avaliação não encontrada.' }); return }
  if (!isCreatorOf(user, review.rpgName)) { res.status(403).json({ error: 'Apenas criadores do sistema podem responder avaliações.' }); return }
  const reply = await addReviewReply(String(req.params.id), user.username, content)
  if (!reply) { res.status(404).json({ error: 'Avaliação não encontrada.' }); return }
  res.status(201).json(reply)
})

router.delete('/replies/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const token = authHeader.replace('Bearer ', '')
  const user = await getUserByToken(token)
  if (!user) { res.status(401).json({ error: 'Sessão inválida.' }); return }
  const ok = await deleteReviewReply(String(req.params.id), user.username, user.role === 'admin')
  if (!ok) { res.status(403).json({ error: 'Sem permissão ou resposta não encontrada.' }); return }
  res.json({ message: 'Resposta excluída.' })
})

// ── DENÚNCIAS ──
router.post('/reports', async (req: Request, res: Response) => {
  const { rpgName, reason, description, evidence } = req.body || {}
  if (!rpgName || !reason || !description) { res.status(400).json({ error: 'Campos obrigatórios: rpgName, reason, description.' }); return }
  if (!['golpe', 'inativo', 'falso'].includes(reason)) { res.status(400).json({ error: 'Motivo inválido.' }); return }
  if (String(description).trim().length < 5) { res.status(400).json({ error: 'Descreva com um pouco mais de detalhe.' }); return }
  const rpg = await getRpgByName(String(rpgName))
  if (!rpg) { res.status(404).json({ error: 'RPG não encontrado.' }); return }
  let reporter: string | undefined
  const authHeader = req.headers.authorization
  if (authHeader) {
    const u = await getUserByToken(authHeader.replace('Bearer ', ''))
    if (u) reporter = u.username
  }
  const report = await addReport({
    rpgName: String(rpgName),
    reporter,
    reason: reason as ReportReason,
    description: String(description).slice(0, 2000),
    evidence: evidence ? String(evidence).slice(0, 2000) : undefined,
  })
  res.status(201).json(report)
})

router.get('/reports', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const user = await getUserByToken(authHeader.replace('Bearer ', ''))
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  res.json(await getReports(String(req.query.status || 'all')))
})

router.get('/reports/pending-count', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const user = await getUserByToken(authHeader.replace('Bearer ', ''))
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  res.json({ pending: await getPendingReportsCount() })
})

router.patch('/reports/:id', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader) { res.status(401).json({ error: 'Autenticação necessária.' }); return }
  const user = await getUserByToken(authHeader.replace('Bearer ', ''))
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Apenas administradores.' }); return }
  const { action, adminNote } = req.body || {}
  if (!['dismiss', 'resolve'].includes(action)) { res.status(400).json({ error: 'action deve ser dismiss ou resolve.' }); return }
  const updated = await resolveReport(String(req.params.id), action, adminNote ? String(adminNote) : undefined)
  if (!updated) { res.status(404).json({ error: 'Denúncia não encontrada.' }); return }
  res.json(updated)
})

export default router
