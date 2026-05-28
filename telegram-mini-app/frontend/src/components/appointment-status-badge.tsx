import { Badge } from "@/components/ui/badge"
import { APPOINTMENT_STATUS_META, type AppointmentStatus } from "@/lib/appointment-status"
import { cn } from "@/lib/utils"

interface AppointmentStatusBadgeProps {
  status: AppointmentStatus
  className?: string
}

export function AppointmentStatusBadge({ status, className }: AppointmentStatusBadgeProps) {
  const meta = APPOINTMENT_STATUS_META[status]

  return (
    <Badge variant="outline" className={cn(meta.className, className)}>
      {meta.label}
    </Badge>
  )
}
