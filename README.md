# GeoMuni - Plataforma de Gestión Territorial e IDE Municipal

GeoMuni es una Infraestructura de Datos Espaciales (IDE) diseñada para modernizar la administración catastral y de servicios urbanos en municipios. Combina la potencia de **PostGIS** con una interfaz de alta fidelidad para la toma de decisiones basada en datos geográficos.

## 🚀 Capacidades Actuales (v2.0)

### 🗺️ Motor GIS Avanzado
- **Edición Geométrica:** Modificación precisa de parcelas y barrios mediante selección directa de vértices (esquinas).
- **Validación Topológica:** Prevención automática de superposiciones espaciales para garantizar la integridad del catastro.
- **Cálculo de Superficies:** Cálculo dinámico de m² basado en el elipsoide terrestre (SRID 4326).

### 🚧 Gestión de Infraestructura y Obras
- **Reportes Ciudadanos:** Registro de baches, luminarias y basurales con geolocalización.
- **Tramos Lineales:** Gestión de cuadras en obra, limpieza de cunetas y calles clausuradas.
- **Trazabilidad Total:** Registro de responsables, fechas de inicio/fin y logs detallados de cada intervención urbana.

### 👥 Administración y Auditoría
- **Dashboard Integrado:** Tablas administrativas para auditoría masiva de parcelas e infraestructura.
- **Gestión de Propietarios:** Base de datos de contribuyentes vinculada dinámicamente a la propiedad territorial.
- **Cédula Catastral:** Generación automática de documentos oficiales en PDF.

## 🛠️ Stack Tecnológico
- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), [MapLibre GL JS](https://maplibre.org/).
- **Backend:** Next.js Server Actions.
- **Base de Datos:** [Neon](https://neon.tech/) (PostgreSQL + PostGIS).
- **Reportes:** [jsPDF](https://github.com/parallax/jsPDF).

## ⚙️ Configuración del Entorno

1. Clona el repositorio.
2. Copia `.env.local.example` a `.env.local` y configura tu `DATABASE_URL`.
3. Instala las dependencias:
   ```bash
   npm install
   ```
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

---
*Desarrollado para la modernización de la gestión pública.*
