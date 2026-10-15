import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

// roles: lista de cargos permitidos. Se omitida, qualquer usuário logado entra.
export default function ProtectedRoute({ children, roles }) {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(usuario.cargo)) {
    const destino = usuario.cargo === 'superadmin' ? '/superadmin' : '/';
    return <Navigate to={destino} replace />;
  }

  return children;
}
