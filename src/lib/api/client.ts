import {
  ApiResponseError,
  HttpError,
  classifyError,
  type ClassifiedError,
} from "./errors"
import { IMAGE_GENERATION_MODEL, RESPONSE_IMAGE_MODEL } from "./models"

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
  ratio: string
  pixels: string
  referenceImages?: string[]
  onEvent?: OnGenerateEvent
}

const SYSTEM_PROMPT =
  "你是一个图片生成助手。用户要求你生成图片时,你必须调用 image_generation 工具来生成图片,不要用文字描述图片内容。直接生成图片,不要多说任何话。"

const NOISY_EVENTS = new Set([
  "keepalive",
  "response.output_text.delta",
])

const IMAGE_GENERATION_EVENTS = new Set([
  "response.image_generation_call.completed",
  "response.image_generation_call.generating",
  "response.image_generation_call.in_progress",
  "response.image_generation_call.partial_image",
])

const GENERATE_IMAGE_TIMEOUT_MS = 300_000

function normalizeBaseUrl(baseUrl: string): string {
  let base = baseUrl.trim().replace(/\/+$/, "")
  if (base.endsWith("/v1")) base = base.slice(0, -3)
  return base
}

function withApiProxy(url: string): string {
  if (typeof window === "undefined") return url
  return `/api/proxy?target=${encodeURIComponent(url)}`
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

function mapImageSize(ratio: string): string {
  if (ratio === "3:4" || ratio === "9:16") return "1024x1536"
  if (ratio === "4:3" || ratio === "16:9") return "1536x1024"
  if (ratio === "1:1") return "1024x1024"
  return "auto"
}

function mapImageQuality(pixels: string): string {
  if (pixels === "4K") return "high"
  if (pixels === "1K") return "low"
  return "medium"
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
  if (!match) {
    throw new ApiResponseError("参考图格式无效")
  }
  const mime = match[1]
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ext = mime === "image/jpeg" ? "jpg" : mime.slice("image/".length)
  return { blob: new Blob([bytes], { type: mime }), ext }
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

function extractBase64FromImagesResponse(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null
  const data = (obj as { data?: unknown }).data
  if (!Array.isArray(data)) return null
  for (const item of data) {
    if (!item || typeof item !== "object") continue
    const record = item as { b64_json?: unknown; base64?: unknown }
    if (typeof record.b64_json === "string") return record.b64_json
    if (typeof record.base64 === "string") return record.base64
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

async function generateImageWithImagesApi(
  params: GenerateImageParams
): Promise<{ base64: string }> {
  const { baseUrl, apiKey, model, prompt, ratio, pixels, referenceImages, onEvent } =
    params

  if (referenceImages && referenceImages.length > 0) {
    const upstreamUrl = normalizeBaseUrl(baseUrl) + "/v1/images/edits"
    const url = withApiProxy(upstreamUrl)
    const form = new FormData()
    form.append("model", model)
    form.append("prompt", prompt)
    form.append("size", mapImageSize(ratio))
    form.append("quality", mapImageQuality(pixels))
    form.append("n", "1")
    referenceImages.forEach((dataUrl, index) => {
      const { blob, ext } = dataUrlToBlob(dataUrl)
      form.append("image", blob, `reference-${index + 1}.${ext}`)
    })

    onEvent?.(
      "info",
      `POST ${upstreamUrl} (with ${referenceImages.length} reference image${
        referenceImages.length > 1 ? "s" : ""
      })`
    )

    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(GENERATE_IMAGE_TIMEOUT_MS),
    })

    if (!resp.ok) {
      const errorBody = await resp.text()
      onEvent?.("error", `HTTP ${resp.status}: ${errorBody.slice(0, 200)}`)
      throw new HttpError(resp.status, errorBody)
    }

    const data = (await resp.json()) as unknown
    const base64 = extractBase64FromImagesResponse(data)
    if (!base64) {
      onEvent?.("error", "Images Edit API 未返回 base64 图片")
      throw new ApiResponseError("API 未返回图片")
    }

    const kb = Math.round(base64.length / 1024)
    onEvent?.("done", `图片已抓取 (≈ ${kb} KB base64)`)
    return { base64 }
  }

  const upstreamUrl = normalizeBaseUrl(baseUrl) + "/v1/images/generations"
  const url = withApiProxy(upstreamUrl)
  const body = {
    model,
    prompt,
    size: mapImageSize(ratio),
    quality: mapImageQuality(pixels),
    n: 1,
  }

  onEvent?.("info", `POST ${upstreamUrl}`)

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GENERATE_IMAGE_TIMEOUT_MS),
  })

  if (!resp.ok) {
    const errorBody = await resp.text()
    onEvent?.("error", `HTTP ${resp.status}: ${errorBody.slice(0, 200)}`)
    throw new HttpError(resp.status, errorBody)
  }

  const data = (await resp.json()) as unknown
  const base64 = extractBase64FromImagesResponse(data)
  if (!base64) {
    onEvent?.("error", "Images API 未返回 base64 图片")
    throw new ApiResponseError("API 未返回图片")
  }

  const kb = Math.round(base64.length / 1024)
  onEvent?.("done", `图片已抓取 (≈ ${kb} KB base64)`)
  return { base64 }
}

export async function generateImage(
  params: GenerateImageParams
): Promise<{ base64: string }> {
  if (params.model === IMAGE_GENERATION_MODEL) {
    return generateImageWithImagesApi(params)
  }

  const { baseUrl, apiKey, model, prompt, referenceImages, onEvent } = params
  const upstreamUrl = normalizeBaseUrl(baseUrl) + "/v1/responses"
  const url = withApiProxy(upstreamUrl)

  const hasReference = referenceImages && referenceImages.length > 0
  const userContent = hasReference
    ? [
        {
          type: "input_text",
          text: `请基于下方参考图生成新的图片,描述:${prompt}`,
        },
        ...referenceImages.map((dataUrl) => ({
          type: "input_image",
          image_url: dataUrl,
        })),
      ]
    : `请生成以下描述的图片:${prompt}`

  const body = {
    model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    tools: [{ type: "image_generation", output_format: "png" }],
    tool_choice: { type: "image_generation" },
    stream: true,
  }

  onEvent?.(
    "info",
    hasReference
      ? `POST ${upstreamUrl} (with ${referenceImages.length} reference image${
          referenceImages.length > 1 ? "s" : ""
        })`
      : `POST ${upstreamUrl}`
  )

  const resp = await fetch(url, {
    method: "POST",
    headers: buildCodexHeaders(apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GENERATE_IMAGE_TIMEOUT_MS),
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
  let sawImageGenerationEvent = false
  let sawTextOutputEvent = false

  const processLine = (rawLine: string): string | null => {
    const trimmed = rawLine.trim()
    if (!trimmed) return null

    if (trimmed.startsWith("event: ")) {
      const eventName = trimmed.slice(7).trim()
      if (IMAGE_GENERATION_EVENTS.has(eventName)) {
        sawImageGenerationEvent = true
      }
      if (eventName.startsWith("response.output_text.")) {
        sawTextOutputEvent = true
      }
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

  if (!sawImageGenerationEvent && sawTextOutputEvent) {
    onEvent?.("error", "模型返回了文本,未调用 image_generation 工具")
    throw new ApiResponseError("模型未调用图片生成工具")
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
    const probe = await fetch(withApiProxy(base + "/v1/models"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (probe.status === 401 || probe.status === 403) {
      const body = await probe.text()
      return {
        ok: false,
        classified: classifyError(new HttpError(probe.status, body)),
      }
    }

    if (probe.status < 500) {
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
