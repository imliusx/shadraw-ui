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
  Images,
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

import { pixelOptions, ratios, countOptions } from "./data"
import {
  ReferenceImageUploader,
  readImageFileAsDataUrl,
} from "./reference-image-uploader"

const MAX_REFERENCE_IMAGES = 4

type ModelIconComponent = React.ComponentType<{ size?: number | string }>

function getModelIcon(value: string | undefined): ModelIconComponent {
  switch (value) {
    case RESPONSE_IMAGE_MODEL:
      return Codex
    default:
      return OpenAI
  }
}

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
  const { config, updateConfig } = useConfig()
  const { submit, isProcessing, waitingCount } = useGenerate()
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

  const handleGenerate = React.useCallback(() => {
    if (prompt.trim().length === 0) return
    void submit({ prompt, ratio, pixels, referenceImages })
    toast.info("已提交生成任务")
  }, [prompt, ratio, pixels, referenceImages, submit])

  const apiConfigured = Boolean(config.model)

  const generateDisabled =
    prompt.trim().length === 0 || !apiConfigured

  const selectedModelLabel = config.model
    ? modelOptions.find((option) => option.value === config.model)?.label ??
      config.model
    : "未配置"
  const selectedRatioLabel = ratio === "auto" ? "自动" : ratio
  const selectedCountLabel = `${count} 张`

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
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
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
                          onSelect={() =>
                            updateConfig({ model: option.value })
                          }
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
                    tooltip={`参数: ${selectedRatioLabel} · ${pixels}`}
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>图片比例</DropdownMenuLabel>
                      {ratios.map((item) => (
                        <DropdownMenuItem
                          key={item.label}
                          onSelect={() => setRatio(item.label)}
                        >
                          <RatioIcon ratio={item.label} active={false} />
                          <span>{item.label}</span>
                          <Check
                            className={cn(
                              "ml-auto",
                              ratio === item.label
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>图片像素</DropdownMenuLabel>
                      {pixelOptions.map((item) => (
                        <DropdownMenuItem
                          key={item}
                          onSelect={() => setPixels(item)}
                        >
                          <span>{item}</span>
                          <Check
                            className={cn(
                              "ml-auto",
                              pixels === item ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </IconParam>
                  <IconParam
                    icon={<Images />}
                    ariaLabel="选择图片数量"
                    tooltip={`数量: ${selectedCountLabel}`}
                  >
                    {countOptions.map((value) => (
                      <DropdownMenuItem
                        key={value}
                        onSelect={() => setCount(value)}
                      >
                        <span>{value} 张</span>
                        <Check
                          className={cn(
                            "ml-auto",
                            count === value ? "opacity-100" : "opacity-0"
                          )}
                        />
                      </DropdownMenuItem>
                    ))}
                  </IconParam>
                </div>
                <div
                  className="flex min-w-0 shrink-0 flex-wrap items-center gap-1"
                  aria-label="当前图片参数"
                >
                  {[selectedModelLabel, selectedRatioLabel, pixels, selectedCountLabel].map(
                    (item) => (
                      <Badge
                        key={item}
                        variant="secondary"
                        className="text-muted-foreground"
                        title={item}
                      >
                        <BadgeCheck data-icon="inline-start" />
                        <span>{item}</span>
                      </Badge>
                    )
                  )}
                </div>
                {isProcessing || waitingCount > 0 ? (
                  <QueueStatusBadge
                    running={isProcessing ? 1 : 0}
                    waiting={waitingCount}
                  />
                ) : null}
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
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {prompt.length} 字符
                  </span>
                  <Button
                    type="button"
                    size="icon-lg"
                    disabled={generateDisabled}
                    onClick={handleGenerate}
                    aria-label="提交任务"
                    className="rounded-full hover:bg-primary/80"
                  >
                    <ArrowUp className="size-5" strokeWidth={2.5} />
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
