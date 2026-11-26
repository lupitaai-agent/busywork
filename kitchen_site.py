"""Busy Kitchen's pages for search: what people look for, answered from the app's own data.

The six kitchens, their dishes, their regions and their calendars live in the app (app/shared/kitchen-data.js and
app/shared/kitchen/details-<lang>.js), already in six languages, but the app sits under /app/, which robots.txt keeps
out of search. These pages put that knowledge where search engines can read it, one page per search people make:

- one page per kitchen ("Dutch and Flemish food", "Italian food", ...): its story, regions, customs, pantry, calendar
  and every dish with where it comes from, when it is eaten and its story;
- the food calendar of the six kitchens, month by month;
- Christmas food in the six kitchens, from Sinterklaas to Epiphany;
- "What can I cook with what I have?": dishes for the fridges people have most often.

No recipes: those stay in the app (kitchen/BUILD-KITCHEN.md: never thousands of recipe pages on the website).

Words: the page's own sentences are translated here, by hand (TEMPLATES). Everything that comes from the data takes its
translation from the data itself. words(lang) returns both, and build.py writes them to i18n/data/<lang>.json, which
i18n.load() reads next to i18n/<lang>.json (that file wins where both have a key). Pages made here carry
<meta name="busy-words" content="data">, so `i18n.py extract` leaves their words out of strings.json."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "app"
LANGS = ["nl", "de", "es", "it", "pt-br"]
MARK = '<meta name="busy-words" content="data">'

# each kitchen's page: its address and the name people search for
PAGES = {"nl": "dutch-food", "de": "german-food", "es": "spanish-food", "it": "italian-food", "pt": "portuguese-food", "en": "british-food"}
LABEL = {
    "nl": {"en": "Dutch and Flemish food", "nl": "Nederlands en Vlaams eten", "de": "Niederländisches und flämisches Essen", "es": "Comida neerlandesa y flamenca", "it": "Cucina olandese e fiamminga", "pt-br": "Comida holandesa e flamenga"},
    "de": {"en": "German, Austrian and Swiss food", "nl": "Duits, Oostenrijks en Zwitsers eten", "de": "Deutsches, österreichisches und Schweizer Essen", "es": "Comida alemana, austriaca y suiza", "it": "Cucina tedesca, austriaca e svizzera", "pt-br": "Comida alemã, austríaca e suíça"},
    "es": {"en": "Spanish and Latin American food", "nl": "Spaans en Latijns-Amerikaans eten", "de": "Spanisches und lateinamerikanisches Essen", "es": "Comida española y latinoamericana", "it": "Cucina spagnola e latinoamericana", "pt-br": "Comida espanhola e latino-americana"},
    "it": {"en": "Italian food", "nl": "Italiaans eten", "de": "Italienisches Essen", "es": "Comida italiana", "it": "Cucina italiana", "pt-br": "Comida italiana"},
    "pt": {"en": "Portuguese and Brazilian food", "nl": "Portugees en Braziliaans eten", "de": "Portugiesisches und brasilianisches Essen", "es": "Comida portuguesa y brasileña", "it": "Cucina portoghese e brasiliana", "pt-br": "Comida portuguesa e brasileira"},
    "en": {"en": "British, Irish and American food", "nl": "Brits, Iers en Amerikaans eten", "de": "Britisches, irisches und amerikanisches Essen", "es": "Comida británica, irlandesa y estadounidense", "it": "Cucina britannica, irlandese e americana", "pt-br": "Comida britânica, irlandesa e americana"},
}

# The pages' own sentences. {label}, {n} and {name} are filled in before the text goes on the page.
T = {
    "k_title": {"en": "{label}: {n} traditional dishes", "nl": "{label}: {n} traditionele gerechten", "de": "{label}: {n} traditionelle Gerichte", "es": "{label}: {n} platos tradicionales", "it": "{label}: {n} piatti tradizionali", "pt-br": "{label}: {n} pratos tradicionais"},
    "k_desc": {"en": "{label}: {n} dishes people cook at home and on feast days, with where each comes from, when it is eaten and its story. A free recipe for every dish in Busy Kitchen.",
               "nl": "{label}: {n} gerechten die mensen thuis en op feestdagen koken, met waar elk vandaan komt, wanneer het gegeten wordt en het verhaal erachter. Een gratis recept voor elk gerecht in Busy Kitchen.",
               "de": "{label}: {n} Gerichte, die man zu Hause und an Festtagen kocht, mit Herkunft, Anlass und Geschichte. Ein kostenloses Rezept für jedes Gericht in Busy Kitchen.",
               "es": "{label}: {n} platos que se cocinan en casa y en las fiestas, con su origen, cuándo se comen y su historia. Una receta gratis para cada plato en Busy Kitchen.",
               "it": "{label}: {n} piatti che si cucinano a casa e nei giorni di festa, con la loro origine, quando si mangiano e la loro storia. Una ricetta gratis per ogni piatto in Busy Kitchen.",
               "pt-br": "{label}: {n} pratos que se cozinham em casa e nos dias de festa, com a origem, quando se comem e a história de cada um. Uma receita grátis para cada prato no Busy Kitchen."},
    "k_h1": {"en": "{label}: the dishes people cook at home", "nl": "{label}: de gerechten die mensen thuis koken", "de": "{label}: die Gerichte, die man zu Hause kocht", "es": "{label}: los platos que se cocinan en casa", "it": "{label}: i piatti che si cucinano a casa", "pt-br": "{label}: os pratos que se cozinham em casa"},
    "kicker": {"en": "Busy Kitchen · the six kitchens", "nl": "Busy Kitchen · de zes keukens", "de": "Busy Kitchen · die sechs Küchen", "es": "Busy Kitchen · las seis cocinas", "it": "Busy Kitchen · le sei cucine", "pt-br": "Busy Kitchen · as seis cozinhas"},
    "say": {"en": "How to say it", "nl": "Hoe je het uitspreekt", "de": "So spricht man es aus", "es": "Cómo se pronuncia", "it": "Come si pronuncia", "pt-br": "Como se pronuncia"},
    "regions": {"en": "Its regions", "nl": "De streken", "de": "Die Regionen", "es": "Sus regiones", "it": "Le regioni", "pt-br": "As regiões"},
    "customs": {"en": "How people eat", "nl": "Hoe men eet", "de": "Wie man isst", "es": "Cómo se come", "it": "Come si mangia", "pt-br": "Como se come"},
    "pantry": {"en": "In the cupboard", "nl": "In de voorraadkast", "de": "Im Vorratsschrank", "es": "En la despensa", "it": "In dispensa", "pt-br": "Na despensa"},
    "calendar": {"en": "Through the year", "nl": "Door het jaar", "de": "Durch das Jahr", "es": "A lo largo del año", "it": "Durante l'anno", "pt-br": "Ao longo do ano"},
    "dishes_h": {"en": "{n} dishes", "nl": "{n} gerechten", "de": "{n} Gerichte", "es": "{n} platos", "it": "{n} piatti", "pt-br": "{n} pratos"},
    "dishes_p": {"en": "Every dish with where it comes from, when it is eaten and the story behind it. The recipe for each one is in the free app.",
                 "nl": "Elk gerecht met waar het vandaan komt, wanneer het gegeten wordt en het verhaal erachter. Het recept van elk gerecht staat in de gratis app.",
                 "de": "Jedes Gericht mit seiner Herkunft, seinem Anlass und seiner Geschichte. Das Rezept für jedes steht in der kostenlosen App.",
                 "es": "Cada plato con su origen, cuándo se come y la historia que lo acompaña. La receta de cada uno está en la app gratuita.",
                 "it": "Ogni piatto con la sua origine, quando si mangia e la storia che c'è dietro. La ricetta di ognuno è nell'app gratuita.",
                 "pt-br": "Cada prato com a sua origem, quando se come e a história por trás dele. A receita de cada um está no app gratuito."},
    "where": {"en": "Where", "nl": "Waar", "de": "Wo", "es": "Dónde", "it": "Dove", "pt-br": "Onde"},
    "when": {"en": "When", "nl": "Wanneer", "de": "Wann", "es": "Cuándo", "it": "Quando", "pt-br": "Quando"},
    "ing": {"en": "Key ingredients", "nl": "Belangrijkste ingrediënten", "de": "Wichtigste Zutaten", "es": "Ingredientes principales", "it": "Ingredienti principali", "pt-br": "Ingredientes principais"},
    "eaten": {"en": "How it is eaten", "nl": "Hoe het gegeten wordt", "de": "Wie man es isst", "es": "Cómo se come", "it": "Come si mangia", "pt-br": "Como se come"},
    "prot": {"en": "Protected", "nl": "Beschermd", "de": "Geschützt", "es": "Protegido", "it": "Tutelato", "pt-br": "Protegido"},
    "cta_h": {"en": "Cook one of them tonight", "nl": "Kook er vanavond een", "de": "Koch heute Abend eins davon", "es": "Cocina uno esta noche", "it": "Cucinane uno stasera", "pt-br": "Cozinhe um deles hoje à noite"},
    "cta_p": {"en": "Busy Kitchen has a recipe for every dish on this page, in six languages, and shows what you can cook from what is in your fridge. Free, no account, no AI.",
              "nl": "Busy Kitchen heeft een recept voor elk gerecht op deze pagina, in zes talen, en laat zien wat je kunt koken met wat er in je koelkast ligt. Gratis, zonder account, zonder AI.",
              "de": "Busy Kitchen hat ein Rezept für jedes Gericht auf dieser Seite, in sechs Sprachen, und zeigt dir, was du mit dem kochen kannst, was in deinem Kühlschrank ist. Kostenlos, ohne Konto, ohne KI.",
              "es": "Busy Kitchen tiene una receta para cada plato de esta página, en seis idiomas, y te muestra qué puedes cocinar con lo que tienes en la nevera. Gratis, sin cuenta, sin IA.",
              "it": "Busy Kitchen ha una ricetta per ogni piatto di questa pagina, in sei lingue, e ti mostra cosa puoi cucinare con quello che hai in frigo. Gratis, senza account, senza IA.",
              "pt-br": "O Busy Kitchen tem uma receita para cada prato desta página, em seis idiomas, e mostra o que você pode cozinhar com o que tem na geladeira. Grátis, sem conta, sem IA."},
    "open": {"en": "🍳 Open Busy Kitchen free", "nl": "🍳 Open Busy Kitchen gratis", "de": "🍳 Busy Kitchen kostenlos öffnen", "es": "🍳 Abre Busy Kitchen gratis", "it": "🍳 Apri Busy Kitchen gratis", "pt-br": "🍳 Abra o Busy Kitchen grátis"},
    "about": {"en": "About Busy Kitchen", "nl": "Over Busy Kitchen", "de": "Über Busy Kitchen", "es": "Sobre Busy Kitchen", "it": "Su Busy Kitchen", "pt-br": "Sobre o Busy Kitchen"},
    "others": {"en": "More from the six kitchens", "nl": "Meer uit de zes keukens", "de": "Mehr aus den sechs Küchen", "es": "Más de las seis cocinas", "it": "Altro dalle sei cucine", "pt-br": "Mais das seis cozinhas"},
    "pics": {"en": "Pictures made with AI, to show the kitchen's places and customs.", "nl": "Afbeeldingen gemaakt met AI, om de plekken en gewoonten van de keuken te laten zien.", "de": "Bilder mit KI erstellt, um die Orte und Bräuche der Küche zu zeigen.", "es": "Imágenes hechas con IA para mostrar los lugares y las costumbres de la cocina.", "it": "Immagini realizzate con l'IA, per mostrare i luoghi e le usanze della cucina.", "pt-br": "Imagens feitas com IA, para mostrar os lugares e os costumes da cozinha."},
    "notes": {"en": "Gathered by Busy from written sources and checked, not yet cooked by us. Spotted a mistake? Tell us, in the comments.", "nl": "Door Busy verzameld uit geschreven bronnen en nagekeken, nog niet door ons gekookt. Zie je een fout? Laat het ons weten in de reacties.", "de": "Von Busy aus schriftlichen Quellen zusammengetragen und geprüft, noch nicht von uns gekocht. Einen Fehler entdeckt? Sag es uns in den Kommentaren.", "es": "Reunido por Busy a partir de fuentes escritas y revisado, aún no cocinado por nosotros. ¿Has visto un error? Cuéntanoslo en los comentarios.", "it": "Raccolto da Busy da fonti scritte e verificato, non ancora cucinato da noi. Hai visto un errore? Dicci nei commenti.", "pt-br": "Reunido pelo Busy a partir de fontes escritas e conferido, ainda não preparado por nós. Viu um erro? Conte pra gente nos comentários."},
    # the food calendar
    "c_title": {"en": "Food calendar: what six kitchens cook, month by month", "nl": "Eetkalender: wat zes keukens koken, maand voor maand", "de": "Essenskalender: was sechs Küchen kochen, Monat für Monat", "es": "Calendario de comida: qué cocinan seis cocinas, mes a mes", "it": "Calendario del cibo: cosa cucinano sei cucine, mese per mese", "pt-br": "Calendário da comida: o que seis cozinhas preparam, mês a mês"},
    "c_desc": {"en": "What families cook on feast days and through the seasons in the Dutch, German, Spanish, Italian, Portuguese and English-language kitchens, from Sinterklaas to Thanksgiving.",
               "nl": "Wat families koken op feestdagen en door de seizoenen in de Nederlandse, Duitse, Spaanse, Italiaanse, Portugese en Engelstalige keuken, van Sinterklaas tot Thanksgiving.",
               "de": "Was Familien an Festtagen und durch die Jahreszeiten kochen, in der niederländischen, deutschen, spanischen, italienischen, portugiesischen und englischsprachigen Küche, von Sinterklaas bis Thanksgiving.",
               "es": "Qué cocinan las familias en las fiestas y a lo largo de las estaciones en las cocinas neerlandesa, alemana, española, italiana, portuguesa y de habla inglesa, de Sinterklaas a Acción de Gracias.",
               "it": "Cosa cucinano le famiglie nei giorni di festa e nelle stagioni nelle cucine olandese, tedesca, spagnola, italiana, portoghese e di lingua inglese, da Sinterklaas al Ringraziamento.",
               "pt-br": "O que as famílias cozinham nos dias de festa e ao longo das estações nas cozinhas holandesa, alemã, espanhola, italiana, portuguesa e de língua inglesa, do Sinterklaas ao Dia de Ação de Graças."},
    "c_h1": {"en": "The food calendar of six kitchens", "nl": "De eetkalender van zes keukens", "de": "Der Essenskalender von sechs Küchen", "es": "El calendario de comida de seis cocinas", "it": "Il calendario del cibo di sei cucine", "pt-br": "O calendário da comida de seis cozinhas"},
    "c_lead": {"en": "The feast days and seasons of six kitchens, and what is on the table, month by month.", "nl": "De feestdagen en seizoenen van zes keukens, en wat er op tafel staat, maand voor maand.", "de": "Die Festtage und Jahreszeiten von sechs Küchen und was auf den Tisch kommt, Monat für Monat.", "es": "Las fiestas y estaciones de seis cocinas, y lo que hay en la mesa, mes a mes.", "it": "Le feste e le stagioni di sei cucine, e cosa c'è in tavola, mese per mese.", "pt-br": "As festas e as estações de seis cozinhas, e o que vai à mesa, mês a mês."},
    "seasons": {"en": "Moving feasts and seasons", "nl": "Wisselende feestdagen en seizoenen", "de": "Bewegliche Feste und Jahreszeiten", "es": "Fiestas móviles y estaciones", "it": "Feste mobili e stagioni", "pt-br": "Festas móveis e estações"},
    # Christmas
    "x_title": {"en": "Christmas food in six kitchens, from Advent to Epiphany", "nl": "Kersteten in zes keukens, van advent tot Driekoningen", "de": "Weihnachtsessen in sechs Küchen, vom Advent bis Dreikönig", "es": "Comida de Navidad en seis cocinas, de Adviento a Reyes", "it": "Il cibo di Natale in sei cucine, dall'Avvento all'Epifania", "pt-br": "Comida de Natal em seis cozinhas, do Advento ao Dia de Reis"},
    "x_desc": {"en": "What families eat for Sinterklaas, Advent, Christmas Eve, Christmas Day and Epiphany in the Dutch, German, Spanish, Italian, Portuguese and English-language kitchens: the days and the dishes.",
               "nl": "Wat families eten met Sinterklaas, advent, kerstavond, Kerstmis en Driekoningen in de Nederlandse, Duitse, Spaanse, Italiaanse, Portugese en Engelstalige keuken: de dagen en de gerechten.",
               "de": "Was Familien zu Sinterklaas, im Advent, an Heiligabend, an Weihnachten und an Dreikönig essen, in der niederländischen, deutschen, spanischen, italienischen, portugiesischen und englischsprachigen Küche: die Tage und die Gerichte.",
               "es": "Qué comen las familias en Sinterklaas, Adviento, Nochebuena, Navidad y Reyes en las cocinas neerlandesa, alemana, española, italiana, portuguesa y de habla inglesa: los días y los platos.",
               "it": "Cosa mangiano le famiglie per Sinterklaas, l'Avvento, la Vigilia, Natale e l'Epifania nelle cucine olandese, tedesca, spagnola, italiana, portoghese e di lingua inglese: i giorni e i piatti.",
               "pt-br": "O que as famílias comem no Sinterklaas, no Advento, na véspera de Natal, no Natal e no Dia de Reis nas cozinhas holandesa, alemã, espanhola, italiana, portuguesa e de língua inglesa: os dias e os pratos."},
    "x_h1": {"en": "Christmas food in six kitchens", "nl": "Kersteten in zes keukens", "de": "Weihnachtsessen in sechs Küchen", "es": "Comida de Navidad en seis cocinas", "it": "Il cibo di Natale in sei cucine", "pt-br": "Comida de Natal em seis cozinhas"},
    "x_lead": {"en": "From Advent and Sinterklaas to Christmas Eve, Christmas Day and Epiphany: the days six kitchens celebrate, and the dishes they cook for them.",
               "nl": "Van advent en Sinterklaas tot kerstavond, Kerstmis en Driekoningen: de dagen die zes keukens vieren, en de gerechten die ze ervoor koken.",
               "de": "Vom Advent und Sinterklaas bis Heiligabend, Weihnachten und Dreikönig: die Tage, die sechs Küchen feiern, und die Gerichte, die sie dafür kochen.",
               "es": "Del Adviento y Sinterklaas a Nochebuena, Navidad y Reyes: los días que celebran seis cocinas y los platos que preparan para ellos.",
               "it": "Dall'Avvento e Sinterklaas alla Vigilia, a Natale e all'Epifania: i giorni che sei cucine festeggiano e i piatti che preparano per l'occasione.",
               "pt-br": "Do Advento e do Sinterklaas à véspera de Natal, ao Natal e ao Dia de Reis: os dias que seis cozinhas celebram e os pratos que preparam para eles."},
    "x_days": {"en": "The days", "nl": "De dagen", "de": "Die Tage", "es": "Los días", "it": "I giorni", "pt-br": "Os dias"},
    "x_dishes": {"en": "The dishes", "nl": "De gerechten", "de": "Die Gerichte", "es": "Los platos", "it": "I piatti", "pt-br": "Os pratos"},
    # the fridge
    "f_title": {"en": "What can I cook with what I have? Ideas from your fridge", "nl": "Wat kan ik koken met wat ik heb? Ideeën uit je koelkast", "de": "Was kann ich mit dem kochen, was ich habe? Ideen aus deinem Kühlschrank", "es": "¿Qué puedo cocinar con lo que tengo? Ideas desde tu nevera", "it": "Cosa posso cucinare con quello che ho? Idee dal tuo frigo", "pt-br": "O que posso cozinhar com o que tenho? Ideias da sua geladeira"},
    "f_desc": {"en": "Dinner from what is in your fridge: dishes from six kitchens for potatoes and eggs, chicken and rice, pasta and tomatoes, and more. Or type your own ingredients in Busy Kitchen, free.",
               "nl": "Eten uit je koelkast: gerechten uit zes keukens voor aardappelen en eieren, kip en rijst, pasta en tomaten, en meer. Of typ je eigen ingrediënten in Busy Kitchen, gratis.",
               "de": "Abendessen aus deinem Kühlschrank: Gerichte aus sechs Küchen für Kartoffeln und Eier, Hähnchen und Reis, Nudeln und Tomaten und mehr. Oder gib deine eigenen Zutaten in Busy Kitchen ein, kostenlos.",
               "es": "La cena con lo que hay en tu nevera: platos de seis cocinas para patatas y huevos, pollo y arroz, pasta y tomates, y más. O escribe tus propios ingredientes en Busy Kitchen, gratis.",
               "it": "La cena con quello che hai in frigo: piatti di sei cucine per patate e uova, pollo e riso, pasta e pomodori, e altro. Oppure scrivi i tuoi ingredienti in Busy Kitchen, gratis.",
               "pt-br": "O jantar com o que tem na geladeira: pratos de seis cozinhas para batatas e ovos, frango e arroz, massa e tomates, e mais. Ou digite os seus ingredientes no Busy Kitchen, grátis."},
    "f_h1": {"en": "What can I cook with what I have?", "nl": "Wat kan ik koken met wat ik heb?", "de": "Was kann ich mit dem kochen, was ich habe?", "es": "¿Qué puedo cocinar con lo que tengo?", "it": "Cosa posso cucinare con quello che ho?", "pt-br": "O que posso cozinhar com o que tenho?"},
    "f_lead": {"en": "Find the line that looks like your fridge. Every dish below has a recipe in Busy Kitchen; type your own ingredients there, in any of six languages, and see what you can cook now.",
               "nl": "Zoek de regel die op jouw koelkast lijkt. Elk gerecht hieronder heeft een recept in Busy Kitchen; typ daar je eigen ingrediënten, in een van de zes talen, en zie wat je nu kunt koken.",
               "de": "Such dir die Zeile, die nach deinem Kühlschrank aussieht. Jedes Gericht unten hat ein Rezept in Busy Kitchen; gib dort deine eigenen Zutaten ein, in einer der sechs Sprachen, und sieh, was du jetzt kochen kannst.",
               "es": "Busca la línea que se parece a tu nevera. Cada plato de abajo tiene receta en Busy Kitchen; escribe allí tus propios ingredientes, en cualquiera de los seis idiomas, y mira qué puedes cocinar ahora.",
               "it": "Trova la riga che somiglia al tuo frigo. Ogni piatto qui sotto ha una ricetta in Busy Kitchen; scrivi lì i tuoi ingredienti, in una delle sei lingue, e guarda cosa puoi cucinare adesso.",
               "pt-br": "Encontre a linha que parece com a sua geladeira. Cada prato abaixo tem receita no Busy Kitchen; digite lá os seus ingredientes, em qualquer um dos seis idiomas, e veja o que dá para cozinhar agora."},
    "f_try": {"en": "🧊 Type what's in your fridge", "nl": "🧊 Typ wat er in je koelkast ligt", "de": "🧊 Gib ein, was in deinem Kühlschrank ist", "es": "🧊 Escribe lo que hay en tu nevera", "it": "🧊 Scrivi cosa c'è nel tuo frigo", "pt-br": "🧊 Digite o que tem na sua geladeira"},
    "guides": {"en": "Guides to the six kitchens", "nl": "Gidsen voor de zes keukens", "de": "Wegweiser zu den sechs Küchen", "es": "Guías de las seis cocinas", "it": "Guide alle sei cucine", "pt-br": "Guias das seis cozinhas"},
}
MONTHS = {
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "nl": ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"],
    "de": ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    "es": ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
    "it": ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
    "pt-br": ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
}
# The fridges people have most often: what the line is called, and what a dish's English ingredient list must hold
# (each item is one word, or a tuple of words of which one is enough).
FRIDGES = [
    ({"en": "Potatoes, onions and eggs", "nl": "Aardappelen, uien en eieren", "de": "Kartoffeln, Zwiebeln und Eier", "es": "Patatas, cebollas y huevos", "it": "Patate, cipolle e uova", "pt-br": "Batatas, cebolas e ovos"}, ["potato", "onion", "egg"]),
    ({"en": "Minced meat and potatoes", "nl": "Gehakt en aardappelen", "de": "Hackfleisch und Kartoffeln", "es": "Carne picada y patatas", "it": "Carne macinata e patate", "pt-br": "Carne moída e batatas"}, [("mince", "minced", "ground beef", "ground meat", "ground pork"), "potato"]),
    ({"en": "Chicken and rice", "nl": "Kip en rijst", "de": "Hähnchen und Reis", "es": "Pollo y arroz", "it": "Pollo e riso", "pt-br": "Frango e arroz"}, ["chicken", "rice"]),
    ({"en": "Pasta and tomatoes", "nl": "Pasta en tomaten", "de": "Nudeln und Tomaten", "es": "Pasta y tomates", "it": "Pasta e pomodori", "pt-br": "Massa e tomates"}, [("pasta", "spaghetti", "macaroni", "penne", "tagliatelle", "noodles"), "tomato"]),
    ({"en": "Eggs, cheese and bread", "nl": "Eieren, kaas en brood", "de": "Eier, Käse und Brot", "es": "Huevos, queso y pan", "it": "Uova, formaggio e pane", "pt-br": "Ovos, queijo e pão"}, ["egg", "cheese", "bread"]),
    ({"en": "Cabbage and sausage", "nl": "Kool en worst", "de": "Kohl und Wurst", "es": "Col y salchicha", "it": "Cavolo e salsiccia", "pt-br": "Repolho e linguiça"}, [("cabbage", "kale", "sauerkraut"), ("sausage", "worst", "wurst", "chorizo", "linguiça")]),
    ({"en": "Beans and rice", "nl": "Bonen en rijst", "de": "Bohnen und Reis", "es": "Frijoles y arroz", "it": "Fagioli e riso", "pt-br": "Feijão e arroz"}, ["bean", "rice"]),
    ({"en": "Fish and potatoes", "nl": "Vis en aardappelen", "de": "Fisch und Kartoffeln", "es": "Pescado y patatas", "it": "Pesce e patate", "pt-br": "Peixe e batatas"}, [("fish", "cod", "herring", "salmon", "haddock", "bacalhau", "hake"), "potato"]),
    ({"en": "Lentils or chickpeas", "nl": "Linzen of kikkererwten", "de": "Linsen oder Kichererbsen", "es": "Lentejas o garbanzos", "it": "Lenticchie o ceci", "pt-br": "Lentilhas ou grão-de-bico"}, [("lentil", "chickpea")]),
    ({"en": "Apples that need using up", "nl": "Appels die op moeten", "de": "Äpfel, die wegmüssen", "es": "Manzanas que hay que gastar", "it": "Mele da finire", "pt-br": "Maçãs que precisam ser usadas"}, ["apple"]),
]
NOT_DINNER = re.compile(r"drink|cheese|liqueur", re.I)
CHRISTMAS = re.compile(r"\b(Dec|December|Christmas|Xmas|Advent|Sinterklaas|Nikolaus|St Nicholas|Saint Nicholas|Epiphany|Twelfth|Reyes|Natal|Natale|Navidad|Nochebuena|Weihnacht|Kerst)\b|\b6 Jan", re.I)
MONTH_RX = re.compile(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b")


def _load(path: Path, var: str):
    text = path.read_text()
    return json.JSONDecoder().raw_decode(text, text.index(f"window.{var} = ") + len(f"window.{var} = "))[0]


def data() -> dict:
    """The kitchens and dishes in English, and per language the same things translated, parallel to the English."""
    d = _load(APP / "shared" / "kitchen-data.js", "BW_KITCHEN")
    d["tr"] = {}
    for lang in LANGS:
        det = APP / "shared" / "kitchen" / f"details-{lang}.js"
        d["tr"][lang] = {"i18n": d["i18n"].get(lang, {}), "details": _load(det, "BW_KITCHEN_DETAILS") if det.exists() else {"kitchens": {}, "dishes": {}}}
    return d


def t(key: str, lang: str = "en", **kw) -> str:
    return T[key][lang].format(**kw)


def dish_head(d: dict, lang: str = "en", tr: dict = None) -> str:
    """A dish's heading: its own name, and what it is in the reader's language where that is said."""
    gloss = d.get("en", "") if lang == "en" else ((tr or {}).get("en") or "")
    return d["name"] + (f" · {gloss}" if gloss else "")


def month_of(when: str):
    m = MONTH_RX.search(when or "")
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].index(m.group(1)) if m else None


def fridge_dishes(d: dict, need: list, limit: int = 8) -> list:
    """The dishes whose ingredient list has everything on the line: from as many kitchens as there are, in turn."""
    def has(ing, item):
        words = item if isinstance(item, tuple) else (item,)
        return any(w in ing for w in words)
    hits = [x for x in d["dishes"] if x.get("ing") and not NOT_DINNER.search(x.get("type", "")) and all(has(x["ing"].lower(), i) for i in need)]
    by_k = {}
    for x in hits:
        by_k.setdefault(x["k"], []).append(x)
    out, i = [], 0
    while len(out) < limit and any(len(v) > i for v in by_k.values()):
        for k in PAGES:
            if k in by_k and len(by_k[k]) > i and len(out) < limit:
                out.append(by_k[k][i])
        i += 1
    return out


def christmas(d: dict) -> tuple:
    """(the days: [(kitchen, entry, index)], the dishes) from Advent to Epiphany, in the six kitchens."""
    days = [(k, c, i) for k in d["kitchens"] for i, c in enumerate(k["calendar"]) if CHRISTMAS.search(c["when"] + " " + c.get("feast", "")) and (month_of(c["when"]) in (None, 11, 0))]
    dishes = [x for x in d["dishes"] if CHRISTMAS.search(x.get("when", ""))]

    def order(row):  # Advent and December first, then January; the first number in the date within the month
        m = month_of(row[1]["when"])
        day = re.search(r"\d+", row[1]["when"])
        return (0 if m in (None, 11) else 1, int(day.group()) if day else 0)
    return sorted(days, key=order), dishes


def words(d: dict, lang: str) -> dict:
    """Every piece of text these pages show, English: translation, for one language."""
    out = {}

    def put(en, tr):
        if en and tr and en not in out:
            out[re.sub(r"\s+", " ", en).strip()] = re.sub(r"\s+", " ", tr).strip()
    for key, v in T.items():
        if "{" not in v["en"]:
            put(v["en"], v[lang])
    for k in d["kitchens"]:
        lab = LABEL[k["id"]]
        n = sum(1 for x in d["dishes"] if x["k"] == k["id"])
        put(lab["en"], lab[lang])
        put(f"{k['flag']} {lab['en']}", f"{k['flag']} {lab[lang]}")
        for key in ("k_title", "k_desc", "k_h1"):
            put(t(key, label=lab["en"], n=n), t(key, lang, label=lab[lang], n=n))
        put(t("dishes_h", n=n), t("dishes_h", lang, n=n))
        tk = d["tr"][lang]["i18n"].get("kitchens", {}).get(k["id"], {})
        for f in ("name", "line", "say"):
            put(k.get(f), tk.get(f))
        for en_p, tr_p in zip(k.get("story", []), tk.get("story", [])):
            put(en_p, tr_p)
        caps = d["tr"][lang]["i18n"].get("captions", {})
        for p in k.get("pictures", []):
            put(p["title"], caps.get(p["id"]))
        det = d["tr"][lang]["details"]["kitchens"].get(k["id"], {})
        for part in ("regions", "pantry", "customs"):
            for a, b in zip(k.get(part, []), det.get(part, [])):
                put(a.get("t"), b.get("t")); put(a.get("s"), b.get("s"))
        for a, b in zip(k.get("calendar", []), det.get("calendar", [])):
            put(a.get("when"), b.get("when")); put(a.get("what"), b.get("what")); put(a.get("feast"), b.get("feast"))
    for x in d["dishes"]:
        tr = d["tr"][lang]["details"]["dishes"].get(x["id"], {})
        put(dish_head(x), dish_head(x, lang, tr))
        put(x["name"], x["name"])
        for f in ("where", "when", "ing", "story", "eaten"):
            put(x.get(f), tr.get(f))
        put(x.get("prot"), tr.get("prot") or x.get("prot"))  # a protected name stays a name
    for em, key in (("📅", "c_h1"), ("🎄", "x_h1"), ("🧊", "f_h1")):
        put(f"{em} {T[key]['en']}", f"{em} {T[key][lang]}")
    for i, m in enumerate(MONTHS["en"]):
        put(m, MONTHS[lang][i])
    for names, _ in FRIDGES:
        put(names["en"], names[lang])
    # a line whose translation is missing in the data shows in English rather than not at all
    return out


def write_words(d: dict, folder: Path) -> int:
    folder.mkdir(parents=True, exist_ok=True)
    n = 0
    for lang in LANGS:
        w = words(d, lang)
        (folder / f"{lang}.json").write_text(json.dumps(w, ensure_ascii=False, indent=0, sort_keys=True) + "\n")
        n = max(n, len(w))
    return n


# ---------- the pages ----------
def pages(d: dict, ctx: dict) -> list:
    """Writes the pages into website/kitchen/ and returns their addresses. ctx holds build.py's helpers: head, nav,
    footer, e, jsonld, kitchen_img, SITE, SITE_URL, tools."""
    e, SITE = ctx["e"], ctx["SITE"]
    pre = "../"
    out = []
    kitchens = {k["id"]: k for k in d["kitchens"]}

    def shell(rel, title, desc, body, ld):
        page = (ctx["head"](title, desc, rel, pre, extra=MARK + "\n" + ld, image="og-kitchen.png")
                + f'\n<body class="site app-sun">\n{ctx["nav"](pre, ("🍳 Open free", "index.html#get"))}\n<main id="main">\n{body}\n</main>\n'
                + f'{ctx["footer"](pre, ctx["tools"])}\n<script src="{pre}assets/site.js"></script>\n</body>\n</html>\n')
        (SITE / rel).write_text(page)
        out.append(rel)

    def crumbs(rel, name):
        return ctx["jsonld"]({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Busy Kitchen", "item": f"{ctx['SITE_URL']}/kitchen/"},
            {"@type": "ListItem", "position": 2, "name": name, "item": f"{ctx['SITE_URL']}/{rel}"}]})

    def cta():
        return (f'<section class="section"><div class="wrap"><div class="card ivy-card reveal"><span style="font-size:3.4rem" aria-hidden="true">🍳</span>'
                f'<div><h2>{e(t("cta_h"))}</h2><p>{e(t("cta_p"))}</p><p class="row-flex" style="margin-top:14px"><a class="btn btn-primary" href="{pre}app/kitchen.html">{e(t("open"))}</a>'
                f'<a class="btn" href="index.html">{e(t("about"))}</a></p></div></div></div></section>')

    def guides(here):
        links = [(f"{PAGES[k['id']]}.html", f"{k['flag']} {LABEL[k['id']]['en']}") for k in d["kitchens"]]
        links += [("food-calendar.html", "📅 " + t("c_h1")), ("christmas-food.html", "🎄 " + t("x_h1")), ("what-to-cook.html", "🧊 " + t("f_h1"))]
        items = "".join(f'<li><a href="{h}">{e(n)}</a></li>' for h, n in links if h != here)
        return f'<section class="section"><div class="wrap"><h2>{e(t("others"))}</h2><ul class="get-list">{items}</ul></div></section>'

    def dish_li(x, link=False):
        k = kitchens[x["k"]]
        head = e(dish_head(x))
        if link:
            head = f'<a href="{PAGES[x["k"]]}.html#{x["id"]}">{head}</a>'
        meta = "".join(f'<p><b>{e(t(f))}</b> {e(x[f])}</p>' for f in ("where", "when") if x.get(f))
        return (f'<li class="card dish" id="{x["id"]}"><h3>{"" if not link else k["flag"] + " "}{head}</h3>{meta}'
                + (f'<p>{e(x["story"])}</p>' if x.get("story") else "")
                + (f'<p><b>{e(t("ing"))}</b> {e(x["ing"])}</p>' if x.get("ing") else "")
                + (f'<p><b>{e(t("eaten"))}</b> {e(x["eaten"])}</p>' if x.get("eaten") else "")
                + (f'<p><b>{e(t("prot"))}</b> {e(x["prot"])}</p>' if x.get("prot") else "") + "</li>")

    def pairs(items, h):
        rows = "".join(f'<li><b>{e(a["t"])}</b> {e(a["s"])}</li>' for a in items if a.get("t"))
        return f'<section class="section"><div class="wrap"><h2>{e(h)}</h2><ul class="facts">{rows}</ul></div></section>' if rows else ""

    # one page per kitchen
    for k in d["kitchens"]:
        rel = f"kitchen/{PAGES[k['id']]}.html"
        lab = LABEL[k["id"]]["en"]
        dishes = sorted((x for x in d["dishes"] if x["k"] == k["id"]), key=lambda x: x["name"].lower())
        n = len(dishes)
        pic = (k.get("pictures") or [{"id": "", "title": ""}])[0]
        story = "".join(f"<p>{e(p)}</p>" for p in k.get("story", []))
        cal = "".join(f'<li><b>{e(c["when"])}</b> {e(c["what"])}</li>' for c in k.get("calendar", []) if c.get("what"))
        body = f"""  <section class="tool-hero"><div class="wrap tool-hero-grid">
    <div class="reveal from-left"><p class="kicker">{e(t("kicker"))}</p><h1>{e(t("k_h1", label=lab))}</h1>
      <p class="lead">{e(k["line"])}</p>
      <div class="ctas"><a class="btn btn-primary btn-big" href="{pre}app/kitchen.html">{e(t("open"))}</a></div></div>
    <div class="stage solo reveal from-right"><figure class="tool-room">{ctx["kitchen_img"](pic["id"], pic["title"], pre, "(max-width: 600px) 50vw, 560px", False)}</figure><p class="faint">{e(t("pics"))}</p></div>
  </div></section>
  <section class="section"><div class="wrap kitchen-story">{story}</div></section>
  <section class="section"><div class="wrap"><h2>{e(t("say"))}</h2><p>{e(k.get("say", ""))}</p></div></section>
{pairs(k.get("regions", []), t("regions"))}
{pairs(k.get("customs", []), t("customs"))}
{pairs(k.get("pantry", []), t("pantry"))}
  <section class="section"><div class="wrap"><h2>{e(t("calendar"))}</h2><ul class="facts">{cal}</ul></div></section>
  <section class="section" id="dishes"><div class="wrap"><h2>{e(t("dishes_h", n=n))}</h2><p class="lead">{e(t("dishes_p"))}</p>
    <ul class="dish-list">{"".join(dish_li(x) for x in dishes)}</ul><p class="faint">{e(t("notes"))}</p></div></section>
{cta()}
{guides(PAGES[k['id']] + ".html")}"""
        title, desc = t("k_title", label=lab, n=n), t("k_desc", label=lab, n=n)
        ld = ctx["jsonld"]({"@context": "https://schema.org", "@type": "CollectionPage", "name": title, "description": desc, "url": f"{ctx['SITE_URL']}/{rel}",
                            "about": {"@type": "Thing", "name": lab}}) + crumbs(rel, lab)
        shell(rel, title, desc, body, ld)

    # the food calendar, month by month
    months = [[] for _ in range(13)]
    for k in d["kitchens"]:
        for c in k.get("calendar", []):
            if c.get("what"):
                m = month_of(c["when"])
                months[12 if m is None else m].append((k, c))
    blocks = ""
    for i, rows in enumerate(months):
        if rows:
            h = MONTHS["en"][i] if i < 12 else t("seasons")
            lis = "".join(f'<li>{k["flag"]} <b>{e(c["when"])}</b> {e(c["what"])} <a href="{PAGES[k["id"]]}.html">{e(LABEL[k["id"]]["en"])}</a></li>' for k, c in rows)
            blocks += f'<section class="section"><div class="wrap"><h2>{e(h)}</h2><ul class="facts">{lis}</ul></div></section>\n'
    body = f"""  <section class="tool-hero"><div class="wrap"><p class="kicker">{e(t("kicker"))}</p><h1>{e(t("c_h1"))}</h1><p class="lead">{e(t("c_lead"))}</p>
    <div class="ctas"><a class="btn btn-primary btn-big" href="{pre}app/kitchen-calendar.html">{e(t("open"))}</a></div></div></section>
{blocks}{cta()}
{guides("food-calendar.html")}"""
    rel = "kitchen/food-calendar.html"
    shell(rel, t("c_title"), t("c_desc"), body, ctx["jsonld"]({"@context": "https://schema.org", "@type": "CollectionPage", "name": t("c_title"), "description": t("c_desc"), "url": f"{ctx['SITE_URL']}/{rel}"}) + crumbs(rel, t("c_h1")))

    # Christmas, from Advent to Epiphany
    days, xdishes = christmas(d)
    xgroups = "".join(f'<h3 style="margin-top:22px">{k["flag"]} <a href="{PAGES[k["id"]]}.html">{e(LABEL[k["id"]]["en"])}</a></h3><ul class="dish-list">'
                      + "".join(dish_li(x) for x in xdishes if x["k"] == k["id"]) + "</ul>" for k in d["kitchens"] if any(x["k"] == k["id"] for x in xdishes))
    dl = "".join(f'<li>{k["flag"]} <b>{e(c["when"])}</b> {e(c["what"])}</li>' for k, c, _ in days)
    body = f"""  <section class="tool-hero"><div class="wrap"><p class="kicker">{e(t("kicker"))}</p><h1>{e(t("x_h1"))}</h1><p class="lead">{e(t("x_lead"))}</p>
    <div class="ctas"><a class="btn btn-primary btn-big" href="{pre}app/kitchen.html">{e(t("open"))}</a></div></div></section>
  <section class="section"><div class="wrap"><h2>{e(t("x_days"))}</h2><ul class="facts">{dl}</ul></div></section>
  <section class="section"><div class="wrap"><h2>{e(t("x_dishes"))}</h2>{xgroups}<p class="faint">{e(t("notes"))}</p></div></section>
{cta()}
{guides("christmas-food.html")}"""
    rel = "kitchen/christmas-food.html"
    shell(rel, t("x_title"), t("x_desc"), body, ctx["jsonld"]({"@context": "https://schema.org", "@type": "CollectionPage", "name": t("x_title"), "description": t("x_desc"), "url": f"{ctx['SITE_URL']}/{rel}"}) + crumbs(rel, t("x_h1")))

    # what to cook with what you have
    blocks = ""
    for names, need in FRIDGES:
        found = fridge_dishes(d, need)
        if found:
            blocks += f'<section class="section"><div class="wrap"><h2>{e(names["en"])}</h2><ul class="dish-list">{"".join(dish_li(x, True) for x in found)}</ul></div></section>\n'
    body = f"""  <section class="tool-hero"><div class="wrap"><p class="kicker">{e(t("kicker"))}</p><h1>{e(t("f_h1"))}</h1><p class="lead">{e(t("f_lead"))}</p>
    <div class="ctas"><a class="btn btn-primary btn-big" href="{pre}app/kitchen.html">{e(t("f_try"))}</a></div></div></section>
{blocks}{cta()}
{guides("what-to-cook.html")}"""
    rel = "kitchen/what-to-cook.html"
    shell(rel, t("f_title"), t("f_desc"), body, ctx["jsonld"]({"@context": "https://schema.org", "@type": "CollectionPage", "name": t("f_title"), "description": t("f_desc"), "url": f"{ctx['SITE_URL']}/{rel}"}) + crumbs(rel, t("f_h1")))
    return out


def links() -> list:
    """(address inside kitchen/, English name) of every page here, for the Kitchen front page and the footer."""
    return [(f"{v}.html", LABEL[k]["en"]) for k, v in PAGES.items()] + [("food-calendar.html", T["c_h1"]["en"]), ("christmas-food.html", T["x_h1"]["en"]), ("what-to-cook.html", T["f_h1"]["en"])]
