'use client';

import { useState, useEffect } from 'react';
import { getUsuarios, createUsuario, updateUsuarioRol, toggleUsuarioActivo, resetUsuarioPassword, deleteUsuario } from '@/app/actions/geoActions';
import AppSidebar from '@/components/AppSidebar';

const ROLES = ['administrador', 'editor', 'tecnico', 'consultor'];

const ROL_BADGE = {
  administrador: 'bg-red-100 text-red-700 border-red-200',
  editor:        'bg-blue-100 text-blue-700 border-blue-200',
  tecnico:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  consultor:     'bg-slate-100 text-slate-600 border-slate-200',
};

export default function AdminPage() {
  const [usuarios, setUsuarios]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [resetTarget, setResetTarget]   = useState(null); // { id, nombre }
  const [resetPass, setResetPass]       = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, nombre }
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null);

  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'consultor' });
  const [showPass, setShowPass] = useState({ create: false, reset: false });

  useEffect(() => { loadUsuarios(); }, []);

  const loadUsuarios = async () => {
    setLoading(true);
    setUsuarios(await getUsuarios());
    setLoading(false);
  };

  const notify = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const result = await createUsuario(form);
    setSaving(false);
    if (result?.error) { notify(result.error, false); return; }
    notify('Usuario creado correctamente.');
    setForm({ nombre: '', email: '', password: '', rol: 'consultor' });
    setShowForm(false);
    loadUsuarios();
  };

  const handleRol = async (id, rol) => {
    const result = await updateUsuarioRol(id, rol);
    if (result?.error) { notify(result.error, false); return; }
    notify('Rol actualizado.');
    loadUsuarios();
  };

  const handleToggle = async (id) => {
    const result = await toggleUsuarioActivo(id);
    if (result?.error) { notify(result.error, false); return; }
    notify('Estado de cuenta actualizado.');
    loadUsuarios();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const result = await deleteUsuario(deleteTarget.id);
    setSaving(false);
    if (result?.error) { notify(result.error, false); setDeleteTarget(null); return; }
    notify(`Usuario ${deleteTarget.nombre} eliminado.`);
    setDeleteTarget(null);
    loadUsuarios();
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!resetPass || resetPass.length < 6) { notify('La contraseña debe tener al menos 6 caracteres.', false); return; }
    setSaving(true);
    const result = await resetUsuarioPassword(resetTarget.id, resetPass);
    setSaving(false);
    if (result?.error) { notify(result.error, false); return; }
    notify(`Contraseña de ${resetTarget.nombre} restablecida.`);
    setResetTarget(null);
    setResetPass('');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <AppSidebar />

      <div className="flex-1 flex flex-col overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">Administración de Usuarios</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Gestión de acceso al sistema</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-slate-700 transition-all">
            {showForm ? '✕ Cancelar' : '+ Nuevo Usuario'}
          </button>
        </div>

        <main className="p-6 max-w-4xl mx-auto w-full">

          {/* Toast */}
          {toast && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-bold border ${toast.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {toast.ok ? '✓' : '✕'} {toast.msg}
            </div>
          )}

          {/* Formulario nuevo usuario */}
          {showForm && (
            <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
              <p className="text-xs font-black uppercase text-slate-500 mb-4">Crear nuevo usuario</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Nombre completo</label>
                  <input required value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Email</label>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Contraseña inicial</label>
                  <div className="relative">
                    <input required type={showPass.create ? 'text' : 'password'} minLength={6} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-9 text-sm font-bold outline-none focus:border-blue-300" />
                    <button type="button" onClick={() => setShowPass(p => ({...p, create: !p.create}))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-base leading-none">
                      {showPass.create ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Rol</label>
                  <select value={form.rol} onChange={e => setForm(f => ({...f, rol: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300">
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear Usuario'}
              </button>
            </form>
          )}

          {/* Modal reset contraseña */}
          {resetTarget && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <form onSubmit={handleReset} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                <p className="text-sm font-black uppercase mb-1">Restablecer contraseña</p>
                <p className="text-xs text-slate-400 font-bold mb-4">{resetTarget.nombre}</p>
                <div className="relative mb-4">
                  <input type={showPass.reset ? 'text' : 'password'} minLength={6} required placeholder="Nueva contraseña (mín. 6 chars)"
                    value={resetPass} onChange={e => setResetPass(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-9 text-sm font-bold outline-none focus:border-blue-300" />
                  <button type="button" onClick={() => setShowPass(p => ({...p, reset: !p.reset}))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-base leading-none">
                    {showPass.reset ? '🙈' : '👁'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-slate-900 text-white py-2 rounded-xl text-xs font-black uppercase disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Confirmar'}
                  </button>
                  <button type="button" onClick={() => { setResetTarget(null); setResetPass(''); setShowPass(p => ({...p, reset: false})); }}
                    className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-200">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal confirmar eliminación */}
          {deleteTarget && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                <p className="text-sm font-black uppercase mb-1 text-red-700">Eliminar usuario</p>
                <p className="text-xs text-slate-500 font-bold mb-5">
                  ¿Eliminar permanentemente a <span className="text-slate-900">{deleteTarget.nombre}</span>? Esta acción no se puede deshacer.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} disabled={saving}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-black uppercase disabled:opacity-50 transition-all">
                    {saving ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                  <button onClick={() => setDeleteTarget(null)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-200">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de usuarios */}
          <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase">Usuario</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase">Email</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase">Rol</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase">Estado</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan="5" className="px-5 py-14 text-center font-bold text-slate-400 animate-pulse text-sm italic">Cargando usuarios...</td></tr>
                ) : usuarios.map(u => (
                  <tr key={u.id} className={`hover:bg-slate-50/70 transition-colors ${!u.activo ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-black">{u.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <select value={u.rol}
                        onChange={e => handleRol(u.id, e.target.value)}
                        className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border outline-none cursor-pointer ${ROL_BADGE[u.rol]}`}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${u.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 justify-center">
                        <button onClick={() => setResetTarget({ id: u.id, nombre: u.nombre })}
                          className="text-[9px] font-black uppercase bg-slate-50 text-slate-600 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-all">
                          🔑 Contraseña
                        </button>
                        <button onClick={() => handleToggle(u.id)}
                          className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border transition-all ${u.activo ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'}`}>
                          {u.activo ? '🔒 Suspender' : '✓ Activar'}
                        </button>
                        <button onClick={() => setDeleteTarget({ id: u.id, nombre: u.nombre })}
                          className="text-[9px] font-black uppercase bg-red-50 text-red-700 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition-all">
                          🗑 Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Info de roles */}
          <div className="mt-6 grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { rol: 'Administrador', color: 'border-red-200 bg-red-50',       badge: 'bg-red-100 text-red-700',         permisos: ['Todo el sistema', 'Crear/editar/eliminar registros', 'Gestionar usuarios y roles', 'Restablecer contraseñas'] },
              { rol: 'Editor',        color: 'border-blue-200 bg-blue-50',      badge: 'bg-blue-100 text-blue-700',        permisos: ['Ver mapa y catastro', 'Crear y editar parcelas', 'Gestionar infraestructura', 'Adjudicar reportes a técnicos'] },
              { rol: 'Técnico',       color: 'border-emerald-200 bg-emerald-50',badge: 'bg-emerald-100 text-emerald-700',  permisos: ['Ver mapa (solo sus reportes)', 'Actualizar estado de sus reportes', 'Agregar observaciones', 'Vista "Mis Reportes"'] },
              { rol: 'Consultor',     color: 'border-slate-200 bg-slate-50',    badge: 'bg-slate-100 text-slate-600',      permisos: ['Ver mapa y parcelas', 'Ver dashboard', 'Descargar cédulas PDF', 'Sin permisos de edición'] },
            ].map(({ rol, color, badge, permisos }) => (
              <div key={rol} className={`rounded-2xl border p-4 ${color}`}>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${badge}`}>{rol}</span>
                <ul className="mt-3 space-y-1">
                  {permisos.map(p => (
                    <li key={p} className="text-[10px] font-bold text-slate-600 flex items-start gap-1.5">
                      <span className="mt-0.5">·</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </main>
      </div>
    </div>
  );
}
