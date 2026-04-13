from __future__ import annotations

import enum
import uuid
from datetime import datetime, time
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Базовый класс для всех моделей."""

    pass


class UserRole(str, enum.Enum):
    CLIENT = "client"
    MASTER = "master"


class SalonMemberRole(str, enum.Enum):
    ADMIN = "admin"
    MASTER = "master"


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    UPCOMING = "upcoming"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class User(Base):
    """Пользователь приложения.

    Сейчас основной идентификатор — Telegram ID, потому что bot и Mini App уже
    построены вокруг него. Для полноценной web-auth позже лучше добавить
    отдельную таблицу auth_accounts.
    """

    __tablename__ = "users"

    tg_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", native_enum=False),
        nullable=False,
        default=UserRole.CLIENT,
    )

    avatar: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    specialty: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False, default=0)
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    salons_owned: Mapped[List["Salon"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    salon_memberships: Mapped[List["SalonMember"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    services: Mapped[List["Service"]] = relationship(
        back_populates="master",
        foreign_keys="Service.master_id",
        cascade="all, delete-orphan",
    )
    master_appointments: Mapped[List["Appointment"]] = relationship(
        back_populates="master",
        foreign_keys="Appointment.master_id",
    )
    client_appointments: Mapped[List["Appointment"]] = relationship(
        back_populates="client",
        foreign_keys="Appointment.client_id",
    )
    schedules: Mapped[List["MasterSchedule"]] = relationship(
        back_populates="master",
        cascade="all, delete-orphan",
    )
    reviews_received: Mapped[List["Review"]] = relationship(
        back_populates="master",
        foreign_keys="Review.master_id",
        cascade="all, delete-orphan",
    )
    reviews_written: Mapped[List["Review"]] = relationship(
        back_populates="client",
        foreign_keys="Review.client_id",
        cascade="all, delete-orphan",
    )
    platform_admin_record: Mapped[Optional["PlatformAdmin"]] = relationship(
        back_populates="user",
        foreign_keys="PlatformAdmin.user_id",
        uselist=False,
    )
    granted_platform_admins: Mapped[List["PlatformAdmin"]] = relationship(
        back_populates="granted_by_user",
        foreign_keys="PlatformAdmin.granted_by",
    )

    __table_args__ = (
        CheckConstraint("rating >= 0 AND rating <= 5", name="chk_users_rating"),
        CheckConstraint("review_count >= 0", name="chk_users_review_count"),
    )


class Salon(Base):
    """Салон / коворкинг."""

    __tablename__ = "salons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    owner_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invite_code: Mapped[str] = mapped_column(String(24), nullable=False, unique=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    owner: Mapped[User] = relationship(back_populates="salons_owned")
    members: Mapped[List["SalonMember"]] = relationship(
        back_populates="salon",
        cascade="all, delete-orphan",
    )
    resources: Mapped[List["Resource"]] = relationship(
        back_populates="salon",
        cascade="all, delete-orphan",
    )
    services: Mapped[List["Service"]] = relationship(back_populates="salon")
    appointments: Mapped[List["Appointment"]] = relationship(back_populates="salon")
    platform_admins: Mapped[List["PlatformAdmin"]] = relationship(
        back_populates="granted_by_user",
        foreign_keys="PlatformAdmin.granted_by",
    )


class PlatformAdmin(Base):
    """Глобальный администратор платформы."""

    __tablename__ = "platform_admins"

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        primary_key=True,
    )
    granted_by: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="SET NULL"),
        nullable=True,
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user: Mapped[User] = relationship(
        back_populates="platform_admin_record",
        foreign_keys=[user_id],
    )
    granted_by_user: Mapped[Optional[User]] = relationship(
        back_populates="platform_admins",
        foreign_keys=[granted_by],
    )


class SalonMember(Base):
    """Член салона — мастер или администратор."""

    __tablename__ = "salon_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    salon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("salons.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[SalonMemberRole] = mapped_column(
        Enum(SalonMemberRole, name="salon_member_role", native_enum=False),
        nullable=False,
        default=SalonMemberRole.MASTER,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )

    salon: Mapped[Salon] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="salon_memberships")

    __table_args__ = (
        UniqueConstraint("salon_id", "user_id", name="uq_salon_members_salon_user"),
    )


class Resource(Base):
    """Ресурс салона, например кабинет или кресло."""

    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    salon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("salons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    salon: Mapped[Salon] = relationship(back_populates="resources")
    services: Mapped[List["Service"]] = relationship(back_populates="resource")
    appointments: Mapped[List["Appointment"]] = relationship(back_populates="resource")

    __table_args__ = (
        UniqueConstraint("salon_id", "name", name="uq_resources_salon_name"),
    )


class Service(Base):
    """Услуга мастера в салоне."""

    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    master_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    salon_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("salons.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resource_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("resources.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    master: Mapped[User] = relationship(back_populates="services", foreign_keys=[master_id])
    salon: Mapped[Optional[Salon]] = relationship(back_populates="services")
    resource: Mapped[Optional[Resource]] = relationship(back_populates="services")
    appointments: Mapped[List["Appointment"]] = relationship(back_populates="service")

    __table_args__ = (
        CheckConstraint("duration > 0", name="chk_services_duration_positive"),
        CheckConstraint("price >= 0", name="chk_services_price_non_negative"),
    )


class MasterSchedule(Base):
    """Базовое расписание мастера по дням недели."""

    __tablename__ = "master_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    master_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    salon_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("salons.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    master: Mapped[User] = relationship(back_populates="schedules")

    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="chk_master_schedules_day"),
        CheckConstraint("start_time < end_time", name="chk_master_schedules_time"),
        UniqueConstraint("master_id", "salon_id", "day_of_week", name="uq_master_schedules_master_salon_day"),
    )


class Appointment(Base):
    """Запись клиента к мастеру."""

    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    salon_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("salons.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    master_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resource_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("resources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    service_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("services.id", ondelete="RESTRICT"),
        nullable=False,
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointment_status", native_enum=False),
        nullable=False,
        default=AppointmentStatus.PENDING,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    salon: Mapped[Optional[Salon]] = relationship(back_populates="appointments")
    master: Mapped[User] = relationship(back_populates="master_appointments", foreign_keys=[master_id])
    client: Mapped[User] = relationship(back_populates="client_appointments", foreign_keys=[client_id])
    resource: Mapped[Optional[Resource]] = relationship(back_populates="appointments")
    service: Mapped[Service] = relationship(back_populates="appointments")
    review: Mapped[Optional["Review"]] = relationship(back_populates="appointment")

    __table_args__ = (
        CheckConstraint("start_time < end_time", name="chk_appointments_time"),
    )


class Review(Base):
    """Отзыв клиента о завершенной записи."""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    appointment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    master_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )

    appointment: Mapped[Appointment] = relationship(back_populates="review")
    master: Mapped[User] = relationship(back_populates="reviews_received", foreign_keys=[master_id])
    client: Mapped[User] = relationship(back_populates="reviews_written", foreign_keys=[client_id])

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="chk_reviews_rating"),
    )
