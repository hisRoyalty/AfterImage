// Booth's lines. Keys are event names; each list is per chapter (index 1-5), index 0 is shared.
// Rules from DESIGN s5: says what happened, never what to do; 14 words max; never repeats in a save.
type Pool = Record<string, string[][]>;

export const LINES: Pool = {
  drone1: [[], ['That is bleed on track one. Fine. Use it.']],
  loop1: [[], [], ['Now you are in your own headphones. Try not to argue.']],
  keep1: [[], [], ['You want to keep that one? ...Rolling.'], ['Kept a burned take. Bold.'], ['Another one for the pile.']],
  bounce1: [[], [], [], ['Skin is tight. Nice tone.']],
  erase3: [[], ['Three erases. The head is getting warm.'], ['Erase, erase, erase. I know the feeling.'], ['Rewinding again. Tape stretches, you know.'], ['Back and back. You and me both.'], ['Fine. Take it out.']],
  wipe: [[], ['Wiped. Clean reel. That is how I like it.'], ['Blank tape. Smells like a fresh start.'], ['All gone. Some of that was good.'], ['I used to wipe the reel every night. Start clean, I said.'], ['You can wipe it. I would not.']],
  idle: [[], ['Clock is running, by the way.'], ['Still rolling. Nobody is playing.'], ['Quiet take. Very avant-garde.'], ['Tape is still rolling. Take your time. I have sat here longer.'], ['Silence counts too.']],
  bounce3: [[], [], [], ['Was that on purpose? Again. For level.', 'Three in a row. Someone call the drummer.'], ['Bounce, bounce, bounce. Very danceable.'], ['There it is.']],
  ff: [[], [], ['Spooling ahead. Careful, it squeals.', 'Fast forward. The tape hates that.'], ['Wind it on.'], ['Skipping the boring bit.'], ['Let it run.']],
  'die.static': [[], ['You clipped. I am scrubbing that take.', 'Red line. Into the bin.', 'Clipped again. Bin.'], ['Distortion. Scrubbed.', 'Clipped. We have tape to spare.'], ['Clipped mid-phrase.', 'Red. Gone.'], ['That one went in the red.', 'Clipped. I am not scrubbing it.'], ['Clipped. Keep going.']],
  'die.beam': [[], [], [], [], ['Feedback. Right in the ear.', 'Caught the signal.', 'Hot line. You touched it.'], ['Signal got you.']],
  'die.pit': [[], ['Dropped out. Gone.', 'Fell off the mix.'], ['Off the bottom of the meter.', 'Dropout.'], ['Floor fell away.', 'Missed the skin.'], ['Down and out.', 'No floor there. Noted.'], ['Down you go.']],
  'die.tape': [[], ['Tape ran out. Twenty seconds is all you get.'], ['Ran off the end of the reel.', 'Tape out.'], ['End of reel.'], ['Spooled out again.', 'The reel ran dry.'], ['End of the reel.']],
  'die.same': [[], ['Same tile, three takes running. I have marked the floor.'], ['Same spot again. I am writing it on the track sheet.'], ['Same tile. Like a stuck groove.'], ['There again. You and that tile.'], ['That spot again.']],
  'die.quick': [[], ['Two takes in two seconds. Breathe.'], ['That was quick. Twice.'], ['Short takes. Very punk.'], ['Fast. Then faster.'], ['Quick.']],
  'die.long': [[], ['Fifteen seconds of tape, then that.'], ['Long take. Shame about the end.'], ['So close to a full take.'], ['All that, and then the floor.'], ['Long one. Worth it anyway.']],
  'die.doorstep': [[], ['On the doorstep. Painful.'], ['You could see the Out from there.'], ['Right at the door. Ouch.'], ['One step short. I will keep that one.'], ['Nearly.']],
  'die.first': [[], ['Did not even count in.'], ['Out before the first bar.'], ['That was the count-in.'], ['Barely started.'], ['Again.']],
  takes10: [[], ['Take ten. Nobody gets it in one.'], ['Take ten. We are layering now, apparently.'], ['Ten takes. Keep the groove.'], ['Ten. I stopped scrubbing at five.'], []],
  takes25: [[], ['Take twenty-five. I am ordering more tape.'], ['Twenty-five. The reel is getting heavy.'], ['Twenty-five takes. Lovely.'], ['Twenty-five. Every one of them is still here.'], []],
  takes50: [[], ['Fifty takes. I respect the stubbornness.'], ['Fifty. That is a box set.'], ['Fifty. Keep it rolling.'], ['Fifty takes. I never had the nerve.'], []],
  'clear.par': [[], ['Clean take. Do not let it go to your head.', 'Clean. I will allow it.'], ['Clean. We did that together, I suppose.', 'Nothing spare on that one.'], ['Nothing wasted. I hate that I noticed.', 'Tight. Next.'], ['Clean take. The scrap helped, though.', 'Clean. You leaned on the outtakes.'], ['Keep it.']],
  'clear.over': [[], ['Too many tracks. It still counts. Barely.', 'Cluttered, but it plays.'], ['Bit busy. It works.', 'Lot of layers on that.'], ['Thick mix. Still grooves.'], ['More takes on that than you needed. Good.'], ['Keep it.']],
  'clear.clean': [[], ['Not one dropout. Suspicious.'], ['No deaths. Who are you?'], ['Flawless. Do it again, I was not ready.'], ['No scrap this time. I almost miss it.'], ['Keep it.']],
  'clear.long': [[], ['Fifteen takes for that. We got there.'], ['Long session. Worth it.'], ['That one took a while.'], ['Every one of those takes is on the reel.'], ['Keep it.']],
  enter: [['Booth here. Talkback is on.'], ['Booth here. One clean take, please.'], ['Chapter two. More channels. Same rules.'], ['Bring some rhythm this time.'], ['Watch the meters. They bite.'], []],
  final: [['I told you I scrubbed them. I never touched the erase head. Listen.']],
};

export const BOOTH_LINES_MAX_WORDS = 14;
