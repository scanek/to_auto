from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord, ServiceItem, RecordType
from app.models.fuel import FuelLog
from app.models.reminder import MaintenancePlan
from app.models.document import DocumentNote
from app.models.attachment import Attachment
from app.models.tyre import TyreSet
from app.models.setting import Setting
from app.models.consumable import VehicleConsumable

__all__ = [
    "User",
    "UserRole",
    "Vehicle",
    "ServiceRecord",
    "ServiceItem",
    "RecordType",
    "FuelLog",
    "MaintenancePlan",
    "DocumentNote",
    "Attachment",
    "TyreSet",
    "Setting",
    "VehicleConsumable",
]
