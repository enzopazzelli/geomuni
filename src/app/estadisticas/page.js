'use client';

import { useEffect, useState } from 'react';
import { getEstadisticas } from '@/app/actions/geoActions';
import AppSidebar from '@/components/AppSidebar';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── PDF export ───────────────────────────────────────────────────────────────
function downloadEstadisticasPDF(data) {
  const doc  = new jsPDF();
  const hoy  = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  // ── Encabezado ──────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);          // slate-950
  doc.rect(0, 0, 210, 45, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE ESTADÍSTICAS MUNICIPALES', 105, 16, { align: 'center' });
  doc.setFontSize(9);  doc.setFont('helvetica', 'normal');
  doc.text('MUNICIPALIDAD — SISTEMA GEOMUNI', 105, 25, { align: 'center' });
  doc.setTextColor(148, 163, 184);
  doc.text(`Generado el ${hoy} a las ${hora}`, 105, 34, { align: 'center' });

  let y = 55;

  // ── KPIs ────────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [['INDICADORES CLAVE DE OPERACIÓN', '']],
    body: [
      ['Total de registros',             String(data.kpis.total)],
      ['Reportes pendientes',            String(data.kpis.pendientes)],
      ['Reportes vencidos (plazo superado)', String(data.kpis.vencidos)],
      ['Adjudicados a técnico',          String(data.kpis.adjudicados)],
      ['Finalizados / resueltos',        String(data.kpis.finalizados)],
      ['Nuevos en los últimos 30 días',  String(data.kpis.ultimos_30d)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 110 } },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ── Por tipo ────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [['REPORTES POR TIPO', 'Cantidad', '% del total']],
    body: data.porTipo.map(d => [
      d.tipo.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      String(d.cantidad),
      data.kpis.total > 0 ? `${((d.cantidad / data.kpis.total) * 100).toFixed(1)}%` : '0%',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 175], textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ── Por estado ──────────────────────────────────────────────────────────────
  // Add new page if not enough space
  if (y > 220) { doc.addPage(); y = 20; }

  autoTable(doc, {
    startY: y,
    head: [['REPORTES POR ESTADO', 'Cantidad', '% del total']],
    body: data.porEstado.map(d => [
      d.estado.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      String(d.cantidad),
      data.kpis.total > 0 ? `${((d.cantidad / data.kpis.total) * 100).toFixed(1)}%` : '0%',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [6, 78, 59], textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
  });
  y = doc.lastAutoTable.finalY + 8;

  // ── Tendencia 14 días ────────────────────────────────────────────────────────
  if (data.tendencia && data.tendencia.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y,
      head: [['NUEVOS REPORTES — ÚLTIMOS 14 DÍAS', '']],
      body: data.tendencia.map(d => [d.dia, String(d.cantidad)]),
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: [255,255,255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 1: { halign: 'center', cellWidth: 30 } },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ── Vencidos ─────────────────────────────────────────────────────────────────
  if (data.vencidos && data.vencidos.length > 0) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`⚠  REPORTES VENCIDOS (${data.vencidos.length})`, 14, y);
    y += 4;
    doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Estado', 'Técnico', 'Fecha límite', 'Días vencido']],
      body: data.vencidos.map(v => [
        v.tipo.replace(/_/g, ' '),
        v.estado.replace(/_/g, ' '),
        v.tecnico_nombre || '—',
        new Date(v.fecha_fin).toLocaleDateString('es-AR'),
        `${v.dias_vencido}d`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [127, 29, 29], textColor: [255,255,255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 4: { halign: 'center', textColor: [220, 38, 38], fontStyle: 'bold' } },
    });
  }

  // ── Pie de página ────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
    doc.text(`GeoMuni — Informe generado el ${hoy} | Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
  }

  doc.save(`GeoMuni_Estadisticas_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ─── Colores por tipo ────────────────────────────────────────────────────────
const TIPO_COLOR = {
  bache:           '#ef4444',
  calle_danada:    '#f97316',
  semaforo:        '#eab308',
  luminaria:       '#fbbf24',
  cable_caido:     '#d97706',
  basural:         '#10b981',
  escombros:       '#84cc16',
  arbol_caido:     '#22c55e',
  arbol_peligroso: '#15803d',
  reparacion_calle:'#3b82f6',
  cuneta:          '#06b6d4',
  zona_obra:       '#f97316',
  clausura:        '#64748b',
};

const ESTADO_COLOR = {
  funcional:     '#10b981',
  dañado:        '#ef4444',
  en_reparacion: '#f59e0b',
  en_progreso:   '#3b82f6',
  clausurado:    '#64748b',
  pendiente:     '#f97316',
  finalizado:    '#059669',
};

// ─── Donut SVG ───────────────────────────────────────────────────────────────
function DonutChart({ data, total }) {
  const r = 38;
  const cx = 50;
  const cy = 50;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map(d => {
    const pct = total > 0 ? d.cantidad / total : 0;
    const dash = pct * circ;
    const s = { ...d, dash, offset };
    offset += dash;
    return s;
  });
  return (
    <svg viewBox="0 0 100 100" className="w-40 h-40">
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="18" />
      ) : slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r}
          fill="none"
          stroke={ESTADO_COLOR[s.estado] || '#94a3b8'}
          strokeWidth="18"
          strokeDasharray={`${s.dash} ${circ}`}
          strokeDashoffset={-s.offset}
          transform="rotate(-90 50 50)"
        />
      ))}
      <text x="50" y="46" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#1e293b">{total}</text>
      <text x="50" y="58" textAnchor="middle" fontSize="7" fill="#94a3b8">total</text>
    </svg>
  );
}

// ─── Barra horizontal ────────────────────────────────────────────────────────
function BarChart({ data, max }) {
  return (
    <div className="space-y-2.5">
      {data.map(d => {
        const pct = max > 0 ? (d.cantidad / max) * 100 : 0;
        const label = d.tipo.replace(/_/g, ' ');
        return (
          <div key={d.tipo} className="flex items-center gap-3">
            <span className="w-28 text-[10px] font-black text-slate-500 uppercase truncate text-right shrink-0">{label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: TIPO_COLOR[d.tipo] || '#94a3b8' }}
              >
                {pct > 15 && (
                  <span className="text-white text-[9px] font-black">{d.cantidad}</span>
                )}
              </div>
            </div>
            {pct <= 15 && (
              <span className="text-[10px] font-black text-slate-600 w-6 text-right shrink-0">{d.cantidad}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Mini sparkline ──────────────────────────────────────────────────────────
function Sparkline({ data }) {
  if (!data || data.length === 0) return <p className="text-xs text-slate-400 text-center py-4">Sin datos</p>;
  const max = Math.max(...data.map(d => d.cantidad), 1);
  const w = 280;
  const h = 60;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = h - (d.cantidad / max) * h * 0.9;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const area = `0,${h} ${polyline} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkGrad)" />
      <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * w;
        const y = h - (d.cantidad / max) * h * 0.9;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill="#3b82f6" />
            <text x={x} y={h} textAnchor="middle" fontSize="6.5" fill="#94a3b8" dy="-2">{d.dia}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, sub }) {
  return (
    <div className={`rounded-3xl p-5 border ${color}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-4xl font-black">{value ?? '—'}</p>
      {sub && <p className="text-[10px] font-bold opacity-60 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function EstadisticasPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEstadisticas().then(d => { setData(d); setLoading(false); });
  }, []);

  const maxTipo = data ? Math.max(...data.porTipo.map(d => d.cantidad), 1) : 1;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />

      <div className="flex-1 flex flex-col overflow-auto">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Estadísticas</h1>
            <p className="text-xs text-slate-500 mt-0.5">Resumen operativo de incidencias municipales</p>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={() => downloadEstadisticasPDF(data)}
                className="text-[10px] font-black uppercase text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
              >
                ⬇ Exportar PDF
              </button>
            )}
            <button
              onClick={() => { setLoading(true); getEstadisticas().then(d => { setData(d); setLoading(false); }); }}
              className="text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors"
            >
              Actualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Cargando estadísticas...</p>
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 text-sm">No se pudo cargar la información.</p>
          </div>
        ) : (
          <div className="p-8 space-y-8">

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard label="Total"        value={data.kpis.total}       color="bg-white border-slate-200 text-slate-900"           sub="registros" />
              <KpiCard label="Pendientes"   value={data.kpis.pendientes}  color="bg-orange-50 border-orange-200 text-orange-700"     sub="sin finalizar" />
              <KpiCard label="Vencidos"     value={data.kpis.vencidos}    color="bg-red-50 border-red-200 text-red-700"              sub="fecha límite superada" />
              <KpiCard label="Adjudicados"  value={data.kpis.adjudicados} color="bg-blue-50 border-blue-200 text-blue-700"           sub="con técnico asignado" />
              <KpiCard label="Finalizados"  value={data.kpis.finalizados} color="bg-emerald-50 border-emerald-200 text-emerald-700"  sub="resueltos" />
              <KpiCard label="Últimos 30d"  value={data.kpis.ultimos_30d} color="bg-slate-50 border-slate-200 text-slate-700"        sub="nuevos reportes" />
            </div>

            {/* Gráficos principales */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Barras por tipo */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-5">Reportes por Tipo</h2>
                {data.porTipo.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">Sin datos</p>
                ) : (
                  <BarChart data={data.porTipo} max={maxTipo} />
                )}
              </div>

              {/* Donut por estado */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 flex flex-col items-center">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 self-start">Por Estado</h2>
                <DonutChart data={data.porEstado} total={data.kpis.total} />
                <div className="mt-4 space-y-1.5 w-full">
                  {data.porEstado.map(d => (
                    <div key={d.estado} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ESTADO_COLOR[d.estado] || '#94a3b8' }} />
                        <span className="text-[10px] font-bold text-slate-500 capitalize">{d.estado.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-700">{d.cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tendencia 14 días */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Nuevos Reportes — Últimos 14 Días</h2>
              <Sparkline data={data.tendencia} />
            </div>

            {/* Tabla vencidos */}
            {data.vencidos.length > 0 && (
              <div className="bg-white rounded-3xl border border-red-200 overflow-hidden">
                <div className="px-6 py-4 bg-red-50 border-b border-red-200 flex items-center gap-2">
                  <span className="text-red-500 text-base">⚠️</span>
                  <h2 className="text-sm font-black text-red-700 uppercase tracking-widest">
                    Reportes Vencidos ({data.vencidos.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-5 py-3 text-left font-black text-slate-400 uppercase tracking-widest text-[9px]">Tipo</th>
                        <th className="px-5 py-3 text-left font-black text-slate-400 uppercase tracking-widest text-[9px]">Estado</th>
                        <th className="px-5 py-3 text-left font-black text-slate-400 uppercase tracking-widest text-[9px]">Técnico</th>
                        <th className="px-5 py-3 text-left font-black text-slate-400 uppercase tracking-widest text-[9px]">Fecha Límite</th>
                        <th className="px-5 py-3 text-left font-black text-slate-400 uppercase tracking-widest text-[9px]">Días Vencido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.vencidos.map(v => (
                        <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TIPO_COLOR[v.tipo] || '#94a3b8' }} />
                              <span className="font-bold text-slate-900 capitalize">{v.tipo.replace(/_/g, ' ')}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {v.estado.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-500 font-bold">{v.tecnico_nombre}</td>
                          <td className="px-5 py-3 text-amber-600 font-black">
                            {new Date(v.fecha_fin).toLocaleDateString('es-AR')}
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-red-600 font-black">{v.dias_vencido}d</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
