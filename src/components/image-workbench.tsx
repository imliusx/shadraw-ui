"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { PanelLeft } from "lucide-react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { Layout } from "react-resizable-panels"
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
import {
  useActiveHistory,
  useHistory,
} from "@/app/providers/app-state-provider"
import { DEFAULT_IMAGE_PARAMS } from "@/components/workbench/data"
import type { ImageParams } from "@/components/workbench/types"

const DEFAULT_STAGE_LAYOUT = { preview: 70, controls: 30 }

export function ImageWorkbench() {
  const [prompt, setPrompt] = React.useState("")
  const [imageParams, setImageParams] =
    React.useState<ImageParams>(DEFAULT_IMAGE_PARAMS)
  const [referenceImages, setReferenceImages] = React.useState<string[]>([])
  const [stageLayouts, setStageLayouts] = React.useState<Record<string, Layout>>({})

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

  const renderStageWithControls = (idPrefix: string) => {
    const layout = stageLayouts[idPrefix] ?? DEFAULT_STAGE_LAYOUT

    return (
      <ResizablePanelGroup
        id={`${idPrefix}-stage`}
        orientation="vertical"
        defaultLayout={layout}
        onLayoutChanged={(nextLayout) =>
          setStageLayouts((prev) => ({
            ...prev,
            [idPrefix]: nextLayout,
          }))
        }
        className="h-full"
      >
        <ResizablePanel
          id="preview"
          defaultSize={`${layout.preview}%`}
          minSize="32%"
          className="min-h-0"
        >
          <PreviewStage
            setPrompt={setPrompt}
            setImageParams={setImageParams}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="controls"
          defaultSize={`${layout.controls}%`}
          minSize="22%"
          maxSize="70%"
          className="min-h-0 bg-background"
        >
          <ControlPanel
            prompt={prompt}
            setPrompt={setPrompt}
            imageParams={imageParams}
            setImageParams={setImageParams}
            referenceImages={referenceImages}
            setReferenceImages={setReferenceImages}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    )
  }

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
              setImageParams={setImageParams}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="h-[calc(100%-3rem)] xl:hidden">
        {renderStageWithControls("mobile")}
      </div>

      <ResizablePanelGroup
        id="image-workbench-layout"
        orientation="horizontal"
        defaultLayout={{
          library: 22,
          stage: 78,
        }}
        resizeTargetMinimumSize={{ fine: 10, coarse: 28 }}
        className="hidden h-full min-w-0 overflow-hidden xl:flex"
      >
        <ResizablePanel
          id="library"
          defaultSize="22%"
          minSize="14%"
          maxSize="32%"
          className="min-w-0 bg-background"
        >
          <LibraryPanel
            setPrompt={setPrompt}
            setImageParams={setImageParams}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="stage"
          defaultSize="78%"
          minSize="60%"
          className="min-w-0"
        >
          {renderStageWithControls("desktop")}
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}
