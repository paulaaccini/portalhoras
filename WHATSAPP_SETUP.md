# 📱 Cómo conectar el Bot de WhatsApp (Twilio Sandbox)

Tiempo estimado: **10–15 minutos**

---

## PASO 1 — Instalar dependencias del bot

Dentro de la carpeta `portalhoras`, ejecuta:

```bash
npm install twilio
```

---

## PASO 2 — Crear cuenta en Twilio (gratis)

1. Ve a **https://www.twilio.com** y crea una cuenta gratuita
2. Verifica tu número de teléfono celular
3. En el dashboard, anota tu **Account SID** y **Auth Token**
   (los necesitarás más adelante)

---

## PASO 3 — Activar el Sandbox de WhatsApp

1. En el menú de Twilio ve a:
   **Messaging → Try it out → Send a WhatsApp message**

2. Te aparecerá un número de WhatsApp de Twilio (ej: `+1 415 523 8886`)
   y un código de activación (ej: `join example-word`)

3. Desde tu celular, envía ese mensaje al número de Twilio por WhatsApp
   ```
   join example-word
   ```
4. Recibirás confirmación de que tu número está en el Sandbox ✅

---

## PASO 4 — Exponer tu servidor con ngrok

El bot corre en tu computadora pero Twilio necesita una URL pública.
**ngrok** crea ese túnel gratis.

### Instalar ngrok:
- Ve a **https://ngrok.com** → Download → instala para tu sistema operativo
- Crea una cuenta gratuita y copia tu **authtoken**
- Configura el authtoken:
  ```bash
  ngrok config add-authtoken TU_AUTHTOKEN
  ```

### Exponer el puerto del bot:
```bash
ngrok http 3001
```

Verás algo así:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3001
```

Copia esa URL `https://abc123.ngrok.io` — la necesitas en el siguiente paso.

> ⚠️ La URL de ngrok cambia cada vez que lo reinicias (en plan gratuito).
> Tendrás que actualizar la URL en Twilio cada vez que uses ngrok.

---

## PASO 5 — Configurar el Webhook en Twilio

1. En Twilio, ve a:
   **Messaging → Try it out → Send a WhatsApp message → Sandbox settings**

2. En el campo **"When a message comes in"**, pega:
   ```
   https://abc123.ngrok.io/webhook
   ```
   (reemplaza `abc123` con tu URL real de ngrok)

3. Asegúrate que el método sea **HTTP POST**

4. Haz clic en **Save**

---

## PASO 6 — Arrancar el sistema completo

Necesitas **dos terminales** abiertas al mismo tiempo:

### Terminal 1 — Portal web:
```bash
node server.js
```

### Terminal 2 — Bot de WhatsApp:
```bash
node bot.js
```

### Terminal 3 — ngrok (si no está corriendo):
```bash
ngrok http 3001
```

---

## PASO 7 — Hacer la primera prueba

1. Desde tu celular, envía un mensaje al número de Twilio Sandbox por WhatsApp
2. Escribe: **HORAS**
3. Sigue el flujo del bot
4. Cuando termines, abre el portal en **http://localhost:3000**
   y verás el documento creado en "Documentos Pendientes"

---

## Agregar más números al Sandbox

Para que otros operarios puedan usar el bot durante las pruebas,
cada uno debe enviar el mismo mensaje de activación al número de Twilio:
```
join example-word
```

---

## Estructura de puertos

| Servicio       | Puerto | URL                          |
|----------------|--------|------------------------------|
| Portal web     | 3000   | http://localhost:3000        |
| Bot WhatsApp   | 3001   | http://localhost:3001        |
| ngrok (túnel)  | —      | https://TU-URL.ngrok.io      |

---

## Cuando estés listo para producción

Reemplaza Twilio Sandbox por la **WhatsApp Business API oficial de Meta**:
- Requiere verificación de cuenta empresarial (~5-10 días)
- Sin límite de usuarios (el Sandbox limita a ~5 números)
- Costo: conversaciones gratis las primeras 1,000/mes
- El código del bot.js funciona igual, solo cambia las credenciales
