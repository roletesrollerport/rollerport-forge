import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { Lock, User, Loader2 } from 'lucide-react';
import { useUsuarios } from '@/hooks/useUsuarios';

interface Props {
  onLogin: (userId: string) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: doLogin } = useUsuarios();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !senha) {
      toast.error('Preencha login e senha!');
      return;
    }
    setLoading(true);
    try {
      const result = await doLogin(login.trim(), senha);
      if (result) {
        onLogin(result.user.id);
        toast.success(`Bem-vindo, ${result.user.nome}!`);
      } else {
        toast.error('Login ou senha incorretos!');
      }
    } catch {
      toast.error('Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
