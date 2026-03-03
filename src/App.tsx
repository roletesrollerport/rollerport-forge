import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import CustosPage from "./pages/CustosPage";
import ClientesPage from "./pages/ClientesPage";
import ProdutosPage from "./pages/ProdutosPage";
import OrcamentosPage from "./pages/OrcamentosPage";
import PedidosPage from "./pages/PedidosPage";
import ProducaoPage from "./pages/ProducaoPage";
import EstoquePage from "./pages/EstoquePage";
import UsuariosPage from "./pages/UsuariosPage";
import ChatPage from "./pages/ChatPage";
import IAPage from "./pages/IAPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import { useUsuarios, type UsuarioDB } from "./hooks/useUsuarios";

const queryClient = new QueryClient();

function AppContent() {
  const [loggedUserId, setLoggedUserId] = useState<string | null>(() => localStorage.getItem('rp_logged_user'));
  const [currentUser, setCurrentUser] = useState<UsuarioDB | null>(null);
  const [checking, setChecking] = useState(true);
  const { getById } = useUsuarios();

  useEffect(() => {
    if (loggedUserId) {
      getById(loggedUserId).then(user => {
        if (user) {
          setCurrentUser(user);
        } else {
          localStorage.removeItem('rp_logged_user');
          setLoggedUserId(null);
        }
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, [loggedUserId]);

  const handleLogin = (userId: string) => {
    localStorage.setItem('rp_logged_user', userId);
    setLoggedUserId(userId);
  };

  const handleLogout = () => {
    localStorage.removeItem('rp_logged_user');
    setLoggedUserId(null);
    setCurrentUser(null);
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando...</div>;
  }

  if (!loggedUserId || !currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Map UsuarioDB to the shape AppLayout expects
  const userForLayout = {
    id: currentUser.id,
    nome: currentUser.nome,
    email: currentUser.email,
    telefone: currentUser.telefone,
    whatsapp: currentUser.whatsapp,
    login: currentUser.login,
    senha: currentUser.senha,
    nivel: currentUser.nivel,
    genero: currentUser.genero,
    ativo: currentUser.ativo,
    foto: currentUser.foto,
    permissoes: currentUser.permissoes,
    createdAt: currentUser.created_at,
  };

  return (
    <BrowserRouter>
      <AppLayout currentUser={userForLayout} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/custos" element={<CustosPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/produtos" element={<ProdutosPage />} />
          <Route path="/orcamentos" element={<OrcamentosPage />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/producao" element={<ProducaoPage />} />
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/ia" element={<IAPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
