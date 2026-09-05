import base64
import io
import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, Optional
import httpx
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Ты — высокоточный интеллектуальный ассистент автосервиса и трекера обслуживания автомобилей (AutoTracker).
Твоя задача — детально проанализировать фотографию или скан документа (заказ-наряд автосервиса, акт выполненных работ, квитанция СТО, товарный чек на автозапчасти или чек с АЗС).

Извлеки информацию и верни СТРОГО валидный JSON со следующей структурой:
{
  "document_type": "service_order",
  "record_type": "service",
  "date": "YYYY-MM-DD",
  "odometer": 12345,
  "engine_hours": null,
  "vendor": "Название автосервиса, дилера или сети АЗС",
  "title": "Краткое название записи (например 'ТО: Замена масла и фильтров' или 'Заправка АИ-95')",
  "description": "Понятное структурированное описание выполненных работ и установленных запчастей",
  "cost_labor": 2500.0,
  "cost_parts": 5500.0,
  "total_cost": 8000.0,
  "fuel_litres": null,
  "fuel_price_per_litre": null,
  "fuel_type": null,
  "items": [
    {
      "name": "Наименование детали или работы",
      "brand": "Бренд (e.g. Mann, Shell, Motul, или пустая строка)",
      "part_number": "Каталожный номер / артикул (если указан в заказ-наряде, иначе пустая строка)",
      "category": "part",
      "quantity": 1.0,
      "unit": "шт",
      "unit_price": 1000.0,
      "total_price": 1000.0
    }
  ],
  "confidence": 95,
  "notes": "Важные рекомендации или примечания мастера из документа"
}

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. document_type может быть: "service_order", "fuel_receipt", "parts_receipt", "other".
2. record_type может быть: "service", "repair", "upgrade", "fuel".
3. Числа (odometer, cost_labor, cost_parts, total_cost, fuel_litres, unit_price, total_price) должны быть строгими числами (float или int), БЕЗ пробелов, знаков валют (руб) и кавычек. Если значение отсутствует, ставь null или 0.
4. Дату обязательно приведи к формату YYYY-MM-DD. Если год указан двумя цифрами (24), преобразуй в 2024.
5. Разделяй работы (category: "labor") и запасные части/материалы (category: "part") в массиве items.
6. Для чеков АЗС укажи record_type: "fuel", заполни fuel_litres, fuel_price_per_litre, fuel_type (например 'АИ-95', 'АИ-92', 'АИ-100', 'ДТ') и total_cost.
7. Ответь ИСКЛЮЧИТЕЛЬНО валидным JSON без вступительного текста и без markdown-разметки.
"""

def optimize_image_for_ocr(image_bytes: bytes, max_dimension: int = 1920) -> tuple[bytes, str]:
    img = Image.open(io.BytesIO(image_bytes))
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    width, height = img.size
    if max(width, height) > max_dimension:
        scale = max_dimension / max(width, height)
        new_width = int(width * scale)
        new_height = int(height * scale)
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    out = io.BytesIO()
    img.save(out, format='JPEG', quality=85, optimize=True)
    return out.getvalue(), 'image/jpeg'

async def call_gemini_vision(
    image_bytes: bytes,
    api_key: str,
    mime_type: str = 'image/jpeg'
) -> Dict[str, Any]:
    b64_image = base64.b64encode(image_bytes).decode('utf-8')
    models = ['gemini-2.0-flash', 'gemini-1.5-flash']
    last_error = None

    payload = {
        'contents': [
            {
                'parts': [
                    {'text': SYSTEM_PROMPT},
                    {
                        'inline_data': {
                            'mime_type': mime_type,
                            'data': b64_image,
                        }
                    },
                ]
            }
        ],
        'generationConfig': {
            'temperature': 0.1,
            'topP': 0.95,
            'responseMimeType': 'application/json',
        },
    }

    async with httpx.AsyncClient(timeout=35.0) as client:
        for model in models:
            url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get('candidates', [])
                    if candidates:
                        content_parts = candidates[0].get('content', {}).get('parts', [])
                        if content_parts:
                            raw_text = content_parts[0].get('text', '').strip()
                            clean_text = re.sub(r'^```json\s*', '', raw_text)
                            clean_text = re.sub(r'\s*```$', '', clean_text).strip()
                            try:
                                parsed = json.loads(clean_text)
                                parsed['raw_text'] = raw_text
                                parsed['model_used'] = model
                                return parsed
                            except json.JSONDecodeError:
                                logger.warning(f'Failed to decode JSON from {model}: {raw_text[:200]}')
                else:
                    last_error = f'API {model} HTTP {resp.status_code}: {resp.text[:200]}'
                    logger.warning(last_error)
            except Exception as e:
                last_error = str(e)
                logger.error(f'Error requesting {model}: {e}')

    raise RuntimeError(last_error or 'Не удалось распознать документ с помощью Gemini Vision.')

def parse_fallback_dummy(image_bytes: bytes) -> Dict[str, Any]:
    today_str = datetime.now().strftime('%Y-%m-%d')
    return {
        'document_type': 'service_order',
        'record_type': 'service',
        'date': today_str,
        'odometer': None,
        'engine_hours': None,
        'vendor': 'Автотехцентр',
        'title': 'ТО: Обслуживание автомобиля',
        'description': 'Для автоматического распознавания текста, цен, артикулов и сумм укажите бесплатный ключ Google Gemini API в окне сканирования.',
        'cost_labor': 0.0,
        'cost_parts': 0.0,
        'total_cost': 0.0,
        'fuel_litres': None,
        'fuel_price_per_litre': None,
        'fuel_type': None,
        'items': [],
        'confidence': 0,
        'notes': 'Добавьте бесплатный ключ Gemini API для мгновенного анализа фото.',
        'requires_api_key': True,
    }

async def analyze_receipt_document(
    image_bytes: bytes,
    custom_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    optimized_bytes, mime_type = optimize_image_for_ocr(image_bytes)

    api_key = (custom_api_key or '').strip() or os.getenv('GEMINI_API_KEY', '').strip()

    if api_key:
        try:
            result = await call_gemini_vision(optimized_bytes, api_key, mime_type)
            result['requires_api_key'] = False
            return result
        except Exception as e:
            logger.error(f'Gemini Vision failed: {e}')
            fallback = parse_fallback_dummy(optimized_bytes)
            fallback['error_message'] = str(e)
            return fallback

    return parse_fallback_dummy(optimized_bytes)
