import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate that the request comes from an active user via session token
    const { messages, mode, sessionToken } = await req.json();

    if (!sessionToken || typeof sessionToken !== "string") {
      return new Response(JSON.stringify({ error: "Unauthorized: missing session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify session exists and is valid
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("user_id, expires_at")
      .eq("token", sessionToken)
      .maybeSingle();

    if (sessionError || !session || new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user exists and is active
    const { data: user, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("id, ativo")
      .eq("id", session.user_id)
      .eq("ativo", true)
      .maybeSingle();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = mode === "ia" 
      ? `Você é a IA Rollerport, assistente técnico especializado em roletes para correia transportadora.
Você pode:
- Analisar documentos técnicos (PDF, Excel, Word)
- Gerar orçamentos automáticos baseados em especificações
- Responder dúvidas técnicas sobre roletes (RC, RR, RG, RI, RRA)
- Converter orçamentos externos para o formato Rollerport
- Auxiliar com desenhos técnicos
- Calcular custos de roletes com base nos materiais

Tipos de roletes:
- RC: Rolete de Carga
- RR: Rolete de Retorno
- RG: Rolete Guia
- RI: Rolete de Impacto
- RRA: Rolete de Retorno com Anéis

Fórmula do rolete:
Valor = (Tubo × comprimento tubo) + (Eixo × comprimento eixo) + Encaixe + Conjunto + (Spiraflex × comprimento eixo) + (Anéis × quantidade)
Resultado × multiplicador (padrão 1.8)

Sempre responda em português do Brasil de forma clara e técnica.`
      : `Você é o assistente do Chat Interno Rollerport. Ajude a equipe com comunicação e informações do sistema. Responda em português do Brasil de forma clara e objetiva.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
