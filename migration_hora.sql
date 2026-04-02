-- Migración para soportar vencimientos horarios en Reportería
-- Ejecutar en el editor SQL de Supabase

-- 1. Agregar columna al Catalogo
ALTER TABLE public.catalogo_tareas_reporteria 
ADD COLUMN hora_vencimiento TIME NULL;

-- 2. Agregar columna a la Bolsa
ALTER TABLE public.bolsa_tareas_reporteria 
ADD COLUMN hora_vencimiento TIME NULL;

COMMENT ON COLUMN public.catalogo_tareas_reporteria.hora_vencimiento IS 'Hora limite sugerida para completar la tarea (SLA)';
COMMENT ON COLUMN public.bolsa_tareas_reporteria.hora_vencimiento IS 'Hora limite sugerida para completar la tarea (SLA)';
