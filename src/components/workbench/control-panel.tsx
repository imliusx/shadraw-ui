"use client"

import * as React from "react"
import { motion } from "motion/react"
import { toast } from "sonner"
import {
  ArrowUp,
  BadgeCheck,
  Check,
  Eraser,
  Hourglass,
  Loader2,
  SlidersHorizontal,
} from "lucide-react"
import { Codex, OpenAI } from "@lobehub/icons"

import {
  useConfig,
  useGenerate,
} from "@/app/providers/app-state-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"
import {
  RESPONSE_IMAGE_MODEL,
  modelOptions,
} from "@/lib/api/models"

import {
  backgroundOptions,
  moderationOptions,
  outputFormatOptions,
  qualityOptions,
  sizeOptions,
} from "./data"
import {
  ReferenceImageUploader,
  readImageFileAsDataUrl,
} from "./reference-image-uploader"
import type {
  ImageBackground,
  ImageModeration,
  ImageOutputFormat,
  ImageParams,
  ImageQuality,
} from "./types"

const MAX_REFERENCE_IMAGES = 4

type ModelIconComponent = React.ComponentType<{ size?: number | string }>

const SIZE_LABELS: Record<string, string> = {
  auto: "自动尺寸",
  "1024x1024": "方图",
  "1536x1024": "横图",
  "1024x1536": "竖图",
  "2048x2048": "高清方图",
  "4096x4096": "超清方图",
}

const QUALITY_LABELS: Record<ImageQuality, string> = {
  auto: "自动质量",
  high: "高质量",
  medium: "中等质量",
  low: "低质量",
}

const BACKGROUND_LABELS: Record<ImageBackground, string> = {
  auto: "自动背景",
  transparent: "透明背景",
  opaque: "不透明背景",
}

const MODERATION_LABELS: Record<ImageModeration, string> = {
  auto: "标准审核",
  low: "低强度审核",
}

const OUTPUT_FORMAT_LABELS: Record<ImageOutputFormat, string> = {
  png: "PNG 格式",
  jpeg: "JPEG 格式",
  webp: "WebP 格式",
}

function getModelIcon(value: string | undefined): ModelIconComponent {
  switch (value) {
    case RESPONSE_IMAGE_MODEL:
      return Codex
    default:
      return OpenAI
  }
}

function getSizeLabel(size: string): string {
  return SIZE_LABELS[size] ?? size
}

type ControlPanelProps = {
  prompt: string
  setPrompt: (value: string) => void
  imageParams: ImageParams
  setImageParams: React.Dispatch<React.SetStateAction<ImageParams>>
  referenceImages: string[]
  setReferenceImages: React.Dispatch<React.SetStateAction<string[]>>
}

export function ControlPanel({
  prompt,
  setPrompt,
  imageParams,
  setImageParams,
  referenceImages,
  setReferenceImages,
}: ControlPanelProps) {
  const { config, updateConfig } = useConfig()
  const { submit, runningCount, waitingCount } = useGenerate()
  const { fadeInUp } = useMotionVariants()

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const [referenceError, setReferenceError] = React.useState<string | null>(null)

  const openPicker = React.useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFiles = React.useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList)
      if (files.length === 0) return
      setReferenceError(null)
      const accepted: string[] = []
      for (const file of files) {
        const result = await readImageFileAsDataUrl(file)
        if (result.ok) {
          accepted.push(result.dataUrl)
        } else {
          setReferenceError(result.error)
          break
        }
      }
      if (accepted.length === 0) return
      setReferenceImages((prev) => {
        const next = [...prev, ...accepted].slice(0, MAX_REFERENCE_IMAGES)
        if (prev.length + accepted.length > MAX_REFERENCE_IMAGES) {
          setReferenceError(`最多 ${MAX_REFERENCE_IMAGES} 张参考图,多余的已忽略`)
        }
        return next
      })
    },
    [setReferenceImages]
  )

  const handleRemoveReference = React.useCallback(
    (index: number) => {
      setReferenceImages((prev) => prev.filter((_, i) => i !== index))
      setReferenceError(null)
    },
    [setReferenceImages]
  )

  const [submitting, setSubmitting] = React.useState(false)

  const handleGenerate = React.useCallback(async () => {
    if (submitting) return
    if (prompt.trim().length === 0) return
    setSubmitting(true)
    // Hold the loading state for at least 400ms so the spinner is perceivable
    // even when the backend round-trip is sub-100ms.
    const minDelay = new Promise((r) => setTimeout(r, 400))
    try {
      const [result] = await Promise.all([
        submit({ prompt, imageParams, referenceImages }),
        minDelay,
      ])
      if (result.ok) {
        setPrompt("")
        toast.success("已提交生成任务")
      } else {
        toast.error(result.message)
      }
    } finally {
      setSubmitting(false)
    }
  }, [submitting, prompt, imageParams, referenceImages, submit, setPrompt])

  const updateImageParams = React.useCallback(
    (patch: Partial<ImageParams>) => {
      setImageParams((prev) => ({ ...prev, ...patch }))
    },
    [setImageParams]
  )

  const generateDisabled = prompt.trim().length === 0 || submitting

  const selectedModelLabel = config.model
    ? modelOptions.find((option) => option.value === config.model)?.label ??
      config.model
    : "未配置"
  const selectedSizeLabel = getSizeLabel(imageParams.size)
  const selectedQualityLabel = QUALITY_LABELS[imageParams.quality]
  const selectedOutputFormatLabel =
    OUTPUT_FORMAT_LABELS[imageParams.output_format]

  return (
    <motion.section
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      className="flex h-full min-w-0 flex-col overflow-hidden"
    >
      <div className="mx-auto flex min-h-0 w-2/3 flex-1 flex-col gap-3 px-4 pb-4 pt-4">
        <div
          className={cn(
            "relative flex min-h-20 flex-1 flex-col overflow-hidden rounded-lg border border-input bg-transparent transition-colors dark:bg-input/30",
            "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            referenceError && "border-destructive ring-3 ring-destructive/20",
            dragOver && "border-ring bg-accent/40"
          )}
          onDragOver={(event) => {
            if (!Array.from(event.dataTransfer.types).includes("Files")) return
            event.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            setDragOver(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            const files = event.dataTransfer.files
            if (files && files.length > 0) void handleFiles(files)
          }}
        >
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="field-sizing-fixed min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-3 pb-3 pt-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            placeholder="描述你想生成的图片..."
          />
          <div className="flex items-center gap-2 px-2 pb-2 pt-2">
            <div className="flex shrink-0 items-center gap-0.5">
              <ReferenceImageUploader
                values={referenceImages}
                onRemove={handleRemoveReference}
                onPick={openPicker}
                max={MAX_REFERENCE_IMAGES}
              />
              <IconParam
                icon={React.createElement(getModelIcon(config.model), {
                  size: 16,
                })}
                ariaLabel="选择模型"
                tooltip={`模型: ${selectedModelLabel}`}
              >
                {modelOptions.map((option) => {
                  const ModelIcon = getModelIcon(option.value)
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => updateConfig({ model: option.value })}
                    >
                      <ModelIcon size={16} />
                      <span>{option.label}</span>
                      <Check
                        className={cn(
                          "ml-auto",
                          config.model === option.value
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </DropdownMenuItem>
                  )
                })}
              </IconParam>
              <IconParam
                icon={<SlidersHorizontal />}
                ariaLabel="选择图片参数"
                tooltip={`参数: ${selectedSizeLabel} · ${selectedQualityLabel}`}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>图片尺寸</DropdownMenuLabel>
                  {sizeOptions.map((size) => (
                    <DropdownMenuItem
                      key={size}
                      onSelect={() => updateImageParams({ size })}
                    >
                      <SizeIcon size={size} active={imageParams.size === size} />
                      <span>{getSizeLabel(size)}</span>
                      <Check
                        className={cn(
                          "ml-auto",
                          imageParams.size === size
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>生成质量</DropdownMenuLabel>
                  {qualityOptions.map((quality) => (
                    <DropdownMenuItem
                      key={quality}
                      onSelect={() => updateImageParams({ quality })}
                    >
                      <span>{QUALITY_LABELS[quality]}</span>
                      <Check
                        className={cn(
                          "ml-auto",
                          imageParams.quality === quality
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>背景处理</DropdownMenuLabel>
                  {backgroundOptions.map((background) => (
                    <DropdownMenuItem
                      key={background}
                      onSelect={() => updateImageParams({ background })}
                    >
                      <span>{BACKGROUND_LABELS[background]}</span>
                      <Check
                        className={cn(
                          "ml-auto",
                          imageParams.background === background
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>内容审核</DropdownMenuLabel>
                  {moderationOptions.map((moderation) => (
                    <DropdownMenuItem
                      key={moderation}
                      onSelect={() => updateImageParams({ moderation })}
                    >
                      <span>{MODERATION_LABELS[moderation]}</span>
                      <Check
                        className={cn(
                          "ml-auto",
                          imageParams.moderation === moderation
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>输出格式</DropdownMenuLabel>
                  {outputFormatOptions.map((outputFormat) => (
                    <DropdownMenuItem
                      key={outputFormat}
                      onSelect={() =>
                        updateImageParams({ output_format: outputFormat })
                      }
                    >
                      <span>{OUTPUT_FORMAT_LABELS[outputFormat]}</span>
                      <Check
                        className={cn(
                          "ml-auto",
                          imageParams.output_format === outputFormat
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <div className="grid gap-2 px-1.5 py-1">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>输出压缩质量</span>
                    <span className="font-mono">
                      {imageParams.output_compression ?? "自动"}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[imageParams.output_compression ?? 100]}
                    onValueChange={(value) =>
                      updateImageParams({
                        output_compression:
                          value[0] === 100 ? undefined : value[0],
                      })
                    }
                  />
                </div>
                <div className="grid gap-2 px-1.5 py-1">
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    <span>用户标识</span>
                    <Input
                      value={imageParams.user ?? ""}
                      placeholder="可选"
                      onChange={(event) =>
                        updateImageParams({
                          user: event.target.value.trim() || undefined,
                        })
                      }
                      className="h-7"
                    />
                  </label>
                </div>
              </IconParam>
            </div>
            <div
              className="flex min-w-0 shrink-0 flex-wrap items-center gap-1"
              aria-label="当前图片参数"
            >
              {[
                { key: "model", label: selectedModelLabel },
                { key: "size", label: selectedSizeLabel },
                { key: "quality", label: selectedQualityLabel },
                { key: "format", label: selectedOutputFormatLabel },
              ].map((item) => (
                <Badge
                  key={item.key}
                  variant="secondary"
                  className="text-muted-foreground"
                  title={item.label}
                >
                  <BadgeCheck data-icon="inline-start" />
                  <span>{item.label}</span>
                </Badge>
              ))}
            </div>
            {runningCount > 0 || waitingCount > 0 ? (
              <QueueStatusBadge running={runningCount} waiting={waitingCount} />
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={prompt.length === 0}
                    aria-label="清空提示词"
                    onClick={() => setPrompt("")}
                  >
                    <Eraser />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">清空提示词</TooltipContent>
              </Tooltip>
              <Button
                type="button"
                size="icon"
                disabled={generateDisabled}
                onClick={() => void handleGenerate()}
                aria-label="提交任务"
                className="rounded-full hover:bg-primary/80"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowUp strokeWidth={2.5} />
                )}
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = event.target.files
                ? Array.from(event.target.files)
                : []
              event.target.value = ""
              if (files.length > 0) void handleFiles(files)
            }}
          />
        </div>
        {referenceError ? (
          <p className="text-xs text-destructive">{referenceError}</p>
        ) : null}
      </div>
    </motion.section>
  )
}

function IconParam({
  icon,
  ariaLabel,
  tooltip,
  align = "start",
  children,
}: {
  icon: React.ReactNode
  ariaLabel: string
  tooltip: React.ReactNode
  align?: "start" | "end" | "center"
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={ariaLabel}
            >
              {icon}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align={align} className="w-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SizeIcon({ size, active }: { size: string; active: boolean }) {
  const isAuto = size === "auto"
  const [width, height] = isAuto ? [0, 0] : size.split("x").map(Number)
  const isPortrait = !isAuto && height > width
  const isSquare = !isAuto && width === height
  const isWide = !isAuto && width > height

  return (
    <span
      className={cn(
        "flex size-4 items-center justify-center",
        active ? "text-primary-foreground" : "text-muted-foreground"
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "rounded-[2px] border-2 border-current",
          (isSquare || isAuto) && "size-3.5",
          isAuto && "border-dashed",
          isPortrait && "h-4 w-2.5",
          isWide && "h-2.5 w-4"
        )}
      />
    </span>
  )
}

function QueueStatusBadge({
  running,
  waiting,
}: {
  running: number
  waiting: number
}) {
  if (running === 0 && waiting === 0) return null

  const infoClasses =
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300"
  const warningClasses =
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300"

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 items-center gap-1.5"
    >
      {running > 0 ? (
        <Badge variant="outline" className={cn("gap-1.5", infoClasses)}>
          <Loader2 className="animate-spin" />
          <span>{running} 进行中</span>
        </Badge>
      ) : null}
      {waiting > 0 ? (
        <Badge variant="outline" className={cn("gap-1.5", warningClasses)}>
          <Hourglass />
          <span>{waiting} 排队</span>
        </Badge>
      ) : null}
    </div>
  )
}
