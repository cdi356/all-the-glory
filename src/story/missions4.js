// Story missions set in the new parts of the world.
import { G } from '../core/g.js';
import { V3, rand, pick } from '../core/util.js';
import { P } from './mission.js';
import { POI } from '../world/citydata.js';
import { LOOKS } from '../ent/human.js';

const A3 = 'ACT III: COMPOUND INTEREST';
// Act III: the floor that is not in the elevator. First real proof that Larry is not a man.
export const M16 = { id: 'm16', act: A3, name: 'Floor 66', desc: 'Goldman Tower has 99 floors. The elevator knows 98.', who: 'jeremiah', crew: ['jakob', 'donald'], swap: true, cash: 9000, start: { poi: 'goldtower' }, stages: [
  { at: () => P('goldtower', 0, 8), fn: async m => {
    await m.scene([['Crumb', 'Goldman Tower. Ninety-nine floors. The elevator lists ninety-eight. Floor 66 draws more power than the casino.'], ['Jakob', 'What is on 66?'], ['Crumb', 'Something that needs to be kept very cold and very quiet.'], ['Donald', 'Like my ex-wife.'], ['Jeremiah', 'We walk in like we work here. Nobody questions confidence.'], ['Donald', 'I am wearing a shirt with pineapples on it.'], ['Jeremiah', 'Then be VERY confident.']]);
    await m.door(POI.goldtower.door, 'Walk in like you own it', 'gold0', { obj: 'Get into Goldman Tower', mark: 'Goldman Tower', mark2: 'E' });
  } },
  { int: 'gold0', fn: async m => {
    const it = G.interior; m.lockDoors = true; for (const p of (it.marks.n || [])) m.npc(LOOKS.guard, p, { name: 'Concierge', faction: 'ped', yaw: 0 }).pose = 'cross';
    await m.say('Concierge', 'Welcome to Goldman Tower. Do you have an appointment?'); await m.say('Donald', 'We have a disappointment. It is with you.');
    await m.interact(it.mark('E'), 'Ride to Floor 52', { obj: 'Take the elevator to the trading floor', mark: 'Elevator', r: 2.2 });
    await m.enterInt('gold1', { mark: 'E', yaw: 0 });
  } },
  { int: 'gold1', fn: async m => {
    const it = G.interior; m.lockDoors = true; const traders = []; for (const p of (it.marks.e || []).slice(0, 4)) { const a = m.npc(LOOKS.exec || LOOKS.guard, p, { name: 'Trader', faction: 'ped', yaw: rand(0, 6) }); a.pose = pick(['phone', 'type', 'cross']); traders.push(a); }
    await m.say('Jeremiah', 'Elevator controller is on that terminal. Keep them busy.');
    await m.breach(it.mark('T'), 'Rewrite the elevator firmware', 'ELEVATOR OVERRIDE', 3, { obj: 'Unlock floor 66', mark: 'Terminal' });
    G.alarm = true; for (const a of traders) a.pose = 'cower'; await m.say('Crumb', 'Floor 66 is now a floor. Security is now awake. I did one of those on purpose.');
    const L = m.group(['guard', 'guardh', 'guard'], it.mark('2'), 6, 3, { sight: 30 }); await m.kill(L, { obj: 'Deal with Goldman security' });
    await m.interact(it.mark('E'), 'Ride to Floor 66', { obj: 'Take the elevator to floor 66', mark: 'Elevator', r: 2.2 });
    await m.enterInt('gold66', { mark: 'E', yaw: 0 });
  } },
  { int: 'gold66', fn: async m => {
    const it = G.interior; m.lockDoors = true; G.alarm = false;
    await m.scene([['Jakob', 'It is cold. Why is it so cold.'], ['Jeremiah', 'Those tanks. Look inside the tanks.'], ['Donald', '...That is Larry.'], ['Jakob', 'That is ALSO Larry.'], ['Jeremiah', 'Model numbers. L.G. seven, eight, nine. He is not a man. He is a fleet.'], ['Donald', 'I KNEW nobody tans like that naturally.']]);
    const L = m.fill(it, ['guardh', 'guard', 'guardh'], { sight: 24 }); await m.kill(L, { obj: 'Clear floor 66', leave: 1 });
    await m.interact(it.mark('T'), 'Copy the maintenance logs', { obj: 'Steal the proof', mark: 'Logs', r: 2.4 });
    m.say('Crumb', 'Copying. Larry\'s service history is very long. And very weird. Hold the room.');
    await m.survive(35, 'Download', w => m.group(w % 2 ? ['guardh', 'guard'] : 'guard', it.mark('1'), 3 + Math.min(3, w), 3, { sight: 40 }), 9);
    await m.scene([['Crumb', 'Done. Firmware notes. Replacement schedules. A memo titled "Re: blinking less creepily".'], ['Jeremiah', 'Everything we need to tell the city the truth.'], ['Donald', 'Can we take one of the Larrys? For the laundromat?'], ['Jakob', 'NO.']]);
    await m.exitInt(V3(POI.goldtower.door.x, 0, POI.goldtower.door.z + 2));
    G.police.min(3); await m.lose({ obj: 'Get away from Goldman Tower' });
    await m.goto(P('hideout', 0, 4), { obj: 'Back to the laundromat', label: 'Hideout', r: 10 });
  } }],
  reward: S => { S.flags.floor66 = 1; }, unlock: ['Goldman Tower: Floor 66 is on the elevator now (if you dare)'] };
