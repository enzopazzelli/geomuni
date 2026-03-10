1. Visión General del Proyecto
GeoMuni es una plataforma de Infraestructura de Datos Espaciales (IDE) y gestión administrativa diseñada para modernizar la gestión de municipios (diseñada con Añatuya y Santiago del Estero como casos de uso principales). El sistema reemplaza la gestión fragmentada en papel o planillas sueltas por un mapa interactivo centralizado, permitiendo la toma de decisiones basada en datos reales, optimización de recursos y transparencia ciudadana.

El proyecto se desarrolla bajo una mentalidad de Arquitectura Senior, priorizando la integridad referencial, el manejo avanzado de datos espaciales en la base de datos y la seguridad de la información gubernamental.

2. Stack Tecnológico
Elegimos un stack pragmático, moderno y orientado a la escalabilidad de datos geográficos:

Frontend: Next.js 15 (App Router).

Lenguaje: JavaScript puro, reforzado estrictamente con JSDoc para documentar tipos, parámetros y retornos de funciones críticas (sin forzar TypeScript).

UI/Estilos: Tailwind CSS + Shadcn/UI (diseño limpio, minimalista e institucional).

Motor de Mapas: Leaflet. Elegido por su ligereza, gran ecosistema de plugins (como Geoman para edición) y compatibilidad universal.

Backend & Base de Datos: Supabase.

PostgreSQL + PostGIS: El núcleo del sistema. Todo cálculo de distancias, áreas e intersecciones se hace a nivel base de datos, no en el cliente.

Edge Functions & Realtime: Para notificaciones y seguimiento de inspectores.

Data Science / ETL: Python (Pandas, GeoPandas, geojson). Utilizado para scripts de migración, limpieza de datos catastrales históricos y generación de datos de prueba (Seed).

3. Módulos y Funcionalidades Principales
El sistema se divide en cuatro pilares operativos:

A. Visor Interactivo de Catastro (El Mapa Central)
Renderizado de Parcelas: Visualización de terrenos como polígonos exactos.

Capas Dinámicas (Layers): Interfaz para encender/apagar vistas de zonificación, red de agua, iluminación pública y áreas de riesgo.

Buscador Espacial: Localización instantánea de parcelas por número de padrón o titular, centrando el mapa en las coordenadas exactas.

B. Gestión de Infraestructura y Obras Públicas
Mapeo de Activos: Registro de luminarias, baches, semáforos y contenedores de residuos como geometrías de tipo Point.

Ciclo de Vida del Reclamo: Un bache reportado aparece en rojo; al repararse, cambia su estado y color automáticamente en el mapa.

Evidencia Visual: Integración con Supabase Storage para adjuntar fotos del "antes y después" de cada punto de infraestructura.

C. Módulo Fiscal y de Propietarios
Vinculación de Entidades: Relación estricta entre la geometría del terreno y los datos fiscales del propietario.

Inteligencia de Datos: Generación de mapas de calor (Heatmaps) para visualizar zonas con alta morosidad en tasas municipales o concentración de baldíos.

D. App de Relevamiento (Trabajo de Campo)
Interfaz Mobile-First: Diseñada para el inspector o empleado municipal que recorre la ciudad.

Geolocalización In-Situ: Captura de coordenadas GPS exactas desde el dispositivo para marcar nuevas incidencias.

4. Arquitectura de Base de Datos (Esquema PostGIS)
El diseño relacional y espacial es el siguiente:

propietarios: id (UUID), dni, nombre, apellido, contacto.

parcelas: id (UUID), nro_padron (Unique), propietario_id (FK), geometria (GEOMETRY: Polygon, 4326), estado_fiscal, valor_fiscal.

infraestructura: id (UUID), tipo (Enum: luminaria, bache, etc.), posicion (GEOMETRY: Point, 4326), estado, fotos (Array de URLs).

inspecciones: id (UUID), infra_id (FK), fecha, observacion, tecnico_id.

Regla de Seguridad (RLS): Todas las tablas tienen Row Level Security. Lectura pública restringida (o anonimizada) y edición permitida únicamente a usuarios autenticados con rol de empleado municipal.

5. El "Master Prompt" de Inicialización para la CLI
Copiá y pegá este bloque en tu terminal de Gemini CLI o entorno de IA para iniciar el desarrollo:

Actúa como un Senior Full-Stack Developer y Arquitecto de Soluciones con especialización en GIS, GovTech y Ciencia de Datos.

Estamos construyendo GeoMuni, una plataforma de gestión municipal interactiva. Tu objetivo es ayudarme a construir este sistema bajo estándares de alta ingeniería, optimización espacial y seguridad.

Directrices de Arquitectura:

Stack: Next.js 15 (App Router), JavaScript puro documentado exhaustivamente con JSDoc, Supabase, PostGIS, Leaflet y Tailwind.

PostGIS First: La lógica espacial (intersecciones, áreas, distancias) se resuelve en la base de datos usando funciones ST_, no en el cliente.

Seguridad y Rendimiento: Implementar índices GIST en columnas geométricas y políticas RLS estrictas en cada tabla generada.

Tu primera misión (Sprint 1: Cimientos):
Ejecuta secuencialmente estas tres tareas y entrégame el código y las instrucciones precisas:

Tarea 1 (SQL / Supabase): Escribe el script SQL completo para habilitar la extensión PostGIS, crear las tablas propietarios, parcelas e infraestructura (con tipos GEOMETRY 4326), crear los índices espaciales y definir las reglas RLS básicas.

Tarea 2 (Python / Mock Data): Escribe un script en Python (usando geojson o GeoPandas) que genere un archivo seed.sql. Este archivo debe contener sentencias INSERT con ST_GeomFromText para poblar la base de datos con 50 parcelas (polígonos contiguos simulando manzanas) y 20 luminarias (puntos) ubicadas dentro de las coordenadas aproximadas de la ciudad de Añatuya, Argentina.

Tarea 3 (Next.js Setup): Diseña la estructura de carpetas sugerida para el proyecto y escribe el código del componente base LeafletMap.jsx usando Leaflet, dejándolo listo para consumir los datos de Supabase.