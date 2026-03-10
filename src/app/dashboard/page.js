'use client';

import { useState, useEffect } from 'react';
import {
  getParcelasTable, getInfraestructuraTable, getHistorialGlobal,
  getPersonal, createPersonal, updatePersonal, deletePersonal,
  getPropietariosTable, createPropietario, updatePropietario, deletePropietario,
} from '@/app/actions/geoActions';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import AppSidebar from '@/components/AppSidebar';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── PDF cedula ───────────────────────────────────────────────────────────────
function downloadParcelaPDF(p) {
  const doc = new jsPDF();
  const bool = v => v ? 'Sí' : 'No';
  const val  = v => (v === null || v === undefined || v === '' || v === 'null') ? '—' : String(v);

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text('CÉDULA CATASTRAL MUNICIPAL', 105, 18, { align: 'center' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('MUNICIPALIDAD DE AÑATUYA — SISTEMA GEOMUNI', 105, 27, { align: 'center' });
  doc.text(`Emitida: ${new Date().toLocaleDateString('es-AR')}   ID: ${p.id}`, 105, 34, { align: 'center' });

  autoTable(doc, {
    startY: 50,
    head: [['IDENTIFICACIÓN Y DATOS FISCALES', '']],
    body: [
      ['N° de Padrón', val(p.nro_padron)],
      ['Titular de Dominio', val(p.propietario) === '—' ? 'Sin propietario registrado' : val(p.propietario)],
      ['Barrio', val(p.barrio_nombre)],
      ['Superficie Total del Lote', `${val(p.superficie_m2)} m²`],
      ['Estado Fiscal', val(p.estado_fiscal).toUpperCase().replace(/_/g, ' ')],
      ['Suelo Fiscal Municipal', bool(p.es_fiscal)],
      ['Estado de Ocupación', val(p.estado_ocupacion)],
      ['Destino Previsto', val(p.destino_previsto)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
  });
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['MÓDULO A — SERVICIOS E INFRAESTRUCTURA', '']],
    body: [
      ['Agua Corriente', bool(p.agua_corriente)],
      ['Energía Eléctrica', bool(p.energia_electrica)],
      ['Cloacas', bool(p.cloacas)],
      ['Gas Natural', bool(p.gas_natural)],
      ['Alumbrado Público', bool(p.alumbrado_publico)],
      ['Tipo de Pavimento', val(p.pavimento)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
  });
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['MÓDULO B — EDIFICACIÓN Y MEJORAS', '']],
    body: [
      ['Superficie Cubierta', p.superficie_cubierta ? `${p.superficie_cubierta} m²` : '—'],
      ['Cantidad de Plantas', val(p.cantidad_plantas)],
      ['Antigüedad (años)', val(p.antiguedad)],
      ['Categoría Edificatoria', val(p.categoria_edificatoria)],
      ['Estado de Conservación', val(p.estado_conservacion)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
  });
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['MÓDULO C — DATOS LEGALES Y CATASTRALES', '']],
    body: [
      ['N° de Plano', val(p.numero_plano)],
      ['Expediente Municipal', val(p.expediente_municipal)],
      ['Zonificación', val(p.zonificacion)],
      ['Restricciones', val(p.restricciones)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [161, 98, 7], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
  });
  const finalY = doc.lastAutoTable.finalY;
  doc.setFontSize(8); doc.setTextColor(150, 150, 150);
  doc.text('Documento generado digitalmente. GeoMuni v2.0 — Plataforma de Infraestructura de Datos Espaciales Municipal.', 105, finalY + 14, { align: 'center' });
  doc.save(`Cedula_${p.nro_padron}.pdf`);
}

function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE      = 25;
const PAGE_SIZE_BARRIO = 10;

const ESTADO_FISCAL_OPTIONS = ['', 'al_dia', 'moroso', 'exento'];
const ESTADO_INFRA_OPTIONS  = ['', 'pendiente', 'en_progreso', 'en_reparacion', 'finalizado', 'funcional'];

const BADGE = {
  al_dia:        'bg-blue-50 text-blue-700 border-blue-100',
  moroso:        'bg-red-50 text-red-600 border-red-100',
  exento:        'bg-emerald-50 text-emerald-700 border-emerald-100',
  finalizado:    'bg-emerald-50 text-emerald-700 border-emerald-100',
  funcional:     'bg-emerald-50 text-emerald-700 border-emerald-100',
  en_progreso:   'bg-amber-50 text-amber-600 border-amber-100',
  en_reparacion: 'bg-orange-50 text-orange-600 border-orange-100',
  pendiente:     'bg-slate-50 text-slate-600 border-slate-200',
};

// ─── Pagination Controls ──────────────────────────────────────────────────────
function Pager({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-4 border-t border-slate-100">
      <button
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        className="px-3 py-1 text-xs font-black rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >← Anterior</button>
      <span className="text-xs font-bold text-slate-400">Página {page} de {totalPages}</span>
      <button
        disabled={page === totalPages}
        onClick={() => onPage(page + 1)}
        className="px-3 py-1 text-xs font-black rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >Siguiente →</button>
    </div>
  );
}

// ─── Accordion de barrio ──────────────────────────────────────────────────────
function BarrioGroup({ barrio, parcelas, onGoToMap }) {
  const [open, setOpen]   = useState(false);
  const [page, setPage]   = useState(1);
  const totalPages        = Math.ceil(parcelas.length / PAGE_SIZE_BARRIO);
  const slice             = parcelas.slice((page - 1) * PAGE_SIZE_BARRIO, page * PAGE_SIZE_BARRIO);
  const morosos           = parcelas.filter(p => p.estado_fiscal === 'moroso').length;
  const superficieTotal   = parcelas.reduce((a, p) => a + Number(p.superficie_m2 || 0), 0);

  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden mb-3">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-base">{open ? '▼' : '▶'}</span>
        <span className="flex-1 font-black text-slate-800 text-sm">{barrio}</span>
        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-full">
          {parcelas.length} parcelas
        </span>
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
          {superficieTotal.toLocaleString()} m²
        </span>
        {morosos > 0 && (
          <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
            {morosos} morosos
          </span>
        )}
      </button>

      {open && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  <Th>Padrón</Th><Th>Propietario</Th><Th>Superficie</Th><Th>Estado</Th><Th>Fiscal</Th>
                  <Th center>Acciones</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {slice.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                    <Td><span className="font-black">{item.nro_padron}</span></Td>
                    <Td><span className="text-slate-500 font-semibold">{item.propietario}</span></Td>
                    <Td><span className="text-slate-400 font-bold">{Number(item.superficie_m2).toLocaleString()} m²</span></Td>
                    <Td>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${BADGE[item.estado_fiscal] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                        {item.estado_fiscal?.replace('_',' ')}
                      </span>
                    </Td>
                    <Td><span className="text-xs font-bold text-slate-400">{item.es_fiscal ? 'Fiscal' : '—'}</span></Td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <button
                          onClick={() => onGoToMap(item, 'Parcela')}
                          className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-all border border-blue-100"
                          title="Ver en mapa">🗺️ Mapa</button>
                        <button
                          onClick={() => downloadParcelaPDF(item)}
                          className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-slate-50 text-slate-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-all border border-slate-200"
                          title="Descargar Cédula PDF">📄 PDF</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

// ─── Modal Cuadrilla ──────────────────────────────────────────────────────────
function PersonalModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    nombre:      item?.nombre      || '',
    cuadrilla:   item?.cuadrilla   || '',
    especialidad:item?.especialidad|| '',
    telefono:    item?.telefono    || '',
    email:       item?.email       || '',
    activo:      item?.activo      ?? true,
  });
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await updatePersonal(item.id, form);
      } else {
        await createPersonal(form);
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 bg-slate-900 flex items-center justify-between">
          <p className="text-sm font-black text-white uppercase tracking-widest">
            {isEdit ? 'Editar Personal' : 'Nuevo Personal'}
          </p>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
          <Field label="Nombre completo *">
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cuadrilla">
              <input value={form.cuadrilla} onChange={e => set('cuadrilla', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
            </Field>
            <Field label="Especialidad">
              <input value={form.especialidad} onChange={e => set('especialidad', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Teléfono">
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="Ej: 011-1234-5678"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={e => set('email', e.target.value)}
                type="email" placeholder="Ej: nombre@muni.gov.ar"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
            </Field>
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)}
                className="w-4 h-4 rounded" />
              <span className="text-sm font-bold text-slate-700">Activo en cuadrilla</span>
            </label>
          )}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-black uppercase text-slate-500 hover:text-slate-800 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-xs font-black uppercase bg-slate-900 hover:bg-slate-700 text-white rounded-xl transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{label}</p>
      {children}
    </div>
  );
}

// ─── Modal Propietario ────────────────────────────────────────────────────────
function PropietarioModal({ item, onClose, onSaved }) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState({
    nombre:   item?.nombre   || '',
    apellido: item?.apellido || '',
    dni:      item?.dni      || '',
    contacto: item?.contacto || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) { setError('Nombre y apellido son requeridos'); return; }
    setSaving(true); setError('');
    try {
      const res = isEdit
        ? await updatePropietario(item.id, form)
        : await createPropietario(form);
      if (res?.error) { setError(res.error); setSaving(false); return; }
      onSaved();
    } catch (e) {
      setError(e.message || 'Error al guardar');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 bg-slate-900 flex items-center justify-between">
          <p className="text-sm font-black text-white uppercase tracking-widest">
            {isEdit ? 'Editar Propietario' : 'Nuevo Propietario'}
          </p>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Apellido *">
              <input value={form.apellido} onChange={e => set('apellido', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
            </Field>
            <Field label="Nombre *">
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
            </Field>
          </div>
          <Field label="DNI">
            <input value={form.dni} onChange={e => set('dni', e.target.value)}
              placeholder="Ej: 28.123.456"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300" />
          </Field>
          <Field label="Contacto (teléfono / email / dirección)">
            <textarea value={form.contacto} onChange={e => set('contacto', e.target.value)}
              rows={3} placeholder="Ej: Tel 011-1234-5678 / juan@ejemplo.com"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-300 resize-none" />
          </Field>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-black uppercase text-slate-500 hover:text-slate-800 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-xs font-black uppercase bg-slate-900 hover:bg-slate-700 text-white rounded-xl transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session }                       = useSession();
  const rol                                     = session?.user?.rol || 'consultor';
  const canEdit                                 = rol === 'editor' || rol === 'administrador';
  const canDelete                               = rol === 'administrador';

  const [tab, setTab]                           = useState('catastro');
  const [parcelas, setParcelas]                 = useState([]);
  const [infra, setInfra]                       = useState([]);
  const [historial, setHistorial]               = useState([]);
  const [personal, setPersonal]                 = useState([]);
  const [propietarios, setPropietarios]         = useState([]);
  const [loading, setLoading]                   = useState(true);

  // Filtros
  const [search, setSearch]                     = useState('');
  const [barrioFilter, setBarrioFilter]         = useState('');
  const [estadoFiscal, setEstadoFiscal]         = useState('');
  const [esFiscal, setEsFiscal]                 = useState('');
  const [estadoInfra, setEstadoInfra]           = useState('');
  const [tipoInfra, setTipoInfra]               = useState('');
  const [searchPersonal, setSearchPersonal]     = useState('');
  const [searchProp, setSearchProp]             = useState('');

  // Paginación infra/historial/propietarios
  const [pageInfra, setPageInfra]               = useState(1);
  const [pageHistorial, setPageHistorial]       = useState(1);
  const [pageProp, setPageProp]                 = useState(1);

  // Modales
  const [personalModal, setPersonalModal]       = useState(null);
  const [propModal, setPropModal]               = useState(null);

  const router = useRouter();

  useEffect(() => { loadData(); }, [tab]);

  const loadData = async () => {
    setLoading(true);
    if (tab === 'catastro')            setParcelas(await getParcelasTable());
    else if (tab === 'infraestructura') setInfra(await getInfraestructuraTable());
    else if (tab === 'historial')       setHistorial(await getHistorialGlobal());
    else if (tab === 'cuadrillas')      setPersonal(await getPersonal());
    else if (tab === 'propietarios')    setPropietarios(await getPropietariosTable());
    setLoading(false);
  };

  const handleGoToMap = (item, type) => {
    const params = new URLSearchParams({ lat: item.lat || 0, lng: item.lng || 0, id: item.id, type });
    router.push(`/?${params.toString()}`);
  };

  // Reset page on filter change
  const handleSetSearch = v   => { setSearch(v);       setPageInfra(1); setPageHistorial(1); };
  const handleSetEstadoInfra  = v => { setEstadoInfra(v);  setPageInfra(1); };
  const handleSetTipoInfra    = v => { setTipoInfra(v);    setPageInfra(1); };

  const filteredParcelas = parcelas.filter(p =>
    (search === '' || p.nro_padron.toLowerCase().includes(search.toLowerCase()) || p.propietario.toLowerCase().includes(search.toLowerCase())) &&
    (barrioFilter === '' || p.barrio_nombre === barrioFilter) &&
    (estadoFiscal === '' || p.estado_fiscal === estadoFiscal) &&
    (esFiscal === '' || String(p.es_fiscal) === esFiscal)
  );

  const filteredInfra = infra.filter(i =>
    (search === '' || i.tipo.toLowerCase().includes(search.toLowerCase()) || i.responsable_nombre.toLowerCase().includes(search.toLowerCase())) &&
    (estadoInfra === '' || i.estado === estadoInfra) &&
    (tipoInfra === '' || i.tipo === tipoInfra)
  );

  const filteredHistorial = historial.filter(h =>
    search === '' ||
    h.reporte_tipo?.toLowerCase().includes(search.toLowerCase()) ||
    h.responsable_nombre?.toLowerCase().includes(search.toLowerCase()) ||
    h.observaciones?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPersonal = personal.filter(p =>
    searchPersonal === '' ||
    p.nombre?.toLowerCase().includes(searchPersonal.toLowerCase()) ||
    p.cuadrilla?.toLowerCase().includes(searchPersonal.toLowerCase()) ||
    p.especialidad?.toLowerCase().includes(searchPersonal.toLowerCase())
  );

  const filteredProp = propietarios.filter(p =>
    searchProp === '' ||
    p.nombre?.toLowerCase().includes(searchProp.toLowerCase()) ||
    p.apellido?.toLowerCase().includes(searchProp.toLowerCase()) ||
    p.dni?.toLowerCase().includes(searchProp.toLowerCase())
  );

  const barrios    = [...new Set(parcelas.map(p => p.barrio_nombre).filter(Boolean))].sort();
  const tiposInfra = [...new Set(infra.map(i => i.tipo).filter(Boolean))].sort();

  // Catastro agrupado por barrio
  const parcelasByBarrio = (() => {
    const groups = {};
    filteredParcelas.forEach(p => {
      const key = p.barrio_nombre || 'Sin barrio asignado';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  })();

  // Paginación
  const totalPagesInfra     = Math.ceil(filteredInfra.length / PAGE_SIZE);
  const pagedInfra          = filteredInfra.slice((pageInfra - 1) * PAGE_SIZE, pageInfra * PAGE_SIZE);
  const totalPagesHistorial = Math.ceil(filteredHistorial.length / PAGE_SIZE);
  const pagedHistorial      = filteredHistorial.slice((pageHistorial - 1) * PAGE_SIZE, pageHistorial * PAGE_SIZE);
  const totalPagesProp      = Math.ceil(filteredProp.length / PAGE_SIZE);
  const pagedProp           = filteredProp.slice((pageProp - 1) * PAGE_SIZE, pageProp * PAGE_SIZE);

  const activeCount = tab === 'catastro' ? filteredParcelas.length
    : tab === 'infraestructura' ? filteredInfra.length
    : tab === 'historial' ? filteredHistorial.length
    : tab === 'propietarios' ? filteredProp.length
    : filteredPersonal.length;

  const handleDownloadCSV = () => {
    const rows = tab === 'catastro' ? filteredParcelas
      : tab === 'infraestructura' ? filteredInfra
      : tab === 'propietarios' ? filteredProp
      : filteredHistorial;
    const name = tab === 'catastro' ? 'parcelas'
      : tab === 'infraestructura' ? 'infraestructura'
      : tab === 'propietarios' ? 'propietarios'
      : 'historial';
    downloadCSV(rows, `geomuni_${name}_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const handleDeletePersonal = async (id) => {
    if (!confirm('¿Eliminar este registro de personal?')) return;
    try { await deletePersonal(id); setPersonal(prev => prev.filter(p => p.id !== id)); }
    catch { alert('No se pudo eliminar. Es posible que el personal esté referenciado en obras.'); }
  };

  const handleDeletePropietario = async (id) => {
    if (!confirm('¿Eliminar este propietario? Las parcelas asociadas quedarán sin titular.')) return;
    try { await deletePropietario(id); setPropietarios(prev => prev.filter(p => p.id !== id)); }
    catch { alert('No se pudo eliminar.'); }
  };

  const TABS = [
    ['catastro',        '🏠 Catastro'],
    ['infraestructura', '🚧 Obras'],
    ['historial',       '🕒 Historial'],
    ['propietarios',    '👤 Propietarios'],
    ['cuadrillas',      '👷 Cuadrillas'],
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <AppSidebar />

      <div className="flex-1 flex flex-col overflow-auto">
        {/* Tab switcher */}
        <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {TABS.map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${tab === key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <main className="p-5 max-w-6xl mx-auto w-full">

          {/* MÉTRICAS */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {tab === 'catastro' ? (
              <>
                <MetricCard label="Total Parcelas"    value={parcelas.length} />
                <MetricCard label="Superficie Total"  value={`${parcelas.reduce((a,p) => a + Number(p.superficie_m2),0).toLocaleString()} m²`} color="text-blue-600" />
                <MetricCard label="Morosos"           value={parcelas.filter(p=>p.estado_fiscal==='moroso').length} color="text-red-500" />
              </>
            ) : tab === 'infraestructura' ? (
              <>
                <MetricCard label="Reportes Activos"  value={infra.filter(i=>i.estado!=='funcional'&&i.estado!=='finalizado').length} />
                <MetricCard label="En Progreso"       value={infra.filter(i=>i.estado==='en_progreso'||i.estado==='en_reparacion').length} color="text-amber-500" />
                <MetricCard label="Finalizados"       value={infra.filter(i=>i.estado==='finalizado').length} color="text-emerald-500" />
              </>
            ) : tab === 'historial' ? (
              <>
                <MetricCard label="Movimientos"       value={historial.length} />
                <MetricCard label="Última Actividad"  value={historial[0] ? new Date(historial[0].fecha_registro).toLocaleDateString() : '-'} color="text-blue-600" small />
                <MetricCard label="Personal Activo"   value={new Set(historial.map(h=>h.responsable_id)).size} />
              </>
            ) : tab === 'propietarios' ? (
              <>
                <MetricCard label="Total Propietarios" value={propietarios.length} />
                <MetricCard label="Con Parcelas"        value={propietarios.filter(p=>p.parcelas_count>0).length} color="text-blue-600" />
                <MetricCard label="Sin Parcelas"        value={propietarios.filter(p=>p.parcelas_count===0).length} color="text-slate-400" />
              </>
            ) : (
              <>
                <MetricCard label="Total Personal"    value={personal.length} />
                <MetricCard label="Activos"           value={personal.filter(p=>p.activo).length} color="text-emerald-500" />
                <MetricCard label="Inactivos"         value={personal.filter(p=>!p.activo).length} color="text-slate-400" />
              </>
            )}
          </div>

          {/* FILTROS */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 mb-4 flex flex-wrap gap-2 items-center">
            {tab === 'cuadrillas' ? (
              <input type="text" placeholder="Buscar por nombre, cuadrilla o especialidad..." value={searchPersonal} onChange={e => setSearchPersonal(e.target.value)}
                className="flex-1 min-w-[160px] bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-sm font-bold outline-none focus:border-blue-300" />
            ) : tab === 'propietarios' ? (
              <input type="text" placeholder="Buscar por apellido, nombre o DNI..." value={searchProp} onChange={e => { setSearchProp(e.target.value); setPageProp(1); }}
                className="flex-1 min-w-[160px] bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-sm font-bold outline-none focus:border-blue-300" />
            ) : (
              <input type="text" placeholder="Buscar..." value={search} onChange={e => handleSetSearch(e.target.value)}
                className="flex-1 min-w-[160px] bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-sm font-bold outline-none focus:border-blue-300" />
            )}

            {tab === 'catastro' && (
              <>
                <select value={barrioFilter} onChange={e => setBarrioFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-blue-300">
                  <option value="">Todos los barrios</option>
                  {barrios.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={estadoFiscal} onChange={e => setEstadoFiscal(e.target.value)}
                  className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-blue-300">
                  <option value="">Todos los estados</option>
                  {ESTADO_FISCAL_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{s.replace('_',' ').toUpperCase()}</option>)}
                </select>
                <select value={esFiscal} onChange={e => setEsFiscal(e.target.value)}
                  className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-blue-300">
                  <option value="">Fiscal / No fiscal</option>
                  <option value="true">Solo fiscal</option>
                  <option value="false">No fiscal</option>
                </select>
              </>
            )}
            {tab === 'infraestructura' && (
              <>
                <select value={tipoInfra} onChange={e => handleSetTipoInfra(e.target.value)}
                  className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-blue-300">
                  <option value="">Todos los tipos</option>
                  {tiposInfra.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
                <select value={estadoInfra} onChange={e => handleSetEstadoInfra(e.target.value)}
                  className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-blue-300">
                  <option value="">Todos los estados</option>
                  {ESTADO_INFRA_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{s.replace('_',' ').toUpperCase()}</option>)}
                </select>
              </>
            )}

            <span className="text-xs font-bold text-slate-400 ml-1">{activeCount} registros</span>

            {(tab === 'catastro' || tab === 'infraestructura' || tab === 'propietarios') && (
              <button onClick={handleDownloadCSV}
                className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all flex items-center gap-1.5">
                ⬇ Exportar CSV
              </button>
            )}
            {tab === 'propietarios' && canEdit && (
              <button onClick={() => setPropModal({})}
                className="bg-slate-900 hover:bg-slate-700 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all">
                + Agregar Propietario
              </button>
            )}
            {tab === 'cuadrillas' && canEdit && (
              <button onClick={() => setPersonalModal({})}
                className="ml-auto bg-slate-900 hover:bg-slate-700 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all">
                + Agregar Personal
              </button>
            )}
          </div>

          {/* CONTENIDO POR TAB */}
          {loading ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-14 text-center">
              <p className="font-bold text-slate-400 animate-pulse italic text-sm">Consultando registros municipales...</p>
            </div>
          ) : (

            /* ── CATASTRO: accordion por barrio ── */
            tab === 'catastro' ? (
              parcelasByBarrio.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-14 text-center">
                  <p className="font-bold text-slate-400 text-sm">Sin resultados para los filtros aplicados.</p>
                </div>
              ) : (
                <div>
                  {parcelasByBarrio.map(([barrio, items]) => (
                    <BarrioGroup key={barrio} barrio={barrio} parcelas={items} onGoToMap={handleGoToMap} />
                  ))}
                </div>
              )

            /* ── OBRAS / INFRAESTRUCTURA ── */
            ) : tab === 'infraestructura' ? (
              <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <Th>Tipo</Th><Th>Estado</Th><Th>Técnico Adjudicado</Th><Th>Responsable</Th><Th>Inicio</Th>
                        <Th center>Acciones</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pagedInfra.length === 0 ? (
                        <tr><td colSpan="6" className="px-6 py-14 text-center font-bold text-slate-400 text-sm">Sin resultados.</td></tr>
                      ) : pagedInfra.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                          <Td><span className="font-black capitalize">{item.tipo?.replace(/_/g,' ')}</span></Td>
                          <Td>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${BADGE[item.estado] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                              {item.estado?.replace(/_/g,' ')}
                            </span>
                          </Td>
                          <Td>
                            {item.adjudicado_a
                              ? <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{item.adjudicado_nombre}</span>
                              : <span className="text-slate-300 font-bold text-xs">—</span>}
                          </Td>
                          <Td><span className="text-slate-500 font-semibold text-xs">{item.responsable_nombre}</span></Td>
                          <Td><span className="text-slate-400 font-bold">{item.fecha_inicio ? new Date(item.fecha_inicio).toLocaleDateString('es-AR') : '—'}</span></Td>
                          <td className="px-4 py-2 text-center">
                            <button onClick={() => handleGoToMap(item, 'Reporte')}
                              className="inline-flex items-center gap-1 text-[10px] font-black uppercase bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-all border border-blue-100"
                              title="Ver en mapa">🗺️ Mapa</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={pageInfra} totalPages={totalPagesInfra} onPage={setPageInfra} />
              </div>

            /* ── HISTORIAL ── */
            ) : tab === 'historial' ? (
              <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <Th>Fecha</Th><Th>Obra / Reporte</Th><Th>Nuevo Estado</Th><Th>Responsable</Th><Th>Observación</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pagedHistorial.length === 0 ? (
                        <tr><td colSpan="5" className="px-6 py-14 text-center font-bold text-slate-400 text-sm">Sin resultados.</td></tr>
                      ) : pagedHistorial.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                          <Td><span className="text-xs text-slate-400 font-bold">{new Date(item.fecha_registro).toLocaleString('es-AR')}</span></Td>
                          <Td><span className="font-black capitalize">{item.reporte_tipo?.replace(/_/g,' ')}</span></Td>
                          <Td><span className="text-[9px] font-black uppercase bg-slate-900 text-white px-2 py-0.5 rounded-lg">{item.estado_nuevo?.replace(/_/g,' ')}</span></Td>
                          <Td><span className="text-slate-600 font-semibold">{item.responsable_nombre}</span></Td>
                          <Td><span className="text-xs text-slate-400 italic max-w-[180px] truncate block">{item.observaciones || '—'}</span></Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={pageHistorial} totalPages={totalPagesHistorial} onPage={setPageHistorial} />
              </div>

            /* ── PROPIETARIOS ── */
            ) : tab === 'propietarios' ? (
              <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <Th>Apellido</Th><Th>Nombre</Th><Th>DNI</Th><Th>Contacto</Th><Th center>Parcelas</Th>
                        {canEdit && <Th center>Acciones</Th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pagedProp.length === 0 ? (
                        <tr><td colSpan="6" className="px-6 py-14 text-center font-bold text-slate-400 text-sm">Sin resultados.</td></tr>
                      ) : pagedProp.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                          <Td><span className="font-black">{item.apellido}</span></Td>
                          <Td><span className="text-slate-700 font-semibold">{item.nombre}</span></Td>
                          <Td><span className="font-mono text-slate-500 text-xs">{item.dni || '—'}</span></Td>
                          <Td><span className="text-slate-400 text-xs max-w-[160px] truncate block">{item.contacto || '—'}</span></Td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.parcelas_count > 0 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                              {item.parcelas_count} {item.parcelas_count === 1 ? 'parcela' : 'parcelas'}
                            </span>
                          </td>
                          {canEdit && (
                            <td className="px-4 py-2 text-center">
                              <div className="flex items-center gap-1.5 justify-center">
                                <button onClick={() => setPropModal(item)}
                                  className="text-[10px] font-black uppercase bg-slate-50 text-slate-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-all border border-slate-200">
                                  ✏️ Editar
                                </button>
                                {canDelete && (
                                  <button onClick={() => handleDeletePropietario(item.id)}
                                    className="text-[10px] font-black uppercase bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-all border border-red-100">
                                    🗑
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={pageProp} totalPages={totalPagesProp} onPage={setPageProp} />
              </div>

            /* ── CUADRILLAS ── */
            ) : (
              filteredPersonal.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-14 text-center">
                  <p className="font-bold text-slate-400 text-sm mb-3">No hay personal registrado.</p>
                  {canEdit && (
                    <button onClick={() => setPersonalModal({})}
                      className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black uppercase transition-all hover:bg-slate-700">
                      + Agregar primer miembro
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPersonal.map(p => (
                    <div key={p.id}
                      className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 ${p.activo ? 'border-slate-100' : 'border-slate-200 opacity-60'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white text-sm font-black shrink-0">
                          {p.nombre?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-slate-900 text-sm truncate">{p.nombre}</p>
                          {p.cuadrilla && (
                            <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {p.cuadrilla}
                            </span>
                          )}
                        </div>
                        {!p.activo && (
                          <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">Inactivo</span>
                        )}
                      </div>

                      {p.especialidad && (
                        <p className="text-xs text-slate-500 font-semibold">{p.especialidad}</p>
                      )}

                      <div className="space-y-1.5 text-xs text-slate-500">
                        {p.telefono && (
                          <div className="flex items-center gap-2">
                            <span className="text-base leading-none">📞</span>
                            <span className="font-bold">{p.telefono}</span>
                          </div>
                        )}
                        {p.email && (
                          <div className="flex items-center gap-2">
                            <span className="text-base leading-none">✉️</span>
                            <span className="font-medium truncate">{p.email}</span>
                          </div>
                        )}
                        {!p.telefono && !p.email && (
                          <p className="text-slate-300 italic text-[10px]">Sin datos de contacto</p>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                          <button onClick={() => setPersonalModal(p)}
                            className="flex-1 text-[10px] font-black uppercase text-slate-500 hover:text-slate-800 hover:bg-slate-50 py-1.5 rounded-lg transition-all text-center border border-slate-100">
                            ✏️ Editar
                          </button>
                          {canDelete && (
                            <button onClick={() => handleDeletePersonal(p.id)}
                              className="flex-1 text-[10px] font-black uppercase text-red-400 hover:text-red-600 hover:bg-red-50 py-1.5 rounded-lg transition-all text-center border border-red-100">
                              🗑 Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )
          )}
        </main>
      </div>

      {/* Modal Personal */}
      {personalModal !== null && (
        <PersonalModal
          item={personalModal}
          onClose={() => setPersonalModal(null)}
          onSaved={async () => {
            setPersonalModal(null);
            setPersonal(await getPersonal());
          }}
        />
      )}

      {/* Modal Propietario */}
      {propModal !== null && (
        <PropietarioModal
          item={propModal}
          onClose={() => setPropModal(null)}
          onSaved={async () => {
            setPropModal(null);
            setPropietarios(await getPropietariosTable());
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MetricCard({ label, value, color = 'text-slate-900', small = false }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{label}</p>
      <p className={`${small ? 'text-lg' : 'text-2xl'} font-black ${color}`}>{value}</p>
    </div>
  );
}

function Th({ children, center = false }) {
  return (
    <th className={`px-4 py-3 text-[9px] font-black text-slate-400 uppercase ${center ? 'text-center' : ''}`}>{children}</th>
  );
}

function Td({ children }) {
  return <td className="px-4 py-2">{children}</td>;
}
