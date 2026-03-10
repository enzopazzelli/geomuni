'use server';

import { sql } from '@/lib/db';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

const ROLE_LEVEL = { consultor: 0, tecnico: 1, editor: 2, administrador: 3 };

async function requireRole(minRole) {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  const userLevel = ROLE_LEVEL[session.user.rol] ?? -1;
  if (userLevel < ROLE_LEVEL[minRole]) {
    throw new Error(`Permiso insuficiente. Se requiere rol: ${minRole}`);
  }
  return session.user;
}

// ─── NOTIFICACIONES (helper interno) ─────────────────────────────────────────

async function crearNotificacion(usuarioId, tipo, titulo, mensaje, referenciaId = null) {
  try {
    await sql`
      INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, referencia_id)
      VALUES (${usuarioId}, ${tipo}, ${titulo}, ${mensaje || null}, ${referenciaId || null})
    `;
  } catch (_) { /* no interrumpir flujo principal si falla notificación */ }
}

// ─── LECTURA (cualquier usuario autenticado) ──────────────────────────────────

export async function getParcelasGeoJSON() {
  try {
    const results = await sql`
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', p.id,
            'geometry', ST_AsGeoJSON(p.geometria)::jsonb,
            'properties', jsonb_build_object(
              'id', p.id,
              'nro_padron', p.nro_padron,
              'estado_fiscal', p.estado_fiscal,
              'superficie_m2', ROUND(ST_Area(p.geometria::geography)::numeric, 2),
              'propietario', COALESCE(pr.nombre || ' ' || pr.apellido, 'Sin Propietario'),
              'propietario_id', p.propietario_id,
              'tipo', 'Parcela',
              'agua_corriente', p.agua_corriente,
              'energia_electrica', p.energia_electrica,
              'cloacas', p.cloacas,
              'gas_natural', p.gas_natural,
              'pavimento', p.pavimento,
              'alumbrado_publico', p.alumbrado_publico,
              'superficie_cubierta', p.superficie_cubierta,
              'cantidad_plantas', p.cantidad_plantas,
              'antiguedad', p.antiguedad,
              'categoria_edificatoria', p.categoria_edificatoria,
              'estado_conservacion', p.estado_conservacion,
              'numero_plano', p.numero_plano,
              'expediente_municipal', p.expediente_municipal,
              'zonificacion', p.zonificacion,
              'restricciones', p.restricciones,
              'es_fiscal', p.es_fiscal,
              'estado_ocupacion', p.estado_ocupacion,
              'destino_previsto', p.destino_previsto
            )
          )
        ), '[]'::jsonb)
      ) as geojson
      FROM parcelas p
      LEFT JOIN propietarios pr ON p.propietario_id = pr.id;
    `;
    return results[0]?.geojson || EMPTY_GEOJSON;
  } catch (error) {
    console.error('getParcelasGeoJSON error:', error.message);
    return EMPTY_GEOJSON;
  }
}

export async function updateGeometry(id, geometry, type) {
  try {
    await requireRole('editor');
    if (type === 'Parcela') {
      const overlaps = await sql`
        SELECT id FROM parcelas
        WHERE ST_Intersects(geometria, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326))
        AND id != ${id}
        LIMIT 1;
      `;
      if (overlaps.length > 0) throw new Error("La parcela se superpone con otra.");
      await sql`
        UPDATE parcelas
        SET geometria = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326)
        WHERE id = ${id};
      `;
    } else {
      await sql`
        UPDATE barrios
        SET geometria = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326)
        WHERE id = ${id};
      `;
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function createParcela(padron, geometry) {
  try {
    await requireRole('editor');
    const overlaps = await sql`
      SELECT id FROM parcelas
      WHERE ST_Intersects(geometria, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326))
      LIMIT 1;
    `;
    if (overlaps.length > 0) throw new Error("La parcela se superpone con otra.");
    await sql`
      INSERT INTO parcelas (nro_padron, geometria, estado_fiscal)
      VALUES (${padron}, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326), 'al_dia');
    `;
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function createBarrio(nombre, geometry) {
  try {
    await requireRole('editor');
    await sql`INSERT INTO barrios (nombre, geometria) VALUES (${nombre}, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326));`;
    return { success: true };
  } catch (error) { return { error: error.message }; }
}

export async function deleteFeature(id, type) {
  try {
    await requireRole('administrador');
    if (type === 'Parcela') {
      await sql`DELETE FROM parcelas WHERE id = ${id}`;
    } else if (type === 'Barrio') {
      await sql`DELETE FROM barrios WHERE id = ${id}`;
    } else {
      await sql`DELETE FROM infraestructura WHERE id = ${id}`;
    }
    return true;
  } catch (error) {
    console.error("Delete Error:", error);
    return false;
  }
}

export async function getPropietarios() {
  try {
    return await sql`SELECT id, nombre, apellido, dni, contacto FROM propietarios ORDER BY apellido ASC;`;
  } catch (error) { return []; }
}

// ─── HISTORIAL PARCELAS ───────────────────────────────────────────────────────

async function _logParcelaChange(parcelaId, tipoCambio, descripcion, valorAnterior, valorNuevo, usuarioId, usuarioNombre) {
  try {
    await sql`
      INSERT INTO historial_parcelas (parcela_id, tipo_cambio, descripcion, valor_anterior, valor_nuevo, usuario_id, usuario_nombre)
      VALUES (${parcelaId}, ${tipoCambio}, ${descripcion || null}, ${valorAnterior || null}, ${valorNuevo || null}, ${usuarioId || null}, ${usuarioNombre || null})
    `;
  } catch (_) { /* no interrumpir flujo principal */ }
}

export async function getHistorialParcela(parcelaId) {
  try {
    const session = await auth();
    if (!['consultor', 'administrador'].includes(session?.user?.rol)) throw new Error('Sin permiso');
    return await sql`
      SELECT id, tipo_cambio, descripcion, valor_anterior, valor_nuevo,
             usuario_nombre, fecha
      FROM historial_parcelas
      WHERE parcela_id = ${parcelaId}
      ORDER BY fecha DESC
      LIMIT 100;
    `;
  } catch (error) { return []; }
}

export async function updateParcelaPropietario(parcelaId, propietarioId) {
  try {
    const user = await requireRole('editor');
    // Fetch previous propietario for history
    const [prev] = await sql`
      SELECT pr.nombre || ' ' || pr.apellido AS nombre
      FROM parcelas p
      LEFT JOIN propietarios pr ON p.propietario_id = pr.id
      WHERE p.id = ${parcelaId}
    `;
    const pid = propietarioId || null;
    await sql`UPDATE parcelas SET propietario_id = ${pid} WHERE id = ${parcelaId};`;
    // Fetch new propietario name
    const [next] = await sql`
      SELECT nombre || ' ' || apellido AS nombre FROM propietarios WHERE id = ${propietarioId}
    `;
    await _logParcelaChange(
      parcelaId,
      'Cambio de titular',
      `Titular actualizado`,
      prev?.nombre || 'Sin titular',
      next?.nombre || 'Sin titular',
      user.id, user.name ?? user.email
    );
    return true;
  } catch (error) { return false; }
}

export async function getBarriosGeoJSON() {
  try {
    const results = await sql`
      SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(
          jsonb_build_object(
            'type', 'Feature',
            'id', id,
            'geometry', ST_AsGeoJSON(geometria)::jsonb,
            'properties', jsonb_build_object('id', id, 'nombre', nombre, 'tipo', 'Barrio')
          )
        ), '[]'::jsonb)
      ) as geojson FROM barrios;
    `;
    return results[0]?.geojson || EMPTY_GEOJSON;
  } catch (error) { return EMPTY_GEOJSON; }
}

export async function getInfraestructuraGeoJSON() {
  try {
    const session = await auth();
    const user = session?.user;
    const isTecnico = user?.rol === 'tecnico';

    let results;
    if (isTecnico) {
      results = await sql`
        SELECT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'id', i.id,
              'geometry', ST_AsGeoJSON(i.posicion)::jsonb,
              'properties', jsonb_build_object(
                'id', i.id,
                'tipo', i.tipo,
                'estado', i.estado,
                'responsable_id', i.responsable_id,
                'responsable_nombre', p.nombre,
                'cuadrilla', p.cuadrilla,
                'fecha_inicio', i.fecha_inicio,
                'fecha_fin', i.fecha_fin,
                'adjudicado_a', i.adjudicado_a,
                'adjudicado_nombre', u.nombre,
                'fecha_adjudicacion', i.fecha_adjudicacion,
                'observaciones', i.observaciones,
                'fotos', i.fotos
              )
            )
          ), '[]'::jsonb)
        ) as geojson
        FROM infraestructura i
        LEFT JOIN personal p ON i.responsable_id = p.id
        LEFT JOIN usuarios u ON i.adjudicado_a = u.id
        WHERE i.estado != 'finalizado' AND i.adjudicado_a = ${user.id};
      `;
    } else {
      results = await sql`
        SELECT jsonb_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(jsonb_agg(
            jsonb_build_object(
              'type', 'Feature',
              'id', i.id,
              'geometry', ST_AsGeoJSON(i.posicion)::jsonb,
              'properties', jsonb_build_object(
                'id', i.id,
                'tipo', i.tipo,
                'estado', i.estado,
                'responsable_id', i.responsable_id,
                'responsable_nombre', p.nombre,
                'cuadrilla', p.cuadrilla,
                'fecha_inicio', i.fecha_inicio,
                'fecha_fin', i.fecha_fin,
                'adjudicado_a', i.adjudicado_a,
                'adjudicado_nombre', u.nombre,
                'fecha_adjudicacion', i.fecha_adjudicacion,
                'observaciones', i.observaciones,
                'fotos', i.fotos
              )
            )
          ), '[]'::jsonb)
        ) as geojson
        FROM infraestructura i
        LEFT JOIN personal p ON i.responsable_id = p.id
        LEFT JOIN usuarios u ON i.adjudicado_a = u.id
        WHERE i.estado != 'finalizado';
      `;
    }
    return results[0]?.geojson || EMPTY_GEOJSON;
  } catch (error) { return EMPTY_GEOJSON; }
}

export async function getPersonal() {
  try {
    return await sql`SELECT id, nombre, cuadrilla, especialidad, telefono, email, COALESCE(activo, TRUE) AS activo FROM personal ORDER BY nombre ASC;`;
  } catch (error) { return []; }
}

export async function createPersonal({ nombre, cuadrilla, especialidad, telefono, email }) {
  await requireRole('editor');
  if (!nombre?.trim()) throw new Error('El nombre es requerido');
  const result = await sql`
    INSERT INTO personal (nombre, cuadrilla, especialidad, telefono, email, activo)
    VALUES (${nombre.trim()}, ${cuadrilla || null}, ${especialidad || null}, ${telefono || null}, ${email || null}, TRUE)
    RETURNING id, nombre, cuadrilla, especialidad, telefono, email, activo
  `;
  return result[0];
}

export async function updatePersonal(id, { nombre, cuadrilla, especialidad, telefono, email, activo }) {
  await requireRole('editor');
  if (!nombre?.trim()) throw new Error('El nombre es requerido');
  const result = await sql`
    UPDATE personal
    SET nombre = ${nombre.trim()}, cuadrilla = ${cuadrilla || null}, especialidad = ${especialidad || null},
        telefono = ${telefono || null}, email = ${email || null}, activo = ${activo ?? true}
    WHERE id = ${id}
    RETURNING id, nombre, cuadrilla, especialidad, telefono, email, activo
  `;
  return result[0];
}

export async function deletePersonal(id) {
  await requireRole('administrador');
  await sql`DELETE FROM personal WHERE id = ${id}`;
}

export async function updateInfraestructura(id, { estado, responsable_id, fecha_inicio, fecha_fin, observaciones }) {
  try {
    const session = await auth();
    if (!session?.user) throw new Error('No autenticado');
    const user = session.user;
    const level = ROLE_LEVEL[user.rol] ?? -1;

    if (level < ROLE_LEVEL['tecnico']) {
      throw new Error('Permiso insuficiente.');
    }

    // Técnico solo puede actualizar reportes adjudicados a sí mismo
    if (user.rol === 'tecnico') {
      const check = await sql`SELECT adjudicado_a FROM infraestructura WHERE id = ${id}`;
      if (check[0]?.adjudicado_a !== user.id) {
        throw new Error('Solo podés actualizar reportes que te fueron asignados.');
      }
    }

    const current = await sql`SELECT estado FROM infraestructura WHERE id = ${id}`;
    const estadoAnterior = current[0]?.estado;

    await sql`
      UPDATE infraestructura
      SET
        estado = ${estado},
        responsable_id = ${responsable_id || null},
        fecha_inicio = ${fecha_inicio || null},
        fecha_fin = ${fecha_fin || null}
      WHERE id = ${id};
    `;

    await sql`
      INSERT INTO historial_obras (infraestructura_id, estado_anterior, estado_nuevo, responsable_id, observaciones)
      VALUES (${id}, ${estadoAnterior}, ${estado}, ${responsable_id || null}, ${observaciones || ''});
    `;

    // Notificar a editores/admins si el técnico finaliza o actualiza estado
    if (user.rol === 'tecnico' && estado !== estadoAnterior) {
      const infra = await sql`SELECT tipo FROM infraestructura WHERE id = ${id}`;
      const tipo = (infra[0]?.tipo || '').replace(/_/g, ' ');
      const editores = await sql`
        SELECT id FROM usuarios WHERE rol IN ('editor', 'administrador') AND activo = TRUE
      `;
      const titulo = estado === 'finalizado'
        ? `Reporte finalizado por técnico`
        : `Estado de reporte actualizado`;
      const mensaje = `El técnico ${user.name || user.email} cambió "${tipo}" a "${estado.replace(/_/g, ' ')}"`;
      if (editores.length > 0) {
        const rows = editores.map(ed => ({
          usuario_id: ed.id, tipo: 'actualizacion', titulo, mensaje,
          referencia_id: id,
        }));
        try {
          await sql`INSERT INTO notificaciones ${sql(rows, 'usuario_id', 'tipo', 'titulo', 'mensaje', 'referencia_id')}`;
        } catch (_) {}
      }
    }

    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function updateInfraGeometry(id, geometry, observaciones) {
  try {
    const session = await auth();
    if (!session?.user) throw new Error('No autenticado');
    const level = ROLE_LEVEL[session.user.rol] ?? -1;
    if (level < ROLE_LEVEL['tecnico']) throw new Error('Permiso insuficiente.');

    // Técnico solo puede modificar tramos adjudicados a sí mismo
    if (session.user.rol === 'tecnico') {
      const check = await sql`SELECT adjudicado_a FROM infraestructura WHERE id = ${id}`;
      if (check[0]?.adjudicado_a !== session.user.id) {
        throw new Error('Solo podés modificar tramos que te fueron asignados.');
      }
    }

    const current = await sql`SELECT estado FROM infraestructura WHERE id = ${id}`;
    const estado = current[0]?.estado;
    await sql`
      UPDATE infraestructura
      SET posicion = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326)
      WHERE id = ${id}
    `;
    await sql`
      INSERT INTO historial_obras (infraestructura_id, estado_anterior, estado_nuevo, observaciones)
      VALUES (${id}, ${estado}, ${estado}, ${observaciones?.trim() || 'Geometría del tramo actualizada'})
    `;
    return { success: true };
  } catch (error) { return { error: error.message }; }
}

export async function getHistorialObra(infraId) {
  try {
    return await sql`
      SELECT h.*, p.nombre as responsable_nombre
      FROM historial_obras h
      LEFT JOIN personal p ON h.responsable_id = p.id
      WHERE h.infraestructura_id = ${infraId}
      ORDER BY h.fecha_registro DESC;
    `;
  } catch (error) { return []; }
}

export async function updateParcelaEstado(id, nuevoEstado) {
  try {
    const user = await requireRole('editor');
    const [prev] = await sql`SELECT estado_fiscal FROM parcelas WHERE id = ${id}`;
    await sql`UPDATE parcelas SET estado_fiscal = ${nuevoEstado} WHERE id = ${id};`;
    await _logParcelaChange(
      id,
      'Estado fiscal',
      `Estado fiscal actualizado`,
      prev?.estado_fiscal || '—',
      nuevoEstado,
      user.id, user.name ?? user.email
    );
    return true;
  } catch (error) { return false; }
}

export async function createPropietario({ nombre, apellido, dni, contacto }) {
  try {
    await requireRole('editor');
    const rows = await sql`
      INSERT INTO propietarios (nombre, apellido, dni, contacto)
      VALUES (${nombre}, ${apellido}, ${dni}, ${contacto})
      RETURNING id;
    `;
    return { success: true, id: rows[0].id };
  } catch (error) {
    return { error: error.message };
  }
}

export async function updatePropietario(id, { nombre, apellido, dni, contacto }) {
  try {
    await requireRole('editor');
    await sql`
      UPDATE propietarios
      SET nombre=${nombre}, apellido=${apellido}, dni=${dni}, contacto=${contacto}
      WHERE id=${id};
    `;
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getPropietariosTable() {
  try {
    return await sql`
      SELECT pr.id, pr.nombre, pr.apellido, pr.dni, pr.contacto,
             COUNT(p.id)::int AS parcelas_count
      FROM propietarios pr
      LEFT JOIN parcelas p ON p.propietario_id = pr.id
      GROUP BY pr.id, pr.nombre, pr.apellido, pr.dni, pr.contacto
      ORDER BY pr.apellido ASC, pr.nombre ASC;
    `;
  } catch (error) { return []; }
}

export async function deletePropietario(id) {
  await requireRole('administrador');
  await sql`DELETE FROM propietarios WHERE id = ${id}`;
}

const TIPOS_CIUDADANO_VALIDOS = new Set([
  'bache','calle_danada','semaforo','luminaria','cable_caido',
  'basural','escombros','arbol_caido','arbol_peligroso',
]);

export async function createReportePublico({ tipo, lat, lng, descripcion, fotos }) {
  if (!TIPOS_CIUDADANO_VALIDOS.has(tipo))             return { error: 'Tipo de reporte inválido' };
  if (typeof lat !== 'number' || typeof lng !== 'number') return { error: 'Ubicación inválida' };
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180)  return { error: 'Coordenadas fuera de rango' };
  const obs = descripcion ? String(descripcion).slice(0, 500) : null;
  // Validar fotos: base64 JPEG/PNG, máx 3, cada una < 2MB
  const fotosValidas = Array.isArray(fotos)
    ? fotos.filter(f => typeof f === 'string' && f.startsWith('data:image/') && f.length < 2_000_000).slice(0, 3)
    : [];
  const fotosArr = fotosValidas.length > 0 ? fotosValidas : null;
  try {
    const result = await sql`
      INSERT INTO infraestructura (tipo, posicion, estado, observaciones, fotos)
      VALUES (${tipo}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), 'pendiente', ${obs}, ${fotosArr})
      RETURNING id
    `;
    const nuevoId = result[0].id;
    // Notificar a admins, editors y técnicos
    const receptores = await sql`
      SELECT id FROM usuarios WHERE rol IN ('editor', 'administrador', 'tecnico') AND activo = TRUE
    `;
    const tipoLabel = tipo.replace(/_/g, ' ');
    if (receptores.length > 0) {
      const titulo = 'Nuevo reporte ciudadano';
      const mensaje = `Se registró un nuevo reporte de "${tipoLabel}"${obs ? ': ' + obs.slice(0, 80) : ''}`;
      const rows = receptores.map(u => ({
        usuario_id: u.id, tipo: 'nuevo_reporte', titulo, mensaje,
        referencia_id: nuevoId,
      }));
      try {
        await sql`INSERT INTO notificaciones ${sql(rows, 'usuario_id', 'tipo', 'titulo', 'mensaje', 'referencia_id')}`;
      } catch (_) {}
    }
    return { success: true, id: nuevoId };
  } catch (error) {
    console.error('createReportePublico error:', error.message);
    return { error: 'No se pudo registrar el reporte. Intente nuevamente.' };
  }
}

export async function getReportePublico(id) {
  if (!id || typeof id !== 'string') return null;
  try {
    const rows = await sql`
      SELECT id, tipo, estado, observaciones, created_at,
             (SELECT MAX(fecha_registro) FROM historial_obras WHERE infraestructura_id = infraestructura.id) AS fecha_ultima_actualizacion
      FROM infraestructura
      WHERE id = ${id}
    `;
    return rows[0] ?? null;
  } catch { return null; }
}

export async function createIncidencia({ tipo, lat, lng }) {
  try {
    await requireRole('editor');
    const result = await sql`INSERT INTO infraestructura (tipo, posicion, estado) VALUES (${tipo}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), 'dañado') RETURNING id, tipo, estado, ST_AsGeoJSON(posicion)::jsonb as geometry;`;
    return result[0];
  } catch (error) { return null; }
}

export async function createObraVial(tipo, geometry) {
  try {
    await requireRole('editor');
    const estado = tipo === 'clausura' ? 'clausurado' : 'en_progreso';
    await sql`
      INSERT INTO infraestructura (tipo, posicion, estado)
      VALUES (${tipo}, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326), ${estado});
    `;
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function searchParcelaByPadron(padron) {
  try {
    const results = await sql`
      SELECT
        p.id, p.nro_padron, p.estado_fiscal,
        ROUND(ST_Area(p.geometria::geography)::numeric, 2) as superficie_m2,
        COALESCE(pr.nombre || ' ' || pr.apellido, 'Sin Propietario') as propietario,
        ST_X(ST_Centroid(p.geometria)) as lng,
        ST_Y(ST_Centroid(p.geometria)) as lat
      FROM parcelas p
      LEFT JOIN propietarios pr ON p.propietario_id = pr.id
      WHERE p.nro_padron ILIKE ${'%' + padron + '%'}
      LIMIT 1;
    `;
    return results[0] || null;
  } catch (error) { return null; }
}

export async function getParcelasTable() {
  try {
    return await sql`
      SELECT
        p.id,
        p.nro_padron,
        p.estado_fiscal,
        ROUND(ST_Area(p.geometria::geography)::numeric, 2) as superficie_m2,
        COALESCE(pr.nombre || ' ' || pr.apellido, 'Sin Propietario') as propietario,
        COALESCE(b.nombre, 'Sin Barrio') as barrio_nombre,
        ST_X(ST_Centroid(p.geometria)) as lng,
        ST_Y(ST_Centroid(p.geometria)) as lat,
        p.agua_corriente, p.energia_electrica, p.cloacas, p.gas_natural,
        p.pavimento, p.alumbrado_publico,
        p.superficie_cubierta, p.cantidad_plantas, p.antiguedad,
        p.categoria_edificatoria, p.estado_conservacion,
        p.numero_plano, p.expediente_municipal, p.zonificacion, p.restricciones,
        p.es_fiscal, p.estado_ocupacion, p.destino_previsto
      FROM parcelas p
      LEFT JOIN propietarios pr ON p.propietario_id = pr.id
      LEFT JOIN barrios b ON ST_Intersects(p.geometria, b.geometria)
      ORDER BY b.nombre ASC, p.nro_padron ASC;
    `;
  } catch (error) {
    console.error("Table Error:", error);
    return [];
  }
}

export async function getInfraestructuraTable() {
  try {
    return await sql`
      SELECT
        i.id,
        i.tipo,
        i.estado,
        COALESCE(p.nombre, 'No Asignado') as responsable_nombre,
        COALESCE(p.cuadrilla, '-') as cuadrilla,
        i.created_at,
        i.fecha_inicio,
        i.fecha_fin,
        i.adjudicado_a,
        COALESCE(u.nombre, 'Sin adjudicar') as adjudicado_nombre,
        i.fecha_adjudicacion,
        i.observaciones,
        ST_X(ST_Centroid(i.posicion::geometry)) as lng,
        ST_Y(ST_Centroid(i.posicion::geometry)) as lat
      FROM infraestructura i
      LEFT JOIN personal p ON i.responsable_id = p.id
      LEFT JOIN usuarios u ON i.adjudicado_a = u.id
      ORDER BY i.created_at DESC;
    `;
  } catch (error) {
    console.error("Infra Table Error:", error);
    return [];
  }
}

export async function getHistorialGlobal() {
  try {
    return await sql`
      SELECT
        h.*,
        p.nombre as responsable_nombre,
        i.tipo as reporte_tipo,
        ST_Y(ST_Centroid(i.posicion::geometry)) as lat,
        ST_X(ST_Centroid(i.posicion::geometry)) as lng
      FROM historial_obras h
      LEFT JOIN personal p ON h.responsable_id = p.id
      LEFT JOIN infraestructura i ON h.infraestructura_id = i.id
      ORDER BY h.fecha_registro DESC
      LIMIT 200;
    `;
  } catch (error) {
    console.error("Global History Error:", error);
    return [];
  }
}

export async function updateParcelaFicha(id, data) {
  try {
    const user = await requireRole('editor');
    const toNum = (v) => (v !== '' && v != null ? Number(v) : null);

    // Fetch current values for diff
    const [old] = await sql`
      SELECT agua_corriente, energia_electrica, cloacas, gas_natural, pavimento,
             alumbrado_publico, superficie_cubierta, cantidad_plantas, antiguedad,
             categoria_edificatoria, estado_conservacion, numero_plano,
             expediente_municipal, zonificacion, restricciones,
             es_fiscal, estado_ocupacion, destino_previsto
      FROM parcelas WHERE id = ${id}
    `;

    await sql`
      UPDATE parcelas SET
        agua_corriente        = ${data.agua_corriente ?? false},
        energia_electrica     = ${data.energia_electrica ?? false},
        cloacas               = ${data.cloacas ?? false},
        gas_natural           = ${data.gas_natural ?? false},
        pavimento             = ${data.pavimento || null},
        alumbrado_publico     = ${data.alumbrado_publico ?? false},
        superficie_cubierta   = ${toNum(data.superficie_cubierta)},
        cantidad_plantas      = ${toNum(data.cantidad_plantas)},
        antiguedad            = ${toNum(data.antiguedad)},
        categoria_edificatoria= ${data.categoria_edificatoria || null},
        estado_conservacion   = ${data.estado_conservacion || null},
        numero_plano          = ${data.numero_plano || null},
        expediente_municipal  = ${data.expediente_municipal || null},
        zonificacion          = ${data.zonificacion || null},
        restricciones         = ${data.restricciones || null},
        es_fiscal             = ${data.es_fiscal ?? false},
        estado_ocupacion      = ${data.estado_ocupacion || null},
        destino_previsto      = ${data.destino_previsto || null}
      WHERE id = ${id};
    `;

    // Build diff description
    const LABELS = {
      agua_corriente: 'Agua', energia_electrica: 'Electricidad', cloacas: 'Cloacas',
      gas_natural: 'Gas', pavimento: 'Pavimento', alumbrado_publico: 'Alumbrado',
      superficie_cubierta: 'Sup. cubierta', cantidad_plantas: 'Plantas',
      antiguedad: 'Antigüedad', categoria_edificatoria: 'Categoría',
      estado_conservacion: 'Conservación', numero_plano: 'N° plano',
      expediente_municipal: 'Expediente', zonificacion: 'Zonif.',
      restricciones: 'Restricciones', es_fiscal: 'Fiscal',
      estado_ocupacion: 'Ocupación', destino_previsto: 'Destino',
    };
    const newNorm = {
      agua_corriente: data.agua_corriente ?? false,
      energia_electrica: data.energia_electrica ?? false,
      cloacas: data.cloacas ?? false,
      gas_natural: data.gas_natural ?? false,
      pavimento: data.pavimento || null,
      alumbrado_publico: data.alumbrado_publico ?? false,
      superficie_cubierta: toNum(data.superficie_cubierta),
      cantidad_plantas: toNum(data.cantidad_plantas),
      antiguedad: toNum(data.antiguedad),
      categoria_edificatoria: data.categoria_edificatoria || null,
      estado_conservacion: data.estado_conservacion || null,
      numero_plano: data.numero_plano || null,
      expediente_municipal: data.expediente_municipal || null,
      zonificacion: data.zonificacion || null,
      restricciones: data.restricciones || null,
      es_fiscal: data.es_fiscal ?? false,
      estado_ocupacion: data.estado_ocupacion || null,
      destino_previsto: data.destino_previsto || null,
    };
    const changed = Object.keys(LABELS).filter(k => String(old?.[k] ?? '') !== String(newNorm[k] ?? ''));
    if (changed.length > 0) {
      const desc = changed.map(k => LABELS[k]).join(', ');
      await _logParcelaChange(id, 'Ficha técnica', `Campos actualizados: ${desc}`, null, null, user.id, user.name ?? user.email);
    }

    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

// ─── GESTIÓN DE USUARIOS (solo administrador) ────────────────────────────────

export async function getUsuarios() {
  try {
    await requireRole('administrador');
    return await sql`
      SELECT id, nombre, email, rol, activo, created_at
      FROM usuarios
      ORDER BY created_at ASC;
    `;
  } catch (error) {
    console.error("getUsuarios error:", error.message);
    return [];
  }
}

export async function createUsuario({ nombre, email, password, rol }) {
  try {
    await requireRole('administrador');
    const hash = await bcrypt.hash(password, 10);
    await sql`
      INSERT INTO usuarios (nombre, email, password, rol, activo)
      VALUES (${nombre}, ${email}, ${hash}, ${rol}, TRUE);
    `;
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function updateUsuarioRol(id, rol) {
  try {
    const me = await requireRole('administrador');
    if (me.id === id) return { error: 'No podés cambiar tu propio rol.' };
    await sql`UPDATE usuarios SET rol = ${rol} WHERE id = ${id};`;
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function toggleUsuarioActivo(id) {
  try {
    const me = await requireRole('administrador');
    if (me.id === id) return { error: 'No podés desactivar tu propia cuenta.' };
    await sql`UPDATE usuarios SET activo = NOT activo WHERE id = ${id};`;
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function resetUsuarioPassword(id, nuevaPassword) {
  try {
    await requireRole('administrador');
    const hash = await bcrypt.hash(nuevaPassword, 10);
    await sql`UPDATE usuarios SET password = ${hash} WHERE id = ${id};`;
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function deleteUsuario(id) {
  try {
    const me = await requireRole('administrador');
    if (me.id === id) return { error: 'No podés eliminar tu propia cuenta.' };
    const target = await sql`SELECT rol FROM usuarios WHERE id = ${id};`;
    if (!target[0]) return { error: 'Usuario no encontrado.' };
    if (target[0].rol === 'administrador') {
      const admins = await sql`SELECT id FROM usuarios WHERE rol = 'administrador';`;
      if (admins.length <= 1) return { error: 'No podés eliminar el único administrador.' };
    }
    // Desasignar reportes adjudicados antes de eliminar (evita FK violation)
    await sql`UPDATE infraestructura SET adjudicado_a = NULL, fecha_adjudicacion = NULL WHERE adjudicado_a = ${id};`;
    await sql`DELETE FROM usuarios WHERE id = ${id};`;
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function cambiarPassword(passwordActual, passwordNueva) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'No autenticado.' };
    if (!passwordActual || !passwordNueva) return { error: 'Completá todos los campos.' };
    if (passwordNueva.length < 6) return { error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    const users = await sql`SELECT password FROM usuarios WHERE id = ${session.user.id}`;
    if (!users[0]) return { error: 'Usuario no encontrado.' };
    const ok = await bcrypt.compare(passwordActual, users[0].password);
    if (!ok) return { error: 'La contraseña actual es incorrecta.' };
    const hash = await bcrypt.hash(passwordNueva, 10);
    await sql`UPDATE usuarios SET password = ${hash} WHERE id = ${session.user.id}`;
    return { success: true };
  } catch (error) {
    return { error: 'Error interno.' };
  }
}

// ─── SISTEMA DE RESPONSABILIDADES (Etapa 6) ──────────────────────────────────

export async function getTecnicos() {
  try {
    return await sql`
      SELECT id, nombre, email
      FROM usuarios
      WHERE rol = 'tecnico' AND activo = TRUE
      ORDER BY nombre ASC;
    `;
  } catch (error) { return []; }
}

export async function adjudicarReporte(infraId, usuarioId) {
  try {
    const editor = await requireRole('editor');
    if (usuarioId) {
      const infra = await sql`SELECT tipo FROM infraestructura WHERE id = ${infraId}`;
      await sql`
        UPDATE infraestructura
        SET adjudicado_a = ${usuarioId}, fecha_adjudicacion = NOW()
        WHERE id = ${infraId};
      `;
      await crearNotificacion(
        usuarioId,
        'asignacion',
        'Reporte asignado a vos',
        `Se te adjudicó un reporte de tipo "${(infra[0]?.tipo || '').replace(/_/g, ' ')}"`,
        infraId
      );
    } else {
      await sql`
        UPDATE infraestructura
        SET adjudicado_a = NULL, fecha_adjudicacion = NULL
        WHERE id = ${infraId};
      `;
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getMisReportes() {
  try {
    const session = await auth();
    if (!session?.user) return [];
    const user = session.user;
    if (user.rol !== 'tecnico') return [];

    return await sql`
      SELECT
        i.id, i.tipo, i.estado,
        i.fecha_inicio, i.fecha_fin,
        i.fecha_adjudicacion, i.adjudicado_a,
        i.responsable_id,
        ST_X(ST_Centroid(i.posicion::geometry)) as lng,
        ST_Y(ST_Centroid(i.posicion::geometry)) as lat
      FROM infraestructura i
      WHERE i.adjudicado_a = ${user.id}
      ORDER BY i.fecha_adjudicacion DESC NULLS LAST;
    `;
  } catch (error) { return []; }
}

export async function getReportesPendientesCount() {
  try {
    const session = await auth();
    if (!session?.user || session.user.rol !== 'tecnico') return 0;
    const result = await sql`
      SELECT COUNT(*) as count
      FROM infraestructura
      WHERE adjudicado_a = ${session.user.id}
        AND estado IN ('pendiente', 'dañado');
    `;
    return Number(result[0]?.count || 0);
  } catch (error) { return 0; }
}

// ─── NOTIFICACIONES (Etapa 7) ─────────────────────────────────────────────────

export async function getNotificaciones() {
  try {
    const session = await auth();
    if (!session?.user) return [];
    return await sql`
      SELECT id, tipo, titulo, mensaje, leida, referencia_id, created_at
      FROM notificaciones
      WHERE usuario_id = ${session.user.id}
      ORDER BY created_at DESC
      LIMIT 50;
    `;
  } catch (error) { return []; }
}

export async function getNotificacionesCount() {
  try {
    const session = await auth();
    if (!session?.user) return 0;
    const result = await sql`
      SELECT COUNT(*) as count FROM notificaciones
      WHERE usuario_id = ${session.user.id} AND leida = FALSE;
    `;
    return Number(result[0]?.count || 0);
  } catch (error) { return 0; }
}

export async function marcarNotificacionLeida(id) {
  try {
    const session = await auth();
    if (!session?.user) return;
    await sql`
      UPDATE notificaciones SET leida = TRUE
      WHERE id = ${id} AND usuario_id = ${session.user.id};
    `;
  } catch (_) {}
}

export async function marcarTodasLeidas() {
  try {
    const session = await auth();
    if (!session?.user) return;
    await sql`
      UPDATE notificaciones SET leida = TRUE
      WHERE usuario_id = ${session.user.id} AND leida = FALSE;
    `;
  } catch (_) {}
}

export async function getInfraLocation(id) {
  try {
    const result = await sql`
      SELECT ST_X(ST_Centroid(posicion::geometry)) as lng,
             ST_Y(ST_Centroid(posicion::geometry)) as lat
      FROM infraestructura WHERE id = ${id}
    `;
    return result[0] || null;
  } catch (_) { return null; }
}

// ─── ESTADÍSTICAS (Etapa 8) ───────────────────────────────────────────────────

export async function getEstadisticas() {
  try {
    const session = await auth();
    if (!session?.user) return null;

    const [kpisRes, porTipo, porEstado, vencidos, tendencia] = await Promise.all([
      sql`
        SELECT
          COUNT(*)::int                                                                        AS total,
          COUNT(*) FILTER (WHERE estado NOT IN ('finalizado','funcional'))::int                AS pendientes,
          COUNT(*) FILTER (WHERE fecha_fin < NOW()
            AND estado NOT IN ('finalizado','funcional'))::int                                 AS vencidos,
          COUNT(*) FILTER (WHERE adjudicado_a IS NOT NULL
            AND estado NOT IN ('finalizado','funcional'))::int                                 AS adjudicados,
          COUNT(*) FILTER (WHERE estado = 'finalizado')::int                                   AS finalizados,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int                AS ultimos_30d
        FROM infraestructura
      `,
      sql`
        SELECT tipo, COUNT(*)::int AS cantidad
        FROM infraestructura
        GROUP BY tipo ORDER BY cantidad DESC
      `,
      sql`
        SELECT estado, COUNT(*)::int AS cantidad
        FROM infraestructura
        GROUP BY estado ORDER BY cantidad DESC
      `,
      sql`
        SELECT i.id, i.tipo, i.estado,
          i.fecha_fin,
          COALESCE(u.nombre, 'Sin asignar') AS tecnico_nombre,
          EXTRACT(DAY FROM NOW() - i.fecha_fin)::int AS dias_vencido
        FROM infraestructura i
        LEFT JOIN usuarios u ON i.adjudicado_a = u.id
        WHERE i.fecha_fin < NOW()
          AND i.estado NOT IN ('finalizado','funcional')
        ORDER BY i.fecha_fin ASC
        LIMIT 15
      `,
      sql`
        SELECT TO_CHAR(DATE(created_at), 'DD/MM') AS dia,
               COUNT(*)::int AS cantidad
        FROM infraestructura
        WHERE created_at > NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at), dia
        ORDER BY DATE(created_at) ASC
      `,
    ]);

    return {
      kpis:     kpisRes[0],
      porTipo,
      porEstado,
      vencidos,
      tendencia,
    };
  } catch (error) {
    console.error('getEstadisticas error:', error.message);
    return null;
  }
}
