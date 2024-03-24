export function transformEffectToSkillObject(element : HTMLElement, error_store : Set<string>) : number {
	const name = String(element.getAttribute('objId'));
	let id = LUT_EFFECT_IDS[name]

	//TODO(Rennorb) @cleanup: This is basically just about the descriptions. We could add those in the api, I don't see why not.
	if(!id) {
		//NOTE(Rennorb): these don't actually exist and need to be synthesized.
		const hardCoded = LUT_HARDCODED_EFFECTS[name];

		if(hardCoded) {
			id = hardCoded.id;
			APICache.storage.skills.set(id, hardCoded);
		}
	}

	if(id) {
		element.setAttribute('type', 'skill');
		element.setAttribute('objId', String(id));
		return id;
	}
	else {
		element.innerText = name;
		element.title = `Failed to translate effect '${name}'.`;
		element.style.cursor = "help";
		element.classList.add('error');
		error_store.add(name);
		return 0;
	}
}

const LUT_EFFECT_IDS : Record<string, number | undefined> = {
	//// auras
	chaos_aura              : 10332,
	dark_aura               : 39978,
	fire_aura               : 5677,
	frost_aura              : 5579,
	light_aura              : 25518,
	magnetic_aura           : 5684,
	shocking_aura           : 5577,
	//// boons
	aegis                   : 743,
	alacrity                : 30328,
	fury                    : 725,
	might                   : 740,
	protection              : 717,
	quickness               : 1187,
	regeneration            : 718,
	resistance              : 26980,
	resolution              : 873,
	stability               : 1122,
	swiftness               : 719,
	vigor                   : 726,
	//// conditions
	bleeding                : 736,
	blinded                 : 720,
	burning                 : 737,
	chill                   : 722,
	chilled                 : 722,
	confusion               : 861,
	crippled                : 721,
	fear                    : 896,
	immobilize              : 727,
	poison                  : 723,
	slow                    : 26766,
	taunt                   : 27705,
	torment                 : 19426,
	vulnerability           : 738,
	weakness                : 742,
	//// control effects
	daze                    : 833,
	// float                -> see hardCoded below
	// knockback            -> see hardCoded below
	// knockdown            -> see hardCoded below
	// launch               -> see hardCoded below
	// pull                 -> see hardCoded below
	// sink                 -> see hardCoded below
	stun                    : 872,
	//// misc
	agony                   : 15773,
	// barrier              -> see hardCoded below
	invulnerability         : 56227,
	revealed                : 890,
	stealth                 : 58026, //maybe wrong
	// stunbreak            -> see hardCoded below
	superspeed              : 5974,
	unblockable             : 18843,
	//// npcs
	blight                  : 62653,
	bloodstone_blessed      : 34917,
	blue_pylon_power        : 31413, // (vale guardian)
	champion_of_the_legions : 20845, //maybe wrong (rock fest thing?)
	compromised             : 35096,
	crowd_favor             : 36173, //maybe wrong (marionette)
	curse_of_frailty        : 53723, //maybe wrong (pirate fractal)
	debilitated             : 67972, // ko
	debilitating_void       : 64967, //ankah
	defense_up              : 28482,
	derangement             : 34965,
	elemental_empowerment   : 62733,
	empowering_auras        : 62939,
	equalization_matrix     : 67047, // (ko)
	expose_weakness         : 26660,
	exposed                 : 28778, //maybe wrong
	extreme_vulnerability   : 65662,
	fixated                 : 47434, //maybe wrong
	growing_rage_ashym      : 3362, //maybe wrong (urban battleground)
	ignite                  : 16259,
	intervention            : 35061,
	necrosis                : 47414,
	not_sticking_together   : 54378,
	nova                    : 39193, //there is also the upgraded version with aegis
	ooze_pheromone          : 21538,
	photon_saturation       : 67872, // ah cm
	positive_flow           : 66665,
	power_of_the_void       : 65601, // xjj
	reinforced_armor        : 9283,
	relentless_fire         : 62805,
	retaliation_ashym       : 24646, //maybe wrong
	sentinel_retribution    : 16350,
	shattering_ice          : 62909,
	shell_shocked           : 33361,
	spectral_darkness       : 31498,
	sticking_together       : 54604,
	synchronized_vitality   : 63840, //maybe wrong(ko)
	unnatural_signet        : 38224,
	use_soul_binder         : 55630,
	void_empowerment        : 68083,
	xeras_embrace           : 34979,
};

const LUT_HARDCODED_EFFECTS : Record<string, API.Skill | undefined> = {
	barrier: {
		id: Number.MAX_SAFE_INTEGER - 1,
		name: 'Barrier',
		icon: ICONS.Barrier,
		description: "Creates a health barrier that takes damage prior to the health bar. Barrier disappears 5s after being applied. Applying a barrier while one is already active will add to it, but the previously-existing barrier will still disappear 5s after it was originally applied. The amount of barrier generated is based on the source's healing power, and is capped at 50% of the recipient's maximum health.",
		description_brief: "Creates a health barrier that takes damage prior to the health bar.",
		categories: [], palettes: [], flags: [],
	},
	stunbreak: {
		id: Number.MAX_SAFE_INTEGER - 2,
		name: 'Stun Break',
		description: 'Cancel control effects such as stuns.',
		icon: ICONS.StunBreak,
		categories: [], palettes: [], flags: [],
	},
	knockdown: {
		id: Number.MAX_SAFE_INTEGER - 3,
		name: 'Knockdown',
		description: 'Knocks the target on ground, preventing movement and actions for a short duration.',
		icon: ICONS.Knockdown,
		categories: [], palettes: [], flags: [],
	},
	pull: {
		id: Number.MAX_SAFE_INTEGER - 4,
		name: 'Pull',
		description: 'Pulls the caster to the target or the target to a specific location and disables them for a short duration.',
		icon: ICONS.Pull,
		categories: [], palettes: [], flags: [],
	},
	knockback: {
		id: Number.MAX_SAFE_INTEGER - 5,
		name: 'Knockback',
		description: 'Knocks back the target away and on the ground, preventing movement and actions for a short duration.',
		icon: ICONS.Knockback,
		categories: [], palettes: [], flags: [],
	},
	launch: {
		id: Number.MAX_SAFE_INTEGER - 6,
		name: 'Launch',
		description: 'Throws the target in the air over a short distance, preventing movement and actions for a short duration. Can move Downed targets.',
		icon: ICONS.Launch,
		categories: [], palettes: [], flags: [],
	},
	float: {
		id: Number.MAX_SAFE_INTEGER - 7,
		name: 'Float',
		description: 'Causes the target to float in the air, preventing movement and actions for a short duration. Causes underwater targets to move up.',
		icon: ICONS.Float,
		categories: [], palettes: [], flags: [],
	},
	sink: {
		id: Number.MAX_SAFE_INTEGER - 8,
		name: 'Sink',
		description: 'Causes the underwater target to move downwards.',
		icon: ICONS.Sink,
		categories: [], palettes: [], flags: [],
	},
};


import APICache from "./APICache";
import { ICONS } from "./Constants";
