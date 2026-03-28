# Arquitectura del Sistema — Luqo

## Visión general

Luqo es un sistema de **cuatro microservicios** dockerizados que digitalizan facturas de papel usando OCR + IA generativa.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Usuario / Navegador                      │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP :3000
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                     │
│                          puerto 3000                             │
│                                                                  │
│  ┌────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   Auth.jsx │  │ CameraCapture.jsx│  │   Dashboard.jsx      │  │
│  │ login/reg  │  │ getUserMedia()   │  │   InvoiceDetail.jsx  │  │
│  └────────────┘  └──────────────────┘  └──────────────────────┘  │
│                     axios + JWT interceptor                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTP :8000  (proxy vite → backend)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node + Express)                      │
│                          puerto 8000                             │
│                                                                  │
│  POST /api/auth/register   POST /api/auth/login                  │
│  POST /api/invoices        GET  /api/invoices                    │
│  GET  /api/invoices/:id    GET  /api/invoices/:id/image          │
│  DELETE /api/invoices/:id                                        │
│                                                                  │
│  ┌─────────────────────┐   ┌──────────────────────────────────┐  │
│  │  documentAI.js      │   │         gemini.js                │  │
│  │  extractText()      │──▶│         analyzeInvoice()         │  │
│  │  → texto crudo OCR  │   │  → JSON estructurado + insights  │  │
│  └─────────────────────┘   └──────────────────────────────────┘  │
│         │ GCP API                      │ Gemini API              │
│                                                                  │
│  ┌──────────────────────┐                                        │
│  │  dbClient.js         │  fetch() nativo Node 20                │
│  │  HTTP → db-service   │                                        │
│  └──────────┬───────────┘                                        │
└─────────────┼────────────────────────────────────────────────────┘
              │              │
              ▼              ▼
┌─────────────────────┐   ┌─────────────────────────┐
│   GCP Document AI   │   │   Gemini 3.1 Pro        │
│   (OCR processor)   │   │ (gemini-3.1-pro-preview)│
└─────────────────────┘   └─────────────────────────┘

              │ HTTP :3001 (red interna, sin puerto externo)
              ▼
┌──────────────────────────────────────────────────────────────────┐
│                  DB-SERVICE (Node + Express)                     │
│                    puerto 3001  — solo red interna               │
│                                                                  │
│  POST   /users              GET  /users/by-email/:email          │
│  POST   /invoices           GET  /invoices?user_id=              │
│  PATCH  /invoices/:id       GET  /invoices/:id?user_id=          │
│  PATCH  /invoices/:id/status                                     │
│  DELETE /invoices/:id?user_id=                                   │
│  POST   /invoices/items/bulk                                     │
│  GET    /invoices/items/:invoice_id                              │
└──────────────────────────────┬───────────────────────────────────┘
                               │ pg Pool  (postgresql://...)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                   DATABASE (PostgreSQL 16)                       │
│                          puerto 5432                             │
│                                                                  │
│     users ──── invoices ──── invoice_items                       │
└──────────────────────────────────────────────────────────────────┘
```

## Microservicios

### MS1 — Frontend

| Atributo | Valor |
|---|---|
| Imagen base | `node:20-alpine` |
| Framework | React 18 + Vite 5 |
| Puerto expuesto | 3000 |
| Volumen | `./microservices/frontend/src:/app/src` (hot reload) |

El frontend se sirve con el dev server de Vite en modo desarrollo. Vite tiene configurado un proxy que redirige `/api/*` al backend en `http://backend:8000`, eliminando problemas de CORS.

**Responsabilidades:**
- Autenticación (login / registro) con JWT almacenado en `localStorage`
- Apertura de cámara con `navigator.mediaDevices.getUserMedia()` o selección de archivo desde disco
- Captura de foto y envío como `multipart/form-data`
- Visualización del listado y detalle de facturas procesadas

### MS2 — Backend

| Atributo | Valor |
|---|---|
| Imagen base | `node:20-alpine` |
| Framework | Express 4 |
| Puerto expuesto | 8000 |
| Volumen | `uploads-data:/app/uploads` (imágenes persistentes) |
| Credenciales GCP | `./credentials:/app/credentials:ro` |

**Responsabilidades:**
- Gestión de JWT (emisión en login/registro, verificación en cada request protegido)
- Recepción de imágenes con `multer` (límite 10 MB, formatos: JPEG, PNG, WebP)
- Integración con GCP Document AI para extracción de texto
- Integración con Gemini para análisis e insights
- Orquestación del flujo de procesamiento — delega todas las operaciones de datos al `db-service` vía HTTP (`dbClient.js`)

El backend **no tiene acceso directo a PostgreSQL**. Toda operación de datos pasa por el `db-service`.

### MS3 — DB Service

| Atributo | Valor |
|---|---|
| Imagen base | `node:20-alpine` |
| Framework | Express 4 |
| Puerto interno | 3001 (sin mapeo externo) |
| Variables de entorno | `DATABASE_URL` |

**Responsabilidades:**
- Única capa con acceso a PostgreSQL (pool de conexiones con `pg`)
- Expone una API REST interna para operaciones CRUD de `users`, `invoices` e `invoice_items`
- Todas las queries usan parámetros posicionales (`$1`, `$2`) — sin interpolación de strings
- Healthcheck propio: `GET /health` (verificado por Docker antes de iniciar el backend)

El `db-service` no tiene lógica de negocio ni validación de sesión — es una capa de datos pura. La autorización y la lógica residen en el backend.

### MS4 — Database

| Atributo | Valor |
|---|---|
| Imagen base | `postgres:16-alpine` |
| Puerto expuesto | 5432 |
| Volumen | `postgres-data:/var/lib/postgresql/data` |
| Init script | `definitions/schema.sql` (ejecutado automáticamente al crear el contenedor) |

El schema se aplica una sola vez cuando el volumen está vacío. Para modificar el schema en un contenedor ya iniciado, conectarse con `psql` y ejecutar las sentencias manualmente.

## Red Docker

Los cuatro servicios comparten la red `luqo-network` (bridge). La comunicación interna usa los nombres de servicio como hostnames:

```
frontend   →  backend     (http://backend:8000)
backend    →  db-service  (http://db-service:3001)
db-service →  database    (postgresql://luqo:luqo123@database:5432/luqo_db)
```

El `db-service` no tiene puerto mapeado al host — solo es accesible dentro de la red Docker.

### Cadena de arranque y healthchecks

```
database (healthcheck: pg_isready)
    ↓ service_healthy
db-service (healthcheck: GET /health)
    ↓ service_healthy
backend
    ↓ depends_on
frontend
```

## Flujo de autenticación

```
Cliente                  Backend              DB-Service             DB
  │                          │                     │                   │
  │── POST /api/auth/login ─▶│                     │                   │
  │   { email, password }    │── GET /users/──────▶│                   │
  │                          │   by-email/:email   │── SELECT user ───▶│
  │                          │                     │◀─ user row ───────│
  │                          │◀─ { user + hash } ──│                   │
  │                          │   bcrypt.compare()  │                   │
  │                          │   jwt.sign()        │                   │
  │◀── { token, user } ──────│                     │                   │
  │                          │                     │                   │
  │── GET /api/invoices ────▶│                     │                   │
  │   Authorization: Bearer… │── GET /invoices? ──▶│                   │
  │                          │   user_id=…         │── SELECT ────────▶│
  │                          │                     │◀─ rows ───────────│
  │◀── { invoices: [...] } ──│◀─ [ invoices ] ─────│                   │
```

## Flujo de procesamiento de una factura

```
Cliente         Backend        Doc AI      Gemini     DB-Service       DB
  │                │               │           │           │            │
  │─ POST /invoice▶│               │           │           │            │
  │  (imagen)      │── POST /invoices ────────────────────▶│            │
  │                │   { user_id, image_path } │           │── INSERT ─▶│
  │                │◀──────────────────────────────────────│  status=   │
  │                │   { id }                  │           │  processing│
  │                │               │           │           │            │
  │                │── processDoc ▶│           │           │            │
  │                │◀── raw text ──│           │           │            │
  │                │   (valida > 10 chars)     │           │            │
  │                │               │           │           │            │
  │                │─────────────────── prompt▶│           │            │
  │                │◀────────────────── JSON ──│           │            │
  │                │  { structured, insights } │           │            │
  │                │               │           │           │            │
  │                │── PATCH /invoices/:id ───────────────▶│            │
  │                │   (campos estructurados)  │           │── UPDATE ─▶│
  │                │◀──────────────────────────────────────│            │
  │                │── POST /invoices/items/bulk ─────────▶│            │
  │                │◀──────────────────────────────────────│── INSERT ─▶│
  │                │               │           │           │            │
  │◀── 201 { invoice, items } ──────────────────────────────────────────│
```
