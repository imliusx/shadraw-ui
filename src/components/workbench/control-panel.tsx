"use client"

import * as React from "react"
import { motion } from "motion/react"
import {
  Eraser,
  Hourglass,
  Loader2,
  Minus,
  PanelRight,
  Plus,
  Settings2,
  WandSparkles,
} from "lucide-react"

import {
  useConfig,
  useGenerate,
  useSettingsDialog,
} from "@/app/providers/app-state-provider"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"

import { pixelOptions, ratios, countOptions } from "./data"
import {
  ReferenceImageUploader,
  readImageFileAsDataUrl,
} from "./reference-image-uploader"

const MAX_REFERENCE_IMAGES = 4

type ControlPanelProps = {
  prompt: string
  setPrompt: (value: string) => void
  ratio: string
  setRatio: (value: string) => void
  pixels: string
  setPixels: (value: string) => void
  count: number
  setCount: (value: number) => void
  referenceImages: string[]
  setReferenceImages: React.Dispatch<React.SetStateAction<string[]>>
}

export function ControlPanel({
  prompt,
  setPrompt,
  ratio,
  setRatio,
  pixels,
  setPixels,
  count,
  setCount,
  referenceImages,
  setReferenceImages,
}: ControlPanelProps) {
  const { config } = useConfig()
  const { submit, isProcessing, waitingCount } = useGenerate()
  const { openSettings } = useSettingsDialog()
  const { slideInRight } = useMotionVariants()

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

  const handleGenerate = React.useCallback(() => {
    if (prompt.trim().length === 0) return
    void submit({ prompt, ratio, pixels, referenceImages })
  }, [prompt, ratio, pixels, referenceImages, submit])

  const apiConfigured =
    config.baseUrl.trim().length > 0 && config.apiKey.trim().length > 0

  const generateDisabled =
    prompt.trim().length === 0 || !apiConfigured

  return (
    <motion.aside
      variants={slideInRight}
      initial="hidden"
      animate="show"
      className="flex h-full min-w-0 flex-col"
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">参数控制</p>
        </div>
        <Button size="icon-sm" variant="ghost">
          <PanelRight className="size-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-6 px-4 pb-4 pt-2">
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="prompt">提示词</Label>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={prompt.length === 0}
                aria-label="清空提示词"
                onClick={() => setPrompt("")}
              >
                <Eraser className="size-4" />
              </Button>
            </div>
            <div
              className={cn(
                "flex h-44 min-h-36 flex-col overflow-hidden rounded-lg border border-input bg-transparent transition-colors resize-y dark:bg-input/30",
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
              <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-2">
                <div className="flex min-w-0 items-center gap-2">
                  <ReferenceImageUploader
                    values={referenceImages}
                    onRemove={handleRemoveReference}
                    onPick={openPicker}
                    max={MAX_REFERENCE_IMAGES}
                  />
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {config.model ? (
                      <span className="truncate">{config.model}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={openSettings}
                        className="shrink-0 text-primary underline-offset-2 hover:underline"
                      >
                        未配置模型 →
                      </button>
                    )}
                    <span aria-hidden="true" className="shrink-0 text-muted-foreground/40">
                      ·
                    </span>
                    <span className="shrink-0">{ratio}</span>
                    <span aria-hidden="true" className="shrink-0 text-muted-foreground/40">
                      ·
                    </span>
                    <span className="shrink-0">{pixels}</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {prompt.length} 字符
                </span>
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
            <Button
              className="w-full"
              disabled={generateDisabled}
              onClick={handleGenerate}
            >
              <WandSparkles className="size-4" />
              提交任务
              {waitingCount > 0 ? (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[11px] font-medium leading-none tabular-nums">
                  +{waitingCount}
                </span>
              ) : null}
            </Button>
            {isProcessing || waitingCount > 0 ? (
              <QueueStatusBadge
                running={isProcessing ? 1 : 0}
                waiting={waitingCount}
              />
            ) : null}
            {!apiConfigured ? (
              <p className="text-xs text-muted-foreground">
                未配置 API，
                <button
                  type="button"
                  onClick={openSettings}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  打开设置
                </button>
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="image-count">图片数量</Label>
            <ButtonGroup className="w-32 shrink-0">
              <Input
                id="image-count"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={count}
                onChange={(event) => {
                  const raw = event.target.value
                  if (raw === "") return
                  const next = Number.parseInt(raw, 10)
                  if (Number.isNaN(next)) return
                  const min = Math.min(...countOptions)
                  const max = Math.max(...countOptions)
                  setCount(Math.max(min, Math.min(max, next)))
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  setCount(Math.max(Math.min(...countOptions), count - 1))
                }
                disabled={count <= Math.min(...countOptions)}
                aria-label="减少"
              >
                <Minus />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  setCount(Math.min(Math.max(...countOptions), count + 1))
                }
                disabled={count >= Math.max(...countOptions)}
                aria-label="增加"
              >
                <Plus />
              </Button>
            </ButtonGroup>
          </div>

          <div className="grid gap-3">
            <Label>图片比例</Label>
            <div className="grid grid-cols-6 gap-1 overflow-hidden">
              {ratios.map((item) => (
                <Button
                  key={item.label}
                  type="button"
                  variant={ratio === item.label ? "default" : "outline"}
                  className="h-12 min-w-0 flex-col gap-0.5 rounded-md px-0 text-xs"
                  onClick={() => setRatio(item.label)}
                >
                  <RatioIcon
                    ratio={item.label}
                    active={ratio === item.label}
                  />
                  <span>{item.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <Label>图片像素</Label>
            <ButtonGroup className="w-full">
              {pixelOptions.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={pixels === item ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setPixels(item)}
                >
                  {item}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </div>
      </ScrollArea>
    </motion.aside>
  )
}

function RatioIcon({ ratio, active }: { ratio: string; active: boolean }) {
  const isAuto = ratio === "auto"
  const [width, height] = isAuto ? [0, 0] : ratio.split(":").map(Number)
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
      className="flex flex-wrap items-center gap-2"
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
