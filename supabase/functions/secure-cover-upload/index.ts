import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const BUCKET = "novel-covers";

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse(500, { error: "Missing environment configuration" });
    }

    const formData = await req.formData();
    const adminToken = formData.get("token");
    const file = formData.get("file");

    if (!adminToken || typeof adminToken !== "string") {
      return jsonResponse(401, { error: "Admin token is required" });
    }
    if (!file || !(file instanceof File)) {
      return jsonResponse(400, { error: "File is required" });
    }

    // Validate file type and size
    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonResponse(400, { error: "Unsupported file type. Only JPEG, PNG, and WebP are allowed." });
    }
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse(400, { error: "File is too large. Maximum size is 5 MB." });
    }

    // Verify admin token using the existing RPC
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: verifyData, error: verifyError } = await anonClient.rpc("admin_verify_token", {
      p_token: adminToken,
    });

    if (verifyError || !verifyData || !verifyData.valid) {
      return jsonResponse(401, { error: "Invalid or expired admin token" });
    }

    // Upload with service role key (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(filename, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      return jsonResponse(500, { error: uploadError.message });
    }

    const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(filename);

    return jsonResponse(200, { url: urlData.publicUrl });
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
