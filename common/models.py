
from __future__ import annotations

import enum
import uuid
from datetime import datetime, time
from typing import List, Optional

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Базовый класс для всех моделей."""

    pass


class UserRole(str, enum.Enum):
    MASTER = "master"
    CLIENT = "client"


class SalonMemberRole(str, enum.Enum):
    ADMIN = "admin"
    MASTER = "master"


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELED = "canceled"
    COMPLETED = "completed"


class User(Base):
    """Пользователь Telegram.

    tg_id используется как первичный ключ, чтобы можно было
    однозначно идентифицировать аккаунт.
    """

    __tablename__ = "users"

    tg_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", native_enum=False),
        nullable=False,
        default=UserRole.CLIENT,
    )

    # Связи
    salons_owned: Mapped[List["Salon"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    salon_memberships: Mapped[List["SalonMember"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    master_services: Mapped[List["Service"]] = relationship(
        back_populates="master",
        foreign_keys="Service.master_id",
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


class SalonMember(Base):
    """Член салона — мастер или администратор."""

    __tablename__ = "salon_members"

    salon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("salons.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[SalonMemberRole] = mapped_column(
        Enum(SalonMemberRole, name="salon_member_role", native_enum=False),
        nullable=False,
        default=SalonMemberRole.MASTER,
    )

    salon: Mapped[Salon] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="salon_memberships")


class Resource(Base):
    """Ресурс салона, например кабинет или кресло."""

    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    salon_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("salons.id", ondelete="CASCADE"),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    salon: Mapped[Salon] = relationship(back_populates="resources")

    services: Mapped[List["Service"]] = relationship(
        back_populates="resource",
        cascade="all, delete-orphan",
    )

    appointments: Mapped[List["Appointment"]] = relationship(
        back_populates="resource",
        cascade="all, delete-orphan",
    )


class Service(Base):
    """Услуга мастера в салоне."""

    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    master_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
    )

    # Необязательная привязка к конкретному ресурсу (кабинету)
    resource_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("resources.id", ondelete="SET NULL"),
        nullable=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    duration: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Длительность услуги в минутах",
    )
    price: Mapped[int] = mapped_column(Integer, nullable=False)

    master: Mapped[User] = relationship(back_populates="master_services")
    resource: Mapped[Optional[Resource]] = relationship(back_populates="services")

    appointments: Mapped[List["Appointment"]] = relationship(
        back_populates="service",
        cascade="all, delete-orphan",
    )


class MasterSchedule(Base):
    """Базовое расписание мастера по дням недели."""

    __tablename__ = "master_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    master_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
    )

    # 0-6, где 0 — понедельник, 6 — воскресенье (как в datetime.weekday())
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="chk_day_of_week"),
    )

    master: Mapped[User] = relationship(back_populates="schedules")


class Appointment(Base):
    """Запись клиента к мастеру."""

    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    master_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.tg_id", ondelete="CASCADE"),
        nullable=False,
    )

    # Может быть пустым, если услуга не требует конкретного кабинета
    resource_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("resources.id", ondelete="SET NULL"),
        nullable=True,
    )

    service_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
    )

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
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
    )

    master: Mapped[User] = relationship(
        back_populates="master_appointments",
        foreign_keys=[master_id],
    )
    client: Mapped[User] = relationship(
        back_populates="client_appointments",
        foreign_keys=[client_id],
    )

    resource: Mapped[Optional[Resource]] = relationship(back_populates="appointments")
    service: Mapped[Service] = relationship(back_populates="appointments")

    __table_args__ = (
        CheckConstraint("start_time < end_time", name="chk_appointment_time"),
    )

