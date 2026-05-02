"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, Upload, Check, Loader2 } from "lucide-react"
import { apiProfile } from "@/lib/api"
import { cn } from "@/lib/utils"

interface EditProfileProps {
  currentName: string
  currentSpecialty?: string
  currentAvatar?: string
  onBack: () => void
  onSave: (name: string, specialty?: string, avatar?: string) => void
}

export function EditProfile({
  currentName,
  currentSpecialty,
  currentAvatar,
  onBack,
  onSave,
}: EditProfileProps) {
  const [fullName, setFullName] = useState(currentName)
  const [specialty, setSpecialty] = useState(currentSpecialty || "")
  const [avatar, setAvatar] = useState<string | undefined>(currentAvatar)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasChanges =
    fullName.trim() !== currentName ||
    specialty.trim() !== (currentSpecialty || "") ||
    avatar !== currentAvatar

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?"

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Проверяем размер (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Размер файла не должен превышать 5MB")
      return
    }

    // Проверяем формат
    if (!file.type.startsWith("image/")) {
      setError("Файл должен быть изображением")
      return
    }

    // Читаем файл как base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setAvatar(result)
      setError(null)
    }
    reader.onerror = () => {
      setError("Ошибка при загрузке файла")
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!fullName.trim()) {
      setError("Имя не может быть пустым")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await apiProfile.updateMe({
        fullName: fullName.trim(),
        specialty: specialty.trim() || undefined,
        avatar,
      })

      onSave(fullName.trim(), specialty.trim() || undefined, avatar)
    } catch (err) {
      console.error("Update profile failed:", err)
      setError("Не удалось обновить профиль. Попробуй ещё раз.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col gap-4 px-4 pb-4 pt-3"
    >
      {/* Заголовок */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
          aria-label="Назад"
          disabled={isLoading}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">Редактировать профиль</h2>
      </div>

      {/* Аватар */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
            {avatar ? (
              <img
                src={avatar}
                alt="Аватар"
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <label
            htmlFor="avatar-upload"
            className={cn(
              "absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary transition-all cursor-pointer hover:bg-accent/80",
              isLoading && "opacity-50 cursor-not-allowed",
            )}
          >
            <Upload className="h-5 w-5" />
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={isLoading}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Клик для изменения фото</p>
      </div>

      {/* Ошибка */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </motion.div>
      )}

      {/* Форма */}
      <div className="flex flex-col gap-3">
        {/* ФИО */}
        <div className="flex flex-col gap-2">
          <label htmlFor="full-name" className="text-sm font-medium text-foreground">Полное имя</label>
          <input
            id="full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isLoading}
            placeholder="Ваше имя и фамилия"
            className={cn(
              "rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors",
              "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20",
              isLoading && "opacity-50 cursor-not-allowed",
            )}
          />
        </div>

        {/* Специальность (для мастеров) */}
        <div className="flex flex-col gap-2">
          <label htmlFor="specialty" className="text-sm font-medium text-foreground">Специальность</label>
          <input
            id="specialty"
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            disabled={isLoading}
            placeholder="Например: Стилист-колорист"
            className={cn(
              "rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors",
              "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20",
              isLoading && "opacity-50 cursor-not-allowed",
            )}
          />
        </div>
      </div>

      {/* Кнопки */}
      <div className="flex gap-2 pt-4">
        <button
          onClick={onBack}
          disabled={isLoading}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-all",
            "active:scale-[0.98] hover:bg-muted",
            isLoading && "opacity-50 cursor-not-allowed",
          )}
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading || !hasChanges}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-all",
            "active:scale-[0.98] hover:bg-primary/90",
            (isLoading || !hasChanges) && "opacity-50 cursor-not-allowed",
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Сохранить
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}
