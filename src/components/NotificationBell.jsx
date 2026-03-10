'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getNotificaciones,
  getNotificacionesCount,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  getInfraLocation,
} from '@/app/actions/geoActions';

export default function NotificationBell({ upward = false }) {
  const router                          = useRouter();
  const [count, setCount]               = useState(0);
  const [notifs, setNotifs]             = useState([]);
  const [isOpen, setIsOpen]             = useState(false);
  const [loading, setLoading]           = useState(false);
  const panelRef                        = useRef(null);

  // Poll para el conteo no leídas cada 30 s
  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadCount = async () => {
    const n = await getNotificacionesCount();
    setCount(n);
  };

  const handleOpen = async () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      setLoading(true);
      const data = await getNotificaciones();
      setNotifs(data);
      setLoading(false);
    }
  };

  const handleMarcarLeida = async (id) => {
    await marcarNotificacionLeida(id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    setCount(prev => Math.max(0, prev - 1));
  };

  const handleMarcarTodas = async () => {
    await marcarTodasLeidas();
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    setCount(0);
  };

  const handleClickNotif = async (n) => {
    if (!n.leida) await handleMarcarLeida(n.id);
    if (n.referencia_id) {
      const loc = await getInfraLocation(n.referencia_id);
      if (loc) {
        router.push(`/?id=${n.referencia_id}&type=Reporte&lat=${loc.lat}&lng=${loc.lng}`);
        setIsOpen(false);
      }
    }
  };

  const TIPO_ICON = { asignacion: '📋', actualizacion: '🔄', finalizacion: '✅', nuevo_reporte: '📩' };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors"
        title="Notificaciones"
      >
        <span className="text-slate-400 text-base leading-none">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-black rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={`${upward ? 'fixed bottom-20 left-3 right-3' : 'absolute left-full top-0 ml-3 w-80'} bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-[300]`}>
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <p className="text-[10px] font-black text-white uppercase tracking-widest">Notificaciones</p>
            {count > 0 && (
              <button
                onClick={handleMarcarTodas}
                className="text-[9px] font-black text-slate-400 hover:text-white uppercase transition-colors"
              >
                Marcar todas
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-80">
            {loading ? (
              <p className="text-center text-slate-400 text-xs p-6">Cargando...</p>
            ) : notifs.length === 0 ? (
              <p className="text-center text-slate-400 text-xs p-8">Sin notificaciones</p>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClickNotif(n)}
                  className={`px-4 py-3 border-b border-slate-800 transition-colors cursor-pointer ${
                    !n.leida ? 'bg-slate-800/60 hover:bg-slate-800' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base leading-none shrink-0 mt-0.5">
                      {TIPO_ICON[n.tipo] || '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-white truncate">{n.titulo}</p>
                        {!n.leida && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                      </div>
                      {n.mensaje && (
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{n.mensaje}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[9px] text-slate-600">
                          {new Date(n.created_at).toLocaleString('es-AR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                          })}
                        </p>
                        {n.referencia_id && (
                          <span className="text-[9px] font-black text-blue-400 uppercase">Ver en mapa →</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
