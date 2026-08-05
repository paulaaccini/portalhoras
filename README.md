# Portal Horas — Portal de Control de Horas de Maquinaria

## Requisitos
- Node.js 18 o superior → https://nodejs.org

## Instalación (primera vez)

1. Descomprime esta carpeta en tu computadora
2. Abre una terminal **dentro** de la carpeta `portalhoras`
3. Ejecuta este comando:

```
npm install
```

Espera a que termine (descarga las librerías necesarias).

## Arrancar el portal

```
node server.js
```

Abre tu navegador en: **http://localhost:3000**

Verás el portal listo con datos de ejemplo.

---

## Qué puedes hacer

| Sección | Función |
|---|---|
| ⏳ Pendientes | Ver registros por aprobar, con detalle de fechas y alerta de tardíos |
| 📋 Historial | Todos los registros con filtros. Botón **Exportar Excel** |
| ➕ Nuevo registro | Cargar horas manualmente (para pruebas antes de integrar WhatsApp) |
| 📊 Dashboard | KPIs, horas por máquina, distribución de registros |
| 🚜 Maquinaria | Agregar/ver flota con tarifas |
| 🏢 Clientes | Gestionar empresas cliente |
| 🏗️ Proyectos | Gestionar proyectos por empresa |

---

## Base de datos

- Los datos se guardan en `data/portalhoras.json` (archivo en tu computadora)
- Las fotos del horómetro se guardan en `uploads/`
- **Para hacer backup**: copia la carpeta `data/` y `uploads/`

## Excel exportado

El Excel tiene dos hojas:
1. **Registros de Horas**: tabla completa con colores (verde=aprobado, naranja=tardío, rojo=rechazado)
2. **Resumen por Máquina**: horas aprobadas × tarifa = total $

## Para parar el servidor

Presiona `Ctrl + C` en la terminal.

---

## Próximo paso: subir a internet

Cuando quieras que el portal sea accesible desde cualquier celular o computadora (sin estar en tu red local), el siguiente paso es desplegarlo en **Railway** (https://railway.app) — proceso de ~15 minutos.
