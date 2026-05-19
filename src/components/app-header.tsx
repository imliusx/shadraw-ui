"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Images,
  LogOut,
  Palette,
  Settings,
  Terminal,
} from "lucide-react"
import { toast } from "sonner"
import { motion } from "motion/react"

import { useApiStatus, useSettingsDialog } from "@/app/providers/app-state-provider"
import { useAuth, type AuthUser } from "@/app/providers/auth-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/theme-toggle"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { ApiStatus } from "@/components/workbench/types"

const NAV_ITEMS = [
  { href: "/", label: "工作台", icon: Palette },
  { href: "/gallery", label: "画廊", icon: Images },
  { href: "/logs", label: "日志", icon: Terminal },
] as const

function avatarLetter(user: AuthUser): string {
  const fromName = user.displayName.trim()[0]
  if (fromName) return fromName.toUpperCase()
  const fromEmail = user.email.trim()[0]
  if (fromEmail) return fromEmail.toUpperCase()
  return "U"
}

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { status, errorMessage } = useApiStatus()
  const { openSettings } = useSettingsDialog()
  const { user, logout } = useAuth()
  const { slideInDown } = useMotionVariants()

  function handleLogout() {
    logout()
    toast.info("已退出登录")
    router.replace("/login")
  }

  return (
    <motion.header
      variants={slideInDown}
      initial="hidden"
      animate="show"
      className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b bg-background/95 px-4 backdrop-blur"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Palette className="size-6 text-foreground" />
        <h1 className="truncate text-2xl font-light leading-none tracking-tight">
          shadraw
        </h1>
      </div>

      <nav className="hidden items-center gap-1 md:flex">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Button
              key={item.href}
              asChild
              variant={active ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
            >
              <Link href={item.href}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          )
        })}
      </nav>

      <div className="flex items-center justify-end gap-2">
        <ApiStatusBadge
          status={status}
          errorMessage={errorMessage}
          onOpenSettings={openSettings}
        />
        <ThemeToggle />
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full p-0"
                aria-label="打开个人中心"
              >
                <Avatar>
                  <AvatarFallback>{avatarLetter(user)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuLabel className="px-2 py-1.5">
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>{avatarLetter(user)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {user.displayName}
                    </span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => openSettings()}>
                <Settings className="size-4" />
                设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                <LogOut className="size-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-1">
            <Button asChild size="sm" variant="outline">
              <Link href="/login">登录</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">注册</Link>
            </Button>
          </div>
        )}
      </div>
    </motion.header>
  )
}

function ApiStatusBadge({
  status,
  errorMessage,
  onOpenSettings,
}: {
  status: ApiStatus
  errorMessage: string
  onOpenSettings: () => void
}) {
  const config = {
    idle: {
      label: "API Untested",
      dotClassName: "bg-muted-foreground",
    },
    testing: {
      label: "API Testing",
      dotClassName: "bg-amber-500",
    },
    success: {
      label: "API Ready",
      dotClassName: "bg-green-500",
    },
    error: {
      label: "API Error",
      dotClassName: "bg-destructive",
    },
  } satisfies Record<ApiStatus, { label: string; dotClassName: string }>
  const current = config[status]

  const badge = (
    <Badge
      variant="outline"
      className="hidden h-7 border-border bg-background/70 px-3 text-foreground shadow-sm backdrop-blur sm:inline-flex dark:bg-background/55"
    >
      <span className="relative mr-1 flex size-2">
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60",
            current.dotClassName
          )}
        />
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            current.dotClassName
          )}
        />
      </span>
      {current.label}
    </Badge>
  )

  const linkedBadge = (
    <button
      type="button"
      onClick={onOpenSettings}
      aria-label="API 状态,点击修改配置"
      className="inline-flex outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
    >
      {badge}
    </button>
  )

  if (status === "error" && errorMessage) {
    const truncated =
      errorMessage.length > 60
        ? errorMessage.slice(0, 60) + "..."
        : errorMessage
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkedBadge}</TooltipTrigger>
        <TooltipContent>
          {truncated}
          <span className="block opacity-70">点击修改配置</span>
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkedBadge
}
