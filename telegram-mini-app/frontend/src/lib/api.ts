// ============================================================================
// API клиент — все запросы к бэкенду
// ============================================================================

const rawApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")
const API_BASE = rawApiBase
  ? (rawApiBase.endsWith("/api") ? rawApiBase : `${rawApiBase}/api`)
  : "/api"

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
    throw new ApiError(res.status, error.detail || "Ошибка запроса")
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json()
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
  clientId: number
  clientName: string
  serviceName: string
  resourceId?: number
  startTime: string
  endTime: string
  status: string
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
  avatar: string
  specialty: string
  rating: number
  reviewCount: number
  services: ApiMasterService[]
  salonId?: string
}

export interface ApiTimeSlot {
  start: string
  end: string
}

export interface ApiAuthResponse {
  accessToken: string
  tokenType: string
  userId: number
  fullName: string
  username?: string
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
}

// ============================================================================
// Profile
// ============================================================================

export const apiProfile = {
  getMe() {
    return request<ApiUser>("/me")
  },

  updateMe(data: { fullName?: string; specialty?: string; avatar?: string }) {
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
    return request<ApiTimeSlot[]>(`/masters/${masterId}/slots?${params}`)
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
    clientId: number
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
