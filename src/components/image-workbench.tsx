"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { PanelLeft, PanelRight } from "lucide-react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { ControlPanel } from "@/components/workbench/control-panel"
import { LibraryPanel } from "@/components/workbench/library-panel"
import { PreviewStage } from "@/components/workbench/preview-stage"
import { EventLogPanel } from "@/components/workbench/event-log-panel"
import {
  useActiveHistory,
  useHistory,
} from "@/app/providers/app-state-provider"

export function ImageWorkbench() {
  const [prompt, setPrompt] = React.useState("")
  const [ratio, setRatio] = React.useState("1:1")
  const [pixels, setPixels] = React.useState("2K")
  const [count, setCount] = React.useState(1)

  const searchParams = useSearchParams()
  const { records, isHydrated } = useHistory()
  const [, setActive] = useActiveHistory()
  const appliedActiveIdRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!isHydrated) return
    const raw = searchParams.get("activeId")
    if (!raw) return
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) return
    if (appliedActiveIdRef.current === parsed) return
    const exists = records.some((record) => record.id === parsed)
    if (!exists) return
    appliedActiveIdRef.current = parsed
    setActive(parsed)
  }, [isHydrated, searchParams, records, setActive])

  return (
    <main className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
      <div className="flex h-12 items-center justify-between border-b px-4 xl:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="打开素材库"
            >
              <PanelLeft className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[min(92vw,380px)] gap-0 p-0 sm:max-w-none"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>素材库</SheetTitle>
              <SheetDescription>查看历史记录、项目和收藏图片</SheetDescription>
            </SheetHeader>
            <LibraryPanel
              setPrompt={setPrompt}
              setRatio={setRatio}
              setPixels={setPixels}
            />
          </SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="打开参数控制"
            >
              <PanelRight className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[min(94vw,420px)] gap-0 p-0 sm:max-w-none"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>参数控制</SheetTitle>
              <SheetDescription>调整生图参数和 API 配置</SheetDescription>
            </SheetHeader>
            <ControlPanel
              prompt={prompt}
              setPrompt={setPrompt}
              ratio={ratio}
              setRatio={setRatio}
              pixels={pixels}
              setPixels={setPixels}
              count={count}
              setCount={setCount}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="h-[calc(100%-3rem)] xl:hidden">
        <ResizablePanelGroup
          id="image-workbench-mobile"
          orientation="vertical"
          defaultLayout={{ stage: 65, eventLog: 35 }}
          className="h-full"
        >
          <ResizablePanel
            id="stage-mobile"
            defaultSize="65%"
            minSize="35%"
            className="min-h-0"
          >
            <PreviewStage
              setPrompt={setPrompt}
              setRatio={setRatio}
              setPixels={setPixels}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="event-log-mobile"
            defaultSize="35%"
            minSize="12%"
            maxSize="65%"
            className="min-h-0"
          >
            <EventLogPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <ResizablePanelGroup
        id="image-workbench-layout"
        orientation="horizontal"
        defaultLayout={{
          library: 22,
          stage: 56,
          controls: 22,
        }}
        resizeTargetMinimumSize={{ fine: 10, coarse: 28 }}
        className="hidden h-full min-w-0 overflow-hidden xl:flex"
      >
        <ResizablePanel
          id="library"
          defaultSize="22%"
          minSize="14%"
          maxSize="30%"
          className="min-w-0 bg-background"
        >
          <LibraryPanel
            setPrompt={setPrompt}
            setRatio={setRatio}
            setPixels={setPixels}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="stage"
          defaultSize="56%"
          minSize="38%"
          className="min-w-0"
        >
          <ResizablePanelGroup
            id="image-workbench-stage"
            orientation="vertical"
            defaultLayout={{ preview: 72, eventLog: 28 }}
            className="h-full"
          >
            <ResizablePanel
              id="preview"
              defaultSize="72%"
              minSize="40%"
              className="min-h-0"
            >
              <PreviewStage
                setPrompt={setPrompt}
                setRatio={setRatio}
                setPixels={setPixels}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              id="event-log"
              defaultSize="28%"
              minSize="10%"
              maxSize="60%"
              className="min-h-0"
            >
              <EventLogPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="controls"
          defaultSize="22%"
          minSize="18%"
          maxSize="32%"
          className="min-w-0 bg-background"
        >
          <ControlPanel
            prompt={prompt}
            setPrompt={setPrompt}
            ratio={ratio}
            setRatio={setRatio}
            pixels={pixels}
            setPixels={setPixels}
            count={count}
            setCount={setCount}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}
