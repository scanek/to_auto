import datetime
from app.models.vehicle import Vehicle
from app.models.service import ServiceRecord
from app.models.tyre import TyreSet

def parse_dot_age(dot_code: str):
    if not dot_code:
        return None
    # Strip any non-digits
    digits = ''.join(c for c in dot_code if c.isdigit())
    if len(digits) == 4:
        try:
            week = int(digits[:2])
            year_suffix = int(digits[2:])
            full_year = 2000 + year_suffix if year_suffix < 80 else 1900 + year_suffix
            now = datetime.datetime.utcnow()
            approx_date = datetime.datetime(full_year, 1, 1) + datetime.timedelta(weeks=max(1, min(week, 52)) - 1)
            age_years = (now - approx_date).days / 365.25
            if age_years < 3.0:
                status = "fresh"
                label = f"{week:02d}/{year_suffix:02d} (Свежая, {age_years:.1f} г.)"
                color = "#166534"
                bg = "#dcfce7"
            elif age_years < 5.0:
                status = "normal"
                label = f"{week:02d}/{year_suffix:02d} (Норма, {age_years:.1f} г.)"
                color = "#854d0e"
                bg = "#fef9c3"
            elif age_years < 7.0:
                status = "attention"
                label = f"{week:02d}/{year_suffix:02d} (Внимание, {age_years:.1f} г.)"
                color = "#c2410c"
                bg = "#ffedd5"
            else:
                status = "critical"
                label = f"{week:02d}/{year_suffix:02d} (Старая > 7 лет!)"
                color = "#991b1b"
                bg = "#fee2e2"
            return {"week": week, "year": full_year, "age_years": age_years, "status": status, "label": label, "color": color, "bg": bg}
        except Exception:
            return None
    return None

def generate_service_booklet_html(
    vehicle: Vehicle,
    records: list[ServiceRecord],
    tyres: list[TyreSet] = None,
    consumables: list = None,
    hide_costs: bool = False
) -> str:
    """
    Generates a print-ready, professional HTML Service Booklet (Сервисная книжка).
    Includes vehicle specifications, seasonal tyre sets, consumables passport, and chronological maintenance history.
    """
    date_str = datetime.datetime.utcnow().strftime("%d.%m.%Y")
    
    drive_names = {
        "fwd": "Передний (FWD)",
        "awd": "Полный (AWD / 4WD)",
        "rwd": "Задний (RWD)",
    }
    drive_type_display = drive_names.get((vehicle.drive_type or "fwd").lower(), vehicle.drive_type or "Передний (FWD)")

    # -------------------------------------------------------------
    # 1. Service Records Table
    # -------------------------------------------------------------
    table_rows = ""
    total_cost_all = 0.0

    for idx, r in enumerate(records, 1):
        r_date = r.date.strftime("%d.%m.%Y") if r.date else "-"
        r_cost = f"{r.total_cost:,.2f} {vehicle.currency}".replace(",", " ") if r.total_cost else f"0.00 {vehicle.currency}"
        total_cost_all += r.total_cost or 0.0

        type_badge = {
            "service": '<span class="badge badge-service">ТО</span>',
            "repair": '<span class="badge badge-repair">Ремонт</span>',
            "upgrade": '<span class="badge badge-upgrade">Тюнинг</span>'
        }.get(r.record_type, '<span class="badge">ТО</span>')

        tag_badge = f'<span class="badge badge-tag">{r.to_tag}</span> ' if r.to_tag else ''

        items_html = ""
        if r.items:
            items_list = []
            for it in r.items:
                store_info = f" • {it.store}" if it.store else ""
                art_info = f" [арт: {it.part_number}]" if it.part_number else ""
                brand_info = f" ({it.brand})" if it.brand else ""
                unit_str = it.unit or "шт"
                if not hide_costs:
                    price_str = f" — {it.quantity} {unit_str} × {it.unit_price:,.0f} {vehicle.currency}".replace(",", " ") if (it.quantity and it.quantity > 1 and it.unit_price) else f" — {it.total_price:,.0f} {vehicle.currency}".replace(",", " ") if it.total_price else ""
                else:
                    qty_str = f" ({it.quantity} {unit_str})" if it.quantity and it.quantity > 1 else ""
                    price_str = qty_str
                items_list.append(
                    f"• <strong>{it.name}</strong>{brand_info}{art_info}{store_info}{price_str}"
                )
            items_html = f'<div class="items-list">{"<br>".join(items_list)}</div>'

        notes_html = f'<div class="record-notes">{r.notes or r.description}</div>' if (r.notes or r.description) else ''

        cost_td = f'<td class="text-right font-bold">{r_cost}</td>' if not hide_costs else ''

        table_rows += f"""
        <tr>
            <td class="text-center">{idx}</td>
            <td class="text-center">{r_date}</td>
            <td class="text-center">
                <strong>{int(r.odometer):,} {vehicle.distance_unit}</strong>
                {f'<div style="font-size:10px; color:#718096;">{int(r.engine_hours)} м/ч</div>' if r.engine_hours else ''}
            </td>
            <td>{type_badge}</td>
            <td>
                <div class="record-title">{tag_badge}{r.title}</div>
                {items_html}
                {notes_html}
            </td>
            {cost_td}
        </tr>
        """

    formatted_total_cost = f"{total_cost_all:,.2f} {vehicle.currency}".replace(",", " ")

    # -------------------------------------------------------------
    # 2. Tyres & Wheels Section
    # -------------------------------------------------------------
    tyres_html = ""
    if tyres and len(tyres) > 0:
        tyre_cards = ""
        for t in tyres:
            season_badge = (
                '<span class="badge badge-summer">☀️ Летний</span>'
                if t.season == 'summer'
                else '<span class="badge badge-winter">❄️ Зимний</span>'
            )
            active_badge = (
                '<span class="badge badge-active">Установлен на авто</span>'
                if t.is_active
                else '<span class="badge" style="background:#edf2f7; color:#718096;">На хранении</span>'
            )
            active_class = " active" if t.is_active else ""

            # Tyre purchase & DOT info
            t_purchase_parts = []
            if t.purchase_date:
                t_pdate = t.purchase_date.strftime("%d.%m.%Y") if hasattr(t.purchase_date, "strftime") else str(t.purchase_date)[:10]
                t_purchase_parts.append(f"Куплены: <strong>{t_pdate}</strong>")
            if t.dot_code:
                dot_info = parse_dot_age(t.dot_code)
                if dot_info:
                    t_purchase_parts.append(f'DOT: <strong style="background:{dot_info["bg"]}; color:{dot_info["color"]}; padding:1px 4px; border-radius:3px;">{dot_info["label"]}</strong>')
                else:
                    t_purchase_parts.append(f"DOT: <strong>{t.dot_code}</strong>")
            t_purchase_line = f"<div>{' • '.join(t_purchase_parts)}</div>" if t_purchase_parts else ""

            # Tyre pricing
            tyre_price_str = ""
            if not hide_costs and t.total_price and t.total_price > 0:
                qty_txt = f"{int(t.quantity)} шт." if t.quantity else "4 шт."
                tyre_price_str = f"<div>Стоимость шин: <strong>{t.total_price:,.0f} {vehicle.currency}</strong> ({qty_txt})</div>".replace(",", " ")

            # TPMS sensor detail
            tpms_details = []
            if t.tpms_sensors:
                tpms_details.append(f"Датчики: {t.tpms_sensors}")
            if t.tpms_frequency:
                tpms_details.append(f"Частота: {t.tpms_frequency}")
            if t.tpms_pressure_bar:
                tpms_details.append(f"Давление: {t.tpms_pressure_bar} bar")
            tpms_info_str = f"<div>🎛️ <strong>TPMS:</strong> {' • '.join(tpms_details)}</div>" if tpms_details else ""

            # Wheel rotation info
            rot_info_str = ""
            if t.last_rotation_km:
                rot_info_str = f"<div>🔄 <strong>Ротация колес:</strong> на пробеге {int(t.last_rotation_km):,} {vehicle.distance_unit} (интервал {int(t.rotation_interval_km or 10000):,} км)</div>".replace(",", " ")

            # Rims info
            if t.has_separate_rims:
                r_model = t.rims_brand_model or "Отдельные диски"
                r_size = f" ({t.rims_size})" if t.rims_size else ""
                r_date = f", куплены {t.rims_purchase_date.strftime('%d.%m.%Y')}" if (t.rims_purchase_date and hasattr(t.rims_purchase_date, "strftime")) else ""
                r_price = f" — {t.rims_price:,.0f} {vehicle.currency}".replace(",", " ") if (not hide_costs and t.rims_price and t.rims_price > 0) else ""
                rims_line = f'<div style="grid-column: span 2; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1; color: #92400e;">🔘 <strong>Диски:</strong> {r_model}{r_size}{r_date}{r_price}</div>'
            else:
                rims_model = t.rims_brand_model if t.rims_brand_model else "Штатные / заводские диски"
                rims_size = f" ({t.rims_size})" if t.rims_size else ""
                rims_line = f'<div style="grid-column: span 2; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e2e8f0; color: #475569;">🔘 <strong>Диски:</strong> {rims_model}{rims_size}</div>'

            total_set_cost = (t.total_price or 0.0) + (t.rims_price or 0.0 if t.has_separate_rims else 0.0)
            total_cost_line = f'<div style="grid-column: span 2; font-weight: 700; color: #0284c7; margin-top: 2px;">💰 Итого за комплект: {total_set_cost:,.0f} {vehicle.currency}</div>'.replace(",", " ") if (not hide_costs and total_set_cost > 0) else ""

            tyre_brand_display = t.brand_model if t.brand_model else "Шины"
            tyre_size_display = f" ({t.size})" if t.size else ""

            tyre_cards += f"""
            <div class="tyre-card{active_class}">
                <div class="tyre-header">
                    <div class="tyre-name">{t.name}</div>
                    <div>{season_badge} {active_badge}</div>
                </div>
                <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-top: 2px;">
                    🛞 {tyre_brand_display}{tyre_size_display}
                </div>
                <div class="tyre-details">
                    <div>Пробег на резине: <strong>{int(t.current_km or 0):,} км</strong></div>
                    <div>Остаток протектора: <strong>{t.tread_depth_mm or 0} мм</strong></div>
                    {t_purchase_line}
                    {rot_info_str}
                    {tpms_info_str}
                    {tyre_price_str}
                    {f'<div>Хранение: <em>{t.storage_location}</em></div>' if t.storage_location else ''}
                    {rims_line}
                    {total_cost_line}
                </div>
            </div>
            """

        tyres_html = f"""
        <div class="section-title">Комплекты шин и колес</div>
        <div class="tyres-grid">
            {tyre_cards}
        </div>
        """

    # -------------------------------------------------------------
    # 3. Consumables Passport Section
    # -------------------------------------------------------------
    consumables_html = ""
    if consumables and len(consumables) > 0:
        cat_names = {
            "engine": "Двигатель и масло",
            "filters": "Фильтры",
            "transmission": "Трансмиссия и КПП",
            "brakes": "Тормозная система",
            "cooling": "Охлаждение",
            "electrical": "Электрика и свечи",
            "wipers": "Стеклоочистители",
            "other": "Прочее",
        }
        cons_rows = ""
        for c in consumables:
            cat_label = cat_names.get(c.category, c.category)
            oem_str = f"<code>{c.oem_part_number}</code>" if c.oem_part_number else "—"
            after_str = f"<small>{c.aftermarket_parts}</small>" if c.aftermarket_parts else "—"
            cons_rows += f"""
            <tr>
                <td><span class="badge badge-tag">{cat_label}</span></td>
                <td><strong>{c.name}</strong></td>
                <td>{c.specification or '—'}</td>
                <td>{oem_str}</td>
                <td>{after_str}</td>
                <td><small>{c.replacement_interval or '—'}</small></td>
            </tr>
            """

        consumables_html = f"""
        <div class="section-title">Паспорт расходных материалов и спецификаций</div>
        <table>
            <thead>
                <tr>
                    <th style="width: 110px;">Категория</th>
                    <th>Наименование</th>
                    <th>Спецификация / Объем</th>
                    <th style="width: 110px;">OEM Артикул</th>
                    <th>Аналоги / Заменители</th>
                    <th style="width: 140px;">Регламент замены</th>
                </tr>
            </thead>
            <tbody>
                {cons_rows}
            </tbody>
        </table>
        """

    purchase_info = "—"
    if vehicle.purchase_date:
        p_date = vehicle.purchase_date.strftime("%d.%m.%Y") if hasattr(vehicle.purchase_date, "strftime") else str(vehicle.purchase_date)[:10]
        p_odo = f" (с {int(vehicle.starting_odometer or 0):,} {vehicle.distance_unit})" if vehicle.starting_odometer is not None else ""
        purchase_info = f"{p_date}{p_odo}".replace(",", " ")
    elif vehicle.starting_odometer:
        purchase_info = f"С {int(vehicle.starting_odometer):,} {vehicle.distance_unit}".replace(",", " ")

    telematics_badge = ""
    if vehicle.telematics_provider in ("starline", "can_obd", "webhook") and vehicle.starline_last_sync:
        sync_txt = vehicle.starline_last_sync.strftime("%d.%m.%Y %H:%M")
        telematics_badge = f'<div style="grid-column: span 3; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 6px 12px; font-size: 11px; color: #065f46; font-weight: 600; display: flex; align-items: center; gap: 8px;">🛡️ <strong>Пробег верифицирован телематикой CAN / OBD StarLine</strong> • Последняя синхронизация: {sync_txt}</div>'

    cost_th = '<th style="width: 105px;" class="text-right">Стоимость</th>' if not hide_costs else ''
    total_summary_html = (
        f'<span>Итого затраты на обслуживание: {formatted_total_cost}</span>'
        if not hide_costs
        else '<span>Финансовые затраты: скрыты владельцем автомобиля</span>'
    )

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Сервисная книжка - {vehicle.make} {vehicle.model} ({vehicle.license_plate or ''})</title>
    <style>
        @page {{
            size: A4;
            margin: 12mm;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1a202c;
            line-height: 1.5;
            background: #fff;
            margin: 0;
            padding: 15px;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 10px;
            margin-bottom: 16px;
        }}
        .logo-title {{
            font-size: 22px;
            font-weight: 800;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .header-meta {{
            font-size: 12px;
            color: #718096;
            text-align: right;
        }}
        .vehicle-card {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }}
        .vehicle-card .item {{
            display: flex;
            flex-direction: column;
        }}
        .vehicle-card .label {{
            font-size: 10px;
            text-transform: uppercase;
            color: #718096;
            font-weight: 700;
            margin-bottom: 2px;
        }}
        .vehicle-card .value {{
            font-size: 13px;
            font-weight: 700;
            color: #1e293b;
        }}
        .section-title {{
            font-size: 13px;
            font-weight: 800;
            color: #0369a1;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 16px;
            margin-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
        }}
        .tyres-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 16px;
        }}
        .tyre-card {{
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 11px;
        }}
        .tyre-card.active {{
            border-color: #0284c7;
            background: #f0f9ff;
        }}
        .tyre-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }}
        .tyre-name {{
            font-weight: 700;
            color: #0f172a;
            font-size: 12px;
        }}
        .tyre-details {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 4px;
            margin-top: 6px;
            font-size: 11px;
            color: #475569;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 16px;
        }}
        th {{
            background: #0284c7;
            color: white;
            padding: 7px 9px;
            text-align: left;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
        }}
        td {{
            padding: 7px 9px;
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
            padding: 1.5px 5px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
        }}
        .badge-service {{ background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }}
        .badge-repair {{ background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }}
        .badge-upgrade {{ background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }}
        .badge-tag {{ background: #0f172a; color: #fff; }}
        .badge-active {{ background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }}
        .badge-summer {{ background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }}
        .badge-winter {{ background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; }}
        .record-title {{ font-weight: 700; font-size: 12px; color: #0f172a; }}
        .items-list {{ margin-top: 3px; font-size: 10.5px; color: #334155; line-height: 1.4; }}
        .record-notes {{ margin-top: 3px; font-size: 10.5px; color: #64748b; font-style: italic; }}
        .total-summary {{
            background: #f1f5f9;
            padding: 10px 14px;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
        }}
        .no-print {{
            margin-bottom: 12px;
            display: flex;
            gap: 10px;
        }}
        .btn-print {{
            background: #0284c7;
            color: white;
            padding: 7px 14px;
            border: none;
            border-radius: 6px;
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        code {{
            background: #f1f5f9;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
            color: #0369a1;
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
            <div style="font-size: 12px; color: #64748b;">Журнал технического обслуживания, спецификаций и оснащения</div>
        </div>
        <div class="header-meta">
            Сформировано: {date_str}<br>
            Система: Бортовой Журнал
        </div>
    </div>

    <div class="vehicle-card">
        <div class="item">
            <span class="label">Автомобиль</span>
            <span class="value">{vehicle.make} {vehicle.model} {f'({vehicle.year} г.)' if vehicle.year else ''}</span>
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
            <span class="label">Привод</span>
            <span class="value">{drive_type_display}</span>
        </div>
        <div class="item">
            <span class="label">Текущий пробег</span>
            <span class="value">{int(vehicle.current_odometer):,} {vehicle.distance_unit}</span>
        </div>
        <div class="item">
            <span class="label">Двигатель / Моточасы</span>
            <span class="value">{vehicle.engine or '—'}{f' • {int(vehicle.current_engine_hours)} м/ч' if vehicle.current_engine_hours else ''}</span>
        </div>
        <div class="item">
            <span class="label">Ввод в эксплуатацию</span>
            <span class="value">{purchase_info}</span>
        </div>
        <div class="item" style="grid-column: span 2;">
            <span class="label">Спецификация масла</span>
            <span class="value">{vehicle.oil_spec or '—'}</span>
        </div>
        {telematics_badge}
    </div>

    {consumables_html}

    {tyres_html}

    <div class="section-title">Хронологический журнал обслуживания и ремонтов</div>
    <table>
        <thead>
            <tr>
                <th style="width: 35px;" class="text-center">№</th>
                <th style="width: 80px;" class="text-center">Дата</th>
                <th style="width: 100px;" class="text-center">Пробег</th>
                <th style="width: 65px;">Тип</th>
                <th>Выполненные работы, детали и артикулы</th>
                {cost_th}
            </tr>
        </thead>
        <tbody>
            {table_rows or '<tr><td colspan="6" class="text-center" style="padding: 20px;">Нет записей об обслуживании</td></tr>'}
        </tbody>
    </table>

    <div class="total-summary">
        <span>Всего записей ТО: {len(records)}</span>
        {total_summary_html}
    </div>
</body>
</html>
"""
    return html
