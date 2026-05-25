import { apiClient, type ApiResponse } from "./client"

export type RecordStatus = "waiting" | "running" | "completed" | "failed"

export type RecordDTO = {
  id: string
  uuid: string
  prompt: string
  model: string
  ratio: string
  pixels: string
  status: RecordStatus
  favorite: boolean
  hasImage: boolean
  error?: string
  projectId?: string
  referenceCount: number
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export type CreateRecordPayload = {
  prompt: string
  model: string
  ratio: string
  pixels: string
  projectId?: string | null
  referenceImages?: string[] // data: URLs
}

export type ListRecordsParams = {
  status?: RecordStatus
  projectId?: string
  favorite?: boolean
  page?: number
  pageSize?: number
}

function listQuery(p: ListRecordsParams): string {
  const sp = new URLSearchParams()
  if (p.status) sp.set("status", p.status)
  if (p.projectId) sp.set("projectId", p.projectId)
  if (p.favorite !== undefined) sp.set("favorite", String(p.favorite))
  if (p.page) sp.set("page", String(p.page))
  if (p.pageSize) sp.set("pageSize", String(p.pageSize))
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export const recordsApi = {
  async create(payload: CreateRecordPayload): Promise<RecordDTO> {
    const { data } = await apiClient.post<{ record: RecordDTO }>("/api/v1/records", payload)
    return data.record
  },

  async get(id: string): Promise<RecordDTO> {
    const { data } = await apiClient.get<{ record: RecordDTO }>(`/api/v1/records/${id}`)
    return data.record
  },

  async list(
    params: ListRecordsParams = {}
  ): Promise<ApiResponse<{ records: RecordDTO[] }>> {
    return apiClient.get<{ records: RecordDTO[] }>(`/api/v1/records${listQuery(params)}`)
  },

  async update(
    id: string,
    patch: { favorite?: boolean; projectId?: string | null }
  ): Promise<RecordDTO> {
    const body: Record<string, unknown> = {}
    if (patch.favorite !== undefined) body.favorite = patch.favorite
    if (patch.projectId !== undefined)
      body.projectId = patch.projectId === null ? "" : patch.projectId
    const { data } = await apiClient.patch<{ record: RecordDTO }>(
      `/api/v1/records/${id}`,
      body
    )
    return data.record
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete<{ ok: boolean }>(`/api/v1/records/${id}`)
  },
}

export type ProjectDTO = {
  id: string
  name: string
  createdAt: string
}

export const projectsApi = {
  async list(): Promise<ProjectDTO[]> {
    const { data } = await apiClient.get<{ projects: ProjectDTO[] }>("/api/v1/projects")
    return data.projects
  },
  async create(name: string): Promise<ProjectDTO> {
    const { data } = await apiClient.post<{ project: ProjectDTO }>("/api/v1/projects", { name })
    return data.project
  },
  async rename(id: string, name: string): Promise<void> {
    await apiClient.patch<{ ok: boolean }>(`/api/v1/projects/${id}`, { name })
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete<{ ok: boolean }>(`/api/v1/projects/${id}`)
  },
}

export type AppConfig = {
  enabledModels: string[]
}

export const appConfigApi = {
  async load(): Promise<AppConfig> {
    const { data } = await apiClient.get<AppConfig>("/api/v1/config")
    return { enabledModels: data.enabledModels ?? [] }
  },
}
