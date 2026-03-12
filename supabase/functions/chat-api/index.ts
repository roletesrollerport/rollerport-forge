import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Resolve the caller's profile ID from Supabase Auth JWT or legacy session token.
 */
async function resolveUserId(req: Request, supabaseAdmin: any, body: any): Promise<string | null> {
  // Try Supabase Auth JWT from Authorization header
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from("usuarios")
        .select("id")
        .eq("auth_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (profile) return profile.id;
    }
  }

  // Fallback: legacy custom session token from body
  const { sessionToken } = body;
  if (sessionToken) {
    const { data } = await supabaseAdmin
      .from("sessions")
      .select("user_id, expires_at")
      .eq("token", sessionToken)
      .maybeSingle();
    if (data && new Date(data.expires_at) > new Date()) {
      return data.user_id;
    }
  }

  return null;
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

    const userId = await resolveUserId(req, supabaseAdmin, body);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is active
    const { data: user } = await supabaseAdmin
      .from("usuarios")
      .select("id, nivel, ativo")
      .eq("id", userId)
      .eq("ativo", true)
      .maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found or inactive" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_message") {
      const { receiver_id, content, message_type, file_url, file_name, file_size, audio_duration } = params;
      
      if (!receiver_id || !message_type) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabaseAdmin.from("chat_messages").insert({
        sender_id: userId,
        receiver_id,
        content: content || null,
        message_type,
        file_url: file_url || null,
        file_name: file_name || null,
        file_size: file_size || null,
        audio_duration: audio_duration || null,
      }).select().single();

      if (error) {
        console.error("Insert error:", error);
        return new Response(JSON.stringify({ error: "Failed to send message" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ message: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_message") {
      const { message_id, for_all } = params;
      if (!message_id) {
        return new Response(JSON.stringify({ error: "Missing message_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: msg } = await supabaseAdmin
        .from("chat_messages")
        .select("sender_id, receiver_id")
        .eq("id", message_id)
        .maybeSingle();

      if (!msg) {
        return new Response(JSON.stringify({ error: "Message not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (msg.sender_id !== userId && msg.receiver_id !== userId) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updatePayload: Record<string, any> = {
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      };

      if (for_all && msg.sender_id === userId) {
        updatePayload.deleted_for_all = true;
      } else {
        updatePayload.deleted_for_sender = true;
      }

      const { error } = await supabaseAdmin
        .from("chat_messages")
        .update(updatePayload)
        .eq("id", message_id);

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to delete message" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "validate_session") {
      await supabaseAdmin.from("usuarios").update({ last_seen: new Date().toISOString() }).eq("id", userId);
      return new Response(JSON.stringify({ user_id: userId, valid: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "heartbeat") {
      await supabaseAdmin.from("usuarios").update({ last_seen: new Date().toISOString() }).eq("id", userId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upload_file") {
      const { file_base64, file_path, content_type } = params;
      if (!file_base64 || !file_path) {
        return new Response(JSON.stringify({ error: "Missing file data" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!file_path.startsWith(`${userId}/`)) {
        return new Response(JSON.stringify({ error: "Cannot upload to other user's folder" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const binaryStr = atob(file_base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const { error: uploadError } = await supabaseAdmin.storage
        .from("chat-files")
        .upload(file_path, bytes.buffer, { contentType: content_type || "application/octet-stream" });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return new Response(JSON.stringify({ error: "Upload failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, path: file_path }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_signed_url") {
      const { file_path } = params;
      if (!file_path) {
        return new Response(JSON.stringify({ error: "Missing file_path" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from("chat-files")
        .createSignedUrl(file_path, 3600);

      if (signedError) {
        return new Response(JSON.stringify({ error: "Failed to generate URL" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ url: signedData.signedUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-api error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
