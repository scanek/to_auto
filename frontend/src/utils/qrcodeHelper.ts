// QR Code & iCalendar (.ics) export utilities for AutoTracker

export function generateQrUrl(text: string, size: number = 250): string {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=2&format=svg`;
}

export function downloadIcsReminder({
  title,
  carName,
  licensePlate,
  targetDate,
  odometerTarget,
  distanceUnit = 'км',
  oilSpec,
  bookletUrl,
}: {
  title: string;
  carName: string;
  licensePlate?: string;
  targetDate: Date;
  odometerTarget?: number;
  distanceUnit?: string;
  oilSpec?: string;
  bookletUrl?: string;
}) {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  
  const formatDateUtc = (d: Date) => {
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      'Z'
    );
  };

  const start = formatDateUtc(targetDate);
  const end = formatDateUtc(new Date(targetDate.getTime() + 60 * 60 * 1000));
  const now = formatDateUtc(new Date());

  const carLabel = `${carName}${licensePlate ? ` (${licensePlate})` : ''}`;
  const descLines = [
    `🚗 Автомобиль: ${carLabel}`,
    `🔧 Работы: ${title}`,
    odometerTarget ? `🛣️ Рекомендуемый пробег: ${Math.round(odometerTarget).toLocaleString('ru-RU')} ${distanceUnit}` : '',
    oilSpec ? `🛢️ Спецификация масла: ${oilSpec}` : '',
    bookletUrl ? `📱 Электронная сервисная книжка: ${bookletUrl}` : '',
    'Создано сервисом «Бортовой Журнал» (scanek.ru)',
  ].filter(Boolean);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AutoTracker//Бортовой Журнал//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:autotracker-to-${Date.now()}@scanek.ru`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:🚗 ТО: ${title} — ${carLabel}`,
    `DESCRIPTION:${descLines.join('\\n')}`,
    'LOCATION:Автосервис / СТО',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-P7D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Напоминание: через 7 дней плановое ТО (${title}) для ${carLabel}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Завтра плановое ТО: ${title} для ${carLabel}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `to_${carName.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
