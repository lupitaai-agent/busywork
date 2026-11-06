/* The levels, as data; game.js plays them. A level is a place, a team and five screens. x is metres from the middle of the room
   (the walk line runs from -2.6 to 2.6). A lesson stays up until done(g) is true; g is the running game (game.js, api).

   Things in a screen:
     crate {x}             hop over it
     stack {x}             crates to hide behind, with a glowing spot
     hide  {from,to,z}     hide behind what the room already has
     tool  {tool,x,for}    lies on the floor; only that figure can use it
     gate  {x, lock?, level?}   Red Tape across the way: scissors, or a knot puzzle
     smash {x}             crates in the way: only a hammer gets through
     plate {x, opens}      holds a door open while someone stands on it
     door  {id, x}         Red Tape that lifts while its plate is pressed
     lever {x, stops, secs} stops a machine for a while
     press {id, x}         comes down in a rhythm
     guard {who, from}     patrols; sees along the red light
     snarl {x, from, to}   patrols without seeing; touching it is bad; a hammer flattens it
     falling {}            stacks of paper in lanes
     boss  {who, puzzle, level}   charges along the floor; hide, then cut them loose when dizzy
     beam  {who, puzzle, level, post}   walks along a high beam, dropping paper; hit the post to shake them down
     animal {name, x, z, size}  just there, moving a little
     ledge {from,to,y}     a floor higher up. Walk off the end and you drop
     vine {x,y}            only a climber goes up this
     ladder {x,y}          anyone goes up this
     coil {x,y}            a rope on a ledge: drop it with E, then anyone can climb it
     pocket {name,x}       anyone can pick it up: the key for a gate with lock 'key'
     pigeon {x}            run past and it flies up: the guard comes running
     pots {x,y}            take one with E, throw it with T: flattens snarls, rings bells, knocks people off beams
     bell {x,y,does}       something to throw at. does: {stops, secs} stops the press for a while
     mat {id,from,to}      sticky tape on the floor: touching it is bad. A lever with opens: id rolls it up
     low {x}               tape at chest height: only something small rolls under it (walk and press Down)
     bar {from,to,y}       a pipe to hang from, hand over hand (Zip)
     swing {x,y,len}       a rope that swings by itself (Zip)
     ledge also takes grab:true (Tuck and Zip can hop up and pull themselves onto it) and rope:true (a tightrope)
     pocket also takes y, and loose:true (carried on the head, can be thrown and caught)
     A level can say stage:2 (two on screen at most), offstage:[names] and joinAt (from which screen they can be called)
     A level can say moves:{grab,roll,toss} (the screen each new move starts on) and coda:{line,wait} (the one you free joins in, and the film waits until a stow item is taken)
     tool and pocket also take y and z. pocket takes stow:true (goes in a pocket, and ends the coda). falling takes count. ledge with baked also takes z (how far back it stands)
     A lesson can say back:(g) => true to return to the lesson before it
     swing also takes grows:true (a basket: water it and the vine comes down). note takes y. bigspool takes high:true (the end is out of reach: somebody has to be thrown up). Thrown cheese counts as left there
     A level can have opening and closing films {src, web, lines}: the download edition plays them all, the web edition only those with web:true
     A screen can say everyone:true (everybody on screen, whatever the level's stage). A broken pot is a noise: an awake guard goes to look, and pots can be thrown from behind cover
     roller {name,from,to} an animal rolling back and forth; doors with rolls:true lift for it
     knot {x,y,by,how,lock,level}  a spool holding a gate with lock 'knots': how 'hit', 'pull', or a puzzle lock
     walker {who,x,from,to} a tapeling on legs: bumps into you, falls over when hit
     pull {x}, bossivy {who,puzzle,level}  a boss who runs to levers. Stand by all of them, and she has nothing left
     seed {x,y}            water it (can) and it grows a vine anybody can climb
     note {x,id,text}      read it with E; the answers for a talker are in these
     pushbox {x,max}       only Rivet pushes it; holds a plate down.  cat {} sits on it until you're nice to it
     shredder {x,to}       big lever (Ivy only) sends it along the rails; it eats the gate, and anyone in its way
     biglever {x}          only someone who can 'pull'
     tube {x,to,fits}      post yourself to the other side, if you fit
     talker {who,x,questions,puzzle,level}  a boss you answer: each right answer takes off some tape
     form {x,name,questions}  answers open a gate with lock 'form'; hidden:true on a pocket, note, knot or slot: only Olaf's read-the-room shows it
     mouse {x}             pocket cheese, leave it by a shut door, stand back, and it chews through
     steam {id,x,on,off,phase,linked}, valve {x,stops,secs,strong}   shutting one pipe sends the pressure to the linked ones
     slot {name,x}, thing {name,x}  carry each thing to its place: a gate with lock 'things' opens when all are back
     letters {who,x,pages,questions,puzzle,level}  a boss throwing red letters (hop) and white ones (catch them), then you read them back
     bigspool {x,puzzle,level}, biglever {x,brake}  the end of the Street
     lantern {x}           lights the dark around whoever carries it (screen time 'dark': the plain picture shows through a circle)
   baked: true on a crate, stack, ledge or ladder: it is in the room's picture, so the game only needs to know where.
   A screen can also say: place (another place's room), time ('evening', 'dark'), say (which enter_ lines), air ({dust, leaves, smoke}). */
window.SNIP_LEVELS = [
  {
    id: 'workshop', title: 'The Quiet Workshop', place: 'level1', team: ['tuck'], frees: 'rivet', moves: { grab: 0, roll: 2, toss: 3 }, coda: { line: 'stamp_where', wait: 3400 },
    opening: { src: 'assets/rooms/level1/film-opening.mp4', web: true, lines: [
      { from: 14.5, to: 19, who: 'Tuck', text: 'Rivet? It\'s Tuck! You were meant to return my stamp on Tuesday!' },
      { from: 21.5, to: 25.5, who: 'Tuck', text: 'Why is there red tape on Rivet\'s shop? Who authorised this?' },
    ] },
    closing: { src: 'assets/rooms/level1/film-ending.mp4', web: true, lines: [
      { from: 0.5, to: 5, who: 'Rivet', text: 'So that\'s your stamp. Now, why am I holding a form? Who gave me a form?' },
      { from: 6.2, to: 10.3, who: 'Rivet', text: 'Hm. Whoever did this owes me a new shutter. I\'ll bring the hammer.' },
      { from: 11, to: 15.5, who: 'Tuck', text: 'The tape came through the Glasshouse first. We\'d better find Pim.' },
    ] },
    intro: ['The Red Tape has crept into the Workshop, and Rivet has gone quiet.', 'Everyone it catches turns into a tangled, snarling version of themselves. Tuck goes to find them. Cut them loose and they are your friends again.'],
    next: 'Rivet brings his hammer, and together you go looking for Pim.',
    screens: [
      { room: 'front', time: 'evening', air: { leaves: 16, dust: 18 }, title: 'Outside the Workshop', things: [{ t: 'crate', x: -1.3, baked: true, h: 0.43 }, { t: 'ledge', from: 0.36, to: 1.64, y: 1.02, z: -0.72, baked: true, grab: true }, { t: 'tool', tool: 'scissors', x: 1.0, y: 1.02, z: -0.72, for: 'tuck' }, { t: 'stack', x: 1.0, baked: true }, { t: 'gate', x: 2.1 }],
        lessons: [
          { html: 'Hold <kbd>→</kbd> to walk', teach: 'walk', done: (g) => g.hero.x > -1.95 },
          { html: 'A planter in the way! Press <kbd>Space</kbd> as you walk to hop over it', teach: 'hop', done: (g) => g.hero.x > -0.8 },
          { html: 'Scissors, up on those crates! Stand at the near end of the crates and press <kbd>Space</kbd>. Tuck pulls up', teach: 'hop', done: (g) => g.hero.y > 1 || g.hero.tool },
          { html: 'Walk to the scissors and press <kbd>E</kbd> to pick them up', teach: 'use', done: (g) => g.hero.tool },
          { html: 'Now hop down. Practise hiding: walk onto the glowing spot, then press <kbd>↓</kbd>', teach: 'hide', done: (g) => g.hero.hidden },
          { html: 'Nobody can see you there. Press <kbd>↑</kbd> to come out', teach: 'hide', done: (g) => !g.hero.hidden },
          { html: 'Stand next to the Red Tape and press <kbd>E</kbd> to snip it', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'The way is free. Go through the door on the right. Hold <kbd>Shift</kbd> to run', teach: 'run' },
        ] },
      { room: 'bench', air: { dust: 70 }, title: 'The workbench', things: [{ t: 'stack', x: 0.1, baked: true }, { t: 'guard', who: 'pim', from: 1.7 }],
        lessons: [
          { html: 'Pim is tangled and on patrol. The red light is what Pim sees. Walk to the glowing spot', teach: 'walk', done: (g) => g.inZone() },
          { html: 'Quick! Press <kbd>↓</kbd> to hide behind the crates', teach: 'hide', done: (g) => g.hero.hidden },
          { html: 'Stay hidden. Wait until Pim has walked past you', done: (g) => g.guard.dir < 0 && g.guard.x < g.hero.x - 0.5 },
          { html: 'Now! Press <kbd>↑</kbd>, then hold <kbd>→</kbd> and <kbd>Shift</kbd> to run through the door', teach: 'run' },
        ] },
      { room: 'counter', air: { dust: 40, dustColor: 0xfff4dc }, title: 'The counter', things: [{ t: 'falling', count: 3 }, { t: 'low', x: 2.2 }],
        lessons: [
          { html: 'The backlog is coming down from those trays. A shadow on the floor shows where. Walk between them, <kbd>Shift</kbd> to run', teach: 'run', done: (g) => g.hero.x > 1.1 },
          { html: 'The tape is too low to walk under. Hold <kbd>→</kbd> and press <kbd>↓</kbd> to roll', teach: 'hide', done: (g) => g.hero.x > 2.25 },
          { html: 'Through the door', teach: 'walk' },
        ] },
      { room: 'stock', say: 'stock_dark', time: 'dark', air: { dust: 45 }, title: 'The stockroom, lights out', things: [
          { t: 'lantern', x: -1.75 }, { t: 'crate', x: -0.7, baked: true, h: 0.46 },
          { t: 'ladder', x: 0.22, y: 1.3, baked: true }, { t: 'ledge', from: 0.0, to: 1.5, y: 1.3, baked: true },
          { t: 'door', id: 'wall', x: 1.0, shut: true }, { t: 'pots', x: 0.5, y: 1.3, z: -0.1 }, { t: 'snarl', x: 1.9, from: 1.65, to: 2.15 }, { t: 'gate', x: 2.3, lock: 'stars', level: 1 },
        ],
        lessons: [
          { html: 'Somebody has turned the lights off. There\'s a lantern by your feet: walk to it and press <kbd>E</kbd>', teach: 'use', done: (g) => g.hasLamp() },
          { html: 'Now you can see! Press <kbd>Space</kbd> to hop over the crate', teach: 'hop', done: (g) => g.hero.x > -0.3 },
          { html: 'Tape across the floor, and a loft above it. Stand at the ladder and hold <kbd>↑</kbd>', teach: 'hop', done: (g) => g.hero.y > 1 },
          { html: 'Something is moving by the knot down there: a snarl, a living knot of tape. Don\'t touch it. There are pots by the ladder: press <kbd>E</kbd>', teach: 'use', done: (g) => g.hero.carry || g.snarls() === 0 },
          { html: 'Hold <kbd>T</kbd>, move the spot onto the snarl with <kbd>←</kbd> <kbd>→</kbd>, and let go. Missed? There are more pots', teach: 'throw', done: (g) => g.snarls() === 0 },
          { html: 'Got it! Now walk off the far end of the loft. It isn\'t far', teach: 'walk', done: (g) => g.hero.x > 1.5 && g.hero.y < 0.1 },
          { html: 'This knot is too tight for scissors. Stand by it and press <kbd>E</kbd>', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'The way is free. Go through the door on the right', teach: 'walk' },
        ] },
      { room: 'yard', time: 'evening', air: { leaves: 12, smoke: [-1.5, 3.3, -5.6] }, title: 'The yard', things: [{ t: 'hide', from: -0.45, to: 2.2, z: -1.35 }, { t: 'ledge', from: -0.35, to: 2.15, y: 1.45, z: -1.35, baked: true }, { t: 'pocket', name: 'stamp', x: 0.55, y: 1.45, z: -1.35, stow: true }, { t: 'boss', who: 'rivet', puzzle: 'duo', level: 1 }],
        lessons: [
          { html: 'That is Rivet, tangled from head to foot! Get to the glowing spot and press <kbd>↓</kbd> to hide', teach: 'hide', done: (g) => g.hero.hidden },
          { html: 'Stay behind the van until Rivet has run past and gone dizzy', done: (g) => g.boss.mode === 'dizzy' },
          { html: 'Now! Press <kbd>↑</kbd>, run to Rivet and press <kbd>E</kbd> before he wakes', teach: 'use', done: (g) => g.boss.freed },
          { html: 'Rivet is free!', done: (g) => g.sinceFree() > 6 },
          { html: 'Tuck\'s stamp is on the van roof, too high to reach. Rivet is strong: press <kbd>Tab</kbd> to swap to Rivet', teach: 'switch', done: (g) => g.hero.key === 'rivet' || g.actor('tuck').y > 1 },
          { html: 'Walk up to Tuck and press <kbd>E</kbd> to lift', teach: 'use', done: (g) => g.lifting() || g.actor('tuck').y > 1 },
          { html: 'Hold <kbd>T</kbd> to aim. Move the yellow spot onto the van roof with <kbd>←</kbd> <kbd>→</kbd>, then let go', teach: 'throw', done: (g) => g.actor('tuck').y > 1 },
          { html: 'Nice landing. Walk to the stamp and press <kbd>E</kbd>', teach: 'use', done: (g) => g.taken('stamp') },
          { html: 'The stamp is back. Only a little overdue' },
        ] },
    ],
  },
  {
    id: 'glasshouse', title: 'Up the Glasshouse', place: 'glasshouse', team: ['tuck', 'rivet', 'zip'], offstage: ['zip'], joinAt: 1, stage: 2, tools: { tuck: 'scissors' }, frees: 'pim',
    opening: { src: 'assets/rooms/l2/film-opening.mp4', lines: [
      { from: 1, to: 5.5, who: 'Rivet', text: 'Tape on a glasshouse. Who tapes a glasshouse?' },
      { from: 6.2, to: 10.2, who: 'Tuck', text: 'Someone who has never watered anything. Pim is up there somewhere.' },
      { from: 12.4, to: 16.5, who: 'Zip', text: 'Post for Pim! Nobody is signing for anything today. I\'m Zip. Need legs?' },
    ] },
    closing: { src: 'assets/rooms/l2/film-ending.mp4', lines: [
      { from: 0.6, to: 4.8, who: 'Pim', text: 'Oh. Oh, hello. I had a list. I was counting the tape.' },
      { from: 5.4, to: 9.6, who: 'Pim', text: 'Then the list started counting me. Who is next on it?' },
      { from: 10.2, to: 14.4, who: 'Zip', text: 'That\'s my round. Shout if you need a rope!' },
    ] },
    intro: ['Rivet has a hammer, and a score to settle. The tape came through the Glasshouse first, and Pim is somewhere up there.', 'Two of you fit on screen at once. Nobody can do everything, so press Tab to swap between them.'],
    next: 'Pim knows the way to the top of the tower, and Ivy has not been seen for days. Zip has gone back to the post, but says to shout.',
    screens: [
      { room: 'foot', title: 'The foot of the tower', things: [{ t: 'tool', tool: 'hammer', x: -1.6, for: 'rivet' }, { t: 'smash', x: -0.65 }, { t: 'ledge', from: 0.35, to: 1.75, y: 1.3 }, { t: 'knot', x: 1.25, y: 1.3, by: 'tuck', how: 'cut' }, { t: 'gate', x: 2.15, lock: 'knots' }, { t: 'animal', name: 'frog', x: -1.9, z: -0.75, size: 0.2 }],
        lessons: [
          { html: 'Two of you now! Press <kbd>Tab</kbd> to swap to Rivet', teach: 'switch', done: (g) => g.hero.key === 'rivet' },
          { html: 'Walk Rivet to the hammer and press <kbd>E</kbd>', teach: 'use', done: (g) => g.actor('rivet').tool },
          { html: 'Crates in the way. Walk up to them and press <kbd>F</kbd> to hit them', teach: 'hit', done: (g) => g.smashed() },
          { html: 'The knot is up on that shelf, and only Tuck has scissors. Rivet is strong: walk up to Tuck and press <kbd>E</kbd> to lift', teach: 'use', done: (g) => g.lifting() || g.actor('tuck').y > 1 },
          { html: 'Hold <kbd>T</kbd> to aim. Move the yellow spot onto the shelf with <kbd>←</kbd> <kbd>→</kbd>, then let go', teach: 'throw', done: (g) => g.actor('tuck').y > 1 },
          { html: 'Nice landing. Walk Tuck to the knot and press <kbd>E</kbd>', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'The way is free. Walk out on the right, and your friend comes along', teach: 'walk' },
        ] },
      { room: 'potting', title: 'The potting bench', things: [{ t: 'mat', id: 'mat', from: -0.45, to: 1.2 }, { t: 'swing', x: 0.42, y: 3.3, len: 1.72 }, { t: 'lever', x: 1.65, opens: 'mat' }, { t: 'low', x: 2.15 }, { t: 'animal', name: 'hedgehog', x: 2.4, z: -0.7, size: 0.22 }],
        lessons: [
          { html: 'The floor is sticky tape, and the rope is too high for you. Press <kbd>Q</kbd>: whoever you are goes, and Zip comes in', teach: 'call', done: (g) => g.onStage('zip') },
          { html: 'Walk Zip to the edge of the tape, without touching it. When the rope swings close, press <kbd>Space</kbd> to hop and grab', teach: 'hop', done: (g) => g.onRope() || g.actor('zip').x > 1.25 },
          { html: 'Swing with <kbd>←</kbd> <kbd>→</kbd>. Over the far side, press <kbd>Space</kbd> to let go', teach: 'hop', done: (g) => g.actor('zip').x > 1.25 && g.actor('zip').y < 0.1 },
          { html: 'Pull the lever with <kbd>E</kbd>', teach: 'use', done: (g) => g.matOpen('mat') },
          { html: 'The way out is too low to walk through. Hold <kbd>→</kbd> and press <kbd>↓</kbd> to roll under it', teach: 'hide', done: (g) => g.hero.x > 2.2 },
          { html: 'Walk out on the right. The others will catch up', teach: 'walk' },
        ] },
      { room: 'trellis', title: 'The trellis', things: [{ t: 'bar', from: -1.55, to: 0.5, y: 2.5 }, { t: 'ledge', from: 0.5, to: 1.5, y: 1.25, rope: true }, { t: 'ledge', from: 1.5, to: 2.05, y: 1.25, grab: true }, { t: 'pots', x: 1.82, y: 1.25 }, { t: 'snarl', x: -0.3, from: -0.75, to: 0.2 }, { t: 'snarl', x: 0.9, from: 0.4, to: 1.5 }, { t: 'gate', x: 2.42, lock: 'stars', level: 2 }],
        lessons: [
          { html: 'Snarls! Living knots of tape, so stay off the floor. The pipe is high: only Zip can flip up to it. Bring in Zip if you need to (<kbd>Q</kbd>). Stand under the pipe, before the first snarl, and press <kbd>Space</kbd> twice', teach: 'hop', done: (g) => g.hanging() || g.actor('zip').x > 0.4 || g.snarls() < 2 },
          { html: '<kbd>←</kbd> <kbd>→</kbd> goes along the pipe', teach: 'walk', done: (g) => g.actor('zip').x > 0.4 || g.snarls() < 2 },
          { html: 'At the far end, press <kbd>Space</kbd> to drop onto the tightrope. Walk it slowly to the far shelf', teach: 'walk', done: (g) => g.actor('zip').x > 1.5 || g.snarls() < 2 },
          { html: 'Pots! Press <kbd>E</kbd> to take one. Hold <kbd>T</kbd>, move the spot in front of a snarl, and let go', teach: 'throw', done: (g) => g.snarls() < 2 },
          { html: 'One down! Now the other. Take another pot', teach: 'throw', done: (g) => g.snarls() === 0 },
          { html: 'All clear. Now the knot on the way out: walk up to it and press <kbd>E</kbd>', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'Walk out on the right', teach: 'walk' },
        ] },
      { room: 'print', title: 'The print room', things: [{ t: 'pots', x: -2.2 }, { t: 'ledge', from: -1.75, to: -0.85, y: 1.2, grab: true }, { t: 'pocket', name: 'key', x: -1.3, y: 1.2, loose: true }, { t: 'bell', x: -0.45, y: 2.1, does: { stops: 'press1', secs: 7 } }, { t: 'press', id: 'press1', x: 0.3 }, { t: 'smash', x: 1.35 }, { t: 'gate', x: 2.15, lock: 'key' }],
        lessons: [
          { html: 'The stamp press comes down in a rhythm. That bell stops it. Take a pot with <kbd>E</kbd>, hold <kbd>T</kbd>, move the spot to the bell, and let go', teach: 'throw', done: (g) => g.bellRung() || g.actor('rivet').x > 0.8 },
          { html: 'It stopped, but not for long. Rivet has to get past. <kbd>Tab</kbd> or <kbd>Q</kbd> to get Rivet, and run!', teach: 'run', done: (g) => g.actor('rivet').x > 0.8 },
          { html: 'More crates: that is a job for the hammer, <kbd>F</kbd>', teach: 'hit', done: (g) => g.smashed() },
          { html: 'The key is on the shelf back there, too high for Rivet. Swap with <kbd>Tab</kbd>, stand under the end of the shelf and press <kbd>Space</kbd> to pull up', teach: 'hop', done: (g) => g.hero.y > 1 || g.keyWith('rivet') || g.gateOpen() },
          { html: 'Take the key with <kbd>E</kbd>, hold <kbd>T</kbd>, and put the spot on Rivet. Rivet will catch it', teach: 'throw', done: (g) => g.keyWith('rivet') || g.gateOpen() },
          { html: 'Good catch! Rivet: walk to the padlock and press <kbd>E</kbd>', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'Walk out on the right, up to the roof', teach: 'walk' },
        ] },
      { room: 'roof', title: 'The roof', things: [{ t: 'pots', x: -2.25 }, { t: 'pots', x: 2.3 }, { t: 'beam', who: 'pim', post: 0.2, puzzle: 'duo', level: 2 }],
        lessons: [
          { html: '<b>Step 1 of 2: knock Pim off the beam.</b> Go to a glowing spot: press <kbd>E</kbd> for a pot, hold <kbd>T</kbd>, put the spot on Pim, let go. Or as Rivet, hit the post with <kbd>F</kbd> when Pim is near it. Mind the falling paper', teach: 'throw', done: (g) => g.boss.mode === 'dizzy' || g.boss.mode === 'falling' },
          { html: '<b>Step 2 of 2: cut Pim loose.</b> Only Tuck has scissors, and Pim waits for Tuck. Be Tuck, walk to Pim and press <kbd>E</kbd>', teach: 'use', back: (g) => g.boss.mode === 'walk', done: (g) => g.boss.freed },
          { html: 'Pim is free!' },
        ] },
    ],
  },
  {
    id: 'topfloor', title: 'The Top Floor', place: 'glasshouse', team: ['tuck', 'rivet', 'pim'], offstage: ['rivet'], stage: 2, tools: { tuck: 'scissors', rivet: 'hammer' }, frees: 'ivy',
    opening: { src: 'assets/rooms/l3/film-opening.mp4', lines: [
      { from: 1, to: 4.8, who: 'Pim', text: 'There used to be a ladder here. I wrote down where it went.' },
      { from: 5.4, to: 8, who: 'Rivet', text: 'And?' },
      { from: 8.2, to: 11, who: 'Pim', text: 'I can\'t read my writing.' },
      { from: 11.6, to: 15.4, who: 'Tuck', text: 'Ivy? It\'s Tuck! She is never this quiet.' },
    ] },
    closing: { src: 'assets/rooms/l3/film-ending.mp4', lines: [
      { from: 0.6, to: 4.8, who: 'Ivy', text: 'Who let my ferns go dry? Who has been filing my ferns?' },
      { from: 5.4, to: 9.6, who: 'Tuck', text: 'That was you, a bit. You were very thorough.' },
      { from: 10.2, to: 14.4, who: 'Ivy', text: 'Then the last of it went to Olaf\'s study. Bring a watering can.' },
    ] },
    intro: ['Pim knows the way up, mostly by ladders that are not there any more.', 'Ivy has not been heard for days, and Ivy is never quiet. Two of you fit on screen, and Q brings in the third. For Ivy, you will need all three.'],
    next: 'Ivy says the last of the tape went upstairs, into Olaf\'s study. Olaf hasn\'t answered a note in a week. That part comes next.',
    screens: [
      { room: 'lookout', title: 'The lookout', things: [{ t: 'ledge', from: -0.45, to: 2.7, y: 1.3 }, { t: 'vine', x: -0.5, y: 1.3 }, { t: 'coil', x: 0.45, y: 1.3 }, { t: 'smash', x: 1.3, y: 1.3 }, { t: 'gate', x: 2.15, y: 1.3 }, { t: 'door', id: 'wall', x: 1.05, shut: true }],
        lessons: [
          { html: 'The way out is up there, and the floor is taped shut. Only Pim can climb. Press <kbd>Tab</kbd> to swap to Pim', teach: 'switch', done: (g) => g.hero.key === 'pim' },
          { html: 'Walk Pim to the vine and hold <kbd>↑</kbd> to climb', teach: 'hop', done: (g) => g.actor('pim').y > 1 },
          { html: 'A rope! Walk to it and press <kbd>E</kbd> to drop it for the others', teach: 'use', done: (g) => g.ropeDown() },
          { html: 'Crates up here, and only Rivet has a hammer. Press <kbd>Q</kbd>: Pim goes, Rivet comes in', teach: 'call', done: (g) => g.onStage('rivet') },
          { html: 'Rivet: walk to the rope and hold <kbd>↑</kbd>', teach: 'hop', done: (g) => g.actor('rivet').y > 1 },
          { html: 'Walk up to the crates and press <kbd>F</kbd>', teach: 'hit', done: (g) => g.smashed() },
          { html: 'And the tape needs scissors. <kbd>Tab</kbd> to Tuck, up the rope, and press <kbd>E</kbd> at the tape', teach: 'switch', done: (g) => g.gateOpen() },
          { html: 'Off along the ledge, out on the right', teach: 'walk' },
        ] },
      { room: 'bridge', title: 'The rope bridge', things: [{ t: 'pots', x: -2.0 }, { t: 'stack', x: -0.1 }, { t: 'guard', who: 'inspector', from: 1.4, wake: 2 }, { t: 'pigeon', x: -1.25 }, { t: 'pigeon', x: 1.1 }, { t: 'pigeon', x: 1.9 }],
        lessons: [
          { html: 'Pots break with a noise, and an inspector has to look into every noise. Take a pot with <kbd>E</kbd>. It may come in handy', teach: 'use', done: (g) => g.hero.carry || g.hero.x > -1.85 },
          { html: 'Pigeons! <b>Walk, don\'t run:</b> run past them and they go up, and tell the inspector', teach: 'walk', done: (g) => g.hero.x > -1.85 },
          { html: 'The inspector! The red light is what he sees. Before he turns round: walk to the glowing spot and press <kbd>↓</kbd>', teach: 'hide', done: (g) => g.hero.hidden },
          { html: 'Wait until he has walked past you. In a hurry? Hold <kbd>T</kbd> and throw your pot to the left, behind you: he has to go and look', teach: 'throw', done: (g) => g.guard.dir < 0 && g.guard.x < g.hero.x - 0.5 },
          { html: 'Now! Press <kbd>↑</kbd> and walk out on the right. Walk, remember: more pigeons', teach: 'walk' },
        ] },
      { room: 'roots', title: 'The roots', things: [{ t: 'door', id: 'd1', x: -0.55, rolls: true }, { t: 'door', id: 'd2', x: 1.05, rolls: true }, { t: 'roller', name: 'hedgehog', from: -1.9, to: 1.9, speed: 0.95 }, { t: 'pocket', name: 'key', x: 0.25 }, { t: 'gate', x: 2.2, lock: 'key' }],
        lessons: [
          { html: 'Two tape walls, too thick for anyone. But look at that hedgehog: tape can\'t hold it, and it lifts as it rolls through. Follow it', teach: 'walk', done: (g) => g.hero.x > -0.4 },
          { html: 'Somebody dropped a key! Press <kbd>E</kbd>', teach: 'use', done: (g) => g.hasKey() },
          { html: 'Wait for the hedgehog again, and get through the second wall behind it', teach: 'walk', done: (g) => g.hero.x > 1.2 },
          { html: 'Now the padlock: stand by it and press <kbd>E</kbd>', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'The way is free. Walk out on the right, and your friend comes along', teach: 'walk' },
        ] },
      { room: 'trellis', say: 'trellis_dark', time: 'evening', title: 'The trellis, after hours', things: [{ t: 'knot', x: -1.15, by: 'tuck', how: 'puzzle', lock: 'stars', level: 3 }, { t: 'knot', x: 0.7, by: 'rivet', how: 'hit' }, { t: 'bar', from: -1.55, to: 0.5, y: 2.5 }, { t: 'ledge', from: 0.5, to: 1.5, y: 1.25, rope: true }, { t: 'ledge', from: 1.5, to: 2.05, y: 1.25 }, { t: 'knot', x: 1.75, y: 1.25, by: 'pim', how: 'pull' }, { t: 'gate', x: 2.3, lock: 'knots' }, { t: 'walker', who: 'tapeling', x: 0, from: -0.5, to: 0.9 }, { t: 'walker', who: 'tapeling2', x: 1.8, from: 1.15, to: 2.05, speed: 0.8 }],
        lessons: [
          { html: 'Tapelings! They run about and bump into you. Rivet can knock them down: get close and press <kbd>F</kbd>', teach: 'hit', done: (g) => g.snarls() === 0 },
          { html: 'Three spools hold that gate, and each one is somebody\'s job. The low one is Rivet\'s: walk up to it and press <kbd>F</kbd>', teach: 'hit', done: (g) => g.cutBy('rivet') },
          { html: 'The knot on the left is Tuck\'s. <kbd>Tab</kbd> to Tuck, stand by it and press <kbd>E</kbd>', teach: 'use', done: (g) => g.cutBy('tuck') },
          { html: 'The high one is Pim\'s, and it\'s a long way up. Press <kbd>Q</kbd> to bring in Pim, stand under the pipe and press <kbd>Space</kbd> twice', teach: 'call', done: (g) => g.hanging() || g.actor('pim').x > 0.6 || g.cutBy('pim') },
          { html: '<kbd>←</kbd> <kbd>→</kbd> goes along the pipe. At the far end, press <kbd>Space</kbd> to drop onto the tightrope, and walk it slowly to the shelf', teach: 'walk', done: (g) => g.actor('pim').x > 1.5 || g.cutBy('pim') },
          { html: 'Press <kbd>E</kbd> at the high spool', teach: 'use', done: (g) => g.cutBy('pim') },
          { html: 'All three! Walk out on the right', teach: 'walk' },
        ] },
      { room: 'ivy', place: 'experts', everyone: true, title: 'Ivy\'s room', things: [{ t: 'pull', x: -0.95 }, { t: 'pull', x: 0.5 }, { t: 'pull', x: 1.95 }, { t: 'bossivy', who: 'ivy', puzzle: 'duo', level: 3 }],
        lessons: [
          { html: 'This one takes all three of you. Every lever Ivy pulls brings paper down on you. She can\'t pull a lever with someone standing by it. Walk to a lever and stay there', teach: 'walk', done: (g) => g.pullsHeld() >= 1 },
          { html: 'That one is yours. Press <kbd>Tab</kbd> and walk someone else to the next lever. In a hurry? Rivet can throw a friend there', teach: 'switch', done: (g) => g.pullsHeld() >= 2 },
          { html: 'One left. Get the third one there', teach: 'switch', done: (g) => g.boss.mode === 'dizzy' },
          { html: 'She\'s out of levers! <kbd>Tab</kbd> to Tuck, run to Ivy and press <kbd>E</kbd>', teach: 'use', done: (g) => g.boss.freed },
          { html: 'Ivy is free!' },
        ] },
    ],
  },
  {
    id: 'study', title: 'The Study Upstairs', place: 'workshop', team: ['tuck', 'rivet', 'pim', 'ivy'], offstage: ['rivet', 'pim'], stage: 2, tools: { tuck: 'scissors', rivet: 'hammer' }, frees: 'olaf',
    opening: { src: 'assets/rooms/l4/film-opening.mp4', lines: [
      { from: 1, to: 4.4, who: 'Ivy', text: 'The back stairs are gone. Who files away a staircase?' },
      { from: 5, to: 8.4, who: 'Tuck', text: 'He has left a note. It says: do not read this note.' },
      { from: 8.8, to: 11, who: 'Rivet', text: 'Did you read it?' },
      { from: 11.6, to: 15.4, who: 'Tuck', text: 'I\'m reading it now. It says I\'ll be asked about it later.' },
    ] },
    closing: { src: 'assets/rooms/l4/film-ending.mp4', lines: [
      { from: 0.6, to: 4.8, who: 'Olaf', text: 'Nobody sent you. You just came. There is no form for that.' },
      { from: 5.4, to: 10.4, who: 'Olaf', text: 'I kept one letter I couldn\'t file. It is in Juno\'s handwriting, from upstairs at your house, Tuck.' },
      { from: 11.6, to: 15.4, who: 'Tuck', text: 'My house?' },
    ] },
    intro: ['The tape went up the back stairs of the Workshop, into Olaf\'s study. It reads everything now.', 'Olaf won\'t charge at you. He will ask you questions. Read everything you find on the way up: he has hidden the answers in his own notes.', 'Two of you fit on screen, as ever. The number keys bring in anyone you need.'],
    next: 'Olaf has read every letter in town, and one of them is in Juno\'s handwriting. That part comes next.',
    screens: [
      { room: 'window', title: 'The back stairs', things: [{ t: 'tool', tool: 'can', x: -1.0, for: 'ivy' }, { t: 'note', x: -0.05, id: 'stamp', text: 'Lost stamps are signed for by the one who lost them. Nobody else may do it. O.' }, { t: 'seed', x: 0.75, y: 1.3 }, { t: 'ledge', from: 0.65, to: 2.7, y: 1.3 }, { t: 'door', id: 'wall', x: 1.45, shut: true }],
        lessons: [
          { html: 'Olaf leaves notes everywhere, and he will ask about them later. Walk to the note and press <kbd>E</kbd>', teach: 'use', done: (g) => g.read('stamp') },
          { html: 'The stairs are gone. That mound wants water, and Ivy knows about growing. <kbd>Tab</kbd> to Ivy and pick up the can', teach: 'switch', done: (g) => g.actor('ivy').tool },
          { html: 'Ivy: walk to the mound and press <kbd>E</kbd>', teach: 'use', done: (g) => g.grown() },
          { html: 'Now it holds anybody. Hold <kbd>↑</kbd> at the vine, and walk out on the right along the top', teach: 'walk' },
        ] },
      { room: 'office', title: 'The back office', things: [{ t: 'biglever', x: -1.5 }, { t: 'ledge', from: -1.05, to: -0.45, y: 1.2, grab: true }, { t: 'note', x: -0.75, y: 1.2, id: 'form', text: 'Form Eleven comes in three copies. One for you, one for me, one for the cat. O.' }, { t: 'shredder', x: 0.15, to: 1.55 }, { t: 'gate', x: 2.15, lock: 'none' }],
        lessons: [
          { html: 'Another note, and he has put it on a shelf. <kbd>Tab</kbd> to Tuck, hop at the end of the shelf with <kbd>Space</kbd>, and read it with <kbd>E</kbd>', teach: 'hop', done: (g) => g.read('form') },
          { html: 'That shredder runs on rails, right up to the tape. Only Ivy can move the big lever: <kbd>Tab</kbd>, then <kbd>E</kbd>. <b>Stand back:</b> it eats anything in its way', teach: 'switch', done: (g) => g.shredded() },
          { html: 'Lunch for the shredder! Wait for it to come back, stay clear, and walk out on the right', teach: 'walk' },
        ] },
      { room: 'stock', say: 'stock_again', title: 'The stockroom, rearranged', things: [{ t: 'note', x: -2.15, id: 'shelf', text: 'Nothing may be kept on the second shelf, except the cat. O.' }, { t: 'mat', id: 'mat', from: -1.47, to: 0.18 }, { t: 'swing', x: -0.6, y: 3.3, len: 1.72, grows: true }, { t: 'lever', x: 0.32, opens: 'mat' }, { t: 'pushbox', x: 1.3, max: 1.6 }, { t: 'cat' }, { t: 'plate', x: 1.65, opens: 'd' }, { t: 'door', id: 'd', x: 2.2 }],
        lessons: [
          { html: 'Read the note. Yes, every time', teach: 'use', done: (g) => g.read('shelf') },
          { html: 'The floor is sticky tape, and a basket hangs over it. Baskets want water, and Ivy has the can. <kbd>Tab</kbd> to Ivy, walk to the edge of the tape, and press <kbd>E</kbd>', teach: 'use', done: (g) => g.ropeGrown() || g.actor('ivy').x > 0.25 },
          { html: 'Ivy\'s vine! When it swings close, press <kbd>Space</kbd> to hop and grab', teach: 'hop', done: (g) => g.onRope() || g.actor('ivy').x > 0.25 },
          { html: 'Swing with <kbd>←</kbd> <kbd>→</kbd>. Over the far side, press <kbd>Space</kbd> to let go', teach: 'hop', done: (g) => g.actor('ivy').x > 0.25 },
          { html: 'Pull the lever with <kbd>E</kbd>', teach: 'use', done: (g) => g.matOpen('mat') },
          { html: 'That crate belongs on the brass plate, but there\'s a cat on it. Walk up and press <kbd>E</kbd> to be nice to the cat', teach: 'use', done: (g) => g.catMoved() },
          { html: 'Only Rivet can move the crate. Press <kbd>2</kbd> for Rivet and walk into it, slowly, onto the plate', teach: 'call', done: (g) => g.boxOn() },
          { html: 'The crate holds the door for everyone. Walk out on the right', teach: 'walk' },
        ] },
      { room: 'desk', title: 'The writing desk', things: [{ t: 'door', id: 'wall', x: 0.55, shut: true }, { t: 'tube', x: -0.5, to: 0.95, fits: ['tuck', 'pim'] }, { t: 'lever', x: 2.2, opens: 'wall' }, { t: 'walker', who: 'tapeling', x: 2.2, from: 1.75, to: 2.45, speed: 0.75 }],
        lessons: [
          { html: 'A wall of tape, and a post tube through it. Only the small fit. Press <kbd>1</kbd> for Tuck, then <kbd>E</kbd> at the tube', teach: 'use', done: (g) => g.hero.x > 0.7 },
          { html: 'A tapeling, and nobody to hit it. Pull that lever when its back is turned, or <kbd>Space</kbd> over it', teach: 'hop', done: (g) => g.wallOpen() },
          { html: 'The wall is open. Walk out on the right', teach: 'walk' },
        ] },
      { room: 'olaf', place: 'experts', title: 'The study', things: [{ t: 'talker', who: 'olaf', x: 1.0, puzzle: 'stars', level: 4, questions: [
            { q: 'YOU HAVE COME TO COLLECT A LOST STAMP. WHO SIGNS FOR IT?', a: ['Whoever finds it', 'The one who lost it', 'You do, Olaf'], right: 1, yes: 'CORRECT. DISAPPOINTINGLY.', wrong: 'INCORRECT. IT WAS ON THE NOTE. I WROTE THE NOTE. I WRITE ALL THE NOTES.' },
            { q: 'FORM ELEVEN. HOW MANY COPIES?', a: ['One, and it is lost', 'Eleven, obviously', 'Three: you, me and the cat'], right: 2, yes: 'THE CAT THANKS YOU. THE CAT HAS NOT READ IT.', wrong: 'NO. ASK THE CAT. THE CAT KNOWS.' },
            { q: 'WHAT MAY BE KEPT ON THE SECOND SHELF?', a: ['The cat', 'Nothing at all', 'The whole of the backlog'], right: 0, yes: 'WELL. YOU HAVE READ EVERYTHING. NOBODY READS EVERYTHING. ONLY ME.', wrong: 'INCORRECT. CHECK THE SHELF. THE CAT WILL NOT MIND. IT WILL MIND.' },
            { q: 'THEN ONE LAST QUESTION. WHO SENT YOU? THERE IS NO FORM FOR THIS.', a: ['The town council', 'Nobody. We came because you stopped answering', 'It is in the post'], right: 1, yes: 'Oh. Nobody sent you. You just came.', wrong: 'NOT ON ANY LIST. TRY AGAIN. PLEASE. PLEASE TRY AGAIN.' },
          ] }],
        lessons: [
          { html: 'Olaf doesn\'t chase anyone. He asks. Walk up to him and press <kbd>E</kbd>, and use what you read', teach: 'use', done: (g) => g.talked() },
          { html: 'He has stopped arguing. <kbd>1</kbd> for Tuck: walk up and press <kbd>E</kbd> to cut him loose', teach: 'use', done: (g) => g.boss.freed },
          { html: 'Olaf is free!' },
        ] },
    ],
  },
  {
    id: 'house', title: 'The House with the Door', place: 'house', team: ['tuck', 'rivet', 'pim', 'ivy', 'olaf'], offstage: ['rivet', 'pim', 'ivy'], stage: 2, tools: { tuck: 'scissors', rivet: 'hammer' }, frees: 'juno',
    opening: { src: 'assets/rooms/l5/film-opening.mp4', lines: [
      { from: 1, to: 5.4, who: 'Tuck', text: 'That\'s my door. Is that my letterbox? Who taped up my letterbox?' },
      { from: 6.4, to: 10.8, who: 'Olaf', text: 'There is a form, Tuck.' },
      { from: 12, to: 14.2, who: 'Tuck', text: 'For my own house?' },
      { from: 14.6, to: 17.4, who: 'Olaf', text: 'There is always a form.' },
    ] },
    closing: { src: 'assets/rooms/l5/film-ending.mp4', lines: [
      { from: 0.6, to: 4.2, who: 'Juno', text: 'Tuck. I am so sorry about the curtains.' },
      { from: 4.8, to: 7.6, who: 'Tuck', text: 'Where does it all come from, Juno?' },
      { from: 8, to: 10.8, who: 'Juno', text: 'Under the puzzle kiosk, at the end of the Street.' },
      { from: 11.4, to: 15.4, who: 'Juno', text: 'Bring everyone. Bring scissors. I\'ll write ahead.' },
    ] },
    intro: ['Olaf has read every letter in town, and one of them is in Juno\'s handwriting. It came from upstairs at Tuck\'s own house.', 'Five of you now, and Tuck is not going to like this. Olaf has something new: he reads the room, and shows you what nobody else can see. Two fit on screen, and the number keys bring in anyone else.'],
    next: 'Juno knows where it all comes from: under the puzzle kiosk, at the end of the Street. All six of you now. That part comes next.',
    screens: [
      { room: 'door', title: 'Tuck\'s front door', things: [
          { t: 'form', x: -0.2, name: 'Your own letterbox', questions: [
            { q: 'FORM ONE. NAME OF THE PERSON WISHING TO ENTER THEIR OWN HOME.', a: ['Tuck', 'As above', 'The occupant'], right: 1, yes: 'ACCEPTED. NEXT.', wrong: 'REJECTED. PLEASE SEE THE SMALL PRINT. YOU WILL NEED SOMEONE WHO READS.' },
            { q: 'ADDRESS OF THE SAID HOME.', a: ['As above', 'This one. Right here', 'Busy Street'], right: 0, yes: 'ACCEPTED. NEARLY THERE, AS FAR AS YOU KNOW.', wrong: 'REJECTED. THE SMALL PRINT WAS VERY CLEAR. IT WAS ALSO VERY SMALL.' },
            { q: 'REASON FOR WANTING TO COME IN.', a: ['I live here', 'It is raining', 'As above'], right: 2, yes: 'PERFECTLY IN ORDER. WIPE YOUR FEET. THE TAPE HAS ONLY JUST BEEN DONE.', wrong: 'REJECTED. THAT IS NOT A REASON. THAT IS A FACT.' },
          ] },
          { t: 'note', x: -1.35, id: 'small', hidden: true, text: 'The small print: every question on this form is to be answered "As above". Yes, the first one too.' },
          { t: 'gate', x: 2.1, lock: 'form' },
        ],
        lessons: [
          { html: 'Tuck\'s own home, and the letterbox wants a form. Walk up to it and press <kbd>E</kbd>', teach: 'use', done: (g) => g.formTried() },
          { html: 'Small print? Nobody can see that. Olaf can. Press <kbd>5</kbd> for Olaf, then <kbd>E</kbd> to read the room', teach: 'use', done: (g) => g.revealed() || g.formDone() },
          { html: 'There: a note that was there all along. Walk to it and press <kbd>E</kbd>', teach: 'use', done: (g) => g.read('small') || g.formDone() },
          { html: 'Now back to the letterbox, and do as it says', teach: 'use', done: (g) => g.formDone() },
          { html: 'Home at last. Walk out on the right', teach: 'walk' },
        ] },
      { room: 'contracts', title: 'The kitchen', things: [
          { t: 'pocket', name: 'cheese', x: -1.35, loose: true }, { t: 'mouse', x: -2.2 },
          { t: 'door', id: 'wall1', x: -0.35, shut: true },
          { t: 'walker', who: 'tapeling', x: 0.5, from: 0.05, to: 1.05, speed: 0.65 },
          { t: 'pocket', name: 'cheese', x: 0.6, hidden: true, loose: true },
          { t: 'door', id: 'wall2', x: 1.4, shut: true },
        ],
        lessons: [
          { html: 'Tape from wall to wall, and a mouse. Mice chew things. Pick up the cheese with <kbd>E</kbd>', teach: 'use', done: (g) => g.carrying('cheese') || g.baitDown() || g.chewed() >= 1 },
          { html: 'Walk up to the tape and press <kbd>E</kbd> to leave the cheese there. Or hold <kbd>T</kbd> and throw it from here', teach: 'throw', done: (g) => g.baitDown() || g.chewed() >= 1 },
          { html: 'The mouse is shy. Stand well back and let it come', teach: 'walk', done: (g) => g.chewed() >= 1 },
          { html: 'A tapeling behind it! Press <kbd>2</kbd> for Rivet, get close, press <kbd>F</kbd>', teach: 'hit', done: (g) => g.snarls() === 0 },
          { html: 'More tape, and no more cheese. Olaf knows where everything is. Press <kbd>5</kbd>, then <kbd>E</kbd>', teach: 'use', done: (g) => g.revealed() },
          { html: 'Behind the bread bin, of course. Take it, and get it to the second wall: carry it there, or hold <kbd>T</kbd> and throw it. Then stand back', teach: 'throw', done: (g) => g.chewed() >= 2 },
          { html: 'Walk out on the right. The mouse stays. It has earned it', teach: 'walk' },
        ] },
      { room: 'upkeep', title: 'The boiler cupboard', things: [
          { t: 'valve', x: -1.4, stops: 'a', secs: 5 }, { t: 'steam', id: 'a', x: -0.55, on: 3, off: 0.6, linked: true },
          { t: 'valve', x: 0.25, stops: 'b', secs: 5, strong: true }, { t: 'steam', id: 'b', x: 1.0, on: 3, off: 0.6, phase: 1.6, linked: true },
          { t: 'steam', id: 'c', x: 1.95, on: 1.2, off: 1.5, phase: 0.4 },
        ],
        lessons: [
          { html: 'Steam! And the second valve looks stiff, so send the one who knows valves. Press <kbd>4</kbd> for Ivy', teach: 'switch', done: (g) => g.hero.key === 'ivy' },
          { html: 'Turn the valve with <kbd>E</kbd>. It shuts the first pipe, for a moment', teach: 'use', done: (g) => g.valved('a') || g.hero.x > -0.2 },
          { html: 'The pressure has gone to the next pipe. Past the first one, quick!', teach: 'run', done: (g) => g.hero.x > -0.2 },
          { html: 'Now the stiff one: <kbd>E</kbd>, then go', teach: 'use', done: (g) => g.valved('b') || g.hero.x > 1.3 },
          { html: 'The last pipe has no valve. Watch its rhythm, and walk through when it stops', teach: 'walk' },
        ] },
      { room: 'inventory', title: 'The living room', things: [
          { t: 'pots', x: -2.42 }, { t: 'slot', name: 'stamp', x: -0.95, size: 0.34, hidden: true }, { t: 'slot', name: 'lantern', x: 1.25, size: 0.55, hidden: true }, { t: 'slot', name: 'bell', x: 1.75, size: 0.42, hidden: true },
          { t: 'thing', name: 'stamp', x: -1.75, size: 0.34 }, { t: 'thing', name: 'bell', x: -0.8, size: 0.42 }, { t: 'thing', name: 'lantern', x: 2.05, size: 0.55 },
          { t: 'hide', from: -0.55, to: 0.55, z: -1.05 },
          { t: 'gate', x: 2.35, lock: 'things' },
          { t: 'guard', who: 'tally', from: 0.6, dir: 1, wake: 2, speed: 0.85, pause: 1.6 },
        ],
        lessons: [
          { html: 'Everything has been moved, and labelled. Tally is here, tangled, and about to start counting. Olaf can see where things belong: press <kbd>5</kbd>, then <kbd>E</kbd>', teach: 'use', done: (g) => g.revealed() },
          { html: 'Each ring is where something goes. Pick it up with <kbd>E</kbd>, carry it to its ring, <kbd>E</kbd> again', teach: 'use', done: (g) => g.placed() >= 1 },
          { html: 'One back, and now Tally is counting! Stay out of the red light: <kbd>↓</kbd> on the glowing spot hides you. Tally counts every noise too, so a pot thrown far away buys time. Two to go', teach: 'hide', done: (g) => g.placed() >= 3 },
          { html: 'The room is itself again, and the tape has given up. Out on the right', teach: 'run' },
        ] },
      { room: 'juno', place: 'experts', title: 'The gable room', things: [
          { t: 'letters', who: 'juno', x: 1.8, puzzle: 'duo', level: 4,
            pages: ['Dear Tuck. There is tape in your house, and I am so sorry about the curtains.', 'It comes from under the puzzle kiosk, on the Street. Bring everyone. Bring scissors.', 'P.S. Whatever I say next, I do not mean it. Keep reading. Love, Juno.'],
            questions: [
              { q: 'DEAR OCCUPANT. WHAT DOES YOUR LETTER SAY IS IN THE HOUSE?', a: ['A final demand', 'Tape, and she is sorry about the curtains', 'Nothing. All is in order'], right: 1, yes: 'THE CURTAINS. I DID MEAN TO SAY ABOUT THE CURTAINS.', wrong: 'NOT AS PER MY LETTER. READ IT AGAIN, DEAR OCCUPANT.' },
              { q: 'AND WHERE DOES THE TAPE COME FROM? QUOTE YOUR REFERENCE.', a: ['Head office', 'It is in the post', 'Under the puzzle kiosk'], right: 2, yes: 'THE KIOSK. YES. IT IS COLD DOWN THERE. WHY DO I KNOW THAT?', wrong: 'THAT IS NOT WHAT I WROTE. I AM ALMOST SURE I WROTE SOMETHING.' },
              { q: 'ONE MORE THING, AS PER MY LAST. WHAT DOES THE P.S. SAY?', a: ['Whatever she says next, she does not mean it', 'Yours faithfully', 'Please find enclosed'], right: 0, yes: 'Oh. I wrote that. That was me. Hello, Tuck.', wrong: 'NO. THERE WAS MORE. PLEASE. THERE WAS MORE TO IT THAN THAT.' },
            ] },
        ],
        lessons: [
          { html: 'Juno is writing at you. <b>Red letters:</b> press <kbd>Space</kbd> to hop over. <b>White letters</b> are real: walk into them and you have caught one', teach: 'hop', done: (g) => g.letters() >= 1 },
          { html: 'That one is really from her. Catch two more', teach: 'hop', done: (g) => g.letters() >= 3 },
          { html: 'She has run out of paper. Walk up and press <kbd>E</kbd>, and read her own letter back to her', teach: 'use', done: (g) => g.talked() },
          { html: 'She remembers. <kbd>1</kbd> for Tuck: walk up and press <kbd>E</kbd> to cut her loose', teach: 'use', done: (g) => g.boss.freed },
          { html: 'Juno is free!' },
        ] },
    ],
  },
  {
    id: 'street', title: 'The Street', place: 'street', team: ['tuck', 'rivet', 'pim', 'ivy', 'olaf', 'juno'], offstage: ['rivet', 'pim', 'ivy', 'olaf'], stage: 2, tools: { tuck: 'scissors', rivet: 'hammer' }, frees: 'juno',
    opening: { src: 'assets/rooms/l6/film-opening.mp4', lines: [
      { from: 1, to: 6.4, who: 'Juno', text: 'It\'s under the puzzle kiosk. It has been there all along.' },
      { from: 7.2, to: 11, who: 'Rivet', text: 'I\'ve played that kiosk. I thought it liked me.' },
      { from: 11.6, to: 15, who: 'Olaf', text: 'I have filled in a form for this, and lost it on purpose.' },
      { from: 15.4, to: 17.4, who: 'Tuck', text: 'All six of us. Scissors ready.' },
    ] },
    closing: { src: 'assets/rooms/l6/film-ending.mp4', lines: [
      { from: 0.6, to: 5.4, who: 'Tuck', text: 'That\'s the last of it. Not one metre left on the Street.' },
      { from: 6.2, to: 9, who: 'Rivet', text: 'You still owe me a shutter, somebody.' },
      { from: 9.4, to: 11.8, who: 'Pim', text: 'I\'ve counted. No tape. I\'ll count again.' },
      { from: 12.4, to: 16.4, who: 'Juno', text: 'Post for all of us. It says: thank you for your patience. Oh dear.' },
    ] },
    ending: { title: 'The Street is loose!' },
    intro: ['All six of you, at last. You have seen the tape, and now you know where it comes from: under the puzzle kiosk, at the far end of Busy Street.', 'Juno has something new: officials have to stop and read whatever you send them. Keys 1 to 6 bring in anyone you need. Everything you have learned, you will need again.'],
    next: 'Every last metre of tape has come off Busy Street. Somewhere, someone is very politely filling in a form about it. That part comes later.',
    screens: [
      { room: 'shop', title: 'Outside the Workshop', things: [
          { t: 'smash', x: 0.75 }, { t: 'gate', x: 2.05 },
          { t: 'guard', who: 'inspector', from: 1.9, dir: -1 },
        ],
        lessons: [
          { html: 'The inspector, and nowhere to hide. But an official has to read what he is sent. Press <kbd>6</kbd> for Juno, then <kbd>E</kbd>', teach: 'use', done: (g) => g.reading() },
          { html: 'He has to finish it. Quick: <kbd>2</kbd> for Rivet, run to the crates, <kbd>F</kbd>', teach: 'hit', done: (g) => g.smashed() },
          { html: 'And <kbd>1</kbd> for Tuck, to the tape, <kbd>E</kbd>. If the inspector looks up, Juno can always write again', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'Out on the right, and on along the Street', teach: 'run' },
        ] },
      { room: 'glass', title: 'Outside the Glasshouse', things: [
          { t: 'pots', x: -2.25 }, { t: 'tool', tool: 'can', x: -1.55, for: 'ivy' }, { t: 'knot', x: -0.5, by: 'ivy', how: 'pull' },
          { t: 'seed', x: 0.4, y: 1.3 }, { t: 'ledge', from: 0.3, to: 1.6, y: 1.3 }, { t: 'knot', x: 1.2, y: 1.3, by: 'pim', how: 'pull' },
          { t: 'walker', who: 'tapeling', x: 1.3, from: 0.9, to: 1.9, speed: 0.7 },
          { t: 'gate', x: 2.15, lock: 'knots' },
        ],
        lessons: [
          { html: 'Ivy\'s doorstep. <kbd>4</kbd> for Ivy: pick up the can with <kbd>E</kbd>', teach: 'use', done: (g) => g.actor('ivy').tool },
          { html: 'That spool is hers too: stand by it and <kbd>E</kbd>', teach: 'use', done: (g) => g.cutBy('ivy') },
          { html: 'Then water the mound, for a way up', teach: 'use', done: (g) => g.grown() },
          { html: 'The high spool is Pim\'s. <kbd>3</kbd> for Pim: <kbd>↑</kbd> at the vine, then <kbd>E</kbd>', teach: 'hop', done: (g) => g.cutBy('pim') },
          { html: 'All clear above. Below there\'s a tapeling: <kbd>2</kbd> for Rivet, a pot from back there, or <kbd>Space</kbd> over it. Out on the right', teach: 'walk' },
        ] },
      { room: 'house', title: 'Outside Tuck\'s house', things: [
          { t: 'mouse', x: -2.2 }, { t: 'ledge', from: -1.45, to: -0.55, y: 1.2, grab: true }, { t: 'pocket', name: 'key', x: -0.95, y: 1.2, hidden: true, loose: true }, { t: 'pocket', name: 'cheese', x: -0.2, hidden: true, loose: true },
          { t: 'door', id: 'wall', x: 0.75, shut: true },
          { t: 'snarl', x: 1.3, from: 1.05, to: 1.6 }, { t: 'low', x: 1.9 },
          { t: 'gate', x: 2.3, lock: 'key' },
        ],
        lessons: [
          { html: 'Tuck\'s house, taped up from the outside now. That mouse came along, though. <kbd>5</kbd> for Olaf: read the room with <kbd>E</kbd>', teach: 'use', done: (g) => g.revealed() },
          { html: 'A key up on the shelf, and some cheese! Get the cheese to the tape: leave it with <kbd>E</kbd>, or throw it with <kbd>T</kbd>. Then stand back', teach: 'use', done: (g) => g.chewed() >= 1 },
          { html: 'A snarl behind it. <kbd>2</kbd> for Rivet, <kbd>F</kbd>', teach: 'hit', done: (g) => g.snarls() === 0 },
          { html: 'Now the key. Only Tuck pulls up that high: <kbd>1</kbd> for Tuck, <kbd>Space</kbd> at the end of the shelf, <kbd>E</kbd> for the key', teach: 'hop', done: (g) => g.carrying('key') || g.gateOpen() },
          { html: 'Low tape, then the padlock. Hold <kbd>→</kbd> and press <kbd>↓</kbd> to roll under it, then <kbd>E</kbd>', teach: 'hide', done: (g) => g.gateOpen() },
          { html: 'Out on the right. It\'s not far now', teach: 'walk' },
        ] },
      { room: 'kiosk', title: 'The puzzle kiosk', things: [
          { t: 'lever', x: -1.2, stops: 'p', secs: 6 }, { t: 'press', id: 'p', x: 0.0 },
          { t: 'plate', x: 0.95, opens: 'd' }, { t: 'door', id: 'd', x: 1.5 },
          { t: 'gate', x: 2.2, lock: 'stars', level: 5 },
        ],
        lessons: [
          { html: 'A press, right outside the kiosk. Stop it with the lever, <kbd>E</kbd>, and get one figure onto the brass plate', teach: 'use', done: (g) => g.plateDown() },
          { html: 'That holds the tape up, as long as they stay. Switch, and bring somebody else past the press', teach: 'switch', done: (g) => g.hero.x > 1.6 },
          { html: 'The way down is a puzzle, naturally. It\'s the puzzle kiosk. Stand by the knot and press <kbd>E</kbd>', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'Down you go, on the right', teach: 'walk' },
        ] },
      { room: 'binder', place: 'house', time: 'evening', everyone: true, title: 'Under the kiosk', things: [
          { t: 'bigspool', x: 2.05, size: 2.3, puzzle: 'stars', level: 6, high: true },
          { t: 'ledge', from: 1.25, to: 2.6, y: 1.3 },
          { t: 'biglever', x: -1.8, brake: true },
          { t: 'knot', x: -0.75, by: 'rivet', how: 'hit' },
          { t: 'ledge', from: 0.1, to: 1.2, y: 1.3 }, { t: 'vine', x: 0.1, y: 1.3 }, { t: 'knot', x: 0.8, y: 1.3, by: 'pim', how: 'pull' },
          { t: 'knot', x: 0.4, by: 'olaf', how: 'read', hidden: true },
          { t: 'knot', x: 1.3, by: 'juno', how: 'letter' },
          { t: 'guard', who: 'inspector', from: 0.9, dir: 1, left: 0.05, right: 1.6, see: 1.7 },
        ],
        lessons: [
          { html: 'So that is where it all comes from, and this takes all six of you. It brakes only while someone stays at the lever. <kbd>4</kbd> for Ivy: to the lever, <kbd>E</kbd>, and <b>stay there</b>', teach: 'use', done: (g) => g.braked() },
          { html: 'Now the inspector is up. <kbd>6</kbd> for Juno, <kbd>E</kbd>: let him read', teach: 'use', done: (g) => g.reading() },
          { html: 'Everyone has a spool. <kbd>2</kbd> Rivet: the low one, with <kbd>F</kbd>', teach: 'hit', done: (g) => g.cutBy('rivet') },
          { html: '<kbd>3</kbd> Pim: up the vine with <kbd>↑</kbd>, then <kbd>E</kbd> on the high one', teach: 'switch', done: (g) => g.cutBy('pim') },
          { html: '<kbd>5</kbd> Olaf: <kbd>E</kbd> reads the room. There is a clause nobody can see, so walk to it and read it out', teach: 'switch', done: (g) => g.cutBy('olaf') },
          { html: '<kbd>6</kbd> Juno: the last spool wants a letter. Walk to it, <kbd>E</kbd>. If the inspector looks up, write to him first', teach: 'switch', done: (g) => g.cutBy('juno') },
          { html: 'All five! That leaves the end of the tape, right up by the spool, and Tuck can\'t reach it. <kbd>2</kbd> for Rivet: walk up to Tuck and press <kbd>E</kbd> to lift', teach: 'use', done: (g) => g.lifting() || g.actor('tuck').y > 1 || g.boss.freed },
          { html: 'One last throw. Hold <kbd>T</kbd>, put the spot on the shelf by the spool, and let go', teach: 'throw', done: (g) => g.actor('tuck').y > 1 || g.boss.freed },
          { html: 'Now cut it. Walk along the shelf to the spool and press <kbd>E</kbd>', teach: 'use', done: (g) => g.boss.freed },
          { html: '' },
        ] },
    ],
  },
  {
    id: 'workshop-old', hidden: true, title: 'The Quiet Workshop (the first version)', place: 'workshop', team: ['tuck'], frees: 'rivet',
    intro: ['The Red Tape has crept into the Workshop, and Rivet has gone quiet.', 'Everyone it catches turns into a tangled, snarling version of themselves. Tuck goes to find them. Cut them loose and they are your friends again.'],
    next: 'Rivet brings his hammer, and together you go looking for Pim.',
    screens: [
      { room: 'front', title: 'Outside the Workshop', things: [{ t: 'crate', x: -1.3 }, { t: 'tool', tool: 'scissors', x: -0.2, for: 'tuck' }, { t: 'stack', x: 1.0 }, { t: 'gate', x: 2.1 }],
        lessons: [
          { html: 'Hold <kbd>→</kbd> to walk', teach: 'walk', done: (g) => g.hero.x > -1.95 },
          { html: 'A crate! Press <kbd>Space</kbd> as you walk to hop over it', teach: 'hop', done: (g) => g.hero.x > -0.8 },
          { html: 'Scissors! Stand by them and press <kbd>E</kbd> to pick them up', teach: 'use', done: (g) => g.hero.tool },
          { html: 'Practise hiding: walk onto the glowing spot, then press <kbd>↓</kbd>', teach: 'hide', done: (g) => g.hero.hidden },
          { html: 'Nobody can see you there. Press <kbd>↑</kbd> to come out', teach: 'hide', done: (g) => !g.hero.hidden },
          { html: 'Stand next to the Red Tape and press <kbd>E</kbd> to snip it', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'The way is free. Walk out on the right. Hold <kbd>Shift</kbd> to run', teach: 'run' },
        ] },
      { room: 'bench', title: 'The workbench', things: [{ t: 'stack', x: 0.1 }, { t: 'guard', who: 'pim', from: 1.7 }],
        lessons: [
          { html: 'Pim is tangled and on patrol. The red light is what Pim sees. Walk to the glowing spot', teach: 'walk', done: (g) => g.inZone() },
          { html: 'Quick! Press <kbd>↓</kbd> to hide behind the crates', teach: 'hide', done: (g) => g.hero.hidden },
          { html: 'Stay hidden. Wait until Pim has walked past you', done: (g) => g.guard.dir < 0 && g.guard.x < g.hero.x - 0.5 },
          { html: 'Now! Press <kbd>↑</kbd>, then hold <kbd>→</kbd> and <kbd>Shift</kbd> to run out on the right', teach: 'run' },
        ] },
      { room: 'counter', title: 'The counter', things: [{ t: 'falling' }],
        lessons: [{ html: 'The backlog is coming down. A shadow on the floor shows where. Walk between them, <kbd>Shift</kbd> to run', teach: 'run' }] },
      { room: 'stock', title: 'The stockroom', things: [{ t: 'crate', x: -0.7 }, { t: 'gate', x: 2.1, lock: 'stars', level: 1 }],
        lessons: [
          { html: 'Press <kbd>Space</kbd> to hop over the crate', teach: 'hop', done: (g) => g.hero.x > 0 },
          { html: 'This knot is too tight for scissors. Stand by it and press <kbd>E</kbd>', teach: 'use', done: (g) => g.gateOpen() },
          { html: 'The way is free. Walk out on the right', teach: 'walk' },
        ] },
      { room: 'yard', title: 'The yard', things: [{ t: 'hide', from: -0.45, to: 2.2, z: -1.35 }, { t: 'boss', who: 'rivet', puzzle: 'duo', level: 1 }],
        lessons: [
          { html: 'That is Rivet, tangled from head to foot! Get to the glowing spot and press <kbd>↓</kbd> to hide', teach: 'hide', done: (g) => g.hero.hidden },
          { html: 'Stay behind the van until Rivet has run past and gone dizzy', done: (g) => g.boss.mode === 'dizzy' },
          { html: 'Now! Press <kbd>↑</kbd>, run to Rivet and press <kbd>E</kbd> before he wakes', teach: 'use', done: (g) => g.boss.freed },
          { html: 'Rivet is free!' },
        ] },
    ],
  },
];
