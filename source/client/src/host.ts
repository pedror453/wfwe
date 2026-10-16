export interface KermoHost {
  serverUrl: string;
  appVersion: string;
  platform: string;
  portable: boolean;
  electron?: string;
}

declare global {
  interface Window {
    kermoHost?: KermoHost | null;
  }
}

/** Налаштування від оболонки Windows-програми; у браузері — null. */
export const host: KermoHost | null = typeof window !== 'undefined' ? (window.kermoHost ?? null) : null;
export const isDesktop = host !== null;
