import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTH_EMAIL_DOMAIN = "rollerport.app";

function makeAuthEmail(login: string): string {
  return `${login.toLowerCase().replace(/[^a-z0-9]/g, "_")}@${AUTH_EMAIL_DOMAIN}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, ...params } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is authenticated and is master
    const authHeader = req.headers.get("Authorization");
    let callerId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        // Find the usuarios profile linked to this auth user
        const { data: profile } = await supabaseAdmin
          .from("usuarios")
          .select("id, nivel")
          .eq("auth_id", user.id)
          .maybeSingle();
        if (profile?.nivel === "master") {
          callerId = profile.id;
        }
      }
    }

    if (!callerId) {
      return new Response(JSON.stringify({ error: "Only master users can manage users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CREATE USER ──
    if (action === "create_user") {
      const { userData } = params;
      if (!userData?.login || !userData?.senha) {
        return new Response(JSON.stringify({ error: "Login and password required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate password for non-master
      if (userData.nivel !== "master" && !/^\d{1,8}$/.test(userData.senha.trim())) {
        return new Response(
          JSON.stringify({ error: "Senha para usuários comuns deve conter apenas números (máx. 8 dígitos)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const authEmail = makeAuthEmail(userData.login);

      // Create Supabase Auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password: userData.senha.trim(),
        email_confirm: true,
      });

      if (authError) {
        console.error("Auth create error:", authError);
        return new Response(JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create profile in usuarios table
      const profile: Record<string, any> = {
        auth_id: authUser.user.id,
        nome: userData.nome || "",
        email: userData.email || "",
        telefone: userData.telefone || "",
        whatsapp: userData.whatsapp || "",
        login: userData.login,
        senha: userData.senha.trim(), // keep for display purposes
        nivel: userData.nivel || "Vendas",
        genero: userData.genero || null,
        ativo: userData.ativo !== undefined ? userData.ativo : true,
        foto: userData.foto || null,
        permissoes: userData.permissoes,
      };

      const { error: profileError } = await supabaseAdmin.from("usuarios").insert(profile);
      if (profileError) {
        // Rollback: delete auth user
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        console.error("Profile insert error:", profileError);
        return new Response(JSON.stringify({ error: "Failed to create user profile" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, userId: authUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE USER ──
    if (action === "update_user") {
      const { userData } = params;
      if (!userData?.id) {
        return new Response(JSON.stringify({ error: "Missing user id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get current profile to find auth_id
      const { data: existing } = await supabaseAdmin
        .from("usuarios")
        .select("auth_id, login")
        .eq("id", userData.id)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const profilePayload: Record<string, any> = {
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

      // Update password in Supabase Auth if provided
      if (userData.senha && userData.senha.trim() !== "" && userData.senha !== "••••••") {
        const trimmedPass = userData.senha.trim();
        if (userData.nivel !== "master" && !/^\d{1,8}$/.test(trimmedPass)) {
          return new Response(
            JSON.stringify({ error: "Senha para usuários comuns deve conter apenas números (máx. 8 dígitos)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        profilePayload.senha = trimmedPass;

        if (existing.auth_id) {
          const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.auth_id, {
            password: trimmedPass,
          });
          if (authUpdateErr) {
            console.error("Auth password update error:", authUpdateErr);
          }
        }
      }

      // If login changed, update auth email too
      if (userData.login !== existing.login && existing.auth_id) {
        const newAuthEmail = makeAuthEmail(userData.login);
        await supabaseAdmin.auth.admin.updateUserById(existing.auth_id, {
          email: newAuthEmail,
          email_confirm: true,
        });
      }

      const { error: updateErr } = await supabaseAdmin
        .from("usuarios")
        .update(profilePayload)
        .eq("id", userData.id);

      if (updateErr) {
        console.error("Profile update error:", updateErr);
        return new Response(JSON.stringify({ error: "Failed to update user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE USER ──
    if (action === "delete_user") {
      const { userId: targetId } = params;
      if (!targetId) {
        return new Response(JSON.stringify({ error: "Missing userId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: target } = await supabaseAdmin
        .from("usuarios")
        .select("nivel, auth_id")
        .eq("id", targetId)
        .maybeSingle();

      if (target?.nivel === "master") {
        return new Response(JSON.stringify({ error: "Cannot delete master user" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete auth user (this cascades if FK is set, but we also delete profile)
      if (target?.auth_id) {
        await supabaseAdmin.auth.admin.deleteUser(target.auth_id);
      }

      const { error } = await supabaseAdmin.from("usuarios").delete().eq("id", targetId);
      if (error) {
        return new Response(JSON.stringify({ error: "Failed to delete user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET CREDENTIALS ──
    if (action === "get_user_credentials") {
      const { userId: targetId } = params;
      const { data: targetUser } = await supabaseAdmin
        .from("usuarios")
        .select("senha")
        .eq("id", targetId)
        .maybeSingle();

      if (!targetUser) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ password: targetUser.senha, isPlain: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GENERATE TEMP PASSWORD ──
    if (action === "generate_temp_password") {
      const { userId: targetId } = params;
      const tempPassword = Math.floor(10000000 + Math.random() * 90000000).toString();

      const { data: target } = await supabaseAdmin
        .from("usuarios")
        .select("auth_id")
        .eq("id", targetId)
        .maybeSingle();

      // Update in auth
      if (target?.auth_id) {
        await supabaseAdmin.auth.admin.updateUserById(target.auth_id, {
          password: tempPassword,
        });
      }

      // Update in profile
      const { error } = await supabaseAdmin
        .from("usuarios")
        .update({ senha: tempPassword })
        .eq("id", targetId);

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to update password" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ tempPassword }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LOOKUP LOGIN → AUTH EMAIL ──
    if (action === "lookup_login") {
      const { loginStr } = params;
      if (!loginStr) {
        return new Response(JSON.stringify({ error: "Missing loginStr" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: user } = await supabaseAdmin
        .from("usuarios")
        .select("id, login, auth_id, ativo")
        .ilike("login", loginStr.trim())
        .eq("ativo", true)
        .maybeSingle();

      if (!user || !user.auth_id) {
        return new Response(JSON.stringify({ found: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authEmail = makeAuthEmail(user.login);
      return new Response(JSON.stringify({ found: true, authEmail, userId: user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── EXPORT BACKUP ──
    if (action === "export_backup") {
      const TABLES = [
        "usuarios", "clientes", "custos_tubos", "custos_eixos", "custos_conjuntos",
        "custos_encaixes", "custos_revestimentos", "estoque", "fornecedores",
        "metas_vendedores", "produtos", "orcamentos", "pedidos", "ordens_servico",
        "chat_messages", "sessions",
      ];
      const backupData: Record<string, any[]> = {};
      for (const table of TABLES) {
        const { data, error } = await supabaseAdmin.from(table).select("*");
        if (error) {
          return new Response(JSON.stringify({ error: `Failed to export ${table}: ${error.message}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        backupData[table] = data || [];
      }
      return new Response(JSON.stringify({ backupData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── IMPORT BACKUP ──
    if (action === "import_backup") {
      const { backupData } = params;
      if (!backupData) {
        return new Response(JSON.stringify({ error: "Missing backupData" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const TABLES = [
        "usuarios", "clientes", "custos_tubos", "custos_eixos", "custos_conjuntos",
        "custos_encaixes", "custos_revestimentos", "estoque", "fornecedores",
        "metas_vendedores", "produtos", "orcamentos", "pedidos", "ordens_servico",
        "chat_messages", "sessions",
      ];
      const results: Record<string, string> = {};
      for (const table of TABLES) {
        const data = backupData[table];
        if (data && data.length > 0) {
          const { error } = await supabaseAdmin.from(table).upsert(data);
          if (error) {
            return new Response(JSON.stringify({ error: `Failed to import ${table}: ${error.message}` }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          results[table] = `Successfully imported ${data.length} rows`;
        } else {
          results[table] = "No data to import";
        }
      }
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auth-admin error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
