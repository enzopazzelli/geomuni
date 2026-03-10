# Plan de Acción — GeoMuni (Sistema de Gestión Catastral Municipal)

Última actualización: 2026-03-09 (rev. 2)

---

## Estado General del Sistema

GeoMuni es un IDE Municipal completo con mapa interactivo PostGIS, gestión catastral extendida, control de acceso por roles y panel administrativo. Las funcionalidades core están implementadas y productivas.

---

## Módulos Completados ✅

### 1. Modelo de Datos de Parcelas (Fase 4)
Migración `20260308_parcelas_robustecimiento.sql` — 17 columnas nuevas organizadas en 4 módulos:
- **A — Servicios:** agua_corriente, energia_electrica, cloacas, gas_natural, pavimento, alumbrado_publico
- **B — Edificación:** superficie_cubierta, cantidad_plantas, antiguedad, categoria_edificatoria, estado_conservacion
- **C — Legal:** numero_plano, expediente_municipal, zonificacion, restricciones
- **D — Suelo Fiscal:** es_fiscal, estado_ocupacion, destino_previsto

### 2. Mapa Interactivo (LeafletMap)
- Sidebar con pestañas: General / Servicios / Edificación / Legal + Suelo Fiscal
- 5 modos de visualización de cobertura (colorMode): Fiscal, Agua, Cloacas, Servicios, Pavimento
- Leyenda dinámica por modo
- Dibujo de polígonos: cierra al unir el primer vértice
- Búsqueda por padrón y Plus Code
- Cédula catastral PDF completa (4 secciones, 17 campos)
- Gestión de propietarios (CRUD modal)
- Gestión de infraestructura / incidencias

### 3. Sistema de Roles y Seguridad
- 3 roles: `administrador`, `editor`, `consultor`
- **Enforcement server-side real:** `requireRole(minRole)` en `geoActions.js` usando `auth()` de NextAuth
  - Consultor: solo lectura
  - Editor: crear/editar parcelas, propietarios, infraestructura, fichas
  - Administrador: todo lo anterior + eliminar + gestión de usuarios
- Columna `activo` en tabla `usuarios` — suspensión de cuentas sin eliminarlas
- Middleware protege `/admin` y redirige a `/dashboard` si no es administrador
- Login rechaza cuentas con `activo = false`

### 4. Panel /admin (Administración de Usuarios)
- Lista de todos los usuarios del sistema
- Crear nuevo usuario (nombre, email, contraseña, rol)
- Cambiar rol inline desde dropdown
- Suspender / Reactivar cuenta
- Restablecer contraseña con modal
- Cuadro de referencia de permisos por rol
- Protegido: solo administrador

### 5. Dashboard (/dashboard)
- Layout con AppSidebar compartido (Mapa / Dashboard / Administración)
- Tabs: Catastro, Obras, Historial (lazy load)
- Métricas por tab
- Filtros en Catastro: search, barrio, estado_fiscal, es_fiscal
- Filtros en Infraestructura: search, tipo, estado
- Exportar CSV (datos filtrados actuales)
- Botón 🗺️ Mapa por fila (navega al mapa con la parcela/reporte centrado)
- Botón 📄 PDF por fila de catastro (cédula completa)

---

## Pendientes / Próximos Pasos

| Prioridad | Tarea | Impacto |
|-----------|-------|---------|
| **Alta** | **Sistema de Responsabilidades** — ver especificación completa abajo | Operativo |
| Alta | Auditoría por campo: log de qué campo cambió, valor anterior/nuevo, usuario, timestamp | Trazabilidad legal |
| Alta | Optimización DB: columna `barrio_id` + trigger (reemplaza ST_Intersects en JOIN) | Performance |
| Media | Estadísticas visuales en dashboard (gráficos: torta por estado fiscal, servicios) | Planificación |
| Media | Edición inline de estado fiscal desde dashboard (sin ir al mapa) | Productividad |
| Baja | Columnas materializadas: `lat`, `lng`, `superficie_m2` en tabla parcelas | Performance |
| Baja | Notificaciones / badge de reportes asignados pendientes en sidebar | UX |

---

## Etapa 6 — Sistema de Responsabilidades (ESPECIFICACIÓN)

### Concepto
Los editores y administradores pueden **adjudicar reportes de infraestructura** a responsables del sistema (técnicos y jefes de área). Los responsables asignados tienen un rol propio que les permite ver y gestionar únicamente los reportes que les fueron adjudicados, sin acceso al catastro ni al resto del sistema.

### Nuevo rol: `tecnico`
| Permiso | Consultor | Técnico | Editor | Administrador |
|---------|-----------|---------|--------|---------------|
| Ver mapa | ✓ | ✓ | ✓ | ✓ |
| Ver catastro | ✓ | ✗ | ✓ | ✓ |
| Ver dashboard general | ✓ | ✗ | ✓ | ✓ |
| Ver mis reportes asignados | ✗ | ✓ | ✓ | ✓ |
| Actualizar estado de reporte propio | ✗ | ✓ | ✓ | ✓ |
| Adjudicar reportes a técnicos | ✗ | ✗ | ✓ | ✓ |
| Crear/editar parcelas | ✗ | ✗ | ✓ | ✓ |
| Gestión de usuarios | ✗ | ✗ | ✗ | ✓ |

### Cambios en Base de Datos

**1. Nuevo valor de rol en `usuarios`:**
```sql
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('administrador', 'editor', 'consultor', 'tecnico'));
```

**2. Vincular `usuarios` con `personal` (tabla de cuadrillas):**

La tabla `personal` ya existe y tiene `nombre`, `cuadrilla`, `especialidad`. Se necesita vincularla al sistema de autenticación:
```sql
ALTER TABLE personal ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id);
CREATE INDEX IF NOT EXISTS idx_personal_usuario_id ON personal(usuario_id);
```

**3. Columna `adjudicado_a` en `infraestructura`:**
```sql
ALTER TABLE infraestructura ADD COLUMN IF NOT EXISTS adjudicado_a UUID REFERENCES usuarios(id);
ALTER TABLE infraestructura ADD COLUMN IF NOT EXISTS fecha_adjudicacion TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_infraestructura_adjudicado ON infraestructura(adjudicado_a);
```

### Cambios en Server Actions (`geoActions.js`)

**`adjudicarReporte(infraId, usuarioId)`** — requiere `editor`:
- Actualiza `adjudicado_a` y `fecha_adjudicacion` en `infraestructura`
- Solo permite adjudicar a usuarios con rol `tecnico` o `editor`

**`getMisReportes()`** — requiere `tecnico` o superior:
- Retorna solo los reportes donde `adjudicado_a = session.user.id`
- Incluye geometría, tipo, estado, historial

**`updateInfraestructura()`** — ampliar permisos:
- Un `tecnico` puede actualizar el estado de un reporte **solo si** `adjudicado_a = session.user.id`
- Si no está adjudicado a él, rechazar con error

**`getInfraestructuraGeoJSON()`** — filtro por rol:
- Para `tecnico`: retorna solo los reportes adjudicados a `session.user.id`
- Para `editor`/`administrador`: retorna todos (comportamiento actual)

### Cambios en UI

**InfraModal — sección de adjudicación** (visible para `editor`/`administrador`):
```
┌─────────────────────────────────────────────┐
│ Adjudicar a responsable                      │
│ [Dropdown: lista de usuarios técnicos]  [✓] │
│ Asignado el: 08/03/2026                      │
└─────────────────────────────────────────────┘
```
- Dropdown con usuarios de rol `tecnico` del sistema
- Al seleccionar y confirmar, llama a `adjudicarReporte()`
- Muestra quién y cuándo fue adjudicado si ya tiene asignación

**Vista del técnico — `/mis-reportes`** (nueva ruta, solo `tecnico`):
- Lista de reportes adjudicados al usuario logueado
- Por cada reporte: tipo, ubicación, estado actual, fecha de adjudicación
- Botón para abrir el InfraModal y actualizar estado/observaciones
- Badge en sidebar con cantidad de reportes pendientes propios

**Dashboard — tab Obras** — nueva columna "Responsable Sistema":
- Muestra el usuario del sistema asignado (además del personal/cuadrilla)
- Permite reasignar desde la tabla

**Sidebar (AppSidebar)** — para rol `tecnico`:
- Muestra: Mapa, Mis Reportes
- Oculta: Dashboard general, Administración

**Mapa** — marcadores con indicador de adjudicación:
- Reportes sin adjudicar: círculo con borde punteado rojo
- Reportes adjudicados: círculo con borde sólido (color por estado)
- Para técnicos: solo sus reportes visibles en el mapa

### Script de migración
```
node add_responsabilidades.mjs
```
Aplica los 3 cambios de DB (constraint de rol, usuario_id en personal, adjudicado_a en infraestructura).

### Flujo operativo típico
1. **Editor/Admin** recibe notificación de nuevo reporte (bache, luminaria rota, etc.)
2. Abre el reporte en el mapa o dashboard → InfraModal → sección "Adjudicar"
3. Selecciona el técnico responsable del sistema → guarda
4. El **Técnico** ingresa al sistema → ve sus reportes en `/mis-reportes` y en el mapa
5. Sale a campo, resuelve el problema, vuelve al sistema
6. Abre su reporte → actualiza estado a "en_reparacion" o "finalizado" + observaciones
7. El historial queda registrado con su nombre y timestamp

---

## Optimizaciones de Base de Datos Pendientes

Ver `PENDIENTES_DB.md` para el detalle técnico de:
1. Índices en Foreign Keys
2. Columna `barrio_id` + trigger PostGIS (evita ST_Intersects en JOINs)
3. Columnas materializadas para centroide y superficie

---

## Scripts de Utilidad

| Script | Función |
|--------|---------|
| `node setup_auth_db.mjs` | Inicializa tabla usuarios, crea admin por defecto |
| `node repair_admin.mjs` | Repara usuario admin si falla autenticación |
| `node apply_migration.mjs` | Aplica los 17 campos extendidos de parcelas |
| `node add_activo_column.mjs` | Agrega columna `activo` a usuarios |
| `node clear_parcelas.mjs` | Elimina todas las parcelas (uso: limpieza de pruebas) |
