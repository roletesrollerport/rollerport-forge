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
import { store } from "./lib/store";

const queryClient = new QueryClient();

const App = () => {
  const [loggedUserId, setLoggedUserId] = useState<string | null>(() => localStorage.getItem('rp_logged_user'));

  const handleLogin = (userId: string) => {
    localStorage.setItem('rp_logged_user', userId);
    setLoggedUserId(userId);
  };

  const handleLogout = () => {
    localStorage.removeItem('rp_logged_user');
    setLoggedUserId(null);
  };

  if (!loggedUserId) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LoginPage onLogin={handleLogin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  const currentUser = store.getUsuarios().find(u => u.id === loggedUserId);
  if (!currentUser) {
    handleLogout();
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout currentUser={currentUser} onLogout={handleLogout}>
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
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
