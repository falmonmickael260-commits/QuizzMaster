import { build } from "./_builder";

// Lot de questions difficiles et très difficiles, pour les dernières manches.

export default [
  ...build("geographie", [
    ["Quel est le seul pays au monde traversé à la fois par l'équateur et par le tropique du Capricorne ?", "Le Brésil", ["L'Indonésie", "La République démocratique du Congo", "L'Équateur"], "L'équateur passe au nord du Brésil, près de l'embouchure de l'Amazone, et le tropique du Capricorne traverse São Paulo.", 4, ["Bresil"]],
    ["Quelle est la capitale du Kazakhstan ?", "Astana", ["Almaty", "Tachkent", "Bichkek"], "Almaty était la capitale jusqu'en 1997. Astana a changé plusieurs fois de nom, dont Noursoultan de 2019 à 2022.", 3, ["Noursoultan", "Nur-Sultan"]],
    ["Quel fleuve traverse le plus grand nombre de pays au monde ?", "Le Danube", ["Le Nil", "Le Rhin", "Le Niger"], "Le Danube traverse ou longe dix pays, de l'Allemagne jusqu'à la mer Noire, et quatre capitales.", 3, ["Danube"]],
    ["Quel est le pays le plus densément peuplé du monde ?", "Monaco", ["Singapour", "Le Bangladesh", "Le Vatican"], "Avec environ 38 000 habitants sur 2 km², Monaco dépasse les 18 000 habitants au km².", 3],
  ]),
  ...build("histoire", [
    ["En quelle année a eu lieu la bataille de Marignan ?", "1515", ["1415", "1525", "1498"], "Victoire de François Ier sur les Suisses, c'est l'une des dates les plus célèbres de l'histoire de France.", 2],
    ["Quel empereur romain a légalisé le christianisme par l'édit de Milan en 313 ?", "Constantin", ["Néron", "Théodose", "Dioclétien"], "Théodose fera du christianisme la religion officielle de l'Empire en 380.", 3, ["Constantin Ier", "Constantin le Grand"]],
    ["Quelle reine a régné le plus longtemps sur le Royaume-Uni ?", "Élisabeth II", ["Victoria", "Élisabeth Ire", "Anne"], "Élisabeth II a régné 70 ans, de 1952 à 2022, dépassant les 63 ans de règne de Victoria.", 2, ["Elisabeth II", "Elizabeth II", "Elisabeth 2"]],
    ["Quel traité a partagé le Nouveau Monde entre l'Espagne et le Portugal en 1494 ?", "Le traité de Tordesillas", ["Le traité de Saragosse", "Le traité d'Utrecht", "Le traité de Westphalie"], "Une ligne nord-sud fut tracée à 370 lieues à l'ouest du Cap-Vert : c'est pourquoi on parle portugais au Brésil.", 3, ["Tordesillas"]],
    ["Quel pays a été le premier à accorder le droit de vote aux femmes au niveau national, en 1893 ?", "La Nouvelle-Zélande", ["La Finlande", "La Norvège", "L'Australie"], "Les Néo-Zélandaises ont voté dès 1893 ; la Finlande est le premier pays européen, en 1906.", 4, ["Nouvelle-Zelande", "Nouvelle Zelande"]],
  ]),
  ...build("sciences", [
    ["Quel est le seul métal liquide à température ambiante ?", "Le mercure", ["Le gallium", "Le césium", "Le plomb"], "Le gallium fond à 29,8 °C : il fond dans la main, mais reste solide à 20 °C.", 3, ["mercure", "Hg"]],
    ["Quel scientifique a proposé en 1869 le tableau périodique des éléments ?", "Dmitri Mendeleïev", ["Antoine Lavoisier", "John Dalton", "Niels Bohr"], "Mendeleïev avait laissé des cases vides pour des éléments encore inconnus, dont il avait prédit les propriétés.", 3, ["Mendeleiev", "Mendeleïev"]],
    ["Combien de temps met environ la lumière de la Lune pour atteindre la Terre ?", "1,3 seconde", ["8 minutes", "13 secondes", "0,1 seconde"], "La Lune est à environ 384 000 km : la lumière parcourt cette distance en un peu plus d'une seconde.", 4, ["1,3 s", "1.3 s", "une seconde", "1 seconde", "1,3 seconde"]],
    ["Quel est l'élément chimique de numéro atomique 1 ?", "L'hydrogène", ["L'hélium", "Le lithium", "L'oxygène"], "L'hydrogène ne possède qu'un proton ; c'est le plus léger de tous les éléments.", 2, ["hydrogene", "H"]],
  ]),
  ...build("corps-humain", [
    ["Quel est le nom du plus long muscle du corps humain ?", "Le sartorius", ["Le grand fessier", "Le quadriceps", "Le biceps fémoral"], "Le sartorius (ou muscle couturier) part de la hanche et descend en diagonale jusqu'au genou.", 4, ["sartorius", "couturier", "muscle couturier"]],
    ["Combien de paires de chromosomes possède une cellule humaine ?", "23", ["46", "21", "24"], "Soit 46 chromosomes au total. Le syndrome de Down correspond à trois copies du chromosome 21.", 3, ["vingt-trois"]],
    ["Quelle glande, située à la base du cou, produit les hormones régulant le métabolisme ?", "La thyroïde", ["L'hypophyse", "La surrénale", "Le thymus"], "La thyroïde a la forme d'un papillon et produit notamment la thyroxine.", 2, ["thyroide", "glande thyroïde"]],
  ]),
  ...build("espace", [
    ["Quel est le nom du plus haut volcan connu du système solaire, situé sur Mars ?", "Olympus Mons", ["Mauna Kea", "Tharsis Montes", "Ascraeus Mons"], "Olympus Mons culmine à environ 22 km au-dessus de la plaine environnante, près de trois fois l'Everest.", 3, ["Olympus"]],
    ["Combien de temps dure une journée sur Vénus comparée à son année ?", "Plus longtemps que son année", ["Autant que son année", "La moitié de son année", "Un dixième de son année"], "Vénus tourne sur elle-même en 243 jours terrestres mais fait le tour du Soleil en 225 jours.", 4, ["plus longtemps", "plus longue"]],
    ["Quel astronome a découvert les quatre plus grandes lunes de Jupiter en 1610 ?", "Galilée", ["Johannes Kepler", "Nicolas Copernic", "Tycho Brahe"], "Io, Europe, Ganymède et Callisto sont appelées les « lunes galiléennes ».", 2, ["Galilee", "Galileo", "Galileo Galilei"]],
    ["Quelle sonde spatiale est l'objet humain le plus éloigné de la Terre ?", "Voyager 1", ["Voyager 2", "Pioneer 10", "New Horizons"], "Lancée en 1977, Voyager 1 a quitté l'héliosphère en 2012 et se trouve à plus de 24 milliards de km.", 3, ["Voyager"]],
  ]),
  ...build("animaux", [
    ["Quel est le seul mammifère dont la femelle n'a pas de mamelons mais sécrète le lait par la peau ?", "L'ornithorynque", ["Le kangourou", "Le koala", "La chauve-souris"], "Le lait de l'ornithorynque suinte par des pores de la peau du ventre, où les petits le lèchent.", 4, ["ornithorynque", "echidne"]],
    ["Combien d'estomacs (compartiments) possède une vache ?", "4", ["2", "3", "1"], "La panse (rumen), le bonnet, le feuillet et la caillette : c'est un ruminant.", 2, ["quatre"]],
    ["Quel animal détient le record de la plus longue migration annuelle ?", "La sterne arctique", ["La baleine à bosse", "Le caribou", "L'albatros hurleur"], "La sterne arctique fait l'aller-retour entre l'Arctique et l'Antarctique, parfois plus de 70 000 km par an.", 3, ["sterne arctique", "sterne"]],
  ]),
  ...build("cinema", [
    ["Quel film américain a reçu la toute première Palme d'or, créée en 1955 ?", "Marty", ["La Fureur de vivre", "Sept ans de réflexion", "À l'est d'Éden"], "Avant 1955, le Festival de Cannes décernait un « Grand Prix ». Marty, de Delbert Mann, a aussi remporté l'Oscar du meilleur film.", 4],
    ["Quel réalisateur a signé « Le Fabuleux Destin d'Amélie Poulain » ?", "Jean-Pierre Jeunet", ["Luc Besson", "Michel Gondry", "Jacques Audiard"], "Sorti en 2001, le film a fait de Montmartre et du café des Deux Moulins des lieux de pèlerinage.", 2, ["Jeunet"]],
    ["Quel est le premier long-métrage d'animation de Disney, sorti en 1937 ?", "Blanche-Neige et les Sept Nains", ["Pinocchio", "Fantasia", "Bambi"], "Surnommé « la folie de Disney » pendant sa production, il fut un immense succès.", 2, ["Blanche-Neige", "Blanche Neige"]],
  ]),
  ...build("musique", [
    ["Combien de symphonies Beethoven a-t-il achevées ?", "9", ["7", "12", "5"], "La 9e, avec son « Ode à la joie », est devenue l'hymne européen.", 2, ["neuf"]],
    ["Quel compositeur français a écrit le « Boléro » en 1928 ?", "Maurice Ravel", ["Claude Debussy", "Erik Satie", "Camille Saint-Saëns"], "Ravel le décrivait lui-même comme « un orchestre sans musique », un long crescendo sur un seul thème.", 2, ["Ravel"]],
    ["Quel groupe a sorti l'album « The Dark Side of the Moon » en 1973 ?", "Pink Floyd", ["Led Zeppelin", "Genesis", "The Who"], "L'album est resté plus de 900 semaines dans le classement américain Billboard 200.", 2],
  ]),
  ...build("litterature", [
    ["Quel écrivain a créé le commissaire Maigret ?", "Georges Simenon", ["Gaston Leroux", "Maurice Leblanc", "Frédéric Dard"], "Écrivain belge prolifique, Simenon a publié 75 romans et 28 nouvelles mettant en scène Maigret.", 2, ["Simenon"]],
    ["Quel est le vrai nom de l'écrivain Voltaire ?", "François-Marie Arouet", ["Jean-Baptiste Poquelin", "Henri Beyle", "Aurore Dupin"], "Poquelin est Molière, Beyle est Stendhal et Aurore Dupin est George Sand.", 3, ["Arouet", "Francois-Marie Arouet"]],
    ["Dans « À la recherche du temps perdu », quelle pâtisserie déclenche un souvenir d'enfance ?", "La madeleine", ["Le financier", "Le macaron", "La brioche"], "Trempée dans du thé, la madeleine fait resurgir Combray : c'est la célèbre « madeleine de Proust ».", 2, ["madeleine"]],
  ]),
  ...build("art", [
    ["Dans quelle ville se trouve le musée du Prado ?", "Madrid", ["Barcelone", "Séville", "Lisbonne"], "Le Prado abrite notamment « Les Ménines » de Vélasquez et de nombreuses œuvres de Goya.", 2],
    ["Quel peintre a réalisé « Guernica » en 1937 ?", "Pablo Picasso", ["Joan Miró", "Salvador Dalí", "Francisco de Goya"], "Picasso l'a peint après le bombardement de la ville basque ; l'œuvre est au musée Reina Sofía de Madrid.", 2, ["Picasso"]],
    ["Quel mouvement artistique, fondé par André Breton, explore le rêve et l'inconscient ?", "Le surréalisme", ["Le dadaïsme", "Le cubisme", "L'expressionnisme"], "Le Manifeste du surréalisme paraît en 1924 ; Dalí et Magritte en sont des figures majeures.", 2, ["surrealisme"]],
  ]),
  ...build("sport", [
    ["Dans quelle ville se sont tenus les premiers Jeux olympiques modernes en 1896 ?", "Athènes", ["Paris", "Olympie", "Londres"], "Pierre de Coubertin a relancé les Jeux à Athènes, en hommage à leur origine grecque.", 2, ["Athenes"]],
    ["Combien de points au maximum peut-on marquer avec une seule fléchette ?", "60", ["50", "100", "180"], "Le triple 20 vaut 60 points ; le centre de la cible (bull) n'en vaut que 50. 180 est le maximum avec trois fléchettes.", 4, ["soixante"]],
    ["Quel pays a remporté la première Coupe du monde de rugby en 1987 ?", "La Nouvelle-Zélande", ["L'Australie", "La France", "L'Angleterre"], "Les All Blacks ont battu la France en finale à Auckland (29-9).", 3, ["Nouvelle-Zelande", "All Blacks"]],
  ]),
  ...build("technologie", [
    ["En quelle année le premier e-mail a-t-il été envoyé sur le réseau ARPANET ?", "1971", ["1983", "1965", "1991"], "Ray Tomlinson l'a envoyé entre deux ordinateurs placés côte à côte ; il ne se souvient plus de son contenu.", 3],
    ["Que signifie le « G » de « 5G » ?", "Génération", ["Gigabit", "Global", "Gigahertz"], "La 5G est la cinquième génération de standards de téléphonie mobile.", 2, ["generation"]],
    ["Quel mathématicien britannique a conçu une machine pour décrypter Enigma ?", "Alan Turing", ["Charles Babbage", "John von Neumann", "Claude Shannon"], "Sa « Bombe », à Bletchley Park, a raccourci la Seconde Guerre mondiale selon de nombreux historiens.", 2, ["Turing"]],
  ]),
  ...build("cuisine", [
    ["De quelle ville italienne le pesto est-il originaire ?", "Gênes", ["Naples", "Turin", "Bologne"], "Le pesto genovese associe basilic, pignons, ail, parmesan, pecorino et huile d'olive.", 3, ["Genes", "Genova"]],
    ["Quel fromage italien est traditionnellement utilisé dans la vraie pizza napolitaine ?", "La mozzarella", ["Le parmesan", "Le gorgonzola", "La ricotta"], "La pizza napolitaine utilise de la mozzarella de bufflonne ou du fior di latte.", 1, ["mozzarella"]],
    ["Combien d'étoiles au maximum le Guide Michelin peut-il attribuer à un restaurant ?", "3", ["5", "4", "2"], "Trois étoiles signifient « une cuisine unique, qui vaut le voyage ».", 1, ["trois"]],
  ]),
  ...build("insolite", [
    ["Quel pays a changé de fuseau horaire en 2011 pour « sauter » le 30 décembre ?", "Les Samoa", ["Les Tonga", "Les Fidji", "Kiribati"], "Pour se caler sur l'Australie et la Nouvelle-Zélande, les Samoa sont passées directement du 29 au 31 décembre 2011.", 4, ["Samoa"]],
    ["Combien de temps la reine des abeilles peut-elle vivre ?", "Plusieurs années", ["Quelques semaines", "Un seul été", "Quelques jours"], "Une reine vit de 3 à 5 ans, alors qu'une ouvrière d'été ne vit que 5 à 6 semaines.", 3, ["plusieurs annees", "3 ans", "4 ans", "5 ans", "quelques annees"]],
    ["Quel pays a eu un drapeau entièrement vert, sans aucun motif, de 1977 à 2011 ?", "La Libye", ["L'Arabie saoudite", "Le Pakistan", "La Mauritanie"], "C'était le seul drapeau national d'une seule couleur unie au monde ; il a été abandonné après la chute de Kadhafi.", 4, ["Libye"]],
  ]),
  ...build("records", [
    ["Quel est l'animal terrestre le plus lourd ?", "L'éléphant de savane d'Afrique", ["L'hippopotame", "Le rhinocéros blanc", "L'éléphant d'Asie"], "Un mâle peut dépasser 6 tonnes, et l'on a déjà mesuré un spécimen de plus de 10 tonnes.", 2, ["elephant", "elephant d'Afrique", "éléphant de savane"]],
    ["Quel est le lac le plus profond d'Afrique ?", "Le lac Tanganyika", ["Le lac Victoria", "Le lac Malawi", "Le lac Tchad"], "Avec environ 1 470 m de profondeur, c'est le deuxième lac le plus profond au monde après le Baïkal.", 4, ["Tanganyika"]],
  ]),
];
