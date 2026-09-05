import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.consumable import VehicleConsumable
from app.schemas.consumable import ConsumableCreate, ConsumableUpdate, ConsumableResponse
from app.core.security import get_current_user, get_optional_current_user
from app.services.auth_helper import verify_vehicle_access

router = APIRouter(prefix="/consumables", tags=["Consumables & Specifications"])

DEFAULT_TEMPLATES = [
    {
        "category": "engine",
        "name": "Масло моторное",
        "specification": "SAE 0W-20 / 5W-30 API SP / C5",
        "replacement_interval": "Каждые 7 500 км или 250 мч",
        "notes": "Заправочный объем ~4.0 - 4.5 л с фильтром",
        "order_index": 10,
    },
    {
        "category": "filters",
        "name": "Масляный фильтр ДВС",
        "specification": "Винтовой фильтр (spin-on) или картридж",
        "replacement_interval": "При каждой замене масла",
        "notes": "Момент затяжки 25 Нм. Шайба сливной пробки",
        "order_index": 20,
    },
    {
        "category": "filters",
        "name": "Воздушный фильтр ДВС",
        "specification": "Панельный воздушный фильтр",
        "replacement_interval": "Каждые 10 000 - 15 000 км",
        "notes": "Проверять состояние после зимы и пыльных дорог",
        "order_index": 30,
    },
    {
        "category": "filters",
        "name": "Салонный фильтр",
        "specification": "Угольный / антибактериальный",
        "replacement_interval": "Раз в год или каждые 10 000 км",
        "notes": "Улучшает работу печки и кондиционера",
        "order_index": 40,
    },
    {
        "category": "electrical",
        "name": "Свечи зажигания",
        "specification": "Иридиевые / платиновые (зазор 0.8 - 0.9 мм)",
        "replacement_interval": "Каждые 30 000 - 60 000 км",
        "notes": "Момент затяжки 15-20 Нм",
        "order_index": 50,
    },
    {
        "category": "brakes",
        "name": "Тормозная жидкость",
        "specification": "DOT 4 Class 6 / LV (низковязкая)",
        "replacement_interval": "Раз в 2 года или 40 000 км",
        "notes": "Объем системы ~0.8 - 1.0 л",
        "order_index": 60,
    },
    {
        "category": "cooling",
        "name": "Антифриз (ОЖ)",
        "specification": "G12+ / G12++ OAT карбоксилатный",
        "replacement_interval": "Раз в 4-5 лет или 100 000 км",
        "notes": "Общий объем охлаждающей жидкости ~6.0 - 7.5 л",
        "order_index": 70,
    },
    {
        "category": "brakes",
        "name": "Передние тормозные колодки",
        "specification": "Передняя дисковая ось",
        "replacement_interval": "По износу (остаток < 3 мм)",
        "notes": "Проверять смазку направляющих суппортов",
        "order_index": 80,
    },
    {
        "category": "brakes",
        "name": "Задние тормозные колодки",
        "specification": "Задняя ось",
        "replacement_interval": "По износу (остаток < 3 мм)",
        "notes": "При замене может потребоваться сервисный режим EPB",
        "order_index": 90,
    },
    {
        "category": "electrical",
        "name": "Аккумулятор (АКБ)",
        "specification": "12V 60-70 А·ч, обратная полярность (L2 / D23)",
        "replacement_interval": "Каждые 4-6 лет",
        "notes": "Проверять напряжение покоя и клеммы перед зимой",
        "order_index": 100,
    },
    {
        "category": "wipers",
        "name": "Щетки стеклоочистителя",
        "specification": "Водитель: 650 мм (26\"), Пассажир: 425 мм (17\")",
        "replacement_interval": "Раз в 1-2 сезона",
        "notes": "Тип крепления: Крючок (Hook) или Push button",
        "order_index": 110,
    },
]

@router.get("", response_model=List[ConsumableResponse])
async def get_consumables(
    vehicle_id: int = Query(..., description="ID автомобиля"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_vehicle_access(db, vehicle_id, current_user, require_owner=False)
    query = select(VehicleConsumable).where(VehicleConsumable.vehicle_id == vehicle_id).order_by(VehicleConsumable.order_index.asc(), VehicleConsumable.id.asc())
    result = await db.execute(query)
    items = result.scalars().all()
    return [ConsumableResponse.model_validate(it) for it in items]

@router.post("", response_model=ConsumableResponse, status_code=status.HTTP_201_CREATED)
async def create_consumable(
    payload: ConsumableCreate,
    vehicle_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)
    item = VehicleConsumable(**payload.model_dump(), vehicle_id=vehicle_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ConsumableResponse.model_validate(item)

@router.post("/template", response_model=List[ConsumableResponse], status_code=status.HTTP_201_CREATED)
async def prefill_consumables_template(
    vehicle_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await verify_vehicle_access(db, vehicle_id, current_user, require_owner=True)
    
    # Check existing names to avoid duplicating
    existing_res = await db.execute(select(VehicleConsumable.name).where(VehicleConsumable.vehicle_id == vehicle_id))
    existing_names = {row[0].lower().strip() for row in existing_res.fetchall()}

    added = []
    for tpl in DEFAULT_TEMPLATES:
        if tpl["name"].lower().strip() in existing_names:
            continue
        # If vehicle has oil_spec, populate it for motor oil
        tpl_data = dict(tpl)
        if tpl["name"] == "Масло моторное" and vehicle.oil_spec:
            tpl_data["specification"] = vehicle.oil_spec
            
        item = VehicleConsumable(**tpl_data, vehicle_id=vehicle_id)
        db.add(item)
        added.append(item)

    if added:
        await db.commit()
        for it in added:
            await db.refresh(it)

    query = select(VehicleConsumable).where(VehicleConsumable.vehicle_id == vehicle_id).order_by(VehicleConsumable.order_index.asc(), VehicleConsumable.id.asc())
    result = await db.execute(query)
    all_items = result.scalars().all()
    return [ConsumableResponse.model_validate(it) for it in all_items]

@router.put("/{consumable_id}", response_model=ConsumableResponse)
async def update_consumable(
    consumable_id: int,
    payload: ConsumableUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VehicleConsumable).where(VehicleConsumable.id == consumable_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Расходник не найден")

    await verify_vehicle_access(db, item.vehicle_id, current_user, require_owner=True)

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return ConsumableResponse.model_validate(item)

@router.delete("/{consumable_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_consumable(
    consumable_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VehicleConsumable).where(VehicleConsumable.id == consumable_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Расходник не найден")

    await verify_vehicle_access(db, item.vehicle_id, current_user, require_owner=True)

    await db.delete(item)
    await db.commit()
    return None
