// ============================================================================
// API клиент — все запросы к бэкенду
// ============================================================================

import type { AppointmentStatus } from "./appointment-status"

const rawApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")
const API_BASE = rawApiBase
  ? (rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`)
  : "/api"
const SHOULD_SKIP_NGROK_WARNING = Boolean(rawApiBase && /ngrok/i.test(rawApiBase))

type RequestOptions = RequestInit & {
  withAuth?: boolean
  retryAuthOn401?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

async function request<T>(
  path: string,
  options: RequestOptions = {},
  retried = false
): Promise<T> {
  const { getAccessToken, isTokenExpired, refreshAuth } = await import("./auth")
  const {
    withAuth = true,
    retryAuthOn401 = withAuth,
    ...fetchOptions
  } = options

  let token = withAuth ? getAccessToken() : null

  // Если токен истёк — обновляем до запроса
  if (withAuth && token && isTokenExpired(token)) {
    token = await refreshAuth()
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(SHOULD_SKIP_NGROK_WARNING ? { "ngrok-skip-browser-warning": "true" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...Object.entries(fetchOptions.headers || {}).reduce((acc, [k, v]) => {
      if (typeof v === "string") acc[k] = v
      return acc
    }, {} as Record<string, string>),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  })

  // 401 — пытаемся обновить токен и повторить запрос (один раз)
  if (withAuth && retryAuthOn401 && res.status === 401 && !retried) {
    const newToken = await refreshAuth()
    if (newToken) {
      return request<T>(path, options, true)
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, formatApiErrorDetail(error.detail))
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json()
}

function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg)
        }
        return null
      })
      .filter(Boolean)

    if (messages.length > 0) {
      return messages.join("\n")
    }
  }

  return "Ошибка запроса"
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ============================================================================
// Types (совместимы с backend schemas)
// ============================================================================

export interface ApiUser {
  tgId: number
  fullName: string
  username?: string
  role: "client" | "master"
  avatar?: string
  specialty?: string
  telephoneNumber?: string | null
  rating: number
  reviewCount: number
}

export interface ApiSalon {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  members: ApiSalonMember[]
  resources: ApiResource[]
}

export interface ApiSalonMember {
  id: string
  masterId: string
  masterName: string
  masterAvatar: string
  role: "admin" | "master"
  joinedAt: string
}

export interface ApiResource {
  id: number
  salonId: string
  name: string
  isActive: boolean
}

export interface ApiService {
  id: number
  name: string
  duration: number
  price: number
  salonId?: string
  resourceId?: number
  isActive: boolean
}

export interface ApiSchedule {
  id: number
  salonId?: string
  dayOfWeek: number
  isEnabled: boolean
  startTime: string
  endTime: string
}

export interface ApiAppointment {
  id: number
  salonId?: string
  masterId: number
  masterName: string
  clientId?: number | null
  guestClientId?: number | null
  clientName: string
  serviceName: string
  resourceId?: number
  startTime: string
  endTime: string
  status: AppointmentStatus
  createdAt: string
}

export interface ApiPlatformAdminMe {
  isAdmin: boolean
}

export interface ApiAdminAnalytics {
  totals: Record<string, number>
  appointmentsByStatus: Record<AppointmentStatus, number>
  appointmentsRecent: Record<string, number>
  averageMasterRating: number
  topMasters: Array<{ id: number; name: string; rating: number }>
  topSalons: Array<{ id: string; name: string; appointments: number }>
  telegramLoginSessions: Record<string, number>
}

export interface ApiDeleteImpact {
  entityType: "user" | "salon"
  entityId: string
  counts: Record<string, number>
  warnings: string[]
}

export interface ApiAdminUser {
  tgId: number
  fullName: string
  username?: string
  telephoneNumber?: string | null
  role: "client" | "master"
  rating: number
  createdAt: string
}

export interface ApiAdminSalon {
  id: string
  name: string
  ownerId: number
  inviteCode: string
  createdAt: string
}

export interface ApiReview {
  id: number
  appointmentId: number
  rating: number
  comment?: string
  createdAt: string
}

export interface ApiMasterService {
  id: string
  name: string
  price: number
  duration: number
  resourceId?: string
}

export interface ApiMaster {
  id: string
  name: string
  fullName?: string
  username?: string
  avatar: string
  specialty: string
  rating: number
  reviewCount: number
  reviews: ApiMasterReview[]
  services: ApiMasterService[]
  schedules?: ApiSchedule[]
  salonId?: string
}

export interface ApiMasterReview {
  id: number
  rating: number
  comment?: string
  clientName?: string
  clientUsername?: string
  createdAt: string
}

export interface ApiTimeSlot {
  start: string
  end: string
}

export interface ApiClient {
  id: string
  type: "registered" | "guest"
  fullName: string
  telephoneNumber?: string | null
  username?: string | null
  note: string
  appointmentsCount: number
  lastAppointmentAt?: string | null
  history?: ApiClientHistoryItem[]
}

export interface ApiClientHistoryItem {
  id: number
  serviceName: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  createdAt: string
}

export interface ApiAuthResponse {
  accessToken: string
  tokenType: string
  userId: number
  fullName: string
  username?: string
  avatar?: string
  telephoneNumber?: string | null
  role: "client" | "master"
}

export interface ApiLoginSessionResponse {
  token: string
  status: "pending" | "completed" | "expired"
  expiresAt: string
  botLink: string
}

export interface ApiLoginSessionStatusResponse {
  status: "pending" | "completed" | "expired"
  expiresAt: string
  botLink: string
  auth?: ApiAuthResponse | null
}

export interface ApiTelegramBotLinkResponse {
  botUrl: string
}

// ============================================================================
// Auth
// ============================================================================

export const apiAuth = {
  telegram(initData: string) {
    return request<ApiAuthResponse>("/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ initData }),
      withAuth: false,
      retryAuthOn401: false,
    })
  },

  createLoginSession() {
    return request<ApiLoginSessionResponse>("/auth/telegram/login-session", {
      method: "POST",
      withAuth: false,
      retryAuthOn401: false,
    })
  },

  getLoginSession(token: string) {
    return request<ApiLoginSessionStatusResponse>(`/auth/telegram/login-session/${token}`, {
      withAuth: false,
      retryAuthOn401: false,
    })
  },

  getTelegramBotLink() {
    return request<ApiTelegramBotLinkResponse>("/auth/telegram/bot-link", {
      withAuth: false,
      retryAuthOn401: false,
    })
  },
}

// ============================================================================
// Profile
// ============================================================================

export const apiProfile = {
  getMe() {
    return request<ApiUser>("/me")
  },

  updateMe(data: { fullName?: string; specialty?: string; avatar?: string; telephoneNumber?: string | null }) {
    return request<ApiUser>("/me", {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  becomeMaster() {
    return request<{ role: string; message: string }>("/me/become-master", {
      method: "POST",
    })
  },

  switchToClient() {
    return request<{ role: string; message: string }>("/me/switch-to-client", {
      method: "POST",
    })
  },
}

// ============================================================================
// Masters
// ============================================================================

export const apiMasters = {
  list() {
    return request<ApiMaster[]>("/masters/")
  },

  getById(id: number) {
    return request<ApiMaster>(`/masters/${id}`)
  },

  slots(masterId: number, serviceId: number, date: string, stepMinutes = 30) {
    const params = new URLSearchParams({
      serviceId: String(serviceId),
      date,
      stepMinutes: String(stepMinutes),
    })
    return request<ApiTimeSlot[]>(`/appointments/${masterId}/slots?${params}`)
  },
}

// ============================================================================
// Salons
// ============================================================================

export const apiSalons = {
  list() {
    return request<ApiSalon[]>("/salons/")
  },

  create(name: string) {
    return request<ApiSalon>("/salons/create", {
      method: "POST",
      body: JSON.stringify({ name }),
    })
  },

  join(inviteCode: string) {
    return request<ApiSalon>("/salons/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode }),
    })
  },

  my() {
    return request<ApiSalon[]>("/salons/my")
  },

  removeMember(salonId: string, memberId: string) {
    return request<void>(`/salons/${salonId}/members/${memberId}`, {
      method: "DELETE",
    })
  },
}

// ============================================================================
// Services
// ============================================================================

export const apiServices = {
  my() {
    return request<ApiService[]>("/services/my")
  },

  create(data: {
    name: string
    duration: number
    price: number
    salonId?: string
    resourceId?: number
  }) {
    return request<ApiService>("/services/", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update(id: number, data: Partial<ApiService>) {
    return request<ApiService>(`/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete(id: number) {
    return request<void>(`/services/${id}`, { method: "DELETE" })
  },
}

// ============================================================================
// Schedules
// ============================================================================

export const apiSchedules = {
  my() {
    return request<ApiSchedule[]>("/schedules/my")
  },

  create(data: {
    salonId?: string
    dayOfWeek: number
    isEnabled: boolean
    startTime: string
    endTime: string
  }) {
    return request<ApiSchedule>("/schedules/", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update(id: number, data: Partial<ApiSchedule>) {
    return request<ApiSchedule>(`/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete(id: number) {
    return request<void>(`/schedules/${id}`, { method: "DELETE" })
  },
}

// ============================================================================
// Appointments
// ============================================================================

export const apiAppointments = {
  my(role: "master" | "client" = "master") {
    return request<ApiAppointment[]>(`/appointments/my?role=${role}`)
  },

  history(role: "master" | "client" = "master") {
    return request<ApiAppointment[]>(`/appointments/my/history?role=${role}`)
  },

  create(data: {
    masterId: number
    clientId?: number
    guestClientId?: number
    serviceId: number
    startTime: string
  }) {
    return request<ApiAppointment>("/bookings/create", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  cancel(id: number) {
    return request<ApiAppointment>(`/appointments/${id}/cancel`, {
      method: "PUT",
    })
  },

  confirm(id: number) {
    return request<ApiAppointment>(`/appointments/${id}/confirm`, {
      method: "PUT",
    })
  },

  complete(id: number) {
    return request<ApiAppointment>(`/appointments/${id}/complete`, {
      method: "PUT",
    })
  },
}

export const apiClients = {
  list(search?: string) {
    const params = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""
    return request<ApiClient[]>(`/clients/my${params}`)
  },

  getById(type: "registered" | "guest", id: string) {
    return request<ApiClient>(`/clients/my/${type}/${id}`)
  },

  createGuest(data: { fullName: string; telephoneNumber?: string; note?: string }) {
    return request<ApiClient>("/clients/guest", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  deleteGuest(id: string) {
    return request<void>(`/clients/guest/${id}`, {
      method: "DELETE",
    })
  },

  updateNote(type: "registered" | "guest", id: string, note: string) {
    return request<ApiClient>(`/clients/my/${type}/${id}/note`, {
      method: "PUT",
      body: JSON.stringify({ note }),
    })
  },
}

// ============================================================================
// Resources
// ============================================================================

export const apiResources = {
  bySalon(salonId: string) {
    return request<ApiResource[]>(`/salons/${salonId}/resources`)
  },

  create(salonId: string, data: { name: string; isActive: boolean }) {
    return request<ApiResource>(`/salons/${salonId}/resources`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update(id: number, data: { name?: string; isActive?: boolean }) {
    return request<ApiResource>(`/resources/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete(id: number) {
    return request<void>(`/resources/${id}`, { method: "DELETE" })
  },
}

export const apiPlatformAdmin = {
  me() {
    return request<ApiPlatformAdminMe>("/platform-admin/me")
  },

  analytics() {
    return request<ApiAdminAnalytics>("/platform-admin/analytics")
  },

  users() {
    return request<ApiAdminUser[]>("/platform-admin/users")
  },

  salons() {
    return request<ApiAdminSalon[]>("/platform-admin/salons")
  },

  appointments() {
    return request<ApiAppointment[]>("/platform-admin/appointments")
  },

  reviews() {
    return request<ApiReview[]>("/platform-admin/reviews")
  },

  resources() {
    return request<ApiResource[]>("/platform-admin/resources")
  },

  services() {
    return request<ApiService[]>("/platform-admin/services")
  },

  userDeleteImpact(userId: number) {
    return request<ApiDeleteImpact>(`/platform-admin/users/${userId}/delete-impact`)
  },

  deleteUser(userId: number) {
    return request<void>(`/platform-admin/users/${userId}`, {
      method: "DELETE",
      body: JSON.stringify({ confirm: true }),
    })
  },

  salonDeleteImpact(salonId: string) {
    return request<ApiDeleteImpact>(`/platform-admin/salons/${salonId}/delete-impact`)
  },

  deleteSalon(salonId: string) {
    return request<void>(`/platform-admin/salons/${salonId}`, {
      method: "DELETE",
      body: JSON.stringify({ confirm: true }),
    })
  },
}
