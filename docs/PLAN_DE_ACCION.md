# GeoMuni — Hoja de Ruta del Producto Municipal

**Sistema de Información Geográfica para Municipios Argentinos**
Última actualización: 2026-03-09

---

## Resumen Ejecutivo

GeoMuni es una IDE (Infraestructura de Datos Espaciales) municipal que centraliza catastro, infraestructura urbana y gestión territorial en una sola plataforma web. El objetivo es reemplazar el registro en papel, las planillas dispersas y los sistemas desconectados que hoy usa la mayoría de los municipios del interior del país.

**Para qué sirve hoy:**
Mapa catastral interactivo, fichas de parcelas completas, gestión de incidencias de infraestructura, roles de acceso, panel de control y exportación de cédulas catastrales.

**Para qué tiene que servir (producto completo):**
Instrumento de gestión territorial diaria para empleados municipales, técnicos de campo, jefes de área y autoridades; con trazabilidad legal, valuación fiscal, expedientes, estadísticas y una ventanilla ciudadana básica.

---

## Estado Actual — Implementado ✅

| Módulo | Estado | Notas |
|--------|--------|-------|
| Mapa interactivo Leaflet + PostGIS | ✅ | Dibujo, edición, capas |
| Ficha catastral extendida (17 campos) | ✅ | 4 módulos: servicios, edificación, legal, fiscal |
| 5 modos de visualización de cobertura | ✅ | Fiscal, agua, cloacas, servicios, pavimento |
| Gestión de propietarios (CRUD) | ✅ | Modal con búsqueda |
| Incidencias de infraestructura | ✅ | Baches, luminarias, basurales, obras viales |
| Control de acceso por roles (3 roles) | ✅ | Enforcement server-side real |
| Panel /admin — gestión de usuarios | ✅ | Crear, rol, suspender, reset password |
| Dashboard con filtros y exportación CSV | ✅ | Catastro, obras, historial |
| Cédula catastral PDF (4 secciones) | ✅ | Desde mapa y desde dashboard |
| Sidebar de navegación compartida | ✅ | Dashboard + Admin |
| Autenticación JWT + NextAuth | ✅ | Login, sessión, activo/inactivo |
| Sistema de Responsabilidades (Etapa 6) | ✅ | Rol técnico, adjudicación, /mis-reportes, badge |

---

## Lo que Falta — Organizado por Impacto

### INDISPENSABLE para uso municipal real

Estas funcionalidades son requerimientos mínimos para que un municipio adopte el sistema en producción. Sin alguna de ellas, el sistema tiene un uso limitado o genera desconfianza institucional.

---

### Etapa 6 — Sistema de Responsabilidades ✅ IMPLEMENTADO

**Qué es:** Un técnico o jefe de área tiene cuenta en el sistema. El editor/administrador le adjudica reportes de infraestructura. El técnico solo ve sus reportes asignados, los gestiona desde el campo y actualiza el estado.

**Por qué es indispensable:** Sin esto, el sistema registra problemas pero nadie tiene responsabilidad formal. El circuito papel/WhatsApp se mantiene paralelo al sistema digital.

**Nuevo rol:** `tecnico`

| Permiso | Consultor | Técnico | Editor | Administrador |
|---------|-----------|---------|--------|---------------|
| Ver mapa | ✓ | ✓ | ✓ | ✓ |
| Ver mis reportes asignados | ✗ | ✓ | ✓ | ✓ |
| Actualizar estado de reporte propio | ✗ | ✓ | ✓ | ✓ |
| Ver catastro / dashboard general | ✓ | ✗ | ✓ | ✓ |
| Adjudicar reportes | ✗ | ✗ | ✓ | ✓ |
| Crear/editar parcelas | ✗ | ✗ | ✓ | ✓ |
| Gestión de usuarios | ✗ | ✗ | ✗ | ✓ |

**Cambios de DB:**
```sql
-- 1. Ampliar constraint de rol
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('administrador', 'editor', 'consultor', 'tecnico'));

-- 2. Vincular personal con usuarios del sistema
ALTER TABLE personal ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id);
CREATE INDEX IF NOT EXISTS idx_personal_usuario_id ON personal(usuario_id);

-- 3. Adjudicación en infraestructura
ALTER TABLE infraestructura ADD COLUMN IF NOT EXISTS adjudicado_a UUID REFERENCES usuarios(id);
ALTER TABLE infraestructura ADD COLUMN IF NOT EXISTS fecha_adjudicacion TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_infraestructura_adjudicado ON infraestructura(adjudicado_a);
```

**Script:** `node add_responsabilidades.mjs`

**Cambios de código:**
- `adjudicarReporte(infraId, usuarioId)` — requiere `editor`, actualiza adjudicado_a
- `getMisReportes()` — retorna solo reportes del usuario logueado (rol `tecnico`)
- `updateInfraestructura()` — técnico solo puede actualizar sus propios reportes
- `getInfraestructuraGeoJSON()` — para técnicos, filtra por `adjudicado_a = session.user.id`
- InfraModal: sección de adjudicación con dropdown de usuarios técnicos
- Nueva ruta `/mis-reportes` — lista y mapa de reportes asignados al técnico
- AppSidebar: para `tecnico` muestra Mapa + Mis Reportes (oculta catastro y admin)
- Badge en sidebar con contador de reportes pendientes propios

---

### Etapa 7 — Auditoría Catastral ⬜

**Qué es:** Log de todos los cambios realizados sobre parcelas: qué campo cambió, valor anterior, valor nuevo, quién lo cambió, cuándo.

**Por qué es indispensable:** El catastro es un instrumento legal. Sin trazabilidad de cambios, el sistema no puede usarse como fuente de verdad ante conflictos de propiedad o valuaciones.

**Cambios de DB:**
```sql
CREATE TABLE historial_parcelas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id  UUID NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
  usuario_id  UUID REFERENCES usuarios(id),
  campo       TEXT NOT NULL,
  valor_antes TEXT,
  valor_nuevo TEXT,
  fecha       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_historial_parcelas_parcela ON historial_parcelas(parcela_id);
CREATE INDEX idx_historial_parcelas_fecha   ON historial_parcelas(fecha DESC);
```

**Cambios de código:**
- `updateParcelaFicha()` — comparar valor anterior y registrar en `historial_parcelas`
- `updateParcelaEstado()` — registrar cambio de estado fiscal
- `updateParcelaPropietario()` — registrar cambio de titular
- Dashboard: tab Historial incluye también historial catastral con filtro por parcela
- En la sidebar del mapa: pestaña "Historial" en la ficha de la parcela

---

### Etapa 8 — Valuación Fiscal ⬜

**Qué es:** Módulo para registrar el valor catastral de las parcelas, calcular deudas municipales y exportar padrones de deudores.

**Por qué es indispensable:** El catastro sin valuación no cierra el ciclo fiscal. Los municipios necesitan esto para emitir boletas de tasas, iniciar juicios de apremio y priorizar la recuperación de deuda.

**Cambios de DB:**
```sql
-- Historial de valuaciones por parcela
CREATE TABLE valuaciones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id    UUID NOT NULL REFERENCES parcelas(id),
  valor_m2      NUMERIC(12,2) NOT NULL,
  valor_total   NUMERIC(14,2) GENERATED ALWAYS AS (valor_m2) STORED, -- calculado al consultar
  vigencia_desde DATE NOT NULL,
  vigencia_hasta DATE,
  usuario_id    UUID REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Pagos registrados
CREATE TABLE pagos_tasa (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id    UUID NOT NULL REFERENCES parcelas(id),
  monto         NUMERIC(12,2) NOT NULL,
  fecha_pago    DATE NOT NULL,
  periodo       TEXT, -- ej. '2026-T1'
  comprobante   TEXT,
  usuario_id    UUID REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS deuda_total NUMERIC(12,2) DEFAULT 0;
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS ultimo_pago DATE;
```

**Funcionalidades:**
- Fijar valor catastral por m² (puede variar por zona/barrio)
- Ver deuda acumulada por parcela en la ficha
- Dashboard: exportar padrón de deudores (CSV con nro_padron, titular, DNI, deuda, contacto)
- Registrar pago y actualizar estado_fiscal automáticamente
- Filtro en dashboard: deuda > $X, sin pago > N meses

---

### Etapa 9 — Importación de Datos ⬜

**Qué es:** Herramientas para cargar datos históricos del municipio al sistema. La mayoría de los municipios tienen sus datos en planillas Excel, shapefiles del IGN o sistemas viejos.

**Por qué es indispensable:** Sin esto, adoptar el sistema implica cargar todo a mano. Es una barrera de entrada insalvable para cualquier municipio con datos pre-existentes.

**Funcionalidades:**
- **Importar propietarios desde CSV:** columnas mapeables (nombre, apellido, dni, contacto)
- **Importar parcelas desde GeoJSON:** con validación de solapamiento PostGIS
- **Importar parcelas desde Shapefile:** conversión server-side (ogr2ogr o turf.js)
- **Importar incidencias desde CSV:** tipo, lat, lng, estado, fecha
- Preview antes de confirmar importación (tabla con registros parseados)
- Informe de errores: filas rechazadas con motivo

**Ruta:** `/admin/importar` (solo administrador)

---

### Etapa 10 — Reportes y Estadísticas ⬜

**Qué es:** Gráficos de resumen y generación de informes ejecutivos automatizados.

**Por qué es indispensable:** Las autoridades municipales toman decisiones con datos visuales, no con tablas. Es la diferencia entre un sistema de carga y un sistema de gestión.

**Funcionalidades:**
- **Dashboard visual** (nueva pestaña "Estadísticas"):
  - Torta: distribución de parcelas por estado fiscal
  - Barras: parcelas por barrio
  - Barras apiladas: cobertura de servicios por barrio (% con agua, % con cloacas, etc.)
  - Línea: evolución de reportes de infraestructura por mes
  - KPIs: % morosos, tiempo promedio de resolución de reportes, parcelas sin propietario
- **Informe ejecutivo PDF:** genera un PDF con métricas clave del municipio, firmable digitalmente
- **Biblioteca:** recharts (ya disponible en el ecosistema Next.js/React)

---

## IMPORTANTE — Agrega valor significativo

### Etapa 11 — Módulo de Expedientes y Trámites ⬜

**Qué es:** Registro de trámites municipales vinculados a parcelas (subdivisiones, regularizaciones, transferencias de dominio, permisos de construcción).

**Cambios de DB:**
```sql
CREATE TABLE expedientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id    UUID REFERENCES parcelas(id),
  numero        TEXT UNIQUE NOT NULL,
  tipo          TEXT NOT NULL, -- 'subdivision', 'regularizacion', 'permiso_obra', 'transferencia'
  estado        TEXT DEFAULT 'iniciado', -- 'iniciado', 'en_proceso', 'aprobado', 'rechazado', 'archivado'
  descripcion   TEXT,
  fecha_inicio  DATE DEFAULT CURRENT_DATE,
  fecha_cierre  DATE,
  responsable   UUID REFERENCES usuarios(id),
  documentos    TEXT[], -- array de URLs o paths
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

**Funcionalidades:**
- Ver expedientes asociados en la ficha de parcela (nueva pestaña)
- Crear expediente desde la parcela
- Cambiar estado del expediente
- El número de expediente se refleja en `expediente_municipal` (campo ya existente)
- Listado en dashboard con filtros por tipo y estado

---

### Etapa 12 — Portal Ciudadano (Consulta Pública) ⬜

**Qué es:** Ruta pública accesible sin login donde los ciudadanos pueden consultar datos básicos de su parcela y reportar problemas urbanos.

**Por qué es importante:** Cierra el ciclo de participación ciudadana. Es la diferencia entre un sistema interno y una plataforma de ciudad.

**Ruta:** `/consulta` (pública, sin autenticación)

**Funcionalidades:**
- Buscar parcela por nro_padron → ver datos públicos (superficie, barrio, servicios disponibles)
- **No expone:** datos fiscales de deuda, información de propietarios, estado_fiscal
- Formulario para reportar incidencia (tipo, descripción, foto, ubicación GPS)
  - Sin login: solo email de contacto opcional
  - Crea incidencia con estado 'pendiente_verificacion'
  - Muestra código de seguimiento al ciudadano
- Mapa público: ver incidencias activas de infraestructura (sin datos sensibles)

---

### Etapa 13 — Notificaciones Internas ⬜

**Qué es:** Sistema de alertas dentro de la aplicación para eventos importantes.

**Eventos a notificar:**
- Se adjudicó un reporte al técnico → badge en sidebar
- Un reporte adjudicado lleva > 30 días sin actualizar → alerta en dashboard
- Parcela morosa supera N meses → aparece en lista de alertas
- Nuevo reporte ciudadano sin verificar → alerta a editores

**Implementación simple sin infraestructura extra:**
```sql
CREATE TABLE notificaciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id),
  tipo        TEXT NOT NULL,
  mensaje     TEXT NOT NULL,
  leida       BOOLEAN DEFAULT FALSE,
  link        TEXT, -- ruta a donde navegar al hacer click
  created_at  TIMESTAMPTZ DEFAULT now()
);
```
- Polling cada 60s en el cliente (o Server-Sent Events)
- Badge numérico en AppSidebar
- Panel desplegable desde el sidebar

---

## CONVENIENTE — Cuando el sistema esté maduro

### Etapa 14 — PWA para Técnicos de Campo ⬜

**Qué es:** La aplicación funciona como Progressive Web App instalable en el celular del técnico.

**Funcionalidades:**
- Ver mis reportes asignados sin conexión (Service Worker + cache)
- Tomar foto con la cámara del celular y adjuntarla al reporte
- Registrar ubicación GPS automáticamente al abrir un reporte
- Sincronizar cambios cuando vuelve la conexión

---

### Etapa 15 — Integración con Sistemas Externos ⬜

- **AFIP:** validar CUIT de propietarios (API pública disponible)
- **Registro Nacional de las Personas:** validar DNI (requiere convenio)
- **Sistemas de cobro municipales (RAFAM, etc.):** exportar/importar deudas en formato compatible
- **Catastro provincial:** sincronización bidireccional si la provincia lo permite

---

### Etapa 16 — Gestión de Barrios Completa ⬜

**Actualmente:** los barrios se crean dibujando polígonos en el mapa pero no hay CRUD completo.

**Falta:**
- Editar nombre y descripción de barrios desde el panel
- Estadísticas automáticas por barrio (cantidad de parcelas, % servicios, reportes activos)
- Asignación de técnico responsable por barrio (vinculado con Etapa 6)
- Eliminar barrio con confirmación y reasignación de parcelas

---

## Resumen de Prioridades

```
┌─────────────────────────────────────────────────────────────────┐
│  INDISPENSABLE (bloquea adopción sin esto)                      │
│  ├─ Etapa 6: Sistema de Responsabilidades    ← Siguiente paso  │
│  ├─ Etapa 7: Auditoría catastral                               │
│  ├─ Etapa 8: Valuación fiscal                                  │
│  └─ Etapa 9: Importación de datos                              │
├─────────────────────────────────────────────────────────────────┤
│  IMPORTANTE (diferencia entre útil y excelente)                 │
│  ├─ Etapa 10: Estadísticas y reportes                          │
│  ├─ Etapa 11: Expedientes y trámites                           │
│  ├─ Etapa 12: Portal ciudadano                                 │
│  └─ Etapa 13: Notificaciones internas                          │
├─────────────────────────────────────────────────────────────────┤
│  CONVENIENTE (para municipios que escalan)                      │
│  ├─ Etapa 14: PWA para técnicos de campo                       │
│  ├─ Etapa 15: Integración con sistemas externos                │
│  └─ Etapa 16: Gestión de barrios completa                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pendientes técnicos transversales

| Tarea | Impacto | Cuando |
|-------|---------|--------|
| Columna `barrio_id` + trigger (reemplaza ST_Intersects en JOIN) | Performance | Antes de escalar a > 5000 parcelas |
| Columnas materializadas `lat`, `lng`, `superficie_m2` en parcelas | Performance | Antes de escalar |
| Índices en Foreign Keys (ver PENDIENTES_DB.md) | Performance | Ahora |
| Edición inline de estado fiscal desde dashboard | Productividad | Etapa 10 |

---

## Scripts de Utilidad

| Script | Función |
|--------|---------|
| `node setup_auth_db.mjs` | Inicializa tabla usuarios, crea admin por defecto (admin@geomuni.gov.ar / admin123) |
| `node repair_admin.mjs` | Repara usuario admin si falla autenticación |
| `node apply_migration.mjs` | Aplica los 17 campos extendidos de parcelas |
| `node add_activo_column.mjs` | Agrega columna `activo` a usuarios |
| `node add_responsabilidades.mjs` | (Pendiente) Migración Etapa 6 |
| `node clear_parcelas.mjs` | Elimina todas las parcelas — solo para pruebas |

---

## Arquitectura actual — Referencia rápida

```
src/
├── app/
│   ├── page.js                    ← Mapa principal
│   ├── dashboard/page.js          ← Panel de control
│   ├── admin/page.js              ← Gestión de usuarios
│   ├── login/page.js              ← Autenticación
│   └── actions/geoActions.js      ← TODAS las operaciones DB
├── components/
│   ├── AppSidebar.jsx             ← Nav compartida dashboard/admin
│   └── map/
│       ├── LeafletMap.jsx         ← Mapa interactivo (componente principal)
│       ├── InfraModal.jsx         ← Gestión de incidencias
│       ├── PropietariosModal.jsx  ← CRUD propietarios
│       └── SearchBar.jsx          ← Búsqueda por padrón y Plus Code
├── auth.js                        ← NextAuth con check de activo
├── auth.config.js                 ← Callbacks JWT/session + protección de rutas
└── middleware.js                  ← Protege rutas por rol
```
