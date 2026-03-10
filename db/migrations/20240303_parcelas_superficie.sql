-- Añadir columna de superficie a la tabla de parcelas
ALTER TABLE parcelas ADD COLUMN IF NOT EXISTS superficie NUMERIC(15, 2);

-- Actualizar las parcelas existentes calculando su área en m2
-- Usamos ::geography para obtener metros cuadrados reales sobre el elipsoide terrestre (SRID 4326)
UPDATE parcelas 
SET superficie = ST_Area(geometria::geography) 
WHERE superficie IS NULL;

-- Asegurar que futuras inserciones sin superficie la calculen (aunque ya lo hacemos en el Server Action)
-- Podríamos añadir un trigger aquí si se desea automatizarlo totalmente a nivel DB.
