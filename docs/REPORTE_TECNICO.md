# GeoMuni - Reporte de Ingeniería y Estado del Proyecto (Sprint 3 - Finalizado)

## 1. Logros Técnicos y Capacidades Actuales
Hemos evolucionado GeoMuni de un simple visor GIS a una plataforma integral de gestión municipal, conectando la representación espacial con un sólido sistema de auditoría alfanumérica.

### Panel de Control y Auditoría (Dashboard)
*   **Gestión Dual (Mapa/Tabla):** Creación de una ruta dedicada (`/dashboard`) que permite visualizar los datos en formato tabular, agrupados por áreas de gestión (Catastro, Infraestructura, Historial).
*   **Cálculo de Métricas Dinámicas:** Generación en tiempo real de indicadores críticos: total de superficie empadronada, índice de morosidad, reportes activos y obras en ejecución.
*   **Auto-enfoque Geográfico (FlyTo):** Integración profunda entre el Dashboard y el Mapa; un clic en la tabla redirige al mapa, ejecutando un vuelo preciso (`flyTo`) hacia el centroide de la parcela u obra seleccionada y abriendo automáticamente sus detalles.

### Control de Obras y Trazabilidad (Log de Auditoría)
*   **Cronograma de Obras:** Incorporación de fechas de inicio y fin estimado para cada reporte de infraestructura.
*   **Historial de Actividad (Logs):** Registro inmutable de cada cambio de estado, modificación de responsable o nota agregada, almacenado en la tabla `historial_obras`.
*   **Filtrado Inteligente:** Los reportes marcados como "Finalizados" desaparecen automáticamente del mapa para mantener la interfaz limpia, pero permanecen accesibles en el Dashboard para análisis histórico.

### Salida Documental
*   **Generación de Cédulas Catastrales:** Implementación de exportación PDF (`jsPDF`) desde el panel lateral, entregando un documento oficial con membrete municipal, datos del propietario, superficie y estado fiscal.

## 2. Tecnologías y Arquitectura
*   **Frontend:** Next.js 15, React, MapLibre GL JS, Tailwind CSS.
*   **Backend:** Next.js Server Actions, PostgreSQL (Neon) con PostGIS.
*   **Seguridad:** Auth.js v5 (Beta) con encriptación bcryptjs y roles persistentes.
*   **Capas Base:** Vista dual (Streets/Satellite). Se utiliza Esri World Imagery para la vista satelital.

### ⚠️ Limitación Crítica Identificada: Resolución de Imagen (Zoom)
A pesar de la implementación de técnicas de *Overzooming* (escalado de tiles hasta nivel 24), la resolución óptica de la imagen satelital gratuita (Esri) se degrada a partir del nivel 19. Esto genera una visualización borrosa en zoom profundo, lo cual es un inconveniente para el trazado milimétrico de parcelas. 

**Solución propuesta para Etapa 5:** Integrar un servidor de tiles de drones propios del municipio o adquirir una licencia de imágenes de alta resolución (Maxar/Planet) para permitir un zoom "casi ilimitado" con nitidez total.

## 3. Próximos Pasos Sugeridos (Etapa 4 - En progreso)
1.  **Autenticación Real (Auth):** [FINALIZADO] Sistema de login institucional operativo.
2.  **Capas Base Dinámicas:** [FINALIZADO] Vista híbrida satélite/calles operativa.
3.  **Exportación de Datos Excel/CSV:** Permitir que las tablas del Dashboard puedan descargarse.
4.  **Gestión Poligonal Avanzada (Split/Merge):** Herramientas para subdividir parcelas.
