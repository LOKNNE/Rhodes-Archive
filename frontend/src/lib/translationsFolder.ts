import { invoke } from "@tauri-apps/api/core";

export interface TranslationFileInfo {
  filename: string;
  page_title: string;
  bytes: number;
  language: string;
  characters: string[];
}

export const getTranslationsFolder = () => invoke<string>("translation_folder_path");
export const listTranslations = () => invoke<TranslationFileInfo[]>("list_translation_files");
export const loadTranslation = (pageTitle: string) =>
  invoke<string | null>("load_translation_for_title", { pageTitle });
export const openTranslationsFolder = () => invoke<void>("open_translation_folder");
