'use client';

import { useState, useEffect } from 'react';
import {
  getPersonal,
  updateInfraestructura,
  getHistorialObra,
  getTecnicos,
  adjudicarReporte,
} from '@/app/actions/geoActions';

export default function InfraModal({ isOpen, onClose, feature, onRefresh, userRole = 'consultor' }) {
  const readOnly    = userRole === 'consultor';
  const canAdjudicar = userRole === 'editor' || userRole === 'administrador';

  const [personal, setPersonal]           = useState([]);
  const [tecnicos, setTecnicos]           = useState([]);
  const [historial, setHistorial]         = useState([]);
  const [isSaving, setIsSaving]           = useState(false);
  const [isAdjudicando, setIsAdjudicando] = useState(false);
  const [adjudicadoId, setAdjudicadoId]   = useState('');

  const [formData, setFormData] = useState({
    estado: '',
    responsable_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    observaciones: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    loadPersonal();
    if (canAdjudicar) loadTecnicos();
    if (feature) {
      setFormData({
        estado:        feature.details.estado || 'funcional',
        responsable_id: feature.details.responsable_id || '',
        fecha_inicio:  feature.details.fecha_inicio
          ? new Date(feature.details.fecha_inicio).toISOString().split('T')[0]
          : '',
        fecha_fin: feature.details.fecha_fin
          ? new Date(feature.details.fecha_fin).toISOString().split('T')[0]
          : '',
        observaciones: '',
      });
      setAdjudicadoId(feature.details.adjudicado_a || '');
      loadHistorial(feature.details.id);
    }
  }, [isOpen, feature]);

  const loadPersonal  = async () => setPersonal(await getPersonal());
  const loadTecnicos  = async () => setTecnicos(await getTecnicos());
  const loadHistorial = async (id) => setHistorial(await getHistorialObra(id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const res = await updateInfraestructura(feature.details.id, formData);
    if (res.success) {
      await onRefresh();
      onClose();
    } else {
      alert('Error: ' + res.error);
    }
    setIsSaving(false);
  };

  const handleAdjudicar = async () => {
    setIsAdjudicando(true);
    const res = await adjudicarReporte(feature.details.id, adjudicadoId || null);
    if (res.success) {
      await onRefresh();
      // Actualizar el badge localmente
      const tecnico = tecnicos.find(t => t.id === adjudicadoId);
      feature.details.adjudicado_a      = adjudicadoId || null;
      feature.details.adjudicado_nombre = tecnico?.nombre || null;
    } else {
      alert('Error: ' + res.error);
    }
    setIsAdjudicando(false);
  };

  if (!isOpen || !feature) return null;

  const estados = ['funcional', 'dañado', 'en_reparacion', 'en_progreso', 'clausurado', 'pendiente', 'finalizado'];

  const HEADER_COLORS = {
    bache:           'bg-red-500',
    calle_danada:    'bg-orange-500',
    semaforo:        'bg-yellow-500',
    luminaria:       'bg-amber-400',
    cable_caido:     'bg-amber-600',
    basural:         'bg-emerald-500',
    escombros:       'bg-lime-500',
    arbol_caido:     'bg-green-500',
    arbol_peligroso: 'bg-green-700',
    reparacion_calle:'bg-blue-500',
    cuneta:          'bg-cyan-500',
    zona_obra:       'bg-orange-600',
    clausura:        'bg-slate-500',
  };
  const headerColor = HEADER_COLORS[feature.details.tipo] || 'bg-slate-700';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden border border-slate-200">

        {/* HEADER */}
        <div className={`p-8 ${headerColor} text-white`}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black tracking-tight uppercase">
                {feature.details.tipo.replace('_', ' ')}
              </h2>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest mt-1">
                ID: {feature.details.id.slice(0, 8)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center font-bold hover:bg-black/20 transition-colors text-white"
            >✕</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">

          {/* ADJUDICACIÓN — solo editors/admins */}
          {canAdjudicar && (
            <div className="space-y-2 bg-blue-50 rounded-2xl p-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">
                Técnico Responsable
              </label>

              {feature.details.adjudicado_nombre && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"/>
                  <span className="text-xs font-bold text-blue-800">
                    Asignado a: {feature.details.adjudicado_nombre}
                  </span>
                  {feature.details.fecha_adjudicacion && (
                    <span className="text-[9px] text-blue-400 ml-auto">
                      {new Date(feature.details.fecha_adjudicacion).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <select
                  className="flex-1 bg-white border border-blue-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                  value={adjudicadoId}
                  onChange={e => setAdjudicadoId(e.target.value)}
                >
                  <option value="">Sin adjudicar</option>
                  {tecnicos.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isAdjudicando}
                  onClick={handleAdjudicar}
                  className="bg-blue-600 text-white px-5 rounded-2xl font-black text-[10px] uppercase hover:bg-blue-500 transition-colors disabled:opacity-50 shrink-0"
                >
                  {isAdjudicando ? '...' : 'Adjudicar'}
                </button>
              </div>

              {tecnicos.length === 0 && (
                <p className="text-[10px] text-blue-400 italic mt-1">
                  No hay técnicos activos. Creá uno desde /admin.
                </p>
              )}
            </div>
          )}

          {/* Banner técnico — deja en claro que puede editar */}
          {userRole === 'tecnico' && (
            <div className="bg-emerald-600 rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">🛠️</span>
              <div>
                <p className="text-xs font-black text-white">Reporte asignado a vos</p>
                <p className="text-[10px] text-emerald-100 font-bold mt-0.5">Podés actualizar el estado y agregar observaciones</p>
              </div>
            </div>
          )}

          {/* Descripción ciudadana */}
          {feature?.details?.observaciones && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">📝 Descripción del ciudadano</p>
              <p className="text-xs font-bold text-slate-700 italic">"{feature.details.observaciones}"</p>
            </div>
          )}

          {/* Fotos del ciudadano */}
          {feature?.details?.fotos?.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">📷 Fotos del ciudadano</p>
              <div className="flex gap-2 flex-wrap">
                {feature.details.fotos.map((foto, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => window.open(foto, '_blank')}
                    className="w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 hover:border-blue-400 transition-colors shrink-0 focus:outline-none"
                    title="Ver foto completa"
                  >
                    <img src={foto} alt={`foto-${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ESTADO */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
              Estado del Reporte
            </label>
            <div className="grid grid-cols-2 gap-2">
              {estados.map(est => (
                <button
                  key={est}
                  type="button"
                  disabled={readOnly}
                  onClick={() => !readOnly && setFormData({ ...formData, estado: est })}
                  className={`py-3 rounded-2xl text-[10px] font-black uppercase border transition-all ${
                    formData.estado === est
                      ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                      : readOnly
                        ? 'bg-white text-slate-300 border-slate-100 cursor-default'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-400 cursor-pointer'
                  }`}
                >
                  {est.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* RESPONSABLE / CUADRILLA */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
              {userRole === 'tecnico' ? 'Cuadrilla de Trabajo Asignada' : 'Cuadrilla / Personal Operativo'}
            </label>
            <select
              disabled={readOnly}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60"
              value={formData.responsable_id}
              onChange={e => setFormData({ ...formData, responsable_id: e.target.value })}
            >
              <option value="">Sin responsable asignado</option>
              {personal.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.cuadrilla})</option>
              ))}
            </select>
          </div>

          {/* CRONOGRAMA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Inicio</label>
              <input
                type="date"
                disabled={readOnly}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none disabled:opacity-60"
                value={formData.fecha_inicio}
                onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Fin Estimado</label>
              <input
                type="date"
                disabled={readOnly}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none disabled:opacity-60"
                value={formData.fecha_fin}
                onChange={e => setFormData({ ...formData, fecha_fin: e.target.value })}
              />
            </div>
          </div>

          {/* OBSERVACIONES */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
              Observaciones / Log de Trabajo
            </label>
            <textarea
              disabled={readOnly}
              placeholder={readOnly ? 'Solo lectura' : 'Escribí qué se trabajó hoy...'}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px] disabled:opacity-60"
              value={formData.observaciones}
              onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
            />
          </div>

          {!readOnly && (
            <div className="pt-2">
              <button
                disabled={isSaving}
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl shadow-emerald-900/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? '⏳ Guardando...' : '💾 Guardar Cambios'}
              </button>
            </div>
          )}
          {readOnly && (
            <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2">
              Modo lectura — sin permisos de edición
            </p>
          )}

          {/* HISTORIAL */}
          {historial.length > 0 && (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-4 block">
                Historial de Actividad
              </label>
              <div className="space-y-4">
                {historial.map(h => (
                  <div key={h.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-full">
                        {h.estado_nuevo}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400">
                        {new Date(h.fecha_registro).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">{h.responsable_nombre || 'S/R'}</p>
                    {h.observaciones && (
                      <p className="text-[11px] text-slate-500 mt-1 italic">"{h.observaciones}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
