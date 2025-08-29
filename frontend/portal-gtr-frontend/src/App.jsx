// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider.jsx';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import AvisosPage from './pages/AvisosPage';
import DetalleAvisoPage from './pages/DetalleAvisoPage';
import TareasPage from './pages/TareasPage';
import AnalistasPage from './pages/AnalistasPage';
import CampanasPage from './pages/CampanasPage';
import AsignacionCampanasPage from './pages/AsignacionCampanasPage';
import FormularioAnalistaPage from './pages/FormularioAnalistaPage';
import FormularioCampanaPage from './pages/FormularioCampanaPage';
import FormularioAvisoPage from './pages/FormularioAvisoPage';
import FormularioChecklistItemPage from './pages/FormularioChecklistItemPage';
import FormularioTareaPage from './pages/FormularioTareaPage';
import DetalleAnalistaPage from './pages/DetalleAnalistaPage';
import DetalleCampanaPage from './pages/DetalleCampanaPage';
import DetalleTareaPage from './pages/DetalleTareaPage';
import RegisterPage from './pages/RegisterPage';
import ListaIncidenciasPage from './pages/ListaIncidenciasPage';
import DetalleTareaGeneradaPage from './pages/DetalleTareaGeneradaPage';
import FormularioIncidenciaPage from './pages/FormularioIncidenciaPage';
import DetalleIncidenciaPage from './pages/DetalleIncidenciaPage';
import TareasDisponiblesPage from './pages/TareasDisponiblesPage';
import PortalHHEEPage from './pages/hhee/PortalHHEEPage';



function App() {
  return (
    <Router>
      <AuthProvider> {/* Envuelve toda la aplicación para que el contexto de autenticación esté disponible */}
        <Navbar /> {/* Tu barra de navegación */}
        <div className="container mt-4 main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} /> {/* Ruta para el registro */}

            {/* Rutas Protegidas */}
            {/* Dashboard: Accesible por Analistas, Supervisores y Responsables */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <DashboardPage />
                </PrivateRoute>
              }
            />

            {/* Avisos */}
            {/* Lista de Avisos: Accesible por Analistas, Supervisores y Responsables */}
            <Route
              path="/avisos"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <AvisosPage />
                </PrivateRoute>
              }
            />
            {/* Detalle de Aviso: Accesible por Analistas, Supervisores y Responsables */}
            <Route
              path="/avisos/:avisoId"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <DetalleAvisoPage />
                </PrivateRoute>
              }
            />
            {/* Crear Aviso: Accesible por Supervisores y Responsables */}
            <Route
              path="/avisos/crear"
              element={
                <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioAvisoPage />
                </PrivateRoute>
              }
            />
            {/* Editar Aviso: Accesible por Supervisores y Responsables. Usa :id para consistencia */}
            <Route
              path="/avisos/editar/:id"
              element={
                <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioAvisoPage />
                </PrivateRoute>
              }
            />

            {/* Tareas */}
            {/* Lista de Tareas: Accesible por Analistas, Supervisores y Responsables */}
            <Route
              path="/tareas"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <TareasPage />
                </PrivateRoute>
              }
            />
            {/* Detalle de Tarea: Accesible por Analistas, Supervisores y Responsables */}
            <Route
              path="/tareas/:id"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <DetalleTareaPage />
                </PrivateRoute>
              }
            />
            {/* Crear Tarea: Accesible por Analistas, Supervisores y Responsables */}
            <Route
              path="/tareas/crear"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioTareaPage />
                </PrivateRoute>
              }
            />
            {/* Editar Tarea: Accesible por Analistas (sus propias), Supervisores y Responsables */}
            <Route
              path="/tareas/editar/:id"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioTareaPage />
                </PrivateRoute>
              }
            />

            {/* Tareas Disponibles para Analistas */}
            <Route
              path="/tareas/disponibles"
              element={
                <PrivateRoute allowedRoles={['ANALISTA']}>
                  <TareasDisponiblesPage />
                </PrivateRoute>
              }
            />

            {/* Crear Checklist Item para Tarea: Accesible por Analistas (sus propias tareas), Supervisores y Responsables */}
            <Route
              path="/tareas/:tareaId/checklist_items/crear"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioChecklistItemPage />
                </PrivateRoute>
              }
            />

            {/* Detalle de Tarea Generada por Aviso: Accesible por Analistas, Supervisores y Responsables */}
            <Route
              path="/tareas-generadas/:id"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <DetalleTareaGeneradaPage />
                </PrivateRoute>
              }
            />
            {/* Editar Tarea Generada por Aviso: Accesible por Analistas (sus propias), Supervisores y Responsables */}
            {/* Se asume que FormularioTareaPage puede manejar la edición de tareas generadas o se creará uno específico */}
            <Route
              path="/tareas-generadas/editar/:id"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioTareaPage /> {/* Reutilizamos el mismo formulario de tarea */}
                </PrivateRoute>
              }
            />


            {/* Editar Checklist Item para Tarea: Accesible por Analistas (sus propias tareas), Supervisores y Responsables */}
            <Route
              path="/tareas/:tareaId/checklist_items/editar/:id"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioChecklistItemPage />
                </PrivateRoute>
              }
            />

            {/* Analistas */}
            {/* Lista de Analistas: Accesible por Supervisores y Responsables */}
            <Route
              path="/analistas"
              element={
                <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                  <AnalistasPage />
                </PrivateRoute>
              }
            />
            {/* Detalle de Analista: Accesible por Supervisores y Responsables */}
            <Route
              path="/analistas/:id"
              element={
                <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                  <DetalleAnalistaPage />
                </PrivateRoute>
              }
            />
            {/* Crear Analista: Accesible por Supervisores y Responsables */}
            <Route
              path="/analistas/crear"
              element={
                <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioAnalistaPage />
                </PrivateRoute>
              }
            />
            {/* Editar Analista: Accesible por Supervisores y Responsables */}
            <Route
              path="/analistas/editar/:id"
              element={
                <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioAnalistaPage />
                </PrivateRoute>
              }
            />

            {/* Campañas */}
            {/* Lista de Campañas: Accesible por Analistas, Supervisores y Responsables */}
            <Route
              path="/campanas"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <CampanasPage />
                </PrivateRoute>
              }
            />
            {/* Detalle de Campaña: Accesible por Analistas, Supervisores y Responsables */}
            <Route
              path="/campanas/:id"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <DetalleCampanaPage />
                </PrivateRoute>
              }
            />
            {/* Crear Campaña: Accesible por Supervisores y Responsables */}
            <Route
              path="/campanas/crear"
              element={
                <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioCampanaPage />
                </PrivateRoute>
              }
            />
            {/* Editar Campaña: Accesible por Supervisores y Responsables */}
            <Route
              path="/campanas/editar/:id"
              element={
                <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioCampanaPage />
                </PrivateRoute>
              }
            />

            {/* Asignación de Campañas: Accesible por Supervisores y Responsables */}
            <Route
              path="/asignar-campanas"
              element={
                <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                  <AsignacionCampanasPage />
                </PrivateRoute>
              }
            />

            {/* Rutas de Incidencias (solo la lista, el registro se hace en BitacoraCampana) */}
            <Route
              path="/incidencias"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <ListaIncidenciasPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/incidencias/crear"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <FormularioIncidenciaPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/incidencias/:id"
              element={
                <PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}>
                  <DetalleIncidenciaPage />
                </PrivateRoute>
              }
            /> 
            {/* Rutas del portal de hhee */}
            <Route
                path="/hhee/portal"
                element={
                  <PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}>
                    <PortalHHEEPage />
                  </PrivateRoute>
                }
              />

            {/* Ruta para el caso de página no encontrada */}
            <Route path="*" element={<div>404 - Página no encontrada</div>} />

          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
