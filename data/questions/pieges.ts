import { build } from "./_builder";

export default build("pieges", [
  ["Combien de mois de l'année comptent 28 jours ?", "12", ["1", "2", "0"], "Tous les mois ont au moins 28 jours ! Février est simplement le seul à n'en avoir que 28 (ou 29).", 2, ["douze", "tous"]],
  ["De quelle couleur est la boîte noire d'un avion ?", "Orange", ["Noire", "Rouge", "Jaune"], "Elle est orange vif pour être facilement repérable après un accident.", 2, ["orange vif"]],
  ["Dans quel pays se trouve la ville de Panama ?", "Le Panama", ["La Colombie", "Le Costa Rica", "Le Mexique"], "Panama est la capitale du Panama, pays du célèbre canal.", 1, ["Panama"]],
  ["Combien d'animaux de chaque espèce Moïse a-t-il fait monter dans l'arche ?", "Aucun, c'était Noé", ["2", "1", "7"], "Piège classique : c'est Noé, et non Moïse, qui a construit l'arche selon la Bible.", 2, ["aucun", "0", "zero", "Noe", "c'etait Noe"]],
  ["Quel pays est le premier producteur mondial de kiwis ?", "La Chine", ["La Nouvelle-Zélande", "L'Italie", "Le Chili"], "Piège : le kiwi est originaire de Chine, où il s'appelait « groseille de Chine ». Les Néo-Zélandais l'ont rebaptisé pour l'exporter.", 3, ["Chine"]],
  ["Quel animal est le plus mortel pour l'humain chaque année ?", "Le moustique", ["Le requin", "Le serpent", "Le crocodile"], "En transmettant le paludisme et la dengue, le moustique cause des centaines de milliers de morts par an ; le requin, une dizaine.", 1, ["moustique", "moustiques"]],
  ["Si vous doublez le deuxième d'une course, quelle place occupez-vous ?", "Deuxième", ["Premier", "Troisième", "Ça dépend"], "Vous prenez sa place : vous êtes deuxième, pas premier !", 2, ["2", "2e", "second", "deuxieme"]],
  ["Combien de temps a duré la guerre de Trente Ans ?", "30 ans", ["100 ans", "25 ans", "32 ans"], "Cette fois, pas de piège : elle a bien duré de 1618 à 1648.", 3, ["30", "trente ans"]],
  ["De quel animal le « ver de terre » est-il le plus proche ?", "La sangsue", ["Le serpent", "La chenille", "L'escargot"], "Les vers de terre et les sangsues sont des annélides, des vers segmentés.", 4, ["sangsue"]],
  ["Quel est le pays d'origine du croissant ?", "L'Autriche", ["La France", "La Suisse", "La Belgique"], "Le croissant descend du « Kipferl » viennois, introduit à Paris au XIXe siècle.", 3, ["Autriche", "Vienne"]],
  ["Quel est le mois où les gens dorment le moins ?", "Février", ["Juin", "Décembre", "Juillet"], "Blague classique : février est le mois le plus court, donc celui où l'on dort le moins de nuits !", 3, ["fevrier"]],
  ["Où se trouve le plus grand désert du monde ?", "En Antarctique", ["Au Sahara", "En Arabie", "En Mongolie"], "Un désert se définit par ses faibles précipitations : l'Antarctique, glacé, est le plus grand désert du monde.", 3, ["Antarctique", "Antarctica", "pole sud"]],
  ["Combien de fois peut-on soustraire 10 de 100 ?", "Une seule fois", ["10 fois", "9 fois", "Une infinité"], "Après la première soustraction, on soustrait 10 de 90, et non plus de 100 !", 3, ["une", "1", "une fois"]],
  ["Quelle est la couleur du cheval blanc d'Henri IV ?", "Blanc", ["Gris", "Noir", "Alezan"], "Question culte ! Même si, historiquement, le cheval d'Henri IV aurait été gris.", 1, ["blanche"]],
  ["Quelle planète est la plus proche de la Terre en moyenne sur le long terme ?", "Mercure", ["Vénus", "Mars", "La Lune"], "Contre-intuitif : Vénus passe plus près, mais Mercure, qui reste près du Soleil, est en moyenne la plus proche de toutes les planètes.", 4],
  ["Qui a découvert l'Amérique en premier, bien avant Christophe Colomb ?", "Les Vikings", ["Les Chinois", "Les Portugais", "Les Irlandais"], "Vers l'an 1000, Leif Erikson a atteint Terre-Neuve ; mais les peuples autochtones y vivaient depuis des millénaires !", 3, ["Vikings", "Leif Erikson", "Erikson"]],
  ["Combien de pattes a un mille-pattes le plus souvent ?", "Moins de 400", ["Exactement 1 000", "Environ 750", "Plus de 1 000"], "La plupart en ont entre 30 et 400. Une seule espèce découverte en 2021 dépasse les 1 000 pattes.", 4, ["moins de 400", "moins de mille", "moins de 1000"]],
]);
