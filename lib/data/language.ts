export const APP_LANGUAGES = ["id", "en"] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && APP_LANGUAGES.includes(value as AppLanguage);
}

export function normalizeAppLanguage(value: unknown): AppLanguage {
  return isAppLanguage(value) ? value : "id";
}

export function languageName(language: AppLanguage): string {
  return language === "en" ? "English" : "Bahasa Indonesia";
}
