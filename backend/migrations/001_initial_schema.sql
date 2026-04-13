-- ============================================================================
-- NBeauty — Схема базы данных для Telegram Mini App
-- ============================================================================
-- 
-- КОНЦЕПЦИЯ РОЛЕЙ:
-- 
-- 1. users.role = 'client' | 'master'
--    - Определяет РЕЖИМ использования приложения
--    - Переключается в интерфейсе (master ↔ client)
--    - Один пользователь может быть и мастером, и клиентом
--
-- 2. salon_members.role = 'admin' | 'master'
--    - Определяет ПРАВА в КОНКРЕТНОМ салоне
--    - admin: управление салоном, мастерами, ресурсами
--    - master: работает в салоне, видит только свои записи
--    - Один пользователь может быть админом в одном салоне 
--      и обычным мастером в другом
--
-- 3. platform_admins — отдельная таблица для глобальных админов платформы
--    - Не смешивается с обычными ролями
--    - Даёт доступ к админ-панели всей платформы
--    - Может быть выдано любому пользователю
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- ПОЛЬЗОВАТЕЛИ
-- ============================================================================
-- role: 'client' или 'master' — режим работы приложения
-- Переключается в интерфейсе без ограничений
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    tg_id BIGINT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE,
    role VARCHAR(32) NOT NULL DEFAULT 'client'
        CHECK (role IN ('client', 'master')),
    avatar VARCHAR(255),
    specialty VARCHAR(255),
    rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_users_rating CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT chk_users_review_count CHECK (review_count >= 0)
);

COMMENT ON TABLE users IS 'Пользователи Telegram. role определяет режим: мастер (оказывает услуги) или клиент (записывается)';
COMMENT ON COLUMN users.role IS 'client или master — переключается в интерфейсе приложения';

-- ============================================================================
-- ГЛОБАЛЬНЫЕ АДМИНЫ ПЛАТФОРМЫ
-- ============================================================================
-- Отдельная таблица, не смешивается с users.role
-- Админ платформы = обычный пользователь с доп. правами
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_admins (
    user_id BIGINT PRIMARY KEY REFERENCES users(tg_id) ON DELETE CASCADE,
    granted_by BIGINT REFERENCES users(tg_id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE platform_admins IS 'Глобальные администраторы всей платформы (не салона!)';
COMMENT ON COLUMN platform_admins.granted_by IS 'Кто выдал права админа';

-- ============================================================================
-- САЛОНЫ
-- ============================================================================
-- owner_id — создатель салона (автоматически становится admin в salon_members)
-- invite_code — длинный уникальный код (Base62, 24 символа) для приглашения
--               Генерируется автоматически при создании
--               Можно перевыпустить через функцию regenerate_salon_invite_code()
-- ============================================================================
CREATE TABLE IF NOT EXISTS salons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    invite_code VARCHAR(24) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE salons IS 'Салоны/студии. Владелец автоматически получает роль admin в salon_members';
COMMENT ON COLUMN salons.invite_code IS 'Уникальный код приглашения (Base62, 24 символа). Перевыпускается через функцию';

-- ============================================================================
-- ФУНКЦИЯ: ГЕНЕРАЦИЯ INVITE_CODE (Base62, 24 символа)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(24) AS $$
DECLARE
    chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..24 LOOP
        result := result || SUBSTRING(chars FROM ceil(random() * 62)::int FOR 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Триггер для авто-генерации invite_code при создании салона
CREATE OR REPLACE FUNCTION trigger_generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.invite_code := generate_invite_code();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_salons_invite_code
    BEFORE INSERT ON salons
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_invite_code();

-- ============================================================================
-- ФУНКЦИЯ: ПЕРЕВЫПУСК INVITE_CODE
-- ============================================================================
-- Вызывается когда админ салона хочет отозвать старый код и создать новый
-- Пример: SELECT regenerate_salon_invite_code('salon-uuid-here');
-- ============================================================================
CREATE OR REPLACE FUNCTION regenerate_salon_invite_code(p_salon_id UUID)
RETURNS VARCHAR(24) AS $$
DECLARE
    new_code VARCHAR(24);
    v_owner_id BIGINT;
    v_is_admin BOOLEAN;
BEGIN
    -- Проверяем, что салон существует
    SELECT owner_id INTO v_owner_id FROM salons WHERE id = p_salon_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Салон с ID % не найден', p_salon_id;
    END IF;

    -- Генерируем новый код
    new_code := generate_invite_code();
    
    -- Обновляем салон
    UPDATE salons 
    SET invite_code = new_code, updated_at = now()
    WHERE id = p_salon_id;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION regenerate_salon_invite_code IS 'Перевыпускает код приглашения салона. Возвращает новый код';

-- ============================================================================
-- УЧАСТНИКИ САЛОНА
-- ============================================================================
-- role: 'admin' | 'master'
-- admin — может управлять салоном, добавлять/удалять мастеров, ресурсы
-- master — работает в салоне, видит только свои записи
-- Один пользователь может быть в нескольких салонах с разными ролями
-- ============================================================================
CREATE TABLE IF NOT EXISTS salon_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'master'
        CHECK (role IN ('admin', 'master')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_salon_members_salon_user UNIQUE (salon_id, user_id)
);

COMMENT ON TABLE salon_members IS 'Участники салона: admin (управляет) или master (работает)';
COMMENT ON COLUMN salon_members.role IS 'admin = управление салоном, master = только работа';

-- ============================================================================
-- РЕСУРСЫ (кабинеты, кресла, оборудование)
-- ============================================================================
-- Ресурсы принадле салону, могут быть заняты во время записи
-- ============================================================================
CREATE TABLE IF NOT EXISTS resources (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_resources_salon_name UNIQUE (salon_id, name)
);

COMMENT ON TABLE resources IS 'Ресурсы салона: кабинеты, кресла, оборудование — могут бронироваться вместе с записью';

-- ============================================================================
-- УСЛУГИ
-- ============================================================================
-- master_id — мастер, который оказывает услугу
-- salon_id — салон, где оказывается (может быть NULL)
-- resource_id — ресурс, который нужен (опционально)
-- ============================================================================
CREATE TABLE IF NOT EXISTS services (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    master_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    salon_id UUID REFERENCES salons(id) ON DELETE SET NULL,
    resource_id INTEGER REFERENCES resources(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    duration INTEGER NOT NULL,
    price INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_services_duration_positive CHECK (duration > 0),
    CONSTRAINT chk_services_price_non_negative CHECK (price >= 0)
);

COMMENT ON TABLE services IS 'Услуги мастеров. price — для отображения клиенту (без финансовой логики)';

-- ============================================================================
-- РАСПИСАНИЕ МАСТЕРОВ
-- ============================================================================
-- day_of_week: 0=Понедельник ... 6=Воскресенье
-- Определяет рабочие дни и часы мастера в конкретном салоне
-- ============================================================================
CREATE TABLE IF NOT EXISTS master_schedules (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    master_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    CONSTRAINT chk_master_schedules_day CHECK (day_of_week >= 0 AND day_of_week <= 6),
    CONSTRAINT chk_master_schedules_time CHECK (start_time < end_time),
    CONSTRAINT uq_master_schedules_master_salon_day UNIQUE (master_id, salon_id, day_of_week)
);

COMMENT ON TABLE master_schedules IS 'Рабочее расписание мастеров: дни недели и часы работы в салоне';
COMMENT ON COLUMN master_schedules.day_of_week IS '0=Понедельник, 1=Вторник, ..., 6=Воскресенье';

-- ============================================================================
-- ЗАПИСИ НА ПРИЁМ
-- ============================================================================
-- status: pending → confirmed → upcoming → completed / cancelled
-- Защита от overlap: мастер и ресурс не могут быть заняты одновременно
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    salon_id UUID REFERENCES salons(id) ON DELETE SET NULL,
    master_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    resource_id INTEGER REFERENCES resources(id) ON DELETE SET NULL,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'upcoming', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_appointments_time CHECK (start_time < end_time)
);

COMMENT ON TABLE appointments IS 'Записи клиентов к мастерам. status отслеживает жизненный цикл записи';

-- ============================================================================
-- ОТЗЫВЫ
-- ============================================================================
-- Один отзыв на одну запись (appointment_id UNIQUE)
-- rating: 1-5, влияет на рейтинг мастера в users.rating
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    master_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    comment VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5)
);

COMMENT ON TABLE reviews IS 'Отзывы клиентов о мастерах. Один отзыв = одна завершённая запись';

-- ============================================================================
-- ИНДЕКСЫ
-- ============================================================================

-- Салоны
CREATE INDEX IF NOT EXISTS ix_salons_owner_id ON salons(owner_id);
CREATE INDEX IF NOT EXISTS ix_salons_invite_code ON salons(invite_code);

-- Ресурсы
CREATE INDEX IF NOT EXISTS ix_resources_salon_id ON resources(salon_id);

-- Услуги
CREATE INDEX IF NOT EXISTS ix_services_master_id ON services(master_id);
CREATE INDEX IF NOT EXISTS ix_services_salon_id ON services(salon_id);

-- Расписание
CREATE INDEX IF NOT EXISTS ix_master_schedules_master_id ON master_schedules(master_id);
CREATE INDEX IF NOT EXISTS ix_master_schedules_salon_id ON master_schedules(salon_id);

-- Записи
CREATE INDEX IF NOT EXISTS ix_appointments_salon_id ON appointments(salon_id);
CREATE INDEX IF NOT EXISTS ix_appointments_master_id ON appointments(master_id);
CREATE INDEX IF NOT EXISTS ix_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS ix_appointments_resource_id ON appointments(resource_id);
CREATE INDEX IF NOT EXISTS ix_appointments_start_time ON appointments(start_time);

-- Отзывы
CREATE INDEX IF NOT EXISTS ix_reviews_master_id ON reviews(master_id);
CREATE INDEX IF NOT EXISTS ix_reviews_client_id ON reviews(client_id);

-- ============================================================================
-- CONSTRAINTS: ЗАЩИТА ОТ OVERLAP ЗАПИСЕЙ
-- ============================================================================

-- Мастер не может быть записан дважды в одно время
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ex_appointments_master_time_overlap'
    ) THEN
        ALTER TABLE appointments
            ADD CONSTRAINT ex_appointments_master_time_overlap
            EXCLUDE USING gist (
                master_id WITH =,
                tstzrange(start_time, end_time, '[)') WITH &&
            )
            WHERE (status <> 'cancelled');
    END IF;
END $$;

COMMENT ON CONSTRAINT ex_appointments_master_time_overlap ON appointments IS 'Мастер не может иметь пересекающиеся записи (кроме отменённых)';

-- Ресурс не может быть занят дважды в одно время
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ex_appointments_resource_time_overlap'
    ) THEN
        ALTER TABLE appointments
            ADD CONSTRAINT ex_appointments_resource_time_overlap
            EXCLUDE USING gist (
                resource_id WITH =,
                tstzrange(start_time, end_time, '[)') WITH &&
            )
            WHERE (resource_id IS NOT NULL AND status <> 'cancelled');
    END IF;
END $$;

COMMENT ON CONSTRAINT ex_appointments_resource_time_overlap ON appointments IS 'Ресурс не может быть занят дважды в одно время (кроме отменённых)';

-- ============================================================================
-- ТРИГГЕР: АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column IS 'Автоматически обновляет updated_at при изменении записи';

-- Применяем к таблицам с updated_at
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN VALUES ('users'), ('salons'), ('resources'), ('services'), ('appointments')
    LOOP
        EXECUTE format('
            CREATE TRIGGER trigger_%1$s_updated_at
            BEFORE UPDATE ON %1$s
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        ', tbl);
    END LOOP;
END $$;

-- ============================================================================
-- ФУНКЦИЯ: РЕГУЛИРОВКА РЕЙТИНГА МАСТЕРА
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_master_rating(p_master_id BIGINT)
RETURNS VOID AS $$
DECLARE
    avg_rating NUMERIC(3, 2);
    review_cnt INTEGER;
BEGIN
    SELECT COALESCE(AVG(rating), 0), COUNT(*)
    INTO avg_rating, review_cnt
    FROM reviews
    WHERE master_id = p_master_id;

    UPDATE users
    SET rating = avg_rating,
        review_count = review_cnt
    WHERE tg_id = p_master_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_master_rating IS 'Пересчитывает средний рейтинг и количество отзывов мастера';

-- Триггер для авто-обновления рейтинга при добавлении/изменении отзыва
CREATE OR REPLACE TRIGGER trigger_reviews_update_rating
    AFTER INSERT OR UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_master_rating(NEW.master_id);
