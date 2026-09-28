import type { SeedQuestion } from "./_builder";
import geographie from "./geographie";
import france from "./france";
import monde from "./monde";
import histoire from "./histoire";
import personnages from "./personnages";
import sciences from "./sciences";
import corpsHumain from "./corps-humain";
import espace from "./espace";
import animaux from "./animaux";
import nature from "./nature";
import sport from "./sport";
import football from "./football";
import basket from "./basket";
import tennis from "./tennis";
import automobile from "./automobile";
import cinema from "./cinema";
import series from "./series";
import musique from "./musique";
import jeuxVideo from "./jeux-video";
import technologie from "./technologie";
import cuisine from "./cuisine";
import litterature from "./litterature";
import art from "./art";
import economie from "./economie";
import cultureGenerale from "./culture-generale";
import vieQuotidienne from "./vie-quotidienne";
import insolite from "./insolite";
import pieges from "./pieges";
import records from "./records";
import voyages from "./voyages";

/** Base initiale de BLIND QUIZZ : questions rédigées à la main, chargées au premier démarrage. */
export const SEED_QUESTIONS: SeedQuestion[] = [
  ...geographie, ...france, ...monde, ...histoire, ...personnages, ...sciences, ...corpsHumain, ...espace,
  ...animaux, ...nature, ...sport, ...football, ...basket, ...tennis, ...automobile, ...cinema, ...series,
  ...musique, ...jeuxVideo, ...technologie, ...cuisine, ...litterature, ...art, ...economie, ...cultureGenerale,
  ...vieQuotidienne, ...insolite, ...pieges, ...records, ...voyages,
];

export type { SeedQuestion };
