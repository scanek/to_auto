import urllib.parse
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models import Vehicle, ServiceRecord, FuelLog, MaintenancePlan, TyreSet, DocumentNote, User
from app.services.pdf_service import generate_service_booklet_html
from app.services.excel_service import generate_vehicle_excel
from app.services.analytics_service import compute_vehicle_analytics
from app.services.auth_helper import verify_vehicle_access
from app.core.security import get_current_user, get_optional_current_user, create_access_token, decode_access_token

router = APIRouter(prefix="/export", tags=["Export"])

@router.post("/ticket/{vehicle_id}")
async def create_download_ticket(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates a single-use, 60-second signed download ticket for secure file exports
    without exposing long-lived user JWT tokens in URLs.
    """
    await verify_vehicle_access(db, vehicle_id, current_user, require_owner=False)
    ticket = create_access_token(
        data={"sub": str(current_user.id), "vid": vehicle_id, "scope": "download_ticket"},
        expires_delta=datetime.timedelta(seconds=60)
    )
    return {"ticket": ticket, "expires_in": 60}

async def resolve_user_for_export(
    db: AsyncSession,
    vehicle_id: int,
    authorization: Optional[str],
    ticket: Optional[str],
    token: Optional[str],
) -> tuple[Optional[User], Vehicle]:
    """Resolves user from Header, single-use ticket, or token and checks vehicle access."""
    user = None
    
    # 1. Bearer Header (Highest Priority & Best Practice)
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ")[1]
        payload = decode_access_token(raw_token)
        if payload and "sub" in payload:
            user = await db.scalar(select(User).where(User.id == int(payload["sub"])))
            
    # 2. Short-lived single-use Download Ticket
    elif ticket:
        payload = decode_access_token(ticket)
        if payload and payload.get("scope") == "download_ticket" and payload.get("vid") == vehicle_id:
            user = await db.scalar(select(User).where(User.id == int(payload["sub"])))
            
    # 3. Fallback token (Legacy)
    elif token:
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user = await db.scalar(select(User).where(User.id == int(payload["sub"])))
            
    vehicle = await verify_vehicle_access(db, vehicle_id, user, require_owner=False)
    return user, vehicle

@router.get("/service-booklet/{vehicle_id}")
async def export_service_booklet(
    vehicle_id: int,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    _, vehicle = await resolve_user_for_export(db, vehicle_id, authorization, ticket, token)

    srv_res = await db.execute(
        select(ServiceRecord)
        .options(selectinload(ServiceRecord.items))
        .where(ServiceRecord.vehicle_id == vehicle_id)
        .order_by(ServiceRecord.date.asc(), ServiceRecord.odometer.asc(), ServiceRecord.id.asc())
    )
    service_records = srv_res.scalars().all()

    ty_res = await db.execute(
        select(TyreSet)
        .where(TyreSet.vehicle_id == vehicle_id)
        .order_by(TyreSet.season.asc(), TyreSet.name.asc())
    )
    tyres = ty_res.scalars().all()

    html_content = generate_service_booklet_html(vehicle, service_records, tyres=tyres)
    
    return Response(
        content=html_content,
        media_type="text/html",
        headers={
            "Content-Disposition": 'inline',
            "X-Content-Type-Options": "nosniff"
        }
    )

@router.get("/excel/{vehicle_id}")
async def export_excel(
    vehicle_id: int,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    _, vehicle = await resolve_user_for_export(db, vehicle_id, authorization, ticket, token)

    srv_res = await db.execute(
        select(ServiceRecord)
        .options(selectinload(ServiceRecord.items))
        .where(ServiceRecord.vehicle_id == vehicle_id)
        .order_by(ServiceRecord.date.asc(), ServiceRecord.odometer.asc(), ServiceRecord.id.asc())
    )
    service_records = srv_res.scalars().all()

    fuel_res = await db.execute(
        select(FuelLog)
        .where(FuelLog.vehicle_id == vehicle_id)
        .order_by(FuelLog.date.asc(), FuelLog.odometer.asc(), FuelLog.id.asc())
    )
    fuel_logs = fuel_res.scalars().all()

    rem_res = await db.execute(
        select(MaintenancePlan)
        .where(MaintenancePlan.vehicle_id == vehicle_id)
    )
    reminders = rem_res.scalars().all()

    ty_res = await db.execute(
        select(TyreSet)
        .where(TyreSet.vehicle_id == vehicle_id)
        .order_by(TyreSet.created_at.desc())
    )
    tyres = ty_res.scalars().all()

    doc_res = await db.execute(
        select(DocumentNote)
        .where(DocumentNote.vehicle_id == vehicle_id)
        .order_by(DocumentNote.created_at.desc())
    )
    documents = doc_res.scalars().all()

    analytics = await compute_vehicle_analytics(db, vehicle)
    excel_bytes = generate_vehicle_excel(vehicle, service_records, fuel_logs, reminders, tyres, documents, analytics)
    
    filename = f"AutoTracker_{vehicle.id}_{vehicle.make}_{vehicle.model}.xlsx"
    encoded_filename = urllib.parse.quote(filename)

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "X-Content-Type-Options": "nosniff"
        },
    )
