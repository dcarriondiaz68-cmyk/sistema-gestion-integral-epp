import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AdminUser {
  id: string;
  email: string;
}

async function getCallerProfile(req: Request, adminClient: ReturnType<typeof createClient>): Promise<{ role: string; id: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await adminClient.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  return { role: profile.role, id: profile.id, email: profile.email };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    const caller = await getCallerProfile(req, adminClient);
    if (!caller) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (caller.role !== "ADMINISTRADOR") {
      return new Response(JSON.stringify({ error: "Acceso denegado: se requiere rol ADMINISTRADOR" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action: string = body.action;

    switch (action) {
      case "create_user": {
        const { email, password, full_name, phone, role } = body as {
          email: string; password: string; full_name: string; phone?: string; role: string;
        };

        if (!email || !password || !full_name || !role) {
          return new Response(JSON.stringify({ error: "Faltan campos obligatorios" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (password.length < 8) {
          return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 8 caracteres" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (authError) {
          const msg = authError.message;
          if (msg.includes("already been registered") || msg.includes("already exists")) {
            return new Response(JSON.stringify({ error: "Ya existe una cuenta con este correo electrónico" }), {
              status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "Error al crear el usuario: " + msg }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const newUserId = authData.user.id;

        const { error: profileError } = await adminClient
          .from("profiles")
          .upsert({ id: newUserId, email, full_name, phone: phone || null, role, active: true })
          .eq("id", newUserId);

        if (profileError) {
          return new Response(JSON.stringify({ error: "Usuario creado en Auth pero error al crear perfil: " + profileError.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("audit_log").insert({
          user_id: caller.id,
          action: "Creación de usuario",
          module: "Users",
          record_id: newUserId,
          operation: "INSERT",
          details: { email, full_name, role, method: "direct" },
        });

        return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "invite_user": {
        const { email, full_name, phone, role } = body as {
          email: string; full_name: string; phone?: string; role: string;
        };

        if (!email || !full_name || !role) {
          return new Response(JSON.stringify({ error: "Faltan campos obligatorios" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);

        if (inviteError) {
          const msg = inviteError.message;
          if (msg.includes("already been registered") || msg.includes("already exists")) {
            return new Response(JSON.stringify({ error: "Ya existe una cuenta con este correo electrónico" }), {
              status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "Error al enviar la invitación: " + msg }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const newUserId = inviteData?.id;

        const { error: profileError } = await adminClient
          .from("profiles")
          .upsert({ id: newUserId, email, full_name, phone: phone || null, role, active: true })
          .eq("id", newUserId);

        if (profileError) {
          return new Response(JSON.stringify({ error: "Invitación enviada pero error al crear perfil: " + profileError.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("audit_log").insert({
          user_id: caller.id,
          action: "Invitación de usuario",
          module: "Users",
          record_id: newUserId,
          operation: "INSERT",
          details: { email, full_name, role, method: "invite" },
        });

        return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "ban_user": {
        const { user_id, email } = body as { user_id: string; email: string };

        if (!user_id) {
          return new Response(JSON.stringify({ error: "user_id es requerido" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (user_id === caller.id) {
          return new Response(JSON.stringify({ error: "No puedes desactivar tu propia cuenta" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: banError } = await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h",
        });

        if (banError) {
          return new Response(JSON.stringify({ error: "Error al suspender la cuenta: " + banError.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient
          .from("profiles")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("id", user_id);

        await adminClient.from("audit_log").insert({
          user_id: caller.id,
          action: "Desactivación de usuario",
          module: "Users",
          record_id: user_id,
          operation: "UPDATE",
          details: { email },
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "unban_user": {
        const { user_id, email } = body as { user_id: string; email: string };

        if (!user_id) {
          return new Response(JSON.stringify({ error: "user_id es requerido" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: unbanError } = await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        });

        if (unbanError) {
          return new Response(JSON.stringify({ error: "Error al reactivar la cuenta: " + unbanError.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient
          .from("profiles")
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq("id", user_id);

        await adminClient.from("audit_log").insert({
          user_id: caller.id,
          action: "Activación de usuario",
          module: "Users",
          record_id: user_id,
          operation: "UPDATE",
          details: { email },
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set_temp_password": {
        const { user_id, email, new_password } = body as {
          user_id: string; email: string; new_password: string;
        };

        if (!user_id || !new_password) {
          return new Response(JSON.stringify({ error: "user_id y new_password son requeridos" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (new_password.length < 8) {
          return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 8 caracteres" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (user_id === caller.id) {
          return new Response(JSON.stringify({ error: "No puedes cambiar tu propia contraseña desde aquí" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
          password: new_password,
        });

        if (updateError) {
          return new Response(JSON.stringify({ error: "Error al establecer la contraseña: " + updateError.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("audit_log").insert({
          user_id: caller.id,
          action: "Contraseña temporal establecida",
          module: "Users",
          record_id: user_id,
          operation: "UPDATE",
          details: { email },
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reset_password": {
        const { email } = body as { email: string };

        if (!email) {
          return new Response(JSON.stringify({ error: "email es requerido" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: resetError } = await adminClient.auth.admin.resetPasswordForEmail(email);

        if (resetError) {
          return new Response(JSON.stringify({ error: "Error al enviar el restablecimiento: " + resetError.message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await adminClient.from("audit_log").insert({
          user_id: caller.id,
          action: "Restablecimiento de contraseña",
          module: "Users",
          record_id: email,
          operation: "UPDATE",
          details: { email },
        });

        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Acción no válida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
