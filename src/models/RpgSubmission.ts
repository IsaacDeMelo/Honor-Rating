import { Schema, model } from 'mongoose'

export type RpgSubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface IRpgSubmission {
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
  createdAt: Date
  resolvedAt?: Date
}

const rpgSubmissionSchema = new Schema<IRpgSubmission>({
  name: { type: String, required: true },
  owner: { type: String, required: true },
  genre: { type: String, required: true },
  image: { type: String, required: true },
  banner: String,
  description: { type: String, required: true, maxlength: 5000 },
  link: String,
  whatsapp: String,
  year: String,
  ageRating: { type: String, required: true },
  contact: String,
  submitter: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  adminNote: String,
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date,
})

rpgSubmissionSchema.index({ status: 1, createdAt: -1 })

export default model<IRpgSubmission>('RpgSubmission', rpgSubmissionSchema)
