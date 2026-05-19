"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  Loader2,
  PanelRight,
  Play,
  Settings2,
} from "lucide-react"

import {
  useConfig,
  useGenerate,
  useSettingsDialog,
} from "@/app/providers/app-state-provider"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"

import { pixelOptions, ratios, countOptions } from "./data"

type ControlPanelProps = {
  prompt: string
  setPrompt: (value: string) => void
  ratio: string
  setRatio: (value: string) => void
  pixels: string
  setPixels: (value: string) => void
  count: number
  setCount: (value: number) => void
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
}: ControlPanelProps) {
  const { config } = useConfig()
  const { submit, isProcessing } = useGenerate()
  const { openSettings } = useSettingsDialog()
  const { slideInRight } = useMotionVariants()

  const handleGenerate = React.useCallback(() => {
    if (prompt.trim().length === 0) return
    void submit({ prompt, ratio, pixels })
  }, [prompt, ratio, pixels, submit])

  const apiConfigured =
    config.baseUrl.trim().length > 0 && config.apiKey.trim().length > 0

  const generateDisabled =
    prompt.trim().length === 0 || !apiConfigured || isProcessing

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
            <Label htmlFor="prompt">提示词</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="h-32 min-h-32 resize-y field-sizing-fixed"
              placeholder="描述你想生成的图片..."
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{prompt.length} 字符</span>
              <span>中文 / English 均可</span>
            </div>
            <p className="text-xs text-muted-foreground">
              模型:{" "}
              {config.model ? (
                <code className="font-mono">{config.model}</code>
              ) : (
                <button
                  type="button"
                  onClick={openSettings}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  未配置 →
                </button>
              )}
            </p>
            <Button
              className="w-full"
              disabled={generateDisabled}
              onClick={handleGenerate}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isProcessing ? "processing" : "idle"}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.16 }}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {isProcessing ? "生成中" : "生成图片"}
                </motion.span>
              </AnimatePresence>
            </Button>
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

          <div className="grid gap-3">
            <Label>图片数量</Label>
            <ButtonGroup className="w-full">
              {countOptions.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={count === item ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setCount(item)}
                >
                  {item}
                </Button>
              ))}
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
  const isAuto = ratio === "默认"
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
