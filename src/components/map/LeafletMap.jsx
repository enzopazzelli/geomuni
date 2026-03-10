'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import {
  getParcelasGeoJSON, getInfraestructuraGeoJSON, getBarriosGeoJSON,
  updateParcelaEstado, updateGeometry, createParcela, createBarrio, createIncidencia,
  deleteFeature, getPropietarios, updateParcelaPropietario, createObraVial,
  updateParcelaFicha, getHistorialParcela, createPropietario
} from '@/app/actions/geoActions';
import SearchBar from './SearchBar';
import PropietariosModal from './PropietariosModal';
import InfraModal from './InfraModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { OpenLocationCode } from 'open-location-code';

const olc = new OpenLocationCode();
const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

const LAYER_LABELS = {
  barrios:        { label: 'Barrios',      icon: '🏘️' },
  parcelas:       { label: 'Parcelas',     icon: '📐' },
  infraestructura:{ label: 'Incidencias',  icon: '🚧' },
};

const FIELD_LABELS = {
  nro_padron:        'N° Padrón',
  estado_fiscal:     'Estado Fiscal',
  superficie_m2:     'Superficie',
  propietario:       'Titular',
  responsable_nombre:'Responsable',
  cuadrilla:         'Cuadrilla',
  fecha_inicio:      'Inicio de Obra',
  fecha_fin:         'Finalización',
  estado:            'Estado',
  nombre:            'Nombre',
};

const SKIP_FIELDS = new Set(['id', 'tipo', 'propietario_id', 'responsable_id', 'plus_code']);

const COLOR_MODES = [
  { key: 'fiscal',    label: '💰 Fiscal' },
  { key: 'agua',      label: '💧 Agua' },
  { key: 'cloacas',   label: '🚿 Cloacas' },
  { key: 'servicios', label: '⚡ Servicios' },
  { key: 'pavimento', label: '🛣️ Pavimento' },
];

const LEGEND_ITEMS = {
  fiscal: [
    { color: '#3b82f6', label: 'Al día' },
    { color: '#ef4444', label: 'Moroso' },
    { color: '#10b981', label: 'Exento' },
    { color: '#f59e0b', label: 'Fiscal' },
    { color: '#dc2626', label: 'Conflicto / Litigio', dashed: true },
  ],
  agua: [
    { color: '#10b981', label: 'Con Agua Corriente' },
    { color: '#ef4444', label: 'Sin Agua Corriente' },
  ],
  cloacas: [
    { color: '#3b82f6', label: 'Con Cloacas' },
    { color: '#ef4444', label: 'Sin Cloacas' },
  ],
  servicios: [
    { color: '#dc2626', label: '0 servicios' },
    { color: '#f97316', label: '1 servicio' },
    { color: '#eab308', label: '2 servicios' },
    { color: '#22c55e', label: '3-4 servicios' },
  ],
  pavimento: [
    { color: '#a16207', label: 'Tierra' },
    { color: '#92400e', label: 'Ripio' },
    { color: '#6b7280', label: 'Hormigón' },
    { color: '#1f2937', label: 'Asfalto' },
    { color: '#cbd5e1', label: 'Sin datos' },
  ],
};

const formatFieldValue = (key, value) => {
  if (value === null || value === undefined || value === '' || value === 'null') return '—';
  if (key.includes('fecha') && value) {
    const d = new Date(value);
    return isNaN(d) ? String(value) : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  if (key === 'superficie_m2') return `${value} m²`;
  if (key === 'estado_fiscal' || key === 'estado') return String(value).replace(/_/g, ' ').toUpperCase();
  return String(value);
};

export default function LeafletMap() {
  const { data: session } = useSession();
  const userRole = session?.user?.rol || 'consultor';
  
  const mapContainer = useRef(null);
  const map = useRef(null);
  const layersRef = useRef({
    barrios: null,
    parcelas: null,
    infraestructura: null,
    base: null
  });
  
  const parcelasData = useRef(EMPTY_GEOJSON);
  const barriosData = useRef(EMPTY_GEOJSON);
  const infraData = useRef(EMPTY_GEOJSON);
  
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [isEditingGeom, setIsEditingGeom] = useState(false);
  const isEditingGeomRef  = useRef(false);
  const longPressTimer    = useRef(null);
  const activeTouchCount  = useRef(0);
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showMobileControls, setShowMobileControls] = useState(false);
  
  const [layersVisibility, setLayersVisibility] = useState({ barrios: true, parcelas: true, infraestructura: true });
  const [mapStyle, setMapStyle] = useState('streets'); // 'streets' o 'satellite'
  const [propietarios, setPropietarios] = useState([]);
  const [isPropModalOpen, setIsPropModalOpen] = useState(false);
  const [isInfraModalOpen, setIsInfraModalOpen] = useState(false);

  const [sidebarTab, setSidebarTab] = useState('general');
  const [fichaData, setFichaData] = useState({});
  const [isSavingFicha, setIsSavingFicha] = useState(false);
  const [parcelaHistorial, setParcelaHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [propSearch, setPropSearch] = useState('');
  const [propDropdownOpen, setPropDropdownOpen] = useState(false);
  const [showNuevoPropForm, setShowNuevoPropForm] = useState(false);
  const [nuevoPropData, setNuevoPropData] = useState({ nombre: '', apellido: '', dni: '', contacto: '' });
  const [savingNuevoProp, setSavingNuevoProp] = useState(false);
  const [colorMode, setColorMode] = useState('fiscal');
  const colorModeInitialized  = useRef(false);
  const tecnicoLayerInit      = useRef(false);
  const isMobileRef           = useRef(false);
  const userRoleRef           = useRef('consultor');

  const [isMobile, setIsMobile]         = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    isMobileRef.current = mq.matches;
    setIsMobile(mq.matches);
    const handler = e => { isMobileRef.current = e.matches; setIsMobile(e.matches); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => { userRoleRef.current = userRole; }, [userRole]);

  useEffect(() => {
    if (selectedFeature) setShowMobileControls(false);
  }, [selectedFeature]);

  const filteredPropietarios = useMemo(() => {
    const needle = propSearch.toLowerCase();
    if (!needle) return propietarios.slice(0, 8);
    return propietarios.filter(p =>
      `${p.apellido} ${p.nombre} ${p.dni}`.toLowerCase().includes(needle)
    );
  }, [propSearch, propietarios]);

  const getPlusCode = (lat, lng) => {
    try {
      return olc.encode(lat, lng);
    } catch (e) { return ''; }
  };

  const refreshPropietarios = async () => {
    const data = await getPropietarios();
    setPropietarios(data);
  };

  useEffect(() => { refreshPropietarios(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getParcelaStyle = (feature) => {
    const p = feature.properties;

    if (colorMode === 'agua') {
      return {
        fillColor: p.agua_corriente ? '#10b981' : '#ef4444',
        fillOpacity: 0.55,
        color: p.agua_corriente ? '#065f46' : '#991b1b',
        weight: 1.5,
      };
    }

    if (colorMode === 'cloacas') {
      return {
        fillColor: p.cloacas ? '#3b82f6' : '#ef4444',
        fillOpacity: 0.55,
        color: p.cloacas ? '#1e40af' : '#991b1b',
        weight: 1.5,
      };
    }

    if (colorMode === 'servicios') {
      const count = [p.agua_corriente, p.energia_electrica, p.cloacas, p.gas_natural].filter(Boolean).length;
      const fills = ['#dc2626', '#f97316', '#eab308', '#22c55e'];
      return { fillColor: fills[count], fillOpacity: 0.60, color: '#374151', weight: 1 };
    }

    if (colorMode === 'pavimento') {
      const fills = { Tierra: '#a16207', Ripio: '#92400e', Hormigón: '#6b7280', Asfalto: '#1f2937' };
      return { fillColor: fills[p.pavimento] || '#cbd5e1', fillOpacity: 0.60, color: '#374151', weight: 1 };
    }

    // fiscal (default)
    if (p.es_fiscal) {
      const isConflict = p.estado_ocupacion === 'Usurpado' || p.estado_ocupacion === 'En Litigio';
      return {
        fillColor: '#f59e0b', fillOpacity: 0.50,
        color: isConflict ? '#dc2626' : '#b45309',
        weight: isConflict ? 2.5 : 2,
        dashArray: isConflict ? '6, 4' : null,
      };
    }
    const colors = { al_dia: '#3b82f6', moroso: '#ef4444', exento: '#10b981' };
    if (p.estado_fiscal === 'moroso') {
      return { fillColor: '#ef4444', fillOpacity: 0.70, color: '#b91c1c', weight: 2.5 };
    }
    return { fillColor: colors[p.estado_fiscal] || '#94a3b8', fillOpacity: 0.30, color: '#1e40af', weight: 1 };
  };

  const getInfraStyle = (feature) => {
    const tipo = feature.properties.tipo;
    const geoType = feature.geometry.type;
    const p = feature.properties;
    const vencido = p.fecha_fin &&
      !['finalizado', 'funcional'].includes(p.estado) &&
      new Date(p.fecha_fin) < new Date();

    if (geoType === 'Point') {
      const colors = {
        bache:           '#ef4444',
        calle_danada:    '#f97316',
        semaforo:        '#eab308',
        luminaria:       '#fbbf24',
        cable_caido:     '#d97706',
        basural:         '#10b981',
        escombros:       '#84cc16',
        arbol_caido:     '#22c55e',
        arbol_peligroso: '#15803d',
      };
      return {
        radius:      vencido ? 10 : 7,
        fillColor:   colors[tipo] || '#94a3b8',
        color:       vencido ? '#ef4444' : '#ffffff',
        weight:      vencido ? 3 : 2,
        opacity:     1,
        fillOpacity: 1,
      };
    } else if (geoType === 'Polygon') {
      // zona_obra u otros polígonos
      return { fillColor: '#f97316', fillOpacity: 0.25, color: '#ea580c', weight: 3, dashArray: '8, 4' };
    } else {
      // LineString
      const colors = { reparacion_calle: '#facc15', cuneta: '#3b82f6', clausura: '#ef4444' };
      return { color: colors[tipo] || '#facc15', weight: 6, dashArray: tipo !== 'cuneta' ? '5, 5' : null };
    }
  };

  const setupLayers = async () => {
    if (!map.current) return;

    // Remove existing layers if any
    if (layersRef.current.barrios) map.current.removeLayer(layersRef.current.barrios);
    if (layersRef.current.parcelas) map.current.removeLayer(layersRef.current.parcelas);
    if (layersRef.current.infraestructura) map.current.removeLayer(layersRef.current.infraestructura);
    if (layersRef.current.infraNonPoint) map.current.removeLayer(layersRef.current.infraNonPoint);

    // Barrios
    layersRef.current.barrios = L.geoJSON(barriosData.current, {
      style: {
        fillColor: '#10b981',
        fillOpacity: 0.25,
        color: '#065f46',
        weight: 3
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', (e) => {
          if (isEditingGeomRef.current) return;
          L.DomEvent.stopPropagation(e);
          const center = layer.getBounds().getCenter();
          setSelectedFeature({
            type: 'Barrio',
            id: feature.properties.nombre, 
            details: { ...feature.properties, plus_code: getPlusCode(center.lat, center.lng) } 
          });
        });
      }
    });

    // Parcelas
    layersRef.current.parcelas = L.geoJSON(parcelasData.current, {
      style: getParcelaStyle,
      onEachFeature: (feature, layer) => {
        layer.on('click', (e) => {
          if (isEditingGeomRef.current) return;
          L.DomEvent.stopPropagation(e);
          const center = layer.getBounds().getCenter();
          setSelectedFeature({
            type: 'Parcela',
            id: feature.properties.nro_padron, 
            details: { ...feature.properties, plus_code: getPlusCode(center.lat, center.lng) } 
          });
        });
      }
    });

    // Infraestructura — cluster group para puntos, GeoJSON separado para líneas/polígonos
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      disableClusteringAtZoom: 17,
      iconCreateFunction: (cluster) => {
        const n = cluster.getChildCount();
        const size = n < 10 ? 30 : n < 50 ? 36 : 42;
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;background:#1e293b;border:2.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.35);">${n}</div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    const nonPointLayer = L.geoJSON(null, {
      style: getInfraStyle,
      onEachFeature: (feature, layer) => {
        layer.on({
          click: (e) => {
            if (isEditingGeomRef.current) return;
            L.DomEvent.stopPropagation(e);
            const isVial = feature.geometry.type === 'LineString';
            const latlng = layer.getBounds().getCenter();
            setSelectedFeature({
              type: isVial ? 'Reporte Vial' : 'Reporte',
              id: isVial ? feature.properties.tipo.toUpperCase().replace('_', ' ') : feature.properties.tipo.toUpperCase(),
              details: { ...feature.properties, plus_code: getPlusCode(latlng.lat, latlng.lng) }
            });
            if (!isMobileRef.current) setIsInfraModalOpen(true);
          },
          mouseover: (e) => { if (!isEditingGeomRef.current) { const el = e.target.getElement(); if (el) el.style.cursor = 'pointer'; } },
          mouseout:  (e) => { const el = e.target.getElement(); if (el) el.style.cursor = ''; },
        });
      }
    });

    (infraData.current.features || []).forEach(feature => {
      if (feature.geometry.type === 'Point') {
        const s = getInfraStyle(feature);
        const [lng, lat] = feature.geometry.coordinates;
        const d = (s.radius || 7) * 2;
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            html: `<div style="width:${d}px;height:${d}px;background:${s.fillColor};border:${s.weight || 2}px solid ${s.color || '#fff'};border-radius:50%;box-shadow:0 1px 5px rgba(0,0,0,0.4);"></div>`,
            className: '',
            iconSize: [d, d],
            iconAnchor: [d / 2, d / 2],
          }),
        });
        marker.feature = feature;
        marker.on('click', (e) => {
          if (isEditingGeomRef.current) return;
          L.DomEvent.stopPropagation(e);
          setSelectedFeature({
            type: 'Reporte',
            id: feature.properties.tipo.toUpperCase(),
            details: { ...feature.properties, plus_code: getPlusCode(lat, lng) }
          });
          if (!isMobileRef.current) setIsInfraModalOpen(true);
        });
        clusterGroup.addLayer(marker);
      } else {
        nonPointLayer.addData(feature);
      }
    });

    layersRef.current.infraestructura = clusterGroup;
    layersRef.current.infraNonPoint   = nonPointLayer;

    // Add to map if visible (Order matters: Barrios -> Parcelas -> Infra)
    if (layersVisibility.barrios && layersRef.current.barrios) layersRef.current.barrios.addTo(map.current);
    if (layersVisibility.parcelas && layersRef.current.parcelas) layersRef.current.parcelas.addTo(map.current);
    if (layersVisibility.infraestructura) {
      if (layersRef.current.infraestructura) layersRef.current.infraestructura.addTo(map.current);
      if (layersRef.current.infraNonPoint)   layersRef.current.infraNonPoint.addTo(map.current);
    }
  };

  const toggleStyle = (style) => {
    if (mapStyle === style || !map.current) return;
    setMapStyle(style);
    
    if (layersRef.current.base) map.current.removeLayer(layersRef.current.base);
    
    if (style === 'streets') {
      layersRef.current.base = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 22,
        maxNativeZoom: 18
      }).addTo(map.current);
    } else {
      // Google Hybrid: Satélite + Etiquetas
      layersRef.current.base = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 22,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google'
      }).addTo(map.current);
    }
  };

  const refreshData = async () => {
    const [p, b, i] = await Promise.all([getParcelasGeoJSON(), getBarriosGeoJSON(), getInfraestructuraGeoJSON()]);
    console.log(`GeoMuni: ${p.features?.length ?? 0} parcelas, ${b.features?.length ?? 0} barrios, ${i.features?.length ?? 0} incidencias`);
    parcelasData.current = p; barriosData.current = b; infraData.current = i;
    setupLayers();
  };

  const handleUpdateEstado = async (id, nuevoEstado) => {
    setIsSaving(true);
    const ok = await updateParcelaEstado(id, nuevoEstado);
    if (ok) {
      await refreshData();
      setSelectedFeature(prev => ({ ...prev, details: { ...prev.details, estado_fiscal: nuevoEstado } }));
    }
    setIsSaving(false);
  };

  const handleUpdatePropietario = async (parcelaId, propietarioId) => {
    setIsSaving(true);
    const ok = await updateParcelaPropietario(parcelaId, propietarioId);
    if (ok) {
      await refreshData();
      const prop = propietarios.find(p => p.id === propietarioId);
      setSelectedFeature(prev => ({
        ...prev,
        details: {
          ...prev.details,
          propietario: prop ? `${prop.nombre} ${prop.apellido}` : 'Sin Propietario',
          propietario_id: propietarioId || null,
        }
      }));
    }
    setIsSaving(false);
  };

  const handleCrearYAsignarPropietario = async () => {
    const { nombre, apellido, dni } = nuevoPropData;
    if (!nombre.trim() || !apellido.trim() || !dni.trim()) return;
    setSavingNuevoProp(true);
    const res = await createPropietario(nuevoPropData);
    if (res?.success && res.id) {
      await refreshPropietarios();
      await handleUpdatePropietario(selectedFeature.details.id, res.id);
      setShowNuevoPropForm(false);
      setNuevoPropData({ nombre: '', apellido: '', dni: '', contacto: '' });
    }
    setSavingNuevoProp(false);
  };

  const handleDelete = async () => {
    if (!selectedFeature) return;
    if (!confirm(`¿Estás seguro de eliminar este/a ${selectedFeature.type}?`)) return;
    
    setIsSaving(true);
    const ok = await deleteFeature(selectedFeature.details.id, selectedFeature.type);
    if (ok) {
      await refreshData();
      setSelectedFeature(null);
    } else {
      alert("Error al eliminar");
    }
    setIsSaving(false);
  };

  const handleDownloadPDF = () => {
    if (!selectedFeature || selectedFeature.type !== 'Parcela') return;
    const { details } = selectedFeature;
    const d = details;
    const doc = new jsPDF();

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("CÉDULA CATASTRAL MUNICIPAL", 105, 18, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("MUNICIPALIDAD DE AÑATUYA — SISTEMA GEOMUNI", 105, 27, { align: "center" });
    doc.text(`Emitida: ${new Date().toLocaleDateString('es-AR')}   ID: ${d.id}`, 105, 34, { align: "center" });

    const bool = (v) => v ? 'Sí' : 'No';
    const val = (v) => (v === null || v === undefined || v === '' || v === 'null') ? '—' : String(v);

    // Sección 1 — Identificación
    autoTable(doc, {
      startY: 50,
      head: [["IDENTIFICACIÓN Y DATOS FISCALES", ""]],
      body: [
        ["N° de Padrón", val(d.nro_padron)],
        ["Titular de Dominio", val(d.propietario) === '—' ? 'Sin propietario registrado' : val(d.propietario)],
        ["Superficie Total del Lote", `${val(d.superficie_m2)} m²`],
        ["Estado Fiscal", val(d.estado_fiscal).toUpperCase().replace(/_/g, ' ')],
        ["Suelo Fiscal Municipal", bool(d.es_fiscal)],
        ["Estado de Ocupación", val(d.estado_ocupacion)],
        ["Destino Previsto", val(d.destino_previsto)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    // Sección 2 — Servicios
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [["MÓDULO A — SERVICIOS E INFRAESTRUCTURA", ""]],
      body: [
        ["Agua Corriente", bool(d.agua_corriente)],
        ["Energía Eléctrica", bool(d.energia_electrica)],
        ["Cloacas", bool(d.cloacas)],
        ["Gas Natural", bool(d.gas_natural)],
        ["Alumbrado Público", bool(d.alumbrado_publico)],
        ["Tipo de Pavimento", val(d.pavimento)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    // Sección 3 — Edificación
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [["MÓDULO B — EDIFICACIÓN Y MEJORAS", ""]],
      body: [
        ["Superficie Cubierta", d.superficie_cubierta ? `${d.superficie_cubierta} m²` : '—'],
        ["Cantidad de Plantas", val(d.cantidad_plantas)],
        ["Antigüedad (años)", val(d.antiguedad)],
        ["Categoría Edificatoria", val(d.categoria_edificatoria)],
        ["Estado de Conservación", val(d.estado_conservacion)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    // Sección 4 — Legal
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [["MÓDULO C — DATOS LEGALES Y CATASTRALES", ""]],
      body: [
        ["N° de Plano", val(d.numero_plano)],
        ["Expediente Municipal", val(d.expediente_municipal)],
        ["Zonificación", val(d.zonificacion)],
        ["Restricciones", val(d.restricciones)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [161, 98, 7], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    const finalY = doc.lastAutoTable.finalY;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Documento generado digitalmente. GeoMuni v2.0 — Plataforma de Infraestructura de Datos Espaciales Municipal.", 105, finalY + 14, { align: 'center' });

    doc.save(`Cedula_${details.nro_padron}.pdf`);
  };

  useEffect(() => {
    if (sidebarTab === 'historial' && selectedFeature?.type === 'Parcela') {
      setLoadingHistorial(true);
      getHistorialParcela(selectedFeature.details.id).then(rows => {
        setParcelaHistorial(rows);
        setLoadingHistorial(false);
      });
    }
  }, [sidebarTab, selectedFeature?.details?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedFeature?.type === 'Parcela' && selectedFeature.details) {
      setSidebarTab('general');
      setPropSearch('');
      setPropDropdownOpen(false);
      const d = selectedFeature.details;
      setFichaData({
        agua_corriente:        d.agua_corriente        ?? false,
        energia_electrica:     d.energia_electrica     ?? false,
        cloacas:               d.cloacas               ?? false,
        gas_natural:           d.gas_natural           ?? false,
        pavimento:             d.pavimento             ?? '',
        alumbrado_publico:     d.alumbrado_publico     ?? false,
        superficie_cubierta:   d.superficie_cubierta   ?? '',
        cantidad_plantas:      d.cantidad_plantas      ?? '',
        antiguedad:            d.antiguedad            ?? '',
        categoria_edificatoria:d.categoria_edificatoria?? '',
        estado_conservacion:   d.estado_conservacion   ?? '',
        numero_plano:          d.numero_plano          ?? '',
        expediente_municipal:  d.expediente_municipal  ?? '',
        zonificacion:          d.zonificacion          ?? '',
        restricciones:         d.restricciones         ?? '',
        es_fiscal:             d.es_fiscal             ?? false,
        estado_ocupacion:      d.estado_ocupacion      ?? '',
        destino_previsto:      d.destino_previsto      ?? '',
      });
    }
  }, [selectedFeature?.details?.id]);

  const handleSaveFicha = async () => {
    if (!selectedFeature) return;
    setIsSavingFicha(true);
    const result = await updateParcelaFicha(selectedFeature.details.id, fichaData);
    if (!result?.error) await refreshData();
    setIsSavingFicha(false);
  };

  useEffect(() => {
    if (!colorModeInitialized.current) { colorModeInitialized.current = true; return; }
    if (map.current) setupLayers();
  }, [colorMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ocultar parcelas por defecto para el rol técnico (solo la primera vez que carga el rol)
  useEffect(() => {
    if (userRole === 'tecnico' && !tecnicoLayerInit.current) {
      tecnicoLayerInit.current = true;
      setLayersVisibility(prev => ({ ...prev, parcelas: false }));
    }
  }, [userRole]);

  const handleCreateIncidencia = async (tipo) => {
    if (!contextMenu) return;
    const n = await createIncidencia({ tipo, lat: contextMenu.lat, lng: contextMenu.lng });
    if (n) {
      await refreshData();
    }
    setContextMenu(null);
  };

  const handleStartDrawObra = (tipo) => {
    if (!['editor', 'administrador'].includes(userRole) || !map.current) return;
    isEditingGeomRef.current = true; setIsEditingGeom(true);
    map.current.drawingType = 'obra_' + tipo;
    map.current.pm.enableDraw('Line', {
      snappable: true,
      cursorMarker: true,
      finishOn: 'dblclick',
      templineStyle: { color: '#fbb03b', dashArray: '5, 5' },
      hintlineStyle: { color: '#fbb03b', dashArray: '5, 5', opacity: 0.5 }
    });
  };

  const handleStartDrawZonaObra = () => {
    if (!['editor', 'administrador'].includes(userRole) || !map.current) return;
    isEditingGeomRef.current = true; setIsEditingGeom(true);
    map.current.drawingType = 'obra_zona_obra';
    map.current.pm.enableDraw('Polygon', {
      snappable: true,
      cursorMarker: true,
      finishOn: null,
      templineStyle: { color: '#f97316' },
      hintlineStyle: { color: '#f97316', opacity: 0.5 }
    });
  };

  const handleStartDraw = (mode) => {
    if (!['editor', 'administrador'].includes(userRole) || !map.current) return;
    isEditingGeomRef.current = true; setIsEditingGeom(true);
    map.current.drawingType = mode;
    map.current.pm.enableDraw('Polygon', {
      snappable: true,
      cursorMarker: true,
      finishOn: null,
      templineStyle: { color: '#fbb03b' },
      hintlineStyle: { color: '#fbb03b', opacity: 0.5 }
    });
  };

  const handleStartModify = () => {
    if (!selectedFeature || !['editor', 'administrador'].includes(userRole) || !map.current) return;
    
    const layer = findLayerByFeatureId(selectedFeature.details.id);
    if (layer) {
      isEditingGeomRef.current = true; setIsEditingGeom(true);
      map.current.drawingType = 'modify';
      layer.pm.enable({
        allowSelfIntersection: false,
        draggable: false,
      });
      // Hide other layers to focus on edit
      if (layersRef.current.parcelas) layersRef.current.parcelas.setStyle({ fillOpacity: 0 });
      if (layersRef.current.barrios) layersRef.current.barrios.setStyle({ fillOpacity: 0 });
    }
  };

  const findLayerByFeatureId = (id) => {
    let found = null;
    [layersRef.current.parcelas, layersRef.current.barrios, layersRef.current.infraestructura].forEach(group => {
      if (group) {
        group.eachLayer(l => {
          if (l.feature?.properties?.id === id) found = l;
        });
      }
    });
    return found;
  };

  const handleFinishAction = async () => {
    // This will be called from the UI button, but Geoman events handle the actual data
    // In Geoman, we listen for 'pm:create' or we get the layer from the currently enabled edit
    setIsSaving(true);
    const mode = map.current.drawingType;
    
    try {
      if (mode === 'modify') {
        const layer = findLayerByFeatureId(selectedFeature.details.id);
        if (layer) {
          const geojson = layer.toGeoJSON();
          await updateGeometry(selectedFeature.details.id, geojson.geometry, selectedFeature.type);
          layer.pm.disable();
        }
      } else {
        // For new drawings, we wait for pm:create which is handled in the useEffect
      }
      await refreshData();
    } catch (e) { console.error(e); }

    handleCancel();
    setIsSaving(false);
  };

  const handleCancel = () => {
    isEditingGeomRef.current = false; setIsEditingGeom(false);
    if (map.current) {
      map.current.pm.disableDraw();
      // Disable edit on all layers
      [layersRef.current.parcelas, layersRef.current.barrios, layersRef.current.infraestructura].forEach(group => {
        if (group) group.eachLayer(l => l.pm.disable());
      });
    }
    setupLayers(); // Reset styles and visibility
  };

  const toggleLayer = (key) => {
    const val = !layersVisibility[key];
    setLayersVisibility(p => ({ ...p, [key]: val }));
    if (layersRef.current[key]) {
      if (val) {
        layersRef.current[key].addTo(map.current);
        if (key === 'infraestructura' && layersRef.current.infraNonPoint)
          layersRef.current.infraNonPoint.addTo(map.current);
      } else {
        map.current.removeLayer(layersRef.current[key]);
        if (key === 'infraestructura' && layersRef.current.infraNonPoint)
          map.current.removeLayer(layersRef.current.infraNonPoint);
      }
    }
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    // Fix for Leaflet marker icons
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    const mapInstance = L.map(mapContainer.current, {
      center: [-28.4606, -62.8347],
      zoom: 15,
      zoomControl: false,
      maxZoom: 22
    });

    map.current = mapInstance;

    L.control.zoom({ position: 'topright' }).addTo(mapInstance);

    // Initial base layer
    layersRef.current.base = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 22,
      maxNativeZoom: 18
    }).addTo(mapInstance);

    // Geoman setup
    mapInstance.pm.setLang('es');
    mapInstance.pm.setGlobalOptions({ 
      snappable: true,
      layerGroup: layersRef.current.parcelas // Default group for snapping
    });

    mapInstance.on('pm:create', async (e) => {
      const { layer } = e;
      const mode = mapInstance.drawingType;
      const geometry = layer.toGeoJSON().geometry;
      
      setIsSaving(true);
      try {
        let result;
        if (mode === 'parcela') {
          const p = prompt("Padrón:");
          if (p) result = await createParcela(p, geometry);
        } else if (mode === 'barrio') {
          const n = prompt("Nombre Barrio:");
          if (n) result = await createBarrio(n, geometry);
        } else if (mode?.startsWith('obra_')) {
          const tipo = mode.replace('obra_', '');
          result = await createObraVial(tipo, geometry);
        }
        
        if (result?.error) alert("Error: " + result.error);
        else await refreshData();
      } catch (err) { console.error(err); }
      
      mapInstance.removeLayer(layer);
      handleCancel();
      setIsSaving(false);
    });

    mapInstance.on('contextmenu', (e) => {
      if (!['editor', 'administrador'].includes(userRoleRef.current) || isEditingGeomRef.current) return;
      setContextMenu({
        x: e.originalEvent.clientX, 
        y: e.originalEvent.clientY, 
        lng: e.latlng.lng, 
        lat: e.latlng.lat 
      });
    });

    mapInstance.on('click', () => setContextMenu(null));

    // Load initial data
    refreshData().then(() => {
      // Handle flyTo from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const focusId = urlParams.get('id');
      const focusType = urlParams.get('type');
      const lat = urlParams.get('lat');
      const lng = urlParams.get('lng');

      if (focusId && lat && lng) {
        mapInstance.whenReady(() => {
          setTimeout(() => {
            if (map.current) {
              map.current.invalidateSize();
              map.current.flyTo([parseFloat(lat), parseFloat(lng)], 19, { animate: true, duration: 2 });
              
              const dataSource = focusType === 'Parcela' ? parcelasData.current : infraData.current;
              const feat = dataSource.features.find(f => f.properties.id === focusId);
              if (feat) {
                setSelectedFeature({ type: focusType, id: focusId, details: feat.properties });
                if (focusType !== 'Parcela' && !isMobileRef.current) setIsInfraModalOpen(true);
              }
            }
          }, 500);
        });
      }
    });

    // Long press en mobile = equivalente a click derecho
    const container = mapInstance.getContainer();
    const cancelLongPress = () => { clearTimeout(longPressTimer.current); longPressTimer.current = null; };
    const onTouchStart = (e) => {
      activeTouchCount.current = e.touches.length;
      // Cualquier gesto multi-touch (pellizco/zoom) cancela el long press
      if (e.touches.length > 1) { cancelLongPress(); return; }
      if (!['editor', 'administrador'].includes(userRoleRef.current) || isEditingGeomRef.current) return;
      const touch = e.touches[0];
      longPressTimer.current = setTimeout(() => {
        // Verificar al momento de disparar que sigue siendo toque simple
        if (activeTouchCount.current !== 1) return;
        const pt = mapInstance.mouseEventToContainerPoint({ clientX: touch.clientX, clientY: touch.clientY });
        const latlng = mapInstance.containerPointToLatLng(pt);
        setContextMenu({ x: touch.clientX, y: touch.clientY, lat: latlng.lat, lng: latlng.lng });
      }, 600);
    };
    const onTouchMove  = (e) => { activeTouchCount.current = e.touches.length; cancelLongPress(); };
    const onTouchEnd   = (e) => { activeTouchCount.current = e.touches.length; cancelLongPress(); };
    // capture:true — se ejecuta antes que los handlers de Leaflet (evita stopPropagation)
    container.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    container.addEventListener('touchmove',  onTouchMove,  { passive: true, capture: true });
    container.addEventListener('touchend',   onTouchEnd,   { passive: true, capture: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart, { capture: true });
      container.removeEventListener('touchmove',  onTouchMove,  { capture: true });
      container.removeEventListener('touchend',   onTouchEnd,   { capture: true });
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <div className="relative flex w-full h-[calc(100vh-64px)] overflow-hidden font-sans bg-slate-100 text-slate-900">
      <SearchBar onSearchResult={(r) => { 
        map.current.flyTo([r.lat, r.lng], 18); 
        setSelectedFeature({ 
          type: 'Parcela', 
          id: r.nro_padron, 
          details: { 
            id: r.id, 
            nro_padron: r.nro_padron, 
            estado_fiscal: r.estado_fiscal,
            superficie_m2: r.superficie_m2,
            propietario: r.propietario
          } 
        }); 
      }} />
      <div ref={mapContainer} className="flex-1 h-full z-0" />

      {/* FILTROS — oculto en mobile */}
      <div className="hidden md:flex absolute right-4 top-20 z-10 flex-col gap-2">
        <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-200 w-48">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest text-center">Visualización</p>
          <div className="space-y-1">
            {Object.entries(layersVisibility).map(([key, val]) => (
              <label key={key} className="flex items-center justify-between cursor-pointer px-2 py-1.5 hover:bg-slate-50 rounded-xl transition-colors">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <span>{LAYER_LABELS[key]?.icon}</span>
                  {LAYER_LABELS[key]?.label ?? key}
                </span>
                <input type="checkbox" checked={val} onChange={() => toggleLayer(key)} className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
              </label>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Modo de Color</p>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {COLOR_MODES.map(m => (
                <button key={m.key} onClick={() => setColorMode(m.key)}
                  className={`py-1.5 rounded-xl text-[8px] font-black uppercase transition-all ${colorMode === m.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">Leyenda</p>
            <div className="space-y-1.5">
              {(LEGEND_ITEMS[colorMode] || []).map(({ color, label, dashed }) => (
                <div key={label} className="flex items-center gap-2 px-1">
                  <span className={`w-3 h-3 rounded-sm shrink-0 border ${dashed ? 'border-dashed' : ''}`}
                    style={{ backgroundColor: color + '80', borderColor: color }} />
                  <span className="text-[10px] font-bold text-slate-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLES MOBILE — visible solo en mobile */}
      {isMobile && !isEditingGeom && (
        <div className="absolute top-4 left-16 z-10">
          {/* Botón FAB */}
          <button
            onClick={() => setShowMobileControls(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl shadow-lg border text-xs font-black transition-all ${showMobileControls ? 'bg-slate-900 text-white border-slate-700' : 'bg-white/95 text-slate-700 border-slate-200 backdrop-blur'}`}
          >
            🎛️ <span className="uppercase tracking-wide">Capas</span>
          </button>

          {/* Panel desplegable */}
          {showMobileControls && (
            <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-52">
              {/* Estilo de mapa */}
              <div className="px-4 pt-3 pb-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Vista</p>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => toggleStyle('streets')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${mapStyle === 'streets' ? 'bg-slate-900 text-white shadow' : 'text-slate-400'}`}>
                    🗺️ Calles
                  </button>
                  <button onClick={() => toggleStyle('satellite')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${mapStyle === 'satellite' ? 'bg-slate-900 text-white shadow' : 'text-slate-400'}`}>
                    🛰️ Satélite
                  </button>
                </div>
              </div>

              {/* Capas */}
              <div className="px-4 pb-2 border-t border-slate-100 pt-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Capas</p>
                {Object.entries(layersVisibility).map(([key, val]) => (
                  <label key={key} className="flex items-center justify-between cursor-pointer py-2 border-b border-slate-50 last:border-0">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <span>{LAYER_LABELS[key]?.icon}</span>
                      {LAYER_LABELS[key]?.label ?? key}
                    </span>
                    <input type="checkbox" checked={val} onChange={() => toggleLayer(key)} className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                  </label>
                ))}
              </div>

              {/* Modo de color */}
              <div className="px-4 pb-3 border-t border-slate-100 pt-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Color parcelas</p>
                <div className="grid grid-cols-2 gap-1">
                  {COLOR_MODES.map(m => (
                    <button key={m.key} onClick={() => setColorMode(m.key)}
                      className={`py-1.5 rounded-xl text-[8px] font-black uppercase transition-all ${colorMode === m.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PERFIL Y ESTILO DE MAPA — oculto en mobile */}
      <div className="hidden md:flex absolute left-4 top-20 flex-col gap-3 z-10 w-56">
        <div className="bg-white/90 backdrop-blur shadow-2xl p-4 rounded-[24px] border border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-500/20">
              {session?.user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-black text-slate-800 truncate">{session?.user?.name || 'Usuario'}</p>
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">{userRole}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => signOut()} className="flex-1 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 py-2 rounded-xl text-[9px] font-black uppercase transition-all">Salir</button>
            <Link href="/dashboard" className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-[9px] font-black uppercase text-center shadow-lg shadow-blue-500/20">📊 Panel</Link>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur shadow-2xl p-1 rounded-2xl border border-slate-200 flex gap-1">
          <button 
            onClick={() => toggleStyle('streets')} 
            className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${mapStyle === 'streets' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            🗺️ Calles
          </button>
          <button
            onClick={() => toggleStyle('satellite')}
            className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${mapStyle === 'satellite' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            🛰️ Satélite
          </button>
        </div>
      </div>

      {/* BOTONES ACCIÓN */}
      {(userRole === 'editor' || userRole === 'administrador') && !isEditingGeom && (
        <div className="absolute left-4 bottom-20 flex flex-col gap-3 z-10">
          <button onClick={() => handleStartDraw('parcela')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl hover:bg-blue-700 font-bold text-xs uppercase transition-all active:scale-95">+ Parcela</button>
          <button onClick={() => handleStartDraw('barrio')} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl hover:bg-emerald-700 font-bold text-xs uppercase transition-all active:scale-95">+ Barrio</button>
        </div>
      )}

      <PropietariosModal 
        isOpen={isPropModalOpen} 
        onClose={() => setIsPropModalOpen(false)} 
        onRefresh={refreshPropietarios}
      />

      <InfraModal
        isOpen={isInfraModalOpen}
        onClose={() => setIsInfraModalOpen(false)}
        feature={selectedFeature}
        onRefresh={refreshData}
        userRole={userRole}
      />

      {/* PANEL DIBUJO */}
      {isEditingGeom && (
        <div className="absolute inset-x-0 top-20 flex justify-center z-20 px-4">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center gap-6 border border-slate-700 max-w-2xl">
            <div className="flex flex-col">
              <span className="text-xs font-black text-amber-400 uppercase tracking-widest animate-pulse">
                ✏️ {map.current?.drawingType?.startsWith('obra_') ? 'Dibujando Tramo (Línea)' : 'Editando Zona (Polígono)'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {map.current?.drawingType?.startsWith('obra_') 
                  ? 'Click para añadir tramos. Doble click para finalizar la línea.'
                  : 'Click para añadir vértices. Doble click para cerrar el área.'}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={handleFinishAction} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 shadow-lg shadow-emerald-500/20">Guardar Cambios</button>
              <button onClick={handleCancel} className="bg-slate-700 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95">Descartar</button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR / BOTTOM SHEET */}
      {selectedFeature && !(isMobile && isInfraModalOpen) && !(isMobile && isEditingGeom) && (
        <aside className={
          isMobile
            ? `fixed bottom-0 left-0 right-0 bg-white shadow-2xl border-t border-slate-200 z-[200] flex flex-col transition-all duration-300 rounded-t-3xl overflow-hidden ${sheetExpanded ? 'h-[82vh]' : 'h-52'}`
            : 'absolute right-4 top-4 bottom-24 w-80 bg-white shadow-2xl rounded-3xl border border-slate-200 overflow-hidden z-10 flex flex-col'
        }>
          {/* Handle para expandir/colapsar en mobile */}
          {isMobile && (
            <button
              onClick={() => setSheetExpanded(v => !v)}
              className="w-full flex flex-col items-center pt-2 pb-1 shrink-0"
              aria-label={sheetExpanded ? 'Colapsar' : 'Expandir'}>
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </button>
          )}
          <div className={`${isMobile ? 'px-4 py-3' : 'p-6'} text-white shrink-0 ${
            selectedFeature.type === 'Parcela' ? 'bg-blue-600' :
            selectedFeature.type === 'Barrio' ? 'bg-emerald-600' :
            'bg-slate-800'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[9px] font-black opacity-70 uppercase tracking-widest px-2 py-1 bg-black/20 rounded-full">{selectedFeature.type}</span>
              <button onClick={() => { setSelectedFeature(null); setSheetExpanded(false); }} className="font-bold">✕</button>
            </div>
            <h2 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-black truncate`}>{selectedFeature.id}</h2>
            {selectedFeature.details.plus_code && (
              <p className="text-[10px] font-bold opacity-80 mt-1 flex items-center gap-1">
                📍 {selectedFeature.details.plus_code}
              </p>
            )}
          </div>

          {selectedFeature.type === 'Parcela' ? (<>
            {/* TABS NAV */}
            <div className="flex border-b border-slate-100 shrink-0">
              {[
                { key: 'general',     label: 'General',     icon: '📋' },
                { key: 'servicios',   label: 'Servicios',   icon: '🔌' },
                { key: 'edificacion', label: 'Edificación', icon: '🏗️' },
                { key: 'legal',       label: 'Legal',       icon: '📜' },
                ...(['consultor','administrador'].includes(userRole) ? [{ key: 'historial', label: 'Historial', icon: '🕒' }] : []),
              ].map(t => (
                <button key={t.key} onClick={() => setSidebarTab(t.key)}
                  className={`flex-1 flex flex-col items-center py-2 text-[8px] font-black uppercase tracking-tight transition-colors border-b-2 ${sidebarTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  <span className="text-sm leading-none mb-0.5">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">

              {sidebarTab === 'general' && (<>
                {/* ── TITULAR ─────────────────────────────────────────── */}
                {(() => {
                  const currentPropId = selectedFeature.details.propietario_id;
                  const currentProp   = propietarios.find(p => p.id === currentPropId);
                  const canEdit       = ['editor','administrador'].includes(userRole);
                  const filtered      = filteredPropietarios;

                  return (
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-wider px-1">👤 Titular</p>

                      {/* Card propietario actual */}
                      {currentProp ? (
                        <div className="flex items-start gap-2 p-3 rounded-2xl bg-blue-50 border border-blue-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{currentProp.apellido}, {currentProp.nombre}</p>
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">DNI {currentProp.dni}</p>
                            {currentProp.contacto && (
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{currentProp.contacto}</p>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => handleUpdatePropietario(selectedFeature.details.id, '')}
                              title="Desvincular titular"
                              className="text-slate-300 hover:text-red-400 text-base leading-none mt-0.5 shrink-0 transition-colors"
                            >✕</button>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center">
                          <p className="text-[10px] text-slate-400 font-bold">Sin titular asignado</p>
                        </div>
                      )}

                      {/* Buscador + crear nuevo (solo editors/admins) */}
                      {canEdit && (<>
                        <div className="relative">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs">🔍</span>
                            <input
                              type="text"
                              placeholder="Buscar por apellido o DNI..."
                              value={propSearch}
                              onChange={e => { setPropSearch(e.target.value); setPropDropdownOpen(true); }}
                              onFocus={() => setPropDropdownOpen(true)}
                              onBlur={() => setTimeout(() => setPropDropdownOpen(false), 150)}
                              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold outline-none focus:border-blue-300 placeholder:font-normal placeholder:text-slate-300"
                            />
                            {propSearch && (
                              <button
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { setPropSearch(''); setPropDropdownOpen(false); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 text-xs"
                              >✕</button>
                            )}
                          </div>
                          {propDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-44 overflow-y-auto">
                              {filtered.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-3 font-bold">Sin resultados</p>
                              ) : filtered.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseDown={e => e.preventDefault()}
                                  onClick={() => {
                                    handleUpdatePropietario(selectedFeature.details.id, p.id);
                                    setPropSearch('');
                                    setPropDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0 ${p.id === currentPropId ? 'bg-blue-50' : ''}`}
                                >
                                  <span className={`text-xs font-black truncate ${p.id === currentPropId ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {p.apellido}, {p.nombre}
                                    {p.id === currentPropId && <span className="ml-1 text-blue-400">✓</span>}
                                  </span>
                                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">DNI {p.dni}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Crear propietario nuevo */}
                        <button
                          type="button"
                          onClick={() => { setShowNuevoPropForm(v => !v); setNuevoPropData({ nombre: '', apellido: '', dni: '', contacto: '' }); }}
                          className="mt-2 w-full text-[10px] font-black uppercase text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl py-1.5 transition-colors text-center"
                        >
                          {showNuevoPropForm ? '✕ Cancelar' : '+ Crear propietario nuevo'}
                        </button>

                        {showNuevoPropForm && (
                          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-2">
                            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Nuevo propietario</p>
                            {[
                              { field: 'apellido', placeholder: 'Apellido *' },
                              { field: 'nombre',   placeholder: 'Nombre *' },
                              { field: 'dni',      placeholder: 'DNI *' },
                              { field: 'contacto', placeholder: 'Contacto (tel/email)' },
                            ].map(({ field, placeholder }) => (
                              <input
                                key={field}
                                type="text"
                                placeholder={placeholder}
                                value={nuevoPropData[field]}
                                onChange={e => setNuevoPropData(prev => ({ ...prev, [field]: e.target.value }))}
                                className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-400 placeholder:font-normal placeholder:text-slate-300"
                              />
                            ))}
                            <button
                              type="button"
                              onClick={handleCrearYAsignarPropietario}
                              disabled={savingNuevoProp || !nuevoPropData.nombre.trim() || !nuevoPropData.apellido.trim() || !nuevoPropData.dni.trim()}
                              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-2 rounded-xl text-[10px] font-black uppercase transition-all"
                            >
                              {savingNuevoProp ? 'Guardando...' : 'Crear y asignar'}
                            </button>
                          </div>
                        )}
                      </>)}
                    </div>
                  );
                })()}
                {/* ────────────────────────────────────────────────────── */}
                {[
                  { key: 'nro_padron',    label: 'N° Padrón' },
                  { key: 'estado_fiscal', label: 'Estado Fiscal' },
                  { key: 'superficie_m2', label: 'Superficie' },
                ].map(({ key, label }) => selectedFeature.details[key] != null && (
                  <div key={key} className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm font-bold text-slate-700">{formatFieldValue(key, selectedFeature.details[key])}</p>
                  </div>
                ))}

                {selectedFeature.details.es_fiscal && (
                  <div className={`p-3 rounded-2xl border flex items-center gap-3 ${
                    selectedFeature.details.estado_ocupacion === 'Usurpado' || selectedFeature.details.estado_ocupacion === 'En Litigio'
                      ? 'border-red-200 bg-red-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}>
                    <span className="text-2xl">🏛️</span>
                    <div>
                      <p className="text-[9px] font-black text-amber-700 uppercase tracking-wider">Tierra Fiscal Municipal</p>
                      {selectedFeature.details.estado_ocupacion && (
                        <p className={`text-xs font-black mt-0.5 ${
                          selectedFeature.details.estado_ocupacion === 'Usurpado' || selectedFeature.details.estado_ocupacion === 'En Litigio'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}>{selectedFeature.details.estado_ocupacion}</p>
                      )}
                      {selectedFeature.details.destino_previsto && (
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">→ {selectedFeature.details.destino_previsto}</p>
                      )}
                    </div>
                  </div>
                )}
              </>)}

              {sidebarTab === 'servicios' && (<>
                {[
                  { key: 'agua_corriente',    icon: '💧', label: 'Agua Corriente' },
                  { key: 'energia_electrica', icon: '⚡', label: 'Energía Eléctrica' },
                  { key: 'cloacas',           icon: '🚿', label: 'Cloacas' },
                  { key: 'gas_natural',       icon: '🔥', label: 'Gas Natural' },
                  { key: 'alumbrado_publico', icon: '💡', label: 'Alumbrado Público' },
                ].map(({ key, icon, label }) => (
                  <label key={key} className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-colors ${fichaData[key] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-2"><span>{icon}</span>{label}</span>
                    <input type="checkbox"
                      checked={fichaData[key] || false}
                      onChange={e => setFichaData(p => ({ ...p, [key]: e.target.checked }))}
                      disabled={!['editor','administrador'].includes(userRole)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </label>
                ))}
                <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">🛣️ Tipo de Pavimento</label>
                  <select
                    value={fichaData.pavimento || ''}
                    onChange={e => setFichaData(p => ({ ...p, pavimento: e.target.value }))}
                    disabled={!['editor','administrador'].includes(userRole)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none disabled:opacity-60"
                  >
                    <option value="">Sin datos</option>
                    {['Tierra', 'Ripio', 'Hormigón', 'Asfalto'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </>)}

              {sidebarTab === 'edificacion' && (<>
                {[
                  { key: 'superficie_cubierta', label: '📐 Sup. Cubierta (m²)', ph: 'ej. 120.50' },
                  { key: 'cantidad_plantas',    label: '🏢 Plantas',            ph: 'ej. 2' },
                  { key: 'antiguedad',          label: '📅 Año de Construcción',ph: 'ej. 1995' },
                ].map(({ key, label, ph }) => (
                  <div key={key} className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">{label}</label>
                    <input type="number"
                      value={fichaData[key] || ''}
                      onChange={e => setFichaData(p => ({ ...p, [key]: e.target.value }))}
                      disabled={!['editor','administrador'].includes(userRole)}
                      placeholder={ph}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none disabled:opacity-60"
                    />
                  </div>
                ))}
                <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">🏗️ Categoría Edificatoria</label>
                  <select value={fichaData.categoria_edificatoria || ''} onChange={e => setFichaData(p => ({ ...p, categoria_edificatoria: e.target.value }))} disabled={!['editor','administrador'].includes(userRole)} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none disabled:opacity-60">
                    <option value="">Sin clasificar</option>
                    {['Residencial Lujo', 'Media', 'Económica', 'Industrial'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">🔍 Estado de Conservación</label>
                  <select value={fichaData.estado_conservacion || ''} onChange={e => setFichaData(p => ({ ...p, estado_conservacion: e.target.value }))} disabled={!['editor','administrador'].includes(userRole)} className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none disabled:opacity-60">
                    <option value="">Sin evaluar</option>
                    {['Excelente', 'Bueno', 'Regular', 'Malo'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </>)}

              {sidebarTab === 'legal' && (<>
                {[
                  { key: 'numero_plano',        label: '📄 Número de Plano',      ph: 'ej. MP-2024-001' },
                  { key: 'expediente_municipal', label: '📁 Expediente Municipal', ph: 'ej. EXP-2024-0123' },
                  { key: 'zonificacion',         label: '🏙️ Zonificación',         ph: 'ej. R1, C2' },
                  { key: 'restricciones',        label: '⚠️ Restricciones',         ph: 'ej. Zona inundable' },
                ].map(({ key, label, ph }) => (
                  <div key={key} className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2">{label}</label>
                    <input type="text"
                      value={fichaData[key] || ''}
                      onChange={e => setFichaData(p => ({ ...p, [key]: e.target.value }))}
                      disabled={!['editor','administrador'].includes(userRole)}
                      placeholder={ph}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none disabled:opacity-60"
                    />
                  </div>
                ))}
                <div className="p-3 rounded-2xl border border-amber-100 bg-amber-50">
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider mb-3">🏛️ Suelo Fiscal</p>
                  <label className="flex items-center justify-between cursor-pointer mb-3 px-1">
                    <span className="text-xs font-bold text-slate-700">Es Tierra Fiscal</span>
                    <input type="checkbox" checked={fichaData.es_fiscal || false} onChange={e => setFichaData(p => ({ ...p, es_fiscal: e.target.checked }))} disabled={!['editor','administrador'].includes(userRole)} className="w-4 h-4 accent-amber-500 cursor-pointer" />
                  </label>
                  <div className="space-y-2">
                    <select value={fichaData.estado_ocupacion || ''} onChange={e => setFichaData(p => ({ ...p, estado_ocupacion: e.target.value }))} disabled={!['editor','administrador'].includes(userRole)} className="w-full bg-white border border-amber-200 rounded-xl p-2 text-xs font-bold outline-none disabled:opacity-60">
                      <option value="">Estado de Ocupación...</option>
                      {['Libre', 'Concesionado', 'Usurpado', 'En Litigio'].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <select value={fichaData.destino_previsto || ''} onChange={e => setFichaData(p => ({ ...p, destino_previsto: e.target.value }))} disabled={!['editor','administrador'].includes(userRole)} className="w-full bg-white border border-amber-200 rounded-xl p-2 text-xs font-bold outline-none disabled:opacity-60">
                      <option value="">Destino Previsto...</option>
                      {['Parque', 'Vivienda Social', 'Reserva Natural', 'Equipamiento'].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
              </>)}

              {sidebarTab === 'historial' && (
                <div className="space-y-2">
                  {loadingHistorial ? (
                    <p className="text-center text-xs text-slate-400 py-8 animate-pulse">Cargando historial...</p>
                  ) : parcelaHistorial.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-slate-300">
                      <span className="text-3xl">🕒</span>
                      <p className="text-xs font-bold">Sin cambios registrados</p>
                      <p className="text-[10px] text-center">Los cambios de titular, estado fiscal<br/>y ficha técnica quedan registrados aquí.</p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[18px] top-0 bottom-0 w-px bg-slate-100" />
                      <div className="space-y-3">
                        {parcelaHistorial.map((entry) => {
                          const TIPO_CONFIG = {
                            'Estado fiscal':    { icon: '📊', color: 'bg-blue-100 text-blue-700' },
                            'Cambio de titular':{ icon: '👤', color: 'bg-emerald-100 text-emerald-700' },
                            'Ficha técnica':    { icon: '📝', color: 'bg-slate-100 text-slate-600' },
                          };
                          const cfg = TIPO_CONFIG[entry.tipo_cambio] ?? { icon: '📌', color: 'bg-slate-100 text-slate-600' };
                          const fecha = new Date(entry.fecha);
                          const fechaStr = fecha.toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' });
                          const horaStr  = fecha.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
                          return (
                            <div key={entry.id} className="flex gap-3 relative">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 z-10 ${cfg.color}`}>
                                {cfg.icon}
                              </div>
                              <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-3 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${cfg.color}`}>
                                    {entry.tipo_cambio}
                                  </span>
                                  <span className="text-[9px] text-slate-400 shrink-0">{fechaStr} {horaStr}</span>
                                </div>
                                {entry.descripcion && (
                                  <p className="text-xs font-bold text-slate-700 mt-1">{entry.descripcion}</p>
                                )}
                                {(entry.valor_anterior || entry.valor_nuevo) && (
                                  <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                                    <span className="text-slate-400 bg-slate-50 rounded-lg px-2 py-0.5 font-mono truncate max-w-[80px]">{entry.valor_anterior}</span>
                                    <span className="text-slate-300">→</span>
                                    <span className="text-slate-700 bg-slate-50 rounded-lg px-2 py-0.5 font-mono font-bold truncate max-w-[80px]">{entry.valor_nuevo}</span>
                                  </div>
                                )}
                                {entry.usuario_nombre && (
                                  <p className="text-[9px] text-slate-400 mt-1.5">por {entry.usuario_nombre}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </>) : (
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
              {Object.entries(selectedFeature.details).map(([key, value]) => {
                if (SKIP_FIELDS.has(key)) return null;
                const label = FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
                const display = formatFieldValue(key, value);
                return (
                  <div key={key} className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                    <p className="text-sm font-bold text-slate-700">{display}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 shrink-0">
            {['editor','administrador'].includes(userRole) && selectedFeature.type === 'Parcela' && !['general','historial'].includes(sidebarTab) && (
              <button onClick={handleSaveFicha} disabled={isSavingFicha} className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
                {isSavingFicha ? '⏳ Guardando...' : '💾 Guardar Ficha'}
              </button>
            )}
            {userRole !== 'consultor' && (<>
              {(selectedFeature.type === 'Reporte' || selectedFeature.type === 'Reporte Vial') ? (
                <button onClick={() => setIsInfraModalOpen(true)} className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-95">🛠️ Gestionar Reporte</button>
              ) : ['editor','administrador'].includes(userRole) ? (
                <button onClick={handleStartModify} className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-95">✏️ Modificar Forma</button>
              ) : null}
              {['editor','administrador'].includes(userRole) && selectedFeature.type === 'Parcela' && (
                <div className="pt-1 flex flex-col gap-2">
                  {userRole === 'administrador' && (
                    <button onClick={handleDownloadPDF} className="w-full bg-blue-50 text-blue-700 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors">📄 Descargar Cédula PDF</button>
                  )}
                  <div className="flex gap-1">
                    {['al_dia', 'moroso', 'exento'].map(st => (
                      <button key={st} onClick={() => handleUpdateEstado(selectedFeature.details.id, st)} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${selectedFeature.details.estado_fiscal === st ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'}`}>{st.replace('_', ' ')}</button>
                    ))}
                  </div>
                </div>
              )}
              {userRole === 'administrador' && (
                <button onClick={handleDelete} className="w-full bg-red-50 text-red-600 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors">🗑️ Eliminar {selectedFeature.type}</button>
              )}
            </>)}
          </div>
        </aside>
      )}

      {/* MENÚ CONTEXTUAL (click derecho / long press) */}
      {contextMenu && !isEditingGeom && (() => {
        const menuItems = (
          <div className="overflow-y-auto">
            <p className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-y border-slate-100">🛣️ Viales y Pavimento</p>
            <button onClick={() => handleCreateIncidencia('bache')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center gap-3 font-bold text-slate-700"><span className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0" /> Bache</button>
            <button onClick={() => handleCreateIncidencia('calle_danada')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 flex items-center gap-3 font-bold text-slate-700"><span className="w-2.5 h-2.5 bg-orange-500 rounded-full shrink-0" /> Calle Dañada</button>
            <button onClick={() => handleCreateIncidencia('semaforo')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-yellow-50 flex items-center gap-3 font-bold text-slate-700"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-full shrink-0" /> Semáforo Dañado</button>
            <p className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-y border-slate-100">💡 Alumbrado</p>
            <button onClick={() => handleCreateIncidencia('luminaria')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 flex items-center gap-3 font-bold text-slate-700"><span className="w-2.5 h-2.5 bg-amber-400 rounded-full shrink-0" /> Luminaria Apagada</button>
            <button onClick={() => handleCreateIncidencia('cable_caido')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 flex items-center gap-3 font-bold text-slate-700"><span className="w-2.5 h-2.5 bg-amber-600 rounded-full shrink-0" /> Cable Caído</button>
            <p className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-y border-slate-100">🗑️ Residuos</p>
            <button onClick={() => handleCreateIncidencia('basural')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 flex items-center gap-3 font-bold text-slate-700"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0" /> Punto de Basura</button>
            <button onClick={() => handleCreateIncidencia('escombros')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-lime-50 flex items-center gap-3 font-bold text-slate-700"><span className="w-2.5 h-2.5 bg-lime-500 rounded-full shrink-0" /> Escombros</button>
            <p className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-y border-slate-100">🌳 Arbolado</p>
            <button onClick={() => handleCreateIncidencia('arbol_caido')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 flex items-center gap-3 font-bold text-slate-700"><span className="w-2.5 h-2.5 bg-green-500 rounded-full shrink-0" /> Árbol Caído</button>
            <button onClick={() => handleCreateIncidencia('arbol_peligroso')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 flex items-center gap-3 font-bold text-slate-700"><span className="w-2.5 h-2.5 bg-green-700 rounded-full shrink-0" /> Árbol Peligroso</button>
            <p className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-y border-slate-100">🏗️ Obras Viales</p>
            <button onClick={() => handleStartDrawObra('reparacion_calle')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-3 font-bold text-slate-700">🚧 Calle en Obra (tramo)</button>
            <button onClick={() => handleStartDrawObra('cuneta')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 flex items-center gap-3 font-bold text-slate-700">💧 Limpieza de Cuneta</button>
            <button onClick={() => handleStartDrawZonaObra()} className="w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 flex items-center gap-3 font-bold text-slate-700">📐 Zona en Construcción</button>
            <button onClick={() => handleStartDrawObra('clausura')} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 flex items-center gap-3 font-bold text-slate-700">🚫 Calle Clausurada</button>
          </div>
        );

        if (isMobile) {
          return (
            <div className="fixed bottom-0 left-0 right-0 z-[250] bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[72vh]">
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-slate-200" />
              </div>
              <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <p className="text-[8px] font-black uppercase opacity-50 tracking-tighter">Nuevo Reporte — Ubicación</p>
                  <p className="text-[10px] font-bold">{getPlusCode(contextMenu.lat, contextMenu.lng)}</p>
                </div>
                <button onClick={() => setContextMenu(null)} className="text-slate-400 hover:text-white text-lg leading-none ml-4">✕</button>
              </div>
              {menuItems}
            </div>
          );
        }

        const menuW = 288;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const spaceBelow = vh - contextMenu.y - 8;
        const spaceAbove = contextMenu.y - 8;
        const openUp = spaceBelow < 380 && spaceAbove > spaceBelow;
        const maxH = Math.min(openUp ? spaceAbove : spaceBelow, vh * 0.88) - 8;
        const left = Math.min(contextMenu.x, vw - menuW - 8);
        return (
          <div className="absolute z-50 bg-white shadow-2xl rounded-2xl border border-slate-200 py-2 w-72 overflow-y-auto"
            style={{ top: contextMenu.y, left, maxHeight: maxH, transform: openUp ? 'translateY(-100%)' : 'none' }}>
            <div className="px-4 py-2 bg-slate-900 text-white flex flex-col gap-0.5">
              <p className="text-[8px] font-black uppercase opacity-50 tracking-tighter">Ubicación Seleccionada</p>
              <p className="text-[10px] font-bold truncate">{getPlusCode(contextMenu.lat, contextMenu.lng)}</p>
            </div>
            {menuItems}
          </div>
        );
      })()}
    </div>
  );
}
