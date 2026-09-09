import { randomBytes, scryptSync } from 'crypto'
import Rpg from './models/Rpg'
import ReviewModel from './models/Review'
import UserModel from './models/User'
import SessionModel from './models/Session'
import AdModel from './models/Ad'
import EventPostModel from './models/EventPost'
import ReviewReplyModel from './models/ReviewReply'
import ReportModel from './models/Report'
import RpgSubmissionModel from './models/RpgSubmission'
import ChatMessageModel from './models/ChatMessage'
import VisitModel, { VisitType } from './models/Visit'
import { RPG, Review, ReviewInput, User, ReviewReply, EventPost, ChatMessage } from './types'

export function toSlug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function calcTimeAgo(createdAt: string | Date): string {
  const diff = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Agora mesmo'
  if (mins < 60) return `${mins} min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h atrás`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d atrás`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mês atrás`
  return `${Math.floor(months / 12)} ano atrás`
}

function rpgFromDoc(doc: any): RPG {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    name: o.name,
    owner: o.owner,
    genre: o.genre,
    image: o.image,
    banner: o.banner || '',
    description: o.description,
    link: o.link,
    whatsapp: o.whatsapp,
    year: o.year,
    ageRating: o.ageRating,
    featured: o.featured ?? false,
    featuredOrder: o.featuredOrder ?? 0,
    blurImage: o.blurImage ?? false,
    limitedEdition: o.limitedEdition ?? false,
    slotsTotal: o.slotsTotal,
    slotsFilled: o.slotsFilled ?? 0,
    closed: o.closed ?? false,
    tags: o.tags || [],
  }
}

function reviewFromDoc(doc: any, rpg: RPG): Review {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    rpg,
    username: o.username,
    rating: o.rating,
    comment: o.comment,
    customImage: o.customImage,
    status: o.status || 'approved',
    likes: o.likes || [],
    dislikes: o.dislikes || [],
    timeAgo: calcTimeAgo(o.createdAt),
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
  }
}

export async function toggleReviewVote(reviewId: string, username: string, vote: 'like' | 'dislike'): Promise<Review | undefined> {
  const doc = await ReviewModel.findById(reviewId)
  if (!doc) return undefined
  const likes: string[] = (doc.likes || []).filter(u => u !== username)
  const dislikes: string[] = (doc.dislikes || []).filter(u => u !== username)
  const arr = vote === 'like' ? likes : dislikes
  const other = vote === 'like' ? dislikes : likes
  // Toggle: se já votou nisso, remove; senão adiciona (e tira do outro lado)
  if ((vote === 'like' ? doc.likes || [] : doc.dislikes || []).includes(username)) {
    doc.likes = likes
    doc.dislikes = dislikes
  } else {
    arr.push(username)
    doc.likes = vote === 'like' ? arr : other
    doc.dislikes = vote === 'like' ? other : arr
  }
  await doc.save()
  const rpg = await resolveRpg(doc.rpgName)
  if (!rpg) return undefined
  return reviewFromDoc(doc, rpg)
}

function userFromDoc(doc: any): User {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    username: o.username,
    passwordHash: o.passwordHash,
    role: o.role,
    bio: o.bio,
    avatar: o.avatar,
    contact: o.contact,
    creatorOf: o.creatorOf || [],
  }
}

function userPublicFromDoc(doc: any): Omit<User, 'passwordHash'> {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    username: o.username,
    role: o.role,
    bio: o.bio,
    avatar: o.avatar,
    contact: o.contact,
    creatorOf: o.creatorOf || [],
  }
}

async function resolveRpg(rpgName: string): Promise<RPG | undefined> {
  const doc = await Rpg.findOne({ name: rpgName })
  return doc ? rpgFromDoc(doc) : undefined
}

export async function getRpgByName(name: string): Promise<RPG | undefined> {
  return resolveRpg(name)
}

export async function getRpgs(): Promise<RPG[]> {
  const docs = await Rpg.find()
  return docs.map(rpgFromDoc)
}

export async function attachRpgs(docs: any[]): Promise<Review[]> {
  const names = [...new Set(docs.map(d => d.rpgName))]
  const rpgDocs = await Promise.all(names.map(n => Rpg.findOne({ name: n })))
  const rpgMap: Record<string, RPG> = {}
  for (const doc of rpgDocs) {
    if (doc) rpgMap[doc.name] = rpgFromDoc(doc)
  }
  // Sem fallback: reviews órfãs (RPG deletado) são descartadas em vez de
  // aparecerem num RPG qualquer que "nem tem" avaliações.
  return docs
    .filter(d => rpgMap[d.rpgName])
    .map(d => reviewFromDoc(d, rpgMap[d.rpgName]))
}

export async function getReviews(all?: boolean): Promise<Review[]> {
  const filter: Record<string, any> = all ? {} : { status: 'approved' }
  const docs = await ReviewModel.find(filter).sort({ createdAt: -1 })
  return attachRpgs(docs)
}

export async function getRecentReviews(limit: number = 20): Promise<Review[]> {
  const docs = await ReviewModel.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(limit)
  return attachRpgs(docs)
}

export async function getPendingReviews(): Promise<Review[]> {
  const docs = await ReviewModel.find({ status: 'pending' }).sort({ createdAt: -1 })
  return attachRpgs(docs)
}

export async function addReview(input: ReviewInput, username: string): Promise<Review> {
  const rpg = await resolveRpg(input.rpgName)
  if (!rpg) throw new Error('RPG não encontrado.')
  const user = await UserModel.findOne({ username })
  const isAdmin = user?.role === 'admin'

  const doc = await ReviewModel.create({
    rpgName: input.rpgName,
    username,
    rating: input.rating,
    comment: input.comment,
    customImage: input.customImage || undefined,
    status: isAdmin ? 'approved' : 'pending',
  })

  return reviewFromDoc(doc, rpg!)
}

export async function approveReview(reviewId: string): Promise<Review | undefined> {
  const doc = await ReviewModel.findByIdAndUpdate(
    reviewId,
    { status: 'approved' },
    { new: true },
  )
  if (!doc) return undefined
  const rpg = await resolveRpg(doc.rpgName)
  if (!rpg) return undefined
  return reviewFromDoc(doc, rpg!)
}

export async function rejectReview(reviewId: string): Promise<boolean> {
  const doc = await ReviewModel.findByIdAndUpdate(reviewId, { status: 'rejected' })
  return !!doc
}

export async function deleteReviewById(reviewId: string, username: string, isAdmin: boolean): Promise<boolean> {
  const review = await ReviewModel.findById(reviewId)
  if (!review) return false
  if (review.username !== username && !isAdmin) return false
  await ReviewModel.findByIdAndDelete(reviewId)
  return true
}

export async function addRpg(input: Omit<RPG, 'banner'> & { banner?: string }): Promise<RPG> {
  const doc = await Rpg.create({
    ...input,
    banner: input.banner || input.image,
    tags: input.tags || [],
  })
  return rpgFromDoc(doc)
}

export async function updateRpg(name: string, updates: Partial<RPG>): Promise<RPG | undefined> {
  const rpg = await Rpg.findOne({ name })
  if (!rpg) return undefined
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      ;(rpg as any)[key] = null
    } else {
      ;(rpg as any)[key] = value
    }
  }
  await rpg.save()
  return rpgFromDoc(rpg)
}

export async function toggleFeaturedRpg(name: string): Promise<RPG | undefined> {
  const rpg = await Rpg.findOne({ name })
  if (!rpg) return undefined
  rpg.featured = !rpg.featured
  if (rpg.featured && !rpg.featuredOrder) {
    const max = await Rpg.findOne({ featured: true }).sort({ featuredOrder: -1 })
    rpg.featuredOrder = (max?.featuredOrder ?? 0) + 1
  }
  await rpg.save()
  return rpgFromDoc(rpg)
}

export async function setFeaturedOrder(orders: { name: string; order: number }[]): Promise<void> {
  for (const o of orders) {
    await Rpg.updateOne({ name: o.name }, { $set: { featuredOrder: o.order } })
  }
}

export async function getFeaturedRpgs(): Promise<RPG[]> {
  const docs = await Rpg.find({ featured: true }).sort({ featuredOrder: 1, name: 1 })
  return docs.map(rpgFromDoc)
}

export async function deleteRpg(name: string): Promise<boolean> {
  const doc = await Rpg.findOneAndDelete({ name })
  if (!doc) return false
  // Cascata: sem isso as avaliações/posts do RPG deletado ficavam órfãos
  // e (pelo fallback antigo) apareciam em outro RPG.
  try {
    const reviews = await ReviewModel.find({ rpgName: name }, { _id: 1 })
    const reviewIds = reviews.map(r => String(r._id))
    if (reviewIds.length) {
      await ReviewReplyModel.deleteMany({ reviewId: { $in: reviewIds } })
    }
    await ReviewModel.deleteMany({ rpgName: name })
    await EventPostModel.deleteMany({ rpgName: name })
    await VisitModel.deleteMany({ rpg: name })
  } catch {
    // RPG já foi deletado; falha na limpeza não deve reverter
  }
  return true
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const verify = scryptSync(password, salt, 64).toString('hex')
  return hash === verify
}

export async function registerUser(username: string, password: string, contact?: string, avatar?: string): Promise<{ user: User; token: string } | { error: string }> {
  const existing = await UserModel.findOne({ username })
  if (existing) return { error: 'Usuário já existe.' }

  const count = await UserModel.countDocuments()
  const isFirst = count === 0

  const user = await UserModel.create({
    username,
    passwordHash: hashPassword(password),
    role: isFirst ? 'admin' : 'user',
    contact: contact || undefined,
    avatar: avatar || undefined,
  })

  const token = randomBytes(32).toString('hex')
  await SessionModel.create({ token, userId: String(user._id) })

  return { user: userFromDoc(user), token }
}

export async function loginUser(username: string, password: string): Promise<{ user: User; token: string } | { error: string }> {
  const user = await UserModel.findOne({ username })
  if (!user) return { error: 'Usuário não encontrado.' }

  if (!verifyPassword(password, user.passwordHash)) {
    return { error: 'Senha incorreta.' }
  }

  const token = randomBytes(32).toString('hex')
  await SessionModel.create({ token, userId: String(user._id) })

  return { user: userFromDoc(user), token }
}

export async function getUsers(): Promise<Omit<User, 'passwordHash'>[]> {
  const docs = await UserModel.find()
  return docs.map(userPublicFromDoc)
}

export async function getUserByToken(token: string): Promise<User | undefined> {
  const session = await SessionModel.findOne({ token })
  if (!session) return undefined
  const user = await UserModel.findById(session.userId)
  return user ? userFromDoc(user) : undefined
}

export async function updateProfile(userId: string, data: { bio?: string; avatar?: string }): Promise<User | undefined> {
  const user = await UserModel.findById(userId)
  if (!user) return undefined
  if (data.bio !== undefined) user.bio = data.bio
  if (data.avatar !== undefined) user.avatar = data.avatar
  await user.save()
  return userFromDoc(user)
}

export interface RpgRating {
  rpg: RPG
  avgRating: number
  reviewCount: number
  bayesianAvg: number
}

export async function getRpgRatings(): Promise<RpgRating[]> {
  const [reviews, rpgs] = await Promise.all([
    ReviewModel.find({ status: 'approved' }),
    getRpgs(),
  ])

  const stats: Record<string, { sum: number; count: number }> = {}

  for (const review of reviews) {
    const name = review.rpgName
    if (!stats[name]) stats[name] = { sum: 0, count: 0 }
    stats[name].sum += review.rating
    stats[name].count++
  }

  const m = 20
  const C = 3.5

  const results: RpgRating[] = rpgs.map(rpg => {
    const s = stats[rpg.name]
    const count = s?.count || 0
    const avg = count > 0 ? s.sum / count : 0
    const bayesianAvg = (avg * count + m * C) / (count + m)
    return { rpg, avgRating: avg, reviewCount: count, bayesianAvg }
  })

  results.sort((a, b) => {
    const diff = b.bayesianAvg - a.bayesianAvg
    if (diff !== 0) return diff
    return b.reviewCount - a.reviewCount
  })

  return results
}

export async function logoutUser(token: string): Promise<void> {
  await SessionModel.deleteOne({ token })
}

export interface AdCreative {
  image: string
  placement: 'hero' | 'catalog' | 'both'
  slot: number
  format: 'wide' | 'square' | 'poster'
}

export interface Ad {
  id: string
  title: string
  description?: string
  link?: string
  active: boolean
  creatives: AdCreative[]
  createdAt: Date
}

function adFromDoc(doc: any): Ad {
  const o = doc.toObject ? doc.toObject() : doc
  let creatives: AdCreative[] = (o.creatives || []).map((c: any) => ({
    image: c.image,
    placement: c.placement || 'hero',
    slot: c.slot ?? 0,
    format: c.format || 'wide',
  }))
  if (!creatives.length && o.image) {
    creatives = [{ image: o.image, placement: o.placement || 'hero', slot: o.slot ?? 0, format: o.format || 'wide' }]
  }
  return {
    id: String(o._id),
    title: o.title,
    description: o.description,
    link: o.link,
    active: o.active ?? true,
    creatives,
    createdAt: o.createdAt,
  }
}

export async function getAds(): Promise<Ad[]> {
  const docs = await AdModel.find({ active: true }).sort({ createdAt: -1 })
  return docs.map(adFromDoc)
}

export async function getAllAds(): Promise<Ad[]> {
  const docs = await AdModel.find().sort({ createdAt: -1 })
  return docs.map(adFromDoc)
}

export async function addAd(data: { title: string; description?: string; link?: string; active?: boolean; creatives: AdCreative[] }): Promise<Ad> {
  const doc = await AdModel.create(data)
  return adFromDoc(doc)
}

export async function updateAd(id: string, data: { title?: string; description?: string; link?: string; active?: boolean; creatives?: AdCreative[] }): Promise<Ad | undefined> {
  const doc = await AdModel.findByIdAndUpdate(id, data, { new: true })
  return doc ? adFromDoc(doc) : undefined
}

export async function deleteAd(id: string): Promise<boolean> {
  const doc = await AdModel.findByIdAndDelete(id)
  return !!doc
}

// ── CRIADORES ──
export function isCreatorOf(user: User | undefined, rpgName: string): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return (user.creatorOf || []).includes(rpgName)
}

export async function setUserCreators(username: string, rpgNames: string[]): Promise<Omit<User, 'passwordHash'> | undefined> {
  const user = await UserModel.findOne({ username })
  if (!user) return undefined
  user.creatorOf = rpgNames
  await user.save()
  return userPublicFromDoc(user)
}

// ── POSTAGENS DE EVENTOS ──
// Score do RPG (0-100) a partir da média bayesiana (2.5 → 0, 5.0 → 100)
export function rpgScoreFromBayesian(bayesianAvg: number): number {
  const clamped = Math.max(1, Math.min(5, bayesianAvg))
  return Math.round(((clamped - 2.5) / 2.5) * 100)
}

// Duração do "fixamento" (boost) de um post: quanto maior o score, mais tempo
// o anúncio fica acima dos demais antes de cair como normalmente acontece.
export function eventPostBoostHours(rpgScore: number): number {
  return 6 + (rpgScore / 100) * 90 // 6h (score 0) até ~96h (score 100)
}

function boostRemainingHours(createdAt: string | Date, rpgScore: number): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3600000
  return Math.max(0, Math.round((eventPostBoostHours(rpgScore) - ageHours) * 10) / 10)
}

async function getRpgScoreMap(): Promise<Record<string, number>> {
  const ratings = await getRpgRatings()
  const map: Record<string, number> = {}
  for (const r of ratings) map[r.rpg.name] = rpgScoreFromBayesian(r.bayesianAvg)
  return map
}

function eventPostFromDoc(doc: any, rpg: RPG | null, score?: number): EventPost {
  const o = doc.toObject ? doc.toObject() : doc
  const boostHours = score !== undefined ? boostRemainingHours(o.createdAt, score) : 0
  const pinnedUntil = o.pinnedUntil ? new Date(o.pinnedUntil) : undefined
  const pinned = !!pinnedUntil && pinnedUntil.getTime() > Date.now()
  return {
    id: String(o._id),
    username: o.username,
    rpg,
    title: o.title,
    content: o.content,
    image: o.image,
    tags: o.tags || [],
    pinned,
    pinnedUntil: o.pinnedUntil ? (o.pinnedUntil instanceof Date ? o.pinnedUntil.toISOString() : o.pinnedUntil) : undefined,
    timeAgo: calcTimeAgo(o.createdAt),
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    rpgScore: score,
    boosted: boostHours > 0,
    boostHours,
  }
}

async function sortEventPosts(posts: EventPost[]): Promise<EventPost[]> {
  return posts.sort((a, b) => {
    // 1º: fixados pelo admin (vale até pinnedUntil, absoluto)
    const aPin = a.pinned ? 1 : 0
    const bPin = b.pinned ? 1 : 0
    if (aPin !== bPin) return bPin - aPin
    if (aPin && bPin) return new Date(b.pinnedUntil as string).getTime() - new Date(a.pinnedUntil as string).getTime()
    const aBoost = a.boosted ? 1 : 0
    const bBoost = b.boosted ? 1 : 0
    if (aBoost !== bBoost) return bBoost - aBoost
    if (aBoost && bBoost) return (b.boostHours || 0) - (a.boostHours || 0)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

export async function getEventPosts(limit?: number): Promise<EventPost[]> {
  const [docs, scoreMap] = await Promise.all([
    EventPostModel.find().sort({ createdAt: -1 }),
    getRpgScoreMap(),
  ])
  const names = [...new Set(docs.map(d => d.rpgName).filter(Boolean))]
  const rpgDocs = await Promise.all(names.map(n => Rpg.findOne({ name: n })))
  const rpgMap: Record<string, RPG> = {}
  for (const doc of rpgDocs) {
    if (doc) rpgMap[doc.name] = rpgFromDoc(doc)
  }
  // Posts sem rpgName = comunicado geral (só admin): entram sem boost, por data
  const posts = docs
    .filter(d => !d.rpgName || rpgMap[d.rpgName])
    .map(d => eventPostFromDoc(d, d.rpgName ? rpgMap[d.rpgName] : null, d.rpgName ? scoreMap[d.rpgName] : undefined))
  await sortEventPosts(posts)
  return limit ? posts.slice(0, limit) : posts
}

export async function getEventPostsPaginated(skip: number, limit: number): Promise<EventPost[]> {
  const all = await getEventPosts()
  return all.slice(skip, skip + limit)
}

export async function addEventPost(input: { username: string; rpgName?: string; title: string; content: string; image?: string; tags?: string[] }): Promise<EventPost> {
  const doc = await EventPostModel.create(input)
  const rpg = input.rpgName ? await resolveRpg(input.rpgName) : undefined
  const ratings = await getRpgRatings()
  const rr = input.rpgName ? ratings.find(x => x.rpg.name === input.rpgName) : undefined
  const score = rr ? rpgScoreFromBayesian(rr.bayesianAvg) : 0
  return eventPostFromDoc(doc, rpg || null, input.rpgName ? score : undefined)
}

export async function deleteEventPost(id: string, username: string, isAdmin: boolean): Promise<boolean> {
  const post = await EventPostModel.findById(id)
  if (!post) return false
  if (post.username !== username && !isAdmin) return false
  await EventPostModel.findByIdAndDelete(id)
  return true
}

// Fixa/desafixa um post no topo por N dias (só admin; absoluto, ignora score)
export async function setEventPostPin(id: string, days: number | null): Promise<EventPost | undefined> {
  const post = await EventPostModel.findById(id)
  if (!post) return undefined
  post.pinnedUntil = days && days > 0 ? new Date(Date.now() + days * 86400000) : undefined
  await post.save()
  const rpg = post.rpgName ? await resolveRpg(post.rpgName) : undefined
  const ratings = await getRpgRatings()
  const rr = post.rpgName ? ratings.find(x => x.rpg.name === post.rpgName) : undefined
  const score = rr ? rpgScoreFromBayesian(rr.bayesianAvg) : 0
  return eventPostFromDoc(post, rpg || null, post.rpgName ? score : undefined)
}

// ── CHAT GLOBAL ──
function chatMessageFromDoc(doc: any): ChatMessage {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    username: o.username,
    text: o.text || '',
    image: o.image,
    timeAgo: calcTimeAgo(o.createdAt),
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
  }
}

export async function getChatMessages(limit: number = 50): Promise<ChatMessage[]> {
  const docs = await ChatMessageModel.find().sort({ createdAt: -1 }).limit(Math.min(limit, 100))
  return docs.reverse().map(chatMessageFromDoc)
}

export async function getChatLatest(): Promise<string | null> {
  const doc = await ChatMessageModel.findOne().sort({ createdAt: -1 })
  if (!doc) return null
  const c = doc.createdAt
  return c instanceof Date ? c.toISOString() : String(c)
}

export async function addChatMessage(input: { username: string; text?: string; image?: string }): Promise<ChatMessage> {
  const doc = await ChatMessageModel.create({ username: input.username, text: input.text || '', image: input.image || undefined })
  return chatMessageFromDoc(doc)
}

export async function deleteChatMessage(id: string, username: string, isAdmin: boolean): Promise<boolean> {
  const msg = await ChatMessageModel.findById(id)
  if (!msg) return false
  if (msg.username !== username && !isAdmin) return false
  await ChatMessageModel.findByIdAndDelete(id)
  return true
}

// ── STATUS / SCORE DO CRIADOR ──
export interface CreatorRpgStatus {
  rpg: RPG
  views: number
  reviewCount: number
  avgRating: number
  bayesianAvg: number
  score: number
  repliesCount: number
  postsCount: number
  boostedPosts: number
}

export interface CreatorStats {
  username: string
  score: number
  rpgs: CreatorRpgStatus[]
}

export async function getCreatorStats(username: string): Promise<CreatorStats | undefined> {
  const user = await UserModel.findOne({ username })
  if (!user) return undefined

  const names = (user.creatorOf || []).filter(Boolean)
  const ratings = await getRpgRatings()
  const scoreMap: Record<string, number> = {}
  const ratingMap: Record<string, RpgRating> = {}
  for (const r of ratings) {
    scoreMap[r.rpg.name] = rpgScoreFromBayesian(r.bayesianAvg)
    ratingMap[r.rpg.name] = r
  }

  const rpgs: CreatorRpgStatus[] = []
  for (const name of names) {
    const rpg = await resolveRpg(name)
    if (!rpg) continue
    const [views, postsCount, reviews, eventPosts] = await Promise.all([
      VisitModel.countDocuments({ type: 'rpgview', rpg: name }),
      EventPostModel.countDocuments({ rpgName: name }),
      ReviewModel.find({ rpgName: name, status: 'approved' }),
      EventPostModel.find({ rpgName: name }),
    ])
    const reviewIds = reviews.map(r => String(r._id))
    const repliesCount = reviewIds.length
      ? await ReviewReplyModel.countDocuments({ reviewId: { $in: reviewIds } })
      : 0
    const score = scoreMap[name] || 0
    const rr = ratingMap[name]
    rpgs.push({
      rpg,
      views,
      reviewCount: reviews.length,
      avgRating: rr ? rr.avgRating : 0,
      bayesianAvg: rr ? rr.bayesianAvg : 3.5,
      score,
      repliesCount,
      postsCount,
      boostedPosts: eventPosts.filter(p => (p.pinnedUntil && new Date(p.pinnedUntil).getTime() > Date.now()) || boostRemainingHours(p.createdAt, score) > 0).length,
    })
  }

  const score = rpgs.length
    ? Math.round(rpgs.reduce((acc, r) => acc + r.score, 0) / rpgs.length)
    : 0

  return { username, score, rpgs }
}

// ── RESPOSTAS A AVALIAÇÕES ──
function replyFromDoc(doc: any): ReviewReply {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    reviewId: o.reviewId,
    username: o.username,
    content: o.content,
    timeAgo: calcTimeAgo(o.createdAt),
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
  }
}

export async function getReviewReplies(reviewId: string): Promise<ReviewReply[]> {
  const docs = await ReviewReplyModel.find({ reviewId }).sort({ createdAt: 1 })
  return docs.map(replyFromDoc)
}

export async function addReviewReply(reviewId: string, username: string, content: string): Promise<ReviewReply | undefined> {
  const review = await ReviewModel.findById(reviewId)
  if (!review) return undefined
  const doc = await ReviewReplyModel.create({ reviewId, username, content })
  return replyFromDoc(doc)
}

export async function deleteReviewReply(replyId: string, username: string, isAdmin: boolean): Promise<boolean> {
  const reply = await ReviewReplyModel.findById(replyId)
  if (!reply) return false
  if (reply.username !== username && !isAdmin) return false
  await ReviewReplyModel.findByIdAndDelete(replyId)
  return true
}

export async function recordVisit(type: VisitType, data?: { rpg?: string; query?: string }): Promise<void> {
  try {
    await VisitModel.create({ type, rpg: data?.rpg, query: data?.query })
  } catch {
    // analytics nunca deve quebrar a navegação
  }
}

export interface AnalyticsDailyCount {
  day: string
  count: number
  pageview: number
  rpgview: number
  search: number
}

export interface AnalyticsSummary {
  totalVisits: number
  totalRpgViews: number
  totalSearches: number
  last7: { visits: number; rpgViews: number; searches: number }
  avgPerDay: number
  peakDay: { day: string; count: number } | null
  topRpgs: { rpg: string; count: number }[]
  topSearches: { query: string; count: number }[]
  daily: AnalyticsDailyCount[]
  recent: { type: VisitType; rpg?: string; query?: string; createdAt: string }[]
  byRpg?: { rpg: string; views: number; reviews: number; avgRating: number }[]
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - 13)
  const since7 = new Date()
  since7.setUTCHours(0, 0, 0, 0)
  since7.setUTCDate(since7.getUTCDate() - 6)

  const [totalVisits, totalRpgViews, totalSearches, topRpgs, topSearches, daily, last7visits, last7rpg, last7search, recentDocs] = await Promise.all([
    VisitModel.countDocuments({ type: 'pageview' }),
    VisitModel.countDocuments({ type: 'rpgview' }),
    VisitModel.countDocuments({ type: 'search' }),
    VisitModel.aggregate<{ _id: string; count: number }>([
      { $match: { type: 'rpgview', rpg: { $exists: true, $ne: '' } } },
      { $group: { _id: '$rpg', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    VisitModel.aggregate<{ _id: string; count: number }>([
      { $match: { type: 'search', query: { $exists: true, $ne: '' } } },
      { $group: { _id: '$query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    VisitModel.aggregate<{ _id: string; count: number; pageview: number; rpgview: number; search: number }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
          pageview: { $sum: { $cond: [{ $eq: ['$type', 'pageview'] }, 1, 0] } },
          rpgview: { $sum: { $cond: [{ $eq: ['$type', 'rpgview'] }, 1, 0] } },
          search: { $sum: { $cond: [{ $eq: ['$type', 'search'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    VisitModel.countDocuments({ type: 'pageview', createdAt: { $gte: since7 } }),
    VisitModel.countDocuments({ type: 'rpgview', createdAt: { $gte: since7 } }),
    VisitModel.countDocuments({ type: 'search', createdAt: { $gte: since7 } }),
    VisitModel.find().sort({ createdAt: -1 }).limit(20),
  ])

  const dayMap = new Map(daily.map(d => [d._id, d]))
  const dates: AnalyticsDailyCount[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(since)
    d.setUTCDate(d.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    const found = dayMap.get(key)
    dates.push({ day: key, count: found?.count || 0, pageview: found?.pageview || 0, rpgview: found?.rpgview || 0, search: found?.search || 0 })
  }

  const total14 = dates.reduce((a, d) => a + d.count, 0)
  const peak = dates.reduce<{ day: string; count: number } | null>((acc, d) => (!acc || d.count > acc.count ? { day: d.day, count: d.count } : acc), null)

  // Detalhe por RPG: views + reviews + média (top 10 por views)
  let byRpg: { rpg: string; views: number; reviews: number; avgRating: number }[] | undefined
  try {
    const topNames = topRpgs.slice(0, 10).map(r => r._id)
    if (topNames.length) {
      const [revDocs] = await Promise.all([ReviewModel.find({ rpgName: { $in: topNames }, status: 'approved' })])
      const agg: Record<string, { sum: number; count: number }> = {}
      for (const rv of revDocs) {
        if (!agg[rv.rpgName]) agg[rv.rpgName] = { sum: 0, count: 0 }
        agg[rv.rpgName].sum += rv.rating
        agg[rv.rpgName].count++
      }
      byRpg = topRpgs.slice(0, 10).map(r => ({
        rpg: r._id,
        views: r.count,
        reviews: agg[r._id]?.count || 0,
        avgRating: agg[r._id]?.count ? agg[r._id].sum / agg[r._id].count : 0,
      }))
    }
  } catch { byRpg = undefined }

  return {
    totalVisits,
    totalRpgViews,
    totalSearches,
    last7: { visits: last7visits, rpgViews: last7rpg, searches: last7search },
    avgPerDay: Math.round((total14 / 14) * 10) / 10,
    peakDay: peak,
    topRpgs: topRpgs.map(r => ({ rpg: r._id, count: r.count })),
    topSearches: topSearches.map(r => ({ query: r._id, count: r.count })),
    daily: dates,
    recent: recentDocs.map(d => ({
      type: d.type,
      rpg: d.rpg,
      query: d.query,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
    })),
    byRpg,
  }
}

// ── DENÚNCIAS ──
export type ReportReason = 'golpe' | 'inativo' | 'falso'
export type ReportStatus = 'pending' | 'dismissed' | 'actioned'

export interface Report {
  id: string
  rpgName: string
  reporter?: string
  reason: ReportReason
  description: string
  evidence?: string
  evidenceImages?: string[]
  status: ReportStatus
  adminNote?: string
  createdAt: string
  resolvedAt?: string
}

function reportFromDoc(doc: any): Report {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    rpgName: o.rpgName,
    reporter: o.reporter,
    reason: o.reason,
    description: o.description,
    evidence: o.evidence,
    evidenceImages: o.evidenceImages || [],
    status: o.status || 'pending',
    adminNote: o.adminNote,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    resolvedAt: o.resolvedAt ? (o.resolvedAt instanceof Date ? o.resolvedAt.toISOString() : o.resolvedAt) : undefined,
  }
}

export async function addReport(input: { rpgName: string; reporter?: string; reason: ReportReason; description: string; evidence?: string; evidenceImages?: string[] }): Promise<Report> {
  const doc = await ReportModel.create(input)
  return reportFromDoc(doc)
}

export async function getReports(status?: string): Promise<Report[]> {
  const filter: Record<string, any> = status && status !== 'all' ? { status } : {}
  const docs = await ReportModel.find(filter).sort({ createdAt: -1 }).limit(200)
  return docs.map(reportFromDoc)
}

export async function getPendingReportsCount(): Promise<number> {
  return ReportModel.countDocuments({ status: 'pending' })
}

export async function resolveReport(id: string, action: 'dismiss' | 'resolve', adminNote?: string): Promise<Report | undefined> {
  const doc = await ReportModel.findByIdAndUpdate(
    id,
    { status: action === 'dismiss' ? 'dismissed' : 'actioned', adminNote: adminNote || undefined, resolvedAt: new Date() },
    { new: true },
  )
  return doc ? reportFromDoc(doc) : undefined
}

// ── SUBMISSÕES DE RPG ──
export type RpgSubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface RpgSubmission {
  id: string
  name: string
  owner: string
  genre: string
  image: string
  banner?: string
  description: string
  link?: string
  whatsapp?: string
  year?: string
  ageRating: string
  contact?: string
  submitter: string
  status: RpgSubmissionStatus
  adminNote?: string
  createdAt: string
  resolvedAt?: string
}

function rpgSubmissionFromDoc(doc: any): RpgSubmission {
  const o = doc.toObject ? doc.toObject() : doc
  return {
    id: String(o._id),
    name: o.name,
    owner: o.owner,
    genre: o.genre,
    image: o.image,
    banner: o.banner,
    description: o.description,
    link: o.link,
    whatsapp: o.whatsapp,
    year: o.year,
    ageRating: o.ageRating,
    contact: o.contact,
    submitter: o.submitter,
    status: o.status || 'pending',
    adminNote: o.adminNote,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    resolvedAt: o.resolvedAt ? (o.resolvedAt instanceof Date ? o.resolvedAt.toISOString() : o.resolvedAt) : undefined,
  }
}

export async function addRpgSubmission(input: {
  name: string; owner: string; genre: string; image: string; banner?: string
  description: string; link?: string; whatsapp?: string; year?: string
  ageRating: string; contact?: string; submitter: string
}): Promise<RpgSubmission> {
  const doc = await RpgSubmissionModel.create(input)
  return rpgSubmissionFromDoc(doc)
}

export async function getRpgSubmissions(status?: string): Promise<RpgSubmission[]> {
  const filter: Record<string, any> = status && status !== 'all' ? { status } : {}
  const docs = await RpgSubmissionModel.find(filter).sort({ createdAt: -1 }).limit(200)
  return docs.map(rpgSubmissionFromDoc)
}

export async function getPendingSubmissionsCount(): Promise<number> {
  return RpgSubmissionModel.countDocuments({ status: 'pending' })
}

export async function approveRpgSubmission(id: string, adminNote?: string): Promise<RpgSubmission | undefined> {
  const sub = await RpgSubmissionModel.findById(id)
  if (!sub || sub.status !== 'pending') return sub ? rpgSubmissionFromDoc(sub) : undefined
  const existing = await Rpg.findOne({ name: sub.name })
  if (existing) return undefined
  await Rpg.create({
    name: sub.name,
    owner: sub.owner,
    genre: sub.genre,
    image: sub.image,
    banner: sub.banner || sub.image,
    description: sub.description,
    link: sub.link,
    whatsapp: sub.whatsapp,
    year: sub.year,
    ageRating: sub.ageRating,
    featured: false,
    featuredOrder: 0,
    tags: [],
  })
  sub.status = 'approved'
  sub.adminNote = adminNote || undefined
  sub.resolvedAt = new Date()
  await sub.save()
  return rpgSubmissionFromDoc(sub)
}

export async function rejectRpgSubmission(id: string, adminNote?: string): Promise<RpgSubmission | undefined> {
  const doc = await RpgSubmissionModel.findByIdAndUpdate(
    id,
    { status: 'rejected', adminNote: adminNote || undefined, resolvedAt: new Date() },
    { new: true },
  )
  return doc ? rpgSubmissionFromDoc(doc) : undefined
}

// ── LIMPEZA DE ÓRFÃOS (one-shot para base já contaminada) ──
export async function cleanupOrphans(): Promise<{ reviews: number; replies: number; eventPosts: number; visits: number }> {
  const rpgs = await Rpg.find({}, { name: 1 })
  const valid = new Set(rpgs.map(r => r.name))
  const orphanReviews = await ReviewModel.find({ rpgName: { $nin: [...valid] } }, { _id: 1 })
  const orphanIds = orphanReviews.map(r => String(r._id))
  let replies = 0
  if (orphanIds.length) {
    const rr = await ReviewReplyModel.deleteMany({ reviewId: { $in: orphanIds } })
    replies = rr.deletedCount || 0
  }
  const [rev, posts, visits] = await Promise.all([
    ReviewModel.deleteMany({ rpgName: { $nin: [...valid] } }),
    EventPostModel.deleteMany({ rpgName: { $nin: [...valid] } }),
    // Só rpgview tem campo rpg: sem o type, o $nin apagaria pageview/search (sem campo rpg)
    VisitModel.deleteMany({ type: 'rpgview', rpg: { $nin: [...valid] } }),
  ])
  return {
    reviews: rev.deletedCount || 0,
    replies,
    eventPosts: posts.deletedCount || 0,
    visits: visits.deletedCount || 0,
  }
}
