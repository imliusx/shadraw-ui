"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react"

import {
  appConfigApi,
  projectsApi,
  recordsApi,
  type RecordDTO,
} from "@/lib/api/records-client"
import { fetchImageBlobURL, ApiError } from "@/lib/api/client"
import { tokenStorage } from "@/lib/api/auth-storage"
import type {
  ApiStatus,
  Config,
  HistoryRecord,
  Project,
} from "@/components/workbench/types"

type LightboxState = {
  open: boolean
  recordId: number | null
  navList: number[] | null
}

export type EventLogLevel = "info" | "event" | "data" | "done" | "error"

export type EventLogEntry = {
  id: number
  ts: number
  level: EventLogLevel
  message: string
}

const EVENT_LOG_CAP = 200
const POLL_INTERVAL_MS = 2000

const DEFAULT_CONFIG: Config = { baseUrl: "", apiKey: "", model: "" }

type AppState = {
  history: HistoryRecord[]
  projects: Project[]
  config: Config
  enabledModels: string[]
  activeHistoryId: number | null
  lightbox: LightboxState
  apiStatus: ApiStatus
  apiErrorMessage: string
  isHydrated: boolean
  eventLog: EventLogEntry[]
  settingsOpen: boolean
}

type AppAction =
  | { type: "history/load"; payload: HistoryRecord[] }
  | { type: "history/add"; payload: HistoryRecord }
  | {
      type: "history/update"
      payload: { id: number; patch: Partial<HistoryRecord> }
    }
  | { type: "history/delete"; payload: number }
  | { type: "projects/load"; payload: Project[] }
  | { type: "projects/add"; payload: Project }
  | { type: "projects/rename"; payload: { id: number; name: string } }
  | { type: "projects/delete"; payload: number }
  | { type: "config/load"; payload: { config: Config; enabledModels: string[] } }
  | { type: "config/update"; payload: Partial<Config> }
  | { type: "enabledModels/set"; payload: string[] }
  | { type: "ui/setActive"; payload: number | null }
  | {
      type: "ui/openLightbox"
      payload: { recordId: number; navList?: number[] | null }
    }
  | { type: "ui/closeLightbox" }
  | {
      type: "ui/setApiStatus"
      payload: { status: ApiStatus; errorMessage?: string }
    }
  | { type: "system/hydrated" }
  | { type: "events/append"; payload: EventLogEntry }
  | { type: "events/clear" }
  | { type: "ui/setSettingsOpen"; payload: boolean }

const initialState: AppState = {
  history: [],
  projects: [],
  config: DEFAULT_CONFIG,
  enabledModels: [],
  activeHistoryId: null,
  lightbox: { open: false, recordId: null, navList: null },
  apiStatus: "idle",
  apiErrorMessage: "",
  isHydrated: false,
  eventLog: [],
  settingsOpen: false,
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "history/load":
      return { ...state, history: action.payload }
    case "history/add":
      return { ...state, history: [...state.history, action.payload] }
    case "history/update":
      return {
        ...state,
        history: state.history.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload.patch } : r
        ),
      }
    case "history/delete":
      return {
        ...state,
        history: state.history.filter((r) => r.id !== action.payload),
        activeHistoryId:
          state.activeHistoryId === action.payload ? null : state.activeHistoryId,
      }
    case "projects/load":
      return { ...state, projects: action.payload }
    case "projects/add":
      return { ...state, projects: [...state.projects, action.payload] }
    case "projects/rename":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? { ...p, name: action.payload.name } : p
        ),
      }
    case "projects/delete":
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.payload),
        history: state.history.map((r) =>
          r.projectId === action.payload ? { ...r, projectId: undefined } : r
        ),
      }
    case "config/load":
      return {
        ...state,
        config: action.payload.config,
        enabledModels: action.payload.enabledModels,
      }
    case "config/update":
      return { ...state, config: { ...state.config, ...action.payload } }
    case "enabledModels/set":
      return { ...state, enabledModels: action.payload }
    case "ui/setActive":
      return { ...state, activeHistoryId: action.payload }
    case "ui/openLightbox":
      return {
        ...state,
        lightbox: {
          open: true,
          recordId: action.payload.recordId,
          navList: action.payload.navList ?? null,
        },
      }
    case "ui/closeLightbox":
      return { ...state, lightbox: { open: false, recordId: null, navList: null } }
    case "ui/setApiStatus":
      return {
        ...state,
        apiStatus: action.payload.status,
        apiErrorMessage: action.payload.errorMessage ?? "",
      }
    case "system/hydrated":
      return { ...state, isHydrated: true }
    case "events/append": {
      const next = [...state.eventLog, action.payload]
      if (next.length > EVENT_LOG_CAP) next.splice(0, next.length - EVENT_LOG_CAP)
      return { ...state, eventLog: next }
    }
    case "events/clear":
      return { ...state, eventLog: [] }
    case "ui/setSettingsOpen":
      return { ...state, settingsOpen: action.payload }
    default:
      return state
  }
}

type HistoryContextValue = {
  records: HistoryRecord[]
  isHydrated: boolean
  addRecord: (params: {
    prompt: string
    model: string
    ratio: string
    pixels: string
    referenceImages?: string[]
  }) => Promise<HistoryRecord>
  updateRecord: (id: number, patch: Partial<HistoryRecord>) => Promise<void>
  deleteRecord: (id: number) => Promise<void>
  getById: (id: number) => HistoryRecord | undefined
}

type ProjectsContextValue = {
  projects: Project[]
  addProject: (name: string) => Promise<Project>
  renameProject: (id: number, name: string) => Promise<void>
  deleteProject: (id: number) => Promise<void>
}

type ConfigContextValue = {
  config: Config
  enabledModels: string[]
  updateConfig: (patch: Partial<Config>) => void
  refreshEnabledModels: () => Promise<void>
  testConnection: () => Promise<boolean> // legacy no-op; admin handles real test
}

type UIContextValue = {
  activeHistoryId: number | null
  setActive: (id: number | null) => void
  lightbox: LightboxState
  openLightbox: (recordId: number, navList?: number[] | null) => void
  closeLightbox: () => void
  apiStatus: ApiStatus
  apiErrorMessage: string
  setApiStatus: (status: ApiStatus, errorMessage?: string) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

type EventLogContextValue = {
  entries: EventLogEntry[]
  append: (level: EventLogLevel, message: string) => void
  clear: () => void
}

const HistoryContext = createContext<HistoryContextValue | null>(null)
const ProjectsContext = createContext<ProjectsContextValue | null>(null)
const ConfigContext = createContext<ConfigContextValue | null>(null)
const UIContext = createContext<UIContextValue | null>(null)
const EventLogContext = createContext<EventLogContextValue | null>(null)

// ---- helpers ----

function dtoToRecord(dto: RecordDTO, base64?: string): HistoryRecord {
  return {
    id: Number(dto.id),
    prompt: dto.prompt,
    model: dto.model,
    ratio: dto.ratio,
    pixels: dto.pixels,
    status: dto.status,
    base64,
    favorite: dto.favorite,
    error: dto.error,
    projectId: dto.projectId ? Number(dto.projectId) : undefined,
    createdAt: dto.createdAt ? Date.parse(dto.createdAt) : Date.now(),
    startedAt: dto.startedAt ? Date.parse(dto.startedAt) : undefined,
    completedAt: dto.completedAt ? Date.parse(dto.completedAt) : undefined,
  }
}

function dtoToProject(dto: { id: string; name: string; createdAt: string }): Project {
  return {
    id: Number(dto.id),
    name: dto.name,
    createdAt: Date.parse(dto.createdAt),
  }
}

// ---- provider ----

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef<AppState>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Map record id -> in-flight image blob URL (so we can revoke on unmount/replace).
  const blobUrlsRef = useRef<Map<number, string>>(new Map())
  useEffect(() => {
    const urls = blobUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  // Active polls: record id -> abort flag.
  const pollersRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      if (!tokenStorage.read()) {
        dispatch({ type: "system/hydrated" })
        return
      }
      try {
        const [records, projects, cfg] = await Promise.all([
          recordsApi.list({ pageSize: 100 }),
          projectsApi.list(),
          appConfigApi.load(),
        ])
        if (cancelled) return
        const list = records.data.records.map((d) => dtoToRecord(d))
        dispatch({ type: "history/load", payload: list })
        dispatch({
          type: "projects/load",
          payload: projects.map(dtoToProject),
        })
        const defaultModel =
          cfg.enabledModels[0] ?? ""
        dispatch({
          type: "config/load",
          payload: {
            config: { ...DEFAULT_CONFIG, model: defaultModel },
            enabledModels: cfg.enabledModels,
          },
        })
        // Hydrate images for completed records.
        for (const rec of list) {
          if (rec.status === "completed") {
            void loadImageFor(rec.id)
          } else if (rec.status === "waiting" || rec.status === "running") {
            void startPolling(rec.id)
          }
        }
      } catch (err) {
        if (cancelled) return
        // Auth failure leaves auth-provider to redirect; here we just stop hydrating.
        if (err instanceof ApiError && (err.status === 401 || err.code === "network_error")) {
          // proceed without data
        } else {
          // eslint-disable-next-line no-console
          console.warn("hydrate failed", err)
        }
      } finally {
        if (!cancelled) dispatch({ type: "system/hydrated" })
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadImageFor = useCallback(async (id: number) => {
    try {
      const existing = blobUrlsRef.current.get(id)
      if (existing) URL.revokeObjectURL(existing)
      const url = await fetchImageBlobURL(String(id))
      blobUrlsRef.current.set(id, url)
      dispatch({ type: "history/update", payload: { id, patch: { base64: url } } })
    } catch {
      // best effort
    }
  }, [])

  const startPolling = useCallback(
    (id: number) => {
      if (pollersRef.current.has(id)) return
      pollersRef.current.add(id)
      const tick = async () => {
        if (!pollersRef.current.has(id)) return
        try {
          const dto = await recordsApi.get(String(id))
          const next = dtoToRecord(dto)
          dispatch({ type: "history/update", payload: { id, patch: next } })
          if (dto.status === "completed") {
            pollersRef.current.delete(id)
            await loadImageFor(id)
            return
          }
          if (dto.status === "failed") {
            pollersRef.current.delete(id)
            return
          }
        } catch {
          // network blip; keep polling
        }
        setTimeout(tick, POLL_INTERVAL_MS)
      }
      setTimeout(tick, POLL_INTERVAL_MS)
    },
    [loadImageFor]
  )

  const addRecord = useCallback<HistoryContextValue["addRecord"]>(
    async ({ prompt, model, ratio, pixels, referenceImages }) => {
      const dto = await recordsApi.create({
        prompt,
        model,
        ratio,
        pixels,
        referenceImages,
      })
      const record = dtoToRecord(dto)
      record.referenceImages = referenceImages
      dispatch({ type: "history/add", payload: record })
      void startPolling(record.id)
      return record
    },
    [startPolling]
  )

  const updateRecord = useCallback<HistoryContextValue["updateRecord"]>(
    async (id, patch) => {
      // Only fields the backend supports go through the API.
      const apiPatch: { favorite?: boolean; projectId?: string | null } = {}
      if (patch.favorite !== undefined) apiPatch.favorite = patch.favorite
      if ("projectId" in patch) {
        apiPatch.projectId =
          patch.projectId === undefined ? null : String(patch.projectId)
      }
      if (Object.keys(apiPatch).length > 0) {
        try {
          await recordsApi.update(String(id), apiPatch)
        } catch {
          // surface via toast at call site; still keep optimistic state
        }
      }
      dispatch({ type: "history/update", payload: { id, patch } })
    },
    []
  )

  const deleteRecord = useCallback<HistoryContextValue["deleteRecord"]>(
    async (id) => {
      try {
        await recordsApi.remove(String(id))
      } catch {
        /* ignore; still drop locally */
      }
      const url = blobUrlsRef.current.get(id)
      if (url) {
        URL.revokeObjectURL(url)
        blobUrlsRef.current.delete(id)
      }
      pollersRef.current.delete(id)
      dispatch({ type: "history/delete", payload: id })
    },
    []
  )

  const getById = useCallback(
    (id: number) => stateRef.current.history.find((r) => r.id === id),
    []
  )

  const addProject = useCallback<ProjectsContextValue["addProject"]>(async (name) => {
    const dto = await projectsApi.create(name)
    const p = dtoToProject(dto)
    dispatch({ type: "projects/add", payload: p })
    return p
  }, [])

  const renameProject = useCallback<ProjectsContextValue["renameProject"]>(
    async (id, name) => {
      await projectsApi.rename(String(id), name)
      dispatch({ type: "projects/rename", payload: { id, name } })
    },
    []
  )

  const deleteProject = useCallback<ProjectsContextValue["deleteProject"]>(
    async (id) => {
      await projectsApi.remove(String(id))
      dispatch({ type: "projects/delete", payload: id })
    },
    []
  )

  const updateConfig = useCallback<ConfigContextValue["updateConfig"]>((patch) => {
    dispatch({ type: "config/update", payload: patch })
  }, [])

  const refreshEnabledModels = useCallback<ConfigContextValue["refreshEnabledModels"]>(
    async () => {
      try {
        const cfg = await appConfigApi.load()
        dispatch({ type: "enabledModels/set", payload: cfg.enabledModels })
      } catch {
        /* ignore */
      }
    },
    []
  )

  const testConnection = useCallback<ConfigContextValue["testConnection"]>(
    async () => {
      // 真正的连通性检测由 admin 后台 (POST /api/v1/admin/upstream-configs/test) 完成；
      // 这里只是兼容旧调用：当前用户拉一次 /config，没报错就视为连通。
      dispatch({ type: "ui/setApiStatus", payload: { status: "testing" } })
      try {
        await appConfigApi.load()
        dispatch({ type: "ui/setApiStatus", payload: { status: "success" } })
        return true
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "网络异常"
        dispatch({
          type: "ui/setApiStatus",
          payload: { status: "error", errorMessage: message },
        })
        return false
      }
    },
    []
  )

  const setApiStatus = useCallback<UIContextValue["setApiStatus"]>(
    (status, errorMessage) => {
      dispatch({ type: "ui/setApiStatus", payload: { status, errorMessage } })
    },
    []
  )

  const setActive = useCallback<UIContextValue["setActive"]>((id) => {
    dispatch({ type: "ui/setActive", payload: id })
  }, [])

  const openLightbox = useCallback<UIContextValue["openLightbox"]>(
    (recordId, navList) => {
      dispatch({
        type: "ui/openLightbox",
        payload: { recordId, navList: navList ?? null },
      })
    },
    []
  )

  const closeLightbox = useCallback<UIContextValue["closeLightbox"]>(() => {
    dispatch({ type: "ui/closeLightbox" })
  }, [])

  const setSettingsOpen = useCallback<UIContextValue["setSettingsOpen"]>((open) => {
    dispatch({ type: "ui/setSettingsOpen", payload: open })
  }, [])

  const eventIdRef = useRef(0)

  const appendEvent = useCallback<EventLogContextValue["append"]>((level, message) => {
    eventIdRef.current += 1
    dispatch({
      type: "events/append",
      payload: { id: eventIdRef.current, ts: Date.now(), level, message },
    })
  }, [])

  const clearEvents = useCallback<EventLogContextValue["clear"]>(() => {
    dispatch({ type: "events/clear" })
  }, [])

  const historyValue = useMemo<HistoryContextValue>(
    () => ({
      records: state.history,
      isHydrated: state.isHydrated,
      addRecord,
      updateRecord,
      deleteRecord,
      getById,
    }),
    [state.history, state.isHydrated, addRecord, updateRecord, deleteRecord, getById]
  )

  const projectsValue = useMemo<ProjectsContextValue>(
    () => ({
      projects: state.projects,
      addProject,
      renameProject,
      deleteProject,
    }),
    [state.projects, addProject, renameProject, deleteProject]
  )

  const configValue = useMemo<ConfigContextValue>(
    () => ({
      config: state.config,
      enabledModels: state.enabledModels,
      updateConfig,
      refreshEnabledModels,
      testConnection,
    }),
    [state.config, state.enabledModels, updateConfig, refreshEnabledModels, testConnection]
  )

  const uiValue = useMemo<UIContextValue>(
    () => ({
      activeHistoryId: state.activeHistoryId,
      setActive,
      lightbox: state.lightbox,
      openLightbox,
      closeLightbox,
      apiStatus: state.apiStatus,
      apiErrorMessage: state.apiErrorMessage,
      setApiStatus,
      settingsOpen: state.settingsOpen,
      setSettingsOpen,
    }),
    [
      state.activeHistoryId,
      state.lightbox,
      state.apiStatus,
      state.apiErrorMessage,
      state.settingsOpen,
      setActive,
      openLightbox,
      closeLightbox,
      setApiStatus,
      setSettingsOpen,
    ]
  )

  const eventLogValue = useMemo<EventLogContextValue>(
    () => ({
      entries: state.eventLog,
      append: appendEvent,
      clear: clearEvents,
    }),
    [state.eventLog, appendEvent, clearEvents]
  )

  return (
    <HistoryContext.Provider value={historyValue}>
      <ProjectsContext.Provider value={projectsValue}>
        <ConfigContext.Provider value={configValue}>
          <UIContext.Provider value={uiValue}>
            <EventLogContext.Provider value={eventLogValue}>
              {children}
            </EventLogContext.Provider>
          </UIContext.Provider>
        </ConfigContext.Provider>
      </ProjectsContext.Provider>
    </HistoryContext.Provider>
  )
}

// ---- hooks ----

function ctx<T>(c: React.Context<T | null>, name: string): T {
  const v = useContext(c)
  if (!v) throw new Error(`${name} must be used within AppStateProvider`)
  return v
}

export function useHistory(): HistoryContextValue {
  return ctx(HistoryContext, "useHistory")
}
export function useProjects(): ProjectsContextValue {
  return ctx(ProjectsContext, "useProjects")
}
export function useConfig(): ConfigContextValue {
  return ctx(ConfigContext, "useConfig")
}
function useUI(): UIContextValue {
  return ctx(UIContext, "useUI")
}
function useEvents(): EventLogContextValue {
  return ctx(EventLogContext, "useEventLog")
}

export function useActiveHistory(): [number | null, (id: number | null) => void] {
  const { activeHistoryId, setActive } = useUI()
  return [activeHistoryId, setActive]
}

type UseLightboxReturn = {
  open: boolean
  recordId: number | null
  navList: number[] | null
  openWith: (id: number, navList?: number[] | null) => void
  close: () => void
}

export function useLightbox(): UseLightboxReturn {
  const { lightbox, openLightbox, closeLightbox } = useUI()
  return {
    open: lightbox.open,
    recordId: lightbox.recordId,
    navList: lightbox.navList,
    openWith: openLightbox,
    close: closeLightbox,
  }
}

export function useApiStatus(): { status: ApiStatus; errorMessage: string } {
  const { apiStatus, apiErrorMessage } = useUI()
  return { status: apiStatus, errorMessage: apiErrorMessage }
}

export function useSettingsDialog() {
  const { settingsOpen, setSettingsOpen } = useUI()
  return {
    open: settingsOpen,
    openSettings: useCallback(() => setSettingsOpen(true), [setSettingsOpen]),
    closeSettings: useCallback(() => setSettingsOpen(false), [setSettingsOpen]),
    setOpen: setSettingsOpen,
  }
}

export function useEventLog(): EventLogContextValue {
  return useEvents()
}

type UseGenerateReturn = {
  submit: (params: {
    prompt: string
    ratio: string
    pixels: string
    referenceImages?: string[]
  }) => Promise<void>
  retry: (id: number) => Promise<void>
  isProcessing: boolean
  waitingCount: number
}

export function useGenerate(): UseGenerateReturn {
  const { records, addRecord } = useHistory()
  const { config } = useConfig()
  const { setActive } = useUI()
  const { append: appendEvent, clear: clearEvents } = useEvents()

  const recordsRef = useRef(records)
  useEffect(() => {
    recordsRef.current = records
  }, [records])

  const isProcessing = useMemo(
    () =>
      records.some(
        (r) => r.status === "running" || r.status === "waiting"
      ),
    [records]
  )

  const waitingCount = useMemo(
    () => records.filter((r) => r.status === "waiting").length,
    [records]
  )

  const submit = useCallback<UseGenerateReturn["submit"]>(
    async ({ prompt, ratio, pixels, referenceImages }) => {
      if (!config.model) {
        appendEvent("error", "请先选择模型")
        return
      }
      const busy = recordsRef.current.some(
        (r) => r.status === "running" || r.status === "waiting"
      )
      if (!busy) clearEvents()
      appendEvent("info", `提交生成请求: ${prompt.slice(0, 60)}`)
      if (referenceImages && referenceImages.length > 0) {
        appendEvent("info", `附带 ${referenceImages.length} 张参考图`)
      }
      try {
        const rec = await addRecord({
          prompt,
          model: config.model,
          ratio,
          pixels,
          referenceImages,
        })
        setActive(rec.id)
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "提交失败，请重试"
        appendEvent("error", message)
      }
    },
    [config.model, addRecord, setActive, appendEvent, clearEvents]
  )

  const retry = useCallback<UseGenerateReturn["retry"]>(
    async (id) => {
      const target = recordsRef.current.find((r) => r.id === id)
      if (!target) return
      appendEvent("info", `重试记录 #${id}（创建新任务）`)
      try {
        const rec = await addRecord({
          prompt: target.prompt,
          model: target.model,
          ratio: target.ratio,
          pixels: target.pixels,
          referenceImages: target.referenceImages,
        })
        setActive(rec.id)
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "重试失败"
        appendEvent("error", message)
      }
    },
    [addRecord, setActive, appendEvent]
  )

  return { submit, retry, isProcessing, waitingCount }
}
