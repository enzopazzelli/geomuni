# Pendientes de Base de Datos

## Optimizaciones de Performance

### 1. Índices en Foreign Keys
Agregar a una nueva migración:
```sql
CREATE INDEX idx_parcelas_propietario_id ON parcelas(propietario_id);
CREATE INDEX idx_infraestructura_responsable_id ON infraestructura(responsable_id);
CREATE INDEX idx_historial_obras_responsable_id ON historial_obras(responsable_id);
```

### 2. Eliminar ST_Intersects del JOIN en getParcelasTable()
Actualmente `getParcelasTable()` usa un join espacial costoso:
```sql
LEFT JOIN barrios b ON ST_Intersects(p.geometria, b.geometria)
```
**Solución:** Agregar columna `barrio_id UUID REFERENCES barrios(id)` a `parcelas` y mantenerla con un trigger:
```sql
ALTER TABLE parcelas ADD COLUMN barrio_id UUID REFERENCES barrios(id);

-- Trigger para asignar barrio_id automáticamente al insertar/actualizar geometría
CREATE OR REPLACE FUNCTION assign_barrio_to_parcela()
RETURNS TRIGGER AS $$
BEGIN
  SELECT id INTO NEW.barrio_id
  FROM barrios
  WHERE ST_Intersects(NEW.geometria, geometria)
  LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_barrio
BEFORE INSERT OR UPDATE OF geometria ON parcelas
FOR EACH ROW EXECUTE FUNCTION assign_barrio_to_parcela();

-- Backfill existentes
UPDATE parcelas p
SET barrio_id = (
  SELECT id FROM barrios b WHERE ST_Intersects(p.geometria, b.geometria) LIMIT 1
);
```
Luego cambiar la query en `geoActions.js`:
```sql
LEFT JOIN barrios b ON p.barrio_id = b.id
```

### 3. Columnas materializadas para centroide y superficie
Evitar recalcular `ST_Centroid`, `ST_Area` en cada query:
```sql
ALTER TABLE parcelas
  ADD COLUMN lat DOUBLE PRECISION,
  ADD COLUMN lng DOUBLE PRECISION,
  ADD COLUMN superficie_m2 NUMERIC(12,2);

CREATE OR REPLACE FUNCTION update_parcela_geometry_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.lat  := ST_Y(ST_Centroid(NEW.geometria));
  NEW.lng  := ST_X(ST_Centroid(NEW.geometria));
  NEW.superficie_m2 := ROUND(ST_Area(NEW.geometria::geography)::numeric, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parcela_geometry
BEFORE INSERT OR UPDATE OF geometria ON parcelas
FOR EACH ROW EXECUTE FUNCTION update_parcela_geometry_fields();
```
Luego en `geoActions.js` usar `p.lat`, `p.lng`, `p.superficie_m2` directamente.
