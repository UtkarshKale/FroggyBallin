import { Storage } from './Storage.js';
import { CFG } from '../config.js';

// Meta progression for the Toad Shop. Currency: Gilded Flies (GF). XP: Croak, which raises your Ribbit Rank;
// every new rank grants one Lily Point (LP) for special perks. Everything persists in localStorage ('meta').
export const UPGRADES = [
  // id, label, per-level text, max level, currency, cost(level) -> price of the next level
  { id: 'maxhp', label: 'MAX HP', per: '+10 max HP', max: 5, cur: 'gf', base: 40 },
  { id: 'stamina', label: 'STAMINA REGEN', per: '+15% tongue stamina regen', max: 4, cur: 'gf', base: 30 },
  { id: 'sword', label: 'SWORD DAMAGE', per: '+8% sword damage', max: 5, cur: 'gf', base: 50 },
  { id: 'combo', label: 'COMBO SPEED', per: '+5% swing speed', max: 4, cur: 'gf', base: 45 },
  { id: 'parry', label: 'PARRY WINDOW', per: '+6% parry window', max: 3, cur: 'gf', base: 70 },
  { id: 'posture', label: 'POSTURE GUARD', per: '-8% posture taken', max: 4, cur: 'gf', base: 50 },
  { id: 'dodge', label: 'DODGE COOLDOWN', per: '-8% dodge cooldown', max: 4, cur: 'gf', base: 40 },
  { id: 'gun', label: 'GUN DAMAGE', per: '+10% gun damage', max: 5, cur: 'gf', base: 45 },
  { id: 'ammo', label: 'AMMO CAPACITY', per: '+2 max ammo', max: 4, cur: 'gf', base: 35 },
  { id: 'ammodrop', label: 'AMMO FINDS', per: '+1 bullet per ammo pickup', max: 3, cur: 'gf', base: 40 },
  { id: 'tongue', label: 'TONGUE RANGE', per: '+10% tongue range', max: 4, cur: 'gf', base: 35 },
  { id: 'heal', label: 'TONGUE HEALING', per: '+20% healing from eating', max: 4, cur: 'gf', base: 40 },
  { id: 'ultgain', label: 'ULT CHARGE', per: '+10% ult meter gain', max: 4, cur: 'gf', base: 60 },
  { id: 'magnet', label: 'PICKUP MAGNET', per: '+25% pickup pull radius', max: 3, cur: 'gf', base: 35 },
  { id: 'ultdur', label: 'ULT DURATION', per: '+0.5 s ultimate', max: 3, cur: 'lp', base: 1 },
  { id: 'slots', label: 'POWER-UP SLOT', per: '+1 power-up hold slot', max: 1, cur: 'lp', base: 3 },
];
export const CONSUMABLES = [
  { id: 'ammopack', label: 'AMMO PACK', per: 'Start the next run with +6 ammo', cost: 30 },
  { id: 'shield', label: 'SHIELD CHARGE', per: 'Start with a Beetle Shell (blocks 1 hit)', cost: 40 },
  { id: 'startpower', label: 'LUCKY JAR', per: 'Start with a random stored power-up', cost: 50 },
  { id: 'secondwind', label: 'SECOND WIND', per: 'Revive once at 40% HP', cost: 120 },
];
export const UNLOCK_BUNDLES = [
  { ach: 'boss', label: 'CHAMPION SET', per: 'Crown, glowing eyes, gold gun', cost: 250 },
  { ach: 'srank', label: 'GOLDEN SET', per: 'Gold skin and gold blade', cost: 300 },
  { ach: 'allbosses', label: 'HALO', per: 'The halo hat', cost: 400 },
  { ach: 'kasa', label: 'SAMURAI HAT', per: 'A big conical straw hat', cost: 150 },
];

const fresh = () => ({ gf: 0, croak: 0, rank: 1, lp: 0, spentLp: 0, ups: {}, cons: {} });

export const Meta = {
  get() { return { ...fresh(), ...(Storage.get('meta', {}) || {}) }; },
  save(m) { Storage.set('meta', m); },
  level(id) { return this.get().ups[id] || 0; },
  price(u, lvl) { return u.cur === 'lp' ? u.base : Math.round(u.base * Math.pow(1.6, lvl)); },
  // Croak needed to reach rank r+1 from rank r
  need(r) { return Math.round(CFG.META.rankBase * Math.pow(r, 1.25)); },
  // Returns list of messages (rank-ups) to show
  earn(gf, croak) {
    const m = this.get();
    m.gf += Math.round(gf); m.croak += Math.round(croak);
    const msgs = [];
    while (m.rank < CFG.META.maxRank && m.croak >= this.need(m.rank)) { m.croak -= this.need(m.rank); m.rank++; m.lp++; msgs.push(`RIBBIT RANK ${m.rank}! +1 Lily Point`); }
    this.save(m);
    return msgs;
  },
  buy(u) {
    const m = this.get(), lvl = m.ups[u.id] || 0;
    if (lvl >= u.max) return 'MAXED';
    const price = this.price(u, lvl);
    if (m[u.cur] < price) return 'CANT';
    m[u.cur] -= price;
    if (u.cur === 'lp') m.spentLp += price;
    m.ups[u.id] = lvl + 1;
    this.save(m);
    return 'OK';
  },
  buyConsumable(c) {
    const m = this.get();
    if (m.gf < c.cost) return 'CANT';
    m.gf -= c.cost; m.cons[c.id] = (m.cons[c.id] || 0) + 1; this.save(m);
    return 'OK';
  },
  takeConsumables() { const m = this.get(); const c = m.cons; m.cons = {}; this.save(m); return c; },
  refundAll() {
    const m = this.get();
    for (const u of UPGRADES) { const lvl = m.ups[u.id] || 0; for (let i = 0; i < lvl; i++) { if (u.cur === 'gf') m.gf += this.price(u, i); else m.lp += this.price(u, i); } }
    m.spentLp = 0; m.ups = {}; this.save(m);
  },
  totalLevels() { const u = this.get().ups; return Object.values(u).reduce((a, b) => a + b, 0); },
};

// Effective stat multipliers for the frog (applied at run start).
export function upgradeStats() {
  const L = (id) => Meta.level(id);
  return {
    maxHp: CFG.PLAYER.hp + 10 * L('maxhp'),
    stamina: 1 + 0.15 * L('stamina'),
    sword: 1 + 0.08 * L('sword'),
    combo: 1 + 0.05 * L('combo'),
    parry: 1 + 0.06 * L('parry'),
    posture: 1 - 0.08 * L('posture'),
    dodge: 1 - 0.08 * L('dodge'),
    gun: 1 + 0.1 * L('gun'),
    maxAmmo: CFG.PLAYER.maxAmmo + 2 * L('ammo'),
    ammoDrop: L('ammodrop'),
    tongue: 1 + 0.1 * L('tongue'),
    heal: 1 + 0.2 * L('heal'),
    ultGain: 1 + 0.1 * L('ultgain'),
    ultDur: 0.5 * L('ultdur'),
    slots: CFG.POWERUP.slots + L('slots'),
    magnet: 1 + 0.25 * L('magnet'),
  };
}
