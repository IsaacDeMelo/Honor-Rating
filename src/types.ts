export interface Tag {
  name: string
  weight: number
}

export interface RPG {
  name: string
  owner: string
  genre: string
  image: string
  banner: string
  description: string
  link?: string
  whatsapp?: string
  year?: string
  ageRating: string
  featured?: boolean
  featuredOrder?: number
  blurImage?: boolean
  limitedEdition?: boolean
  slotsTotal?: number
  slotsFilled?: number
  closed?: boolean
  tags?: Tag[]
}

export interface Review {
  id: string
  rpg: RPG
  username: string
  rating: number
  comment: string
  timeAgo: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
  customImage?: string
}

export interface ReviewInput {
  rpgName: string
  rating: number
  comment: string
  customImage?: string
}

export interface User {
  id: string
  username: string
  passwordHash: string
  role: 'user' | 'admin'
  bio?: string
  avatar?: string
  contact?: string
  creatorOf?: string[]
}

export interface ReviewReply {
  id: string
  reviewId: string
  username: string
  content: string
  timeAgo: string
  createdAt: string
}

export interface EventPost {
  id: string
  username: string
  rpg: RPG
  title: string
  content: string
  image?: string
  timeAgo: string
  createdAt: string
  rpgScore?: number
  boosted?: boolean
  boostHours?: number
}
