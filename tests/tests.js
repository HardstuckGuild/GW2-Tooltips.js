//NOTE(Rennorb): Dirty hack because they don't have the native function lol.
// https://github.com/jsdom/jsdom/issues/3363
globalThis.structuredClone = function(a) { return JSON.parse(JSON.stringify(a)) };
globalThis.fetch = require('whatwg-fetch').fetch; // next dogshit js-clownworld fix


expect.extend({
  toBeWithMsg(actual, expected, msg) {
    if (actual === expected) {
      return {
        message: () => `Expected: ${expected} not to be\nReceived: ${actual}\n${msg}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected: ${expected}\nReceived: ${actual}\n${msg}`,
        pass: false
      };
    }
  }
});



GW2TooltipsConfig = {
	autoInitialize                  : false,
	autoCollectRuneCounts           : false,
	autoCollectStatSources          : false,
	autoCollectSelectedTraits       : false,
	autoInferEquipmentUpgrades      : false,
	autoRecomputeCharacterAttributes: false,
	autoInferWeaponSetAssociation   : false,
};
var GW2TooltipsV2 = require('./tooltips.min.js');
const DEFAULT_CONTEXT = GW2TooltipsV2.DEFAULT_CONTEXT;

beforeAll(async () => {
	await Promise.all([
		GW2TooltipsV2.APICache.ensureExistence('skills', Object.values(SKILL_IDS)),
		GW2TooltipsV2.APICache.ensureExistence('traits', Object.values(TRAIT_IDS)),
		GW2TooltipsV2.APICache.ensureExistence('items', Object.values(ITEM_IDS)),
	]);
}, 30 * 60 * 1000);


test('correct attribute modifier evaluation order', () => {
	const context = GW2TooltipsV2.createCompleteContext({});

	context.character.stats.sources.HealingPower = [
		{ count: 1, source: "some armor", modifier: { target: "HealingPower", base_amount: 100, formula: "NoScaling", formula_param1: 0, formula_param2: 0, flags: [] } },
	];	
	context.character.stats.sources.Concentration = [
		{ count: 1, source: "some armor", modifier: { target: "Concentration", base_amount: 30, formula: "NoScaling", formula_param1: 0, formula_param2: 0, flags: [] } },
		{ count: 1, source: "some oil", modifier: { target: "Concentration", base_amount: 15, formula: "NoScaling", formula_param1: 0, formula_param2: 0, flags: ["FormatPercent"], source_attribute: "HealingPower" } },
	];

	GW2TooltipsV2.hoistGeneralSources(context.character);
	GW2TooltipsV2.recomputeAttributesFromMods(context, 0);

	const withWeapons = context.character.statsWithWeapons[0];
	expect(withWeapons.values.Concentration).toBeWithMsg(45, withWeapons.htmlParts.Concentration.map(p => p.textContent).join("\n"));
	expect(withWeapons.values.BoonDuration).toBeWithMsg(0.03, withWeapons.htmlParts.BoonDuration.map(p => p.textContent).join("\n")); // = Con / 15
});


test('traited overrides', () => {
	const context = GW2TooltipsV2.createCompleteContext({
		character: {
			traits: new Set([TRAIT_IDS.LingeringCurse]),
		}
	});
	
	const foc = GW2TooltipsV2.APICache.storage.skills.get(SKILL_IDS.FeastOfCorruption);
	const override = GW2TooltipsV2.findTraitedOverride(foc, context);
	expect(override).toMatchObject({ id: SKILL_IDS.DevouringDarkness });
});


test.skip('chained modifier skip', () => {
	const gs = GW2TooltipsV2.APICache.storage.skills.get(SKILL_IDS.GriffonStrike);

	const resolved1 = GW2TooltipsV2.resolveTraitsAndOverrides(gs, DEFAULT_CONTEXT);
	expect(resolved1.blocks[0].facts).toEqual(expect.arrayContaining([
		expect.objectContaining({ buff: 726 })
	]));

	const context = GW2TooltipsV2.createCompleteContext({
		character: {
			traits: new Set([TRAIT_IDS.SongOfArboreum]),
		}
	});
	const resolved2 = GW2TooltipsV2.resolveTraitsAndOverrides(gs, context);
	expect(resolved2.blocks[0].facts).toEqual(expect.arrayContaining([
		expect.objectContaining({ buff: 726 }) // its the same now, they reworked the trait
	]));
});

test("modifier clamping", () => {
	const fact = {
		type: "Buff",
		buff: SKILL_IDS.UrnOfSaintViktor,
		duration: 0, // this is the interesting part here, even it ifs 0 that means it should be "ignored" / permanent (don't multiply down to 0)
		apply_count: 1,
		icon: 156661,
		oder: 1,
	};
	const { wrapper } = GW2TooltipsV2.generateFact(fact, 1, DEFAULT_CONTEXT, 0);
	expect(wrapper.textContent).toContain("% Damage");
	expect(wrapper.textContent).not.toContain("0% Damage");
});

test("rounding down without format fraction", () => {
	const fact = {
		type: "Buff",
		buff: SKILL_IDS.Torment,
		duration: 3000,
		apply_count: 1,
		icon: 156661,
		oder: 1,
	};
	const { wrapper } = GW2TooltipsV2.generateFact(fact, 1, DEFAULT_CONTEXT, 0);
	expect(wrapper.textContent).toContain("95 Damage");
});

test("HealthAdjustHealing fact type + multi hit count", () => {
	const fact = {
		type: "AdjustByAttributeAndLevel",
		buff: SKILL_IDS.Torment,
		value: 1500,
		hit_count: 3,
		icon: 156662,
		level_exponent: 0,
		level_multiplier: 0,
		oder: 1,
	};
	const { wrapper } = GW2TooltipsV2.generateFact(fact, 1, DEFAULT_CONTEXT, 0);
	expect(wrapper.textContent).toContain("4500");
});

test('no defiance break on "removes ..." 1', () => {
	const skill = GW2TooltipsV2.APICache.storage.skills.get(SKILL_IDS.ExplosiveDisengagement);
	const info = GW2TooltipsV2.resolveTraitsAndOverrides(skill, DEFAULT_CONTEXT);
	const facts = info.blocks[0].facts.map(f => GW2TooltipsV2.generateFact(f, 1, DEFAULT_CONTEXT, 0));
	expect(facts).not.toEqual(expect.arrayContaining([
		expect.not.objectContaining({ defiance_break: 0 })
	]));
});

test('no defiance break on "removes ..." 2', () => {
	const skill = GW2TooltipsV2.APICache.storage.skills.get(SKILL_IDS.VineSurge);
	const info = GW2TooltipsV2.resolveTraitsAndOverrides(skill, DEFAULT_CONTEXT);

	let entangle_with_db = false, entangle_without_db = false;
	for(const fact of info.blocks[0].facts) {
		if(fact.buff === SKILL_IDS.Entangle) {
			if(fact.defiance_break) entangle_with_db = true;
			else entangle_without_db = true;
		}
	}
	expect([entangle_with_db, entangle_without_db]).toEqual([true, true]);
});

test('PlayerLevel scaling', () => {
	const item = GW2TooltipsV2.APICache.storage.items.get(ITEM_IDS.OgreBanner);
	const tooltip = GW2TooltipsV2.generateItemTooltip(item, DEFAULT_CONTEXT, 0);
	expect(tooltip.textContent).toContain("Weapon Strength: 490 - 520");
});


test("clamp hard CC < 1s", () => {
	{
		const fact = {
			type: "Time",
			text: "Daze",
			duration: 750,
			defiance_break: 100,
			icon: 433474,
			order: 1,
		};
		const { defiance_break } = GW2TooltipsV2.generateFact(fact, 1, DEFAULT_CONTEXT, 0);
		expect(defiance_break).toBe(100);
	}

	{
		const fact = {
			type: "Time",
			text: "Daze",
			duration: 2000,
			defiance_break: 100,
			icon: 433474,
			order: 1,
		};	
		const { defiance_break } = GW2TooltipsV2.generateFact(fact, 1, DEFAULT_CONTEXT, 0);
		expect(defiance_break).toBe(200);
	}
});

test('Multiple fact skip layers', () => {
	const context = GW2TooltipsV2.createCompleteContext({
		character: {
			traits: new Set([TRAIT_IDS.LingeringCurse]),
		}
	});
	const skill = GW2TooltipsV2.APICache.storage.skills.get(SKILL_IDS.GraspingDead);
	const info = GW2TooltipsV2.resolveTraitsAndOverrides(skill, context);
	let n_bleed = 0, n_cripple = 0;
	for(const fact of info.blocks[0].facts) {
		if(fact.buff === SKILL_IDS.Bleed) n_bleed++;
		if(fact.buff === SKILL_IDS.Cripple) n_cripple++;
	}
	expect(n_bleed).toBe(1);
	expect(n_cripple).toBe(1);
});

test('True Strike - no duplicate chain', () => {
	const skill = GW2TooltipsV2.APICache.storage.skills.get(SKILL_IDS.TrueStrike);
	const info = GW2TooltipsV2.resolveTraitsAndOverrides(skill, DEFAULT_CONTEXT);
	const params = { type: 'skill' };
	const [innerTooltips, _] = GW2TooltipsV2.generateToolTipList(info, params, DEFAULT_CONTEXT);
	const counts = {};
	for(const title of innerTooltips.map(el => el.querySelector('.title-text').textContent))
		counts[title] = (counts[title] || 0) + 1;
	for(const [title, count] of Object.entries(counts))
		if(count != 1)
			throw new Error(`Found multiple '${title}'`);
});

test('Path of Gluttony - no duplicate chain', () => {
	const skill = GW2TooltipsV2.APICache.storage.skills.get(SKILL_IDS.PathOfGluttony);
	const info = GW2TooltipsV2.resolveTraitsAndOverrides(skill, DEFAULT_CONTEXT);
	const params = { type: 'skill' };
	const [innerTooltips, _] = GW2TooltipsV2.generateToolTipList(info, params, DEFAULT_CONTEXT);
	const counts = {};
	for(const title of innerTooltips.map(el => el.querySelector('.title-text').textContent))
		counts[title] = (counts[title] || 0) + 1;
	for(const [title, count] of Object.entries(counts))
		if(count != 1)
			throw new Error(`Found multiple '${title}'`);
});

test('Thesis on Speed - Buff with description', () => {
	const item = GW2TooltipsV2.APICache.storage.items.get(ITEM_IDS.ThesisOnBasicSpeed);
	const params = { type: 'item', element: { getAttribute: (skin) => undefined, } };
	const [[tooltip], _] = GW2TooltipsV2.generateToolTipList(item, params, DEFAULT_CONTEXT);
	expect(tooltip.textContent).toContain('):'); // Enhancement (1h): <mods here>
});


// all these will automatically get loaded into the api on startup
const SKILL_IDS = {
	FeastOfCorruption: 10709,
	DevouringDarkness: 51647,
	GriffonStrike    : 11929,
	UrnOfSaintViktor : 62864,
	ExplosiveDisengagement: 28830,
	VineSurge        : 31700,
	GraspingDead     : 10532,
	TrueStrike       :  9109,
	PathOfGluttony   : 71799,

	Torment          : 21632,
	Entangle         :   727,
	Bleed            :   736,
	Cripple          :   721,
};
const TRAIT_IDS = {
	LingeringCurse:   801,
	SongOfArboreum:  2255,
	LingeringCurse:   801,
};
const ITEM_IDS = {
	OgreBanner        : 16075,
	ThesisOnBasicSpeed: 74634,
};