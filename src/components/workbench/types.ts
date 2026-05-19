export type ApiStatus = "idle" | "testing" | "success" | "error"

export type HistoryStatus = "waiting" | "running" | "completed" | "failed"

export type HistoryRecord = {
  id: number
  prompt: string
  model: string
  ratio: string
  pixels: string
  status: HistoryStatus
  base64?: string
  error?: string
  favorite: boolean
  projectId?: number
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export type Project = {
  id: number
  name: string
  createdAt: number
}

export type Config = {
  baseUrl: string
  apiKey: string
  model: string
}
