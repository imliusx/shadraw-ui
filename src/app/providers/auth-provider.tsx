"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

const ERROR_TRIGGER = /^error@|fail/i
const MOCK_LATENCY_MS = 600
const ERROR_MESSAGE = "登录失败，请检查邮箱与密码"

export type AuthUser = {
  id: string
  displayName: string
  email: string
  avatarSeed: string
}

export type AuthStatus = "idle" | "submitting" | "error"

export type LoginInput = {
  email: string
  password: string
}

export type RegisterInput = {
  email: string
  password: string
  displayName: string
}

type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  error: string | null
  login: (input: LoginInput) => Promise<boolean>
  register: (input: RegisterInput) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async ({ email, password: _password }: LoginInput): Promise<boolean> => {
    setStatus("submitting")
    setError(null)
    await sleep(MOCK_LATENCY_MS)
    if (ERROR_TRIGGER.test(email)) {
      setStatus("error")
      setError(ERROR_MESSAGE)
      return false
    }
    const localPart = email.split("@")[0] || email
    setUser({
      id: randomId(),
      email,
      displayName: localPart,
      avatarSeed: localPart,
    })
    setStatus("idle")
    return true
  }, [])

  const register = useCallback(
    async ({ email, password: _password, displayName }: RegisterInput): Promise<boolean> => {
      setStatus("submitting")
      setError(null)
      await sleep(MOCK_LATENCY_MS)
      if (ERROR_TRIGGER.test(email)) {
        setStatus("error")
        setError(ERROR_MESSAGE)
        return false
      }
      setUser({
        id: randomId(),
        email,
        displayName,
        avatarSeed: displayName,
      })
      setStatus("idle")
      return true
    },
    []
  )

  const logout = useCallback(() => {
    setUser(null)
    setStatus("idle")
    setError(null)
  }, [])

  const clearError = useCallback(() => {
    setStatus((prev) => (prev === "error" ? "idle" : prev))
    setError(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, error, login, register, logout, clearError }),
    [user, status, error, login, register, logout, clearError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
