import random
import uuid

# Coordenadas aproximadas del centro de Añatuya, Argentina
LAT_CENTER = -28.4606
LON_CENTER = -62.8347
OFFSET = 0.005 # Desplazamiento para generar polígonos cercanos

def generate_polygon(lat, lon):
    """Genera un polígono cuadrado pequeño alrededor de un punto central"""
    size = 0.0002
    coords = [
        (lon - size, lat - size),
        (lon + size, lat - size),
        (lon + size, lat + size),
        (lon - size, lat + size),
        (lon - size, lat - size) # Cerrar el polígono
    ]
    wkt_coords = ", ".join([f"{c[0]} {c[1]}" for c in coords])
    return f"ST_GeomFromText('POLYGON(({wkt_coords}))', 4326)"

def generate_point(lat, lon):
    """Genera un punto en formato WKT de PostGIS"""
    return f"ST_GeomFromText('POINT({lon} {lat})', 4326)"

def main():
    seed_sql = """BEGIN;

"""
    
    # Generar Propietario de ejemplo
    propietario_id = str(uuid.uuid4())
    seed_sql += f"INSERT INTO propietarios (id, dni, nombre, apellido) VALUES ('{propietario_id}', '2012345678', 'Juan', 'Perez');\n\n"

    # Generar 50 Parcelas (Polígonos)
    for i in range(50):
        lat = LAT_CENTER + random.uniform(-OFFSET, OFFSET)
        lon = LON_CENTER + random.uniform(-OFFSET, OFFSET)
        padron = f"PAD-{1000 + i}"
        geom = generate_polygon(lat, lon)
        seed_sql += f"INSERT INTO parcelas (nro_padron, propietario_id, geometria, estado_fiscal) VALUES ('{padron}', '{propietario_id}', {geom}, 'al_dia');\n"

    seed_sql += "\n"

    # Generar 20 Luminarias (Puntos)
    for i in range(20):
        lat = LAT_CENTER + random.uniform(-OFFSET, OFFSET)
        lon = LON_CENTER + random.uniform(-OFFSET, OFFSET)
        geom = generate_point(lat, lon)
        seed_sql += f"INSERT INTO infraestructura (tipo, posicion, estado) VALUES ('luminaria', {geom}, 'funcional');\n"

    seed_sql += "\nCOMMIT;"""

    with open("D:/User/Desktop/GeoMuni/supabase/seed.sql", "w") as f:
        f.write(seed_sql)
    print("Archivo seed.sql generado exitosamente en supabase/seed.sql")

if __name__ == "__main__":
    main()
