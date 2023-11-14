export function inflateGenericIcon(gw2Object : HTMLElement, data : { name : string, icon? : Parameters<typeof newImg>[0] }, force = false) {
	if(!force && gw2Object.childElementCount > 0) return; // most scenarios will have the server prefill objects as best as it can.

	const wikiLink = newElm('a', newImg(data.icon, undefined, data.name));
	wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + resolveInflections(GW2Text2HTML(data.name), 1, { sex: "Male" });
	wikiLink.target = '_blank';
	if(gw2Object.classList.contains('gw2objectembed') && !gw2Object.classList.contains('icononly')) {
		//TODO(Rennorb) @correctness: this should probably take into account the plural form
		const cleanName = GW2Text2HTML(data.name).replaceAll(/\[.*?\]/g, ''); //remove plural forms ([s] and similar)
		wikiLink.append(cleanName);
	}
	gw2Object[force ? 'replaceChildren' : 'append'](wikiLink);
}

export function inflateSkill(gw2Object : HTMLElement, skill : API.Skill) {
	const contextSet = +String(gw2Object.getAttribute('contextSet')) || 0;
	const context = specializeContextFromInlineAttribs(contexts[contextSet], gw2Object);

	let force = false;
	//NOTE(Rennorb): doing this here might not be the best idea, as this wil prevent us form hot swapping traits.
	// The issue is that this is the place where the icon gets selected and inflated, so its somewhat required to change the skill before this point.
	// Maybe this is still the best place to do this and for cases were we need hot swapping (e.g. build editor) we just have to manually re-process skills after swapping traits.
	// Maybe we should move the original id to another attribute for savekeeping so we can revert it later on if we need to?
	if(gw2Object.classList.contains('auto-transform')) {
		const replacementSkill = findTraitedOverride(skill, context);
		if(replacementSkill) {
			gw2Object.setAttribute('objid', String(replacementSkill.id));
			skill = replacementSkill;
			force = true;
		}
	}
	
	inflateGenericIcon(gw2Object, skill, force);
}

export function inflateItem(gw2Object : HTMLElement, item : API.Item) {
	if(gw2Object.childElementCount > 0) return; // most scenarios will have the server prefill objects as best as it can.

	const stackSize = +String(gw2Object.getAttribute('count')) || 1;
	const context = contexts[+String(gw2Object.getAttribute('contextSet')) || 0];

	const wikiLink = newElm('a', newImg(item.icon, undefined, item.name));
	wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + GW2Text2HTML(item.name).replaceAll(/\[.*?\]/g, ''); //remove plural forms ([s] and similar)
	wikiLink.target = '_blank';
	if(gw2Object.classList.contains('gw2objectembed')) wikiLink.append(formatItemName(item, context, undefined, undefined, stackSize));
	gw2Object.append(wikiLink);
}

export function inflateSpecialization(gw2Object : HTMLElement, spec: OfficialAPI.Specialization) {
	if(gw2Object.classList.contains('gw2objectembed')) {
		inflateGenericIcon(gw2Object, spec);
	}
	else {
		//NOTE(Rennorb): Full urls specify a protocol which is delilited by a colon. Not perferct but good enough for now.  https_:_ , data_:_image
		gw2Object.style.backgroundImage = `url(${spec.background.includes(':') ? spec.background : IMAGE_CDN + spec.background})`;
		gw2Object.dataset.label = spec.name;

		//TODO(Rennorb) @cleanup @compat: this is kinda dumb. we could just mark the selected traits, as we need to do that anyways for css. 
		// Issue is backwards compat so yea, might not be able to get rid of it completely.
		const selectedPositions = String(gw2Object.getAttribute('selected_traits')).split(',').map(i => +i).filter(i => !isNaN(i) && 0 <= i && i <= 2);
		if(selectedPositions.length != 3) {
			console.warn("[gw2-tooltips] [inflator] Specialization object ", gw2Object, " does not have its 'selected_traits' (properly) set. Add the attribute as `selected_traits=\"0,2,1\"` where the numbers are 0-2 indicating top, middle or bottom selection.");
			return;
		}

		for(const [x, y] of selectedPositions.entries()) {
			// The expected structure is:
			// <spec>
			//  <minor />
			//  <wrapper><major /><major /><major /></>
			//  <minor />
			//  <wrapper><major /><major /><major /></>
			//  <minor />
			//  <wrapper><major /><major /><major /></>
			// </>
			const column = gw2Object.children[1 + x * 2];
			if(!column) {
				console.warn("[gw2-tooltips] [inflator] Cannot mark selected trait object in column #", x, " for specialization object ", gw2Object,  " because the column doesn't seem to exist. Either mark the specialization object as inline or add the missing column.");
				continue;
			}

			for(const [i, traitEl] of Array.prototype.entries.call(column.children)) {
				traitEl.classList.toggle('trait_unselected', i !== y);
			}
			//TODO(Rennorb): can probably merge trait collection into here since its basically the same code
		}
	}
}

type AdditionalAttributes = 'Profession' | 'MagicFind'
export function inflateAttribute(gw2Object : HTMLElement, attribute : BaseAttribute | ComputedAttribute | AdditionalAttributes) {
	const context = contexts[+String(gw2Object.getAttribute('contextSet')) || 0];

	const value : number | undefined = getAttributeValue(context.character, attribute as Exclude<typeof attribute, AdditionalAttributes>);
	const _p  = ({
		Power            : [ 66722, '' ],
		Toughness        : [104162, '' ],
		Vitality         : [104163, '' ],
		Precision        : [156609, '' ],
		Ferocity         : [156602, '' ],
		ConditionDamage  : [156600, '' ],
		Expertise        : [156601, '' ],
		Concentration    : [156599, '' ],
		HealingPower     : [156606, '' ],
		AgonyResistance  : [536049, '' ],
		Health           : [536052, '' ],
		Armor            : [536048, '' ],
		ConditionDuration: [156601, '%'],
		BoonDuration     : [156599, '%'],
		CritChance       : [536051, '%'],
		CritDamage       : [784327, '%'],
		MagicFind        : [536054, '%'],
	} as { [k in BaseAttribute | ComputedAttribute | AdditionalAttributes]? : [number, string]})[attribute];
	let img, suffix = '';
	if(_p) [img, suffix] = _p;
	else {
		console.warn(`[gw2-tooltips] [inflator] Unknown attribute '${attribute}' on object `, gw2Object);
	}

	const displayMul = suffix ? 100 : 1;

	let search = mapLocale(attribute);
	if(attribute == 'Profession') {
		search = "Attribute#Profession_Attributes";
	}

	const wikiLink = newElm('a', newImg(img));
	wikiLink.href = `https://wiki-en.guildwars2.com/wiki/Special:Search/${search}`;
	wikiLink.target = '_blank';
	if(gw2Object.classList.contains('gw2objectembed')) {
		if(value !== undefined) {
			wikiLink.append(withUpToNDigits(value * displayMul, 1) + suffix);
		}
		else {
			wikiLink.append('???' + suffix);
		}
	}

	// We blindly replace this as we can assume the server does not do proper calculation and therefore can only do a rough simulation at best.
	gw2Object.replaceChildren(wikiLink);
}

export function _legacy_transformEffectToSkillObject(gw2Object : HTMLElement, error_store : Set<string>) : number {
	const name = String(gw2Object.getAttribute('objId'));
	let id = ({
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
	} as any)[name]

	if(!id) {
		//NOTE(Rennorb): these don't actually exist and need to be synthesized.
		const hardCoded = ({
			barrier: {
				id: 1,
				name: 'Barrier',
				icon: ICONS.BARRIER,
				description: "Creates a health barrier that takes damage prior to the health bar. Barrier disappears 5s after being applied. Applying a barrier while one is already active will add to it, but the previously-existing barrier will still disappear 5s after it was originally applied. The amount of barrier generated is based on the source's healing power, and is capped at 50% of the recipient's maximum health.",
				description_brief: "Creates a health barrier that takes damage prior to the health bar.",
				categories: [], palettes: [], flags: [],
			},
			stunbreak: {
				id: 2,
				name: 'Stun Break',
				description: 'Cancel control effects such as stuns.',
				icon: ICONS.STUN_BREAK,
				categories: [], palettes: [], flags: [],
			},
			knockdown: {
				id: 3,
				name: 'Knockdown',
				description: 'Knocks the target on ground, preventing movement and actions for a short duration.',
				icon: ICONS.KNOCKDOWN,
				categories: [], palettes: [], flags: [],
			},
			pull: {
				id: 4,
				name: 'Pull',
				description: 'Pulls the caster to the target or the target to a specific location and disables them for a short duration.',
				icon: ICONS.PULL,
				categories: [], palettes: [], flags: [],
			},
			knockback: {
				id: 5,
				name: 'Knockback',
				description: 'Knocks back the target away and on the ground, preventing movement and actions for a short duration.',
				icon: ICONS.KNOCKBACK,
				categories: [], palettes: [], flags: [],
			},
			launch: {
				id: 6,
				name: 'Launch',
				description: 'Throws the target in the air over a short distance, preventing movement and actions for a short duration. Can move Downed targets.',
				icon: ICONS.LAUNCH,
				categories: [], palettes: [], flags: [],
			},
			float: {
				id: 7,
				name: 'Float',
				description: 'Causes the target to float in the air, preventing movement and actions for a short duration. Causes underwater targets to move up.',
				icon: ICONS.FLOAT,
				categories: [], palettes: [], flags: [],
			},
			sink: {
				id: 8,
				name: 'Sink',
				description: 'Causes the underwater target to move downwards.',
				icon: ICONS.SINK,
				categories: [], palettes: [], flags: [],
			},
		} as {[k : string] : API.Skill})[name];

		if(hardCoded) {
			id = hardCoded.id;
			//TODO(Rennorb) @cleanup: could probably move this out
			APICache.storage.skills.set(id, hardCoded);
		}
	}

	if(id) {
		gw2Object.setAttribute('type', 'skill');
		gw2Object.setAttribute('objId', String(id));
		return id;
	}
	else {
		gw2Object.innerText = name;
		gw2Object.title = `Failed to translate effect '${name}'.`;
		gw2Object.style.cursor = "help";
		gw2Object.classList.add('error');
		error_store.add(name);
		return 0;
	}
}

export function inferItemUpgrades(wrappers : Iterable<Element>) {
	const remainingInfusionsByContext = contexts.map(ctx => {
		const counts : Character['upgradeCounts'] = {};
		for(const [id, c] of Object.entries(ctx.character.upgradeCounts)) {
			let item;
			if((item = APICache.storage.items.get(+id)) && 'subtype' in item && item.subtype == 'Infusion')
				counts[+id] = c;
		}
		return counts;
	});
	const enrichmentByContext = contexts.map(ctx => {
		for(const [id, c] of Object.entries(ctx.character.upgradeCounts)) {
			let item;
			if((item = APICache.storage.items.get(+id)) && 'subtype' in item && item.subtype == 'Enrichment')
				return id;
		}
	})

	for(const wrapper of wrappers) {
	if(wrapper.childElementCount < 2) continue;
		const [itemEl, ...upgradeEls] = wrapper.children;
		if(itemEl.getAttribute('type') !== 'item') continue;

		const itemCtx = +String(itemEl.getAttribute('contextSet')) || 0 ;

		const upgradeIds = upgradeEls.filter(u =>
				u.getAttribute('type') === 'item' && u.getAttribute('objid')
				&& (+String(itemEl.getAttribute('contextSet')) || 0) === itemCtx
			)
			.map(u => u.getAttribute('objid'));

		{
			let id, item;
			if((id = +String(itemEl.getAttribute('objid'))) && (item = APICache.storage.items.get(id)) && 'slots' in item) {
				for(const slot of item.slots) {
					if(slot == 'Infusion') {
						const remainingInfusions = remainingInfusionsByContext[itemCtx] as { [k : string] : number };
						for(const infusionId of Object.keys(remainingInfusions)) {
							upgradeIds.push(infusionId);
							if(--remainingInfusions[infusionId] < 1) {
								delete remainingInfusions[infusionId];
							}
							break;
						}
					}
					else if(slot == 'Enrichment') {
						const enrichment = enrichmentByContext[itemCtx];
						if(enrichment) upgradeIds.push(enrichment);
					}
				}
			}
		}

		const attrString = upgradeIds.join(',');
		if(attrString) itemEl.setAttribute('slotted', attrString);
	}
}

import APICache from "./APICache";
import { getAttributeValue } from "./CharacterAttributes";
import { GW2Text2HTML, IMAGE_CDN, mapLocale, newElm, newImg, resolveInflections, withUpToNDigits } from "./TUtilsV2";
import { ICONS, contexts, findTraitedOverride, formatItemName, specializeContextFromInlineAttribs } from "./TooltipsV2";
