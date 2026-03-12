import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Safety: only allow if no master user with auth_id exists
    const { data: existingMaster } = await supabaseAdmin
      .from("usuarios")
      .select("id, auth_id")
      .eq("nivel", "master")
      .not("auth_id", "is", null)
      .maybeSingle();

    if (existingMaster) {
      return new Response(JSON.stringify({ error: "Master user already bootstrapped", id: existingMaster.id }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const login = "administrador";
    const password = "$Leds@10";
    const authEmail = `${login}@rollerport.app`;

    // Create Supabase Auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if there's an existing master profile to update
    const { data: existingProfile } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("nivel", "master")
      .maybeSingle();

    if (existingProfile) {
      // Update existing master profile with auth_id
      await supabaseAdmin
        .from("usuarios")
        .update({ auth_id: authUser.user.id, senha: password, login })
        .eq("id", existingProfile.id);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Linked existing master profile to new auth user",
        profileId: existingProfile.id,
        authId: authUser.user.id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new profile
    const allModules = ["inicio", "custos", "clientes", "produtos", "orcamentos", "pedidos", "producao", "estoque", "chat", "ia", "usuarios"];
    const { error: profileError } = await supabaseAdmin.from("usuarios").insert({
      auth_id: authUser.user.id,
      nome: "Administrador",
      email: "",
      login,
      senha: password,
      nivel: "master",
      ativo: true,
      permissoes: { ver: allModules, editar: allModules },
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Master user created",
      authId: authUser.user.id 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
