export function inflateGenericIcon(gw2Object : HTMLElement, data : { name : string, icon? : Parameters<typeof newImg>[0] }) {
	if(gw2Object.childElementCount > 0) return; // most scenarios will have the server prefill objects as best as it can.

	const wikiLink = newElm('a', newImg(data.icon, undefined, data.name));
	wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + GW2Text2HTML(data.name).replaceAll(/\[.*?\]/g, ''); //remove plural forms ([s] and similar)
	wikiLink.target = '_blank';
	if(gw2Object.classList.contains('gw2objectembed') && !gw2Object.classList.contains('icononly')) {
		//TODO(Rennorb) @correctness: this should probably take into account the plural form
		const cleanName = GW2Text2HTML(data.name).replaceAll(/\[.*?\]/g, ''); //remove plural forms ([s] and similar)
		wikiLink.append(cleanName);
	}
	gw2Object.append(wikiLink);
}

export function inflateSkill(gw2Object : HTMLElement, skill : API.Skill) {
	const contextSet = +String(gw2Object.getAttribute('contextSet')) || 0;
	const context_ = specializeContextFromInlineAttribs(context[contextSet], gw2Object);

	//NOTE(Rennorb): doing this here might not be the best idea, as this wil prevent us form hot swapping traits.
	// The issue is that this is the place where the icon gets selected and inflated, so its somewhat required to change the skill before this point.
	// Maybe this is still the best place to do this and for cases were we need hot swapping (e.g. build editor) we just have to manually re-process skills after swapping traits.
	// Maybe we should move the original id to another attribute for savekeeping so we can revert it later on if we need to?
	if(config.adjustTraitedSkillIds) {
		const replacementSkill = findTraitedOverride(skill, context_);
		if(replacementSkill) {
			gw2Object.setAttribute('objid', String(replacementSkill.id));
			skill = replacementSkill;
		}
	}
	
	inflateGenericIcon(gw2Object, skill);
}

export function inflateItem(gw2Object : HTMLElement, item : API.Item) {
	if(gw2Object.childElementCount > 0) return; // most scenarios will have the server prefill objects as best as it can.

	const stackSize = +String(gw2Object.getAttribute('count')) || 1;
	const context_ = context[+String(gw2Object.getAttribute('contextSet')) || 0];

	const wikiLink = newElm('a', newImg(item.icon, undefined, item.name));
	wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + GW2Text2HTML(item.name).replaceAll(/\[.*?\]/g, ''); //remove plural forms ([s] and similar)
	wikiLink.target = '_blank';
	if(gw2Object.classList.contains('gw2objectembed')) wikiLink.append(formatItemName(item, context_, undefined, undefined, stackSize));
	gw2Object.append(wikiLink);
}

export function inflateSpecialization(gw2Object : HTMLElement, spec: OfficialAPI.Specialization) {
	if(gw2Object.classList.contains('gw2objectembed')) {
		inflateGenericIcon(gw2Object, spec);
	}
	else {
		gw2Object.style.backgroundImage = `url(${spec.background})`;
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

export function _legacy_transformEffectToSkillObject(gw2Object : HTMLElement, error_store : Set<string>) : number {
	const name = String(gw2Object.getAttribute('objId'));
	let id = ({
		blight                  : 62653,
		bleeding                : 736,
		burning                 : 40549,
		blinded                 : 720,
		bloodstone_blessed      : 34917,
		blue_pylon_power        : 31317, //maybe wrong (vale guardian)
		chill                   : 722,
		quickness               : 1187,
		chilled                 : 722,
		crippled                : 23525,
		fear                    : 896,
		alacrity                : 30328,
		protection              : 717,
		vigor                   : 726,
		barrier                 : 0, //TODO
		fury                    : 725,
		stability               : 1122,
		stunbreak               : 0, //TODO
		aegis                   : 743,
		might                   : 740,
		regeneration            : 16538,
		immobilize              : 22501,
		slow                    : 26766,
		resistance              : 26980,
		champion_of_the_legions : 20845, //maybe wrong (rock fest thing?)
		compromised             : 35096,
		crowd_favor             : 36173, //maybe wrong (marionette)
		curse_of_frailty        : 53723, //maybe wrong (pirate fractal)
		confusion               : 861,
		dark_aura               : 39978,
		daze                    : 833,
		debilitated             : 0, //TODO ko
		debilitating_void       : 0, //TODO ankah
		defense_up              : 28482,
		derangement             : 34965,
		elemental_empowerment   : 62733,
		empowering_auras        : 62939,
		equalization_matrix     : 66586, //maybe wrong (ko)
		exposed                 : 28778, //maybe wrong
		expose_weakness         : 26660, //maybe wrong
		extreme_vulnerability   : 65662,
		fixated                 : 47434, //maybe wrong
		//gems_big                : ,
		//gold_gold_big           : ,
		growing_rage_ashym      : 3362, //maybe wrong (urban battleground)
		//h                       : ,
		ignite                  : 16259,
		intervention            : 35061,
		invulnerability         : 56227,
		necrosis                : 47414,
		not_sticking_together   : 54378,
		nova                    : 39193, //there is also the upgraded version with aegis
		ooze_pheromone          : 21538,
		photon_saturation       : 0, //TODO ah cm
		positive_flow           : 66665,
		power_of_the_void       : 0, //TODO xjj
		poison                  : 723,
		//q                       : ,
		reinforced_armor        : 9283,
		relentless_fire         : 62805,
		retaliation_ashym       : 24646, //maybe wrong
		revealed                : 890,
		resolution              : 873,
		sentinel_retribution    : 16350,
		shattering_ice          : 62909,
		shell_shocked           : 33361,
		spectral_darkness       : 31498,
		sticking_together       : 54604,
		synchronized_vitality   : 63840, //maybe wrong(ko)
		stun                    : 872,
		stealth                 : 58026, //maybe wrong
		torment                 : 21632, //maybe wrong
		superspeed              : 5974,
		swiftness               : 719,
		taunt                   : 27705,
		unnatural_signet        : 38224,
		unblockable             : 18843,
		use_soul_binder         : 55630,
		void_empowerment        : 68083,
		vulnerability           : 738,
		weakness                : 742,
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
				categories: [], palettes: [],
			},
			stunbreak: {
				id: 2,
				name: 'Stun Break',
				description: 'Cancel control effects such as stuns.',
				icon: ICONS.STUN_BREAK,
				categories: [], palettes: [],
			},
			knockdown: {
				id: 3,
				name: 'Knockdown',
				description: 'Knocks the target on ground, preventing movement and actions for a short duration.',
				icon: ICONS.KNOCKDOWN,
				categories: [], palettes: [],
			},
			pull: {
				id: 4,
				name: 'Pull',
				description: 'Pulls the caster to the target or the target to a specific location and disables them for a short duration.',
				icon: ICONS.PULL,
				categories: [], palettes: [],
			},
			knockback: {
				id: 5,
				name: 'Knockdown',
				description: 'Knocks back the target away and on the ground, preventing movement and actions for a short duration.',
				icon: ICONS.KNOCKBACK,
				categories: [], palettes: [],
			},
			launch: {
				id: 6,
				name: 'Launch',
				description: 'Throws the target in the air over a short distance, preventing movement and actions for a short duration. Can move Downed targets.',
				icon: ICONS.LAUNCH,
				categories: [], palettes: [],
			},
			float: {
				id: 7,
				name: 'Float',
				description: 'Causes the target to float in the air, preventing movement and actions for a short duration. Causes underwater targets to move up.',
				icon: ICONS.FLOAT,
				categories: [], palettes: [],
			},
			sink: {
				id: 8,
				name: 'Sink',
				description: 'Causes the underwater target to move downwards.',
				icon: ICONS.SINK,
				categories: [], palettes: [],
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
	const remainingInfusionsByContext = context.map(ctx => {
		const counts : Character['upgradeCounts'] = {};
		for(const [id, c] of Object.entries(ctx.character.upgradeCounts)) {
			let item;
			if((item = APICache.storage.items.get(+id)) && 'subtype' in item && item.subtype == 'Infusion')
				counts[+id] = c;
		}
		return counts;
	});
	const enrichmentByContext = context.map(ctx => {
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
import { GW2Text2HTML, newElm, newImg } from "./TUtilsV2";
import { ICONS, config, context, findTraitedOverride, formatItemName, specializeContextFromInlineAttribs } from "./TooltipsV2";
