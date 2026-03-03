import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { store } from '@/lib/store';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { Lock, User } from 'lucide-react';

interface Props {
  onLogin: (userId: string) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const usuarios = store.getUsuarios();
    console.log('[Login] Todos os usuários:', usuarios.map(u => ({ id: u.id, login: u.login, senha: u.senha, nome: u.nome, ativo: u.ativo })));
    console.log('[Login] Tentando login com:', { login, senha });
    const user = usuarios.find(u => u.login.trim() === login.trim() && u.senha === senha && u.ativo);
    if (user) {
      onLogin(user.id);
      toast.success(`Bem-vindo, ${user.nome}!`);
    } else {
      toast.error('Login ou senha inválidos, ou usuário inativo.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm border rounded-lg p-8 bg-card shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Rollerport" className="h-20 w-20 object-contain mb-3" />
          <h1 className="text-xl font-bold text-primary">ROLLERPORT</h1>
          <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium">Login</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nome, email ou número" value={login} onChange={e => setLogin(e.target.value)} className="pl-10" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" placeholder="Sua senha" value={senha} onChange={e => setSenha(e.target.value)} className="pl-10" />
            </div>
          </div>
          <Button type="submit" className="w-full">Entrar</Button>
        </form>
      </div>
    </div>
  );
}
