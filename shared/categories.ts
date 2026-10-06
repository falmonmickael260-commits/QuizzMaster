export interface CategoryInfo {
  id: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "geographie", label: "Géographie", emoji: "🌍" },
  { id: "france", label: "France", emoji: "🇫🇷" },
  { id: "monde", label: "Monde", emoji: "🌎" },
  { id: "histoire", label: "Histoire", emoji: "🏛️" },
  { id: "personnages", label: "Personnages historiques", emoji: "👑" },
  { id: "sciences", label: "Sciences", emoji: "🔬" },
  { id: "corps-humain", label: "Corps humain", emoji: "🧬" },
  { id: "espace", label: "Espace", emoji: "🌌" },
  { id: "animaux", label: "Animaux", emoji: "🐘" },
  { id: "nature", label: "Nature", emoji: "🌱" },
  { id: "sport", label: "Sport", emoji: "⚽" },
  { id: "football", label: "Football", emoji: "🥅" },
  { id: "basket", label: "Basket", emoji: "🏀" },
  { id: "tennis", label: "Tennis", emoji: "🎾" },
  { id: "automobile", label: "Automobile", emoji: "🏎️" },
  { id: "cinema", label: "Cinéma", emoji: "🎬" },
  { id: "disney", label: "Disney", emoji: "🏰" },
  { id: "series", label: "Séries & Télévision", emoji: "📺" },
  { id: "musique", label: "Musique", emoji: "🎵" },
  { id: "jeux-video", label: "Jeux vidéo", emoji: "🎮" },
  { id: "technologie", label: "Technologie & Internet", emoji: "💻" },
  { id: "cuisine", label: "Cuisine & Gastronomie", emoji: "🍕" },
  { id: "litterature", label: "Littérature", emoji: "📚" },
  { id: "art", label: "Art & Architecture", emoji: "🎨" },
  { id: "economie", label: "Économie & Marques", emoji: "💰" },
  { id: "culture-generale", label: "Culture générale", emoji: "🧠" },
  { id: "vie-quotidienne", label: "Vie quotidienne", emoji: "🏠" },
  { id: "insolite", label: "Insolite", emoji: "😂" },
  { id: "pieges", label: "Questions pièges", emoji: "🤯" },
  { id: "records", label: "Records", emoji: "🏆" },
  { id: "voyages", label: "Voyages", emoji: "✈️" },
];

export const CATEGORY_BY_ID: Record<string, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
);

export function categoryLabel(id: string): string {
  const c = CATEGORY_BY_ID[id];
  return c ? `${c.emoji} ${c.label}` : id;
}

export const DIFFICULTY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Facile", color: "#2ee59d" },
  2: { label: "Moyen", color: "#ffd23f" },
  3: { label: "Difficile", color: "#ff9f1c" },
  4: { label: "Très difficile", color: "#ff3b5c" },
};
