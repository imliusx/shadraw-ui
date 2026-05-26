"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import {
  Check,
  CircleX,
  Clock3,
  History,
  ScrollText,
  Search,
} from "lucide-react"

import { useHistory } from "@/app/providers/app-state-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toUserFacingErrorMessage } from "@/lib/api/errors"
import { useMotionVariants } from "@/lib/motion"
import type {
  HistoryRecord,
  HistoryStatus,
} from "@/components/workbench/types"

type StatusFilter = "all" | "completed" | "failed"

const GRID_TEMPLATE =
  "grid-cols-[10rem_8rem_minmax(20rem,1fr)_6rem_6rem_minmax(12rem,1fr)]"

export function LogsView() {
  const { records } = useHistory()
  const router = useRouter()
  const { listContainer } = useMotionVariants()

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const deferredQuery = React.useDeferredValue(searchQuery)

  const totalCount = records.length

  const filtered = React.useMemo(() => {
    const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt)
    const byStatus =
      statusFilter === "all"
        ? sorted
        : sorted.filter((record) => record.status === statusFilter)
    const queryText = deferredQuery.trim().toLowerCase()
    if (!queryText) return byStatus
    return byStatus.filter((record) =>
      record.prompt.toLowerCase().includes(queryText)
    )
  }, [records, statusFilter, deferredQuery])

  const filteredCount = filtered.length

  const handleRowClick = React.useCallback(
    (record: HistoryRecord) => {
      router.push(`/?activeId=${record.id}`)
    },
    [router]
  )

  return (
    <main className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ScrollText className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">调用日志</span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filteredCount} / {totalCount} 条
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as StatusFilter)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="completed">成功</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
              </SelectContent>
            </Select>
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
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto w-full max-w-7xl">
          {filtered.length > 0 ? (
            <motion.div
              variants={listContainer}
              initial="hidden"
              animate="show"
              className="flex flex-col"
            >
              <div
                className={`sticky top-0 z-10 grid ${GRID_TEMPLATE} gap-3 bg-background px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground`}
              >
                <div>时间</div>
                <div>模型</div>
                <div>提示词</div>
                <div>状态</div>
                <div>用时</div>
                <div>错误</div>
              </div>
              {filtered.map((record) => (
                <LogRow
                  key={record.id}
                  record={record}
                  onClick={() => handleRowClick(record)}
                />
              ))}
            </motion.div>
          ) : (
            <EmptyArea
              totalCount={totalCount}
              statusFilter={statusFilter}
              deferredQuery={deferredQuery}
              onClearSearch={() => setSearchQuery("")}
              onResetStatus={() => setStatusFilter("all")}
            />
          )}
          </div>
        </ScrollArea>
      </div>
    </main>
  )
}

function LogRow({
  record,
  onClick,
}: {
  record: HistoryRecord
  onClick: () => void
}) {
  const { listItem } = useMotionVariants()
  const isFailed = record.status === "failed"
  const time = new Date(record.createdAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
  const duration =
    record.startedAt && record.completedAt
      ? `${((record.completedAt - record.startedAt) / 1000).toFixed(1)}s`
      : "—"

  return (
    <motion.div
      variants={listItem}
      initial="hidden"
      animate="show"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
      className={`grid ${GRID_TEMPLATE} cursor-pointer items-center gap-3 px-4 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isFailed
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <div className="text-xs tabular-nums text-muted-foreground">{time}</div>
      <div className="truncate">
        <code className="text-xs">{record.model}</code>
      </div>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="truncate">{record.prompt}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[40ch] whitespace-pre-wrap">
          {record.prompt}
        </TooltipContent>
      </Tooltip>
      <div>
        <LogStatusBadge status={record.status} />
      </div>
      <div className="text-xs tabular-nums text-muted-foreground">
        {duration}
      </div>
      <div className="truncate">
        {record.error ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className="truncate text-xs">
                {toUserFacingErrorMessage(record.error)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[40ch] whitespace-pre-wrap">
              {toUserFacingErrorMessage(record.error)}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </motion.div>
  )
}

function LogStatusBadge({ status }: { status: HistoryStatus }) {
  const config: Record<
    HistoryStatus,
    {
      label: string
      icon: React.ReactNode
    }
  > = {
    waiting: {
      label: "等待",
      icon: <Clock3 />,
    },
    running: {
      label: "运行中",
      icon: <Spinner className="text-amber-500" />,
    },
    completed: {
      label: "完成",
      icon: <Check className="text-green-500" />,
    },
    failed: {
      label: "失败",
      icon: <CircleX className="text-destructive" />,
    },
  }
  const current = config[status]
  return (
    <Badge variant="outline">
      {current.icon}
      {current.label}
    </Badge>
  )
}

function EmptyArea({
  totalCount,
  statusFilter,
  deferredQuery,
  onClearSearch,
  onResetStatus,
}: {
  totalCount: number
  statusFilter: StatusFilter
  deferredQuery: string
  onClearSearch: () => void
  onResetStatus: () => void
}) {
  if (totalCount === 0) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-2 p-8 text-center">
        <History className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">还没有任何调用记录</p>
        <p className="text-xs text-muted-foreground">
          在工作台触发一次生图后这里会出现日志
        </p>
      </div>
    )
  }

  const query = deferredQuery.trim()
  if (query) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          未匹配到「{query}」
        </p>
        <Button variant="outline" size="sm" onClick={onClearSearch}>
          清除搜索
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm text-muted-foreground">当前状态过滤无结果</p>
      {statusFilter !== "all" ? (
        <Button variant="outline" size="sm" onClick={onResetStatus}>
          查看全部
        </Button>
      ) : null}
    </div>
  )
}
