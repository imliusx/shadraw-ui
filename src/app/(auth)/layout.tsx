import Link from "next/link"
import { Palette } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-14 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Palette className="size-5 text-foreground" />
          <span className="text-xl font-light leading-none tracking-tight">
            shadraw
          </span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  )
}
