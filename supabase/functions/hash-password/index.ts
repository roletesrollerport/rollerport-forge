import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { compareSync } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, password, hashedPassword, userId, loginStr, sessionToken: bodySessionToken } = body;

    if (action === "hash") {
      // Hash a password
      if (!password || typeof password !== "string" || password.length < 1 || password.length > 128) {
        return new Response(JSON.stringify({ error: "Invalid password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hashed = hashSync(password);
      return new Response(JSON.stringify({ hash: hashed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      // Verify password against hash
      if (!password || !hashedPassword) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const valid = compareSync(password, hashedPassword);
      return new Response(JSON.stringify({ valid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "login") {
      // Server-side login: find user and verify password
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

      // Support both plain text and legacy bcrypt hashed passwords
      let valid = false;
      if (user.senha.startsWith("$2")) {
        // Legacy bcrypt hash - compare and migrate to plain text
        valid = compareSync(password, user.senha);
        if (valid) {
          // Migrate to plain text
          await supabaseAdmin
            .from("usuarios")
            .update({ senha: password })
            .eq("id", user.id);
        }
      } else {
        valid = user.senha === password;
      }

      if (!valid) {
        return new Response(JSON.stringify({ user: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a session token
      const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

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

      // Clean up expired sessions for this user
      await supabaseAdmin
        .from("sessions")
        .delete()
        .eq("user_id", user.id)
        .lt("expires_at", new Date().toISOString());

      // Return user without senha, plus session token
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
