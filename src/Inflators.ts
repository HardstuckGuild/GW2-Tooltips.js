export function inflateGenericIcon(element : HTMLElement, data : { name : string, icon? : number }, force = false) {
	if(!force && element.childElementCount > 0) return; // most scenarios will have the server prefill objects as best as it can.

	const wikiLink = newElm('a', newImg(data.icon, undefined, data.name));
	wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + resolveInflections(GW2Text2HTML(data.name), 1, { sex: "Male" });
	wikiLink.target = '_blank';
	if(element.classList.contains('gw2objectembed') && !element.classList.contains('icononly')) {
		const stackSize = +String(element.getAttribute('count')) || 1;
		const context = contexts[+String(element.getAttribute('context-set')) || 0];
		wikiLink.append(resolveInflections(element.textContent || GW2Text2HTML(data.name), stackSize, context.character));
	}
	element.replaceChildren(wikiLink);
}

export function inflateSkill(gw2Object : HTMLElement, skill : API.Skill) {
	const contextSet = +String(gw2Object.getAttribute('context-set')) || 0;
	const context = specializeContextFromInlineAttribs(contexts[contextSet], gw2Object);

	let force = false;
	if(gw2Object.classList.contains('auto-transform')) {
		const replacementSkill = findTraitedOverride(skill, context);
		if(replacementSkill) {
			gw2Object.setAttribute('og-objid', String(skill.id)); // in case we want to reflow after changing traits (e.g. a build editor)
			gw2Object.setAttribute('objid', String(replacementSkill.id));
			skill = replacementSkill;
			force = true;
		}
	}
	
	inflateGenericIcon(gw2Object, skill, force);
}

export function inflateItem(element : HTMLElement, item : API.Item) {
	if(element.childElementCount > 0) return; // most scenarios will have the server prefill objects as best as it can.

	const stackSize = +String(element.getAttribute('count')) || 1;
	const context = contexts[+String(element.getAttribute('context-set')) || 0];

	const skin = getActiveSkin(item as API.Items.Armor, element);

	const wikiLink = newElm('a', newImg(skin?.icon || item.icon, undefined, item.name));
	wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + GW2Text2HTML(item.name).replaceAll(/\[.*?\]/g, ''); //remove plural forms ([s] and similar)
	wikiLink.target = '_blank';
	if(element.classList.contains('gw2objectembed')) {
		wikiLink.append(formatItemName(item, context, skin, undefined, undefined, stackSize));
	}
	element.append(wikiLink);
}

export function inflateSpecialization(element : HTMLElement, spec: API.Specialization) {
	if(element.classList.contains('gw2objectembed')) {
		inflateGenericIcon(element, spec);
	}
	else {
		element.style.backgroundImage = `url(${formatImageUrl(spec.background)})`;
		element.dataset.label = spec.name;

		//TODO(Rennorb) @cleanup @compat: this is kinda dumb. we could just mark the selected traits, as we need to do that anyways for css. 
		// Issue is backwards compat so yea, might not be able to get rid of it completely.
		const selectedPositions = String(element.getAttribute('selected_traits')).split(',').map(i => +i).filter(i => !isNaN(i) && 0 <= i && i <= 2);
		if(selectedPositions.length != 3) {
			console.warn("[gw2-tooltips] [inflator] Specialization object ", element, " does not have its 'selected_traits' (properly) set. Add the attribute as `selected_traits=\"0,2,1\"` where the numbers are 0-2 indicating top, middle or bottom selection.");
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
			const column = element.children[1 + x * 2];
			if(!column) {
				console.warn("[gw2-tooltips] [inflator] Cannot mark selected trait object in column #", x, " for specialization object ", element,  " because the column doesn't seem to exist. Either mark the specialization object as inline or add the missing column.");
				continue;
			}

			for(const [i, traitEl] of Array.prototype.entries.call(column.children)) {
				traitEl.classList.toggle('trait_unselected', i !== y);
			}
			//TODO(Rennorb): can probably merge trait collection into here since its basically the same code. maybe not? Do we need traits beforehand?
		}
	}
}

type AdditionalAttributes = 'Profession' | 'MagicFind' // TODO process on api
export function inflateAttribute(element : HTMLElement, attribute : API.BaseAttribute | API.ComputedAttribute | AdditionalAttributes) {
	const { character } = contexts[+String(element.getAttribute('context-set')) || 0];

	const value : number | undefined = character.statsWithWeapons[character.selectedWeaponSet].values[attribute as Exclude<typeof attribute, AdditionalAttributes>];
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
	} as { [k in API.BaseAttribute | API.ComputedAttribute | AdditionalAttributes]? : [number, string]})[attribute];
	let img, suffix = '';
	if(_p) [img, suffix] = _p;
	else {
		console.warn(`[gw2-tooltips] [inflator] Unknown attribute '${attribute}' on object `, element);
	}

	const displayMul = suffix ? 100 : 1;

	let search = localizeInternalName(attribute);
	if(attribute == 'Profession') {
		search = "Attribute#Profession_Attributes";
	}

	const wikiLink = newElm('a', newImg(img));
	wikiLink.href = `https://wiki-en.guildwars2.com/wiki/Special:Search/${search}`;
	wikiLink.target = '_blank';
	if(element.classList.contains('gw2objectembed')) {
		if(value !== undefined) {
			wikiLink.append(withUpToNDigits(value * displayMul, 1) + suffix);
		}
		else {
			wikiLink.append('???' + suffix);
		}
	}

	// We blindly replace this as we can assume the server does not do proper calculation and therefore can only do a rough simulation at best.
	element.replaceChildren(wikiLink);
}

export function inflateProfession(element : HTMLElement, profession : API.Profession) {
	if(element.childElementCount > 0) return; // most scenarios will have the server prefill objects as best as it can.

	const wikiLink = newElm('a', newImg(profession.icon_big, undefined, profession.name));
	wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + profession.name;
	wikiLink.target = '_blank';
	if(element.classList.contains('gw2objectembed')) wikiLink.append(profession.name);
	element.append(wikiLink);
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

		const itemCtx = +String(itemEl.getAttribute('context-set')) || 0 ;

		const upgradeIds = upgradeEls.filter(u =>
				u.getAttribute('type') === 'item' && u.getAttribute('objid')
				&& (+String(itemEl.getAttribute('context-set')) || 0) === itemCtx
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
import { GW2Text2HTML, formatImageUrl, localizeInternalName, newElm, newImg, resolveInflections, withUpToNDigits } from "./Utils";
import { contexts, findTraitedOverride, formatItemName, getActiveSkin, specializeContextFromInlineAttribs } from "./TooltipsV2";
