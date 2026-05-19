"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Star,
  X,
} from "lucide-react"

import { useHistory, useLightbox } from "@/app/providers/app-state-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"

function buildDownloadFilename(record: { id: number; createdAt: number }): string {
  const stamp = new Date(record.createdAt)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 15)
  return `shadraw-${stamp}-${record.id}.png`
}

function triggerDownload(base64: string, filename: string) {
  const link = document.createElement("a")
  link.href = `data:image/png;base64,${base64}`
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function LightboxDialog() {
  const { open, recordId, navList, openWith, close } = useLightbox()
  const { getById, updateRecord } = useHistory()
  const { fadeIn } = useMotionVariants()

  const record = recordId !== null ? getById(recordId) : undefined

  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (open && recordId !== null && !record) {
      close()
    }
  }, [open, recordId, record, close])

  const currentIndex =
    navList && recordId !== null ? navList.indexOf(recordId) : -1
  const hasNav = navList !== null && navList.length > 1
  const canPrev = hasNav && currentIndex > 0
  const canNext = hasNav && currentIndex >= 0 && currentIndex < navList!.length - 1

  const handlePrev = () => {
    if (canPrev && navList) {
      openWith(navList[currentIndex - 1], navList)
    }
  }

  const handleNext = () => {
    if (canNext && navList) {
      openWith(navList[currentIndex + 1], navList)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setHovered(false)
      close()
    }
  }

  const handleDownload = () => {
    if (!record?.base64) return
    triggerDownload(record.base64, buildDownloadFilename(record))
  }

  const handleToggleFavorite = () => {
    if (!record) return
    void updateRecord(record.id, { favorite: !record.favorite })
  }

  const handleCopyPrompt = async () => {
    if (!record) return
    try {
      await navigator.clipboard.writeText(record.prompt)
      toast.success("提示词已复制")
    } catch {
      toast.error("复制失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="block w-auto max-w-none max-h-none sm:max-w-none p-0 gap-0 overflow-visible border-0 bg-transparent shadow-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>预览</DialogTitle>
          <DialogDescription>查看生成的图片</DialogDescription>
        </DialogHeader>

        <div
          className="relative inline-block align-middle"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {record && record.base64 ? (
            <img
              src={`data:image/png;base64,${record.base64}`}
              alt={record.prompt.slice(0, 40)}
              className="block max-h-[90vh] max-w-[90vw] object-contain"
            />
          ) : (
            <div className="flex min-h-[40vh] min-w-[40vw] items-center justify-center text-sm text-muted-foreground">
              图片不可用
            </div>
          )}

          <AnimatePresence>
            {record && hovered && (
              <motion.div
                key="toolbar"
                variants={fadeIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="absolute right-3 top-3 flex items-center gap-0.5 rounded-md bg-background/95 p-0.5 shadow-sm ring-1 ring-border backdrop-blur"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={handleDownload}
                      disabled={!record.base64}
                      aria-label="下载图片"
                    >
                      <Download className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>下载</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={handleToggleFavorite}
                      aria-label={record.favorite ? "取消收藏" : "收藏"}
                    >
                      <Star
                        className={cn(
                          "size-3.5",
                          record.favorite && "fill-amber-400 text-amber-400"
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {record.favorite ? "取消收藏" : "收藏"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={handleCopyPrompt}
                      aria-label="复制提示词"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>复制提示词</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={close}
                      aria-label="关闭"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>关闭</TooltipContent>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>

          {hasNav && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur"
                onClick={handlePrev}
                disabled={!canPrev}
                aria-label="上一张"
              >
                <ChevronLeft />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur"
                onClick={handleNext}
                disabled={!canNext}
                aria-label="下一张"
              >
                <ChevronRight />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
