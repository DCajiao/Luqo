# Arquitectura del Sistema — Luqo

## Visión general

Luqo es un sistema de tres microservicios dockerizados que digitalizan facturas de papel usando OCR + IA generativa.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Usuario / Navegador                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP :3000
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                      │
│                          puerto 3000                              │
│                                                                   │
│  ┌────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │   Auth.jsx │  │ CameraCapture.jsx│  │   Dashboard.jsx      │  │
│  │ login/reg  │  │ getUserMedia()   │  │   InvoiceDetail.jsx  │  │
│  └────────────┘  └──────────────────┘  └──────────────────────┘  │
│                     axios + JWT interceptor                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP :8000  (proxy vite → backend)
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node + Express)                       │
│                          puerto 8000                              │
│                                                                   │
│  POST /api/auth/register   POST /api/auth/login                  │
│  POST /api/invoices        GET  /api/invoices                    │
│  GET  /api/invoices/:id    GET  /api/invoices/:id/image          │
│  DELETE /api/invoices/:id                                        │
│                                                                   │
│  ┌─────────────────────┐   ┌──────────────────────────────────┐  │
│  │  documentAI.js      │   │         gemini.js                │  │
│  │  extractText()      │──▶│         analyzeInvoice()         │  │
│  │  → texto crudo OCR  │   │  → JSON estructurado + insights  │  │
│  └─────────────────────┘   └──────────────────────────────────┘  │
│         │ GCP API                      │ Gemini API               │
└─────────┼────────────────────────────────────────────────────────┘
          │                             │
          ▼                             │
┌─────────────────────┐                │
│   GCP Document AI   │                │
│   (OCR processor)   │                ▼
└─────────────────────┘   ┌────────────────────────┐
                          │   Gemini 3.1 Pro        │
                          │   (gemini-3.1-pro-preview)│
                          └────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   DATABASE (PostgreSQL 16)                        │
│                          puerto 5432                             │
│                                                                   │
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
- Apertura de la cámara con `navigator.mediaDevices.getUserMedia()`
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
- Recepción de imágenes con `multer` (límite 10 MB)
- Integración con GCP Document AI para extracción de texto
- Integración con Gemini para análisis e insights
- CRUD de facturas e ítems en la base de datos

### MS3 — Database

| Atributo | Valor |
|---|---|
| Imagen base | `postgres:16-alpine` |
| Puerto expuesto | 5432 |
| Volumen | `postgres-data:/var/lib/postgresql/data` |
| Init script | `definitions/schema.sql` (ejecutado automáticamente al crear el contenedor) |

El schema se aplica una sola vez cuando el volumen está vacío. Para modificar el schema en un contenedor ya iniciado, conectarse con `psql` y ejecutar las sentencias manualmente.

## Red Docker

Los tres servicios comparten la red `luqo-network` (bridge). La comunicación interna usa los nombres de servicio como hostnames:

```
frontend  →  backend   (http://backend:8000)
backend   →  database  (postgresql://luqo:luqo123@database:5432/luqo_db)
```

El `docker-compose.yml` define un `healthcheck` en el servicio `database` para garantizar que PostgreSQL esté listo antes de iniciar el backend (`depends_on: condition: service_healthy`).

## Flujo de autenticación

```
Cliente                    Backend                   DB
  │                           │                       │
  │── POST /api/auth/login ──▶│                       │
  │   { email, password }     │── SELECT user ───────▶│
  │                           │◀─ user row ───────────│
  │                           │   bcrypt.compare()    │
  │◀── { token, user } ───────│   jwt.sign()          │
  │                           │                       │
  │── GET /api/invoices ──────│                       │
  │   Authorization: Bearer…  │                       │
  │                           │   jwt.verify()        │
  │                           │── SELECT invoices ───▶│
  │◀── { invoices: [...] } ───│◀─ rows ───────────────│
```

## Flujo de procesamiento de una factura

```
Cliente          Backend         Document AI        Gemini           DB
  │                 │                 │                │              │
  │─ POST /invoice ▶│                 │                │              │
  │  (imagen)       │── INSERT ──────────────────────────────────────▶│
  │                 │   status=processing              │              │
  │                 │                 │                │              │
  │                 │── processDoc ──▶│                │              │
  │                 │◀── raw text ────│                │              │
  │                 │   (valida > 10 chars)            │              │
  │                 │                 │                │              │
  │                 │─────────────────────── prompt ──▶│              │
  │                 │◀─────────────────────── JSON ────│              │
  │                 │   { structured, insights }       │              │
  │                 │                 │                │              │
  │                 │── UPDATE invoice ──────────────────────────────▶│
  │                 │── INSERT items ─────────────────────────────────▶│
  │                 │                 │                │              │
  │◀── 201 { invoice, items } ────────────────────────────────────────│
```
