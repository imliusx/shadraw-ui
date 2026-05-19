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
  testConnection as testConnectionApi,
  generateImage,
  type GenerateEventLevel,
} from "@/lib/api/client"
import { add, del, getAll, put } from "@/lib/idb/db"
import { DEFAULT_CONFIG, loadConfig, saveConfig } from "@/lib/config/storage"
import { startQueue } from "@/lib/queue/scheduler"
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

export type EventLogLevel = GenerateEventLevel

export type EventLogEntry = {
  id: number
  ts: number
  level: EventLogLevel
  message: string
}

const EVENT_LOG_CAP = 200

type AppState = {
  history: HistoryRecord[]
  projects: Project[]
  config: Config
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
  | { type: "config/load"; payload: Config }
  | { type: "config/update"; payload: Partial<Config> }
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
        history: state.history.map((record) =>
          record.id === action.payload.id
            ? { ...record, ...action.payload.patch }
            : record
        ),
      }
    case "history/delete":
      return {
        ...state,
        history: state.history.filter(
          (record) => record.id !== action.payload
        ),
        activeHistoryId:
          state.activeHistoryId === action.payload
            ? null
            : state.activeHistoryId,
      }
    case "projects/load":
      return { ...state, projects: action.payload }
    case "projects/add":
      return { ...state, projects: [...state.projects, action.payload] }
    case "projects/rename":
      return {
        ...state,
        projects: state.projects.map((project) =>
          project.id === action.payload.id
            ? { ...project, name: action.payload.name }
            : project
        ),
      }
    case "projects/delete":
      return {
        ...state,
        projects: state.projects.filter(
          (project) => project.id !== action.payload
        ),
        history: state.history.map((record) =>
          record.projectId === action.payload
            ? { ...record, projectId: undefined }
            : record
        ),
      }
    case "config/load":
      return { ...state, config: action.payload }
    case "config/update":
      return { ...state, config: { ...state.config, ...action.payload } }
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
      return {
        ...state,
        lightbox: { open: false, recordId: null, navList: null },
      }
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
      if (next.length > EVENT_LOG_CAP) {
        next.splice(0, next.length - EVENT_LOG_CAP)
      }
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
  }) => Promise<HistoryRecord>
  updateRecord: (
    id: number,
    patch: Partial<HistoryRecord>
  ) => Promise<void>
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
  updateConfig: (patch: Partial<Config>) => void
  testConnection: () => Promise<void>
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

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const stateRef = useRef<AppState>(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getAll<HistoryRecord>("history"),
      getAll<Project>("projects"),
    ])
      .then(async ([history, projects]) => {
        if (cancelled) return
        const stale = history.filter(
          (record) =>
            record.status === "waiting" || record.status === "running"
        )
        const sweptHistory = history.map((record) => {
          if (record.status === "waiting" || record.status === "running") {
            return {
              ...record,
              status: "failed" as const,
              error: record.error ?? "页面刷新前未完成",
              completedAt: record.completedAt ?? Date.now(),
            }
          }
          return record
        })
        if (stale.length > 0) {
          await Promise.all(
            stale.map((record) =>
              put<HistoryRecord>("history", {
                ...record,
                status: "failed",
                error: record.error ?? "页面刷新前未完成",
                completedAt: record.completedAt ?? Date.now(),
              })
            )
          ).catch(() => {})
        }
        if (cancelled) return
        const config = loadConfig()
        dispatch({ type: "history/load", payload: sweptHistory })
        dispatch({ type: "projects/load", payload: projects })
        dispatch({ type: "config/load", payload: config })
        dispatch({ type: "system/hydrated" })
      })
      .catch(() => {
        if (cancelled) return
        const config = loadConfig()
        dispatch({ type: "config/load", payload: config })
        dispatch({ type: "system/hydrated" })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const addRecord = useCallback<HistoryContextValue["addRecord"]>(
    async ({ prompt, model, ratio, pixels }) => {
      const draft: Omit<HistoryRecord, "id"> = {
        prompt,
        model,
        ratio,
        pixels,
        status: "waiting",
        favorite: false,
        createdAt: Date.now(),
      }
      const id = await add<HistoryRecord>("history", draft)
      const record: HistoryRecord = { ...draft, id }
      stateRef.current = {
        ...stateRef.current,
        history: [...stateRef.current.history, record],
      }
      dispatch({ type: "history/add", payload: record })
      return record
    },
    []
  )

  const updateRecord = useCallback<HistoryContextValue["updateRecord"]>(
    async (id, patch) => {
      const current = stateRef.current.history.find((r) => r.id === id)
      if (!current) return
      const merged: HistoryRecord = { ...current, ...patch }
      stateRef.current = {
        ...stateRef.current,
        history: stateRef.current.history.map((r) =>
          r.id === id ? merged : r
        ),
      }
      await put<HistoryRecord>("history", merged)
      dispatch({ type: "history/update", payload: { id, patch } })
    },
    []
  )

  const deleteRecord = useCallback<HistoryContextValue["deleteRecord"]>(
    async (id) => {
      stateRef.current = {
        ...stateRef.current,
        history: stateRef.current.history.filter((r) => r.id !== id),
        activeHistoryId:
          stateRef.current.activeHistoryId === id
            ? null
            : stateRef.current.activeHistoryId,
      }
      await del("history", id)
      dispatch({ type: "history/delete", payload: id })
    },
    []
  )

  const getById = useCallback(
    (id: number) => state.history.find((r) => r.id === id),
    [state.history]
  )

  const addProject = useCallback<ProjectsContextValue["addProject"]>(
    async (name) => {
      const draft: Omit<Project, "id"> = { name, createdAt: Date.now() }
      const id = await add<Project>("projects", draft)
      const project: Project = { ...draft, id }
      dispatch({ type: "projects/add", payload: project })
      return project
    },
    []
  )

  const renameProject = useCallback<ProjectsContextValue["renameProject"]>(
    async (id, name) => {
      const current = stateRef.current.projects.find((p) => p.id === id)
      if (!current) return
      const merged: Project = { ...current, name }
      await put<Project>("projects", merged)
      dispatch({ type: "projects/rename", payload: { id, name } })
    },
    []
  )

  const deleteProject = useCallback<ProjectsContextValue["deleteProject"]>(
    async (id) => {
      const affected = stateRef.current.history.filter(
        (record) => record.projectId === id
      )
      await Promise.all(
        affected.map((record) =>
          put<HistoryRecord>("history", { ...record, projectId: undefined })
        )
      )
      await del("projects", id)
      dispatch({ type: "projects/delete", payload: id })
    },
    []
  )

  const updateConfig = useCallback<ConfigContextValue["updateConfig"]>(
    (patch) => {
      const next: Config = { ...stateRef.current.config, ...patch }
      saveConfig(next)
      dispatch({ type: "config/update", payload: patch })
    },
    []
  )

  const setApiStatus = useCallback<UIContextValue["setApiStatus"]>(
    (status, errorMessage) => {
      dispatch({
        type: "ui/setApiStatus",
        payload: { status, errorMessage },
      })
    },
    []
  )

  const testConnection = useCallback<ConfigContextValue["testConnection"]>(
    async () => {
      const { baseUrl, apiKey } = stateRef.current.config
      dispatch({
        type: "ui/setApiStatus",
        payload: { status: "testing" },
      })
      const result = await testConnectionApi({ baseUrl, apiKey })
      if (result.ok) {
        dispatch({
          type: "ui/setApiStatus",
          payload: { status: "success" },
        })
      } else {
        dispatch({
          type: "ui/setApiStatus",
          payload: {
            status: "error",
            errorMessage: result.classified.title,
          },
        })
      }
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

  const setSettingsOpen = useCallback<UIContextValue["setSettingsOpen"]>(
    (open) => {
      dispatch({ type: "ui/setSettingsOpen", payload: open })
    },
    []
  )

  const eventIdRef = useRef(0)

  const appendEvent = useCallback<EventLogContextValue["append"]>(
    (level, message) => {
      eventIdRef.current += 1
      dispatch({
        type: "events/append",
        payload: {
          id: eventIdRef.current,
          ts: Date.now(),
          level,
          message,
        },
      })
    },
    []
  )

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
      updateConfig,
      testConnection,
    }),
    [state.config, updateConfig, testConnection]
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

function useHistoryContext(): HistoryContextValue {
  const ctx = useContext(HistoryContext)
  if (!ctx) {
    throw new Error("useHistory must be used within AppStateProvider")
  }
  return ctx
}

function useProjectsContext(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext)
  if (!ctx) {
    throw new Error("useProjects must be used within AppStateProvider")
  }
  return ctx
}

function useConfigContext(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) {
    throw new Error("useConfig must be used within AppStateProvider")
  }
  return ctx
}

function useUIContext(): UIContextValue {
  const ctx = useContext(UIContext)
  if (!ctx) {
    throw new Error("useUI must be used within AppStateProvider")
  }
  return ctx
}

function useEventLogContext(): EventLogContextValue {
  const ctx = useContext(EventLogContext)
  if (!ctx) {
    throw new Error("useEventLog must be used within AppStateProvider")
  }
  return ctx
}

export function useHistory(): HistoryContextValue {
  return useHistoryContext()
}

export function useProjects(): ProjectsContextValue {
  return useProjectsContext()
}

export function useConfig(): ConfigContextValue {
  return useConfigContext()
}

export function useActiveHistory(): [number | null, (id: number | null) => void] {
  const { activeHistoryId, setActive } = useUIContext()
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
  const { lightbox, openLightbox, closeLightbox } = useUIContext()
  return {
    open: lightbox.open,
    recordId: lightbox.recordId,
    navList: lightbox.navList,
    openWith: openLightbox,
    close: closeLightbox,
  }
}

type UseApiStatusReturn = {
  status: ApiStatus
  errorMessage: string
}

export function useApiStatus(): UseApiStatusReturn {
  const { apiStatus, apiErrorMessage } = useUIContext()
  return { status: apiStatus, errorMessage: apiErrorMessage }
}

type UseSettingsDialogReturn = {
  open: boolean
  openSettings: () => void
  closeSettings: () => void
  setOpen: (open: boolean) => void
}

export function useSettingsDialog(): UseSettingsDialogReturn {
  const { settingsOpen, setSettingsOpen } = useUIContext()
  return {
    open: settingsOpen,
    openSettings: useCallback(() => setSettingsOpen(true), [setSettingsOpen]),
    closeSettings: useCallback(() => setSettingsOpen(false), [setSettingsOpen]),
    setOpen: setSettingsOpen,
  }
}

export function useEventLog(): EventLogContextValue {
  return useEventLogContext()
}

type UseGenerateReturn = {
  submit: (params: {
    prompt: string
    ratio: string
    pixels: string
  }) => Promise<void>
  retry: (id: number) => Promise<void>
  isProcessing: boolean
}

export function useGenerate(): UseGenerateReturn {
  const { records, addRecord, updateRecord } = useHistoryContext()
  const { config } = useConfigContext()
  const { setActive } = useUIContext()
  const { append: appendEvent, clear: clearEvents } = useEventLogContext()

  const historyRef = useRef(records)
  useEffect(() => {
    historyRef.current = records
  }, [records])

  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  const updateRecordRef = useRef(updateRecord)
  useEffect(() => {
    updateRecordRef.current = updateRecord
  }, [updateRecord])

  const appendEventRef = useRef(appendEvent)
  useEffect(() => {
    appendEventRef.current = appendEvent
  }, [appendEvent])

  const isProcessing = useMemo(
    () => records.some((record) => record.status === "running"),
    [records]
  )

  const buildSchedulerDeps = useCallback(
    () => ({
      getNextWaiting: () =>
        historyRef.current.find((r) => r.status === "waiting"),
      callApi: async (target: HistoryRecord) => {
        const { baseUrl, apiKey } = configRef.current
        const { base64 } = await generateImage({
          baseUrl,
          apiKey,
          model: target.model,
          prompt: target.prompt,
          onEvent: (level, message) =>
            appendEventRef.current(level, message),
        })
        return base64
      },
      onStart: (id: number) => {
        appendEventRef.current("info", `开始处理记录 #${id}`)
        historyRef.current = historyRef.current.map((r) =>
          r.id === id
            ? { ...r, status: "running", startedAt: Date.now() }
            : r
        )
        void updateRecordRef.current(id, {
          status: "running",
          startedAt: Date.now(),
        })
      },
      onSuccess: (id: number, base64: string) => {
        appendEventRef.current("done", `生成完成 #${id}`)
        historyRef.current = historyRef.current.map((r) =>
          r.id === id
            ? { ...r, status: "completed", base64, completedAt: Date.now() }
            : r
        )
        void updateRecordRef.current(id, {
          status: "completed",
          base64,
          completedAt: Date.now(),
        })
      },
      onFailure: (id: number, error: string) => {
        appendEventRef.current("error", `失败 #${id}: ${error}`)
        historyRef.current = historyRef.current.map((r) =>
          r.id === id
            ? { ...r, status: "failed", error, completedAt: Date.now() }
            : r
        )
        void updateRecordRef.current(id, {
          status: "failed",
          error,
          completedAt: Date.now(),
        })
      },
    }),
    []
  )

  const submit = useCallback<UseGenerateReturn["submit"]>(
    async ({ prompt, ratio, pixels }) => {
      clearEvents()
      appendEvent("info", `提交生成请求: ${prompt.slice(0, 60)}`)

      const record = await addRecord({
        prompt,
        model: configRef.current.model,
        ratio,
        pixels,
      })

      historyRef.current = [...historyRef.current, record]
      setActive(record.id)

      startQueue(buildSchedulerDeps())
    },
    [addRecord, setActive, appendEvent, clearEvents, buildSchedulerDeps]
  )

  const retry = useCallback<UseGenerateReturn["retry"]>(
    async (id) => {
      const target = historyRef.current.find((r) => r.id === id)
      if (!target) return
      clearEvents()
      appendEvent("info", `重试记录 #${id}`)

      historyRef.current = historyRef.current.map((r) =>
        r.id === id
          ? { ...r, status: "waiting", error: undefined }
          : r
      )
      setActive(id)
      await updateRecord(id, { status: "waiting", error: undefined })
      startQueue(buildSchedulerDeps())
    },
    [updateRecord, setActive, appendEvent, clearEvents, buildSchedulerDeps]
  )

  return { submit, retry, isProcessing }
}
