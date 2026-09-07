# ☸️ Helm Chart для Бортового Журнала (AutoTracker)

Официальный Helm-чарт для развертывания **Бортового Журнала** в кластерах **Kubernetes / k3s / MicroK8s / TrueNAS SCALE**.

---

## 🚀 Быстрый старт

### 1. Установка чарта

```bash
# Клонируйте репозиторий
git clone https://github.com/scanek/to_auto.git
cd to_auto

# Установите чарт в Kubernetes
helm install autotracker ./deploy/helm/autotracker
```

### 2. Установка с собственным доменом (Ingress)

Создайте файл `my-values.yaml`:

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: auto.my-domain.ru
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: autotracker-tls
      hosts:
        - auto.my-domain.ru

env:
  SECRET_KEY: "укажите-свой-случайный-длинный-секретный-ключ"

persistence:
  size: 10Gi
  storageClass: "local-path" # или ваш StorageClass (ceph, nfs, longhorn)
```

И выполните установку:

```bash
helm install autotracker ./deploy/helm/autotracker -f my-values.yaml
```

---

## ⚙️ Основные параметры конфигурации

| Параметр | Описание | По умолчанию |
|---|---|---|
| `image.repository` | Docker-образ приложения | `scanek/autotracker` |
| `image.tag` | Версия образа | `3.5.0` |
| `replicaCount` | Количество реплик | `1` *(рекомендуется 1 из-за SQLite)* |
| `persistence.enabled` | Использовать Persistent Volume Claim | `true` |
| `persistence.size` | Размер хранилища (БД + фото чеков) | `10Gi` |
| `persistence.storageClass` | StorageClass кластера | `""` (default) |
| `service.type` | Тип Kubernetes сервиса | `ClusterIP` |
| `service.port` | Внутренний порт сервиса | `80` |
| `ingress.enabled` | Включить внешний доступ через Ingress | `false` |
| `env.SECRET_KEY` | Секретный ключ подписи токенов JWT | рандомный ключ |

---

## 🔄 Обновление

```bash
helm upgrade autotracker ./deploy/helm/autotracker -f my-values.yaml
```

## 🗑️ Удаление

```bash
helm uninstall autotracker
```
