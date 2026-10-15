import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Estoque from './pages/Estoque.jsx';
import Vendas from './pages/Vendas.jsx';
import Caixa from './pages/Caixa.jsx';
import Financeiro from './pages/Financeiro.jsx';
import Equipe from './pages/Equipe.jsx';
import SuperAdmin from './pages/SuperAdmin.jsx';

const TODOS = ['dono', 'vendedor', 'tecnico'];
const DONO_VENDEDOR = ['dono', 'vendedor'];
const SO_DONO = ['dono'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/superadmin"
        element={
          <ProtectedRoute roles={['superadmin']}>
            <SuperAdmin />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute roles={TODOS}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/estoque"
          element={
            <ProtectedRoute roles={DONO_VENDEDOR}>
              <Estoque />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendas"
          element={
            <ProtectedRoute roles={DONO_VENDEDOR}>
              <Vendas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/caixa"
          element={
            <ProtectedRoute roles={DONO_VENDEDOR}>
              <Caixa />
            </ProtectedRoute>
          }
        />
        <Route
          path="/financeiro"
          element={
            <ProtectedRoute roles={SO_DONO}>
              <Financeiro />
            </ProtectedRoute>
          }
        />
        <Route
          path="/equipe"
          element={
            <ProtectedRoute roles={SO_DONO}>
              <Equipe />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
