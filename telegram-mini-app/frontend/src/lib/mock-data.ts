import type { Service, Appointment, Master, WorkingHours, Salon, Resource } from "./types"

export const MOCK_RESOURCES: Resource[] = [
  { id: "r1", name: "Массажный кабинет 1", salonId: "salon1", isActive: true },
  { id: "r2", name: "Массажный кабинет 2", salonId: "salon1", isActive: true },
  { id: "r3", name: "Кресло педикюра", salonId: "salon1", isActive: true },
  { id: "r4", name: "Кресло маникюра 1", salonId: "salon1", isActive: true },
  { id: "r5", name: "Кресло маникюра 2", salonId: "salon1", isActive: false },
]

export const MOCK_SERVICES: Service[] = [
  { id: "s1", name: "Стрижка мужская", price: 1500, duration: 45 },
  { id: "s2", name: "Стрижка женская", price: 2500, duration: 60 },
  { id: "s3", name: "Окрашивание", price: 5000, duration: 120 },
  { id: "s4", name: "Укладка", price: 1800, duration: 40 },
  { id: "s5", name: "Маникюр", price: 2000, duration: 60, resourceId: "r4" },
  { id: "s6", name: "Педикюр", price: 2500, duration: 75, resourceId: "r3" },
  { id: "s7", name: "Массаж спины", price: 3000, duration: 60, resourceId: "r1" },
]

export const MOCK_MASTERS: Master[] = [
  {
    id: "m1",
    name: "Анна Петрова",
    avatar: "АП",
    specialty: "Стилист-колорист",
    rating: 4.9,
    reviewCount: 128,
    services: [MOCK_SERVICES[0], MOCK_SERVICES[1], MOCK_SERVICES[2], MOCK_SERVICES[3]],
    salonId: "salon1",
  },
  {
    id: "m2",
    name: "Мария Иванова",
    avatar: "МИ",
    specialty: "Мастер маникюра",
    rating: 4.8,
    reviewCount: 95,
    services: [MOCK_SERVICES[4], MOCK_SERVICES[5], MOCK_SERVICES[6]],
    salonId: "salon1",
  },
  {
    id: "m3",
    name: "Елена Сидорова",
    avatar: "ЕС",
    specialty: "Парикмахер-универсал",
    rating: 4.7,
    reviewCount: 73,
    services: [MOCK_SERVICES[0], MOCK_SERVICES[1], MOCK_SERVICES[3]],
    salonId: "salon1",
  },
]

const today = new Date()
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: "a1",
    clientName: "Ольга Козлова",
    clientId: "c1",
    masterId: "m1",
    masterName: "Анна Петрова",
    service: MOCK_SERVICES[0],
    date: fmt(today),
    startTime: "10:00",
    endTime: "10:45",
    status: "upcoming",
  },
  {
    id: "a2",
    clientName: "Дмитрий Волков",
    clientId: "c2",
    masterId: "m1",
    masterName: "Анна Петрова",
    service: MOCK_SERVICES[1],
    date: fmt(today),
    startTime: "11:00",
    endTime: "12:00",
    status: "upcoming",
  },
  {
    id: "a3",
    clientName: "Светлана Морозова",
    clientId: "c3",
    masterId: "m1",
    masterName: "Анна Петрова",
    service: MOCK_SERVICES[2],
    date: fmt(today),
    startTime: "13:00",
    endTime: "15:00",
    status: "upcoming",
  },
  {
    id: "a4",
    clientName: "Ирина Новикова",
    clientId: "c1",
    masterId: "m1",
    masterName: "Анна Петрова",
    service: MOCK_SERVICES[3],
    date: fmt(new Date(today.getTime() + 86400000)),
    startTime: "09:00",
    endTime: "09:40",
    status: "upcoming",
  },
  // Запись другого мастера на тот же ресурс - для демонстрации занятости
  {
    id: "a5",
    clientName: "Татьяна Белова",
    clientId: "c4",
    masterId: "m2",
    masterName: "Мария Иванова",
    service: MOCK_SERVICES[6],
    date: fmt(today),
    startTime: "14:00",
    endTime: "15:00",
    status: "upcoming",
    resourceId: "r1",
  },
]

export const MOCK_WORKING_HOURS: WorkingHours[] = [
  { dayOfWeek: 0, day: "Понедельник", dayShort: "Пн", enabled: true, start: "09:00", end: "18:00" },
  { dayOfWeek: 1, day: "Вторник", dayShort: "Вт", enabled: true, start: "09:00", end: "18:00" },
  { dayOfWeek: 2, day: "Среда", dayShort: "Ср", enabled: true, start: "09:00", end: "18:00" },
  { dayOfWeek: 3, day: "Четверг", dayShort: "Чт", enabled: true, start: "09:00", end: "18:00" },
  { dayOfWeek: 4, day: "Пятница", dayShort: "Пт", enabled: true, start: "09:00", end: "17:00" },
  { dayOfWeek: 5, day: "Суббота", dayShort: "Сб", enabled: true, start: "10:00", end: "15:00" },
  { dayOfWeek: 6, day: "Воскресенье", dayShort: "Вс", enabled: false, start: "10:00", end: "15:00" },
]

export const MOCK_SALONS: Salon[] = [
  {
    id: "salon1",
    name: "Beauty Studio",
    ownerId: "m1",
    inviteCode: "BSALON2024",
    members: [
      {
        id: "sm1",
        masterId: "m1",
        masterName: "Анна Петрова",
        masterAvatar: "АП",
        role: "admin",
        joinedAt: "2024-01-15",
      },
      {
        id: "sm2",
        masterId: "m2",
        masterName: "Мария Иванова",
        masterAvatar: "МИ",
        role: "master",
        joinedAt: "2024-02-20",
      },
      {
        id: "sm3",
        masterId: "m3",
        masterName: "Елена Сидорова",
        masterAvatar: "ЕС",
        role: "master",
        joinedAt: "2024-03-10",
      },
    ],
    resources: MOCK_RESOURCES,
  },
]
