// Spanish story translations for Arkstage.

import SR_ST_1_ES from "./SR-ST-1_Luna_Cae_ES.txt?raw";
import SR_1_ES from "./SR-1_Salida_de_la_Luna_ES.txt?raw";

const spanishStories: Record<string, string> = {
  "SR-ST-1_月落/NBT": SR_ST_1_ES,
  "SR-1_月出/BEG": SR_1_ES,
};

export function getSpanishStory(pageTitle: string): string | null {
  return spanishStories[pageTitle] ?? null;
}
