import hashlib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct, desc

from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.visit import VisitLog
from app.schemas.analytics import VehicleAnalytics
from app.services.analytics_service import compute_vehicle_analytics
from app.core.security import get_current_user, get_optional_current_user, get_current_admin
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/analytics", tags=["Analytics & Reports"])

class HitRequest(BaseModel):
    path: str = "/"
    device_type: Optional[str] = "desktop" # mobile, tablet, desktop

def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"

def _hash_visitor(ip: str, user_agent: str, date_str: str) -> str:
    salt = "autotracker_privacy_salt_2026"
    raw = f"{ip}:{user_agent}:{date_str}:{salt}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

@router.get("/{vehicle_id}", response_model=VehicleAnalytics)
async def get_vehicle_analytics(
    vehicle_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=False)
    analytics = await compute_vehicle_analytics(db, vehicle)
    return analytics

@router.post("/hit")
async def record_visit_hit(
    payload: HitRequest,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Records a page hit and daily unique visitor using an anonymized SHA-256 hash.
    No cookies or PII stored.
    """
    now = datetime.utcnow()
    date_str = now.strftime("%Y-%m-%d")
    ip = _get_client_ip(request)
    ua = request.headers.get("User-Agent", "Unknown")[:250]

    visitor_hash = _hash_visitor(ip, ua, date_str)

    # Determine device type if not provided
    dev_type = payload.device_type or "desktop"
    ua_lower = ua.lower()
    if any(w in ua_lower for w in ("mobi", "android", "iphone")):
        dev_type = "mobile"
    elif any(w in ua_lower for w in ("ipad", "tablet")):
        dev_type = "tablet"

    # Save hit
    visit = VisitLog(
        visitor_hash=visitor_hash,
        user_id=current_user.id if current_user else None,
        path=payload.path[:250] if payload.path else "/",
        device_type=dev_type,
        created_at=now,
    )
    db.add(visit)
    await db.commit()

    return {"status": "ok"}

@router.get("/admin/traffic-stats")
async def get_traffic_stats(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin only: aggregates unique visitors and pageviews:
    - Online now (last 15 minutes)
    - Today's unique visitors & total hits
    - Last 7 days unique visitors & total hits
    - Last 30 days unique visitors
    - 14-day daily chart timeline
    - Device breakdown (mobile vs desktop)
    - Top visited paths
    """
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    yesterday_start = today_start - timedelta(days=1)
    seven_days_ago = today_start - timedelta(days=7)
    thirty_days_ago = today_start - timedelta(days=30)
    fifteen_mins_ago = now - timedelta(minutes=15)

    # 1. Online now (active in last 15 min)
    online_res = await db.execute(
        select(func.count(distinct(VisitLog.visitor_hash))).where(VisitLog.created_at >= fifteen_mins_ago)
    )
    online_now = online_res.scalar() or 0

    # 2. Today's unique visitors and total hits
    today_unique_res = await db.execute(
        select(func.count(distinct(VisitLog.visitor_hash))).where(VisitLog.created_at >= today_start)
    )
    today_unique = today_unique_res.scalar() or 0

    today_hits_res = await db.execute(
        select(func.count(VisitLog.id)).where(VisitLog.created_at >= today_start)
    )
    today_hits = today_hits_res.scalar() or 0

    # 3. Yesterday's unique visitors
    yest_unique_res = await db.execute(
        select(func.count(distinct(VisitLog.visitor_hash))).where(
            VisitLog.created_at >= yesterday_start,
            VisitLog.created_at < today_start,
        )
    )
    yesterday_unique = yest_unique_res.scalar() or 0

    # 4. 7 Days unique visitors and hits
    week_unique_res = await db.execute(
        select(func.count(distinct(VisitLog.visitor_hash))).where(VisitLog.created_at >= seven_days_ago)
    )
    week_unique = week_unique_res.scalar() or 0

    week_hits_res = await db.execute(
        select(func.count(VisitLog.id)).where(VisitLog.created_at >= seven_days_ago)
    )
    week_hits = week_hits_res.scalar() or 0

    # 5. 30 Days unique visitors
    month_unique_res = await db.execute(
        select(func.count(distinct(VisitLog.visitor_hash))).where(VisitLog.created_at >= thirty_days_ago)
    )
    month_unique = month_unique_res.scalar() or 0

    # 6. Today logged-in vs guests
    today_auth_res = await db.execute(
        select(func.count(distinct(VisitLog.visitor_hash))).where(
            VisitLog.created_at >= today_start,
            VisitLog.user_id.isnot(None)
        )
    )
    today_auth = today_auth_res.scalar() or 0
    today_guests = max(0, today_unique - today_auth)

    # 7. 14 Days daily chart breakdown
    fourteen_days_ago = today_start - timedelta(days=13)
    recent_visits_res = await db.execute(
        select(
            func.strftime("%Y-%m-%d", VisitLog.created_at).label("day"),
            func.count(distinct(VisitLog.visitor_hash)).label("uniques"),
            func.count(VisitLog.id).label("hits")
        )
        .where(VisitLog.created_at >= fourteen_days_ago)
        .group_by("day")
        .order_by("day")
    )
    daily_stats_map = {row.day: {"uniques": row.uniques, "hits": row.hits} for row in recent_visits_res.all()}

    daily_chart = []
    for i in range(14):
        d = (fourteen_days_ago + timedelta(days=i)).strftime("%Y-%m-%d")
        item = daily_stats_map.get(d, {"uniques": 0, "hits": 0})
        daily_chart.append({
            "date": d,
            "display_date": d[5:], # MM-DD
            "uniques": item["uniques"],
            "hits": item["hits"]
        })

    # 8. Top visited pages today / 7d
    top_paths_res = await db.execute(
        select(VisitLog.path, func.count(VisitLog.id).label("hits"))
        .where(VisitLog.created_at >= seven_days_ago)
        .group_by(VisitLog.path)
        .order_by(desc("hits"))
        .limit(6)
    )
    top_paths = [{"path": row[0], "hits": row[1]} for row in top_paths_res.all()]

    # 9. Device breakdown (mobile vs desktop)
    dev_res = await db.execute(
        select(VisitLog.device_type, func.count(VisitLog.id).label("hits"))
        .where(VisitLog.created_at >= seven_days_ago)
        .group_by(VisitLog.device_type)
    )
    devices = {row[0]: row[1] for row in dev_res.all()}

    return {
        "online_now": online_now,
        "today_unique": today_unique,
        "today_hits": today_hits,
        "yesterday_unique": yesterday_unique,
        "week_unique": week_unique,
        "week_hits": week_hits,
        "month_unique": month_unique,
        "today_auth": today_auth,
        "today_guests": today_guests,
        "daily_chart": daily_chart,
        "top_paths": top_paths,
        "devices": devices,
    }
