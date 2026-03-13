import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, password, userId, loginStr, sessionToken: bodySessionToken } = body;

    if (action === "login") {
      if (!loginStr || !password) {
        return new Response(JSON.stringify({ error: "Missing credentials" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Find user by login (case-insensitive)
      const { data: user, error } = await supabaseAdmin
        .from("usuarios")
        .select("*")
        .ilike("login", loginStr.trim())
        .eq("ativo", true)
        .maybeSingle();

      if (error || !user) {
        return new Response(JSON.stringify({ user: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Plain text password comparison
      const valid = user.senha === password;

      if (!valid) {
        return new Response(JSON.stringify({ user: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a session token
      const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await supabaseAdmin.from("sessions").insert({
        user_id: user.id,
        token: sessionToken,
        expires_at: expiresAt,
      });

      // Update last_seen
      await supabaseAdmin
        .from("usuarios")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id);

      // Clean up expired sessions
      await supabaseAdmin
        .from("sessions")
        .delete()
        .eq("user_id", user.id)
        .lt("expires_at", new Date().toISOString());

      const { senha: _, ...safeUser } = user;
      return new Response(JSON.stringify({ user: safeUser, sessionToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "logout") {
      const token = bodySessionToken;
      if (!token) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: session } = await supabaseAdmin
        .from("sessions")
        .select("user_id")
        .eq("token", token)
        .maybeSingle();
      
      if (session) {
        await supabaseAdmin
          .from("usuarios")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", session.user_id);
      }

      await supabaseAdmin
        .from("sessions")
        .delete()
        .eq("token", token);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("hash-password error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
