-- ==============================================================================
-- SCRIPT DE CREACIÓN DE TABLAS FASE 3: REPORTE DE AUSENTISMO
-- Copiar y pegar en el SQL Editor de Supabase
-- ==============================================================================

-- 1. Tabla Maestra de Usuarios
CREATE TABLE IF NOT EXISTS public.ausentismo_usuarios (
    id SERIAL PRIMARY KEY,
    rut VARCHAR NOT NULL UNIQUE,
    nombre VARCHAR,
    apellido VARCHAR,
    id_mediatel VARCHAR,
    id_avaya VARCHAR,
    id_adereso VARCHAR
);

CREATE INDEX IF NOT EXISTS ix_ausentismo_usuarios_rut ON public.ausentismo_usuarios (rut);
CREATE INDEX IF NOT EXISTS ix_ausentismo_usuarios_id_mediatel ON public.ausentismo_usuarios (id_mediatel);
CREATE INDEX IF NOT EXISTS ix_ausentismo_usuarios_id_avaya ON public.ausentismo_usuarios (id_avaya);
CREATE INDEX IF NOT EXISTS ix_ausentismo_usuarios_id_adereso ON public.ausentismo_usuarios (id_adereso);

-- 2. Tabla de Planificación (Turnos)
CREATE TABLE IF NOT EXISTS public.ausentismo_planificacion (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES public.ausentismo_usuarios(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME WITHOUT TIME ZONE,
    hora_fin TIME WITHOUT TIME ZONE,
    campana VARCHAR DEFAULT 'Walmart'
);

CREATE INDEX IF NOT EXISTS ix_ausentismo_planif_fecha ON public.ausentismo_planificacion (fecha);

-- 3. Tabla de Conexiones reales (Logs)
CREATE TABLE IF NOT EXISTS public.ausentismo_conexiones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES public.ausentismo_usuarios(id) ON DELETE CASCADE,
    herramienta VARCHAR NOT NULL,
    evento VARCHAR,
    hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    hora_fin TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_ausentismo_conexiones_hora_inicio ON public.ausentismo_conexiones (hora_inicio);
