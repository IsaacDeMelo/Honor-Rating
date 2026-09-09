import { Schema, model } from 'mongoose'

export interface IReview {
  rpgName: string
  username: string
  rating: number
  comment: string
  customImage?: string
  status: 'pending' | 'approved' | 'rejected'
  likes: string[]
  dislikes: string[]
  createdAt: Date
}

const reviewSchema = new Schema<IReview>({
  rpgName: { type: String, required: true },
  username: { type: String, required: true },
  rating: { type: Number, required: true, min: 0, max: 5 },
  comment: { type: String, required: true },
  customImage: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  likes: { type: [String], default: [] },
  dislikes: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
})

reviewSchema.index({ rpgName: 1 })
reviewSchema.index({ status: 1, createdAt: -1 })

export default model<IReview>('Review', reviewSchema)
