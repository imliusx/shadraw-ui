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
import {
  DEFAULT_IMAGE_PARAMS,
  imageSizeToRatio,
  type ImageRatioLabel,
} from "@/components/workbench/data"
import type { ImageParams } from "@/components/workbench/types"

const DEFAULT_MOBILE_STAGE_LAYOUT = { preview: 58, controls: 42 }
const DEFAULT_DESKTOP_LAYOUT = {
  library: 22,
  preview: 56,
  controls: 22,
}

export function ImageWorkbench() {
  const [prompt, setPrompt] = React.useState("")
  const [imageParams, setImageParams] =
    React.useState<ImageParams>(DEFAULT_IMAGE_PARAMS)
  const [imageRatio, setImageRatio] = React.useState<ImageRatioLabel>("auto")
  const [referenceImages, setReferenceImages] = React.useState<string[]>([])
  const [mobileStageLayout, setMobileStageLayout] = React.useState<Layout>(
    DEFAULT_MOBILE_STAGE_LAYOUT
  )

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

  const applyImageParams = React.useCallback((nextParams: ImageParams) => {
    setImageParams(nextParams)
    setImageRatio(imageSizeToRatio(nextParams.size))
  }, [])

  const renderControlPanel = (variant?: "stacked" | "sidebar") => (
    <ControlPanel
      variant={variant}
      prompt={prompt}
      setPrompt={setPrompt}
      imageParams={imageParams}
      setImageParams={setImageParams}
      imageRatio={imageRatio}
      setImageRatio={setImageRatio}
      referenceImages={referenceImages}
      setReferenceImages={setReferenceImages}
    />
  )

  const renderMobileStageWithControls = () => {
    return (
      <ResizablePanelGroup
        id="mobile-stage"
        orientation="vertical"
        defaultLayout={mobileStageLayout}
        onLayoutChanged={setMobileStageLayout}
        className="h-full"
      >
        <ResizablePanel
          id="preview"
          defaultSize={`${mobileStageLayout.preview}%`}
          minSize="28%"
          className="min-h-0"
        >
          <PreviewStage
            setPrompt={setPrompt}
            setImageParams={applyImageParams}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="controls"
          defaultSize={`${mobileStageLayout.controls}%`}
          minSize="34%"
          maxSize="70%"
          className="min-h-0 bg-background"
        >
          {renderControlPanel("sidebar")}
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
              setImageParams={applyImageParams}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="h-[calc(100%-3rem)] xl:hidden">
        {renderMobileStageWithControls()}
      </div>

      <ResizablePanelGroup
        id="image-workbench-layout"
        orientation="horizontal"
        defaultLayout={DEFAULT_DESKTOP_LAYOUT}
        resizeTargetMinimumSize={{ fine: 10, coarse: 28 }}
        className="hidden h-full min-w-0 overflow-hidden xl:flex"
      >
        <ResizablePanel
          id="library"
          defaultSize={`${DEFAULT_DESKTOP_LAYOUT.library}%`}
          minSize="14%"
          maxSize="32%"
          className="min-w-0 bg-background"
        >
          <LibraryPanel
            setPrompt={setPrompt}
            setImageParams={applyImageParams}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="preview"
          defaultSize={`${DEFAULT_DESKTOP_LAYOUT.preview}%`}
          minSize="38%"
          className="min-w-0"
        >
          <PreviewStage
            setPrompt={setPrompt}
            setImageParams={applyImageParams}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="controls"
          defaultSize={`${DEFAULT_DESKTOP_LAYOUT.controls}%`}
          minSize="20%"
          maxSize="38%"
          className="min-w-0 bg-background"
        >
          {renderControlPanel("sidebar")}
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}
