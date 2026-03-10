import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, sessionToken, ...params } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate session
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Missing session token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sess } = await supabaseAdmin
      .from("sessions")
      .select("user_id, expires_at")
      .eq("token", sessionToken)
      .maybeSingle();

    if (!sess || new Date(sess.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "migrate_photos") {
      // Migrate all base64 photos to Storage
      const { data: users, error } = await supabaseAdmin
        .from("usuarios")
        .select("id, foto")
        .not("foto", "is", null);

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch users" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let migrated = 0;
      let skipped = 0;

      for (const user of (users || [])) {
        if (!user.foto || !user.foto.startsWith("data:image")) {
          skipped++;
          continue;
        }

        try {
          // Parse base64 data URI
          const matches = user.foto.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) { skipped++; continue; }

          const contentType = matches[1];
          const base64Data = matches[2];
          const ext = contentType.split("/")[1] || "png";
          const filePath = `${user.id}/avatar.${ext}`;

          // Decode base64
          const binaryStr = atob(base64Data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          // Upload to storage
          const { error: uploadError } = await supabaseAdmin.storage
            .from("avatars")
            .upload(filePath, bytes.buffer, {
              contentType,
              upsert: true,
            });

          if (uploadError) {
            console.error(`Upload error for user ${user.id}:`, uploadError);
            continue;
          }

          // Get public URL
          const { data: urlData } = supabaseAdmin.storage
            .from("avatars")
            .getPublicUrl(filePath);

          // Update user with storage URL instead of base64
          await supabaseAdmin
            .from("usuarios")
            .update({ foto: urlData.publicUrl })
            .eq("id", user.id);

          migrated++;
        } catch (e) {
          console.error(`Migration error for user ${user.id}:`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, migrated, skipped }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upload_avatar") {
      const { userId, file_base64, content_type } = params;
      if (!userId || !file_base64) {
        return new Response(JSON.stringify({ error: "Missing data" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ext = (content_type || "image/png").split("/")[1] || "png";
      const filePath = `${userId}/avatar.${ext}`;

      const binaryStr = atob(file_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const { error: uploadError } = await supabaseAdmin.storage
        .from("avatars")
        .upload(filePath, bytes.buffer, {
          contentType: content_type || "image/png",
          upsert: true,
        });

      if (uploadError) {
        return new Response(JSON.stringify({ error: "Upload failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: urlData } = supabaseAdmin.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update user foto with URL
      await supabaseAdmin
        .from("usuarios")
        .update({ foto: urlData.publicUrl })
        .eq("id", userId);

      return new Response(JSON.stringify({ success: true, url: urlData.publicUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("avatar-api error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
