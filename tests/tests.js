//NOTE(Rennorb): Dirty hack because they don't have the native function lol.
// https://github.com/jsdom/jsdom/issues/3363
globalThis.structuredClone = function(a) { return JSON.parse(JSON.stringify(a)) };
globalThis.fetch = require('whatwg-fetch').fetch; // next dogshit js-clownworld fix

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

beforeAll(async () => {
  await GW2TooltipsV2.APICache.ensureExistence('skills', Object.values(SKILL_IDS));
	await GW2TooltipsV2.APICache.ensureExistence('traits', Object.values(TRAIT_IDS));
}, 30 * 60 * 1000);

test('traited overrides', async () => {
	const context = {
		character: {
			traits: new Set([TRAIT_IDS.LingeringCurse]),
		}
	};
	
	const foc = GW2TooltipsV2.APICache.storage.skills.get(SKILL_IDS.FeastOfCorruption);
	const override = GW2TooltipsV2.findTraitedOverride(foc, context);
	expect(override).toMatchObject({ id: SKILL_IDS.DevouringDarkness });
});


test.skip('chained modifier skip', async () => {
	const gs = GW2TooltipsV2.APICache.storage.skills.get(SKILL_IDS.GriffonStrike);

	const resolved1 = GW2TooltipsV2.resolveTraitsAndOverrides(gs, GW2TooltipsV2.DEFAULT_CONTEXT);
	expect(resolved1.blocks[0].facts).toEqual(expect.arrayContaining([
		expect.objectContaining({ buff: 726 })
	]));

	const context = {
		character: {
			traits: new Set([TRAIT_IDS.SongofArboreum]),
		}
	};
	const resolved2 = GW2TooltipsV2.resolveTraitsAndOverrides(gs, context);
	expect(resolved2.blocks[0].facts).toEqual(expect.arrayContaining([
		expect.objectContaining({ buff: 726 }) // its the same now, they reworked the trait
	]));
});


// all these will automatically get loaded into the api on startup
const SKILL_IDS = {
	FeastOfCorruption: 10709,
	DevouringDarkness: 51647,
	GriffonStrike    : 11929,
};
const TRAIT_IDS = {
	LingeringCurse:  801,
	SongofArboreum: 2255,
};