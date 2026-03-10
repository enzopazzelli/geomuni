'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createReportePublico, getReportePublico } from '@/app/actions/geoActions';

const ReporteMapPicker = dynamic(() => import('./ReporteMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm font-bold animate-pulse">
      Cargando mapa...
    </div>
  ),
});

const TIPOS = [
  { value: 'bache',           icon: '🕳️',  label: 'Bache',                desc: 'Hueco o deterioro en la calzada' },
  { value: 'calle_danada',    icon: '🛣️',  label: 'Calle dañada',          desc: 'Deterioro general del pavimento' },
  { value: 'semaforo',        icon: '🚦',  label: 'Semáforo',              desc: 'No funciona o está roto' },
  { value: 'luminaria',       icon: '💡',  label: 'Luminaria apagada',     desc: 'Luz pública sin funcionamiento' },
  { value: 'cable_caido',     icon: '⚡',  label: 'Cable caído',           desc: 'Cable suelto o peligroso' },
  { value: 'basural',         icon: '🗑️',  label: 'Basural clandestino',   desc: 'Acumulación ilegal de residuos' },
  { value: 'escombros',       icon: '🧱',  label: 'Escombros',             desc: 'Materiales en la vía pública' },
  { value: 'arbol_caido',     icon: '🌳',  label: 'Árbol caído',           desc: 'Árbol sobre calzada o vereda' },
  { value: 'arbol_peligroso', icon: '⚠️',  label: 'Árbol peligroso',       desc: 'Con riesgo de caída' },
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
  pendiente:     { label: 'Pendiente',      color: 'bg-orange-100 text-orange-700',  icon: '⏳' },
  dañado:        { label: 'Registrado',     color: 'bg-red-100 text-red-700',        icon: '📋' },
  en_reparacion: { label: 'En reparación',  color: 'bg-amber-100 text-amber-700',    icon: '🔧' },
  en_progreso:   { label: 'En progreso',    color: 'bg-blue-100 text-blue-700',      icon: '🚧' },
  clausurado:    { label: 'Clausurado',     color: 'bg-slate-200 text-slate-600',    icon: '🚫' },
  finalizado:    { label: 'Resuelto',       color: 'bg-emerald-100 text-emerald-700',icon: '✅' },
  funcional:     { label: 'Resuelto',       color: 'bg-emerald-100 text-emerald-700',icon: '✅' },
};

function TicketCard({ reporte }) {
  const info = ESTADO_INFO[reporte.estado] || { label: reporte.estado, color: 'bg-slate-100 text-slate-600', icon: '📌' };
  return (
    <div className="mt-3 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-mono text-slate-400 truncate">{reporte.id}</span>
        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${info.color}`}>
          {info.icon} {info.label}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400 font-bold">Tipo</span>
          <span className="text-slate-700 font-black capitalize">{reporte.tipo.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400 font-bold">Fecha de ingreso</span>
          <span className="text-slate-700 font-black">
            {new Date(reporte.created_at).toLocaleDateString('es-AR')}
          </span>
        </div>
        {reporte.fecha_ultima_actualizacion && (
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400 font-bold">Última actualización</span>
            <span className="text-slate-700 font-black">
              {new Date(reporte.fecha_ultima_actualizacion).toLocaleDateString('es-AR')}
            </span>
          </div>
        )}
        {reporte.observaciones && (
          <p className="text-[10px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2 mt-2 leading-relaxed">
            {reporte.observaciones}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ReportarPage() {
  const [tipo, setTipo]           = useState('');
  const [location, setLocation]   = useState(null);   // { lat, lng }
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos]         = useState([]);      // base64 strings
  const [sending, setSending]     = useState(false);
  const [result, setResult]       = useState(null);   // { success, id } | { error }
  const [geoLoading, setGeoLoading] = useState(false);

  // Seguimiento
  const [ticketInput, setTicketInput]       = useState('');
  const [ticketData, setTicketData]         = useState(null);   // reporte | null | 'not_found'
  const [ticketLoading, setTicketLoading]   = useState(false);

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
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => { alert('No se pudo obtener tu ubicación.'); setGeoLoading(false); }
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSending(true);
    const res = await createReportePublico({
      tipo,
      lat: location.lat,
      lng: location.lng,
      descripcion: descripcion.trim() || null,
      fotos,
    });
    setSending(false);
    setResult(res);
  };

  // ── Pantalla de éxito ──────────────────────────────────────────────────────
  if (result?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl border border-emerald-100 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-black text-slate-900 mb-2">¡Reporte enviado!</h2>
          <p className="text-slate-500 text-sm mb-4">
            Tu reporte fue recibido y será revisado por el equipo municipal.
          </p>
          <p className="text-[11px] text-slate-500 mb-1">Guardá tu número de ticket para hacer el seguimiento:</p>
          <button
            onClick={() => navigator.clipboard?.writeText(result.id)}
            title="Copiar al portapapeles"
            className="w-full text-left font-mono text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-2 mb-6 break-all transition-colors border border-slate-200"
          >
            {result.id} <span className="text-[9px] text-slate-400 ml-1">📋 copiar</span>
          </button>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setTipo(''); setLocation(null); setDescripcion(''); setFotos([]); setResult(null); }}
              className="w-full bg-slate-900 hover:bg-slate-700 text-white py-3 rounded-2xl text-sm font-black uppercase transition-all"
            >
              Enviar otro reporte
            </button>
            <Link href="/login"
              className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 py-2 transition-colors">
              Acceder al sistema →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-slate-900 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-white uppercase tracking-widest">GeoMuni</p>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest">Sistema Municipal GIS</p>
        </div>
        <Link href="/login"
          className="text-[10px] font-black uppercase text-slate-400 hover:text-white transition-colors">
          Acceder →
        </Link>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

        {/* Título */}
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reportar un problema</h1>
          <p className="text-sm text-slate-500 mt-1">
            Informá una incidencia en la vía pública para que el municipio pueda atenderla.
          </p>
        </div>

        {/* Error de envío */}
        {result?.error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm font-bold text-red-600">
            {result.error}
          </div>
        )}

        {/* Paso 1: Tipo */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
            1 — ¿Qué problema es?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map(t => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all ${
                  tipo === t.value
                    ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                    : 'bg-white border-slate-100 hover:border-slate-300 text-slate-700'
                }`}
              >
                <span className="text-2xl leading-none">{t.icon}</span>
                <span className="text-[10px] font-black uppercase leading-tight">{t.label}</span>
                <span className={`text-[9px] leading-tight hidden sm:block ${tipo === t.value ? 'text-slate-300' : 'text-slate-400'}`}>
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Paso 2: Ubicación */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              2 — ¿Dónde está el problema?
            </p>
            <button
              onClick={handleGeolocate}
              disabled={geoLoading}
              className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1"
            >
              {geoLoading ? '...' : '📍 Mi ubicación'}
            </button>
          </div>

          <ReporteMapPicker
            onSelect={(lat, lng) => setLocation({ lat, lng })}
            selected={location}
          />

          {location ? (
            <p className="mt-2 text-[10px] font-mono text-slate-400 text-center">
              📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          ) : (
            <p className="mt-2 text-[10px] text-slate-400 text-center">
              Hacé clic en el mapa o usá "Mi ubicación"
            </p>
          )}
        </div>

        {/* Paso 3: Descripción */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
            3 — Descripción adicional <span className="normal-case font-bold text-slate-300">(opcional)</span>
          </p>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ej: El bache está frente al número 340, es muy grande y peligroso para los autos..."
            className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-300 resize-none"
          />
          <p className="text-[9px] text-slate-300 text-right mt-1">{descripcion.length}/500</p>
        </div>

        {/* Paso 4: Fotos */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
            4 — Fotos <span className="normal-case font-bold text-slate-300">(opcional, máx {MAX_FOTOS})</span>
          </p>

          {fotos.length > 0 && (
            <div className="flex gap-3 mb-3 flex-wrap">
              {fotos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={f} alt="" className="w-20 h-20 object-cover rounded-2xl border border-slate-200" />
                  <button
                    type="button"
                    onClick={() => removeFoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center shadow"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {fotos.length < MAX_FOTOS ? (
            <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-2xl p-4 transition-colors">
              <span className="text-2xl">📷</span>
              <div>
                <p className="text-xs font-black text-slate-600">Agregar fotos del problema</p>
                <p className="text-[10px] text-slate-400">JPG o PNG — se comprimen automáticamente</p>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFotos} />
            </label>
          ) : (
            <p className="text-[10px] text-slate-400 text-center py-2">Máximo {MAX_FOTOS} fotos alcanzado</p>
          )}
        </div>

        {/* Botón enviar */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-slate-900 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-wide transition-all shadow-lg shadow-slate-900/10"
        >
          {sending ? 'Enviando...' : 'Enviar reporte'}
        </button>

        {!tipo && (
          <p className="text-[10px] text-slate-400 text-center">Seleccioná el tipo de problema para continuar</p>
        )}
        {tipo && !location && (
          <p className="text-[10px] text-slate-400 text-center">Marcá la ubicación en el mapa para continuar</p>
        )}

        {/* Seguimiento de ticket */}
        <div className="border-t border-slate-200 pt-6">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
            🔍 Consultar estado de un reporte
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={ticketInput}
              onChange={e => setTicketInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuscarTicket()}
              placeholder="Pegá tu ID de ticket aquí..."
              className="flex-1 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-700 placeholder:text-slate-300 outline-none focus:border-blue-300 font-mono"
            />
            <button
              onClick={handleBuscarTicket}
              disabled={!ticketInput.trim() || ticketLoading}
              className="bg-slate-900 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all"
            >
              {ticketLoading ? '...' : 'Buscar'}
            </button>
          </div>

          {ticketData === 'not_found' && (
            <div className="mt-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm font-bold text-red-500">
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
