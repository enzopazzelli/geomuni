# GeoMuni — Flujos del Sistema y Guía de Pruebas

**Stack:** Next.js 15 · PostGIS (Neon) · Auth.js v5 · Leaflet + Geoman · Tailwind
**Última actualización:** 2026-03-09

---

## Tabla de Contenidos

1. [Configuración Inicial](#1-configuración-inicial)
2. [Autenticación y Roles](#2-autenticación-y-roles)
3. [Mapa Interactivo](#3-mapa-interactivo)
4. [Catastro — Parcelas](#4-catastro--parcelas)
5. [Infraestructura Urbana](#5-infraestructura-urbana)
6. [Sistema de Responsabilidades](#6-sistema-de-responsabilidades)
7. [Dashboard y Exportaciones](#7-dashboard-y-exportaciones)
8. [Administración de Usuarios](#8-administración-de-usuarios)
9. [Referencia de Server Actions](#9-referencia-de-server-actions)
10. [Convenciones y Casos Borde](#10-convenciones-y-casos-borde)

---

## 1. Configuración Inicial

### Requisitos
- Node.js 18+
- Cuenta Neon PostgreSQL con PostGIS habilitado
- Variables de entorno en `.env.local`

### `.env.local`
```
DATABASE_URL=postgres://...   # Neon pooled connection string
AUTH_SECRET=...               # String aleatorio (openssl rand -base64 32)
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
```

### Secuencia de setup (solo una vez)
```bash
# 1. Instalar dependencias
npm install

# 2. Crear tablas base y usuario admin
node setup_auth_db.mjs
# → Crea admin@geomuni.gov.ar / admin123

# 3. Aplicar migraciones de parcelas extendidas
node apply_migration.mjs

# 4. Agregar columna activo a usuarios
node add_activo_column.mjs

# 5. Sistema de responsabilidades (Etapa 6)
node add_responsabilidades.mjs

# 6. Cargar datos de prueba (opcional)
# → supabase/seed.sql via Neon Console

# 7. Iniciar servidor
npm run dev
```

### Si el login falla después de setup
```bash
node repair_admin.mjs
```

---

## 2. Autenticación y Roles

### Roles disponibles

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| `consultor` | 0 | Solo lectura. Ve mapa y dashboard, descarga PDFs |
| `tecnico` | 1 | Ve y gestiona únicamente los reportes adjudicados a él |
| `editor` | 2 | Crea y edita parcelas, infraestructura, fichas. Adjudica reportes |
| `administrador` | 3 | Todo + eliminar + gestión de usuarios |

### Flujo: Login
1. Ir a `/login`
2. Ingresar email y contraseña
3. Sistema verifica `activo = true` en DB
4. JWT se genera con `{ id, name, email, rol, activo }`
5. Redirige a `/` (mapa)

**Cómo probar:**
- Login correcto: `admin@geomuni.gov.ar / admin123`
- Usuario suspendido: login falla con "Credenciales inválidas"
- Usuario inexistente: mismo mensaje (no revela si el email existe)

### Flujo: Redirecciones por rol

| Intento de acceso | Rol | Resultado |
|-------------------|-----|-----------|
| `/admin` | editor, consultor, tecnico | Redirige a `/dashboard` |
| `/dashboard` | tecnico | Redirige a `/mis-reportes` |
| `/mis-reportes` | cualquiera autenticado | Accesible |
| Cualquier ruta | no autenticado | Redirige a `/login` |

**Cómo probar:**
1. Loguear como técnico → debe ir directamente a `/mis-reportes`
2. Técnico intenta ir manualmente a `/dashboard` → redirige a `/mis-reportes`
3. Consultor intenta ir a `/admin` → redirige a `/dashboard`

### Implementación
- Middleware: `src/middleware.js` — aplica el callback `authorized` de Auth.js a todas las rutas
- Lógica: `src/auth.config.js` — `authorized()` revisa rol y redirige
- Server-side: `requireRole(minRole)` en `geoActions.js` — rechaza con error si el rol es insuficiente

---

## 3. Mapa Interactivo

**Ruta:** `/`
**Componente principal:** `src/components/map/LeafletMap.jsx`

### Capas del mapa

| Capa | Color | Control |
|------|-------|---------|
| Parcelas | Según colorMode | Toggle en panel superior |
| Barrios | Contorno verde | Toggle |
| Infraestructura | Rojo/Amarillo/Verde | Toggle |
| Fondo | Streets / Satellite | Botón en panel |

### Flujo: Cambio de modo de visualización (colorMode)

Botones en el panel superior del mapa. Cambia el color de relleno de las parcelas.

| Modo | Color | Qué muestra |
|------|-------|-------------|
| `fiscal` | Azul/Rojo/Verde + Amarillo para fiscales | Estado fiscal + parcelas municipales |
| `agua` | Verde=con agua / Rojo=sin agua | Cobertura de agua corriente |
| `cloacas` | Azul/Rojo | Cobertura de cloacas |
| `servicios` | Gradiente rojo→verde | Cantidad de servicios básicos (0 a 4) |
| `pavimento` | Marrón/Gris/Negro | Tipo de pavimento en la cuadra |

**Referencia fiscal:**
- Relleno azul = al día
- Relleno rojo = moroso
- Relleno verde = exento
- Relleno amarillo = suelo fiscal municipal
- Borde rojo punteado = fiscal + estado conflictivo (Usurpado / En Litigio)

**Cómo probar:**
1. Loguear como cualquier rol
2. Ir al mapa
3. Hacer clic en cada botón de modo y observar que los colores de parcelas cambian
4. Verificar que parcelas fiscales se muestran amarillas en modo fiscal

### Flujo: Búsqueda en el mapa

**SearchBar** (barra superior izquierda) — acepta dos tipos de búsqueda:

**Por N° de Padrón:**
1. Escribir el número de padrón (ej: `1234`)
2. Presionar Enter o botón "IR"
3. El mapa centra y hace zoom sobre la parcela
4. Se abre el sidebar con la info de la parcela

**Por Plus Code (Google):**
1. Escribir un Plus Code completo (ej: `7C7R+8F Añatuya`) o código corto (ej: `7C7R+8F`)
2. El sistema decodifica la coordenada usando Añatuya como referencia
3. El mapa centra en esa ubicación

**Cómo probar:**
- Buscar padrón existente → sidebar se abre con datos
- Buscar padrón inexistente → alert "No se encontró"
- Buscar Plus Code válido → mapa centra en esa coordenada

### Flujo: Click en una parcela

1. Clic sobre cualquier polígono de parcela
2. Se abre el sidebar derecho con 3 tabs: **General**, **Ficha**, **Fiscal/Legal**
3. Tab General muestra: N° padrón, propietario, barrio, superficie, estado, servicios
4. Tab Ficha muestra campos de edificación (editables para editor/admin)
5. Tab Fiscal/Legal muestra campos del módulo D (editables para editor/admin)

**Cómo probar (como editor):**
- Clic en parcela → sidebar abre
- Ir a tab Ficha → editar superficie cubierta → "Guardar Ficha"
- Cerrar sidebar → volver a clicar → verificar que el dato persiste

### Flujo: Click en un reporte de infraestructura

1. Clic sobre un marcador circular (rojo=bache, amarillo=luminaria, verde=basural)
2. **Se abre directamente el InfraModal** (sin necesidad de botón extra)
3. El modal muestra tipo, estado actual, responsable/cuadrilla, fechas, historial

**Comportamiento por rol:**
- `consultor`: modal abre en modo lectura, sin formulario, sin botones
- `tecnico`: modal abre con formulario editable (solo para sus propios reportes)
- `editor`/`administrador`: modal abre con formulario + sección de adjudicación a técnico

---

## 4. Catastro — Parcelas

### Flujo: Crear parcela (rol: editor+)

1. En el mapa, **clic derecho** en cualquier lugar vacío
2. Menú contextual aparece → sección superior aún no contiene crear parcela directa
3. **Alternativa:** Botón "+ Parcela" en la barra inferior izquierda del mapa
4. Cursor cambia a modo dibujo (polígono)
5. Hacer clic para cada vértice del polígono
6. **Cerrar:** Clic sobre el primer vértice para cerrar la figura
7. Ventana emergente pide el N° de padrón
8. Confirmar → parcela guardada y coloreada en el mapa

**Validación:** Si la parcela se superpone con otra existente → error "La parcela se superpone con otra"

**Cómo probar:**
- Crear parcela en zona vacía → debe aparecer azul (al_día por default)
- Intentar crear sobre otra parcela → debe mostrar error
- Consultor no ve el botón "+ Parcela" (ocultado en UI)

### Flujo: Editar geometría de parcela (rol: editor+)

1. Clic en una parcela → sidebar abre
2. Botón "✏️ Modificar Forma" en sidebar
3. Vértices de la parcela se vuelven arrastrables (Geoman)
4. Arrastrar vértices para modificar
5. Botón "💾 Guardar Cambios" confirma → enviado al servidor
6. Botón "✕ Cancelar" descarta cambios

**Validación:** También valida superposición al editar.

### Flujo: Asignar propietario a parcela (rol: editor+)

1. Clic en parcela → sidebar Tab "General"
2. Dropdown "Propietario" → lista todos los propietarios de DB
3. Seleccionar → cambio inmediato en DB
4. Nombre del propietario aparece en el sidebar y en el GeoJSON

### Flujo: Gestión de propietarios (rol: editor+)

1. Botón "👥 Propietarios" en la barra inferior del mapa
2. Modal PropietariosModal con lista de propietarios
3. **Crear:** Formulario con nombre, apellido, DNI, contacto
4. **Editar:** Clic en propietario existente → campos se rellenan
5. **Buscar:** Campo de búsqueda filtra en tiempo real

**Cómo probar:**
- Crear propietario nuevo → debe aparecer en el dropdown de parcelas
- Editar propietario existente → cambios reflejados en parcelas asignadas

### Flujo: Cédula Catastral PDF (rol: cualquiera)

**Desde el mapa:**
1. Clic en parcela → sidebar
2. Botón "📄 Descargar Cédula PDF" (visible para administrador en el sidebar; o desde el botón en la ficha)

**Desde el dashboard:**
1. Ir a `/dashboard` → tab "Catastro"
2. Botón "📄" en la columna de acciones de cada fila

**Contenido del PDF (4 secciones):**
1. **Identificación** — Padrón, propietario, barrio, superficie, estado fiscal, es_fiscal, estado_ocupación, destino
2. **Módulo A — Servicios** — Agua, electricidad, cloacas, gas, alumbrado, pavimento
3. **Módulo B — Edificación** — Sup. cubierta, plantas, antigüedad, categoría, conservación
4. **Módulo C — Legal** — N° plano, expediente, zonificación, restricciones

**Cómo probar:**
- Descargar PDF de parcela con todos los datos completos → verificar las 4 secciones
- Descargar PDF de parcela sin datos → campos deben mostrar "—"

### Flujo: Cambiar estado fiscal (rol: administrador)

1. Clic en parcela → sidebar → botones de estado en la parte inferior
2. Opciones: AL DÍA / MOROSO / EXENTO
3. Clic confirma inmediatamente sin modal adicional
4. Color de la parcela cambia en el mapa

### Flujo: Eliminar parcela (rol: administrador)

1. Clic en parcela → sidebar
2. Botón "🗑️ Eliminar Parcela" (solo visible para administrador)
3. Confirmación del navegador
4. Parcela eliminada del mapa y de la DB

---

## 5. Infraestructura Urbana

### Tipos de reporte

| Tipo | Marcador | Color |
|------|---------|-------|
| Bache | Círculo | Rojo |
| Luminaria | Círculo | Amarillo |
| Basural | Círculo | Verde |
| Reparación calle | Línea | Amarillo |
| Limpieza cuneta | Línea | Azul |
| Calle clausurada | Línea | Rojo |

### Estados posibles
`funcional` · `dañado` · `en_reparacion` · `en_progreso` · `clausurado` · `pendiente` · `finalizado`

> Los reportes con estado `finalizado` no aparecen en el mapa (filtrado en DB).

### Flujo: Reportar incidencia puntual (bache, luminaria, basural) — rol: editor+

1. **Clic derecho** en el mapa en la ubicación del problema
2. Menú contextual → sección "Reportar Incidencia"
3. Seleccionar tipo: "Reportar Bache", "Luminaria Apagada" o "Punto de Basura"
4. Marcador aparece inmediatamente en el mapa
5. El reporte queda con estado `dañado` por defecto

**Cómo probar:**
- Clic derecho → crear bache → marcador rojo debe aparecer
- Verificar en dashboard tab "Obras" que aparece el nuevo reporte

### Flujo: Reportar obra vial (línea) — rol: editor+

1. Clic derecho → sección "Gestión de Cuadras"
2. Opciones: "Calle en Obra", "Limpieza Cuneta", "Calle Clausurada"
3. Cursor cambia a modo trazar línea
4. Clic para cada punto de la línea
5. **Doble clic** para terminar
6. Línea guardada en DB

### Flujo: Gestionar un reporte — rol: tecnico+

1. Clic sobre el marcador del reporte → InfraModal se abre
2. **Estado:** Seleccionar el nuevo estado (botones de grilla)
3. **Responsable/Cuadrilla:** Dropdown con personal registrado en DB
4. **Cronograma:** Fecha inicio y fin estimado
5. **Observaciones:** Texto libre (cada guardado agrega un registro en historial)
6. Botón "Guardar Cambios" → actualiza DB + agrega registro al historial
7. Modal cierra y el mapa se refresca

**Restricción técnico:** Solo puede guardar si el reporte tiene `adjudicado_a = session.user.id`

**Cómo probar:**
- Editor abre reporte → cambia estado a "en_reparacion" → guarda → reabre y verifica historial
- Técnico intenta guardar reporte no asignado → error del servidor

### Historial de actividad

Cada guardado en InfraModal genera un registro en `historial_obras` con:
- Estado anterior y nuevo
- Responsable/cuadrilla
- Observaciones
- Timestamp automático

El historial se muestra dentro del mismo InfraModal al final del formulario.

---

## 6. Sistema de Responsabilidades

### Prerequisito
Ejecutar la migración: `node add_responsabilidades.mjs`

Esta migración agrega:
- Restricción `tecnico` al check de roles en tabla `usuarios`
- Columna `adjudicado_a UUID` en tabla `infraestructura`
- Columna `fecha_adjudicacion TIMESTAMPTZ` en tabla `infraestructura`

### Flujo: Crear usuario técnico (rol: administrador)

1. Ir a `/admin`
2. Botón "+ Nuevo Usuario"
3. Completar nombre, email, contraseña
4. Seleccionar rol: **técnico**
5. Confirmar

**Cómo probar:**
- Crear técnico → loguear como ese técnico → debe llegar a `/mis-reportes` con lista vacía

### Flujo: Adjudicar reporte a técnico (rol: editor+)

1. En el mapa, hacer clic sobre cualquier reporte de infraestructura
2. InfraModal se abre → ver sección azul "Técnico Responsable" en la parte superior
3. Dropdown muestra todos los técnicos activos del sistema
4. Seleccionar técnico → botón "Adjudicar"
5. Sistema actualiza `adjudicado_a` y `fecha_adjudicacion` en DB
6. El técnico ya puede ver y gestionar ese reporte

**Si no hay técnicos activos:** La sección muestra "No hay técnicos activos. Creá uno desde /admin."

**Cómo probar:**
1. Crear usuario técnico desde `/admin`
2. Como editor: abrir reporte → adjudicar al técnico → verificar que aparece el nombre en la sección
3. Loguear como técnico → `/mis-reportes` → debe mostrar el reporte asignado

### Flujo: Vista del técnico — /mis-reportes

**Acceso:** Técnicos van directamente aquí al loguear. Otros roles pueden acceder pero el contenido varía.

**Contenido:**
- Cards de reportes asignados al técnico logueado
- Cada card muestra: tipo, estado (badge de color), fecha adjudicación, fecha inicio/fin
- Filtro por estado en la barra superior
- Badge de cuenta en el sidebar (rojo, muestra reportes en estados activos)
- Botón "Gestionar Reporte" abre InfraModal en modo técnico

**Modos del badge:**
- Badge visible: reportes con estado != `finalizado` y != `funcional`
- Badge `9+` si hay más de 9 pendientes

**Cómo probar:**
1. Loguear como técnico con reportes asignados
2. Verificar que solo se muestran SUS reportes (no todos)
3. Gestionar uno → cambiar estado a "finalizado" → refrescar → debe desaparecer del badge count
4. Usar el filtro de estado → verificar que filtra correctamente

### Flujo: Vista del mapa para técnico

- El técnico accede al mapa (`/`)
- `getInfraestructuraGeoJSON()` filtra por `adjudicado_a = session.user.id`
- Solo ve los marcadores de sus reportes asignados (no todos)
- No ve botones de dibujo, ni menú contextual de creación
- Puede clicar marcadores y gestionar el reporte desde InfraModal

---

## 7. Dashboard y Exportaciones

**Ruta:** `/dashboard`
**Acceso:** administrador, editor, consultor (técnicos son redirigidos a `/mis-reportes`)

### Tab Catastro

**Filtros disponibles:**
- Búsqueda libre (padrón o nombre de propietario)
- Barrio (dropdown)
- Estado fiscal (al_día / moroso / exento)
- Suelo fiscal (todos / solo fiscal / no fiscal)

**Acciones por fila:**
- `🗺️ Mapa` — redirige al mapa con parámetro `?padron=X`, centra en la parcela
- `📄 PDF` — descarga inmediata de la cédula catastral completa

**Exportar CSV:**
- Botón "Exportar CSV" descarga las filas actualmente filtradas
- Incluye todos los campos de la tabla (17 campos extendidos + barrio + superficie)

**Cómo probar:**
- Filtrar por barrio → solo deben aparecer parcelas de ese barrio
- Filtrar por estado "moroso" → solo parcelas morosas
- Exportar CSV con filtros activos → verificar que el archivo solo tiene las filas filtradas

### Tab Obras (Infraestructura)

**Filtros:**
- Búsqueda libre (tipo o responsable)
- Tipo (bache, luminaria, basural, obra vial...)
- Estado

**Columnas adicionales (post Etapa 6):**
- Técnico adjudicado (`adjudicado_nombre`)
- Fecha de adjudicación

### Tab Historial

- Muestra los últimos 200 registros de `historial_obras`
- Columnas: reporte, estado anterior → nuevo, responsable, observaciones, fecha

### Cómo probar el dashboard:
1. Ir a `/dashboard` como editor
2. Tab Catastro → aplicar filtros sucesivos → contar que el número de resultados cambia
3. Descargar PDF de una parcela → verificar las 4 secciones
4. Exportar CSV → abrir en Excel, verificar columnas y datos

---

## 8. Administración de Usuarios

**Ruta:** `/admin`
**Acceso:** solo administrador (otros roles redirigen a `/dashboard`)

### Flujo: Crear usuario

1. Botón "+ Nuevo Usuario"
2. Completar: nombre, email, contraseña (mín. 6 chars), rol
3. Confirmar
4. Toast verde de confirmación
5. Usuario aparece en la tabla

**Roles disponibles al crear:** administrador, editor, técnico, consultor

### Flujo: Cambiar rol

1. En la tabla de usuarios, dropdown en columna "Rol"
2. Cambiar directamente
3. Guardado automático al seleccionar
4. Toast de confirmación

**Restricción:** No podés cambiar tu propio rol (retorna error del servidor)

### Flujo: Suspender / Activar cuenta

1. Botón "🔒 Suspender" o "✓ Activar" en la fila del usuario
2. Toggle inmediato
3. Usuario suspendido no puede loguear (auth.js verifica `activo`)

**Restricción:** No podés suspender tu propia cuenta

### Flujo: Resetear contraseña

1. Botón "🔑 Contraseña" en la fila
2. Modal emergente con campo de nueva contraseña
3. Confirmar → nueva contraseña hasheada con bcrypt y guardada

### Tabla de referencia de permisos

La página `/admin` muestra al pie una grilla de 4 columnas con los permisos de cada rol para referencia visual del administrador.

### Cómo probar:
1. Crear usuario con cada rol y verificar que las redirecciones y permisos corresponden
2. Suspender usuario → intentar loguear → debe fallar
3. Resetear contraseña → loguear con la nueva
4. Intentar cambiar tu propio rol → debe mostrar error

---

## 9. Referencia de Server Actions

**Archivo:** `src/app/actions/geoActions.js`

Todas las funciones son `async` y retornan datos o `{ success: true }` / `{ error: string }`.

### Lectura (cualquier autenticado)

| Función | Descripción |
|---------|-------------|
| `getParcelasGeoJSON()` | GeoJSON con todas las parcelas y sus propiedades |
| `getBarriosGeoJSON()` | GeoJSON de todos los barrios |
| `getInfraestructuraGeoJSON()` | GeoJSON de infraestructura activa; filtra por técnico si aplica |
| `getPropietarios()` | Lista de propietarios para dropdown |
| `getPersonal()` | Lista de cuadrillas/personal para InfraModal |
| `searchParcelaByPadron(padron)` | Busca parcela por padrón + retorna centroide |
| `getParcelasTable()` | Tabla con todos los campos extendidos para dashboard |
| `getInfraestructuraTable()` | Tabla con info adjudicación para dashboard |
| `getHistorialObra(infraId)` | Historial de cambios de un reporte específico |
| `getHistorialGlobal()` | Últimos 200 registros de historial |
| `getTecnicos()` | Lista de usuarios con rol técnico activos |
| `getMisReportes()` | Reportes adjudicados al técnico logueado |
| `getReportesPendientesCount()` | Conteo badge para sidebar de técnico |

### Escritura editor+

| Función | Descripción |
|---------|-------------|
| `createParcela(padron, geometry)` | Crea parcela con validación de superposición |
| `updateGeometry(id, geometry, type)` | Actualiza geometría de parcela o barrio |
| `createBarrio(nombre, geometry)` | Crea nuevo barrio |
| `updateParcelaPropietario(parcelaId, propietarioId)` | Asigna propietario |
| `updateInfraestructura(id, data)` | Actualiza estado/fechas/observaciones de reporte |
| `updateParcelaEstado(id, nuevoEstado)` | Cambia estado fiscal |
| `createPropietario(data)` | Crea propietario |
| `updatePropietario(id, data)` | Edita propietario |
| `createIncidencia({ tipo, lat, lng })` | Crea reporte puntual |
| `createObraVial(tipo, geometry)` | Crea reporte lineal |
| `updateParcelaFicha(id, data)` | Guarda todos los campos extendidos |
| `adjudicarReporte(infraId, usuarioId)` | Adjudica reporte a técnico |

### Escritura administrador

| Función | Descripción |
|---------|-------------|
| `deleteFeature(id, type)` | Elimina parcela, barrio o reporte |
| `getUsuarios()` | Lista usuarios del sistema |
| `createUsuario(data)` | Crea usuario con password hasheado |
| `updateUsuarioRol(id, rol)` | Cambia rol (no el propio) |
| `toggleUsuarioActivo(id)` | Suspende/activa cuenta (no la propia) |
| `resetUsuarioPassword(id, password)` | Resetea contraseña |

---

## 10. Convenciones y Casos Borde

### Dibujo de polígonos
- **Cerrar polígono:** Clicar sobre el primer vértice (no hay doble clic)
- **Cancelar dibujo:** Presionar Escape o botón "Cancelar" que aparece durante el dibujo

### Datos faltantes en PDF
- Campos vacíos o nulos se muestran como `—` en el PDF
- Booleanos nulos se muestran como `No`

### getParcelasGeoJSON silencioso
- Si la query falla, retorna `EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] }`
- El mapa sigue funcionando sin datos en lugar de romper

### Parcelas sin barrio
- El JOIN con barrios usa `ST_Intersects` (geográfico)
- Parcelas fuera de cualquier barrio dibujado muestran "Sin Barrio" en el dashboard

### Técnico sin reportes adjudicados
- `/mis-reportes` muestra un estado vacío con mensaje explicativo
- Badge en sidebar no se muestra si el count es 0

### Superposición de parcelas
- `createParcela` y `updateGeometry` validan con `ST_Intersects` antes de guardar
- Si hay superposición, el servidor retorna `{ error: "La parcela se superpone con otra." }`

### Barra lateral de técnico en el mapa
- No se muestra la barra de botones de dibujo ("+Parcela", "+Barrio", "Propietarios")
- No se muestra el menú contextual (clic derecho)
- Al clicar en una parcela se abre el sidebar en modo lectura
- Al clicar en un reporte propio se abre InfraModal editable

### Plus Code — zona de referencia
- Los códigos cortos se recuperan usando el centroide de Añatuya (-28.4606, -62.8347)
- Si se usa GeoMuni en otro municipio, actualizar estas coordenadas en `SearchBar.jsx`

---

## Scripts de Utilidad

| Script | Propósito |
|--------|-----------|
| `node setup_auth_db.mjs` | Inicializa DB de autenticación + usuario admin |
| `node repair_admin.mjs` | Repara cuenta admin si el login falla |
| `node apply_migration.mjs` | Agrega los 17 campos extendidos a parcelas |
| `node add_activo_column.mjs` | Agrega columna `activo` a tabla usuarios |
| `node add_responsabilidades.mjs` | Agrega rol tecnico + columnas adjudicación |
| `node clear_parcelas.mjs` | Borra todas las parcelas (reset de datos de prueba) |
