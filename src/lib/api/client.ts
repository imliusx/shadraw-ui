import {
  ApiResponseError,
  HttpError,
  classifyError,
  type ClassifiedError,
} from "./errors"

export type GenerateEventLevel = "info" | "event" | "data" | "done" | "error"

export type OnGenerateEvent = (
  level: GenerateEventLevel,
  message: string
) => void

type GenerateImageParams = {
  baseUrl: string
  apiKey: string
  model: string
  prompt: string
  onEvent?: OnGenerateEvent
}

const SYSTEM_PROMPT =
  "你是一个图片生成助手。用户要求你生成图片时,你必须调用 image_generation 工具来生成图片,不要用文字描述图片内容。直接生成图片,不要多说任何话。"

const NOISY_EVENTS = new Set([
  "keepalive",
  "response.output_text.delta",
])

function normalizeBaseUrl(baseUrl: string): string {
  let base = baseUrl.trim().replace(/\/+$/, "")
  if (base.endsWith("/v1")) base = base.slice(0, -3)
  return base
}

function buildCodexHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    accept: "text/event-stream",
    "chatgpt-account-id": "",
    version: "0.122.0",
    originator: "codex_cli_rs",
    session_id: `browser-${Date.now()}`,
  }
}

function extractBase64FromStream(obj: unknown): string | null {
  if (obj == null) return null
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = extractBase64FromStream(item)
      if (found) return found
    }
    return null
  }
  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (
        key === "result" &&
        typeof value === "string" &&
        (value.startsWith("iVBOR") || value.length > 1000)
      ) {
        return value
      }
      const found = extractBase64FromStream(value)
      if (found) return found
    }
  }
  return null
}

function parseDataLine(trimmed: string): unknown | null {
  const dataStr = trimmed.slice(6)
  if (!dataStr || dataStr === "[DONE]") return null
  try {
    return JSON.parse(dataStr)
  } catch {
    return null
  }
}

export async function generateImage(
  params: GenerateImageParams
): Promise<{ base64: string }> {
  const { baseUrl, apiKey, model, prompt, onEvent } = params
  const url = normalizeBaseUrl(baseUrl) + "/v1/responses"

  const body = {
    model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `请生成以下描述的图片:${prompt}` },
    ],
    tools: [{ type: "image_generation", output_format: "png" }],
    stream: true,
  }

  onEvent?.("info", `POST ${url}`)

  const resp = await fetch(url, {
    method: "POST",
    headers: buildCodexHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  if (!resp.ok) {
    const errorBody = await resp.text()
    onEvent?.("error", `HTTP ${resp.status}: ${errorBody.slice(0, 200)}`)
    throw new HttpError(resp.status, errorBody)
  }

  if (!resp.body) {
    onEvent?.("error", "响应无 body")
    throw new ApiResponseError("API 未返回响应流")
  }

  onEvent?.("info", `HTTP ${resp.status},开始接收 SSE 流`)

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const processLine = (rawLine: string): string | null => {
    const trimmed = rawLine.trim()
    if (!trimmed) return null

    if (trimmed.startsWith("event: ")) {
      const eventName = trimmed.slice(7).trim()
      if (eventName && !NOISY_EVENTS.has(eventName)) {
        onEvent?.("event", eventName)
      }
      return null
    }

    if (trimmed.startsWith("data: ")) {
      const data = parseDataLine(trimmed)
      if (data == null) return null
      const found = extractBase64FromStream(data)
      if (found) return found
    }

    return null
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const found = processLine(line)
        if (found) {
          const kb = Math.round(found.length / 1024)
          onEvent?.("done", `图片已抓取 (≈ ${kb} KB base64)`)
          await reader.cancel().catch(() => {})
          return { base64: found }
        }
      }
    }

    const tailFound = processLine(buffer)
    if (tailFound) {
      const kb = Math.round(tailFound.length / 1024)
      onEvent?.("done", `图片已抓取 (≈ ${kb} KB base64)`)
      return { base64: tailFound }
    }
  } finally {
    reader.releaseLock()
  }

  onEvent?.("error", "SSE 流结束但未捕获到图片")
  throw new ApiResponseError("API 未返回图片")
}

type TestConnectionParams = {
  baseUrl: string
  apiKey: string
}

type TestConnectionResult =
  | { ok: true }
  | { ok: false; classified: ClassifiedError }

export async function testConnection(
  params: TestConnectionParams
): Promise<TestConnectionResult> {
  const { baseUrl, apiKey } = params
  const base = normalizeBaseUrl(baseUrl)

  try {
    const probe = await fetch(base + "/v1/models", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (probe.ok) {
      return { ok: true }
    }

    if (probe.status === 401 || probe.status === 403) {
      const body = await probe.text()
      return {
        ok: false,
        classified: classifyError(new HttpError(probe.status, body)),
      }
    }

    if (probe.status === 404) {
      const fallback = await fetch(base + "/v1/responses", {
        method: "POST",
        headers: buildCodexHeaders(apiKey),
        body: JSON.stringify({
          model: "gpt-5.3-codex",
          input: " ",
          stream: false,
        }),
      })

      if (fallback.ok) {
        return { ok: true }
      }

      if (fallback.status === 401 || fallback.status === 403) {
        const body = await fallback.text()
        return {
          ok: false,
          classified: classifyError(new HttpError(fallback.status, body)),
        }
      }

      return { ok: true }
    }

    const body = await probe.text()
    return {
      ok: false,
      classified: classifyError(new HttpError(probe.status, body)),
    }
  } catch (error) {
    return { ok: false, classified: classifyError(error) }
  }
}
