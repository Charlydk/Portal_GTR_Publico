# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.  
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).  
Versioning siguiendo [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.4.0] - 2026-03-31

### ✨ Agregado
- **Campo Asunto** en Entregables: texto corto visible en las tarjetas del Kanban para mejorar la organización visual.
- **Texto Enriquecido (Rich Text)**: integración de `react-quill-new` en Descripciones y Comentarios de entregables, permitiendo negritas, listas y enlaces.
- **Seguridad de Contenido**: implementación de `dompurify` para el renderizado seguro de HTML en el frontend.

### 🔧 Modificado
- **Tarjetas del Kanban**: ahora muestran prioritariamente el Asunto; la Descripción larga se oculta del tablero para mantener un diseño limpio y estable.
- **Dependencias**: migración de `react-quill` a `react-quill-new` para asegurar compatibilidad total con **React 19** (solución al error `findDOMNode`).

### 🐛 Corregido
- **Error 504 en Vite**: limpieza de caché tras cambio de dependencias críticas en caliente.

---

## [1.3.0] - 2026-03-31

### ✨ Agregado
- **Módulo Kanban Backoffice** (`/backoffice/kanban`): tablero de entregables con columnas Pendiente / En Progreso / Completado.
- **Vista de Detalle de Entregable** (`/backoffice/entregables/:id`): checklist interno (sub-backlog), historial de comentarios y audit trail automático.
- **Notificaciones Live** (`NotificadorEntregables`): polling cada 5 minutos con Toast solo para el analista destinatario de la tarea.
- **Widget de Entregables en Dashboard**: resumen de pendientes para Analista y Supervisor.
- **Dashboards por Rol refactorizados**:
  - **Analista**: flujo vertical Oportunidades → Mis Entregables → Mis Incidencias + botón Actualizar + hora de última sincronización.
  - **Supervisor**: Cumplimiento de Rutinas y Dotación movidos a modales. Botón de Rutinas cambia a rojo si hay ítems vencidos.
- **Archivado automático**: tareas Completadas hace más de 15 días se ocultan del Kanban (toggle "Ver Histórico" disponible).

### 🔧 Modificado
- **Radar de Cobertura**: restaurado con tooltips. Ahora muestra en rojo cualquier campaña activa sin analistas, independientemente de si tiene horarios WFM cargados.
- **Auto-refresh del Dashboard**: intervalo extendido de 1 minuto a **5 minutos** para reducir carga del servidor.
- **Modal de Rutinas → redirección**: al hacer clic en una campaña navega directamente a la tarea del día (`/tareas/:id`) en vez de la lista general.
- **Diferenciación visual en Kanban**: badge 🛡️ para tareas de Supervisor, 👤 para Analista.

### 🐛 Corregido
- **Error de sintaxis** en `DashboardPage.jsx` que impedía la carga en algunos navegadores (comilla extra `}` en atributo JSX).
- **Checkbox del checklist**: ahora muestra un spinner individual mientras se procesa el toggle, evitando confusión al usuario.
- **Notificaciones al supervisor creador**: el popup ya no aparece al supervisor cuando asigna una tarea a otro.
- **Permisos granulares**: analistas solo pueden editar tareas propias no bloqueadas; supervisores tienen control total.

---

## [1.2.1] - 2026-03-17

### 🔧 Modificado
- **HHEE**: corrección de bug donde las horas extras se guardaban bajo el RUT modificado manualmente en el formulario, en vez del RUT consultado originalmente (separación de estado `rutConsultado` vs `rutInput`).

---

## [1.2.0] - 2026-03-13

### ✨ Agregado
- **Dashboard de Supervisores de Operaciones**: panel dedicado con accesos directos al módulo HHEE.
- **Módulo HHEE completo**: Portal de Carga, Aprobación, Reportes y Métricas.

### 🔧 Modificado
- Refactor de importaciones del backend tras eliminación del módulo Avisos.

---

## [1.1.0] - 2026-03-10

### ✨ Agregado
- **Módulo de Incidencias**: formulario, lista, control y detalle.
- **Registros de Eventos** por campaña.
- **Planificación de Turnos** (WFM básico).

### 🐛 Corregido
- Bug en guardado de fecha/hora al registrar incidencias mediante checkbox de "ahora".

---

## [1.0.0] - 2026-02-01

### ✨ Inicial
- Autenticación JWT con roles (ANALISTA, SUPERVISOR, RESPONSABLE, SUPERVISOR_OPERACIONES).
- Gestión de Campañas, Analistas y Asignaciones.
- Sistema de Check-In/Check-Out con Radar de Cobertura.
- Generación automática de Rutinas GTR con Checklist por día de la semana.
- Dashboard de Analista con sesiones activas.
