# CLAUDE.md — Guía para Claude Code

## ¿Qué es este proyecto?
Luqo es un sistema de digitalización de facturas de papel usando IA. El usuario toma una foto con la cámara, Document AI extrae el texto crudo, Gemini lo interpreta y guarda los campos estructurados + insights en PostgreSQL.

## Stack
| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite, CSS inline (no Tailwind, no CSS modules) |
| Backend | Node 20 + Express 4, sin TypeScript |
| Base de datos | PostgreSQL 16 |
| OCR | GCP Document AI (processor tipo OCR o Invoice) |
| IA | Gemini `gemini-3.1-pro-preview` vía `@google/generative-ai` |
| Auth | JWT con `jsonwebtoken` + bcryptjs |
| Orquestación | Docker Compose (sin Kubernetes) |

## Estructura de carpetas
```
Luqo/
├── docker-compose.yml
├── .env.example
├── credentials/gcp-key.json       ← gitignored, service account JSON
├── docs/                          ← documentación
└── microservices/
    ├── frontend/                  ← React + Vite (puerto 3000)
    │   └── src/
    │       ├── components/        ← Auth, Dashboard, CameraCapture, InvoiceDetail
    │       └── services/api.js    ← axios client con JWT interceptor
    ├── backend/                   ← Express API (puerto 8000)
    │   └── src/
    │       ├── routes/            ← auth.js, invoices.js
    │       ├── middleware/        ← authenticate.js (JWT guard)
    │       └── services/
    │           ├── documentAI.js  ← extrae texto crudo
    │           └── gemini.js      ← estructura + insights
    └── database/                  ← PostgreSQL 16
        └── definitions/schema.sql
```

## Flujo principal (upload de factura)
1. Frontend envía `multipart/form-data` con campo `invoice` a `POST /api/invoices`
2. Backend crea registro en DB con `status = 'processing'`
3. `documentAI.js` → envía imagen a GCP → devuelve texto crudo (lanza error si < 10 chars)
4. `gemini.js` → envía texto a Gemini con prompt estructurado → devuelve JSON con campos + insights
5. Backend guarda los campos en `invoices` y los ítems en `invoice_items`
6. Responde con el objeto completo

## Variables de entorno requeridas
```
JWT_SECRET
GCP_PROJECT_ID
GCP_LOCATION          (default: us)
DOCUMENT_AI_PROCESSOR_ID
GEMINI_API_KEY
DATABASE_URL          (seteado automáticamente por docker-compose)
```

## Comandos útiles
```bash
# Levantar todo
docker-compose up --build

# Reiniciar solo el backend (tras cambios de código)
docker-compose restart backend

# Ver logs en tiempo real
docker-compose logs -f backend

# Conectarse a la base de datos
docker-compose exec database psql -U luqo -d luqo_db
```

## Decisiones de diseño importantes
- **Document AI solo extrae texto crudo** — no se mapean campos desde las entidades de Document AI porque la calidad es inconsistente. Gemini hace la interpretación.
- **Gemini devuelve un JSON** con `structured` + `insights` en una sola llamada. El prompt le pide que no use markdown en la respuesta para poder hacer `JSON.parse()` directamente.
- **Imagen accesible vía query param** — `GET /api/invoices/:id/image?token=<jwt>` porque los tags `<img src>` no pueden enviar headers Authorization.
- **Sin TypeScript** — el proyecto usa JavaScript puro para mantener la barrera de entrada baja.
- **CSS inline en React** — los estilos están definidos como objetos JS dentro de cada componente, sin librerías de UI externas.

## Qué NO hacer
- No cambiar el modelo de Gemini sin consultar — el modelo activo es `gemini-3.1-pro-preview`
- No intentar parsear los campos estructurados de Document AI — esa lógica fue removida intencionalmente
- No agregar librerías de UI (no MUI, no shadcn, no Chakra) — el proyecto usa CSS propio
- No modificar el schema de la DB sin migración manual en el contenedor
