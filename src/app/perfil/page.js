'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import AppSidebar from '@/components/AppSidebar';
import { cambiarPassword } from '@/app/actions/geoActions';

const ROL_BADGE = {
  administrador: 'bg-red-100 text-red-700',
  editor:        'bg-blue-100 text-blue-700',
  consultor:     'bg-slate-100 text-slate-600',
  tecnico:       'bg-emerald-100 text-emerald-700',
};

export default function PerfilPage() {
  const { data: session } = useSession();
  const rol = session?.user?.rol || 'consultor';

  const [actual, setActual]   = useState('');
  const [nueva, setNueva]     = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [show, setShow]       = useState({ actual: false, nueva: false, confirmar: false });
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null); // { type: 'ok'|'error', text }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (nueva !== confirmar) { setMsg({ type: 'error', text: 'Las contraseñas nuevas no coinciden.' }); return; }
    if (nueva.length < 6)    { setMsg({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres.' }); return; }
    setSaving(true);
    const res = await cambiarPassword(actual, nueva);
    setSaving(false);
    if (res.success) {
      setMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' });
      setActual(''); setNueva(''); setConfirmar('');
    } else {
      setMsg({ type: 'error', text: res.error || 'Error al cambiar la contraseña.' });
    }
  };

  const toggle = (field) => setShow(s => ({ ...s, [field]: !s[field] }));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />

      <main className="flex-1 p-8">
        <div className="max-w-lg mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mi Perfil</h1>
            <p className="text-sm text-slate-500 mt-1">Información de tu cuenta y configuración de acceso</p>
          </div>

          {/* Datos de la cuenta */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Datos de la cuenta</p>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-900/20 shrink-0">
                {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-base font-black text-slate-900">{session?.user?.name || '—'}</p>
                <p className="text-sm text-slate-500 mt-0.5">{session?.user?.email || '—'}</p>
                <span className={`inline-block mt-1.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${ROL_BADGE[rol] || ROL_BADGE.consultor}`}>
                  {rol}
                </span>
              </div>
            </div>
          </div>

          {/* Cambiar contraseña */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-5">Cambiar contraseña</p>

            {msg && (
              <div className={`rounded-2xl px-4 py-3 text-sm font-bold mb-5 ${
                msg.type === 'ok'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Contraseña actual
                </label>
                <div className="relative">
                  <input
                    type={show.actual ? 'text' : 'password'}
                    value={actual}
                    onChange={e => setActual(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 pr-12 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 bg-slate-50"
                  />
                  <button type="button" tabIndex={-1} onClick={() => toggle('actual')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none px-1">
                    {show.actual ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={show.nueva ? 'text' : 'password'}
                    value={nueva}
                    onChange={e => setNueva(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 pr-12 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 bg-slate-50"
                  />
                  <button type="button" tabIndex={-1} onClick={() => toggle('nueva')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none px-1">
                    {show.nueva ? '🙈' : '👁'}
                  </button>
                </div>
                {nueva && nueva.length < 6 && (
                  <p className="text-[10px] text-red-400 font-bold ml-1">Mínimo 6 caracteres</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={show.confirmar ? 'text' : 'password'}
                    value={confirmar}
                    onChange={e => setConfirmar(e.target.value)}
                    autoComplete="new-password"
                    required
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 pr-12 text-sm font-medium text-slate-700 outline-none focus:border-blue-300 bg-slate-50"
                  />
                  <button type="button" tabIndex={-1} onClick={() => toggle('confirmar')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none px-1">
                    {show.confirmar ? '🙈' : '👁'}
                  </button>
                </div>
                {confirmar && nueva !== confirmar && (
                  <p className="text-[10px] text-red-400 font-bold ml-1">Las contraseñas no coinciden</p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-slate-900 hover:bg-slate-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-3.5 rounded-2xl text-sm font-black uppercase tracking-wide transition-all mt-2"
              >
                {saving ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
}
