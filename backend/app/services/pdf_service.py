import datetime
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord
from app.models.fuel import FuelLog

def generate_service_booklet_html(vehicle: Vehicle, records: list[ServiceRecord]) -> str:
    """
    Generates a print-ready, professional HTML Service Booklet (Сервисная книжка).
    """
    date_str = datetime.datetime.utcnow().strftime("%d.%m.%Y")
    
    table_rows = ""
    total_cost_all = 0.0

    for idx, r in enumerate(records, 1):
        r_date = r.date.strftime("%d.%m.%Y") if r.date else "-"
        r_cost = f"{r.total_cost:,.2f} {vehicle.currency}".replace(",", " ")
        total_cost_all += r.total_cost or 0.0

        type_badge = {
            "service": '<span class="badge badge-service">ТО</span>',
            "repair": '<span class="badge badge-repair">Ремонт</span>',
            "upgrade": '<span class="badge badge-upgrade">Тюнинг</span>'
        }.get(r.record_type, '<span class="badge">ТО</span>')

        items_html = ""
        if r.items:
            items_list = [f"• {it.name} ({it.quantity} шт. × {it.unit_price} {vehicle.currency})" for it in r.items]
            items_html = f'<div class="items-list">{"<br>".join(items_list)}</div>'

        notes_html = f'<div class="record-notes">{r.notes}</div>' if r.notes else ''

        table_rows += f"""
        <tr>
            <td class="text-center">{idx}</td>
            <td class="text-center">{r_date}</td>
            <td class="text-center"><strong>{int(r.odometer):,} {vehicle.distance_unit}</strong></td>
            <td>{type_badge}</td>
            <td>
                <div class="record-title">{r.title}</div>
                {items_html}
                {notes_html}
            </td>
            <td class="text-right font-bold">{r_cost}</td>
        </tr>
        """

    formatted_total_cost = f"{total_cost_all:,.2f} {vehicle.currency}".replace(",", " ")

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Сервисная книжка - {vehicle.make} {vehicle.model} ({vehicle.license_plate or ''})</title>
    <style>
        @page {{
            size: A4;
            margin: 15mm;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1a202c;
            line-height: 1.5;
            background: #fff;
            margin: 0;
            padding: 20px;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #2b6cb0;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }}
        .logo-title {{
            font-size: 24px;
            font-weight: 800;
            color: #2b6cb0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .header-meta {{
            font-size: 13px;
            color: #718096;
            text-align: right;
        }}
        .vehicle-card {{
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
        }}
        .vehicle-card .item {{
            display: flex;
            flex-direction: column;
        }}
        .vehicle-card .label {{
            font-size: 11px;
            text-transform: uppercase;
            color: #718096;
            font-weight: 600;
            margin-bottom: 2px;
        }}
        .vehicle-card .value {{
            font-size: 14px;
            font-weight: 700;
            color: #2d3748;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 24px;
        }}
        th {{
            background: #2b6cb0;
            color: white;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
        }}
        td {{
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
        }}
        tr:nth-child(even) {{
            background-color: #f8fafc;
        }}
        .text-center {{ text-align: center; }}
        .text-right {{ text-align: right; }}
        .font-bold {{ font-weight: 700; }}
        .badge {{
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }}
        .badge-service {{ background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; }}
        .badge-repair {{ background: #fff5f5; color: #c53030; border: 1px solid #fed7d7; }}
        .badge-upgrade {{ background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }}
        .record-title {{ font-weight: 700; font-size: 13px; color: #1a202c; }}
        .items-list {{ margin-top: 4px; font-size: 11px; color: #4a5568; }}
        .record-notes {{ margin-top: 4px; font-size: 11px; color: #718096; font-style: italic; }}
        .total-summary {{
            background: #edf2f7;
            padding: 12px 16px;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: 700;
        }}
        .no-print {{
            margin-bottom: 15px;
            display: flex;
            gap: 10px;
        }}
        .btn-print {{
            background: #2b6cb0;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-weight: 600;
            cursor: pointer;
        }}
        @media print {{
            .no-print {{ display: none; }}
            body {{ padding: 0; }}
        }}
    </style>
</head>
<body>
    <div class="no-print">
        <button class="btn-print" onclick="window.print()">🖨️ Распечатать / Сохранить в PDF</button>
    </div>

    <div class="header">
        <div>
            <div class="logo-title">Электронная сервисная книжка</div>
            <div style="font-size: 13px; color: #4a5568;">Журнал технического обслуживания и ремонтов</div>
        </div>
        <div class="header-meta">
            Сформировано: {date_str}<br>
            Система: Бортовой Журнал
        </div>
    </div>

    <div class="vehicle-card">
        <div class="item">
            <span class="label">Автомобиль</span>
            <span class="value">{vehicle.make} {vehicle.model} ({vehicle.year or '-'})</span>
        </div>
        <div class="item">
            <span class="label">Госномер</span>
            <span class="value">{vehicle.license_plate or 'Не указан'}</span>
        </div>
        <div class="item">
            <span class="label">VIN номер</span>
            <span class="value">{vehicle.vin or 'Не указан'}</span>
        </div>
        <div class="item">
            <span class="label">Текущий пробег</span>
            <span class="value">{int(vehicle.current_odometer):,} {vehicle.distance_unit}</span>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 40px;" class="text-center">№</th>
                <th style="width: 90px;" class="text-center">Дата</th>
                <th style="width: 110px;" class="text-center">Пробег</th>
                <th style="width: 80px;">Тип</th>
                <th>Выполненные работы и запчасти</th>
                <th style="width: 110px;" class="text-right">Стоимость</th>
            </tr>
        </thead>
        <tbody>
            {table_rows or '<tr><td colspan="6" class="text-center" style="padding: 20px;">Нет записей об обслуживании</td></tr>'}
        </tbody>
    </table>

    <div class="total-summary">
        <span>Всего записей: {len(records)}</span>
        <span>Итого затраты на ТО и ремонт: {formatted_total_cost}</span>
    </div>
</body>
</html>
"""
    return html
