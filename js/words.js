// Wortliste: 500 Wörter in 11 Kategorien. Format pro Zeile: Deutsch|English|Srpski
(function () {
  const RAW = {
    animals: {
      icon: '🦊', name: { de: 'Tiere', en: 'Animals', sr: 'Životinje' },
      w: `Hund|Dog|Pas
Katze|Cat|Mačka
Pferd|Horse|Konj
Kuh|Cow|Krava
Schwein|Pig|Svinja
Schaf|Sheep|Ovca
Ziege|Goat|Koza
Huhn|Chicken|Kokoška
Ente|Duck|Patka
Gans|Goose|Guska
Löwe|Lion|Lav
Tiger|Tiger|Tigar
Elefant|Elephant|Slon
Giraffe|Giraffe|Žirafa
Zebra|Zebra|Zebra
Affe|Monkey|Majmun
Bär|Bear|Medved
Wolf|Wolf|Vuk
Fuchs|Fox|Lisica
Hase|Rabbit|Zec
Eichhörnchen|Squirrel|Veverica
Igel|Hedgehog|Jež
Maus|Mouse|Miš
Frosch|Frog|Žaba
Schlange|Snake|Zmija
Krokodil|Crocodile|Krokodil
Schildkröte|Turtle|Kornjača
Hai|Shark|Ajkula
Delfin|Dolphin|Delfin
Wal|Whale|Kit
Pinguin|Penguin|Pingvin
Eule|Owl|Sova
Adler|Eagle|Orao
Papagei|Parrot|Papagaj
Biene|Bee|Pčela
Schmetterling|Butterfly|Leptir
Spinne|Spider|Pauk
Ameise|Ant|Mrav
Kamel|Camel|Kamila
Känguru|Kangaroo|Kengur
Koala|Koala|Koala
Panda|Panda|Panda
Nilpferd|Hippo|Nilski konj
Nashorn|Rhino|Nosorog
Krake|Octopus|Hobotnica
Qualle|Jellyfish|Meduza
Flamingo|Flamingo|Flamingo
Hirsch|Deer|Jelen
Fledermaus|Bat|Slepi miš
Esel|Donkey|Magarac`
    },
    food: {
      icon: '🍕', name: { de: 'Essen & Trinken', en: 'Food & Drinks', sr: 'Hrana i piće' },
      w: `Pizza|Pizza|Pica
Burger|Burger|Burger
Pommes|Fries|Pomfrit
Döner|Doner kebab|Kebab
Spaghetti|Spaghetti|Špagete
Sushi|Sushi|Suši
Schokolade|Chocolate|Čokolada
Eis|Ice cream|Sladoled
Kuchen|Cake|Torta
Pfannkuchen|Pancakes|Palačinke
Brot|Bread|Hleb
Käse|Cheese|Sir
Apfel|Apple|Jabuka
Banane|Banana|Banana
Erdbeere|Strawberry|Jagoda
Wassermelone|Watermelon|Lubenica
Orange|Orange|Pomorandža
Zitrone|Lemon|Limun
Kirsche|Cherry|Trešnja
Ananas|Pineapple|Ananas
Tomate|Tomato|Paradajz
Kartoffel|Potato|Krompir
Karotte|Carrot|Šargarepa
Zwiebel|Onion|Crni luk
Knoblauch|Garlic|Beli luk
Gurke|Cucumber|Krastavac
Ei|Egg|Jaje
Honig|Honey|Med
Popcorn|Popcorn|Kokice
Suppe|Soup|Supa
Salat|Salad|Salata
Wurst|Sausage|Kobasica
Steak|Steak|Stek
Ćevapi|Ćevapi|Ćevapi
Burek|Burek|Burek
Sarma|Sarma|Sarma
Kaffee|Coffee|Kafa
Tee|Tea|Čaj
Milch|Milk|Mleko
Saft|Juice|Sok
Limonade|Lemonade|Limunada
Cola|Cola|Kola
Donut|Donut|Krofna
Croissant|Croissant|Kroasan
Hotdog|Hot dog|Hot dog
Taco|Taco|Tako
Nudeln|Noodles|Rezanci
Reis|Rice|Pirinač
Müsli|Cereal|Žitarice
Keks|Cookie|Keks`
    },
    places: {
      icon: '🏰', name: { de: 'Orte', en: 'Places', sr: 'Mesta' },
      w: `Schule|School|Škola
Krankenhaus|Hospital|Bolnica
Flughafen|Airport|Aerodrom
Bahnhof|Train station|Železnička stanica
Supermarkt|Supermarket|Supermarket
Kino|Cinema|Bioskop
Restaurant|Restaurant|Restoran
Bäckerei|Bakery|Pekara
Bibliothek|Library|Biblioteka
Museum|Museum|Muzej
Zoo|Zoo|Zoološki vrt
Freizeitpark|Amusement park|Zabavni park
Schwimmbad|Swimming pool|Bazen
Fitnessstudio|Gym|Teretana
Kirche|Church|Crkva
Polizeistation|Police station|Policijska stanica
Feuerwache|Fire station|Vatrogasna stanica
Gefängnis|Prison|Zatvor
Bank|Bank|Banka
Hotel|Hotel|Hotel
Friseursalon|Hair salon|Frizerski salon
Apotheke|Pharmacy|Apoteka
Tankstelle|Gas station|Benzinska pumpa
Stadion|Stadium|Stadion
Spielplatz|Playground|Igralište
Strand|Beach|Plaža
Schloss|Castle|Zamak
Bauernhof|Farm|Farma
Zirkus|Circus|Cirkus
Casino|Casino|Kazino
Disco|Nightclub|Diskoteka
Kindergarten|Kindergarten|Vrtić
Universität|University|Univerzitet
Büro|Office|Kancelarija
Fabrik|Factory|Fabrika
Hafen|Harbor|Luka
Leuchtturm|Lighthouse|Svetionik
Friedhof|Cemetery|Groblje
Markt|Market|Pijaca
Einkaufszentrum|Shopping mall|Tržni centar
Café|Café|Kafić
Kiosk|Kiosk|Trafika
Parkhaus|Parking garage|Garaža
Raumstation|Space station|Svemirska stanica
Pyramide|Pyramid|Piramida
Eiffelturm|Eiffel Tower|Ajfelova kula
Bowlingbahn|Bowling alley|Kuglana
Zahnarztpraxis|Dentist's office|Zubarska ordinacija
Kreuzfahrtschiff|Cruise ship|Kruzer
U-Bahn|Subway|Metro`
    },
    nature: {
      icon: '🏔️', name: { de: 'Natur & Landschaft', en: 'Nature & Landscape', sr: 'Priroda i pejzaž' },
      w: `Berg|Mountain|Planina
Vulkan|Volcano|Vulkan
Wüste|Desert|Pustinja
Dschungel|Jungle|Džungla
Wald|Forest|Šuma
See|Lake|Jezero
Fluss|River|Reka
Meer|Sea|More
Insel|Island|Ostrvo
Wasserfall|Waterfall|Vodopad
Höhle|Cave|Pećina
Gletscher|Glacier|Glečer
Küste|Coast|Obala
Tal|Valley|Dolina
Hügel|Hill|Brdo
Wiese|Meadow|Livada
Sumpf|Swamp|Močvara
Oase|Oasis|Oaza
Regenbogen|Rainbow|Duga
Gewitter|Thunderstorm|Oluja
Blitz|Lightning|Munja
Schnee|Snow|Sneg
Regen|Rain|Kiša
Nebel|Fog|Magla
Tornado|Tornado|Tornado
Erdbeben|Earthquake|Zemljotres
Sonnenuntergang|Sunset|Zalazak sunca
Mond|Moon|Mesec
Sonne|Sun|Sunce
Stern|Star|Zvezda
Wolke|Cloud|Oblak
Baum|Tree|Drvo
Blume|Flower|Cvet
Rose|Rose|Ruža
Sonnenblume|Sunflower|Suncokret
Kaktus|Cactus|Kaktus
Palme|Palm tree|Palma
Pilz|Mushroom|Pečurka
Stein|Stone|Kamen
Sand|Sand|Pesak
Feuer|Fire|Vatra
Eisberg|Iceberg|Ledeni breg
Korallenriff|Coral reef|Koralni greben
Nordlicht|Northern lights|Polarna svetlost
Lawine|Avalanche|Lavina
Canyon|Canyon|Kanjon
Feld|Field|Polje
Teich|Pond|Bara
Wind|Wind|Vetar
Komet|Comet|Kometa`
    },
    jobs: {
      icon: '👩‍🚀', name: { de: 'Berufe', en: 'Jobs', sr: 'Zanimanja' },
      w: `Arzt|Doctor|Lekar
Lehrer|Teacher|Učitelj
Polizist|Police officer|Policajac
Feuerwehrmann|Firefighter|Vatrogasac
Koch|Chef|Kuvar
Bäcker|Baker|Pekar
Pilot|Pilot|Pilot
Astronaut|Astronaut|Astronaut
Friseur|Hairdresser|Frizer
Zahnarzt|Dentist|Zubar
Tierarzt|Vet|Veterinar
Bauer|Farmer|Poljoprivrednik
Mechaniker|Mechanic|Mehaničar
Elektriker|Electrician|Električar
Klempner|Plumber|Vodoinstalater
Maler|Painter|Moler
Architekt|Architect|Arhitekta
Programmierer|Programmer|Programer
Journalist|Journalist|Novinar
Fotograf|Photographer|Fotograf
Schauspieler|Actor|Glumac
Sänger|Singer|Pevač
DJ|DJ|DJ
Richter|Judge|Sudija
Anwalt|Lawyer|Advokat
Krankenpfleger|Nurse|Medicinska sestra
Postbote|Mail carrier|Poštar
Taxifahrer|Taxi driver|Taksista
Busfahrer|Bus driver|Vozač autobusa
Kellner|Waiter|Konobar
Verkäufer|Salesperson|Prodavac
Detektiv|Detective|Detektiv
Spion|Spy|Špijun
Soldat|Soldier|Vojnik
Kapitän|Captain|Kapetan
Bauarbeiter|Construction worker|Građevinski radnik
Gärtner|Gardener|Baštovan
Zauberer|Magician|Mađioničar
Clown|Clown|Klovn
Fußballer|Football player|Fudbaler
YouTuber|YouTuber|Jutjuber
Wissenschaftler|Scientist|Naučnik
Bibliothekar|Librarian|Bibliotekar
Metzger|Butcher|Mesar
Pirat|Pirate|Gusar
König|King|Kralj
Prinzessin|Princess|Princeza
Rettungsschwimmer|Lifeguard|Spasilac
Tänzer|Dancer|Plesač
Schneider|Tailor|Krojač`
    },
    sports: {
      icon: '⚽', name: { de: 'Sport', en: 'Sports', sr: 'Sport' },
      w: `Fußball|Football|Fudbal
Basketball|Basketball|Košarka
Tennis|Tennis|Tenis
Volleyball|Volleyball|Odbojka
Handball|Handball|Rukomet
Wasserball|Water polo|Vaterpolo
Schwimmen|Swimming|Plivanje
Boxen|Boxing|Boks
Ringen|Wrestling|Rvanje
Karate|Karate|Karate
Judo|Judo|Džudo
Skifahren|Skiing|Skijanje
Snowboarden|Snowboarding|Snoubording
Eishockey|Ice hockey|Hokej na ledu
Eiskunstlauf|Figure skating|Umetničko klizanje
Golf|Golf|Golf
Baseball|Baseball|Bejzbol
Rugby|Rugby|Ragbi
Radfahren|Cycling|Biciklizam
Formel 1|Formula 1|Formula 1
Marathon|Marathon|Maraton
Hochsprung|High jump|Skok uvis
Turnen|Gymnastics|Gimnastika
Yoga|Yoga|Joga
Surfen|Surfing|Surfovanje
Tauchen|Diving|Ronjenje
Klettern|Climbing|Penjanje
Reiten|Horse riding|Jahanje
Bogenschießen|Archery|Streličarstvo
Fechten|Fencing|Mačevanje
Tischtennis|Table tennis|Stoni tenis
Badminton|Badminton|Badminton
Bowling|Bowling|Kuglanje
Billard|Billiards|Bilijar
Darts|Darts|Pikado
Skateboarden|Skateboarding|Skejtbord
Rudern|Rowing|Veslanje
Segeln|Sailing|Jedrenje
Gewichtheben|Weightlifting|Dizanje tegova
Sumo|Sumo|Sumo
Fallschirmspringen|Skydiving|Padobranstvo
Joggen|Jogging|Džogiranje
American Football|American football|Američki fudbal
Cricket|Cricket|Kriket
Paintball|Paintball|Pejntbol
Parkour|Parkour|Parkur
Kickboxen|Kickboxing|Kikboks
Triathlon|Triathlon|Triatlon
Speerwurf|Javelin throw|Bacanje koplja
Minigolf|Mini golf|Mini golf`
    },
    objects: {
      icon: '🔑', name: { de: 'Gegenstände', en: 'Objects', sr: 'Predmeti' },
      w: `Stuhl|Chair|Stolica
Tisch|Table|Sto
Bett|Bed|Krevet
Sofa|Sofa|Kauč
Lampe|Lamp|Lampa
Spiegel|Mirror|Ogledalo
Uhr|Clock|Sat
Schlüssel|Key|Ključ
Regenschirm|Umbrella|Kišobran
Brille|Glasses|Naočare
Kerze|Candle|Sveća
Kissen|Pillow|Jastuk
Decke|Blanket|Ćebe
Zahnbürste|Toothbrush|Četkica za zube
Handtuch|Towel|Peškir
Seife|Soap|Sapun
Kühlschrank|Fridge|Frižider
Waschmaschine|Washing machine|Veš mašina
Staubsauger|Vacuum cleaner|Usisivač
Bügeleisen|Iron|Pegla
Messer|Knife|Nož
Gabel|Fork|Viljuška
Löffel|Spoon|Kašika
Teller|Plate|Tanjir
Tasse|Cup|Šolja
Topf|Pot|Lonac
Pfanne|Pan|Tiganj
Schere|Scissors|Makaze
Bleistift|Pencil|Olovka
Buch|Book|Knjiga
Rucksack|Backpack|Ranac
Koffer|Suitcase|Kofer
Geldbörse|Wallet|Novčanik
Hammer|Hammer|Čekić
Schraubenzieher|Screwdriver|Šrafciger
Leiter|Ladder|Merdevine
Besen|Broom|Metla
Eimer|Bucket|Kanta
Vase|Vase|Vaza
Bilderrahmen|Picture frame|Ram za slike
Wecker|Alarm clock|Budilnik
Fernbedienung|Remote control|Daljinski upravljač
Teppich|Carpet|Tepih
Vorhang|Curtain|Zavesa
Kamm|Comb|Češalj
Ring|Ring|Prsten
Halskette|Necklace|Ogrlica
Luftballon|Balloon|Balon
Geschenk|Gift|Poklon
Feuerzeug|Lighter|Upaljač`
    },
    transport: {
      icon: '🚀', name: { de: 'Fahrzeuge', en: 'Vehicles', sr: 'Vozila' },
      w: `Auto|Car|Automobil
Bus|Bus|Autobus
Zug|Train|Voz
Flugzeug|Airplane|Avion
Hubschrauber|Helicopter|Helikopter
Schiff|Ship|Brod
Boot|Boat|Čamac
U-Boot|Submarine|Podmornica
Fahrrad|Bicycle|Bicikl
Motorrad|Motorcycle|Motocikl
Motorroller|Scooter|Skuter
Traktor|Tractor|Traktor
Lastwagen|Truck|Kamion
Taxi|Taxi|Taksi
Krankenwagen|Ambulance|Hitna pomoć
Feuerwehrauto|Fire truck|Vatrogasno vozilo
Polizeiauto|Police car|Policijski automobil
Straßenbahn|Tram|Tramvaj
Rakete|Rocket|Raketa
Heißluftballon|Hot air balloon|Balon na topli vazduh
Segelboot|Sailboat|Jedrilica
Kanu|Canoe|Kanu
Jetski|Jet ski|Džet ski
Seilbahn|Cable car|Žičara
Rolltreppe|Escalator|Pokretne stepenice
Aufzug|Elevator|Lift
Kutsche|Carriage|Kočija
Bagger|Excavator|Bager
Kran|Crane|Kran
Limousine|Limousine|Limuzina
Wohnmobil|Camper van|Kamper
Schlitten|Sled|Sanke
Gokart|Go-kart|Karting
Quad|Quad bike|Kvad
Rennwagen|Race car|Trkački automobil
Müllauto|Garbage truck|Kamion za smeće
Gabelstapler|Forklift|Viljuškar
Ufo|UFO|NLO
Fähre|Ferry|Trajekt
Floß|Raft|Splav
Zeppelin|Zeppelin|Cepelin
Drohne|Drone|Dron
E-Scooter|E-scooter|Električni trotinet
Tretroller|Kick scooter|Trotinet
Rollschuhe|Roller skates|Koturaljke
Gondel|Gondola|Gondola
Panzer|Tank|Tenk
Jacht|Yacht|Jahta
Lieferwagen|Delivery van|Dostavno vozilo
Schulbus|School bus|Školski autobus`
    },
    fun: {
      icon: '🎲', name: { de: 'Spiele & Freizeit', en: 'Games & Free Time', sr: 'Igre i slobodno vreme' },
      w: `Schach|Chess|Šah
Brettspiel|Board game|Društvena igra
Kartenspiel|Card game|Kartaška igra
Puzzle|Puzzle|Slagalica
Verstecken|Hide and seek|Žmurke
Fangen|Tag|Šuge
Karaoke|Karaoke|Karaoke
Videospiel|Video game|Video igra
Spielkonsole|Game console|Konzola
Würfel|Dice|Kockice
Domino|Dominoes|Domine
Bausteine|Building blocks|Kocke za slaganje
Malen|Painting|Slikanje
Zeichnen|Drawing|Crtanje
Angeln|Fishing|Pecanje
Camping|Camping|Kampovanje
Wandern|Hiking|Planinarenje
Gärtnern|Gardening|Baštovanstvo
Kochen|Cooking|Kuvanje
Backen|Baking|Pečenje kolača
Stricken|Knitting|Pletenje
Lesen|Reading|Čitanje
Tanzen|Dancing|Ples
Singen|Singing|Pevanje
Fotografieren|Photography|Fotografisanje
Zaubertricks|Magic tricks|Mađioničarski trikovi
Drachensteigen|Kite flying|Puštanje zmaja
Sandburg|Sandcastle|Kula od peska
Schneemann|Snowman|Sneško Belić
Schneeballschlacht|Snowball fight|Grudvanje
Picknick|Picnic|Piknik
Grillen|Barbecue|Roštilj
Party|Party|Žurka
Geburtstag|Birthday|Rođendan
Hochzeit|Wedding|Venčanje
Silvester|New Year's Eve|Doček Nove godine
Weihnachten|Christmas|Božić
Halloween|Halloween|Noć veštica
Ostern|Easter|Uskrs
Konzert|Concert|Koncert
Filmabend|Movie night|Filmsko veče
Escape Room|Escape room|Escape soba
Trampolin|Trampoline|Trambolina
Schaukel|Swing|Ljuljaška
Rutsche|Slide|Tobogan
Achterbahn|Roller coaster|Rolerkoster
Riesenrad|Ferris wheel|Panoramski točak
Seifenblasen|Soap bubbles|Mehurići od sapunice
Murmeln|Marbles|Klikeri
Origami|Origami|Origami`
    },
    tech: {
      icon: '🤖', name: { de: 'Technik', en: 'Tech', sr: 'Tehnologija' },
      w: `Handy|Smartphone|Mobilni telefon
Laptop|Laptop|Laptop
Computer|Computer|Računar
Tablet|Tablet|Tablet
Fernseher|TV|Televizor
Kamera|Camera|Kamera
Kopfhörer|Headphones|Slušalice
Lautsprecher|Speaker|Zvučnik
Roboter|Robot|Robot
Internet|Internet|Internet
WLAN|Wi-Fi|Wi-Fi
Tastatur|Keyboard|Tastatura
Computermaus|Computer mouse|Računarski miš
Drucker|Printer|Štampač
Ladegerät|Charger|Punjač
Akku|Battery|Baterija
Smartwatch|Smartwatch|Pametni sat
VR-Brille|VR headset|VR naočare
Satellit|Satellite|Satelit
Mikrowelle|Microwave|Mikrotalasna
Taschenrechner|Calculator|Digitron
Taschenlampe|Flashlight|Baterijska lampa
Selfie|Selfie|Selfi
Emoji|Emoji|Emodži
Passwort|Password|Lozinka`
    },
    music: {
      icon: '🎸', name: { de: 'Musik', en: 'Music', sr: 'Muzika' },
      w: `Gitarre|Guitar|Gitara
Klavier|Piano|Klavir
Schlagzeug|Drums|Bubnjevi
Geige|Violin|Violina
Trompete|Trumpet|Truba
Flöte|Flute|Flauta
Saxophon|Saxophone|Saksofon
Harfe|Harp|Harfa
Akkordeon|Accordion|Harmonika
Mikrofon|Microphone|Mikrofon
Rap|Rap|Rep
Rockmusik|Rock music|Rok muzika
Oper|Opera|Opera
Chor|Choir|Hor
Orchester|Orchestra|Orkestar
Dirigent|Conductor|Dirigent
Band|Band|Bend
Festival|Festival|Festival
Schallplatte|Vinyl record|Gramofonska ploča
Tamburica|Tamburica|Tamburica
Mundharmonika|Harmonica|Usna harmonika
Xylophon|Xylophone|Ksilofon
Ballett|Ballet|Balet
Musikvideo|Music video|Muzički spot
Hymne|Anthem|Himna`
    }
  };

  const CATEGORIES = [];
  const WORDS = []; // {cat, de, en, sr}
  for (const [id, c] of Object.entries(RAW)) {
    const start = WORDS.length;
    c.w.trim().split('\n').forEach(line => {
      const [de, en, sr] = line.split('|').map(s => s.trim());
      WORDS.push({ cat: id, de, en, sr });
    });
    CATEGORIES.push({ id, icon: c.icon, name: c.name, count: WORDS.length - start });
  }
  window.CATEGORIES = CATEGORIES;
  window.WORDS = WORDS;
})();
