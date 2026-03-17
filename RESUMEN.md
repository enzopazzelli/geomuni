# GeoMuni — ¿Qué es y para qué sirve?

GeoMuni es una plataforma web para municipios que permite gestionar reportes de problemas urbanos, coordinar al personal de campo, y mantener un registro geográfico del territorio. El eje del sistema son los reportes de infraestructura: desde que un vecino denuncia un bache hasta que un técnico lo resuelve, todo queda registrado y trazado en el mapa.

El catastro y la información de parcelas también forman parte del sistema y complementan esa visión territorial, pero el motor que le da vida al día a día municipal son los reportes y la gestión de obras.

---

## La idea principal

Cualquier vecino puede reportar un problema en la vía pública sin necesidad de registrarse, directamente desde el celular. Del otro lado, el municipio recibe ese reporte, lo asigna a un técnico, lo sigue hasta que se resuelve, y el vecino puede consultar el estado en cualquier momento con su número de ticket.

Ese flujo —reporte ciudadano → asignación interna → resolución → seguimiento— es el corazón de GeoMuni. Todo sucede sobre un mapa, con historial de cambios y notificaciones automáticas entre los usuarios del sistema.

---

## ¿Qué puede hacer el sistema?

### 1. Reporte ciudadano (sin registrarse)

Cualquier vecino puede entrar al sistema sin cuenta y reportar un problema en la vía pública:

1. Entrás al sitio o escaneás el código QR que el municipio puede poner en cartelería.
2. Elegís el tipo de problema (bache, luminaria, semáforo roto, basural, árbol caído, etc.).
3. Marcás el punto en el mapa o usás la ubicación del celular.
4. Subís una foto si tenés, describís el problema, y lo enviás.
5. Recibís un número de ticket único para hacer seguimiento.

Con ese número, el vecino puede consultar en cualquier momento en qué estado está su reclamo.

### 2. Gestión de infraestructura y obras públicas

Del lado del municipio, cada reporte tiene su propio ciclo de vida: se registra, se le asigna a un técnico responsable, pasa por los estados "en reparación" o "en progreso", y finalmente se cierra como resuelto. Todo queda en el mapa y en el historial.

Cada reporte puede tener fotos adjuntas, observaciones internas, y un log completo de quién hizo qué y cuándo. El técnico asignado recibe una notificación automática, y desde ella puede ir directo al reporte en el mapa con un clic.

El sistema soporta 9 tipos de problemas: baches, calles dañadas, semáforos, luminarias, cables caídos, basurales, escombros, árboles caídos y árboles peligrosos.

### 3. Mapa interactivo del municipio

Todo ocurre sobre un mapa. Los reportes de infraestructura aparecen como puntos geolocalizados; las parcelas, como polígonos coloreados según distintos criterios. Ambas capas conviven y se pueden activar o desactivar.

Para el catastro, el mapa tiene distintos modos de vista: podés colorear las parcelas según el estado fiscal (al día, moroso, etc.) o según qué servicios tienen (agua, cloacas, pavimento). Los morosos se marcan en rojo para que salten a la vista.

Las parcelas también se pueden dibujar y editar directamente sobre el mapa, con validación automática para que no se superpongan entre sí.

### 4. Panel de administración (Dashboard)

Los usuarios internos del municipio tienen acceso a un panel con tablas organizadas por secciones:

- **Obras:** todos los reportes de infraestructura, con filtros por tipo y estado. Es la sección más activa del panel.
- **Catastro:** listado de todas las parcelas, organizadas por barrio, con búsqueda y filtros.
- **Historial:** registro de todos los cambios que se hicieron en parcelas y obras a lo largo del tiempo.
- **Propietarios:** base de datos de los titulares de inmuebles, con la cantidad de parcelas que tiene cada uno.
- **Cuadrillas:** lista del personal con sus datos de contacto y especialidad.

Desde cualquier tabla se puede exportar la información a un archivo CSV para trabajar en Excel o similar.

### 5. Estadísticas y reportes en PDF

Hay una sección dedicada a métricas del municipio: cuántos reportes hay por tipo, cuántos están resueltos, cuántas parcelas están en cada estado fiscal, entre otros indicadores. Todo se puede exportar como PDF para presentar en informes o reuniones.

### 6. Fichas catastrales en PDF

Desde el mapa o el panel se puede generar una cédula catastral en PDF para cualquier parcela. El documento incluye todos los datos del inmueble y el titular.

### 7. Notificaciones internas

Cuando un reporte le es asignado a un técnico, o cuando cambia de estado, el sistema genera una notificación automática que le llega al usuario correspondiente. Desde la notificación se puede ir directamente al reporte en el mapa con un solo clic.

---

## ¿Quién usa el sistema y qué puede hacer cada uno?

El acceso está organizado en cuatro roles. Cada persona solo ve y puede hacer lo que corresponde a su función:

| Rol | ¿Para quién? | ¿Qué puede hacer? |
|---|---|---|
| **Administrador** | Jefe de sistemas o coordinador municipal | Todo: crear usuarios, eliminar registros, gestionar todo el sistema |
| **Editor** | Personal administrativo | Crear y editar parcelas, gestionar reportes, asignar tareas a técnicos |
| **Técnico** | Operarios o inspectores de campo | Ver y actualizar solo los reportes que les fueron asignados |
| **Consultor** | Autoridades, auditores, visitas | Solo lectura: pueden ver el mapa, catastro y estadísticas, pero no modificar nada |

Los usuarios pueden cambiar su contraseña desde su perfil, y el administrador puede suspender o reactivar cuentas.

---

## ¿Cómo se accede?

- El sistema corre como una aplicación web, accesible desde cualquier navegador.
- La página principal (`/inicio`) es pública y presenta el sistema.
- El formulario de reporte ciudadano (`/reportar`) también es público.
- El resto del sistema requiere iniciar sesión con usuario y contraseña.

---

## En resumen

GeoMuni conecta a los vecinos con el municipio a través de un sistema de reportes geolocalizados. Los ciudadanos denuncian problemas desde el celular; el municipio los recibe, los asigna, los resuelve, y rinde cuentas. El catastro y la información territorial son el fondo sobre el que todo eso ocurre.
