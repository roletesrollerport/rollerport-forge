import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function validateSession(supabaseAdmin: any, sessionToken: string): Promise<string | null> {
  if (!sessionToken) return null;
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("user_id, expires_at")
    .eq("token", sessionToken)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    await supabaseAdmin.from("sessions").delete().eq("token", sessionToken);
    return null;
  }
  return data.user_id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, sessionToken, ...params } = body;

    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Missing session token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userId = await validateSession(supabaseAdmin, sessionToken);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify requester is master
    const { data: requester } = await supabaseAdmin
      .from("usuarios")
      .select("id, nivel, ativo")
      .eq("id", userId)
      .eq("ativo", true)
      .maybeSingle();

    if (!requester || requester.nivel !== "master") {
      return new Response(JSON.stringify({ error: "Only master users can manage users" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save_user") {
      const { userData } = params;
      if (!userData || !userData.login) {
        return new Response(JSON.stringify({ error: "Missing user data" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload: Record<string, any> = {
        nome: userData.nome,
        email: userData.email,
        telefone: userData.telefone,
        whatsapp: userData.whatsapp,
        login: userData.login,
        nivel: userData.nivel,
        genero: userData.genero || null,
        ativo: userData.ativo,
        foto: userData.foto || null,
        permissoes: userData.permissoes,
      };

      // Handle password - only update if provided and non-empty
      if (userData.senha && userData.senha.trim() !== "") {
        if (!userData.senha.startsWith("$2")) {
          payload.senha = hashSync(userData.senha);
        } else {
          payload.senha = userData.senha;
        }
      }

      if (userData.id) {
        const { error } = await supabaseAdmin.from("usuarios").update(payload).eq("id", userData.id);
        if (error) {
          console.error("Update error:", error);
          return new Response(JSON.stringify({ error: "Failed to update user" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        if (!payload.senha) {
          return new Response(JSON.stringify({ error: "Password required for new user" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error } = await supabaseAdmin.from("usuarios").insert(payload);
        if (error) {
          console.error("Insert error:", error);
          return new Response(JSON.stringify({ error: "Failed to create user" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      const { userId: targetId } = params;
      if (!targetId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent deleting master users
      const { data: target } = await supabaseAdmin
        .from("usuarios")
        .select("nivel")
        .eq("id", targetId)
        .maybeSingle();

      if (target?.nivel === "master") {
        return new Response(JSON.stringify({ error: "Cannot delete master user" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.from("usuarios").delete().eq("id", targetId);
      if (error) {
        return new Response(JSON.stringify({ error: "Failed to delete user" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("user-api error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
