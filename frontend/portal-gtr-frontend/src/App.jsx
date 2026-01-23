// RUTA: src/App.jsx

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Container, Alert } from 'react-bootstrap'; 
import { AuthProvider } from './context/AuthProvider.jsx';
import { useAuth } from './hooks/useAuth.js';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Navbar from './components/Navbar';

// Importación de páginas
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import AvisosPage from './pages/AvisosPage';
import DetalleAvisoPage from './pages/DetalleAvisoPage';
import TareasPage from './pages/TareasPage';
import AnalistasPage from './pages/AnalistasPage';
import CampanasPage from './pages/CampanasPage';
import FormularioAnalistaPage from './pages/FormularioAnalistaPage';
import FormularioCampanaPage from './pages/FormularioCampanaPage';
import FormularioAvisoPage from './pages/FormularioAvisoPage';
import FormularioChecklistItemPage from './pages/FormularioChecklistItemPage';
import FormularioTareaPage from './pages/FormularioTareaPage';
import DetalleAnalistaPage from './pages/DetalleAnalistaPage';
import DetalleCampanaPage from './pages/DetalleCampanaPage';
import DetalleTareaPage from './pages/DetalleTareaPage';
import ListaIncidenciasPage from './pages/ListaIncidenciasPage';
import ControlIncidenciasPage from './pages/ControlIncidenciasPage';
import ControlEventosPage from './pages/ControlEventosPage';
import DetalleTareaGeneradaPage from './pages/DetalleTareaGeneradaPage';
import FormularioIncidenciaPage from './pages/FormularioIncidenciaPage';
import DetalleIncidenciaPage from './pages/DetalleIncidenciaPage';
import TareasDisponiblesPage from './pages/TareasDisponiblesPage';
import PortalHHEEPage from './pages/hhee/PortalHHEEPage';
import ReportesHHEEPage from './pages/hhee/ReportesHHEEPage';
import MetricasHHEEPage from './pages/hhee/MetricasHHEEPage';
import MisSolicitudesHHEEPage from './pages/hhee/MisSolicitudesHHEEPage';
import AprobacionHHEEPage from './pages/hhee/AprobacionHHEEPage';
import HistorialAprobacionesPage from './pages/hhee/HistorialAprobacionesPage';
import CambiarPasswordPage from './pages/CambiarPasswordPage';
import AyudaPage from './pages/AyudaPage';
import GestionPlantillasPage from './pages/GestionPlantillasPage.jsx';
import Planificacion from './pages/planificacion/Planificacion.jsx';


const AppContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showBetaNotice, setShowBetaNotice] = useState(true);

  useEffect(() => {
    if (user && location.pathname === '/login') {
      navigate('/dashboard');
    }
  }, [user, navigate, location]);

  return (
    <>
      <Navbar />
      {showBetaNotice && (
        <Container className="mt-3">
            <Alert variant="info" onClose={() => setShowBetaNotice(false)} dismissible>
                <Alert.Heading as="h6">¡Aplicación en Versión Beta!</Alert.Heading>
                <p className="mb-0 small">
                    Estás usando una versión de prueba. Si la aplicación ha estado inactiva por más de 15 minutos, la primera carga puede demorar hasta un minuto mientras el servidor se reactiva.
                </p>
            </Alert>
        </Container>
      )}
      <div className="container mt-4 main-content">
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas para todos los roles autenticados (ANALISTA, SUPERVISOR, RESPONSABLE, OPS) */}
          <Route element={<ProtectedRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
            <Route path="/ayuda" element={<AyudaPage />} />
            
            {/* Visualización de Tareas (Lectura) */}
            <Route path="/tareas/:id" element={<DetalleTareaPage />} />
            {/* Mantenemos editar por si acaso, pero ya no crear */}
            <Route path="/tareas/editar/:id" element={<FormularioTareaPage />} />
            
            {/* Gestión de Checklists dentro de tareas */}
            <Route path="/tareas/:tareaId/checklist_items/crear" element={<FormularioChecklistItemPage />} />
            <Route path="/tareas/:tareaId/checklist_items/editar/:id" element={<FormularioChecklistItemPage />} />
            
            {/* Tareas Generadas automáticamente */}
            <Route path="/tareas-generadas/:id" element={<DetalleTareaGeneradaPage />} />
            <Route path="/tareas-generadas/editar/:id" element={<FormularioTareaPage />} />
            
            {/* Campañas e Incidencias (Ahora global para todos) */}
            <Route path="/campanas" element={<CampanasPage />} />
            <Route path="/campanas/:id" element={<DetalleCampanaPage />} />
            <Route path="/incidencias" element={<ListaIncidenciasPage />} />
            <Route path="/control-incidencias" element={<ControlIncidenciasPage />} />
            <Route path="/incidencias/crear" element={<FormularioIncidenciaPage />} />
            <Route path="/incidencias/:id" element={<DetalleIncidenciaPage />} />
            <Route path="/incidencias/editar/:id" element={<FormularioIncidenciaPage />} />
            <Route path="/control-eventos" element={<ControlEventosPage />} />
            <Route path="/historial-aprobaciones" element={<HistorialAprobacionesPage />} />
          </Route>

          {/* Rutas ADMINISTRATIVAS (Supervisor y Responsable) */}
          <Route element={<ProtectedRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']} />}>
            <Route path="/avisos" element={<AvisosPage />} />
            <Route path="/avisos/:avisoId" element={<DetalleAvisoPage />} />
            <Route path="/avisos/crear" element={<FormularioAvisoPage />} />
            <Route path="/avisos/editar/:id" element={<FormularioAvisoPage />} />
            
            <Route path="/tareas" element={<TareasPage />} />
            {/* ELIMINADO: Route path="/tareas/crear" (Ya no se crean manuales) */}
            
            <Route path="/analistas" element={<AnalistasPage />} />
            <Route path="/analistas/:id" element={<DetalleAnalistaPage />} />
            <Route path="/analistas/crear" element={<FormularioAnalistaPage />} />
            <Route path="/analistas/editar/:id" element={<FormularioAnalistaPage />} />
            
            <Route path="/campanas/crear" element={<FormularioCampanaPage />} />
            <Route path="/campanas/editar/:id" element={<FormularioCampanaPage />} />
            {/* ELIMINADO: Route path="/asignar-campanas" (Ya no se asigna estático) */}
            
            <Route path="/plantillas-checklist" element={<GestionPlantillasPage />} />
            <Route path="/aprobar-hhee" element={<AprobacionHHEEPage />}/>

            {/* Rutas planificacion */}
            <Route path="/planificacion-turnos" element={<Planificacion />} />

          </Route>

          {/* Rutas solo para Analistas */}
          <Route element={<ProtectedRoute allowedRoles={['ANALISTA']} />}>
            <Route path="/tareas/disponibles" element={<TareasDisponiblesPage />} />
            <Route path="/mis-solicitudes-hhee" element={<MisSolicitudesHHEEPage />} />
          </Route>


          {/* Rutas solo para roles de HHEE */}
          <Route element={<ProtectedRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES']} />}>
            <Route path="/hhee/portal" element={<PortalHHEEPage />} />
            <Route path="/hhee/reportes" element={<ReportesHHEEPage />} />
            <Route path="/hhee/metricas" element={<MetricasHHEEPage />} />
          </Route>
          
          <Route path="*" element={<div>404 - Página no encontrada</div>} />
        </Routes>
      </div>
    </>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;