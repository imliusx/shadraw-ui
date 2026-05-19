"use client"

import * as React from "react"
import { toast } from "sonner"
import { AnimatePresence, motion } from "motion/react"
import {
  Check,
  CircleAlert,
  CircleUser,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
} from "lucide-react"

import { useApiStatus, useConfig } from "@/app/providers/app-state-provider"
import { useAuth } from "@/app/providers/auth-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/password-input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useMotionVariants } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { ApiStatus } from "@/components/workbench/types"

type SectionId = "account" | "general" | "api"

type SectionMeta = {
  id: SectionId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTIONS: ReadonlyArray<SectionMeta> = [
  { id: "account", label: "账户", icon: CircleUser },
  { id: "general", label: "通用", icon: Settings },
  { id: "api", label: "API 连接", icon: KeyRound },
]

export function SettingsView() {
  return (
    <main className="h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      <div className="mx-auto h-full w-full max-w-5xl px-6 py-10">
        <SettingsContent variant="page" />
      </div>
    </main>
  )
}

export function SettingsContent({ variant }: { variant: "page" | "dialog" }) {
  const [active, setActive] = React.useState<SectionId>("account")
  const { fadeInUp, slideInLeft } = useMotionVariants()
  const viewportRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 })
  }, [active])

  const navAside =
    variant === "page" ? (
      <motion.aside
        variants={slideInLeft}
        initial="hidden"
        animate="show"
      >
        <SettingsSubNav active={active} onChange={setActive} />
      </motion.aside>
    ) : (
      <aside>
        <SettingsSubNav active={active} onChange={setActive} />
      </aside>
    )

  return (
    <div className="grid h-full min-h-0 gap-6 md:grid-cols-[12rem_minmax(0,1fr)] md:grid-rows-1 md:gap-8">
      {navAside}
      <section className="flex min-h-0 flex-col">
        <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              className="p-1"
              variants={fadeInUp}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {active === "account" ? <AccountSection /> : null}
              {active === "general" ? <GeneralSection /> : null}
              {active === "api" ? <ApiConnectionSection /> : null}
            </motion.div>
          </AnimatePresence>
        </ScrollArea>
      </section>
    </div>
  )
}

function SettingsSubNav({
  active,
  onChange,
}: {
  active: SectionId
  onChange: (id: SectionId) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="搜索设置"
          className="pl-8"
          aria-label="搜索设置"
        />
      </div>
      <nav className="flex flex-col gap-1" aria-label="设置分组">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const selected = section.id === active
          return (
            <Button
              key={section.id}
              type="button"
              variant={selected ? "secondary" : "ghost"}
              size="default"
              className="w-full justify-start"
              aria-current={selected ? "page" : undefined}
              onClick={() => onChange(section.id)}
            >
              <Icon className="size-4" />
              {section.label}
            </Button>
          )
        })}
      </nav>
    </div>
  )
}

function ApiConnectionSection() {
  const { config, updateConfig, testConnection } = useConfig()
  const { status: apiStatus, errorMessage } = useApiStatus()

  const handleTestConnection = React.useCallback(async () => {
    try {
      await testConnection()
      toast.success("连接测试通过")
    } catch {
      toast.error("连接测试失败")
    }
  }, [testConnection])

  return (
    <div className="grid gap-6">
      <h2 className="text-lg font-semibold tracking-tight">API 连接</h2>

      <div className="grid gap-3">
        <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          连接信息
        </h3>
        <Card className="gap-0 py-0">
          <div className="divide-y">
            <SettingRow label="Base URL" description="生图服务的访问域名">
              <Input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                className="w-64"
                value={config.baseUrl}
                onChange={(event) =>
                  updateConfig({ baseUrl: event.target.value })
                }
                placeholder="https://..."
              />
            </SettingRow>
            <SettingRow
              label="API Key"
              description="服务认证凭据,仅保存在本地"
            >
              <PasswordInput
                autoComplete="off"
                spellCheck={false}
                className="w-64"
                value={config.apiKey}
                onChange={(event) =>
                  updateConfig({ apiKey: event.target.value })
                }
                placeholder="sk-..."
              />
            </SettingRow>
            <SettingRow label="模型" description="调用的默认模型 ID">
              <Input
                className="w-64"
                value={config.model}
                onChange={(event) =>
                  updateConfig({ model: event.target.value })
                }
                placeholder="gpt-5.3-codex"
              />
            </SettingRow>
          </div>
        </Card>
      </div>

      <div className="grid gap-3">
        <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          连接测试
        </h3>
        <Card className="gap-0 py-0">
          <div className="divide-y">
            <SettingRow
              label="测试连接"
              description="校验当前 Base URL 与 API Key 是否可达"
            >
              <Button
                type="button"
                variant="outline"
                className="w-28"
                disabled={apiStatus === "testing"}
                onClick={handleTestConnection}
              >
                {apiStatus === "testing" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {apiStatus === "testing" ? "测试中" : "测试连接"}
              </Button>
            </SettingRow>
            <div className="px-4 py-4">
              <ApiStatusCard status={apiStatus} errorMessage={errorMessage} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function AccountSection() {
  const { user } = useAuth()
  const initial =
    user?.displayName?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "U"

  const notImplemented = (label: string) =>
    toast.info(`${label} 功能开发中`)

  return (
    <div className="grid gap-6">
      <h2 className="text-lg font-semibold tracking-tight">账户</h2>

      <div className="grid gap-3">
        <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          基础资料
        </h3>
        <Card className="gap-0 py-0">
          <div className="divide-y">
            <SettingRow label="头像" description="JPG / PNG, 不超过 2MB">
              <button
                type="button"
                onClick={() => notImplemented("修改头像")}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="修改头像"
              >
                <Avatar size="lg">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
              </button>
            </SettingRow>
            <SettingRow label="昵称" description="在画廊与日志里展示">
              <Input
                className="w-64"
                defaultValue={user?.displayName ?? ""}
                placeholder="未设置"
              />
            </SettingRow>
            <SettingRow label="邮箱" description="用于登录与接收通知">
              <Input
                className="w-64"
                type="email"
                defaultValue={user?.email ?? ""}
                readOnly
              />
            </SettingRow>
          </div>
        </Card>
      </div>

      <div className="grid gap-3">
        <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          账户安全
        </h3>
        <Card className="gap-0 py-0">
          <div className="divide-y">
            <SettingRow
              label="修改密码"
              description="建议每 90 天更换一次"
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => notImplemented("修改密码")}
              >
                修改密码
              </Button>
            </SettingRow>
            <SettingRow
              label="退出所有设备"
              description="撤销其他端的登录态,本端保留"
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => notImplemented("退出所有设备")}
              >
                立即退出
              </Button>
            </SettingRow>
          </div>
        </Card>
      </div>

      <div className="grid gap-3">
        <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          危险区
        </h3>
        <Card className="gap-0 py-0">
          <div className="divide-y">
            <SettingRow
              label="删除账户"
              description="此操作不可恢复,所有云端与本地数据将一并清除"
            >
              <Button
                type="button"
                variant="destructive"
                onClick={() => notImplemented("删除账户")}
              >
                删除账户
              </Button>
            </SettingRow>
          </div>
        </Card>
      </div>
    </div>
  )
}

function GeneralSection() {
  return (
    <div className="grid gap-6">
      <h2 className="text-lg font-semibold tracking-tight">通用</h2>

      <div className="grid gap-3">
        <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          偏好
        </h3>
        <Card className="gap-0 py-0">
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <Sparkles className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">更多选项即将上线</p>
            <p className="text-xs text-muted-foreground">
              主题、默认比例、默认像素等正在规划
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-4">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">{label}</div>
        {description ? (
          <div className="text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ApiStatusCard({
  status,
  errorMessage,
}: {
  status: ApiStatus
  errorMessage: string
}) {
  const { fadeInUp } = useMotionVariants()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={status}
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        <ApiStatusCardContent status={status} errorMessage={errorMessage} />
      </motion.div>
    </AnimatePresence>
  )
}

function ApiStatusCardContent({
  status,
  errorMessage,
}: {
  status: ApiStatus
  errorMessage: string
}) {
  if (status === "success") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700 dark:border-green-900/70 dark:bg-green-950/30 dark:text-green-300">
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 size-4" />
          <div>
            <p className="text-sm font-medium">连接可用</p>
            <p className="text-xs opacity-80">当前配置已通过连接测试。</p>
          </div>
        </div>
      </div>
    )
  }
  if (status === "testing") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300">
        <div className="flex items-start gap-2">
          <Loader2 className="mt-0.5 size-4 animate-spin" />
          <div>
            <p className="text-sm font-medium">正在测试</p>
            <p className="text-xs opacity-80">
              正在校验当前 Base URL 和 API Key。
            </p>
          </div>
        </div>
      </div>
    )
  }
  if (status === "error") {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive"
        )}
      >
        <div className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-4" />
          <div>
            <p className="text-sm font-medium">连接失败</p>
            <p className="text-xs opacity-80">
              {errorMessage || "请检查 Base URL 与 API Key 后重试"}
            </p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-muted-foreground">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 size-4" />
        <div>
          <p className="text-sm font-medium">未测试</p>
          <p className="text-xs opacity-80">
            保存或使用前建议先测试当前配置。
          </p>
        </div>
      </div>
    </div>
  )
}
