'use client';

import { useState, useEffect } from 'react';
import { getPropietarios, createPropietario, updatePropietario } from '@/app/actions/geoActions';

export default function PropietariosModal({ isOpen, onClose, onRefresh }) {
  const [propietarios, setPropietarios] = useState([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', apellido: '', dni: '', contacto: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) loadPropietarios();
  }, [isOpen]);

  const loadPropietarios = async () => {
    const data = await getPropietarios();
    setPropietarios(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    let res;
    if (editingId) {
      res = await updatePropietario(editingId, formData);
    } else {
      res = await createPropietario(formData);
    }

    if (res.success) {
      await loadPropietarios();
      setIsAdding(false);
      setEditingId(null);
      setFormData({ nombre: '', apellido: '', dni: '', contacto: '' });
      onRefresh(); // Notificar al mapa para actualizar su lista interna
    } else {
      alert("Error: " + res.error);
    }
    setIsSaving(false);
  };

  const handleEdit = (p) => {
    setFormData({ nombre: p.nombre, apellido: p.apellido, dni: p.dni, contacto: p.contacto || '' });
    setEditingId(p.id);
    setIsAdding(true);
  };

  if (!isOpen) return null;

  const filtered = propietarios.filter(p => 
    `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        
        {/* HEADER */}
        <div className="p-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Gestión de Propietarios</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Base de Datos de Contribuyentes</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold hover:bg-slate-50 transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* LISTA (IZQUIERDA) */}
          <div className="flex-[1.5] p-6 overflow-y-auto border-r border-slate-100 bg-white">
            <div className="mb-6 sticky top-0 bg-white pb-2">
              <input 
                type="text" 
                placeholder="Buscar por Nombre, Apellido o DNI..." 
                className="w-full bg-slate-100 border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              {filtered.map(p => (
                <div key={p.id} className="p-4 rounded-2xl border border-slate-50 bg-slate-50/50 hover:bg-slate-100 transition-colors flex justify-between items-center group">
                  <div>
                    <p className="text-sm font-black text-slate-700">{p.apellido}, {p.nombre}</p>
                    <p className="text-[10px] font-bold text-slate-400">DNI: {p.dni}</p>
                  </div>
                  <button 
                    onClick={() => handleEdit(p)}
                    className="opacity-0 group-hover:opacity-100 bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:border-blue-500 hover:text-blue-600 transition-all"
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* FORMULARIO (DERECHA) */}
          <div className="flex-1 p-8 bg-slate-50">
            <div className="bg-white p-8 rounded-[32px] shadow-xl border border-slate-100">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                {editingId ? '📝 Editar Datos' : '👤 Nuevo Registro'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Nombre</label>
                    <input required className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Apellido</label>
                    <input required className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500" value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">DNI / CUIL</label>
                  <input required className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Contacto (Teléfono/Email)</label>
                  <input className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} />
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  <button 
                    disabled={isSaving}
                    type="submit" 
                    className="w-full bg-blue-600 text-white py-3 rounded-2xl font-black text-xs uppercase shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Guardando...' : (editingId ? 'Actualizar Propietario' : 'Crear Registro')}
                  </button>
                  {editingId && (
                    <button 
                      type="button" 
                      onClick={() => { setEditingId(null); setFormData({ nombre: '', apellido: '', dni: '', contacto: '' }); }}
                      className="w-full bg-slate-100 text-slate-500 py-3 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all"
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
