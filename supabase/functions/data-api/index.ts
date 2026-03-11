import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables that this function is allowed to write to
const ALLOWED_TABLES = [
  "orcamentos", "pedidos", "ordens_servico",
  "clientes", "produtos", "estoque",
  "metas_vendedores", "fornecedores",
  "custos_tubos", "custos_eixos", "custos_conjuntos",
  "custos_revestimentos", "custos_encaixes",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, sessionToken, table, rows, ids, idField, filters } = await req.json();

    // Validate session
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Missing session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session } = await supabaseAdmin
      .from("sessions")
      .select("user_id, expires_at")
      .eq("token", sessionToken)
      .maybeSingle();

    if (!session || new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate table name against allowlist
    if (!table || !ALLOWED_TABLES.includes(table)) {
      return new Response(JSON.stringify({ error: "Invalid table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any = null;

    if (action === "upsert") {
      // Upsert rows (used by useDataSync and useCustos save operations)
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return new Response(JSON.stringify({ error: "No rows provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const conflict = idField || "id";
      // Batch upsert in chunks of 50
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const { error } = await supabaseAdmin
          .from(table)
          .upsert(chunk, { onConflict: conflict });
        if (error) {
          console.error(`[data-api] Upsert error for ${table}:`, error);
          return new Response(JSON.stringify({ error: "Upsert failed" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      result = { success: true, count: rows.length };

    } else if (action === "delete") {
      // Delete by IDs
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: "No IDs provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const field = idField || "id";
      for (const id of ids) {
        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .eq(field, id);
        if (error) {
          console.error(`[data-api] Delete error for ${table}:`, error);
        }
      }
      result = { success: true };

    } else if (action === "delete_filtered") {
      // Delete with filters (used by useCustos deleteAll operations)
      if (!filters || typeof filters !== "object") {
        return new Response(JSON.stringify({ error: "No filters provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = supabaseAdmin.from(table).delete();
      
      for (const [op, params] of Object.entries(filters as Record<string, any>)) {
        if (op === "neq") {
          query = query.neq(params.column, params.value);
        } else if (op === "ilike") {
          query = query.ilike(params.column, params.value);
        }
      }

      const { error } = await query;
      if (error) {
        console.error(`[data-api] Delete filtered error for ${table}:`, error);
        return new Response(JSON.stringify({ error: "Delete failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = { success: true };

    } else if (action === "insert") {
      // Single row insert (used by useCustos)
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return new Response(JSON.stringify({ error: "No rows provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin.from(table).insert(rows);
      if (error) {
        console.error(`[data-api] Insert error for ${table}:`, error);
        return new Response(JSON.stringify({ error: "Insert failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = { success: true };

    } else if (action === "update") {
      // Single row update (used by useCustos)
      if (!rows || rows.length === 0 || !ids || ids.length === 0) {
        return new Response(JSON.stringify({ error: "Missing rows or ids" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from(table)
        .update(rows[0])
        .eq(idField || "id", ids[0]);
      if (error) {
        console.error(`[data-api] Update error for ${table}:`, error);
        return new Response(JSON.stringify({ error: "Update failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      result = { success: true };

    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[data-api] Error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
