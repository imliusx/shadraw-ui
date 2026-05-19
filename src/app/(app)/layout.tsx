import { AppHeader } from "@/components/app-header"
import { SettingsDialog } from "@/components/settings/settings-dialog"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AppHeader />
      {children}
      <SettingsDialog />
    </>
  )
}
