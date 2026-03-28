# Base de datos — Luqo

## Motor

PostgreSQL 16 (Alpine). El schema se inicializa automáticamente desde `microservices/database/definitions/schema.sql` cuando el contenedor arranca con el volumen vacío.

## Acceso

**La base de datos solo es accesible desde el `db-service`.** El backend no tiene `DATABASE_URL` ni depencia directa con `pg` — toda operación de datos pasa por la API REST interna del `db-service` (`http://db-service:3001`).

```
backend  →  db-service (:3001)  →  database (:5432)
```

## Diagrama ER

```
┌─────────────────────────────┐
│           users             │
├─────────────────────────────┤
│ id          UUID  PK        │
│ email       VARCHAR UNIQUE  │
│ password    VARCHAR         │
│ name        VARCHAR         │
│ created_at  TIMESTAMPTZ     │
│ updated_at  TIMESTAMPTZ     │
└──────────────┬──────────────┘
               │ 1
               │
               │ N
┌──────────────▼──────────────────────────────────────────────┐
│                         invoices                             │
├──────────────────────────────────────────────────────────────┤
│ id               UUID  PK                                    │
│ user_id          UUID  FK → users.id  (CASCADE DELETE)       │
│ image_path       VARCHAR   nombre del archivo en /uploads    │
│ vendor_name      VARCHAR   extraído por Gemini               │
│ invoice_number   VARCHAR   extraído por Gemini               │
│ invoice_date     DATE      extraído por Gemini (YYYY-MM-DD)  │
│ due_date         DATE      extraído por Gemini (YYYY-MM-DD)  │
│ subtotal         NUMERIC(12,2)                               │
│ tax_amount       NUMERIC(12,2)                               │
│ total_amount     NUMERIC(12,2)                               │
│ currency         VARCHAR   default 'COP'                     │
│ extracted_data   JSONB     { raw_text: "..." }               │
│ gemini_insights  TEXT      párrafos de análisis              │
│ status           VARCHAR   pending|processing|processed|failed│
│ created_at       TIMESTAMPTZ                                 │
│ updated_at       TIMESTAMPTZ                                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ 1
                               │
                               │ N
               ┌───────────────▼─────────────────┐
               │          invoice_items           │
               ├─────────────────────────────────┤
               │ id           UUID  PK            │
               │ invoice_id   UUID  FK → invoices │
               │ description  VARCHAR             │
               │ quantity     NUMERIC(10,3)        │
               │ unit_price   NUMERIC(12,2)        │
               │ total_price  NUMERIC(12,2)        │
               │ created_at   TIMESTAMPTZ          │
               └─────────────────────────────────┘
```

## Tablas en detalle

### `users`

Almacena las cuentas de usuario. Las contraseñas se guardan como hash bcrypt (cost factor 12) — el hashing ocurre en el backend antes de enviar al `db-service`, nunca en texto plano.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | Generado con `gen_random_uuid()` |
| `email` | VARCHAR(255) | Único, se normaliza a minúsculas en el backend |
| `password` | VARCHAR(255) | Hash bcrypt |
| `name` | VARCHAR(255) | Opcional |
| `created_at` / `updated_at` | TIMESTAMPTZ | `updated_at` se actualiza automáticamente por trigger |

### `invoices`

Registro central de cada factura procesada. La columna `extracted_data` guarda el texto crudo del OCR en JSONB para trazabilidad. Los campos estructurados (`vendor_name`, `total_amount`, etc.) son el resultado de la interpretación de Gemini.

Las fechas (`invoice_date`, `due_date`) se almacenan en formato `YYYY-MM-DD`. El backend convierte el formato `DD/MM/YYYY` que puede devolver Gemini antes de enviarlas al `db-service`.

| Columna | Tipo | Notas |
|---|---|---|
| `image_path` | VARCHAR(500) | Nombre del archivo dentro del volumen `/app/uploads` |
| `extracted_data` | JSONB | `{ "raw_text": "texto completo OCR..." }` |
| `gemini_insights` | TEXT | 2-3 párrafos de análisis financiero |
| `status` | VARCHAR | Enum: `pending` → `processing` → `processed` / `failed` |

**Ciclo de vida del campo `status`:**
```
INSERT con 'processing'
     │
     ▼
Document AI extrae texto
     │
     ▼
Gemini analiza e interpreta
     │
     ├── éxito → PATCH /invoices/:id  →  status = 'processed'
     └── error → PATCH /invoices/:id/status  →  status = 'failed'
```

### `invoice_items`

Ítems de línea de la factura, extraídos por Gemini del texto crudo. Una factura puede tener cero o más ítems. Si Gemini no identifica ítems individuales, la tabla queda vacía para esa factura.

La inserción se hace en bloque vía `POST /invoices/items/bulk` usando una sola query parametrizada, evitando N queries individuales y SQL injection por interpolación.

| Columna | Tipo | Notas |
|---|---|---|
| `quantity` | NUMERIC(10,3) | 3 decimales para manejar fracciones (ej: 0.5 kg) |
| `unit_price` | NUMERIC(12,2) | Precio unitario |
| `total_price` | NUMERIC(12,2) | `quantity × unit_price` (lo calcula Gemini) |

## Índices

```sql
idx_invoices_user_id   -- acelera "facturas de este usuario"
idx_invoices_status    -- acelera filtros por estado
idx_invoice_items_inv  -- acelera "ítems de esta factura"
```

## Triggers

`update_updated_at()` — función PL/pgSQL que asigna `NOW()` a `updated_at` antes de cada `UPDATE`. Está activa en las tablas `users` e `invoices`.

## Extensiones habilitadas

- `pgcrypto` — provee `gen_random_uuid()` para la generación de UUIDs primarios.

## Consultas frecuentes

```sql
-- Facturas de un usuario ordenadas por fecha
SELECT * FROM invoices
WHERE user_id = '<uuid>'
ORDER BY created_at DESC;

-- Detalle completo de una factura con sus ítems
SELECT i.*, array_agg(row_to_json(ii)) AS items
FROM invoices i
LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
WHERE i.id = '<uuid>'
GROUP BY i.id;

-- Gasto total por proveedor para un usuario
SELECT vendor_name, SUM(total_amount) AS total, COUNT(*) AS facturas
FROM invoices
WHERE user_id = '<uuid>' AND status = 'processed'
GROUP BY vendor_name
ORDER BY total DESC;
```

## Acceso directo en desarrollo

```bash
docker-compose exec database psql -U luqo -d luqo_db
```
