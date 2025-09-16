import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Container, Alert } from 'react-bootstrap'; 
import { AuthProvider } from './context/AuthProvider.jsx';
import { useAuth } from './hooks/useAuth.js';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';

// Importación de todas tus páginas
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
import ControlIncidenciasPage from './pages/ControlIncidenciasPage';
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


// Componente interno que maneja la lógica de la aplicación principal
const AppContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showBetaNotice, setShowBetaNotice] = useState(true);

  useEffect(() => {
    if (user && (location.pathname === '/login' || location.pathname === '/register')) {
      navigate('/dashboard');
    }
  }, [user, navigate, location]);

  return (
    <>
      <Navbar />

      {/* --- NUEVO COMPONENTE DE ALERTA --- */}
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
          {/* ... (Todas tus rutas se quedan exactamente igual) ... */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES']}><DashboardPage /></PrivateRoute>} />
          <Route path="/cambiar-password" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES']}><CambiarPasswordPage /></PrivateRoute>} />
          <Route path="/avisos" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><AvisosPage /></PrivateRoute>} />
          <Route path="/avisos/:avisoId" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><DetalleAvisoPage /></PrivateRoute>} />
          <Route path="/avisos/crear" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><FormularioAvisoPage /></PrivateRoute>} />
          <Route path="/avisos/editar/:id" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><FormularioAvisoPage /></PrivateRoute>} />
          <Route path="/tareas" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><TareasPage /></PrivateRoute>} />
          <Route path="/tareas/:id" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><DetalleTareaPage /></PrivateRoute>} />
          <Route path="/tareas/crear" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><FormularioTareaPage /></PrivateRoute>} />
          <Route path="/tareas/editar/:id" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><FormularioTareaPage /></PrivateRoute>} />
          <Route path="/tareas/disponibles" element={<PrivateRoute allowedRoles={['ANALISTA']}><TareasDisponiblesPage /></PrivateRoute>} />
          <Route path="/tareas/:tareaId/checklist_items/crear" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><FormularioChecklistItemPage /></PrivateRoute>} />
          <Route path="/tareas/:tareaId/checklist_items/editar/:id" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><FormularioChecklistItemPage /></PrivateRoute>} />
          <Route path="/tareas-generadas/:id" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><DetalleTareaGeneradaPage /></PrivateRoute>} />
          <Route path="/tareas-generadas/editar/:id" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><FormularioTareaPage /></PrivateRoute>} />
          <Route path="/analistas" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><AnalistasPage /></PrivateRoute>} />
          <Route path="/analistas/:id" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><DetalleAnalistaPage /></PrivateRoute>} />
          <Route path="/analistas/crear" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><FormularioAnalistaPage /></PrivateRoute>} />
          <Route path="/analistas/editar/:id" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><FormularioAnalistaPage /></PrivateRoute>} />
          <Route path="/campanas" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><CampanasPage /></PrivateRoute>} />
          <Route path="/campanas/:id" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><DetalleCampanaPage /></PrivateRoute>} />
          <Route path="/campanas/crear" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><FormularioCampanaPage /></PrivateRoute>} />
          <Route path="/campanas/editar/:id" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><FormularioCampanaPage /></PrivateRoute>} />
          <Route path="/asignar-campanas" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><AsignacionCampanasPage /></PrivateRoute>} />
          <Route path="/incidencias" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><ListaIncidenciasPage /></PrivateRoute>} />
          <Route path="/control-incidencias" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><ControlIncidenciasPage /></PrivateRoute>} />
          <Route path="/incidencias/crear" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><FormularioIncidenciaPage /></PrivateRoute>} />
          <Route path="/incidencias/:id" element={<PrivateRoute allowedRoles={['ANALISTA', 'SUPERVISOR', 'RESPONSABLE']}><DetalleIncidenciaPage /></PrivateRoute>} />
          <Route path="/hhee/portal" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES']}><PortalHHEEPage /></PrivateRoute>} />
          <Route path="/hhee/reportes" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES']}><ReportesHHEEPage /></PrivateRoute>} />
          <Route path="/hhee/metricas" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES']}><MetricasHHEEPage /></PrivateRoute>} />
          <Route path="/mis-solicitudes-hhee" element={<PrivateRoute allowedRoles={['ANALISTA']}><MisSolicitudesHHEEPage /></PrivateRoute>} />
          <Route path="/aprobar-hhee" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE']}><AprobacionHHEEPage /></PrivateRoute>}/>
          <Route path="/historial-aprobaciones" element={<PrivateRoute allowedRoles={['SUPERVISOR', 'RESPONSABLE', 'SUPERVISOR_OPERACIONES']}><HistorialAprobacionesPage /></PrivateRoute>} />
          
          
          <Route path="*" element={<div>404 - Página no encontrada</div>} />
        </Routes>
      </div>
    </>
  );
};

// El componente App ahora es más simple y solo envuelve la lógica principal
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