import type { ImageParams } from "./types"

export const DEFAULT_IMAGE_PARAMS: ImageParams = {
  size: "auto",
  quality: "auto",
  background: "auto",
  moderation: "auto",
  output_format: "png",
}

export const sizeOptions = [
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "4096x4096",
]

export const qualityOptions = ["auto", "high", "medium", "low"] as const
export const backgroundOptions = ["auto", "transparent", "opaque"] as const
export const moderationOptions = ["auto", "low"] as const
export const outputFormatOptions = ["png", "jpeg", "webp"] as const
