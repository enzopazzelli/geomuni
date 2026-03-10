'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMisReportes } from '@/app/actions/geoActions';
import InfraModal from '@/components/map/InfraModal';
import AppSidebar from '@/components/AppSidebar';

const ESTADO_COLOR = {
  funcional:    'bg-green-100 text-green-700',
  dañado:       'bg-red-100 text-red-700',
  en_reparacion:'bg-amber-100 text-amber-700',
  en_progreso:  'bg-blue-100 text-blue-700',
  clausurado:   'bg-slate-200 text-slate-600',
  pendiente:    'bg-orange-100 text-orange-700',
  finalizado:   'bg-emerald-100 text-emerald-700',
};

const TIPO_COLOR = {
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

export default function MisReportesPage() {
  const router = useRouter();
  const [reportes, setReportes]               = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [filtroEstado, setFiltroEstado]       = useState('');

  const loadReportes = async () => {
    setLoading(true);
    setReportes(await getMisReportes());
    setLoading(false);
    window.dispatchEvent(new Event('reportes-updated'));
  };

  useEffect(() => { loadReportes(); }, []);

  const openModal = (r) => {
    setSelectedFeature({
      type: 'Reporte',
      id: r.tipo.toUpperCase(),
      details: {
        id:                  r.id,
        tipo:                r.tipo,
        estado:              r.estado,
        responsable_id:      r.responsable_id,
        fecha_inicio:        r.fecha_inicio,
        fecha_fin:           r.fecha_fin,
        adjudicado_a:        r.adjudicado_a,
        fecha_adjudicacion:  r.fecha_adjudicacion,
        adjudicado_nombre:   null, // no se muestra el badge en este contexto
      },
    });
    setIsModalOpen(true);
  };

  const VENTANA_NUEVO_MS = 24 * 60 * 60 * 1000; // 24h
  const TERMINADOS  = ['finalizado', 'funcional'];
  const SIN_INICIAR = ['pendiente', 'dañado'];

  const isNuevo = (r) =>
    r.fecha_adjudicacion &&
    SIN_INICIAR.includes(r.estado) &&
    Date.now() - new Date(r.fecha_adjudicacion).getTime() < VENTANA_NUEVO_MS;

  const isVencido = (r) =>
    r.fecha_fin &&
    !TERMINADOS.includes(r.estado) &&
    new Date(r.fecha_fin) < new Date();

  const diasVencido = (r) =>
    Math.floor((Date.now() - new Date(r.fecha_fin).getTime()) / 86400000);

  const nuevos     = reportes.filter(isNuevo).length;
  const vencidos   = reportes.filter(isVencido).length;
  const pendientes = reportes.filter(r => SIN_INICIAR.includes(r.estado)).length;

  // Filtrado + orden: vencidos primero, luego nuevos, luego resto
  const baseFiltered = filtroEstado === '__nuevos__'
    ? reportes.filter(isNuevo)
    : filtroEstado === '__vencidos__'
      ? reportes.filter(isVencido)
      : filtroEstado
        ? reportes.filter(r => r.estado === filtroEstado)
        : reportes;

  const filtered = [...baseFiltered].sort((a, b) => {
    if (isVencido(a) && !isVencido(b)) return -1;
    if (!isVencido(a) && isVencido(b)) return 1;
    if (isNuevo(a) && !isNuevo(b)) return -1;
    if (!isNuevo(a) && isNuevo(b)) return 1;
    return 0;
  });

  return (
    <div className="flex min-h-screen bg-slate-950">
      <AppSidebar />

      <div className="flex-1 flex flex-col overflow-auto pb-16 md:pb-0">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Mis Reportes Asignados</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {reportes.length} reporte{reportes.length !== 1 ? 's' : ''} en tu área
              {pendientes > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                  {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reportes.length > 0 && (
              <button
                onClick={() => {
                  const rows = filtered.map(r => ({
                    ID: r.id,
                    Tipo: r.tipo.replace(/_/g, ' '),
                    Estado: r.estado.replace(/_/g, ' '),
                    Asignado: r.fecha_adjudicacion ? new Date(r.fecha_adjudicacion).toLocaleDateString('es-AR') : '',
                    Inicio: r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleDateString('es-AR') : '',
                    Vencimiento: r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-AR') : '',
                  }));
                  const headers = Object.keys(rows[0]);
                  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h]}"`).join(','))].join('\n');
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                  a.download = `mis_reportes_${new Date().toISOString().slice(0,10)}.csv`;
                  a.click();
                }}
                className="text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-colors"
              >
                ⬇ CSV
              </button>
            )}
            <button
              onClick={loadReportes}
              className="text-[10px] font-black uppercase text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-colors"
            >
              Actualizar
            </button>
          </div>
        </div>

        <div className="p-8 flex flex-col gap-6">

          {/* Banner vencidos */}
          {vencidos > 0 && !loading && (
            <div className="bg-red-950 border border-red-700 rounded-2xl px-5 py-3.5 flex items-center gap-3 cursor-pointer" onClick={() => setFiltroEstado('__vencidos__')}>
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-black text-red-200">
                  Tenés {vencidos} reporte{vencidos !== 1 ? 's' : ''} vencido{vencidos !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-red-400 font-bold mt-0.5">La fecha límite ya fue superada — click para ver</p>
              </div>
            </div>
          )}

          {/* Banner nuevos */}
          {nuevos > 0 && !loading && (
            <div className="bg-blue-950 border border-blue-700 rounded-2xl px-5 py-3.5 flex items-center gap-3">
              <span className="text-lg">🔔</span>
              <div>
                <p className="text-sm font-black text-white">
                  Tenés {nuevos} reporte{nuevos !== 1 ? 's' : ''} nuevo{nuevos !== 1 ? 's' : ''} asignado{nuevos !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-blue-300 font-bold mt-0.5">Adjudicado en las últimas 24 horas</p>
              </div>
            </div>
          )}

          {/* Filtros */}
          {reportes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar:</span>
              {[
                { key: '',             label: 'Todos' },
                { key: '__vencidos__', label: `Vencidos${vencidos > 0 ? ` (${vencidos})` : ''}`, danger: true },
                { key: '__nuevos__',   label: `Nuevos${nuevos > 0 ? ` (${nuevos})` : ''}` },
                { key: 'pendiente',    label: 'Pendiente' },
                { key: 'dañado',       label: 'Dañado' },
                { key: 'en_reparacion',label: 'En reparación' },
                { key: 'en_progreso',  label: 'En progreso' },
                { key: 'finalizado',   label: 'Finalizado' },
              ].map(({ key, label, danger }) => (
                <button
                  key={key}
                  onClick={() => setFiltroEstado(key)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-colors ${
                    filtroEstado === key
                      ? danger ? 'bg-red-500 text-white' : 'bg-white text-slate-900'
                      : danger ? 'bg-red-950 text-red-400 hover:bg-red-900 border border-red-800' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Contenido */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-slate-400 text-sm">Cargando reportes...</p>
            </div>
          ) : reportes.length === 0 ? (
            <div className="bg-slate-900 rounded-3xl p-16 text-center">
              <p className="text-5xl mb-4">✅</p>
              <p className="text-white font-black text-lg">No tenés reportes asignados</p>
              <p className="text-slate-400 text-sm mt-2">
                Cuando un editor te adjudique un reporte, aparecerá aquí.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-slate-900 rounded-3xl p-10 text-center">
              <p className="text-slate-400 text-sm">No hay reportes con ese estado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(r => {
                const vencido = isVencido(r);
                const nuevo   = isNuevo(r);
                return (
                <div
                  key={r.id}
                  className={`bg-slate-900 rounded-3xl overflow-hidden border transition-colors ${
                    vencido ? 'border-red-700 hover:border-red-500' : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  {/* Card header */}
                  <div className={`${TIPO_COLOR[r.tipo] || 'bg-slate-600'} px-5 py-4 flex items-center justify-between`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-black uppercase text-sm tracking-tight">
                        {r.tipo.replace(/_/g, ' ')}
                      </span>
                      {vencido && (
                        <span className="bg-red-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-widest animate-pulse">
                          VENCIDO
                        </span>
                      )}
                      {nuevo && !vencido && (
                        <span className="bg-white text-slate-900 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-widest">
                          NUEVO
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${ESTADO_COLOR[r.estado] || 'bg-white/20 text-white'}`}>
                      {r.estado.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="px-5 py-4 space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>ID</span>
                      <span className="text-slate-300 font-black">{r.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Asignado</span>
                      <span className="text-slate-300">
                        {r.fecha_adjudicacion
                          ? new Date(r.fecha_adjudicacion).toLocaleDateString('es-AR')
                          : '—'}
                      </span>
                    </div>
                    {r.fecha_inicio && (
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Inicio</span>
                        <span className="text-slate-300">{new Date(r.fecha_inicio).toLocaleDateString('es-AR')}</span>
                      </div>
                    )}
                    {r.fecha_fin && (
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Vencimiento</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-black ${vencido ? 'text-red-400' : 'text-amber-400'}`}>
                            {new Date(r.fecha_fin).toLocaleDateString('es-AR')}
                          </span>
                          {vencido && (
                            <span className="text-red-500 text-[9px] font-black">({diasVencido(r)}d)</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="pt-3 flex gap-2">
                      <button
                        onClick={() => openModal(r)}
                        className="flex-1 bg-white text-slate-900 py-2.5 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-100 transition-colors active:scale-95"
                      >
                        Gestionar
                      </button>
                      <button
                        onClick={() => router.push(`/?id=${r.id}&type=Reporte&lat=${r.lat}&lng=${r.lng}`)}
                        className="px-3 py-2.5 bg-slate-800 text-slate-300 rounded-2xl font-black text-[10px] uppercase hover:bg-slate-700 hover:text-white transition-colors active:scale-95"
                        title="Ver en mapa"
                      >
                        🗺️
                      </button>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>

      <InfraModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        feature={selectedFeature}
        onRefresh={loadReportes}
        userRole="tecnico"
      />
    </div>
  );
}
