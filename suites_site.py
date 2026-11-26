"""Pages for search from the apps' own content: Busy Home, Busy Rentals, Busy Growth and Busy Business.

The same method as kitchen_site.py (see `Busy HQ/strategy report.md`): the apps hold checklists, letters, country rules
and questions that live under /app/, which robots.txt keeps out of search. These pages put them where a search engine
can read them, one page per search people make. The content comes from the apps themselves (content_site/dump.js runs
the apps' shared files the way the tests do, and calls the invoice emails with fill-in labels), so a page can never
say more than the app does. Its words are already in i18n/<lang>.json; the pages' own sentences are translated here
(T), and the letters and emails, written per language in the apps, are matched up here (words()).

Pages carry <meta name="busy-words" content="data">, like Busy Kitchen's, so `i18n.py extract` leaves them out."""
import datetime
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LANGS = ["nl", "de", "es", "it", "pt-br"]
ALL = ["en"] + LANGS
MARK = '<meta name="busy-words" content="data">'


def tr(en, nl, de, es, it, pt):
    return {"en": en, "nl": nl, "de": de, "es": es, "it": it, "pt-br": pt}


def dump() -> dict:
    """The apps' content as plain data (content_site/dump.js), and the invoice emails in six languages."""
    run = lambda *a: json.loads(subprocess.run(["node", str(ROOT / "content_site" / "dump.js"), *a], capture_output=True, text=True, check=True, cwd=ROOT).stdout)
    d = run()
    d["mails"] = run("mails")
    return d


SUITES = {
    "home": {"name": "Busy Home", "emoji": "🏡", "get": "home/index.html#get", "demo": "app/home.html", "og": "og-home.png"},
    "rentals": {"name": "Busy Rentals", "emoji": "🔑", "get": "rentals/index.html#get", "demo": "app/rentals.html", "og": "og-rentals.png"},
    "growth": {"name": "Busy Growth", "emoji": "🌱", "get": "growth/index.html#get", "demo": "app/growth.html", "og": "og-growth.png"},
    "business": {"name": "Busy Business", "emoji": "💼", "get": "business/index.html#get", "demo": "app/index.html", "og": "og-business.png"},
}

T = {
    "get": tr("Get {name} free", "Download {name} gratis", "{name} kostenlos holen", "Consigue {name} gratis", "Scarica {name} gratis", "Baixe o {name} grátis"),
    "demo": tr("See it in the demo", "Bekijk het in de demo", "In der Demo ansehen", "Míralo en la demo", "Guardalo nella demo", "Veja na demonstração"),
    "free": tr("Free, private, no account. Everything stays in a folder on your own computer.", "Gratis, privé, zonder account. Alles blijft in een map op je eigen computer.",
               "Kostenlos, privat, ohne Konto. Alles bleibt in einem Ordner auf deinem eigenen Computer.", "Gratis, privado, sin cuenta. Todo se queda en una carpeta de tu propio ordenador.",
               "Gratis, privato, senza account. Tutto resta in una cartella sul tuo computer.", "Grátis, privado, sem conta. Tudo fica numa pasta no seu próprio computador."),
    "more": tr("More checklists and templates", "Meer checklists en sjablonen", "Weitere Checklisten und Vorlagen", "Más listas y plantillas", "Altre liste e modelli", "Mais listas e modelos"),
    "letter_how": tr("How to use it", "Zo gebruik je het", "So benutzt du sie", "Cómo usarla", "Come usarla", "Como usar"),
    "letter_1": tr("Copy the letter and fill in the parts in [brackets].", "Kopieer de brief en vul de delen tussen [haken] in.", "Kopiere den Brief und fülle die Teile in [Klammern] aus.",
                   "Copia la carta y rellena las partes entre [corchetes].", "Copia la lettera e compila le parti tra [parentesi].", "Copie a carta e preencha as partes entre [colchetes]."),
    "letter_2": tr("Send it by email or registered post, and keep a copy with the date you sent it.", "Stuur hem per e-mail of aangetekend, en bewaar een kopie met de datum waarop je hem verstuurde.",
                   "Schick ihn per E-Mail oder Einschreiben und bewahre eine Kopie mit dem Versanddatum auf.", "Envíala por correo electrónico o certificado, y guarda una copia con la fecha de envío.",
                   "Inviala per email o raccomandata, e conserva una copia con la data di invio.", "Envie por e-mail ou carta registrada e guarde uma cópia com a data de envio."),
    "letter_3": tr("A template, not legal advice. For a large amount or a dispute, ask someone who knows the rules where you live.", "Een sjabloon, geen juridisch advies. Bij een groot bedrag of een geschil vraag je iemand die de regels kent waar je woont.",
                   "Eine Vorlage, keine Rechtsberatung. Bei einem großen Betrag oder einem Streit frag jemanden, der die Regeln bei dir vor Ort kennt.", "Una plantilla, no asesoría legal. Para un importe grande o un conflicto, pregunta a alguien que conozca las normas de donde vives.",
                   "Un modello, non una consulenza legale. Per un importo alto o una controversia, chiedi a qualcuno che conosce le regole del posto in cui vivi.", "Um modelo, não uma orientação jurídica. Para um valor alto ou um conflito, consulte alguém que conheça as regras de onde você mora."),
    "letter_app": tr("In the app, the letter fills itself in with your details and keeps a copy where you will find it again.", "In de app vult de brief zich met jouw gegevens en bewaar je een kopie waar je hem terugvindt.",
                     "In der App füllt sich der Brief mit deinen Angaben aus, und eine Kopie liegt dort, wo du sie wiederfindest.", "En la app, la carta se rellena con tus datos y guarda una copia donde la volverás a encontrar.",
                     "Nell'app la lettera si compila con i tuoi dati e ne conserva una copia dove la ritroverai.", "No app, a carta se preenche com os seus dados e guarda uma cópia onde você vai encontrá-la de novo."),
    "letter_kicker": tr("A free letter template, in six languages", "Een gratis briefsjabloon, in zes talen", "Eine kostenlose Briefvorlage, in sechs Sprachen", "Una plantilla de carta gratis, en seis idiomas", "Un modello di lettera gratis, in sei lingue", "Um modelo de carta grátis, em seis idiomas"),
    "checklist_kicker": tr("A free checklist", "Een gratis checklist", "Eine kostenlose Checkliste", "Una lista gratis", "Una lista gratuita", "Uma lista grátis"),
    "source": tr("Source", "Bron", "Quelle", "Fuente", "Fonte", "Fonte"),
    "letter_h": tr("The letter", "De brief", "Der Brief", "La carta", "La lettera", "A carta"),
    "b_sections": tr("The eight sections", "De acht onderdelen", "Die acht Teile", "Las ocho secciones", "Le otto sezioni", "As oito seções"),
    "changing": tr("Changing", "Verandert", "Ändert sich", "En cambio", "In cambiamento", "Em mudança"),
    # moving
    "m_title": tr("Who to tell when you move, and a moving timeline", "Wie je inlicht als je verhuist, en een verhuisplanning", "Wen du beim Umzug informieren musst, und ein Umzugsplan",
                  "A quién avisar cuando te mudas, y un calendario de mudanza", "Chi avvisare quando traslochi, e un programma del trasloco", "Quem avisar quando você se muda, e um cronograma da mudança"),
    "m_desc": tr("Everyone to tell about your new address, and what to do from eight weeks before moving day to a month after. Free, with a planner that sets the dates for you.",
                 "Iedereen die je nieuwe adres moet weten, en wat je doet van acht weken voor de verhuisdag tot een maand erna. Gratis, met een planner die de datums voor je zet.",
                 "Alle, die deine neue Adresse brauchen, und was zu tun ist, von acht Wochen vor dem Umzugstag bis einen Monat danach. Kostenlos, mit einem Planer, der die Daten für dich setzt.",
                 "Todos a quienes avisar de tu nueva dirección, y qué hacer desde ocho semanas antes del día de la mudanza hasta un mes después. Gratis, con un planificador que pone las fechas por ti.",
                 "Tutti quelli da avvisare del nuovo indirizzo, e cosa fare da otto settimane prima del trasloco a un mese dopo. Gratis, con un planner che fissa le date per te.",
                 "Todos que precisam saber o seu novo endereço, e o que fazer de oito semanas antes da mudança até um mês depois. Grátis, com um planejador que define as datas para você."),
    "m_who": tr("Who to tell", "Wie je inlicht", "Wen du informierst", "A quién avisar", "Chi avvisare", "Quem avisar"),
    "m_when": tr("What to do, and when", "Wat je doet, en wanneer", "Was zu tun ist, und wann", "Qué hacer, y cuándo", "Cosa fare, e quando", "O que fazer, e quando"),
    "weeks_before": tr("{n} weeks before", "{n} weken ervoor", "{n} Wochen vorher", "{n} semanas antes", "{n} settimane prima", "{n} semanas antes"),
    "week_before": tr("The week before", "De week ervoor", "Die Woche davor", "La semana anterior", "La settimana prima", "A semana anterior"),
    "days_before": tr("{n} days before", "{n} dagen ervoor", "{n} Tage vorher", "{n} días antes", "{n} giorni prima", "{n} dias antes"),
    "day_before": tr("The day before", "De dag ervoor", "Am Tag davor", "El día anterior", "Il giorno prima", "O dia anterior"),
    "moving_day": tr("Moving day", "Verhuisdag", "Umzugstag", "El día de la mudanza", "Il giorno del trasloco", "O dia da mudança"),
    "days_after": tr("{n} days after", "{n} dagen erna", "{n} Tage danach", "{n} días después", "{n} giorni dopo", "{n} dias depois"),
    "weeks_after": tr("{n} weeks after", "{n} weken erna", "{n} Wochen danach", "{n} semanas después", "{n} settimane dopo", "{n} semanas depois"),
    "month_after": tr("A month after", "Een maand erna", "Einen Monat danach", "Un mes después", "Un mese dopo", "Um mês depois"),
    # binder
    "b_title": tr("What to put in an emergency binder: a checklist", "Wat er in een noodmap hoort: een checklist", "Was in einen Notfallordner gehört: eine Checkliste",
                  "Qué guardar en una carpeta de emergencia: una lista", "Cosa mettere in un raccoglitore per le emergenze: una lista", "O que colocar numa pasta de emergência: uma lista"),
    "b_desc": tr("The eight things your family needs to find when you can't tell them: who to call, where things are, insurance, money, health, the house, pets and your wishes. Free checklist.",
                 "De acht dingen die je familie moet kunnen vinden als jij het niet kunt vertellen: wie te bellen, waar alles ligt, verzekeringen, geld, gezondheid, het huis, huisdieren en je wensen. Gratis checklist.",
                 "Die acht Dinge, die deine Familie finden muss, wenn du es ihr nicht sagen kannst: wen man anruft, wo alles liegt, Versicherungen, Geld, Gesundheit, das Haus, Haustiere und deine Wünsche. Kostenlose Checkliste.",
                 "Las ocho cosas que tu familia necesita encontrar cuando tú no puedas decírselo: a quién llamar, dónde está todo, seguros, dinero, salud, la casa, las mascotas y tus deseos. Lista gratis.",
                 "Le otto cose che la tua famiglia deve trovare quando tu non puoi dirglielo: chi chiamare, dove sono le cose, assicurazioni, soldi, salute, la casa, gli animali e le tue volontà. Lista gratuita.",
                 "As oito coisas que a sua família precisa encontrar quando você não puder contar: para quem ligar, onde as coisas estão, seguros, dinheiro, saúde, a casa, os pets e os seus desejos. Lista grátis."),
    "b_lead": tr("One folder, eight sections. Where things are, never the codes themselves.", "Eén map, acht onderdelen. Waar alles ligt, nooit de codes zelf.", "Ein Ordner, acht Teile. Wo alles liegt, nie die Codes selbst.",
                 "Una carpeta, ocho secciones. Dónde está todo, nunca los códigos.", "Un raccoglitore, otto sezioni. Dove sono le cose, mai i codici.", "Uma pasta, oito seções. Onde as coisas estão, nunca os códigos."),
    # upkeep
    "u_title": tr("Home maintenance checklist: what to do, and how often", "Checklist onderhoud aan huis: wat, en hoe vaak", "Checkliste Hauswartung: was, und wie oft",
                  "Lista de mantenimiento del hogar: qué hacer y cada cuánto", "Lista di manutenzione della casa: cosa fare e ogni quanto", "Lista de manutenção da casa: o que fazer e com que frequência"),
    "u_desc": tr("The jobs that keep a home safe and save money later, from the boiler service to the gutters, with how often to do each one. Free, with reminders in the app.",
                 "De klussen die een huis veilig houden en later geld besparen, van de ketelservice tot de dakgoot, met hoe vaak je elke klus doet. Gratis, met herinneringen in de app.",
                 "Die Arbeiten, die ein Zuhause sicher halten und später Geld sparen, von der Heizungswartung bis zur Dachrinne, und wie oft jede fällig ist. Kostenlos, mit Erinnerungen in der App.",
                 "Las tareas que mantienen una casa segura y ahorran dinero después, de la revisión de la caldera a los canalones, con cada cuánto hacer cada una. Gratis, con recordatorios en la app.",
                 "I lavori che tengono la casa sicura e fanno risparmiare dopo, dalla revisione della caldaia alle grondaie, con ogni quanto farli. Gratis, con promemoria nell'app.",
                 "As tarefas que mantêm a casa segura e economizam dinheiro depois, da revisão da caldeira às calhas, com a frequência de cada uma. Grátis, com lembretes no app."),
    "every_year": tr("Every year", "Elk jaar", "Jedes Jahr", "Cada año", "Ogni anno", "Todo ano"),
    "every_months": tr("Every {n} months", "Elke {n} maanden", "Alle {n} Monate", "Cada {n} meses", "Ogni {n} mesi", "A cada {n} meses"),
    "every_years": tr("Every {n} years", "Elke {n} jaar", "Alle {n} Jahre", "Cada {n} años", "Ogni {n} anni", "A cada {n} anos"),
    "every_tenancy": tr("At the start of every tenancy", "Bij het begin van elke huurperiode", "Zu Beginn jedes Mietverhältnisses", "Al comienzo de cada alquiler", "All'inizio di ogni locazione", "No início de cada locação"),
    "each_tenancy": tr("For every tenancy", "Voor elke huurperiode", "Für jedes Mietverhältnis", "Para cada alquiler", "Per ogni locazione", "Para cada locação"),
    # landlord rules
    "r_lead": tr("The certificates and checks, the deposit, raising the rent, the tax and the landlord's year, each with its official source.",
                 "De certificaten en keuringen, de borg, de huurverhoging, de belasting en het jaar van de verhuurder, elk met de officiële bron.",
                 "Die Nachweise und Prüfungen, die Kaution, die Mieterhöhung, die Steuer und das Vermieterjahr, jeweils mit der offiziellen Quelle.",
                 "Los certificados y revisiones, la fianza, la subida del alquiler, los impuestos y el año del casero, cada uno con su fuente oficial.",
                 "I certificati e i controlli, la cauzione, l'aumento dell'affitto, le tasse e l'anno del proprietario, ognuno con la sua fonte ufficiale.",
                 "Os certificados e vistorias, a caução, o reajuste do aluguel, os impostos e o ano do proprietário, cada um com a sua fonte oficial."),
    "r_checked": tr("Checked on {date}. Rules change: always look at the official source before you act.", "Nagekeken op {date}. Regels veranderen: kijk altijd naar de officiële bron voordat je iets doet.",
                    "Geprüft am {date}. Regeln ändern sich: schau immer in die offizielle Quelle, bevor du handelst.", "Revisado el {date}. Las normas cambian: consulta siempre la fuente oficial antes de actuar.",
                    "Verificato il {date}. Le regole cambiano: guarda sempre la fonte ufficiale prima di agire.", "Conferido em {date}. As regras mudam: consulte sempre a fonte oficial antes de agir."),
    "r_duties": tr("Certificates and checks", "Certificaten en keuringen", "Nachweise und Prüfungen", "Certificados y revisiones", "Certificati e controlli", "Certificados e vistorias"),
    "r_deposit": tr("The deposit", "De borg", "Die Kaution", "La fianza", "La cauzione", "A caução"),
    "r_rent": tr("Raising the rent", "De huur verhogen", "Die Miete erhöhen", "Subir el alquiler", "Aumentare l'affitto", "Reajustar o aluguel"),
    "r_tax": tr("Tax", "Belasting", "Steuer", "Impuestos", "Tasse", "Impostos"),
    "r_year": tr("The landlord's year", "Het jaar van de verhuurder", "Das Vermieterjahr", "El año del casero", "L'anno del proprietario", "O ano do proprietário"),
    "r_know": tr("Worth knowing", "Goed om te weten", "Gut zu wissen", "Conviene saber", "Da sapere", "Bom saber"),
    "r_due": tr("Due: {date}", "Uiterlijk: {date}", "Fällig: {date}", "Fecha límite: {date}", "Scadenza: {date}", "Prazo: {date}"),
    "r_protect": tr("Within {n} days", "Binnen {n} dagen", "Innerhalb von {n} Tagen", "En {n} días", "Entro {n} giorni", "Em até {n} dias"),
    # growth
    "q_title": tr("16 common interview questions, and how to answer with STAR", "16 veelgestelde sollicitatievragen, en hoe je antwoordt met STAR", "16 häufige Fragen im Vorstellungsgespräch, und wie du mit STAR antwortest",
                  "16 preguntas frecuentes de entrevista, y cómo responder con STAR", "16 domande frequenti al colloquio, e come rispondere con STAR", "16 perguntas comuns de entrevista, e como responder com STAR"),
    "q_desc": tr("The questions interviewers ask most, and the STAR method for answering them with a real story: the situation, your task, what you did and the result.",
                 "De vragen die het vaakst gesteld worden, en de STAR-methode om ze met een echt verhaal te beantwoorden: de situatie, je taak, wat je deed en het resultaat.",
                 "Die Fragen, die am häufigsten gestellt werden, und die STAR-Methode, um sie mit einer echten Geschichte zu beantworten: die Situation, deine Aufgabe, was du getan hast und das Ergebnis.",
                 "Las preguntas que más se hacen, y el método STAR para responderlas con una historia real: la situación, tu tarea, lo que hiciste y el resultado.",
                 "Le domande che si fanno più spesso, e il metodo STAR per rispondere con una storia vera: la situazione, il tuo compito, cosa hai fatto e il risultato.",
                 "As perguntas mais feitas, e o método STAR para respondê-las com uma história real: a situação, a sua tarefa, o que você fez e o resultado."),
    "q_questions": tr("The questions", "De vragen", "Die Fragen", "Las preguntas", "Le domande", "As perguntas"),
    "q_star": tr("How to answer: STAR", "Zo antwoord je: STAR", "So antwortest du: STAR", "Cómo responder: STAR", "Come rispondere: STAR", "Como responder: STAR"),
    "q_s": tr("Situation: where and when, in one or two sentences.", "Situatie: waar en wanneer, in een of twee zinnen.", "Situation: wo und wann, in ein oder zwei Sätzen.",
              "Situación: dónde y cuándo, en una o dos frases.", "Situazione: dove e quando, in una o due frasi.", "Situação: onde e quando, em uma ou duas frases."),
    "q_t": tr("Task: what you had to do, or what was at stake.", "Taak: wat je moest doen, of wat er op het spel stond.", "Aufgabe: was du tun musstest, oder was auf dem Spiel stand.",
              "Tarea: lo que tenías que hacer, o lo que estaba en juego.", "Compito: cosa dovevi fare, o cosa era in gioco.", "Tarefa: o que você precisava fazer, ou o que estava em jogo."),
    "q_a": tr("Action: what you did yourself. Say \"I\", not \"we\".", "Actie: wat je zelf deed. Zeg \"ik\", niet \"wij\".", "Aktion: was du selbst getan hast. Sag \"ich\", nicht \"wir\".",
              "Acción: lo que hiciste tú. Di \"yo\", no \"nosotros\".", "Azione: cosa hai fatto tu. Di' \"io\", non \"noi\".", "Ação: o que você mesmo fez. Diga \"eu\", não \"nós\"."),
    "q_r": tr("Result: what changed, with a number if you have one.", "Resultaat: wat er veranderde, met een getal als je dat hebt.", "Ergebnis: was sich geändert hat, mit einer Zahl, wenn du eine hast.",
              "Resultado: qué cambió, con una cifra si la tienes.", "Risultato: cosa è cambiato, con un numero se ce l'hai.", "Resultado: o que mudou, com um número se você tiver."),
    "q_tip": tr("One good story can answer several questions. Write five or six before the interview, and you have an answer for almost all of these.",
                "Eén goed verhaal kan meerdere vragen beantwoorden. Schrijf er vijf of zes voor het gesprek, en je hebt een antwoord op bijna al deze vragen.",
                "Eine gute Geschichte kann mehrere Fragen beantworten. Schreib vor dem Gespräch fünf oder sechs auf, und du hast eine Antwort auf fast alle diese Fragen.",
                "Una buena historia puede responder a varias preguntas. Escribe cinco o seis antes de la entrevista y tendrás respuesta para casi todas estas.",
                "Una buona storia può rispondere a più domande. Scrivine cinque o sei prima del colloquio e avrai una risposta per quasi tutte queste.",
                "Uma boa história pode responder a várias perguntas. Escreva cinco ou seis antes da entrevista e você terá resposta para quase todas estas."),
    # business: emails
    "e_title": tr("Payment reminder emails: friendly, firm and final", "Betalingsherinneringen per e-mail: vriendelijk, dringend en laatste", "Zahlungserinnerungen per E-Mail: freundlich, bestimmt und letzte",
                  "Correos de recordatorio de pago: amable, firme y último", "Email di sollecito di pagamento: gentile, deciso e ultimo", "E-mails de lembrete de pagamento: gentil, firme e final"),
    "e_desc": tr("Three payment reminders that get invoices paid without spoiling the relationship, and the email to send with the invoice. Free templates, written in six languages.",
                 "Drie betalingsherinneringen die facturen betaald krijgen zonder de relatie te bederven, en de mail bij de factuur. Gratis sjablonen, geschreven in zes talen.",
                 "Drei Zahlungserinnerungen, mit denen Rechnungen bezahlt werden, ohne die Beziehung zu verderben, und die E-Mail zur Rechnung. Kostenlose Vorlagen, in sechs Sprachen geschrieben.",
                 "Tres recordatorios de pago que consiguen el cobro sin estropear la relación, y el correo que acompaña a la factura. Plantillas gratis, escritas en seis idiomas.",
                 "Tre solleciti di pagamento che fanno pagare le fatture senza rovinare il rapporto, e l'email da inviare con la fattura. Modelli gratuiti, scritti in sei lingue.",
                 "Três lembretes de pagamento que fazem as faturas serem pagas sem estragar a relação, e o e-mail que acompanha a fatura. Modelos grátis, escritos em seis idiomas."),
    "e_lead": tr("Start friendly, then get firmer. Each one in the language of the invoice, ready to copy.", "Begin vriendelijk en word dan stelliger. Elk in de taal van de factuur, klaar om te kopiëren.",
                 "Fang freundlich an und werde dann bestimmter. Jede in der Sprache der Rechnung, fertig zum Kopieren.", "Empieza con amabilidad y luego sé más firme. Cada uno en el idioma de la factura, listo para copiar.",
                 "Inizia con gentilezza, poi diventa più deciso. Ognuno nella lingua della fattura, pronto da copiare.", "Comece com gentileza e depois fique mais firme. Cada um no idioma da fatura, pronto para copiar."),
    "e_invoice": tr("With the invoice", "Bij de factuur", "Mit der Rechnung", "Con la factura", "Con la fattura", "Com a fatura"),
    "e_1": tr("First reminder: friendly", "Eerste herinnering: vriendelijk", "Erste Erinnerung: freundlich", "Primer recordatorio: amable", "Primo sollecito: gentile", "Primeiro lembrete: gentil"),
    "e_2": tr("Second reminder: firm", "Tweede herinnering: dringend", "Zweite Erinnerung: bestimmt", "Segundo recordatorio: firme", "Secondo sollecito: deciso", "Segundo lembrete: firme"),
    "e_3": tr("Last reminder: final", "Laatste herinnering", "Letzte Erinnerung", "Último recordatorio", "Ultimo sollecito", "Último lembrete"),
    "e_subject": tr("Subject:", "Onderwerp:", "Betreff:", "Asunto:", "Oggetto:", "Assunto:"),
    "e_app": tr("In the app, each reminder fills itself in with the invoice, the amount and how late it is, and the invoice knows when it was sent.",
                "In de app vult elke herinnering zich met de factuur, het bedrag en hoe laat die is, en weet de factuur wanneer hij verstuurd is.",
                "In der App füllt sich jede Erinnerung mit der Rechnung, dem Betrag und dem Verzug, und die Rechnung weiß, wann sie verschickt wurde.",
                "En la app, cada recordatorio se rellena con la factura, el importe y el retraso, y la factura sabe cuándo se envió.",
                "Nell'app ogni sollecito si compila con la fattura, l'importo e il ritardo, e la fattura sa quando è stata inviata.",
                "No app, cada lembrete se preenche com a fatura, o valor e o atraso, e a fatura sabe quando foi enviada."),
    # business: project checklists
    "p_milestones": tr("Milestones", "Mijlpalen", "Meilensteine", "Hitos", "Traguardi", "Marcos"),
    "p_steps": tr("Week by week", "Week voor week", "Woche für Woche", "Semana a semana", "Settimana per settimana", "Semana a semana"),
    "p_week": tr("Week {n}", "Week {n}", "Woche {n}", "Semana {n}", "Settimana {n}", "Semana {n}"),
    "p_day": tr("Day {n}", "Dag {n}", "Tag {n}", "Día {n}", "Giorno {n}", "Dia {n}"),
    "p_days": tr("{n} days", "{n} dagen", "{n} Tage", "{n} días", "{n} giorni", "{n} dias"),
    "p_oneday": tr("1 day", "1 dag", "1 Tag", "1 día", "1 giorno", "1 dia"),
    "p_app": tr("In the app, the plan becomes a timeline with your own dates, and each step can go on your board.", "In de app wordt het plan een tijdlijn met je eigen datums, en kan elke stap op je bord.",
                "In der App wird der Plan zu einer Zeitleiste mit deinen eigenen Daten, und jeder Schritt kann auf dein Board.", "En la app, el plan se convierte en una línea de tiempo con tus fechas, y cada paso puede ir a tu tablero.",
                "Nell'app il piano diventa una linea del tempo con le tue date, e ogni passo può andare sulla tua bacheca.", "No app, o plano vira uma linha do tempo com as suas datas, e cada passo pode ir para o seu quadro."),
}

# each letter's own address (flat: the site translates one folder deep), named the way people search for it
HOME_SLUG = {"cancel": "letter-to-cancel-a-contract", "move": "change-of-address-letter", "complaint": "complaint-letter", "claim": "insurance-claim-letter",
             "objection": "objection-letter", "access": "personal-data-request-letter", "warranty": "faulty-product-letter"}
RENT_SLUG = {"welcome": "welcome-letter-for-tenants", "access": "landlord-visit-letter", "repair": "repair-update-letter", "copy": "certificate-letter-for-tenants",
             "deposit": "deposit-return-letter"}
HOME_LETTERS = {
    "cancel": tr("Letter to cancel a contract: a free template", "Brief om een contract op te zeggen: een gratis sjabloon", "Kündigungsschreiben für einen Vertrag: eine kostenlose Vorlage",
                 "Carta para dar de baja un contrato: una plantilla gratis", "Lettera di disdetta di un contratto: un modello gratuito", "Carta para cancelar um contrato: um modelo grátis"),
    "move": tr("Change of address letter: a free template", "Brief voor een adreswijziging: een gratis sjabloon", "Mitteilung einer Adressänderung: eine kostenlose Vorlage",
               "Carta de cambio de dirección: una plantilla gratis", "Lettera di cambio di indirizzo: un modello gratuito", "Carta de mudança de endereço: um modelo grátis"),
    "complaint": tr("Complaint letter: a free template", "Klachtbrief: een gratis sjabloon", "Beschwerdebrief: eine kostenlose Vorlage", "Carta de reclamación: una plantilla gratis", "Lettera di reclamo: un modello gratuito", "Carta de reclamação: um modelo grátis"),
    "claim": tr("Insurance claim letter: a free template", "Brief voor een schadeclaim bij je verzekering: een gratis sjabloon", "Schadensmeldung an die Versicherung: eine kostenlose Vorlage",
                "Carta para reclamar al seguro: una plantilla gratis", "Lettera di richiesta di risarcimento all'assicurazione: un modello gratuito", "Carta para acionar o seguro: um modelo grátis"),
    "objection": tr("Letter of objection to a decision: a free template", "Bezwaarschrift tegen een besluit: een gratis sjabloon", "Widerspruch gegen einen Bescheid: eine kostenlose Vorlage",
                    "Carta de recurso contra una decisión: una plantilla gratis", "Lettera di opposizione a una decisione: un modello gratuito", "Carta de recurso contra uma decisão: um modelo grátis"),
    "access": tr("Request for your personal data (GDPR): a free template", "Inzageverzoek voor je persoonsgegevens (AVG): een gratis sjabloon", "Auskunftsersuchen nach der DSGVO: eine kostenlose Vorlage",
                 "Solicitud de acceso a tus datos personales (RGPD): una plantilla gratis", "Richiesta di accesso ai dati personali (GDPR): un modello gratuito", "Pedido de acesso aos seus dados pessoais (LGPD): um modelo grátis"),
    "warranty": tr("Letter about a faulty product: a free template", "Brief over een kapot product: een gratis sjabloon", "Reklamation eines mangelhaften Produkts: eine kostenlose Vorlage",
                   "Carta por un producto defectuoso: una plantilla gratis", "Lettera per un prodotto difettoso: un modello gratuito", "Carta sobre um produto com defeito: um modelo grátis"),
}
RENT_LETTERS = {
    "welcome": tr("Welcome letter for a new tenant: a free template", "Welkomstbrief voor een nieuwe huurder: een gratis sjabloon", "Willkommensbrief für neue Mieter: eine kostenlose Vorlage",
                  "Carta de bienvenida para un nuevo inquilino: una plantilla gratis", "Lettera di benvenuto per un nuovo inquilino: un modello gratuito", "Carta de boas-vindas para um novo inquilino: um modelo grátis"),
    "access": tr("Letter to tell a tenant about a visit: a free template", "Brief om een bezoek aan de huurder aan te kondigen: een gratis sjabloon", "Ankündigung eines Besuchs beim Mieter: eine kostenlose Vorlage",
                 "Carta para avisar al inquilino de una visita: una plantilla gratis", "Lettera per avvisare l'inquilino di una visita: un modello gratuito", "Carta para avisar o inquilino de uma visita: um modelo grátis"),
    "repair": tr("Repair update letter for a tenant: a free template", "Brief over een reparatie voor de huurder: een gratis sjabloon", "Brief an den Mieter zu einer Reparatur: eine kostenlose Vorlage",
                 "Carta al inquilino sobre una reparación: una plantilla gratis", "Lettera all'inquilino su una riparazione: un modello gratuito", "Carta ao inquilino sobre um conserto: um modelo grátis"),
    "copy": tr("Letter sending a tenant a certificate: a free template", "Brief waarmee je de huurder een certificaat stuurt: een gratis sjabloon", "Brief, mit dem du dem Mieter einen Nachweis schickst: eine kostenlose Vorlage",
               "Carta para enviar un certificado al inquilino: una plantilla gratis", "Lettera per inviare un certificato all'inquilino: un modello gratuito", "Carta para enviar um certificado ao inquilino: um modelo grátis"),
    "deposit": tr("Deposit return letter for a tenant: a free template", "Brief over het terugbetalen van de borg: een gratis sjabloon", "Brief zur Rückzahlung der Kaution: eine kostenlose Vorlage",
                  "Carta de devolución de la fianza: una plantilla gratis", "Lettera per la restituzione della cauzione: un modello gratuito", "Carta de devolução da caução: um modelo grátis"),
}
LETTER_DESC = tr("A free, ready-to-send letter: {about} Copy it and fill in the parts in brackets, in English, Dutch, German, Spanish, Italian or Portuguese.",
                 "Een gratis brief, klaar om te versturen: {about} Kopieer hem en vul de delen tussen haken in, in het Nederlands, Engels, Duits, Spaans, Italiaans of Portugees.",
                 "Ein kostenloser Brief, fertig zum Abschicken: {about} Kopiere ihn und fülle die Teile in Klammern aus, auf Deutsch, Englisch, Niederländisch, Spanisch, Italienisch oder Portugiesisch.",
                 "Una carta gratis, lista para enviar: {about} Cópiala y rellena las partes entre corchetes, en español, inglés, neerlandés, alemán, italiano o portugués.",
                 "Una lettera gratuita, pronta da inviare: {about} Copiala e compila le parti tra parentesi, in italiano, inglese, olandese, tedesco, spagnolo o portoghese.",
                 "Uma carta grátis, pronta para enviar: {about} Copie e preencha as partes entre colchetes, em português, inglês, holandês, alemão, espanhol ou italiano.")
# The fill-in fields of the letters, in each language (the app fills them from the household's details)
FIELDS = {
    "c.end": tr("[end date]", "[einddatum]", "[Enddatum]", "[fecha de fin]", "[data di fine]", "[data de término]"),
    "c.name": tr("[name of the contract]", "[naam van het contract]", "[Name des Vertrags]", "[nombre del contrato]", "[nome del contratto]", "[nome do contrato]"),
    "c.reference": tr("[customer or contract number]", "[klant- of contractnummer]", "[Kunden- oder Vertragsnummer]", "[número de cliente o de contrato]", "[numero cliente o di contratto]", "[número de cliente ou de contrato]"),
    "me.address": tr("[your address]", "[je adres]", "[deine Adresse]", "[tu dirección]", "[il tuo indirizzo]", "[seu endereço]"),
    "me.city": tr("[your town]", "[je woonplaats]", "[dein Wohnort]", "[tu ciudad]", "[la tua città]", "[sua cidade]"),
    "me.email": tr("[your email]", "[je e-mailadres]", "[deine E-Mail]", "[tu correo]", "[la tua email]", "[seu e-mail]"),
    "me.name": tr("[your name]", "[je naam]", "[dein Name]", "[tu nombre]", "[il tuo nome]", "[seu nome]"),
    "me.phone": tr("[your phone number]", "[je telefoonnummer]", "[deine Telefonnummer]", "[tu teléfono]", "[il tuo numero di telefono]", "[seu telefone]"),
    "me.postcode": tr("[postcode]", "[postcode]", "[Postleitzahl]", "[código postal]", "[CAP]", "[CEP]"),
    "to.name": tr("[name of the company]", "[naam van het bedrijf]", "[Name der Firma]", "[nombre de la empresa]", "[nome dell'azienda]", "[nome da empresa]"),
    "to.address": tr("[their address]", "[hun adres]", "[deren Adresse]", "[su dirección]", "[il loro indirizzo]", "[endereço deles]"),
    "today": tr("[date]", "[datum]", "[Datum]", "[fecha]", "[data]", "[data]"),
    "home.address": tr("[address of the home]", "[adres van de woning]", "[Adresse der Wohnung]", "[dirección de la vivienda]", "[indirizzo dell'abitazione]", "[endereço do imóvel]"),
    "home.meters": tr("[where the meters are]", "[waar de meters zitten]", "[wo die Zähler sind]", "[dónde están los contadores]", "[dove sono i contatori]", "[onde ficam os medidores]"),
    "home.name": tr("[name of the home]", "[naam van de woning]", "[Name der Wohnung]", "[nombre de la vivienda]", "[nome dell'abitazione]", "[nome do imóvel]"),
    "t.deposit": tr("[deposit amount]", "[bedrag van de borg]", "[Höhe der Kaution]", "[importe de la fianza]", "[importo della cauzione]", "[valor da caução]"),
    "t.payDay": tr("[day]", "[dag]", "[Tag]", "[día]", "[giorno]", "[dia]"),
    "t.rent": tr("[rent]", "[huur]", "[Miete]", "[alquiler]", "[affitto]", "[aluguel]"),
    "t.tenants": tr("[tenants' names]", "[namen van de huurders]", "[Namen der Mieter]", "[nombres de los inquilinos]", "[nomi degli inquilini]", "[nomes dos inquilinos]"),
}
COUNTRY = {  # landlord rules: the page, and its title in each language (written whole: the country's preposition changes)
    "england": ("landlord-rules-england", tr("Landlord rules in England: what you must do", "Regels voor verhuurders in Engeland: wat je moet doen", "Vermieterpflichten in England: was du tun musst",
                                             "Normas para caseros en Inglaterra: lo que debes hacer", "Regole per i proprietari in Inghilterra: cosa devi fare", "Regras para proprietários na Inglaterra: o que você precisa fazer")),
    "nl": ("landlord-rules-netherlands", tr("Landlord rules in the Netherlands: what you must do", "Regels voor verhuurders in Nederland: wat je moet doen", "Vermieterpflichten in den Niederlanden: was du tun musst",
                                         "Normas para caseros en los Países Bajos: lo que debes hacer", "Regole per i proprietari nei Paesi Bassi: cosa devi fare", "Regras para proprietários na Holanda: o que você precisa fazer")),
    "de": ("landlord-rules-germany", tr("Landlord rules in Germany: what you must do", "Regels voor verhuurders in Duitsland: wat je moet doen", "Vermieterpflichten in Deutschland: was du tun musst",
                                     "Normas para caseros en Alemania: lo que debes hacer", "Regole per i proprietari in Germania: cosa devi fare", "Regras para proprietários na Alemanha: o que você precisa fazer")),
}
R_DESC = tr("{title}: certificates and checks, the deposit, raising the rent, tax and the landlord's year, each with its official source. Checked {date}.",
            "{title}: certificaten en keuringen, de borg, de huurverhoging, belasting en het jaar van de verhuurder, elk met de officiële bron. Nagekeken {date}.",
            "{title}: Nachweise und Prüfungen, Kaution, Mieterhöhung, Steuer und das Vermieterjahr, jeweils mit offizieller Quelle. Geprüft {date}.",
            "{title}: certificados y revisiones, la fianza, la subida del alquiler, impuestos y el año del casero, cada uno con su fuente oficial. Revisado {date}.",
            "{title}: certificati e controlli, cauzione, aumento dell'affitto, tasse e l'anno del proprietario, ognuno con la fonte ufficiale. Verificato {date}.",
            "{title}: certificados e vistorias, caução, reajuste do aluguel, impostos e o ano do proprietário, cada um com a fonte oficial. Conferido {date}.")
PROJECTS = {  # project templates that are checklists people search for
    "event": ("event-planning-checklist", tr("Event planning checklist: a 6-week plan", "Checklist voor een evenement: een plan in 6 weken", "Checkliste für die Eventplanung: ein Plan in 6 Wochen",
                                             "Lista para organizar un evento: un plan de 6 semanas", "Lista per organizzare un evento: un piano in 6 settimane", "Lista para organizar um evento: um plano de 6 semanas")),
    "website": ("website-launch-checklist", tr("Website launch checklist: an 8-week plan", "Checklist voor een nieuwe website: een plan in 8 weken", "Checkliste für den Website-Start: ein Plan in 8 Wochen",
                                                "Lista para lanzar una web: un plan de 8 semanas", "Lista per il lancio di un sito web: un piano in 8 settimane", "Lista para lançar um site: um plano de 8 semanas")),
    "launch": ("product-launch-checklist", tr("Product launch checklist: an 8-week plan", "Checklist voor een productlancering: een plan in 8 weken", "Checkliste für eine Produkteinführung: ein Plan in 8 Wochen",
                                               "Lista para lanzar un producto: un plan de 8 semanas", "Lista per il lancio di un prodotto: un piano in 8 settimane", "Lista para lançar um produto: um plano de 8 semanas")),
}
P_DESC = tr("{title}, step by step: {about} Free, and in the app it becomes a timeline with your own dates.",
            "{title}, stap voor stap: {about} Gratis, en in de app wordt het een tijdlijn met je eigen datums.",
            "{title}, Schritt für Schritt: {about} Kostenlos, und in der App wird daraus eine Zeitleiste mit deinen eigenen Daten.",
            "{title}, paso a paso: {about} Gratis, y en la app se convierte en una línea de tiempo con tus fechas.",
            "{title}, passo dopo passo: {about} Gratis, e nell'app diventa una linea del tempo con le tue date.",
            "{title}, passo a passo: {about} Grátis, e no app vira uma linha do tempo com as suas datas.")
DATE = {  # a day and month in each language's own order
    "en": lambda d, m: f"{d} {m}", "nl": lambda d, m: f"{d} {m.lower()}", "de": lambda d, m: f"{d}. {m}", "es": lambda d, m: f"{d} de {m.lower()}",
    "it": lambda d, m: f"{d} {m.lower()}", "pt-br": lambda d, m: f"{d} de {m.lower()}"}
MONTHS = {
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    "nl": ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"],
    "de": ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    "es": ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
    "it": ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
    "pt-br": ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
}


def t(key, lang="en", **kw):
    return T[key][lang].format(**kw)


def md_date(md: str, lang: str = "en") -> str:
    m, d = (int(x) for x in md.split("-"))
    return DATE[lang](d, MONTHS[lang][m - 1])


def iso_date(iso: str, lang: str = "en") -> str:
    y, m, d = iso.split("-")
    return DATE[lang](int(d), MONTHS[lang][int(m) - 1]) + f" {y}"


def when_move(days: int, lang: str = "en") -> str:
    if days == 0:
        return t("moving_day", lang)
    if days < 0:
        n = -days
        return t("day_before", lang) if n == 1 else t("week_before", lang) if n == 7 else t("weeks_before", lang, n=n // 7) if n % 7 == 0 else t("days_before", lang, n=n)
    return t("month_after", lang) if days in (28, 30, 31) else t("weeks_after", lang, n=days // 7) if days % 7 == 0 and days >= 14 else t("days_after", lang, n=days)


def every(months, lang="en") -> str:
    if months == 12:
        return t("every_year", lang)
    if months and months % 12 == 0:
        return t("every_years", lang, n=months // 12)
    return t("every_months", lang, n=months)


def fill(body: str, lang: str) -> str:
    """A letter as people copy it: from its heading on (the address block is the app's), the fields in brackets."""
    i = body.find("# ")
    body = body[i + 2:] if i >= 0 else body
    return re.sub(r"\{\{([^}]+)\}\}", lambda m: FIELDS[m.group(1)][lang] if m.group(1) in FIELDS else m.group(0), body).strip()


def home_letter(d, lid, lang):
    if lang == "en":
        return next(x for x in d["home"]["letters"] if x["id"] == lid)["body"]
    return d["home"]["letterText"][lang][lid][1]


def rent_letter(d, lid, lang):
    x = d["rentals"]["letterText"].get(lang, {}).get(lid)
    return (x[1] if isinstance(x, list) else x.get("body", "")) if x else ""


# ---------- the words ----------
def words(d: dict, lang: str) -> dict:
    out = {}

    def put(en, tx, raw=False):
        if en and tx:
            k = re.sub(r"\s+", " ", en).strip()
            out.setdefault(k, tx if raw else re.sub(r"\s+", " ", tx).strip())
    for v in T.values():
        if "{" not in v["en"]:
            put(v["en"], v[lang])
    for s in SUITES.values():
        put(t("get", name=s["name"]), t("get", lang, name=s["name"]))
    for title in [x[1] for x in COUNTRY.values()] + [x[1] for x in PROJECTS.values()] + list(HOME_LETTERS.values()) + list(RENT_LETTERS.values()) + [T[k] for k in ("m_title", "b_title", "u_title", "q_title", "e_title")]:
        put(title["en"], title[lang])
        put(title["en"].split(":")[0], title[lang].split(":")[0])  # the breadcrumb's short name
        short = lambda x: re.sub(r"\s*\([^)]*\)", "", x.split(":")[0]).strip()
        put(short(title["en"]), short(title[lang]))
    for code, (_, title) in COUNTRY.items():
        p = d["rentals"]["packs"][code]
        put(R_DESC["en"].format(title=title["en"], date=iso_date(p["checked"])), R_DESC[lang].format(title=title[lang], date=iso_date(p["checked"], lang)))
        put(t("r_checked", date=iso_date(p["checked"])), t("r_checked", lang, date=iso_date(p["checked"], lang)))
        for y in p.get("year", []) + [p.get("tax", {})]:
            for md in ([y.get("md")] if y.get("md") else []) + ([y.get("due")] if y.get("due") else []):
                put(md_date(md), md_date(md, lang)); put(t("r_due", date=md_date(md)), t("r_due", lang, date=md_date(md, lang)))
        dep = p.get("deposit", {})
        for k in ("protectDays", "returnDays"):
            if dep.get(k):
                put(t("r_protect", n=dep[k]), t("r_protect", lang, n=dep[k]))
        for x in p["duties"]:
            if x.get("every"):
                put(every(x["every"]), every(x["every"], lang))
    for days, _ in d["home"]["move"]:
        put(when_move(days), when_move(days, lang))
    for s in d["home"]["starter"]:
        put(every(s[2]), every(s[2], lang))
    for lid, title in HOME_LETTERS.items():
        put(title["en"], title[lang])
        x = next(l for l in d["home"]["letters"] if l["id"] == lid)
        about_l = AboutLookup.get(lang, x["about"])
        put(LETTER_DESC["en"].format(about=x["about"]), LETTER_DESC[lang].format(about=about_l))
        put(fill(home_letter(d, lid, "en"), "en"), fill(home_letter(d, lid, lang), lang), raw=True)
    for lid, title in RENT_LETTERS.items():
        put(title["en"], title[lang])
        x = next(l for l in d["rentals"]["letters"] if l["id"] == lid)
        put(LETTER_DESC["en"].format(about=x["about"]), LETTER_DESC[lang].format(about=AboutLookup.get(lang, x["about"])))
        put(fill(rent_letter(d, lid, "en"), "en"), fill(rent_letter(d, lid, lang), lang), raw=True)
    for key in ("invoice", "friendly", "firm", "final"):
        en, tx = d["mails"]["en"][key], d["mails"][lang][key]
        put(en[0], tx[0]); put(en[1], tx[1], raw=True)
    for tid, (_, title) in PROJECTS.items():
        put(title["en"], title[lang])
        x = next(p for p in d["projects"] if p["id"] == tid)
        put(P_DESC["en"].format(title=title["en"], about=x["about"]), P_DESC[lang].format(title=title[lang], about=AboutLookup.get(lang, x["about"])))
        for task in x["tasks"]:
            put(t("p_week", n=task[1] // 7 + 1), t("p_week", lang, n=task[1] // 7 + 1))
            n = task[2]
            put(t("p_oneday") if n == 1 else t("p_days", n=n), t("p_oneday", lang) if n == 1 else t("p_days", lang, n=n))
        for m in x["milestones"]:
            put(t("p_day", n=m[1]), t("p_day", lang, n=m[1]))
    return out


class _About:
    """The apps' own translations (i18n/<lang>.json) of a line the pages put inside one of their sentences."""
    def __init__(self):
        self.d = {}

    def get(self, lang, en):
        if lang not in self.d:
            self.d[lang] = json.loads((ROOT / "i18n" / f"{lang}.json").read_text())
        return self.d[lang].get(en, en)


AboutLookup = _About()


def write_words(d: dict, folder: Path) -> None:
    """Merged into the same generated files as Busy Kitchen's (kitchen_site.py writes them first)."""
    folder.mkdir(parents=True, exist_ok=True)
    for lang in LANGS:
        f = folder / f"{lang}.json"
        w = json.loads(f.read_text()) if f.exists() else {}
        w.update(words(d, lang))
        f.write_text(json.dumps(w, ensure_ascii=False, indent=0, sort_keys=True) + "\n")


# ---------- the pages ----------
def pages(d: dict, ctx: dict) -> dict:
    """Writes the pages; returns {suite: [(address, title)]} for the suites' own pages and the sitemap."""
    e, SITE = ctx["e"], ctx["SITE"]
    made = {k: [] for k in SUITES}

    def shell(suite, rel, title, desc, kicker, lead, body):
        pre = "../" * rel.count("/")
        s = SUITES[suite]
        ld = ctx["jsonld"]({"@context": "https://schema.org", "@type": "WebPage", "name": title, "description": desc, "url": f"{ctx['SITE_URL']}/{rel}"})  # the build adds the breadcrumbs
        img = s["og"] if (SITE / "assets" / s["og"]).exists() else "og-busy.png"
        cta = (f'<section class="section"><div class="wrap"><div class="card ivy-card reveal"><span style="font-size:3.4rem" aria-hidden="true">{s["emoji"]}</span>'
               f'<div><h2>{e(t("get", name=s["name"]))}</h2><p>{e(t("free"))}</p><p class="row-flex" style="margin-top:14px"><a class="btn btn-primary" href="{pre}{s["get"]}">{e(t("get", name=s["name"]))}</a>'
               f'<a class="btn" href="{pre}{s["demo"]}">{e(t("demo"))}</a></p></div></div></div></section>')
        page = (ctx["head"](title, desc, rel, pre, extra=MARK + "\n" + ld, image=img)
                + f'\n<body class="site">\n{ctx["nav"](pre)}\n<main id="main">\n'
                + f'  <section class="tool-hero"><div class="wrap"><p class="kicker">{e(kicker)}</p><h1>{e(title)}</h1><p class="lead">{e(lead)}</p>'
                + f'<div class="ctas"><a class="btn btn-primary btn-big" href="{pre}{s["get"]}">{e(t("get", name=s["name"]))}</a></div></div></section>\n'
                + body + "\n" + cta + "\n<!--more-->\n</main>\n" + f'{ctx["footer"](pre, ctx["tools"])}\n<script src="{pre}assets/site.js"></script>\n</body>\n</html>\n')
        (SITE / rel).parent.mkdir(parents=True, exist_ok=True)
        (SITE / rel).write_text(page)
        made[suite].append((rel, title))

    sec = lambda h, inner: f'<section class="section"><div class="wrap"><h2>{e(h)}</h2>{inner}</div></section>\n'
    facts = lambda rows: '<ul class="facts">' + "".join(rows) + "</ul>"
    src = lambda url: f' <a class="out" href="{e(url)}" target="_blank" rel="noopener">{e(t("source"))} <span aria-hidden="true">↗</span></a>' if url else ""

    def letter(suite, rel, title, about, text):
        how = facts([f"<li>{e(t(k))}</li>" for k in ("letter_1", "letter_2", "letter_3", "letter_app")])
        body = sec(t("letter_h"), f'<div class="card letter-text">{e(text)}</div>') + sec(t("letter_how"), how)
        shell(suite, rel, title, LETTER_DESC["en"].format(about=about), t("letter_kicker"), about, body)

    if ctx.get("home"):
        h = d["home"]
        rows = [f"<li>{e(w)}</li>" for w in h["who"]]
        steps = [f'<li><b>{e(when_move(days))}</b> {e(task)}</li>' for days, task in sorted(h["move"], key=lambda x: x[0])]
        shell("home", "home/who-to-tell-when-you-move.html", t("m_title"), t("m_desc"), t("checklist_kicker"), t("m_desc"), sec(t("m_who"), facts(rows)) + sec(t("m_when"), facts(steps)))
        rows = [f'<li><b>{b[1]} <span>{e(b[2])}</span></b> {e(b[3])}</li>' for b in h["binder"]]
        shell("home", "home/emergency-binder-checklist.html", t("b_title"), t("b_desc"), t("checklist_kicker"), t("b_lead"), sec(t("b_sections"), facts(rows)))
        body = ""
        for aid, aname in h["areas"]:
            jobs = [s for s in h["starter"] if s[1] == aid]
            if jobs:
                body += sec(aname, facts([f'<li><b>{e(s[0])}</b> <em>{e(every(s[2]))}</em> <span>{e(s[3])}</span></li>' for s in jobs]))
        shell("home", "home/home-maintenance-checklist.html", t("u_title"), t("u_desc"), t("checklist_kicker"), t("u_desc"), body)
        for lid, title in HOME_LETTERS.items():
            x = next(l for l in h["letters"] if l["id"] == lid)
            letter("home", f"home/{HOME_SLUG[lid]}.html", title["en"], x["about"], fill(home_letter(d, lid, "en"), "en"))
    if ctx.get("rentals"):
        for code, (slug, title) in COUNTRY.items():
            p = d["rentals"]["packs"][code]
            def chg(x):
                return f' <span class="chip">{e(t("changing"))}</span>' if x.get("changing") else ""
            duties = [f'<li><b>{x.get("emoji", "")} <span>{e(x["what"])}</span></b> {"<em>" + e(every(x["every"]) if x.get("every") else t("every_tenancy")) + "</em>" if x.get("every") or x.get("start") else ""} <span>{e(x.get("note", ""))}</span>{chg(x)}{src(x.get("source"))}</li>' for x in p["duties"]]
            dep = p.get("deposit", {})
            deps = [f'<li>{e(dep[k])}</li>' for k in ("capWhat",) if dep.get(k)]
            if dep.get("protectWhat"):
                deps.append(f'<li><b>{e(t("r_protect", n=dep["protectDays"]))}</b> {e(dep["protectWhat"])}</li>' if dep.get("protectDays") else f'<li>{e(dep["protectWhat"])}</li>')
            if dep.get("returnWhat"):
                deps.append(f'<li>{e(dep["returnWhat"])}{src(dep.get("source"))}</li>')
            rr = p.get("rentReview", {})
            tax = p.get("tax", {})
            year = [f'<li><b>{e(md_date(y["md"]))}</b> {e(y["what"])}{src(y.get("source"))}</li>' for y in sorted(p.get("year", []), key=lambda y: y["md"])]
            know = [f'<li>{e(k["what"])}{chg(k)}{src(k.get("source"))}</li>' for k in p.get("know", [])]
            body = (f'<section class="section"><div class="wrap"><p class="faint">{e(t("r_checked", date=iso_date(p["checked"])))}</p></div></section>\n'
                    + sec(t("r_duties"), facts(duties)) + (sec(t("r_deposit"), facts(deps)) if deps else "")
                    + (sec(t("r_rent"), facts([f'<li>{e(rr["what"])}{chg(rr)}{src(rr.get("source"))}</li>'])) if rr.get("what") else "")
                    + (sec(t("r_tax"), facts([f'<li><b>{e(t("r_due", date=md_date(tax["due"])))}</b> {e(tax["what"])}{src(tax.get("source"))}</li>'])) if tax.get("what") else "")
                    + (sec(t("r_year"), facts(year)) if year else "") + (sec(t("r_know"), facts(know)) if know else ""))
            desc = R_DESC["en"].format(title=title["en"], date=iso_date(p["checked"]))
            shell("rentals", f"rentals/{slug}.html", title["en"], desc, t("checklist_kicker"), t("r_lead"), body)
        for lid, title in RENT_LETTERS.items():
            x = next(l for l in d["rentals"]["letters"] if l["id"] == lid)
            letter("rentals", f"rentals/{RENT_SLUG[lid]}.html", title["en"], x["about"], fill(rent_letter(d, lid, "en"), "en"))
    if ctx.get("growth"):
        qs = facts([f"<li>{e(q[0])}</li>" for q in d["growth"]["questions"]])
        star = facts([f"<li>{e(t(k))}</li>" for k in ("q_s", "q_t", "q_a", "q_r")]) + f'<p style="margin-top:14px">{e(t("q_tip"))}</p>'
        shell("growth", "growth/interview-questions.html", t("q_title"), t("q_desc"), t("checklist_kicker"), t("q_desc"), sec(t("q_questions"), qs) + sec(t("q_star"), star))
    if ctx.get("business"):
        m = d["mails"]["en"]
        mail = lambda h, k: sec(h, (f'<p><b>{e(t("e_subject"))}</b> {e(m[k][0])}</p>' if m[k][0] else "") + f'<div class="card letter-text">{e(m[k][1])}</div>')
        body = mail(t("e_invoice"), "invoice") + mail(t("e_1"), "friendly") + mail(t("e_2"), "firm") + mail(t("e_3"), "final") + sec(t("letter_how"), facts([f"<li>{e(t('e_app'))}</li>", f"<li>{e(t('letter_3'))}</li>"]))
        shell("business", "business/payment-reminder-emails.html", t("e_title"), t("e_desc"), t("letter_kicker"), t("e_lead"), body)
        for tid, (slug, title) in PROJECTS.items():
            x = next(p for p in d["projects"] if p["id"] == tid)
            ms = facts([f'<li><b>{e(t("p_day", n=mm[1]))}</b> {e(mm[0])}</li>' for mm in x["milestones"]])
            steps = facts([f'<li><b>{e(t("p_week", n=k[1] // 7 + 1))}</b> <span>{e(k[0])}</span> <em>{e(t("p_oneday") if k[2] == 1 else t("p_days", n=k[2]))}</em></li>' for k in sorted(x["tasks"], key=lambda k: k[1])])
            shell("business", f"business/{slug}.html", title["en"], P_DESC["en"].format(title=title["en"], about=x["about"]), t("checklist_kicker"), x["about"],
                  sec(t("p_milestones"), ms) + sec(t("p_steps"), steps) + sec(t("letter_how"), facts([f"<li>{e(t('p_app'))}</li>"])))

    # each page links to the others of its suite, and the suite's page links to them all
    for suite, items in made.items():
        for rel, _ in items:
            pre = "../" * rel.count("/")
            links = "".join(f'<li><a href="{pre}{r}">{e(tl)}</a></li>' for r, tl in items if r != rel)
            f = SITE / rel
            f.write_text(f.read_text().replace("<!--more-->", sec(t("more"), f'<ul class="facts">{links}</ul>') if links else ""))
    return made
