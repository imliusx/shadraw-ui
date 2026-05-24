"use client"

import * as React from "react"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"
import {
  CircleAlert,
  Copy,
  Download,
  FileText,
  ImageIcon,
  RefreshCw,
  Star,
  WandSparkles,
} from "lucide-react"

import {
  useActiveHistory,
  useGenerate,
  useHistory,
  useLightbox,
} from "@/app/providers/app-state-provider"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useMotionVariants } from "@/lib/motion"
import type { HistoryRecord } from "@/components/workbench/types"
import { cn } from "@/lib/utils"

type PreviewStageProps = {
  setPrompt: (value: string) => void
  setRatio: (value: string) => void
  setPixels: (value: string) => void
}

export function PreviewStage({
  setPrompt,
  setRatio,
  setPixels,
}: PreviewStageProps) {
  const [activeId] = useActiveHistory()
  const { getById, updateRecord } = useHistory()
  const { openWith } = useLightbox()
  const { submit, retry } = useGenerate()

  const record = activeId !== null ? getById(activeId) : undefined

  const handleReuse = React.useCallback(() => {
    if (!record) return
    setPrompt(record.prompt)
    setRatio(record.ratio)
    setPixels(record.pixels)
    toast.success("提示词已复用")
  }, [record, setPrompt, setRatio, setPixels])

  const handleRegenerate = React.useCallback(() => {
    if (!record) return
    toast.info("已提交新生成请求")
    void submit({
      prompt: record.prompt,
      ratio: record.ratio,
      pixels: record.pixels,
    })
  }, [record, submit])

  const handleRetry = React.useCallback(() => {
    if (!record) return
    toast.success("已重新加入队列")
    void retry(record.id)
  }, [record, retry])

  const handleDownload = React.useCallback(() => {
    if (!record?.base64) return
    const stamp = new Date(record.createdAt)
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 15)
    const link = document.createElement("a")
    link.href = `data:image/png;base64,${record.base64}`
    link.download = `shadraw-${stamp}-${record.id}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("下载已开始")
  }, [record])

  const handleToggleFavorite = React.useCallback(async () => {
    if (!record) return
    await updateRecord(record.id, { favorite: !record.favorite })
    toast.success(record.favorite ? "已取消收藏" : "已加入收藏")
  }, [record, updateRecord])

  const handleCopyPrompt = React.useCallback(async () => {
    if (!record) return
    try {
      await navigator.clipboard.writeText(record.prompt)
      toast.success("提示词已复制")
    } catch {
      toast.error("复制失败")
    }
  }, [record])

  const handleOpenLightbox = React.useCallback(() => {
    if (!record) return
    openWith(record.id)
  }, [openWith, record])

  const stageKey = !record
    ? "empty"
    : record.status === "waiting" || record.status === "running"
      ? `loading-${record.id}`
      : record.status === "failed"
        ? `failed-${record.id}`
        : record.base64
          ? `completed-${record.id}`
          : "empty"

  return (
    <section className="flex h-full min-w-0 flex-col bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklab,var(--foreground)_14%,transparent)_1px,transparent_0)] bg-[size:22px_22px]">
      <div className="@container/preview flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 md:p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stageKey}
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] },
            }}
            exit={{
              opacity: 0,
              scale: 0.98,
              transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
            }}
            className="flex h-full w-full min-h-0 min-w-0 items-center justify-center"
          >
            {!record ? (
              <EmptyStageState />
            ) : record.status === "waiting" || record.status === "running" ? (
              <GeneratingState />
            ) : record.status === "failed" ? (
              <FailedState
                record={record}
                onRetry={handleRetry}
                onReuse={handleReuse}
              />
            ) : record.base64 ? (
              <CompletedState
                record={record}
                onOpenLightbox={handleOpenLightbox}
                onDownload={handleDownload}
                onToggleFavorite={handleToggleFavorite}
                onCopyPrompt={handleCopyPrompt}
                onRegenerate={handleRegenerate}
              />
            ) : (
              <EmptyStageState />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

function GeneratingState() {
  return (
    <div className="flex min-h-64 w-full max-w-sm flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 p-6 text-center">
      <Spinner className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium">正在生成图片</p>
      <p className="text-xs text-muted-foreground">
        正在处理你的请求,请勿刷新页面
      </p>
    </div>
  )
}

function FailedState({
  record,
  onRetry,
  onReuse,
}: {
  record: HistoryRecord
  onRetry: () => void
  onReuse: () => void
}) {
  const errorText = record.error ?? "请求失败"
  return (
    <div className="flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-muted/20 px-4 py-8 text-center">
      <CircleAlert className="size-5 text-destructive" />
      <p className="text-sm font-medium">{errorText}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          重试
        </Button>
        <Button size="sm" variant="outline" onClick={onReuse}>
          <WandSparkles className="size-4" />
          复用提示词
        </Button>
      </div>
      <Collapsible className="w-full">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full">
            查看原始错误
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-left text-xs whitespace-pre-wrap break-words text-muted-foreground">
            {errorText}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function ratioToAspect(ratio: string): string {
  const parts = ratio.split(":").map(Number)
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "1 / 1"
  return `${parts[0]} / ${parts[1]}`
}

function CompletedState({
  record,
  onOpenLightbox,
  onDownload,
  onToggleFavorite,
  onCopyPrompt,
  onRegenerate,
}: {
  record: HistoryRecord
  onOpenLightbox: () => void
  onDownload: () => void
  onToggleFavorite: () => void
  onCopyPrompt: () => void
  onRegenerate: () => void
}) {
  const [aspect, setAspect] = React.useState<string>(() =>
    ratioToAspect(record.ratio)
  )

  const handleLoad = React.useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setAspect(`${img.naturalWidth} / ${img.naturalHeight}`)
      }
    },
    []
  )

  return (
    <div
      className="group relative max-h-full max-w-full overflow-hidden"
      style={{ aspectRatio: aspect }}
    >
      <img
        src={`data:image/png;base64,${record.base64}`}
        alt={record.prompt.slice(0, 40)}
        onLoad={handleLoad}
        onClick={onOpenLightbox}
        className="block size-full cursor-zoom-in object-contain"
      />
      <div className="pointer-events-none absolute right-3 top-3 flex translate-y-[-0.25rem] items-center gap-0.5 rounded-md bg-background/95 p-0.5 opacity-0 shadow-sm ring-1 ring-border backdrop-blur transition group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button size="icon-xs" variant="ghost" aria-label="查看提示词">
                  <FileText className="size-3.5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>查看提示词</TooltipContent>
          </Tooltip>
          <PopoverContent
            side="bottom"
            align="end"
            className="max-w-sm space-y-1"
          >
            <p className="text-sm whitespace-pre-wrap break-words">
              {record.prompt}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(record.createdAt).toLocaleString()}
            </p>
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-xs" variant="ghost" onClick={onDownload}>
              <Download className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>下载</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-xs" variant="ghost" onClick={onToggleFavorite}>
              <motion.span
                key={record.favorite ? "fav" : "unfav"}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: [0.7, 1.25, 1], opacity: 1 }}
                transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                className="inline-flex"
              >
                <Star
                  className={cn(
                    "size-3.5",
                    record.favorite && "fill-amber-400 text-amber-400"
                  )}
                />
              </motion.span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{record.favorite ? "取消收藏" : "收藏"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-xs" variant="ghost" onClick={onCopyPrompt}>
              <Copy className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>复制提示词</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-xs" variant="ghost" onClick={onRegenerate}>
              <RefreshCw className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>重新生成</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function EmptyStageState() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <ImageIcon className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">暂无生成结果</p>
      <p className="text-xs text-muted-foreground">
        在右侧输入提示词开始
      </p>
    </div>
  )
}
