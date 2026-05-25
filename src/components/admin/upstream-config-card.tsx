"use client"

import * as React from "react"
import { toast } from "sonner"

import { adminApi, type UpstreamConfigDTO } from "@/lib/api/admin-client"
import { ApiError } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/password-input"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"

export function UpstreamConfigCard() {
  const [config, setConfig] = React.useState<UpstreamConfigDTO | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)

  const [baseUrl, setBaseUrl] = React.useState("")
  const [apiKey, setApiKey] = React.useState("")
  const [apiKeyDirty, setApiKeyDirty] = React.useState(false)
  const [models, setModels] = React.useState("")
  const [concurrency, setConcurrency] = React.useState(4)

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, rt] = await Promise.all([
        adminApi.getUpstream(),
        adminApi.getRuntime(),
      ])
      setConfig(cfg)
      setBaseUrl(cfg.baseUrl)
      setModels(cfg.enabledModels.join(", "))
      setConcurrency(rt.workerConcurrency)
      setApiKey("")
      setApiKeyDirty(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const handleSave = React.useCallback(async () => {
    setSaving(true)
    try {
      const enabledModels = models
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const payload: Parameters<typeof adminApi.updateUpstream>[0] = {
        baseUrl,
        enabledModels,
      }
      if (apiKeyDirty) {
        payload.apiKey = apiKey === "" ? null : apiKey
      }
      const next = await adminApi.updateUpstream(payload)
      setConfig(next)
      setApiKey("")
      setApiKeyDirty(false)
      toast.success("已保存上游配置")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [baseUrl, apiKey, apiKeyDirty, models])

  const handleTest = React.useCallback(async () => {
    setTesting(true)
    try {
      const res = await adminApi.testUpstream()
      if (res.ok) {
        toast.success("上游连通性正常")
      } else {
        toast.error(`连接失败: ${res.message || `HTTP ${res.status}`}`)
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "测试失败")
    } finally {
      setTesting(false)
    }
  }, [])

  const handleConcurrency = React.useCallback(async (value: number) => {
    setConcurrency(value)
    try {
      await adminApi.updateRuntime(value)
      toast.success(`Worker 并发度已更新为 ${value}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "更新失败")
    }
  }, [])

  if (loading) {
    return (
      <Card className="gap-4 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    )
  }

  return (
    <div className="grid gap-6">
      <Card className="gap-4 p-6">
        <div>
          <h3 className="text-base font-semibold">上游 OpenAI 兼容接口</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            所有用户的生图请求都通过此配置发往上游；API Key 加密存储，不会返回原值。
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="upstream-baseurl">Base URL</Label>
          <Input
            id="upstream-baseurl"
            placeholder="https://api.openai.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="upstream-apikey">
            API Key
            {config?.apiKeySet ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                当前: {config.apiKeyMasked}
              </span>
            ) : null}
          </Label>
          <PasswordInput
            id="upstream-apikey"
            placeholder={config?.apiKeySet ? "留空则保持不变" : "sk-..."}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setApiKeyDirty(true)
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="upstream-models">启用模型（逗号分隔）</Label>
          <Input
            id="upstream-models"
            placeholder="gpt-image-2, gpt-5.3-codex"
            value={models}
            onChange={(e) => setModels(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            {saving ? "保存中..." : "保存"}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Spinner /> : null}
            {testing ? "测试中..." : "测试连通性"}
          </Button>
          <Button variant="ghost" onClick={() => void reload()}>
            重置
          </Button>
        </div>
      </Card>

      <Card className="gap-4 p-6">
        <div>
          <h3 className="text-base font-semibold">Worker 并发度</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            同时调用上游的最大并发数。修改后立即生效，无需重启。
          </p>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-sm">
            <span>当前并发：</span>
            <span className="font-mono">{concurrency}</span>
          </div>
          <Slider
            min={1}
            max={16}
            step={1}
            value={[concurrency]}
            onValueChange={(v) => setConcurrency(v[0] ?? 1)}
            onValueCommit={(v) => void handleConcurrency(v[0] ?? 1)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>16</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
