import { supabase } from '@/lib/supabase';

function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('FetchError') || message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'No se pudo conectar con el servidor.';
  }
  return 'Ocurrió un error inesperado.';
}

export async function fetchLogoUrl(): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'logo_url')
    .maybeSingle();
  if (error) throw new Error(getErrorMessage(error));
  return data?.value ?? null;
}

export async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const fileName = `logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(fileName, file, { upsert: true });
  if (uploadError) throw new Error(getErrorMessage(uploadError));

  const { data: urlData } = supabase.storage
    .from('logos')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;
  if (!publicUrl) throw new Error('No se pudo obtener la URL pública del logo.');

  const { error: configError } = await supabase
    .from('app_config')
    .upsert(
      { key: 'logo_url', value: publicUrl },
      { onConflict: 'key' }
    );
  if (configError) throw new Error(getErrorMessage(configError));

  return publicUrl;
}

export async function removeLogo(): Promise<void> {
  const { error: configError } = await supabase
    .from('app_config')
    .delete()
    .eq('key', 'logo_url');
  if (configError) throw new Error(getErrorMessage(configError));
}
