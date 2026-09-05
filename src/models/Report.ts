import { Schema, model } from 'mongoose'

export type ReportReason = 'golpe' | 'inativo' | 'falso'
export type ReportStatus = 'pending' | 'dismissed' | 'actioned'

export interface IReport {
  rpgName: string
  reporter?: string
  reason: ReportReason
  description: string
  evidence?: string
  evidenceImages?: string[]
  status: ReportStatus
  adminNote?: string
  createdAt: Date
  resolvedAt?: Date
}

const reportSchema = new Schema<IReport>({
  rpgName: { type: String, required: true, index: true },
  reporter: String,
  reason: { type: String, enum: ['golpe', 'inativo', 'falso'], required: true },
  description: { type: String, required: true, maxlength: 2000 },
  evidence: { type: String, maxlength: 2000 },
  evidenceImages: { type: [String], default: [] },
  status: { type: String, enum: ['pending', 'dismissed', 'actioned'], default: 'pending', index: true },
  adminNote: String,
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date,
})

reportSchema.index({ status: 1, createdAt: -1 })

export default model<IReport>('Report', reportSchema)
