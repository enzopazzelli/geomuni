# CLAUDE.md

Este archivo provee orientación a Claude Code (claude.ai/code) para trabajar en este repositorio.

## Descripción del Proyecto

**GeoMuni** es un Sistema de Información Geográfica Municipal (IDE - Infraestructura de Datos Espaciales) para municipios argentinos. Provee un mapa catastral interactivo con gestión de parcelas, seguimiento de infraestructura urbana y control de acceso basado en roles.

## Comandos

```bash
npm run dev       # Inicia servidor de desarrollo (localhost:3000)
npm run build     # Compilación para producción
npm run lint      # Ejecuta ESLint

# Configuración inicial (una sola vez — crea todo el schema + admin por defecto)
node scripts/setup/setup_production.mjs  # Schema completo idempotente (admin@geomuni.gov.ar / admin123)
node scripts/setup/repair_admin.mjs      # Repara el usuario admin si la autenticación falla
```

No hay framework de tests configurado. La validación se realiza manualmente en el navegador.

## Arquitectura

### Stack
- **Next.js 15 (App Router)** + **React 19** — frontend y server actions
- **PostGIS (Neon PostgreSQL)** — toda la lógica espacial corre en la DB con funciones `ST_*`, nunca en el cliente
- **Auth.js v5** — autenticación por credenciales con JWT y bcryptjs
- **Leaflet 1.9 + Geoman** — mapa interactivo con dibujo y edición de geometrías
- **JavaScript puro** con JSDoc (sin TypeScript)

### Principio clave: PostGIS First
Todos los cálculos espaciales (intersecciones, áreas, distancias) deben resolverse en la base de datos con funciones `ST_*` de PostGIS. No se realizan cálculos geométricos en el cliente.

### Flujo de Datos
1. **Mapa Leaflet** (cliente) captura interacciones y geometrías del usuario
2. **Server Actions de Next.js** (`src/app/actions/geoActions.js`) manejan todas las operaciones DB
3. **Neon PostgreSQL + PostGIS** almacena geometría en SRID 4326 y retorna GeoJSON vía `ST_AsGeoJSON()`

### Tablas de la Base de Datos
- `parcelas` — parcelas de tierra con `geometria` (Polygon), `nro_padron`, `estado_fiscal`, FK propietario
- `propietarios` — titulares con DNI e información de contacto
- `infraestructura` — puntos de infraestructura urbana (baches, luminarias, basurales) con estados de ciclo de vida, `observaciones` del ciudadano
- `barrios` — polígonos de barrios
- `personal` — cuadrillas asignadas a obras de infraestructura
- `historial_obras` — log de auditoría para cambios en infraestructura
- `historial_parcelas` — log de auditoría para cambios en parcelas (propietario, estado fiscal, ficha)
- `notificaciones` — alertas internas entre usuarios
- `usuarios` / `roles` — autenticación y RBAC

Índices GIST en todas las columnas de geometría.

### Autenticación y Roles
Cuatro roles: `administrador`, `editor`, `tecnico`, `consultor`. El rol se almacena en el JWT/sesión como `user.rol`. El middleware en `src/middleware.js` protege todas las rutas excepto `/login` y `/reportar`. Los controles de rol en el cliente gestionan la visibilidad de la UI.

### Rutas de la aplicación
```
/               → Mapa interactivo principal
/dashboard      → Panel tabular (catastro, obras, historial, propietarios, cuadrillas)
/estadisticas   → Métricas y KPIs con exportación PDF
/mis-reportes   → Vista exclusiva para rol técnico
/reportar       → Formulario público ciudadano (sin login)
/admin          → Gestión de usuarios (solo administrador)
/login          → Autenticación
```

### Componentes Clave
- `src/components/map/LeafletMap.jsx` — mapa principal, sidebar de parcelas con 5 tabs
- `src/components/map/SearchBar.jsx` — búsqueda de parcelas por `nro_padron` + geocodificación Plus Code
- `src/components/map/PropietariosModal.jsx` — CRUD de propietarios desde el mapa
- `src/components/map/InfraModal.jsx` — gestión de reportes de infraestructura
- `src/components/AppSidebar.jsx` — sidebar compartido para todas las páginas del panel
- `src/app/actions/geoActions.js` — TODAS las operaciones DB del servidor (archivo único)
- `src/lib/db.js` — pool de conexiones Neon

### Alias de Rutas
`@/*` resuelve a `./src/*` (configurado en `jsconfig.json`).

## Variables de Entorno

Requeridas en `.env.local`:
```
DATABASE_URL=         # Cadena de conexión Neon PostgreSQL (pooled)
AUTH_SECRET=          # Secret de NextAuth
AUTH_URL=             # URL completa de la app (ej. http://localhost:3000)
NEXTAUTH_URL=         # Igual que AUTH_URL
```

## Estructura del Proyecto

```
db/
├── migrations/          # Migraciones SQL (schema base)
│   ├── 20240302_initial_schema.sql
│   ├── 20240302_barrios_roles.sql
│   ├── 20240303_parcelas_superficie.sql
│   └── 20260308_parcelas_robustecimiento.sql
└── seed.sql             # Datos de prueba (50 parcelas + 20 luminarias)

scripts/
├── migrations/          # Migraciones incrementales Node.js (aplicar en orden)
├── setup/               # Inicialización única del entorno
└── utils/               # Mantenimiento y herramientas auxiliares

docs/                    # Documentación técnica y planes de acción
```

## Migraciones de Base de Datos

Las migraciones SQL están en `db/migrations/` y deben ejecutarse en orden en Neon.
Los scripts `.mjs` en `scripts/migrations/` se aplican con `node` y son idempotentes.
