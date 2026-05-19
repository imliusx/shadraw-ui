"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"
import {
  Archive,
  FileText,
  FolderInput,
  ImageIcon,
  Inbox,
  Search,
  Star,
  Trash2,
  WandSparkles,
} from "lucide-react"

import {
  useHistory,
  useLightbox,
  useProjects,
} from "@/app/providers/app-state-provider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type {
  HistoryRecord,
  Project,
} from "@/components/workbench/types"
import { TabFade } from "@/components/motion/tab-fade"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"

type GalleryTab = "all" | "favorites" | "projects"

export function GalleryView() {
  const { records, deleteRecord, updateRecord } = useHistory()
  const { projects } = useProjects()
  const { openWith } = useLightbox()
  const router = useRouter()

  const [tab, setTab] = React.useState<GalleryTab>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const deferredQuery = React.useDeferredValue(searchQuery)

  const [deleteTarget, setDeleteTarget] =
    React.useState<HistoryRecord | null>(null)

  const completed = React.useMemo(
    () =>
      [...records]
        .filter((record) => record.status === "completed")
        .sort((a, b) => b.id - a.id),
    [records]
  )

  const queryText = deferredQuery.trim().toLowerCase()

  const applyQuery = React.useCallback(
    (list: HistoryRecord[]) => {
      if (!queryText) return list
      return list.filter((record) =>
        record.prompt.toLowerCase().includes(queryText)
      )
    },
    [queryText]
  )

  const allList = React.useMemo(() => applyQuery(completed), [applyQuery, completed])
  const favoritesList = React.useMemo(
    () => applyQuery(completed.filter((record) => record.favorite)),
    [applyQuery, completed]
  )

  const sortedProjects = React.useMemo(
    () => [...projects].sort((a, b) => b.createdAt - a.createdAt),
    [projects]
  )

  const handleReuse = React.useCallback(
    (record: HistoryRecord) => {
      router.push(`/?activeId=${record.id}`)
      toast.info("已切回工作台")
    },
    [router]
  )

  const handleMoveToProject = React.useCallback(
    async (record: HistoryRecord, projectId: number | undefined) => {
      await updateRecord(record.id, { projectId })
      toast.success("已移动到新项目")
    },
    [updateRecord]
  )

  const handleToggleFavorite = React.useCallback(
    async (record: HistoryRecord) => {
      await updateRecord(record.id, { favorite: !record.favorite })
      toast.success(record.favorite ? "已取消收藏" : "已加入收藏")
    },
    [updateRecord]
  )

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return
    await deleteRecord(deleteTarget.id)
    setDeleteTarget(null)
    toast.success("已删除")
  }, [deleteRecord, deleteTarget])

  const handleOpenLightbox = React.useCallback(
    (record: HistoryRecord, navList: HistoryRecord[]) => {
      openWith(
        record.id,
        navList.map((item) => item.id)
      )
    },
    [openWith]
  )

  const { listContainer } = useMotionVariants()

  const renderCards = (list: HistoryRecord[]) => (
    <AnimatePresence initial={false}>
      {list.map((record) => (
        <GalleryCard
          key={record.id}
          record={record}
          projects={sortedProjects}
          onOpen={(target) => handleOpenLightbox(target, list)}
          onReuse={handleReuse}
          onMoveToProject={handleMoveToProject}
          onToggleFavorite={handleToggleFavorite}
          onRequestDelete={setDeleteTarget}
        />
      ))}
    </AnimatePresence>
  )

  const projectSections = React.useMemo(() => {
    type Section = {
      key: string
      name: string
      list: HistoryRecord[]
    }
    const sections: Section[] = []

    const unclassified = applyQuery(
      completed.filter((record) => record.projectId === undefined)
    )
    if (unclassified.length > 0) {
      sections.push({ key: "inbox", name: "未分类", list: unclassified })
    }

    for (const project of sortedProjects) {
      const list = applyQuery(
        completed.filter((record) => record.projectId === project.id)
      )
      if (list.length > 0) {
        sections.push({
          key: `project-${project.id}`,
          name: project.name,
          list,
        })
      }
    }

    return sections
  }, [applyQuery, completed, sortedProjects])

  const hasAnyCompleted = completed.length > 0

  let content: React.ReactNode = null
  if (tab === "all") {
    content =
      allList.length > 0 ? (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="columns-2 gap-4 p-4 sm:columns-3 lg:columns-4 xl:columns-5"
        >
          {renderCards(allList)}
        </motion.div>
      ) : (
        <EmptyArea
          deferredQuery={deferredQuery}
          onClearSearch={() => setSearchQuery("")}
          emptyTitle="画廊还是空的"
          emptyDescription="先去工作台生成一些图吧"
        />
      )
  } else if (tab === "favorites") {
    content =
      favoritesList.length > 0 ? (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="columns-2 gap-4 p-4 sm:columns-3 lg:columns-4 xl:columns-5"
        >
          {renderCards(favoritesList)}
        </motion.div>
      ) : (
        <EmptyArea
          deferredQuery={deferredQuery}
          onClearSearch={() => setSearchQuery("")}
          emptyTitle={hasAnyCompleted ? "还没有收藏" : "画廊还是空的"}
          emptyDescription={
            hasAnyCompleted
              ? "在工作台或 Lightbox 里点星标加入收藏"
              : "先去工作台生成一些图吧"
          }
        />
      )
  } else {
    content =
      projectSections.length > 0 ? (
        <div className="flex flex-col">
          {projectSections.map((section) => (
            <section key={section.key}>
              <h2 className="flex items-center gap-2 px-4 pb-2 pt-4 text-sm font-medium">
                {section.name}
              </h2>
              <motion.div
                variants={listContainer}
                initial="hidden"
                animate="show"
                className="columns-2 gap-4 px-4 pb-4 sm:columns-3 lg:columns-4 xl:columns-5"
              >
                {renderCards(section.list)}
              </motion.div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyArea
          deferredQuery={deferredQuery}
          onClearSearch={() => setSearchQuery("")}
          emptyTitle="画廊还是空的"
          emptyDescription="先去工作台生成一些图吧"
        />
      )
  }

  return (
    <main className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between px-4">
          <Tabs value={tab} onValueChange={(value) => setTab(value as GalleryTab)}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="favorites">收藏</TabsTrigger>
              <TabsTrigger value="projects">按项目</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-64 max-w-full">
            <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索提示词"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto w-full max-w-7xl">
            <TabFade tabKey={tab}>{content}</TabFade>
          </div>
        </ScrollArea>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这张记录?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可恢复,会同步从本地存储中清除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}

type GalleryCardProps = {
  record: HistoryRecord
  projects: Project[]
  onOpen: (record: HistoryRecord) => void
  onReuse: (record: HistoryRecord) => void
  onMoveToProject: (
    record: HistoryRecord,
    projectId: number | undefined
  ) => void
  onToggleFavorite: (record: HistoryRecord) => void
  onRequestDelete: (record: HistoryRecord) => void
}

function GalleryCard({
  record,
  projects,
  onOpen,
  onReuse,
  onMoveToProject,
  onToggleFavorite,
  onRequestDelete,
}: GalleryCardProps) {
  const { listItem } = useMotionVariants()
  return (
    <motion.div
      layout
      variants={listItem}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      className="group relative mb-4 break-inside-avoid overflow-hidden rounded-lg border bg-card"
    >
      <button
        type="button"
        onClick={() => onOpen(record)}
        className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="预览图片"
      >
        {record.base64 ? (
          <img
            src={`data:image/png;base64,${record.base64}`}
            alt={record.prompt.slice(0, 40)}
            className="block w-full transition group-hover:scale-105"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
      </button>

      {record.favorite ? (
        <Star
          aria-label="已收藏"
          className="pointer-events-none absolute left-2 top-2 size-4 fill-amber-400 text-amber-400"
        />
      ) : null}

      <div className="pointer-events-none absolute right-2 top-2 flex translate-y-[-0.25rem] items-center gap-0.5 rounded-md bg-background/95 p-0.5 opacity-0 shadow-sm ring-1 ring-border backdrop-blur transition group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={(event) => event.stopPropagation()}
                  aria-label="查看提示词"
                >
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
            onClick={(event) => event.stopPropagation()}
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
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                onToggleFavorite(record)
              }}
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
          <TooltipContent>{record.favorite ? "取消收藏" : "收藏"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                onReuse(record)
              }}
              aria-label="复用提示词"
            >
              <WandSparkles className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>复用提示词</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={(event) => event.stopPropagation()}
                  aria-label="移到项目"
                >
                  <FolderInput className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>移到项目</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="end"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuItem
              onSelect={() => onMoveToProject(record, undefined)}
            >
              <Inbox className="size-4" />
              未分类
            </DropdownMenuItem>
            {projects.length > 0 ? <DropdownMenuSeparator /> : null}
            {projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                onSelect={() => onMoveToProject(record, project.id)}
              >
                <Archive className="size-4" />
                {project.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                onRequestDelete(record)
              }}
              aria-label="删除"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>删除</TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  )
}

function EmptyArea({
  deferredQuery,
  onClearSearch,
  emptyTitle,
  emptyDescription,
}: {
  deferredQuery: string
  onClearSearch: () => void
  emptyTitle: string
  emptyDescription: string
}) {
  const query = deferredQuery.trim()
  if (query) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          未匹配到「{query}」相关结果
        </p>
        <Button variant="outline" size="sm" onClick={onClearSearch}>
          清除搜索
        </Button>
      </div>
    )
  }
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <ImageIcon className="size-10 text-muted-foreground" />
      <p className="text-sm font-medium">{emptyTitle}</p>
      <p className="text-xs text-muted-foreground">{emptyDescription}</p>
    </div>
  )
}
