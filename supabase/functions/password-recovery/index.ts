import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, loginStr, code, newPassword } = body;

    if (action === "request_reset") {
      if (!loginStr) throw new Error("Login é obrigatório");

      const trimmedLogin = loginStr.trim();

      // Find user by login, email, or whatsapp
      const { data: user, error: userError } = await supabaseAdmin
        .from("usuarios")
        .select("id, nome, whatsapp, telefone")
        .or(`login.ilike."${trimmedLogin}",email.ilike."${trimmedLogin}",whatsapp.ilike."${trimmedLogin}"`)
        .maybeSingle();

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

      // Invalidate previous codes
      await supabaseAdmin.from("password_resets").update({ used: true }).eq("user_id", user.id).eq("used", false);

      const { error: resetError } = await supabaseAdmin.from("password_resets").insert({
        user_id: user.id,
        code: resetCode,
        expires_at: expiresAt,
      });

      if (resetError) throw resetError;

      // Placeholder for WhatsApp API
      const whatsappNumber = user.whatsapp || user.telefone;
      console.log(`Sending code ${resetCode} to ${whatsappNumber}`);
      
      // Simulation of WhatsApp dispatch
      // In a real scenario, you'd call a WhatsApp API provider here.

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Código enviado via WhatsApp para o número cadastrado.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify_code") {
      if (!loginStr || !code) throw new Error("Dados incompletos");

      const trimmedLogin = loginStr.trim();
      const { data: user } = await supabaseAdmin
        .from("usuarios")
        .select("id")
        .or(`login.ilike."${trimmedLogin}",email.ilike."${trimmedLogin}",whatsapp.ilike."${trimmedLogin}"`)
        .maybeSingle();

      if (!user) throw new Error("Usuário não encontrado");

      const { data: resetEntry, error: resetError } = await supabaseAdmin
        .from("password_resets")
        .select("*")
        .eq("user_id", user.id)
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (resetError || !resetEntry) {
        return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      if (!loginStr || !code || !newPassword) throw new Error("Dados incompletos");

      const trimmedLogin = loginStr.trim();
      const { data: user } = await supabaseAdmin
        .from("usuarios")
        .select("id")
        .or(`login.ilike."${trimmedLogin}",email.ilike."${trimmedLogin}",whatsapp.ilike."${trimmedLogin}"`)
        .maybeSingle();

      if (!user) throw new Error("Usuário não encontrado");

      const { data: resetEntry } = await supabaseAdmin
        .from("password_resets")
        .select("*")
        .eq("user_id", user.id)
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!resetEntry) {
        return new Response(JSON.stringify({ error: "Código inválido ou expirado" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Hash and update
      const hashed = hashSync(newPassword);
      const { error: updateError } = await supabaseAdmin
        .from("usuarios")
        .update({ senha: hashed })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Mark code as used
      await supabaseAdmin.from("password_resets").update({ used: true }).eq("id", resetEntry.id);

      return new Response(JSON.stringify({ success: true, message: "Senha alterada com sucesso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
