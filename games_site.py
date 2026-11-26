"""Busy Games' pages for search: the 3D game, the characters, the worlds, the Wrong Year and how to solve each puzzle.

Owner, 26 November 2026: search pages for every product, the games included; for the 3D game, pages that attract
gamers, and the characters introduced in a fun way. Facts follow what the site and the store pages say now: Busy
Street 3D has 23 levels in eight worlds after the street, for Macs with Apple silicon; Tuck's Errand has 15 levels,
six free in the browser; the Wrong Year is coming next. The characters' lines come from busy-game/assets/cast.json
and the levels' from busy-studio/Busy3D/Scripts/worlds.py.

English is in EN (key: text). The other languages are in content_site/games-<lang>.json with the same keys, translated
from EN; words(lang) matches them up. Pages carry <meta name="busy-words" content="data">."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LANGS = ["nl", "de", "es", "it", "pt-br"]
MARK = '<meta name="busy-words" content="data">'

EN = {
    # shared
    "kicker": "Busy Games · Busy Street",
    "get3d": "Get Busy Street 3D · $3.99",
    "play2d": "▶ Play Tuck's Errand free",
    "more_h": "More from Busy Street",
    "trailer": "Watch the trailer",
    # the 3D game
    "g3_title": "Busy Street 3D: a cozy 3D puzzle adventure for Mac",
    "g3_desc": "Cut your friends loose from living red tape. A 3D puzzle adventure for one player: swap between six friends, 23 levels in eight worlds, six languages. For Mac.",
    "g3_h1": "Busy Street 3D",
    "g3_lead": "The Red Tape has crept over Busy Street. Everyone it catches is wound up in it, and every door now wants a form. Tuck only went out to get a stamp back.",
    "g3_what_h": "What you do",
    "g3_what_1": "You walk into a room, work out what is holding it shut, and cut it loose. Every friend you free comes along, and each can do one thing nobody else can.",
    "g3_what_2": "No room asks for fast fingers. If you are caught you are put back a little way, and \"take your time\" slows the guards down. The game saves by itself.",
    "g3_what_3": "Each level hides its own stars, and each star needs the right friend. The knots are logic puzzles from the paper-and-pencil tradition: stars, pairs, six-by-six and trails.",
    "g3_facts_h": "In short",
    "g3_f1": "A 3D puzzle adventure for one player",
    "g3_f2": "23 levels and 113 rooms, in eight worlds after the street",
    "g3_f3": "Six friends on the floor, eighteen in all: swap between them at any moment",
    "g3_f4": "A film at the start and the end of every level",
    "g3_f5": "In English, Dutch, German, Spanish, Italian and Portuguese",
    "g3_f6": "For Macs with Apple silicon (M1 or newer). There is no Windows version yet.",
    "g3_f7": "$3.99 once, with free updates. Next: music, and nine cities.",
    "g3_friends_h": "Six friends, one thing each",
    "g3_friends_p": "Rivet lifts what nobody lifts. Pim jumps twice as high. Olaf reads the small print. Juno writes, and officials stop to read. Ivy grows a way up. And Tuck snips.",
    "g3_meet": "Meet all the characters →",
    "g3_worlds_h": "Eight worlds after the street",
    "g3_worlds_p": "A castle run as a meeting, a gym where the clock stopped at \"one more minute\", a university with a book overdue since 1874, a park that has been closing in two hours all day, a manor nobody remembers entering, a jungle where the way out is up, a pirate ship that votes on everything, and a beach where doing nothing is the way through.",
    "g3_see_worlds": "See every world and level →",
    "g3_shots_h": "Screenshots",
    "g3_controls_h": "Controls",
    "g3_c1": "WASD to walk, Shift to run, Space to jump",
    "g3_c2": "E to use, C to hide, R to roll",
    "g3_c3": "Tab or 1 to 6 to swap friends, Q to call a friend",
    "g3_c4": "G for your notes, Esc for the menu",
    "g3_faq_h": "Questions",
    "g3_q1": "Is Busy Street 3D free?", "g3_a1": "No: it costs $3.99 once, on itch.io, with free updates. Its 2D sister game, Tuck's Errand, has six levels you can play free in your browser.",
    "g3_q2": "Does it run on Windows?", "g3_a2": "Not yet. Busy Street 3D is for Macs with Apple silicon (M1 or newer). Tuck's Errand, the 2D game, runs on Mac and Windows.",
    "g3_q3": "How long is it?", "g3_a3": "23 levels and 113 rooms. A level takes about half an hour, and the game saves by itself, so it suits an evening at a time.",
    "g3_q4": "Is it hard?", "g3_a4": "It asks for thinking, not reflexes. Each room is one idea. If you get stuck, every room has a hint, and \"take your time\" slows the guards down.",
    "g3_q5": "Is it for children?", "g3_a5": "There is no violence and nothing scary: the villain is red tape, and the worst that happens is a form. The jokes are written for grown-ups, and the puzzles suit anyone who likes puzzles.",
    # the characters
    "ch_title": "Meet the characters of Busy Street",
    "ch_desc": "Tuck, Rivet, Pim, Ivy, Olaf, Juno and the friends they free on the way: who they are, what each can do, and the creatures, clerks and knots of red tape they meet.",
    "ch_h1": "Meet the characters of Busy Street",
    "ch_lead": "A small, anxious hero with a pair of scissors, five friends wound up in red tape, and a town full of creatures who have filled in the form to be there.",
    "ch_six_h": "The six friends",
    "ch_six_p": "Play as any of them. Swap with Tab, or the number keys 1 to 6.",
    "ch_road_h": "Friends you free on the way",
    "ch_other_h": "The other side",
    "ch_creatures_h": "Creatures with opinions",
    "ch_can": "Can:",
    "tuck_n": "Tuck", "tuck_r": "The hero, and the only one who never meant to be.",
    "tuck_t": "Small, round and house-proud, in a mustard cardigan with a button missing. His ears droop when he worries, which is often. Tuck only went out to get a stamp back.",
    "tuck_s": "Snips tape with his scissors, hides, rolls and throws.",
    "rivet_n": "Rivet", "rivet_r": "The maker, with sawdust on one cheek.",
    "rivet_t": "Short, sturdy and bronze, with eyebrows you could sweep a floor with. Rivet runs a workshop and fixes things by hitting them, correctly. He clanks, so the guards hear him coming.",
    "rivet_s": "Swings the hammer, smashes crates and locks, gives a leg-up.",
    "pim_n": "Pim", "pim_r": "The climber, nervous and getting braver.",
    "pim_t": "Tall, gangly and sand-coloured, with a leaf on its head. Pim is scared of heights on the ground floor and a little less scared on every floor above it.",
    "pim_s": "Jumps twice as high, climbs, and lets ropes down for the others.",
    "ivy_n": "Ivy", "ivy_r": "The calm one, with a gold earring.",
    "ivy_t": "Ivy has never once raised her voice, and nobody has ever needed her to. She waters a seed and a way up grows out of it.",
    "ivy_s": "Grows vines, turns stiff valves, walks past sleeping guards.",
    "olaf_n": "Olaf", "olaf_r": "The wise one, with round wire spectacles.",
    "olaf_t": "Old, slow and long-eared. Olaf is not freed by force but by a conversation, which tells you most of what you need to know about him.",
    "olaf_s": "Reads the small print, so hidden stars and routes show.",
    "juno_n": "Juno", "juno_r": "The unflappable one, glasses on a chain.",
    "juno_t": "Lavender-grey and impossible to rattle. When Juno writes something down, officials stop and read it, which on Busy Street is a superpower.",
    "juno_s": "Writes, so officials stop; opens every door and letter.",
    "zip_n": "Zip", "zip_t": "A hare who delivers the post, the fastest on the street. Vaults, slides and never stops talking.",
    "cog_n": "Cog", "cog_t": "A small, fearless tinkerer. His wrench starts machines and stops them, and turns them against the tape.",
    "hob_n": "Hob", "hob_t": "A huge, gentle porter who pushes and carries what nobody else can. Terrified of mice.",
    "mott_n": "Mott", "mott_t": "A soft, sleepy night watchman. Sees in the dark and carries the lantern.",
    "quill_n": "Quill", "quill_t": "A tiny old archivist who has read everything, and reads the signs nobody else can.",
    "apprentice_n": "Nib", "apprentice_t": "The apprentice, all ears. Slips through small gaps and hears what others miss, through walls if need be.",
    "quorum2_n": "Dame Quorum", "quorum2_t": "A knight who chairs everything. When she calls a point of order, everybody in the room has to stop and listen.",
    "ottoline_n": "Ottoline", "ottoline_t": "A great-aunt who lived in a portrait. Steps into any picture frame and looks out of another.",
    "tala_n": "Tala", "tala_t": "An expedition guide. Climbs for as long as it takes, and always knows the way back.",
    "bess_n": "Bess Ledger", "bess_t": "A ship's accountant who counts anything exactly: weights, shares, and who owes whom.",
    "kai_n": "Kai", "kai_t": "A surf teacher who says \"wait\". With him, whatever is moving comes round again, slower.",
    "clerk_n": "The Clerk", "clerk_t": "The one behind the Red Tape: tall, thin and very polite. Not evil, just lonely. Nobody ever filled in the form to say thank you.",
    "inspector_n": "The inspector", "inspector_t": "A tangled official who patrols and sees far. He would rather write you up than catch you.",
    "tapeling_n": "Tapelings", "tapeling_t": "Little walking knots of Red Tape. They patrol in groups, run at you, and fall apart when hit.",
    "cr_1": "The crocodile that looks exactly like a log, except for the reading glasses.",
    "cr_2": "Monkeys who file whatever you put down, alphabetically, in a tree.",
    "cr_3": "Seagulls: the real customs officers, and they can be bribed.",
    "cr_4": "A goat on a roof, eating a form.",
    "cr_5": "A snail with a key on its shell. The patience puzzle.",
    "cr_6": "A cannon with a label: do not load friends without their written consent.",
    "cr_7": "The number machine: now serving 3. Your number is 4.",
    "cr_8": "The enormous bird that has decided Tuck is a chick.",
    "ch_pics": "Portraits from the game.",
    # the worlds
    "w_title": "The worlds of Busy Street: eight worlds and 23 levels",
    "w_desc": "Every world and level of the Busy Street puzzle games: the street, a castle, a gym, a university, a park, a hidden manor, a jungle, a pirate ship, a beach and the Passport Office.",
    "w_h1": "The worlds of Busy Street",
    "w_lead": "First the street, where five friends are wound up in red tape. Then eight worlds, each with a friend to free and a rule that has got out of hand. And at the end, the Passport Office.",
    "w_levels": "Levels",
    "w_free": "Frees",
    "w_both": "In both games: in 3D the levels are numbered as here; in 2D, Tuck's Errand gives each world one level.",
    "street_n": "Busy Street", "street_s": "The Quiet Workshop, Up the Glasshouse, The Top Floor, The Study Upstairs, The House with the Door, The Street",
    "street_t": "The Red Tape has wound up the street. Free Rivet in his workshop, Pim in the glasshouse, Ivy on the top floor, Olaf in his study and Juno at home, then all six take on the giant spool the tape comes from.",
    "street_f": "Rivet, Pim, Ivy, Olaf, Juno and Cog", "street_l": "1 to 6", "castle_l": "7 and 8", "gym_l": "9 and 10", "uni_l": "11 and 12", "park_l": "13 and 14",
    "manor_l": "15 and 16", "jungle_l": "17 and 18", "pirates_l": "19 and 20", "beach_l": "21 and 22", "office_l": "23",
    "castle_n": "The Castle", "castle_s": "Point of Order, Any Other Business",
    "castle_t": "A castle run as a meeting. Break in, get on the agenda, and let Dame Quorum call a point of order.",
    "castle_f": "Dame Quorum",
    "gym_n": "The Gym", "gym_s": "Warm-Up, One More Minute",
    "gym_t": "The clock stopped at \"one more minute\", and the Coach is still counting. Six scales, six doors.",
    "gym_f": "Hob",
    "uni_n": "The University", "uni_s": "Open Book, Finals",
    "uni_t": "A book has been overdue since 1874. Then the exam hall, where everybody knows one thing.",
    "uni_f": "Quill and Nib",
    "park_n": "The Park", "park_s": "Opening Hours, Closing Time",
    "park_t": "The park closes in two hours, and has done all day. A tangled swan, a gate key in the sandpit and a snail that will get there.",
    "park_f": "Mott",
    "manor_n": "The Hidden Manor", "manor_s": "Signing In, Signing Out",
    "manor_t": "A house nobody remembers entering. The date in the visitors' book is tomorrow, and dinner for twelve is set for eleven.",
    "manor_f": "Ottoline",
    "jungle_n": "The Jungle", "jungle_s": "Up, Further Up",
    "jungle_t": "The way out is up. The note in the tent says: gone up, back Tuesday. At the very top there is a sign: please take a number.",
    "jungle_f": "Tala",
    "pirates_n": "The Pirates", "pirates_s": "All Aboard, All in Favour",
    "pirates_t": "A crew that votes on everything, and somebody has been voted overboard. Five pages of accounts that balance and make no sense.",
    "pirates_f": "Bess Ledger",
    "beach_n": "The Beach", "beach_s": "Wait for It, Back Soon",
    "beach_t": "No swimming without a lifeguard, no lifeguard without a form. Here doing nothing is the way through: wait for the third wave.",
    "beach_f": "Kai",
    "office_n": "The Passport Office", "office_s": "Thank You for Your Patience",
    "office_t": "The end of the errand. Meet the Clerk, and fill in the one form nobody ever did.",
    "office_f": "The Clerk",
    # the Wrong Year
    "wy_title": "The Wrong Year: nine cities and the true stories behind them",
    "wy_desc": "Coming next in Busy Street: the stamp came down on the wrong date, nine times. Istanbul 1555, Amsterdam 1637, Paris 1889, Berlin 1989 and more, each built on a true story.",
    "wy_h1": "The Wrong Year",
    "wy_lead": "The stamp came down on the wrong date, nine times. Nine cities to put right, from Istanbul in 1555 to Tokyo today, each built on a true story about paperwork, and each with its own music.",
    "wy_soon": "Coming next, in 2D and in 3D.",
    "wy_story": "The true story",
    "wy_care": "These are real places and real moments. Every person in the game is invented.",
    "istanbul_n": "Istanbul, 1555", "istanbul_s": "Fair Measure",
    "istanbul_t": "The market inspector checked every weight and measure in the Grand Bazaar, and the city's first coffee house opened that year.",
    "amsterdam_n": "Amsterdam, 1637", "amsterdam_s": "One Bulb",
    "amsterdam_t": "Tulip fever: single bulbs changed hands on paper for the price of a canal house, in the back rooms of inns, until one February week nobody would sign.",
    "hanyang_n": "Hanyang, 1795", "hanyang_s": "The Examination",
    "hanyang_t": "The state examination in Hanyang, today's Seoul: thousands of candidates, one question, one day and a brush. Passing could change a family for generations.",
    "deadwood_n": "Deadwood, 1876", "deadwood_s": "Staking a Claim",
    "deadwood_t": "A gold-rush town that was not legally there: every claim was a paper pinned to a post, and whoever recorded it first owned the ground.",
    "paris_n": "Paris, 1889", "paris_s": "The Lifts Are Not Ready",
    "paris_t": "The Eiffel Tower opened for the World's Fair before its lifts worked. The first visitors climbed 1,710 steps, and the builder climbed them first.",
    "london_n": "London, 1908", "london_s": "Twenty-Six Miles, 385 Yards",
    "london_t": "The Olympic marathon was stretched so it would start under the royal nursery windows and end at the royal box. That odd length is still the marathon today.",
    "newyork_n": "New York, 1931", "newyork_s": "Lunch on the Beam",
    "newyork_t": "Skyscrapers went up at a pace of floors a week. Every beam had a number, every rivet gang a tally, and nothing rose without the inspector's signature.",
    "berlin_n": "Berlin, 1989", "berlin_s": "As of Now",
    "berlin_t": "A note read out at a press conference. Asked when the new travel rule began, the spokesman looked at his paper and said: as far as I know, at once. That night the crossings opened.",
    "tokyo_n": "Tokyo, today", "tokyo_s": "The Stamp",
    "tokyo_t": "In Japan a personal stamp signs the moments of a life: a birth, a school, a home, a wedding. Tuck only ever went out for a stamp.",
    # the puzzles: how to solve them
    "pz_kicker": "Busy Games · how to solve it",
    "pz_rules": "The rules",
    "pz_tech": "Techniques, from first to last",
    "pz_play": "Play today's puzzle free",
    "pz_others": "The other puzzles",
    "pz_unique": "Every board has exactly one answer, so you never need to guess: each technique below finds a cell you can be sure of.",
    "stars_title": "How to solve Star Battle puzzles: rules and techniques",
    "stars_desc": "How to solve a one-star Star Battle: the rules, and the techniques that crack every board, from the smallest region to the two-by-two squares. Then play a free one every day.",
    "stars_h1": "How to solve Star Battle",
    "stars_lead": "One star in every row, every column and every colour patch, and stars never touch. Simple rules, real thinking.",
    "stars_t1": "Start with the smallest region. A region of one or two cells tells you almost at once where its star can go.",
    "stars_t2": "Cross out around every star. The eight cells around a star can never hold another one, and neither can the rest of its row, column and region.",
    "stars_t3": "Look for a region inside one row or column. If a whole region lies in one row, that row's star is in that region, so cross out the rest of the row.",
    "stars_t4": "Count regions against rows. If two regions fit entirely inside two rows, those two rows' stars are in those regions: cross out everything else in both rows.",
    "stars_t5": "Use two-by-two squares. Any two-by-two square holds at most one star, because stars never touch. Split a row pair into squares and the count tells you where the stars must be.",
    "stars_t6": "When it slows down, try a cell in your head: if a star there would leave a region with nowhere to go, that cell gets a cross.",
    "duo_title": "How to solve Takuzu (Binairo) puzzles: rules and techniques",
    "duo_desc": "How to solve Takuzu, also called Binairo or the binary puzzle: the rules, and the techniques that fill every board without guessing. Then play a free one every day.",
    "duo_h1": "How to solve Takuzu (Binairo)",
    "duo_lead": "Two symbols, half and half, never three in a row, and no two lines the same.",
    "duo_t1": "Break up pairs. Two of the same side by side? The cells on either side must be the other one.",
    "duo_t2": "Fill the sandwich. Two of the same with one gap between them? The gap must be the other one.",
    "duo_t3": "Count. When a row already has half of one symbol, every empty cell in it is the other.",
    "duo_t4": "Think ahead three cells. If putting a symbol in a cell would force three in a row further on, it has to be the other one.",
    "duo_t5": "Compare lines. When a row is nearly full and only two cells are left, check it against the finished rows: no two may be the same.",
    "six_title": "How to solve 6×6 Sudoku: rules and techniques",
    "six_desc": "How to solve a 6×6 Sudoku with 2×3 boxes: the rules, and the techniques that solve every board, from the last number in a row to pairs. Then play a free one every day.",
    "six_h1": "How to solve 6×6 Sudoku",
    "six_lead": "The numbers 1 to 6, once in every row, column and 2 × 3 box. Quick to start, tricky to finish.",
    "six_t1": "Finish what is nearly full. A row, column or box with five numbers has one gap and one number left.",
    "six_t2": "Look for the only cell. Pick a number and a box: if every other cell in the box is ruled out by its row or column, the number goes in the one cell left.",
    "six_t3": "Look for the only number. Pick an empty cell and list what its row, column and box already hold: if only one number is missing, that is the answer.",
    "six_t4": "Use pairs. If two cells in a row can only be the same two numbers, those numbers belong there, and every other cell in that row loses them.",
    "six_t5": "Write small notes. On harder boards, pencil in the possible numbers and let them shrink as the board fills.",
    "trail_title": "How to solve path puzzles: rules and techniques",
    "trail_desc": "How to solve a numbered path puzzle: draw one line through every cell, passing the numbers in order. The rules, and the techniques that find the route. Free every day.",
    "trail_h1": "How to solve path puzzles",
    "trail_lead": "One line through every cell, passing the numbers in order, never crossing itself.",
    "trail_t1": "Start at the corners. A corner cell has only two neighbours, so the line must come in by one and leave by the other, unless it starts or ends there.",
    "trail_t2": "Follow the dead ends. A cell with only two open neighbours left is a fixed bend: draw it in at once.",
    "trail_t3": "Count the steps between numbers. If 4 and 5 are far apart, the line between them has to wander; if they are close, it can't.",
    "trail_t4": "Don't cut the board in two. A line that leaves cells it can never come back to is wrong: every cell must still be reachable.",
    "trail_t5": "Mind the walls. A thick wall blocks the line, which often leaves just one way round.",
}
CHAR_SIX = ["tuck", "rivet", "pim", "ivy", "olaf", "juno"]
CHAR_ROAD = ["zip", "cog", "hob", "mott", "quill", "apprentice", "quorum2", "ottoline", "tala", "bess", "kai"]
CHAR_OTHER = ["clerk", "inspector", "tapeling"]
WORLDS = [("street", "1 to 6", "01-l7-moat"), ("castle", "7 and 8", "01-l7-moat"), ("gym", "9 and 10", "02-l10-pool"), ("uni", "11 and 12", None),
          ("park", "13 and 14", "03-l13-roses"), ("manor", "15 and 16", None), ("jungle", "17 and 18", "05-l17-falls"),
          ("pirates", "19 and 20", "07-l19-deck"), ("beach", "21 and 22", "06-l22-wave"), ("office", "23", "08-l23-lobby")]
WORLDS[0] = ("street", "1 to 6", "09-l1-workshop")
CITIES = ["istanbul", "amsterdam", "hanyang", "deadwood", "paris", "london", "newyork", "berlin", "tokyo"]
PUZZLES = {"stars": ("how-to-solve-star-battle", 6), "duo": ("how-to-solve-takuzu", 5), "six": ("how-to-solve-6x6-sudoku", 5), "trail": ("how-to-solve-path-puzzles", 5)}
PAGES = {"busy-street-3d": "g3", "characters": "ch", "worlds": "w", "the-wrong-year": "wy"}


def tr_file(lang: str) -> dict:
    f = ROOT / "content_site" / f"games-{lang}.json"
    return json.loads(f.read_text()) if f.exists() else {}


def words(lang: str) -> dict:
    tr = tr_file(lang)
    out = {}
    for k, en in EN.items():
        if tr.get(k):
            out[re.sub(r"\s+", " ", en).strip()] = re.sub(r"\s+", " ", tr[k]).strip()
            # breadcrumbs take the title up to its colon
            if k.endswith("_title") and ":" in en and ":" in tr[k]:
                out[en.split(":")[0].strip()] = tr[k].split(":")[0].strip()
            # and without what is in brackets
            bare = lambda x: re.sub(r"\s*\([^)]*\)", "", x).strip()
            if k.endswith(("_title", "_h1")) and bare(en) != en:
                out.setdefault(bare(en), bare(tr[k]))
                out.setdefault(bare(en.split(":")[0]), bare(tr[k].split(":")[0]))
    return out


def missing(lang: str) -> list:
    tr = tr_file(lang)
    return [k for k in EN if not tr.get(k)]


def write_words(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for lang in LANGS:
        f = folder / f"{lang}.json"
        w = json.loads(f.read_text()) if f.exists() else {}
        w.update(words(lang))
        f.write_text(json.dumps(w, ensure_ascii=False, indent=0, sort_keys=True) + "\n")


def pages(ctx: dict) -> list:
    e, SITE = ctx["e"], ctx["SITE"]
    pre = "../"
    out = []
    t = lambda k: e(EN[k])
    itch3d, itch2d = ctx["street3d_url"], ctx["tuck_url"]

    def pic(folder, name, alt, sizes="(max-width: 600px) 100vw, 400px"):
        at = f"{pre}assets/games/{folder}/{name}"
        return (f'<picture><source srcset="{at}-640.webp 640w, {at}.webp 1280w" sizes="{sizes}" type="image/webp">'
                f'<img src="{at}.jpg" alt="{e(alt)}" width="1280" height="720" loading="lazy"></picture>')

    def portrait(name, alt):
        return f'<img class="portrait" src="{pre}assets/games/characters/{name}.webp" alt="{e(alt)}" width="373" height="480" loading="lazy">'

    def sec(h, inner, sid=""):
        return f'<section class="section"{f" id={chr(34)}{sid}{chr(34)}" if sid else ""}><div class="wrap"><h2>{e(h)}</h2>{inner}</div></section>\n'

    def ctas():
        return (f'<div class="ctas"><a class="btn btn-primary btn-big" href="{itch3d}" target="_blank" rel="noopener">{t("get3d")}</a>'
                f'<a class="btn btn-big" href="tucks-errand.html">{t("play2d")}</a></div>')

    def more(here):
        links = [("busy-street-3d.html", EN["g3_h1"]), ("characters.html", EN["ch_h1"]), ("worlds.html", EN["w_h1"]), ("the-wrong-year.html", EN["wy_h1"])]
        links += [(f"{slug}.html", EN[f"{p}_h1"]) for p, (slug, _) in PUZZLES.items()]
        items = "".join(f'<li><a href="{h}">{e(n)}</a></li>' for h, n in links if h != here)
        return sec(EN["more_h"], f'<ul class="facts">{items}</ul>')

    def shell(rel, key, body, image="og-games.png", extra_ld=None):
        title, desc = EN[f"{key}_title"], EN[f"{key}_desc"]
        ld = ctx["jsonld"](extra_ld or {"@context": "https://schema.org", "@type": "WebPage", "name": title, "description": desc, "url": f"{ctx['SITE_URL']}/{rel}"})
        page = (ctx["head"](title, desc, rel, pre, extra=MARK + "\n" + ld, image=image)
                + f'\n<body class="site">\n{ctx["nav"](pre)}\n<main id="main">\n{body}\n{more(rel.split("/")[1])}</main>\n'
                + f'{ctx["footer"](pre, ctx["tools"])}\n<script src="{pre}assets/site.js"></script>\n</body>\n</html>\n')
        (SITE / rel).write_text(page)
        out.append(rel)

    def hero(key, lead_extra=""):
        return (f'  <section class="tool-hero"><div class="wrap"><p class="kicker">{t("kicker")}</p><h1>{t(key + "_h1")}</h1>'
                f'<p class="lead">{t(key + "_lead")}</p>{lead_extra}{ctas()}</div></section>\n')

    # the 3D game
    shots = "".join(f'<figure class="shot">{pic("3d", n, EN["g3_h1"])}</figure>' for n in ["09-l1-workshop", "01-l7-moat", "02-l10-pool", "03-l13-roses", "05-l17-falls", "07-l19-deck", "06-l22-wave", "08-l23-lobby"])
    six = "".join(f'<div class="card char"><a href="characters.html#{c}">{portrait(c, EN[c + "_n"])}</a><h3>{t(c + "_n")}</h3><p>{t(c + "_s")}</p></div>' for c in CHAR_SIX)
    faq = "".join(f'<details><summary>{t(f"g3_q{i}")}</summary><p>{t(f"g3_a{i}")}</p></details>' for i in range(1, 6))
    poster = (f'<a href="{pre}films/busy-street-3d.html"><picture><source srcset="{pre}assets/films/busy-street-3d.webp" type="image/webp">'
              f'<img src="{pre}assets/films/busy-street-3d.jpg" alt="{e(EN["g3_h1"])}" width="1280" height="720" fetchpriority="high"></picture></a>'
              f'<p class="faint"><a href="{pre}films/busy-street-3d.html"><span aria-hidden="true">▶</span> <span>{t("trailer")}</span></a></p>')
    body = (f'  <section class="tool-hero"><div class="wrap tool-hero-grid"><div class="reveal from-left"><p class="kicker">{t("kicker")}</p><h1>{t("g3_h1")}</h1>'
            f'<p class="lead">{t("g3_lead")}</p>{ctas()}</div><div class="stage solo reveal from-right"><figure class="tool-room">{poster}</figure></div></div></section>\n'
            + sec(EN["g3_what_h"], '<div class="kitchen-story">' + "".join(f"<p>{t(k)}</p>" for k in ("g3_what_1", "g3_what_2", "g3_what_3")) + "</div>")
            + sec(EN["g3_facts_h"], '<ul class="facts">' + "".join(f"<li>{t(f'g3_f{i}')}</li>" for i in range(1, 8)) + "</ul>")
            + sec(EN["g3_friends_h"], f'<p class="lead">{t("g3_friends_p")}</p><div class="chars">{six}</div><p><a href="characters.html">{t("g3_meet")}</a></p>')
            + sec(EN["g3_worlds_h"], f'<p>{t("g3_worlds_p")}</p><p><a href="worlds.html">{t("g3_see_worlds")}</a></p>')
            + sec(EN["g3_shots_h"], f'<div class="shots">{shots}</div>')
            + sec(EN["g3_controls_h"], '<ul class="facts">' + "".join(f"<li>{t(f'g3_c{i}')}</li>" for i in range(1, 5)) + "</ul>")
            + sec(EN["g3_faq_h"], f'<div class="faq">{faq}</div>'))
    game_ld = {"@context": "https://schema.org", "@type": "VideoGame", "name": EN["g3_h1"], "description": EN["g3_desc"], "url": f"{ctx['SITE_URL']}/games/busy-street-3d.html",
               "genre": ["Puzzle", "Adventure"], "gamePlatform": "macOS", "playMode": "SinglePlayer", "inLanguage": ["en", "nl", "de", "es", "it", "pt-BR"],
               "image": f"{ctx['SITE_URL']}/assets/games/3d/09-l1-workshop.jpg", "offers": {"@type": "Offer", "price": "3.99", "priceCurrency": "USD", "url": itch3d}}
    shell("games/busy-street-3d.html", "g3", body, extra_ld=game_ld)

    # the characters
    def card(c, long=True):
        role = f'<p class="role">{t(c + "_r")}</p>' if c + "_r" in EN else ""
        skill = f'<p><b>{t("ch_can")}</b> {t(c + "_s")}</p>' if c + "_s" in EN else ""
        return f'<div class="card char" id="{c}">{portrait(c, EN[c + "_n"])}<h3>{t(c + "_n")}</h3>{role}<p>{t(c + "_t")}</p>{skill}</div>'
    body = (hero("ch")
            + sec(EN["ch_six_h"], f'<p>{t("ch_six_p")}</p><div class="chars">{"".join(card(c) for c in CHAR_SIX)}</div>')
            + sec(EN["ch_road_h"], f'<div class="chars">{"".join(card(c) for c in CHAR_ROAD)}</div>')
            + sec(EN["ch_other_h"], f'<div class="chars">{"".join(card(c) for c in CHAR_OTHER)}</div>')
            + sec(EN["ch_creatures_h"], '<ul class="facts">' + "".join(f"<li>{t(f'cr_{i}')}</li>" for i in range(1, 9)) + "</ul>")
            + f'<section class="section"><div class="wrap"><p class="faint">{t("ch_pics")}</p></div></section>\n')
    shell("games/characters.html", "ch", body)

    # the worlds
    rows = ""
    for w, levels, shot in WORLDS:
        img = f'<figure class="shot">{pic("3d", shot, EN[w + "_n"], "(max-width: 600px) 100vw, 480px")}</figure>' if shot else ""
        rows += (f'<div class="card world" id="{w}">{img}<div><h3>{t(w + "_n")}</h3><p class="role">{t(w + "_s")}</p><p>{t(w + "_t")}</p>'
                 f'<p><b>{t("w_levels")}</b> <span>{t(w + "_l")}</span> · <b>{t("w_free")}</b> {t(w + "_f")}</p></div></div>')
    body = hero("w") + f'<section class="section"><div class="wrap"><div class="worlds">{rows}</div><p class="faint" style="margin-top:14px">{t("w_both")}</p></div></section>\n'
    shell("games/worlds.html", "w", body)

    # the Wrong Year
    rows = ""
    for c in CITIES:
        img = (f'<picture><source srcset="{pre}assets/films/wrong-year/{c}.webp" type="image/webp"><img src="{pre}assets/films/wrong-year/{c}.jpg" alt="{e(EN[c + "_n"])}" loading="lazy" width="1280" height="720"></picture>')
        rows += (f'<div class="card world" id="{c}"><figure class="shot">{img}</figure><div><h3>{t(c + "_n")}</h3><p class="role">{t(c + "_s")}</p>'
                 f'<p><b>{t("wy_story")}</b> {t(c + "_t")}</p></div></div>')
    body = (hero("wy", f'<p><b>{t("wy_soon")}</b></p>') + f'<section class="section"><div class="wrap"><div class="worlds">{rows}</div>'
            + f'<p class="faint" style="margin-top:14px">{t("wy_care")}</p></div></section>\n')
    shell("games/the-wrong-year.html", "wy", body)

    # how to solve each puzzle
    for p, (slug, n) in PUZZLES.items():
        rules = "".join(f"<li>{e(r)}</li>" for r in ctx["rules"][p][:-1] if not r.startswith(("Tap ", "Drag "))) if ctx["rules"].get(p) else ""
        body = (f'  <section class="tool-hero"><div class="wrap"><p class="kicker">{t("pz_kicker")}</p><h1>{t(p + "_h1")}</h1><p class="lead">{t(p + "_lead")}</p>'
                f'<div class="ctas"><a class="btn btn-primary btn-big" href="{p}.html">{t("pz_play")}</a></div></div></section>\n'
                + (sec(EN["pz_rules"], f'<ul class="facts">{rules}</ul>') if rules else "")
                + sec(EN["pz_tech"], f'<p>{t("pz_unique")}</p><ol class="facts steps">' + "".join(f"<li>{t(f'{p}_t{i}')}</li>" for i in range(1, n + 1)) + "</ol>"
                      + f'<p style="margin-top:16px"><a class="btn btn-primary" href="{p}.html">{t("pz_play")}</a></p>'))
        shell(f"games/{slug}.html", p, body)
    return out
