import { Schema, model } from 'mongoose'

export interface IEventPost {
  username: string
  rpgName?: string
  title: string
  content: string
  image?: string
  tags?: string[]
  pinnedUntil?: Date
  createdAt: Date
}

const eventPostSchema = new Schema<IEventPost>({
  username: { type: String, required: true },
  rpgName: { type: String, required: false },
  title: { type: String, required: true },
  content: { type: String, required: true },
  image: String,
  tags: { type: [String], default: [] },
  pinnedUntil: Date,
  createdAt: { type: Date, default: Date.now },
})

eventPostSchema.index({ createdAt: -1 })

export default model<IEventPost>('EventPost', eventPostSchema)
