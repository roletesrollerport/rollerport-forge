import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';
import { Lock, User, Loader2 } from 'lucide-react';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  onLogin: (userId: string, sessionToken: string) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: doLogin, requestPasswordReset, verifyResetCode, resetPassword } = useUsuarios();

  const [isForgotPassOpen, setIsForgotPassOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [resetLogin, setResetLogin] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleRequestReset = async () => {
    if (!resetLogin.trim()) { toast.error('Informe seu login, e-mail ou WhatsApp!'); return; }
    setResetLoading(true);
    try {
      await requestPasswordReset(resetLogin.trim());
      setResetStep('verify');
      toast.success('Código enviado para seu WhatsApp!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao solicitar recuperação. Verifique seus dados.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (resetCode.length < 6) { toast.error('O código deve ter 6 dígitos!'); return; }
    setResetLoading(true);
    try {
      await verifyResetCode(resetLogin.trim(), resetCode);
      setResetStep('reset');
      toast.success('Código validado!');
    } catch (e: any) {
      toast.error(e.message || 'Código inválido ou expirado.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 4) { toast.error('A senha deve ter pelo menos 4 caracteres!'); return; }
    setResetLoading(true);
    try {
      await resetPassword(resetLogin.trim(), resetCode, newPassword);
      toast.success('Senha alterada com sucesso! Agora você pode entrar.');
      setIsForgotPassOpen(false);
      setResetStep('request');
      setResetCode('');
      setNewPassword('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar senha.');
    } finally {
      setResetLoading(false);
    }
  };

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
        onLogin(result.user.id, result.sessionToken);
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
          <div className="text-center">
            <button
              type="button"
              onClick={() => { setIsForgotPassOpen(true); setResetStep('request'); }}
              className="text-xs text-primary hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
        </form>
      </div>

      <Dialog open={isForgotPassOpen} onOpenChange={setIsForgotPassOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperação de Senha</DialogTitle>
          </DialogHeader>
          
          {resetStep === 'request' && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Informe seu login, e-mail ou número cadastrado para receber um código via WhatsApp.</p>
              <Input
                placeholder="Login, e-mail ou WhatsApp"
                value={resetLogin}
                onChange={e => setResetLogin(e.target.value)}
              />
              <Button onClick={handleRequestReset} className="w-full" disabled={resetLoading}>
                {resetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enviar Código
              </Button>
            </div>
          )}

          {resetStep === 'verify' && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Informe o código de 6 dígitos enviado para seu WhatsApp.</p>
              <Input
                placeholder="Código de 6 dígitos"
                value={resetCode}
                onChange={e => setResetCode(e.target.value)}
                maxLength={6}
              />
              <Button onClick={handleVerifyCode} className="w-full" disabled={resetLoading}>
                {resetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Validar Código
              </Button>
              <button onClick={() => setResetStep('request')} className="text-xs text-primary w-full text-center hover:underline">
                Reenviar código / Voltar
              </button>
            </div>
          )}

          {resetStep === 'reset' && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Crie uma nova senha de acesso.</p>
              <Input
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
              <Button onClick={handleResetPassword} className="w-full" disabled={resetLoading}>
                {resetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Alterar Senha
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
