import { build } from "./_builder";

export default build("tennis", [
  ["Sur quelle surface se joue Roland-Garros ?", "La terre battue", ["Le gazon", "Le dur", "Le synthétique"], "Roland-Garros est le seul tournoi du Grand Chelem disputé sur terre battue.", 1, ["terre battue", "ocre"]],
  ["Quel joueur a remporté le plus de fois Roland-Garros ?", "Rafael Nadal", ["Novak Djokovic", "Björn Borg", "Roger Federer"], "Rafael Nadal y a triomphé 14 fois entre 2005 et 2022, un record inégalé.", 1, ["Nadal"]],
  ["Combien de tournois composent le Grand Chelem ?", "4", ["5", "3", "6"], "Open d'Australie, Roland-Garros, Wimbledon et US Open.", 1, ["quatre"]],
  ["Quel tournoi se joue sur gazon et impose une tenue blanche ?", "Wimbledon", ["L'US Open", "L'Open d'Australie", "Roland-Garros"], "Le dress code blanc de Wimbledon remonte aux années 1880.", 1],
  ["Comment dit-on « zéro » au tennis ?", "Zéro", ["Love", "Nul", "Blanc"], "Piège : en français, on dit bien « zéro » ! C'est en anglais qu'on dit « love ».", 3, ["zero", "0"]],
  ["Quel est le score après avoir gagné trois points dans un jeu (sans que l'adversaire marque) ?", "40", ["45", "30", "50"], "15, 30 puis 40 : l'origine de ce décompte reste débattue, peut-être liée aux quarts d'heure d'une horloge.", 1, ["40-0", "quarante"]],
  ["Quel joueur a remporté le plus de titres du Grand Chelem en simple messieurs ?", "Novak Djokovic", ["Rafael Nadal", "Roger Federer", "Pete Sampras"], "Novak Djokovic a remporté 24 titres du Grand Chelem, record masculin.", 1, ["Djokovic"]],
  ["Quel est le nom du dernier Français vainqueur de Roland-Garros en simple messieurs ?", "Yannick Noah", ["Henri Leconte", "Guy Forget", "Jo-Wilfried Tsonga"], "Yannick Noah a gagné en 1983 ; aucun Français ne l'a imité depuis.", 2, ["Noah"]],
  ["Comment s'appelle un service gagnant que l'adversaire ne touche pas ?", "Un ace", ["Un let", "Un smash", "Un lob"], "Le record d'aces en un match est de 113, par John Isner à Wimbledon en 2010.", 1, ["ace", "as"]],
  ["Quelle joueuse américaine a remporté 23 titres du Grand Chelem en simple ?", "Serena Williams", ["Venus Williams", "Steffi Graf", "Martina Navrátilová"], "Serena Williams a remporté son dernier Grand Chelem, l'Open d'Australie 2017, enceinte de deux mois.", 1, ["Serena"]],
  ["Combien de temps a duré le plus long match de l'histoire du tennis, Isner-Mahut à Wimbledon 2010 ?", "11 h 05", ["6 h 33", "8 h 11", "15 h 40"], "Joué sur trois jours, le cinquième set s'est terminé à 70 jeux à 68.", 4, ["11 heures", "11h05", "11 h"]],
  ["Quelle Française a remporté Wimbledon en 2013 ?", "Marion Bartoli", ["Amélie Mauresmo", "Caroline Garcia", "Mary Pierce"], "Marion Bartoli s'est imposée sans perdre un set, avant de prendre sa retraite quelques semaines plus tard.", 2, ["Bartoli"]],
  ["Dans quelle ville se joue l'Open d'Australie ?", "Melbourne", ["Sydney", "Brisbane", "Perth"], "Le tournoi se joue en janvier à Melbourne Park, en plein été austral.", 2],
  ["Quelle compétition oppose des équipes nationales masculines de tennis depuis 1900 ?", "La Coupe Davis", ["La Laver Cup", "La Hopman Cup", "La Billie Jean King Cup"], "La France l'a remportée dix fois, la dernière en 2017.", 2, ["Coupe Davis", "Davis Cup"]],
  ["Comment appelle-t-on le jeu décisif joué à 6 jeux partout ?", "Le tie-break", ["Le break", "Le deuce", "Le super set"], "Le tie-break se joue en 7 points gagnants, avec deux points d'écart.", 1, ["tie break", "jeu decisif"]],
]);
