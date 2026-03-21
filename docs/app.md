# Cómo funciona la aplicación — Luqo

## Pantallas y flujos de usuario

### 1. Autenticación (`Auth.jsx`)

La pantalla inicial muestra dos tabs: **Iniciar sesión** y **Registrarse**.

**Registro:**
```
Usuario ingresa nombre + email + contraseña
  → POST /api/auth/register
  → Backend: bcrypt.hash(password, 12) + INSERT INTO users
  → Responde { token, user }
  → Frontend guarda token en localStorage y navega al dashboard
```

**Login:**
```
Usuario ingresa email + contraseña
  → POST /api/auth/login
  → Backend: bcrypt.compare() + jwt.sign()
  → Responde { token, user }
  → Frontend guarda token en localStorage y navega al dashboard
```

El token JWT tiene vigencia de 7 días. El interceptor de axios lo añade automáticamente a cada request como `Authorization: Bearer <token>`. Si el servidor responde 401, el interceptor limpia el localStorage y dispara el evento `luqo:logout` para redirigir al login.

---

### 2. Dashboard (`Dashboard.jsx`)

Vista principal tras autenticarse. Al montar, hace `GET /api/invoices` y renderiza una grilla de tarjetas con las facturas del usuario.

Cada tarjeta muestra:
- Nombre del proveedor
- Fecha de la factura
- Total (con currency)
- Badge de estado (`✓ Procesada` / `⏳`)

Al hacer clic en una tarjeta se abre el modal de detalle (`InvoiceDetail`).

---

### 3. Captura de factura (`CameraCapture.jsx`)

El modal tiene 5 fases internas:

```
idle → camera → preview → uploading → done
```

**Fase `idle`:**
- Zona de drop/click para cargar imagen desde disco
- Botón "Abrir cámara" que llama `navigator.mediaDevices.getUserMedia()`

**Fase `camera`:**
- El stream se asigna a `videoRef.current.srcObject` dentro de un `useEffect` que observa el cambio de fase (esto evita el bug de `null ref` — el `<video>` debe existir en el DOM antes de recibir el stream)
- Overlay con líneas de esquina y scanline animada para guiar al usuario
- Botón "Capturar" que usa `canvas.toBlob()` para convertir el frame a JPEG

**Fase `preview`:**
- Muestra la imagen capturada
- Opciones: "Retomar" (vuelve a fase `camera`) o "Procesar con IA"

**Fase `uploading`:**
- Envía `FormData` con el campo `invoice` a `POST /api/invoices`
- Barra de progreso basada en `onUploadProgress` de axios
- El mensaje cambia de "Subiendo imagen..." a "Analizando con Gemini..."

**Fase `done`:**
- Muestra confirmación ✅ y cierra el modal automáticamente
- Llama `onUploaded(invoice)` para añadir la nueva tarjeta al dashboard sin recargar

---

### 4. Detalle de factura (`InvoiceDetail.jsx`)

Modal con scroll que muestra:

1. **Imagen original** — cargada desde `GET /api/invoices/:id/image?token=<jwt>` (el token va en query param porque `<img src>` no puede enviar headers)
2. **Información general** — proveedor, fecha, número, subtotal, IVA, total
3. **Ítems** — tabla con descripción, cantidad, precio unitario, total por ítem
4. **Insights de Gemini** — texto libre con análisis financiero de la compra

---

## API del Backend

### Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | No | Crea cuenta nueva |
| POST | `/api/auth/login` | No | Inicia sesión, devuelve JWT |

**Body de register:**
```json
{ "name": "David", "email": "user@example.com", "password": "123456" }
```

**Respuesta de ambos:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "uuid", "name": "David", "email": "user@example.com", "created_at": "..." }
}
```

### Facturas

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/invoices` | JWT | Sube y procesa una factura |
| GET | `/api/invoices` | JWT | Lista todas las facturas del usuario |
| GET | `/api/invoices/:id` | JWT | Detalle de una factura con ítems |
| GET | `/api/invoices/:id/image` | JWT (query param `?token=`) | Devuelve la imagen original |
| DELETE | `/api/invoices/:id` | JWT | Elimina factura e imagen del disco |

**POST /api/invoices** — `multipart/form-data`, campo `invoice` (imagen, max 10 MB)

**Respuesta 201:**
```json
{
  "invoice": {
    "id": "uuid",
    "vendor_name": "Almacenes Éxito",
    "invoice_date": "2026-03-20",
    "total_amount": "85400.00",
    "currency": "COP",
    "gemini_insights": "Esta compra corresponde a...",
    "status": "processed",
    "invoice_items": [
      { "description": "Leche entera x6", "quantity": 1, "unit_price": 18900, "total_price": 18900 }
    ]
  }
}
```

---

## Integración con GCP Document AI

El servicio `documentAI.js` envía la imagen codificada en base64 al processor configurado en las variables de entorno. El processor debe ser de tipo **OCR** o **Invoice Processor**.

La respuesta de Document AI incluye `document.text` con todo el texto reconocido en la imagen. Solo se usa ese campo — las entidades estructuradas que Document AI intenta parsear no se utilizan porque la precisión es inconsistente y Gemini hace mejor trabajo de interpretación.

**Validación:** si el texto extraído tiene menos de 10 caracteres, se lanza un error antes de llamar a Gemini, evitando un procesamiento inútil y costoso.

---

## Integración con Gemini

El servicio `gemini.js` envía el texto crudo al modelo `gemini-3.1-pro-preview` con un prompt que pide **una sola respuesta JSON** con dos secciones:

**Sección `structured`** — campos parseables para guardar en DB:
```json
{
  "vendor_name": "Almacenes Éxito",
  "invoice_number": "FE-2026-00124",
  "invoice_date": "2026-03-20",
  "due_date": null,
  "currency": "COP",
  "subtotal": 73621,
  "tax_amount": 11779,
  "total_amount": 85400,
  "line_items": [...]
}
```

**Campo `insights`** — texto libre en español con análisis financiero.

Si Gemini devuelve markdown alrededor del JSON (````json ... ````), el código lo elimina antes de parsear. Si el JSON es inválido, se lanza un error descriptivo con los primeros 200 chars de la respuesta.

---

## Gestión de errores

| Escenario | Comportamiento |
|---|---|
| Imagen ilegible (OCR < 10 chars) | `status = 'failed'`, error descriptivo al usuario |
| JSON de Gemini inválido | `status = 'failed'`, log del raw response |
| Credenciales GCP inválidas | `status = 'failed'`, stack trace en logs del backend |
| Token JWT expirado | 401, frontend redirige a login |
| Imagen > 10 MB | multer rechaza antes de llegar al controlador |

---

## Consideraciones de seguridad

- Las contraseñas nunca se devuelven en ninguna respuesta (se excluyen con destructuring)
- El JWT se verifica en cada request protegido antes de acceder a la DB
- Las queries usan parámetros posicionales (`$1`, `$2`) para evitar SQL injection
- Las imágenes solo son accesibles por el usuario que las subió (se valida `user_id` en cada query)
- Las credenciales GCP están en un volumen montado como `read-only` (`:ro`)
