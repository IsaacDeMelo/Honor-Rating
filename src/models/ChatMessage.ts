import { Schema, model } from 'mongoose'

export interface IChatMessage {
  username: string
  text: string
  image?: string
  createdAt: Date
}

const chatMessageSchema = new Schema<IChatMessage>({
  username: { type: String, required: true },
  text: { type: String, default: '', maxlength: 1000 },
  image: String,
  createdAt: { type: Date, default: Date.now },
})

chatMessageSchema.index({ createdAt: -1 })

export default model<IChatMessage>('ChatMessage', chatMessageSchema)
