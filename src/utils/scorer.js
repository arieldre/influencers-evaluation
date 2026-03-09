/**
 * QS Scorer — category-aware, matches Colab pipeline v3 exactly.
 */

// ── Category keywords ──
const GAMING_KEYWORDS = [
  'call of duty','cod','cs2','valorant','gta','fps','shooter','warzone',
  'gaming','games','game review','rust','dayz','marvel rivals','multi gaming',
  'mobile shooter','guns','weapons','military','war game',
  'battlefield','apex','halo','destiny','fortnite','pubg','rainbow six',
  'escape from tarkov','tarkov','arma','squad','hell let loose',
];

const MOBILE_KEYWORDS = [
  // generic mobile tags
  'mobile game','mobile gaming','ios game','android game','app game',
  'casual game','hyper casual','gacha','idle game','mobile esports',

  // Supercell
  'clash royale','clash of clans','clash','brawl stars','hay day','boom beach',
  'supercell','squad busters',
  '\u0441lash royale','\u0441lash of clans', // Cyrillic С variants

  // Devsisters
  'cookie run','cookie run kingdom','cookie run ovenbreak',

  // miHoYo / HoYoverse
  'genshin impact','genshin','honkai','honkai impact','honkai star rail',
  'zenless zone zero','zzz',

  // MOBA & shooters
  'mobile legends','mobile legend','arena of valor','aov',
  'free fire','garena','pubg mobile','pubg lite','pubg new state',
  'call of duty mobile','cod mobile','codm','apex legends mobile',
  'league of legends wild rift','wild rift','teamfight tactics mobile',

  // battle royale / party
  'among us','stumble guys','fall guys mobile',

  // RPG & gacha
  'summoners war','raid shadow legends','raid:','afk arena','afk journey',
  'tower of fantasy','nikke','blue archive','epic seven','arknights',
  'fate grand order','fgo','azur lane','girls frontline','guardian tales',
  'genshin','star rail','wuthering waves','solo leveling arise',
  'seven deadly sins','7ds','dragon ball legends','db legends',
  'one piece bounty rush','naruto blazing','bleach brave souls',
  'fire emblem heroes','another eden','octopath traveler mobile',
  'final fantasy brave exvius','ffbe','war of the visions','dffoo',
  'tales of luminaria','ni no kuni crossworlds','diablo immortal','diablo mobile',
  'torchlight infinite','path of exile mobile','undecember',

  // strategy & 4X
  'rise of kingdoms','rise of empire','lords mobile','war robots',
  'state of survival','whiteout survival','last shelter','last war survival',
  'age of empires mobile','total battle','evony','top war','king of avalon',
  'guns of glory','march of empires','civilization mobile','art of war',
  'clash of kings','empire and puzzles','call of dragons',
  'dune spice wars mobile','infinite kingdom','viking rise',
  'warpath','puzzles and survival','age of origins','west game',
  'star trek fleet command','galaxy of heroes','swgoh',

  // tower defense & roguelike
  'rush royale','random dice','kingdom rush','bloons td','plants vs zombies',
  'pvz','soul knight','archero','survivor.io','vampire survivors mobile',
  'magic survival','brotato mobile',

  // auto chess / card
  'magic chess','auto chess','tft mobile',
  'hearthstone','legends of runeterra','lor','marvel snap','clash mini',
  'yu gi oh duel links','yu gi oh master duel','gwent mobile',

  // sports & racing
  'ea fc mobile','fifa mobile','madden mobile','nba live mobile','nba 2k mobile',
  'mlb 9 innings','real racing','asphalt 9','asphalt 8','mario kart tour',
  'csr racing','need for speed no limits',
  'top eleven','score hero','dream league soccer','dls',
  'retro bowl','golf clash','tennis clash','badminton clash',

  // sandbox & simulation
  'minecraft','roblox','terraria mobile','stardew valley mobile',
  'the sims mobile','simcity buildit','township','family island',
  'homescapes','gardenscapes','merge mansion','merge dragons',
  'project makeover','design home','adorable home',

  // runner & arcade
  'subway surfers','temple run','crossy road','jetpack joyride',
  'geometry dash','flappy bird','fruit ninja','cut the rope',
  'angry birds','angry birds 2',

  // puzzle
  'candy crush','candy saga','royal match','toon blast','toy blast',
  'puzzle & dragons','pad','match 3','brain out','wordle',
  'monument valley','the room',

  // pokemon
  'pokemon go','pokemon unite','pokemon master','pokemon sleep','pokemon cafe',
  'pokemon tcg pocket','pokemon tcg live',

  // horror & narrative
  'identity v','dead by daylight mobile','life is strange mobile',
  'sky children of the light','sky cotl','journey mobile',

  // monster collection
  'dragon city','monster legends','monster hunter now','palworld mobile',
  'monster strike','puzzle and dragons',

  // misc popular
  'coin master','board kings','dice dreams','pirate kings',
  'clash quest','hay day pop','top drives','car parking multiplayer',
  'standoff 2','critical ops','modern combat','shadowgun',
  'world of tanks blitz','wot blitz','world of warships blitz',
];

const AUTO_DECLINE_CATS = ['roblox', 'minecraft', 'fortnite', 'brawl stars'];

// ── Defaults (overridable via config param) ──
const DEFAULTS = {
  AVG_CPM_INT: 27.13,
  AVG_CPM_DED: 96.67,
  GREEN_E_INT: 0.55,
  YELLOW_E_INT: 0.85,
  GREEN_E_DED: 0.55,
  YELLOW_E_DED: 0.85,
  CATEGORY_AUD_MULT: { gaming: 0.90, non_gaming: 1.10, mobile: 1.30 },
};

// ── Helpers ──

export function detectCategoryProfile(category) {
  const cat = String(category).toLowerCase();
  if (MOBILE_KEYWORDS.some(k => cat.includes(k))) return 'mobile';
  if (GAMING_KEYWORDS.some(k => cat.includes(k))) return 'gaming';
  return 'non_gaming';
}

function parseGeo(geoStr) {
  let us = 0, uk = 0, ca = 0, au = 0;
  if (!geoStr || geoStr === 'nan') return { us, uk, ca, au };
  const g = String(geoStr);
  for (const [code, setter] of [['US', v => us = v], ['UK', v => uk = v], ['CA', v => ca = v], ['AU', v => au = v]]) {
    const m = g.match(new RegExp(`${code}\\s*(\\d+)`));
    if (m) setter(parseInt(m[1]) / 100);
  }
  return { us, uk, ca, au };
}

function viewMultiplier(ratio) {
  if (ratio == null) return { mult: 1.0, label: '' };
  if (ratio >= 1.50) return { mult: 1.50, label: 'a lot higher views' };
  if (ratio >= 1.25) return { mult: 1.25, label: 'a bit higher views' };
  if (ratio <= 0.50) return { mult: 0.50, label: 'a lot lower views' };
  if (ratio <= 0.75) return { mult: 0.80, label: 'a bit lower views' };
  return { mult: 1.00, label: '' };
}

function parseNoteRatio(noteStr, claimedViews) {
  if (!noteStr || noteStr.trim() === '' || noteStr === 'nan') return null;
  const note = noteStr.toLowerCase().trim();

  let m = note.match(/(?:x\s*)?(\d+\.?\d*)\s*x/);
  if (m) return parseFloat(m[1]);

  m = note.match(/^(\d+\.\d+)$/);
  if (m) {
    const v = parseFloat(m[1]);
    if (v >= 0.1 && v <= 5.0) return v;
  }

  m = note.match(/(\d[\d,]*\.?\d*)\s*(k|m|thousand|million)?/);
  if (m) {
    let num = parseFloat(m[1].replace(/,/g, ''));
    const unit = (m[2] || '').toLowerCase();
    if (unit === 'k' || unit === 'thousand') num *= 1000;
    else if (unit === 'm' || unit === 'million') num *= 1_000_000;
    if (claimedViews > 0 && num > 500) {
      return Math.round((num / claimedViews) * 1000) / 1000;
    }
  }

  return null;
}

// ── Main scorer ──

export function scoreCreators(creators, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const {
    AVG_CPM_INT, AVG_CPM_DED,
    GREEN_E_INT, YELLOW_E_INT,
    GREEN_E_DED, YELLOW_E_DED,
    CATEGORY_AUD_MULT,
  } = cfg;

  const results = [];

  for (const c of creators) {
    const category = c.category || '';
    const fmt = (c.format || '').toLowerCase();
    const rawEr = c.er || 0;
    const er = rawEr > 1 ? rawEr / 100 : rawEr; // normalize: 5.0% → 0.05
    const claimedViews = c.claimed_views || 0;
    const price = c.price || 0;
    const zorkaCpm = c.zorka_cpm || 0;
    const notes = c.notes || '';
    const api = c.api || {};
    const actualAvg = api.avg || 0;
    const stability = (api.stability || '').toLowerCase();
    const apiRatio = api.ratio ?? null;
    const apiError = api.error || '';
    const subWarn = api.sub_warn || '';
    const charismaData = api.charisma || null;
    const creativeData = c.creative || null;

    // Face: use JMG's pre-filled flag if available, otherwise use ML detection
    const faceData = c.jmg_face != null
      ? { has_face: c.jmg_face, same_face: c.jmg_face, face_label: c.jmg_face ? 'Yes (JMG)' : 'No' }
      : (api.face || { has_face: false, same_face: false, face_label: '—' });

    const catKey = detectCategoryProfile(category);
    const audMult = CATEGORY_AUD_MULT[catKey] ?? 1.0;

    function makeResult(dec, overrides = {}) {
      return {
        decision: dec,
        name: c.name,
        link: c.link,
        format: fmt,
        category,
        cat_profile: catKey,
        price,
        claimed_views: claimedViews,
        actual_avg: actualAvg,
        zorka_cpm: zorkaCpm,
        real_cpm: 0,
        qs: 0,
        e: 999,
        offer: '',
        discount: '',
        stability,
        cv: api.cv ?? 0,
        view_ratio: null,
        view_label: '',
        view_mult_used: 1.0,
        view_source: 'none',
        auto_comment: '',
        sub_warn: subWarn,
        api_error: apiError,
        face: faceData,
        charisma: charismaData,
        creative: creativeData,
        real_er: api.real_er ?? null,
        comment_rate: api.comment_rate ?? null,
        upload_freq: api.upload_freq ?? null,
        content_alerts: api.content_alerts ?? [],
        er,
        geo: c.geo || '',
        ...overrides,
      };
    }

    // Auto-decline
    if (AUTO_DECLINE_CATS.some(kw => category.toLowerCase().includes(kw))) {
      results.push(makeResult('AUTO-DECLINE', { auto_comment: `auto-decline: ${category}` }));
      continue;
    }

    // Error
    if (apiError && apiError !== '' && apiError !== 'nan') {
      results.push(makeResult('ERROR', { auto_comment: `ERROR: ${apiError}` }));
      continue;
    }

    if (stability === 'no data') {
      results.push(makeResult('ERROR', { auto_comment: 'no recent videos in last 3 months' }));
      continue;
    }

    // Stability multiplier
    let stabMult, stabLabel;
    if (stability === 'stable' || stability === 'somewhat stable') {
      stabMult = 1.0; stabLabel = stability;
    } else if (stability === 'dead channel') {
      stabMult = 0.3; stabLabel = 'dead channel';
    } else if (stability === 'unknown') {
      stabMult = 0.5; stabLabel = 'unknown stability';
    } else {
      stabMult = 0.5; stabLabel = stability || 'unknown';
    }

    // Audience score — use TA% directly (= Male 25-44, already the target demo)
    const { us, uk, ca, au } = parseGeo(c.geo);
    const tier1Rest = uk + ca + au;
    const ta = c.ta || 0;
    let aud = ((us * 2.0) + (tier1Rest * 0.8) + (ta * 1.0) + ((c.m1824 || 0) * 0.2) + ((c.m45 || 0) * 0.2)) * audMult;

    let qs = aud * stabMult;

    // ER
    const erMult = er > 0.05 ? 1.3 : er < 0.03 ? 0.9 : 1.0;
    qs *= erMult;

    // Low US penalty
    const usPenalty = us < 0.15 ? 0.6 : 1.0;
    qs *= usPenalty;

    // View multiplier
    let viewRatio = null, viewLabel = '', viewMult = 1.0, viewSource = 'none';
    if (apiRatio != null && apiRatio > 0) {
      viewRatio = apiRatio;
      const vm = viewMultiplier(viewRatio);
      viewMult = vm.mult; viewLabel = vm.label;
      viewSource = 'API';
    } else {
      const noteRatio = parseNoteRatio(notes, claimedViews);
      if (noteRatio != null) {
        viewRatio = noteRatio;
        const vm = viewMultiplier(viewRatio);
        viewMult = vm.mult; viewLabel = vm.label;
        viewSource = 'notes';
      }
    }

    qs *= viewMult;

    // Face multiplier
    // Same face = confirmed presenter → ×1.3
    // Mixed High = likely presenter (ratio ≥ 40%) → ×1.3  
    // Mixed Low = uncertain → no boost (unless manually overridden to yes)
    // Manual override takes precedence over ML result
    const faceConfirmed =
      faceData.face_override === 'yes' ||
      (faceData.face_override !== 'no' && (
        faceData.same_face === true ||
        faceData.mixed_high === true
      ));
    const faceMult = faceConfirmed ? 1.3 : 1.0;
    qs *= faceMult;

    qs = Math.round(qs * 1000) / 1000;

    // E ratio
    const isDed = fmt.includes('ded');
    const cpmBench = isDed ? AVG_CPM_DED : AVG_CPM_INT;
    const greenLim = isDed ? GREEN_E_DED : GREEN_E_INT;
    const yellowLim = isDed ? YELLOW_E_DED : YELLOW_E_INT;

    const realCpm = (actualAvg > 0 && price > 0)
      ? Math.round(((price / actualAvg) * 1000) * 100) / 100
      : zorkaCpm;

    const e = qs > 0
      ? Math.round((zorkaCpm / (cpmBench * qs)) * 1000) / 1000
      : 999;

    // Decision
    let dec;
    if (stability === 'dead channel') {
      dec = 'RED';
    } else {
      dec = e <= greenLim ? 'GREEN' : (e <= yellowLim ? 'YELLOW' : 'RED');
    }

    // Negotiation
    let offer = '', discount = '';
    if (dec === 'YELLOW' && zorkaCpm > 0) {
      const targetCpm = greenLim * cpmBench * qs;
      const d = Math.max((zorkaCpm - targetCpm) / zorkaCpm, 0);
      offer = Math.floor(price * (1 - d) / 100) * 100;
      discount = `${Math.round(d * 100)}%`;
    }

    // Comment
    const parts = [stabLabel, `[${catKey}]`];
    if (viewLabel) parts.push(viewLabel + (viewSource === 'notes' ? ' (notes)' : ''));
    if (subWarn && subWarn !== 'nan') parts.push('check channel');
    const autoComment = parts.join(', ');

    results.push(makeResult(dec, {
      qs,
      e,
      real_cpm: realCpm,
      offer,
      discount,
      view_ratio: viewRatio,
      view_label: viewLabel,
      view_mult_used: viewMult,
      view_source: viewSource,
      auto_comment: autoComment,
      qs_breakdown: {
        aud: Math.round(aud * 1000) / 1000,
        aud_mult: audMult,
        cat: catKey,
        us_pct: Math.round(us * 100),
        tier1_pct: Math.round(tier1Rest * 100),
        ta_pct: Math.round(ta * 100),
        m1824_pct: Math.round((c.m1824 || 0) * 100),
        m45_pct: Math.round((c.m45 || 0) * 100),
        stab_mult: stabMult,
        stab_label: stabLabel,
        er_mult: erMult,
        er_pct: Math.round(er * 1000) / 10,
        us_penalty: usPenalty,
        view_mult: viewMult,
        face_mult: faceMult,
      },
    }));
  }

  return results;
}

export function summarizeResults(results) {
  const greens = results.filter(r => r.decision === 'GREEN').sort((a, b) => a.e - b.e);
  const yellows = results.filter(r => r.decision === 'YELLOW').sort((a, b) => a.e - b.e);
  const reds = results.filter(r => r.decision === 'RED');
  const errors = results.filter(r => r.decision === 'ERROR');
  const declines = results.filter(r => r.decision === 'AUTO-DECLINE');

  const greenSpend = greens.reduce((s, r) => s + r.price, 0);
  const yellowOffer = yellows.reduce((s, r) => s + (typeof r.offer === 'number' ? r.offer : 0), 0);

  return { greens, yellows, reds, errors, declines, greenSpend, yellowOffer };
}

export { DEFAULTS };
