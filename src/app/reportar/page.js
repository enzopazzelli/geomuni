'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createReportePublico, getReportePublico } from '@/app/actions/geoActions';

const ReporteMapPicker = dynamic(() => import('./ReporteMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[280px] rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 text-sm font-bold animate-pulse">
      Cargando mapa...
    </div>
  ),
});

const TIPOS = [
  { value: 'bache',           icon: '🕳️',  label: 'Bache',             desc: 'Hueco en la calzada' },
  { value: 'calle_danada',    icon: '🛣️',  label: 'Calle dañada',      desc: 'Deterioro del pavimento' },
  { value: 'semaforo',        icon: '🚦',  label: 'Semáforo',          desc: 'No funciona o roto' },
  { value: 'luminaria',       icon: '💡',  label: 'Luminaria',         desc: 'Luz pública apagada' },
  { value: 'cable_caido',     icon: '⚡',  label: 'Cable caído',       desc: 'Cable suelto o peligroso' },
  { value: 'basural',         icon: '🗑️',  label: 'Basural',           desc: 'Residuos ilegales' },
  { value: 'escombros',       icon: '🧱',  label: 'Escombros',         desc: 'Materiales en vía pública' },
  { value: 'arbol_caido',     icon: '🌳',  label: 'Árbol caído',       desc: 'Sobre calzada o vereda' },
  { value: 'arbol_peligroso', icon: '⚠️',  label: 'Árbol peligroso',   desc: 'Con riesgo de caída' },
];

const MAX_FOTOS = 3;

function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_DIM = 1200;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = url;
  });
}

const ESTADO_INFO = {
  pendiente:     { label: 'Pendiente',      color: 'bg-orange-500/15 text-orange-300 border border-orange-500/30', icon: '⏳' },
  dañado:        { label: 'Registrado',     color: 'bg-red-500/15 text-red-300 border border-red-500/30',          icon: '📋' },
  en_reparacion: { label: 'En reparación',  color: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',    icon: '🔧' },
  en_progreso:   { label: 'En progreso',    color: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',       icon: '🚧' },
  clausurado:    { label: 'Clausurado',     color: 'bg-slate-500/15 text-slate-400 border border-slate-600',       icon: '🚫' },
  finalizado:    { label: 'Resuelto',       color: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', icon: '✅' },
  funcional:     { label: 'Resuelto',       color: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', icon: '✅' },
};

function StepLabel({ n, label }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-black shrink-0">
        {n}
      </span>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function TicketCard({ reporte }) {
  const info = ESTADO_INFO[reporte.estado] || { label: reporte.estado, color: 'bg-slate-800 text-slate-300 border border-slate-600', icon: '📌' };
  return (
    <div className="mt-3 bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[9px] font-mono text-slate-500 truncate leading-relaxed">{reporte.id}</span>
        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${info.color}`}>
          {info.icon} {info.label}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500 font-bold">Tipo</span>
          <span className="text-slate-300 font-black capitalize">{reporte.tipo.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500 font-bold">Ingresado</span>
          <span className="text-slate-300 font-black">{new Date(reporte.created_at).toLocaleDateString('es-AR')}</span>
        </div>
        {reporte.fecha_ultima_actualizacion && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-500 font-bold">Última actualización</span>
            <span className="text-slate-300 font-black">{new Date(reporte.fecha_ultima_actualizacion).toLocaleDateString('es-AR')}</span>
          </div>
        )}
        {reporte.observaciones && (
          <p className="text-[10px] text-slate-400 bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2 mt-1 leading-relaxed">
            {reporte.observaciones}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ReportarPage() {
  const [tipo, setTipo]               = useState('');
  const [location, setLocation]       = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos]             = useState([]);
  const [sending, setSending]         = useState(false);
  const [result, setResult]           = useState(null);
  const [geoLoading, setGeoLoading]   = useState(false);

  const [ticketInput, setTicketInput]     = useState('');
  const [ticketData, setTicketData]       = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);

  const canSubmit = tipo && location && !sending;

  const handleFotos = async (e) => {
    const files = Array.from(e.target.files).slice(0, MAX_FOTOS - fotos.length);
    if (!files.length) return;
    const compressed = await Promise.all(files.map(compressImage));
    setFotos(prev => [...prev, ...compressed].slice(0, MAX_FOTOS));
    e.target.value = '';
  };

  const removeFoto = (idx) => setFotos(prev => prev.filter((_, i) => i !== idx));

  const handleBuscarTicket = async () => {
    const id = ticketInput.trim();
    if (!id) return;
    setTicketLoading(true);
    setTicketData(null);
    const data = await getReportePublico(id);
    setTicketData(data ?? 'not_found');
    setTicketLoading(false);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoLoading(false); },
      () => { alert('No se pudo obtener tu ubicación.'); setGeoLoading(false); }
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    const res = await createReportePublico({ tipo, lat: location.lat, lng: location.lng, descripcion: descripcion.trim() || null, fotos });
    setSending(false);
    setResult(res);
  };

  /* ── Pantalla de éxito ─────────────────────────────── */
  if (result?.success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl shadow-black/40">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-3xl">
            ✅
          </div>
          <h2 className="text-xl font-black text-white mb-2">¡Reporte enviado!</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Tu reporte fue recibido y será revisado por el equipo municipal.
          </p>
          <p className="text-[11px] text-slate-500 mb-2 font-bold uppercase tracking-wider">Tu número de ticket</p>
          <button
            onClick={() => navigator.clipboard?.writeText(result.id)}
            title="Copiar al portapapeles"
            className="w-full text-left font-mono text-xs text-emerald-300 bg-slate-800/80 hover:bg-slate-700 rounded-xl px-4 py-3 mb-6 break-all transition-colors border border-slate-700 hover:border-slate-500"
          >
            {result.id}
            <span className="text-[9px] text-slate-500 ml-2 font-sans">📋 copiar</span>
          </button>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setTipo(''); setLocation(null); setDescripcion(''); setFotos([]); setResult(null); }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl text-sm font-black uppercase tracking-wide transition-all"
            >
              Enviar otro reporte
            </button>
            <Link href="/inicio" className="text-xs font-bold text-slate-500 hover:text-slate-300 py-2 transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Formulario principal ──────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/inicio" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-xs font-black text-white">G</span>
            </div>
            <div className="leading-none">
              <p className="text-white font-black text-sm tracking-tight">GeoMuni</p>
              <p className="text-slate-500 text-[8px] font-bold uppercase tracking-widest hidden sm:block">Sistema Municipal GIS</p>
            </div>
          </Link>
          <Link href="/login" className="text-[10px] font-black uppercase text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-xl transition-all">
            Acceder →
          </Link>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">

        {/* Título */}
        <div className="pb-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Reportar un problema</h1>
          <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
            Informá una incidencia en la vía pública para que el municipio pueda atenderla.
          </p>
        </div>

        {/* Error de envío */}
        {result?.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 text-sm font-bold text-red-400">
            {result.error}
          </div>
        )}

        {/* Paso 1 — Tipo */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
          <StepLabel n="1" label="¿Qué problema es?" />
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map(t => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all active:scale-95 ${
                  tipo === t.value
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-lg shadow-blue-900/20'
                    : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                <span className="text-2xl leading-none">{t.icon}</span>
                <span className="text-[10px] font-black uppercase leading-tight">{t.label}</span>
                <span className={`text-[9px] leading-tight hidden sm:block ${tipo === t.value ? 'text-blue-400/70' : 'text-slate-600'}`}>
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Paso 2 — Ubicación */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-black shrink-0">2</span>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">¿Dónde está el problema?</p>
            </div>
            <button
              onClick={handleGeolocate}
              disabled={geoLoading}
              className="text-[10px] font-black uppercase text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1 shrink-0"
            >
              {geoLoading ? '...' : '📍 Mi ubicación'}
            </button>
          </div>

          <ReporteMapPicker
            onSelect={(lat, lng) => setLocation({ lat, lng })}
            selected={location}
          />

          <p className={`mt-2.5 text-[10px] text-center font-mono ${location ? 'text-emerald-400' : 'text-slate-600'}`}>
            {location
              ? `📍 ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
              : 'Tocá el mapa para marcar el punto o usá "Mi ubicación"'}
          </p>
        </div>

        {/* Paso 3 — Descripción */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
          <StepLabel n="3" label={<>Descripción <span className="normal-case font-medium text-slate-600">(opcional)</span></>} />
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ej: El bache está frente al número 340, es grande y peligroso..."
            className="w-full bg-slate-800/60 border border-slate-700 focus:border-blue-500/60 rounded-2xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none transition-colors"
          />
          <p className="text-[9px] text-slate-600 text-right mt-1">{descripcion.length}/500</p>
        </div>

        {/* Paso 4 — Fotos */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5">
          <StepLabel n="4" label={<>Fotos <span className="normal-case font-medium text-slate-600">(opcional, máx {MAX_FOTOS})</span></>} />

          {fotos.length > 0 && (
            <div className="flex gap-3 mb-4 flex-wrap">
              {fotos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={f} alt="" className="w-20 h-20 object-cover rounded-2xl border border-slate-700" />
                  <button
                    type="button"
                    onClick={() => removeFoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-400 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow-lg transition-colors"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {fotos.length < MAX_FOTOS ? (
            <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-2xl p-4 transition-colors group">
              <span className="text-2xl">📷</span>
              <div>
                <p className="text-xs font-black text-slate-300 group-hover:text-white transition-colors">Agregar fotos del problema</p>
                <p className="text-[10px] text-slate-600">JPG o PNG — se comprimen automáticamente</p>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFotos} />
            </label>
          ) : (
            <p className="text-[10px] text-slate-600 text-center py-2">Máximo {MAX_FOTOS} fotos alcanzado</p>
          )}
        </div>

        {/* Botón enviar */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-wide transition-all shadow-xl shadow-blue-900/30 hover:shadow-blue-700/30 hover:-translate-y-0.5 active:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {sending ? 'Enviando...' : 'Enviar reporte'}
        </button>

        {/* Hint debajo del botón */}
        {!tipo && (
          <p className="text-[10px] text-slate-600 text-center">Seleccioná el tipo de problema para continuar</p>
        )}
        {tipo && !location && (
          <p className="text-[10px] text-slate-600 text-center">Marcá la ubicación en el mapa para continuar</p>
        )}

        {/* Seguimiento de ticket */}
        <div className="border-t border-slate-800 pt-6 pb-2">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">
            🔍 Consultar estado de un reporte
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={ticketInput}
              onChange={e => setTicketInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuscarTicket()}
              placeholder="Pegá tu ID de ticket aquí..."
              className="flex-1 min-w-0 bg-slate-900 border border-slate-700 focus:border-blue-500/60 rounded-2xl px-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 outline-none font-mono transition-colors"
            />
            <button
              onClick={handleBuscarTicket}
              disabled={!ticketInput.trim() || ticketLoading}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 px-4 py-3 rounded-2xl text-[10px] font-black uppercase transition-all border border-slate-700 shrink-0"
            >
              {ticketLoading ? '...' : 'Buscar'}
            </button>
          </div>

          {ticketData === 'not_found' && (
            <div className="mt-3 bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 text-sm font-bold text-red-400">
              No se encontró ningún reporte con ese ID.
            </div>
          )}

          {ticketData && ticketData !== 'not_found' && (
            <TicketCard reporte={ticketData} />
          )}
        </div>

      </div>
    </div>
  );
}
