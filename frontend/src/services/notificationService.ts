/**
 * Push Notification Service for Бортовой Журнал
 * Handles Web Notifications, Service Worker push alerts, notification permissions,
 * and smart triggers for upcoming maintenance (ТО) and insurance expiration.
 */

import { Vehicle, MaintenancePlan, DocumentNote } from '../types';

export interface NotificationSettings {
  enabled: boolean;
  notifyDistanceKm: number;
  notifyDays: number;
  notifyHours: number;
  notifyInsurance: boolean;
}

const SETTINGS_KEY = 'bortovoi_notification_settings';
const LAST_NOTIFIED_KEY = 'bortovoi_last_notified_timestamps';

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  notifyDistanceKm: 500,
  notifyDays: 14,
  notifyHours: 20,
  notifyInsurance: true,
};

class NotificationService {
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public areNotificationsEnabled(): boolean {
    return this.getSettings().enabled && this.getPermission() === 'granted';
  }

  public getSettings(): NotificationSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  }

  public saveSettings(settings: NotificationSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      if (granted) {
        const current = this.getSettings();
        this.saveSettings({ ...current, enabled: true });
      }
      return granted;
    } catch (err) {
      console.error('Error requesting notification permission', err);
      return false;
    }
  }

  public async showNotification(title: string, options?: NotificationOptions): Promise<boolean> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return false;
    }

    const defaultOptions: any = {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'bortovoi-maintenance',
      renotify: true,
      ...options,
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, defaultOptions);
          return true;
        }
      }
      // Fallback
      new Notification(title, defaultOptions);
      return true;
    } catch (e) {
      console.error('Failed to trigger notification', e);
      try {
        new Notification(title, defaultOptions);
        return true;
      } catch {
        return false;
      }
    }
  }

  public async sendTestNotification(): Promise<boolean> {
    return this.showNotification('🔔 Бортовой Журнал: Тестовое уведомление', {
      body: 'Уведомления успешно настроены! Вы будете получать напоминания о приближении регламентов ТО и страховок.',
      tag: 'test-notification',
    });
  }

  /**
   * Evaluates maintenance plans and documents for a vehicle and sends push notifications
   * for items that are due soon or overdue, with a 24-hour deduplication throttle.
   */
  public async checkAndNotifyVehicle(
    vehicle: Vehicle,
    reminders: MaintenancePlan[],
    documents?: DocumentNote[]
  ): Promise<number> {
    const settings = this.getSettings();
    if (!settings.enabled || Notification.permission !== 'granted') {
      return 0;
    }

    const lastNotified: Record<string, number> = this.getLastNotified();
    const now = Date.now();
    const THROTTLE_MS = 24 * 60 * 60 * 1000; // 24 hours
    let notificationsSent = 0;

    const carName = `${vehicle.make} ${vehicle.model}`;

    // 1. Check Maintenance Plans (ТО)
    for (const plan of reminders) {
      if (!plan.is_active) continue;

      const isDueSoon =
        plan.status === 'due_soon' ||
        (plan.remaining_distance !== null &&
          plan.remaining_distance !== undefined &&
          plan.remaining_distance <= (plan.notify_before_distance || settings.notifyDistanceKm)) ||
        (plan.remaining_days !== null &&
          plan.remaining_days !== undefined &&
          plan.remaining_days <= (plan.notify_before_days || settings.notifyDays)) ||
        (plan.remaining_hours !== null &&
          plan.remaining_hours !== undefined &&
          plan.remaining_hours <= (plan.notify_before_hours || settings.notifyHours));

      const isOverdue = plan.status === 'overdue';

      if (isDueSoon || isOverdue) {
        const key = `plan_${plan.id}_${isOverdue ? 'overdue' : 'due_soon'}`;
        const lastSent = lastNotified[key] || 0;

        if (now - lastSent > THROTTLE_MS) {
          let detail = '';
          if (plan.remaining_distance !== null && plan.remaining_distance !== undefined) {
            detail += plan.remaining_distance <= 0 ? `Просрочено на ${Math.abs(plan.remaining_distance)} км` : `Осталось ${plan.remaining_distance} км`;
          }
          if (plan.remaining_days !== null && plan.remaining_days !== undefined) {
            const daysText = plan.remaining_days <= 0 ? `просрочено на ${Math.abs(plan.remaining_days)} дн.` : `${plan.remaining_days} дн.`;
            detail += detail ? ` или ${daysText}` : `Осталось ${daysText}`;
          }

          const prefix = isOverdue ? '🚨 Внимание! Просрочено ТО:' : '🔔 Приближается регламент ТО:';
          const title = `${prefix} ${plan.title}`;
          const body = `Автомобиль: ${carName}\n${detail ? `Показатель: ${detail}` : ''}`;

          const ok = await this.showNotification(title, {
            body,
            tag: `reminder-${plan.id}`,
            data: { vehicleId: vehicle.id, planId: plan.id },
          });

          if (ok) {
            lastNotified[key] = now;
            notificationsSent++;
          }
        }
      }
    }

    // 2. Check Documents (ОСАГО, КАСКО, Техосмотр)
    if (settings.notifyInsurance && documents && documents.length > 0) {
      for (const doc of documents) {
        if (!doc.expiration_date) continue;
        const expDate = new Date(doc.expiration_date).getTime();
        const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

        if (daysLeft <= settings.notifyDays) {
          const key = `doc_${doc.id}_expiring`;
          const lastSent = lastNotified[key] || 0;

          if (now - lastSent > THROTTLE_MS) {
            const title = daysLeft <= 0 ? `🚨 Истек срок документа: ${doc.title}` : `📑 Истекает срок: ${doc.title}`;
            const body = `Автомобиль: ${carName}\nОсталось: ${daysLeft <= 0 ? 'Срок истек!' : `${daysLeft} дн.`}`;

            const ok = await this.showNotification(title, {
              body,
              tag: `doc-${doc.id}`,
              data: { vehicleId: vehicle.id, docId: doc.id },
            });

            if (ok) {
              lastNotified[key] = now;
              notificationsSent++;
            }
          }
        }
      }
    }

    this.saveLastNotified(lastNotified);
    return notificationsSent;
  }

  private getLastNotified(): Record<string, number> {
    try {
      const raw = localStorage.getItem(LAST_NOTIFIED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveLastNotified(data: Record<string, number>): void {
    localStorage.setItem(LAST_NOTIFIED_KEY, JSON.stringify(data));
  }
}

export const notificationService = new NotificationService();
