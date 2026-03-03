import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hash, compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, password, hashedPassword, userId, loginStr } = await req.json();

    if (action === "hash") {
      // Hash a password
      if (!password || typeof password !== "string" || password.length < 1 || password.length > 128) {
        return new Response(JSON.stringify({ error: "Invalid password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hashed = await hash(password);
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
      const valid = await compare(password, hashedPassword);
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

      // Check if password is hashed (bcrypt hashes start with $2)
      let valid = false;
      if (user.senha.startsWith("$2")) {
        valid = await compare(password, user.senha);
      } else {
        // Legacy plaintext comparison (for migration period)
        valid = user.senha === password;
        if (valid) {
          // Auto-migrate: hash the plaintext password
          const hashed = await hash(password);
          await supabaseAdmin
            .from("usuarios")
            .update({ senha: hashed })
            .eq("id", user.id);
          user.senha = hashed;
        }
      }

      if (!valid) {
        return new Response(JSON.stringify({ user: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return user without senha
      const { senha: _, ...safeUser } = user;
      return new Response(JSON.stringify({ user: safeUser }), {
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
