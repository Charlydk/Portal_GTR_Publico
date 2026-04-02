-- Agregar columna 'categoria' al Catalogo
ALTER TABLE public.catalogo_tareas_reporteria
ADD COLUMN categoria VARCHAR(100) NOT NULL DEFAULT 'General';

-- Agregar columna 'categoria' a la Bolsa
ALTER TABLE public.bolsa_tareas_reporteria
ADD COLUMN categoria VARCHAR(100) NOT NULL DEFAULT 'General';

-- (Opcional) Si quieres actualizar algunos datos a mano para probar hoy
-- UPDATE public.catalogo_tareas_reporteria SET categoria = 'Tableros Delivery' WHERE nombre ILIKE '%delivery%';
-- UPDATE public.bolsa_tareas_reporteria SET categoria = 'Tableros Delivery' WHERE nombre ILIKE '%delivery%';
