from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.auth import get_current_user
from backend.app.schemas.clients import (
    ClientAppointmentHistoryItemOut,
    ClientDetailOut,
    ClientListItemOut,
    ClientNoteUpdate,
    ClientType,
    GuestClientCreate,
)
from common import get_async_session
from common.models import Appointment, ClientNote, GuestClient, User, UserRole


router = APIRouter()


def _ensure_master(current_user: User) -> None:
    if current_user.role != UserRole.MASTER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Раздел доступен только мастеру",
        )


def _note_text(note: str | None) -> str:
    return note or ""


def _client_search_clause(search: str | None, *fields):
    if not search:
        return None
    pattern = f"%{search.strip()}%"
    return or_(*(field.ilike(pattern) for field in fields))


def _history_item(appointment: Appointment) -> ClientAppointmentHistoryItemOut:
    return ClientAppointmentHistoryItemOut(
        id=appointment.id,
        service_name=appointment.service.name if appointment.service else "Неизвестная услуга",
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        status=appointment.status.value,
        created_at=appointment.created_at,
    )


async def _get_or_create_note(
    session: AsyncSession,
    master_id: int,
    client_type: ClientType,
    client_id: int,
) -> ClientNote:
    filters = [
        ClientNote.master_id == master_id,
        ClientNote.client_id == client_id if client_type == "registered" else ClientNote.client_id.is_(None),
        ClientNote.guest_client_id == client_id if client_type == "guest" else ClientNote.guest_client_id.is_(None),
    ]
    note = await session.scalar(select(ClientNote).where(*filters).limit(1))
    if note is not None:
        return note

    note = ClientNote(
        master_id=master_id,
        client_id=client_id if client_type == "registered" else None,
        guest_client_id=client_id if client_type == "guest" else None,
        note="",
    )
    session.add(note)
    await session.flush()
    return note


async def _build_client_detail(
    session: AsyncSession,
    master_id: int,
    client_type: ClientType,
    client_id: int,
) -> ClientDetailOut:
    if client_type == "registered":
        client = await session.scalar(select(User).where(User.tg_id == client_id))
        if client is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")

        history = (
            await session.execute(
                select(Appointment)
                .options(selectinload(Appointment.service))
                .where(
                    Appointment.master_id == master_id,
                    Appointment.client_id == client_id,
                )
                .order_by(Appointment.start_time.desc())
            )
        ).scalars().all()
        if not history:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")

        note = await session.scalar(
            select(ClientNote).where(
                ClientNote.master_id == master_id,
                ClientNote.client_id == client_id,
                ClientNote.guest_client_id.is_(None),
            )
        )
        last_appointment_at = max((appointment.start_time for appointment in history), default=None)
        return ClientDetailOut(
            id=str(client.tg_id),
            type="registered",
            full_name=client.full_name,
            telephone_number=client.telephone_number,
            username=client.username,
            note=_note_text(note.note if note else None),
            appointments_count=len(history),
            last_appointment_at=last_appointment_at,
            history=[_history_item(appointment) for appointment in history],
        )

    guest_client = await session.scalar(
        select(GuestClient).where(
            GuestClient.id == client_id,
            GuestClient.master_id == master_id,
        )
    )
    if guest_client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Клиент не найден")

    history = (
        await session.execute(
            select(Appointment)
            .options(selectinload(Appointment.service))
            .where(
                Appointment.master_id == master_id,
                Appointment.guest_client_id == guest_client.id,
            )
            .order_by(Appointment.start_time.desc())
        )
    ).scalars().all()
    note = await session.scalar(
        select(ClientNote).where(
            ClientNote.master_id == master_id,
            ClientNote.guest_client_id == guest_client.id,
            ClientNote.client_id.is_(None),
        )
    )

    last_appointment_at = max((appointment.start_time for appointment in history), default=None)
    return ClientDetailOut(
        id=str(guest_client.id),
        type="guest",
        full_name=guest_client.full_name,
        telephone_number=guest_client.telephone_number,
        username=None,
        note=_note_text(note.note if note else None),
        appointments_count=len(history),
        last_appointment_at=last_appointment_at,
        history=[_history_item(appointment) for appointment in history],
    )


@router.get("/my", response_model=list[ClientListItemOut])
async def list_my_clients(
    search: str | None = Query(default=None, min_length=1),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    _ensure_master(current_user)

    registered_query = (
        select(
            User.tg_id,
            User.full_name,
            User.telephone_number,
            ClientNote.note,
            func.count(func.distinct(Appointment.id)),
            func.max(Appointment.start_time),
        )
        .select_from(Appointment)
        .join(User, User.tg_id == Appointment.client_id)
        .outerjoin(
            ClientNote,
            and_(
                ClientNote.master_id == current_user.tg_id,
                ClientNote.client_id == User.tg_id,
                ClientNote.guest_client_id.is_(None),
            ),
        )
        .where(
            Appointment.master_id == current_user.tg_id,
            Appointment.client_id.is_not(None),
        )
        .group_by(User.tg_id, User.full_name, User.telephone_number, ClientNote.note)
        .order_by(func.max(Appointment.start_time).desc(), User.full_name.asc())
    )
    registered_search = _client_search_clause(search, User.full_name, User.telephone_number)
    if registered_search is not None:
        registered_query = registered_query.where(registered_search)

    guest_query = (
        select(
            GuestClient.id,
            GuestClient.full_name,
            GuestClient.telephone_number,
            ClientNote.note,
            func.count(func.distinct(Appointment.id)),
            func.max(Appointment.start_time),
        )
        .select_from(GuestClient)
        .outerjoin(
            Appointment,
            and_(
                Appointment.master_id == current_user.tg_id,
                Appointment.guest_client_id == GuestClient.id,
            ),
        )
        .outerjoin(
            ClientNote,
            and_(
                ClientNote.master_id == current_user.tg_id,
                ClientNote.guest_client_id == GuestClient.id,
                ClientNote.client_id.is_(None),
            ),
        )
        .where(GuestClient.master_id == current_user.tg_id)
        .group_by(GuestClient.id, GuestClient.full_name, GuestClient.telephone_number, ClientNote.note)
        .order_by(func.max(Appointment.start_time).desc().nullslast(), GuestClient.full_name.asc())
    )
    guest_search = _client_search_clause(search, GuestClient.full_name, GuestClient.telephone_number)
    if guest_search is not None:
        guest_query = guest_query.where(guest_search)

    registered_rows = (await session.execute(registered_query)).all()
    guest_rows = (await session.execute(guest_query)).all()

    clients = [
        ClientListItemOut(
            id=str(client_id),
            type="registered",
            full_name=full_name,
            telephone_number=telephone_number,
            note=_note_text(note),
            appointments_count=appointments_count,
            last_appointment_at=last_appointment_at,
        )
        for client_id, full_name, telephone_number, note, appointments_count, last_appointment_at in registered_rows
    ] + [
        ClientListItemOut(
            id=str(guest_client_id),
            type="guest",
            full_name=full_name,
            telephone_number=telephone_number,
            note=_note_text(note),
            appointments_count=appointments_count,
            last_appointment_at=last_appointment_at,
        )
        for guest_client_id, full_name, telephone_number, note, appointments_count, last_appointment_at in guest_rows
    ]

    clients.sort(
        key=lambda client: (
            client.last_appointment_at is None,
            -(client.last_appointment_at.timestamp()) if client.last_appointment_at else 0,
            client.full_name.lower(),
        ),
    )
    return clients


@router.get("/my/{client_type}/{client_id}", response_model=ClientDetailOut)
async def get_my_client_detail(
    client_type: ClientType,
    client_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    _ensure_master(current_user)
    return await _build_client_detail(session, current_user.tg_id, client_type, client_id)


@router.post("/guest", response_model=ClientDetailOut, status_code=status.HTTP_201_CREATED)
async def create_guest_client(
    payload: GuestClientCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    _ensure_master(current_user)

    guest_client: GuestClient | None = None
    if payload.telephone_number:
        guest_client = await session.scalar(
            select(GuestClient).where(
                GuestClient.master_id == current_user.tg_id,
                GuestClient.telephone_number == payload.telephone_number,
            )
        )

    if guest_client is None:
        guest_client = GuestClient(
            master_id=current_user.tg_id,
            full_name=payload.full_name.strip(),
            telephone_number=payload.telephone_number,
        )
        session.add(guest_client)
        await session.flush()
    else:
        guest_client.full_name = payload.full_name.strip()
        guest_client.telephone_number = payload.telephone_number
        session.add(guest_client)

    note = await _get_or_create_note(session, current_user.tg_id, "guest", guest_client.id)
    note.note = payload.note or ""
    session.add(note)

    await session.commit()
    return await _build_client_detail(session, current_user.tg_id, "guest", guest_client.id)


@router.put("/my/{client_type}/{client_id}/note", response_model=ClientDetailOut)
async def update_client_note(
    client_type: ClientType,
    client_id: int,
    payload: ClientNoteUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    _ensure_master(current_user)
    note = await _get_or_create_note(session, current_user.tg_id, client_type, client_id)
    note.note = payload.note
    session.add(note)
    await session.commit()
    return await _build_client_detail(session, current_user.tg_id, client_type, client_id)
