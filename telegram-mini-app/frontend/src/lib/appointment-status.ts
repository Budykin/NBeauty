export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "upcoming",
  "cancelled",
  "completed",
] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const APPOINTMENT_STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: {
    label: "Ожидает подтверждения",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  confirmed: {
    label: "Подтверждена",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  upcoming: {
    label: "Скоро начнётся",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  cancelled: {
    label: "Отменена",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  completed: {
    label: "Завершена",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
}

export function normalizeAppointmentStatus(status: string): AppointmentStatus {
  return APPOINTMENT_STATUSES.includes(status as AppointmentStatus)
    ? (status as AppointmentStatus)
    : "pending"
}
