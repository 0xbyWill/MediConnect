export type DemoLoginRole = 'doctor' | 'secretary' | 'manager' | 'patient';

export interface DemoLoginPreset {
  role: DemoLoginRole;
  email: string;
  password: string;
}

function readEnv(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requireEnv(key: string, value: unknown): string {
  const envValue = readEnv(value);
  if (!envValue) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${key}`);
  }
  return envValue;
}

function readBooleanEnv(value: unknown): boolean {
  return ['1', 'true', 'yes', 'on'].includes(readEnv(value).toLowerCase());
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function createDemoPreset(
  role: DemoLoginRole,
  emailValue: unknown,
  passwordValue: unknown,
): DemoLoginPreset | null {
  const email = readEnv(emailValue).toLowerCase();
  const password = readEnv(passwordValue);
  return email && password ? { role, email, password } : null;
}

export const appEnv = Object.freeze({
  appEnvironment: readEnv(import.meta.env.VITE_APP_ENV) || import.meta.env.MODE,
  supabaseUrl: normalizeBaseUrl(requireEnv('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL)),
  supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
  demoLoginEnabled: import.meta.env.DEV && readBooleanEnv(import.meta.env.VITE_DEMO_LOGIN_ENABLED),
});

export const demoLoginPresets = Object.freeze(
  appEnv.demoLoginEnabled
    ? [
        createDemoPreset('doctor', import.meta.env.VITE_DEMO_DOCTOR_EMAIL, import.meta.env.VITE_DEMO_DOCTOR_PASSWORD),
        createDemoPreset('secretary', import.meta.env.VITE_DEMO_SECRETARY_EMAIL, import.meta.env.VITE_DEMO_SECRETARY_PASSWORD),
        createDemoPreset('manager', import.meta.env.VITE_DEMO_MANAGER_EMAIL, import.meta.env.VITE_DEMO_MANAGER_PASSWORD),
        createDemoPreset('patient', import.meta.env.VITE_DEMO_PATIENT_EMAIL, import.meta.env.VITE_DEMO_PATIENT_PASSWORD),
      ].filter((preset): preset is DemoLoginPreset => Boolean(preset))
    : [],
);
