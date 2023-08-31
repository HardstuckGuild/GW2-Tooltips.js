export function allUpgradeCounts(scope : ScopeElement, mode : CollectMode = CollectMode.Append) {
	const elements = scope.getElementsByTagName('gw2object');
	for(const pair of contexts.entries()) {
		const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) == pair[0]);
		if(elsInCorrectCtx.length)
			_upgradeCounts(...pair, elsInCorrectCtx, mode);
	}
	//TODO(Rennorb): rethink this or at least make it uniform
	const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) >= contexts.length);
	if(elsWithWrongCtx.length) {
		console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
	}
}
export function specificUpgradeCounts(contextIndex : number, targetContext : Context, scope : ScopeElement, mode : CollectMode = CollectMode.Append) {
	_upgradeCounts(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
}
function _upgradeCounts(contextIndex : number, targetContext : Context, elements : Iterable<Element>, mode : CollectMode) {
	const counts : Character['upgradeCounts'] = {};

	for(const element of elements) {
		let id;
		if(element.getAttribute('type') !== 'item' || !(id = +String(element.getAttribute('objid')))) continue;

		const item = APICache.storage.items.get(id);
		if(!item || !('subtype' in item) || (!['Rune', 'Infusion'].includes(item.subtype))) continue;

		let amountToAdd = 1;

		if(item.subtype == "Infusion") {
			if(!(amountToAdd = +String(element.getAttribute('count')))) { // modern version just has the item count as attribute

				if(config.legacyCompatibility) {
					amountToAdd = _legacy_getInfusionCount(element)!;
					if(!amountToAdd) continue;
				}
			}

			if(!amountToAdd) {
				console.warn("[gw2-tooltips] [collect] Could not figure how many infusions to add for sourceElement ", element, ". Will not assume anything and just ignore the stack.");
						continue
			}
		}
		else if(targetContext.gameMode == "Pvp" && item.subtype == 'Rune') {
			amountToAdd = 6;
		}

		counts[item.id] = (counts[item.id] || 0) + amountToAdd;
	}

	switch(mode) {
		case CollectMode.IgnoreGlobal: targetContext.character.upgradeCounts = counts; break
		case CollectMode.Append: targetContext.character.upgradeCounts = Object.assign(targetContext.character.upgradeCounts, counts); break;

		case CollectMode.PrioritizeGlobal: {
			if(window.GW2TooltipsContext instanceof Array) {
				targetContext.character.upgradeCounts = Object.assign(counts, window.GW2TooltipsContext[contextIndex].character?.upgradeCounts);
			}
			else if(window.GW2TooltipsContext) {
				targetContext.character.upgradeCounts = Object.assign(counts, window.GW2TooltipsContext.character?.upgradeCounts);
			}
			else {
				targetContext.character.upgradeCounts = counts;
			}
		} break

		case CollectMode.OverwriteGlobal: {
			if(window.GW2TooltipsContext instanceof Array) {
				targetContext.character.upgradeCounts = Object.assign({}, window.GW2TooltipsContext[contextIndex].character?.upgradeCounts, counts);
			}
			else if(window.GW2TooltipsContext) {
				targetContext.character.upgradeCounts = Object.assign({}, window.GW2TooltipsContext.character?.upgradeCounts, counts);
			}
			else {
				targetContext.character.upgradeCounts = counts;
			}
		} break
	}
}

//TODO(Rennorb) @correctness @incomplete: +x to all stats not working right now
export function allStatSources(scope : ScopeElement, mode : CollectMode = CollectMode.Append) {
	const elements = scope.getElementsByTagName('gw2object');
	for(const contextIndex of contexts.keys()) {
		const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) == contextIndex);
		if(elsInCorrectCtx.length)
			_statSources(contextIndex, contexts, elsInCorrectCtx, mode);
	}
	const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) >= contexts.length);
	if(elsWithWrongCtx.length) {
		console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
	}
}
export function specificStatSources(contextIndex : number, scope : ScopeElement, mode : CollectMode = CollectMode.Append) {
	_statSources(contextIndex, contexts, scope.getElementsByTagName('gw2object'), mode);
}
function _statSources(contextIndex : number, contexts : Context[], elements : Iterable<Element>, mode : CollectMode) {
	const targetContext = contexts[contextIndex];
	const sources : Context['character']['statSources'] = {
		Power          : [],
		Toughness      : [],
		Vitality       : [],
		Precision      : [],
		Ferocity       : [],
		ConditionDamage: [],
		Expertise      : [],
		Concentration  : [],
		HealingPower   : [],
		AgonyResistance: [],
		Damage         : [],
		LifeForce      : [],
		Health         : [],
		HealEffectiveness: [],
		Stun           : [],
	};

	//NOTE(Rennorb): Cant really use the existing upgrade counts since we want to add tiers individually.
	//TODO(Rennorb) @cleanup: Get rid of the count functions and just put them in here.
	let upgrades = {} as { [k : number] : number };

	for(const element of elements) {
		let id, type = element.getAttribute('type');
		if(!(id = +String(element.getAttribute('objid')))) continue;

		let amountToAdd = 1;
		let tiersToProcess, item : API.Item | undefined, tierNumber, sourceRuneSuffix;
		if(type == 'item') {
			item = APICache.storage.items.get(id);
			if(!item || !('subtype' in item)) continue;

			if(item.type === 'UpgradeComponent' || item.type === 'Consumable') {
				if(item.subtype === 'Rune' && item.flags.includes('Pvp')) {
					amountToAdd = 6;
				}

				//NOTE(Rennorb): We count additional runes, but ignore those over the sensible amount.
				//NOTE(Rennorb): For pvp runes we get the wrong tier number here, it doesn't matter tho because we need to treat it differently anyways.
				// Since pvp builds only have one rune we need to add all tiers from just one item.
				// We still want to increase the upgrade count to do the warnings if we find more than expected.
				tierNumber = upgrades[item.id] = (upgrades[item.id] || 0) + amountToAdd;

				if(item.subtype === 'Rune') {
					sourceRuneSuffix = true;

					if(tierNumber > 6) {
						//NOTE(Rennorb): Only complain if we are manually counting runes.
						//TODO(Rennorb) @correctness: Is this the right way to do it? should we just complain when runes are specified but we find one that isn't?
						if(!targetContext.character.upgradeCounts[item.id])
							console.warn("[gw2-tooltips] [collect] Found more than 6 runes of the same type. Here is the 7th rune element: ", element);
						continue;
					}

					//NOTE(Rennorb): Since pvp builds only have one rune we need to add all tiers from just one item.
					if(item.flags.includes('Pvp'))
						tiersToProcess = item.tiers;
					else
						tiersToProcess = [item.tiers[tierNumber - 1]];
				}
				else {
					if(item.subtype == 'Infusion' || item.subtype == 'Enrichment') {
						if(!(amountToAdd = +String(element.getAttribute('count')))) { // modern version just has the item count as attribute

							if(config.legacyCompatibility) {
								amountToAdd = _legacy_getInfusionCount(element)!;
								if(!amountToAdd) continue;
							}
						}

						if(!amountToAdd) {
							console.warn("[gw2-tooltips] [collect] Could not figure how many infusions to add for sourceElement ", element, ". Will not assume anything and just ignore the stack.");
									continue
						}
					}
					else if(item.subtype === 'Sigil' && tierNumber > 1) {
						//NOTE(Rennorb): We only process one sigil, since sigils are unique, but we start complaining at the third identical one since there might be the same sigil twice for different sets.
						//TODO(Rennorb) @correctness: how to handle asymmetric sets? Right now we would assume all unique sigils are active at once, so if you do [A, B] [B, C] then A, B, C would be considered active.
						if(tierNumber > 2)
							console.warn("[gw2-tooltips] [collect] Found more than 2 sigils of the same type. Here is the 3th sigil element: ", element);
						continue;
					}

					tiersToProcess = item.tiers; //should only ever be one anyways
				}
			}
		}
		else if(type == 'pvp/amulet') {
			item = APICache.storage['pvp/amulets'].get(id);
			if(!item) continue;
		}

		let attributeSet;
		{
			const attributeSetId = +String(element.getAttribute('stats'));
			if(!isNaN(attributeSetId)) attributeSet = APICache.storage.itemstats.get(attributeSetId);
			else if(item && 'attribute_set' in item && item.attribute_set) {
				attributeSet = APICache.storage.itemstats.get(item.attribute_set);
			}
		}

		if(attributeSet) {
			tiersToProcess = [{
				modifiers: attributeSet.attributes.map(a => ({
					target_attribute_or_buff: a.attribute,
					base_amount             : (item as API.ItemAmulet).attribute_base * a.scaling,
					flags                   : [],
					formula                 : "NoScaling",

					id: -1, formula_param1: 0, formula_param2: 0, description: '',
				} as API.Modifier))
			}];
		}

		if(tiersToProcess) for(const [i, tier] of tiersToProcess.entries()) {
			if(tier.modifiers) for(const mod of tier.modifiers!) {
				if(!mod.target_attribute_or_buff || (mod.mode && mod.mode !== targetContext.gameMode) || (mod.trait_req && !targetContext.character.traits.includes(mod.trait_req))) continue; //TODO(Rennorb): probably extract this into a fn similar to the other resolver

				let source = formatItemName(item!, targetContext, attributeSet, undefined, -1);
				if(sourceRuneSuffix) {
					source = `${source} (Tier ${tierNumber && tierNumber < 6 ? tierNumber : i + 1} Bonus)`;
					amountToAdd = 1; //TODO(Rennorb) @cleanup
				}

				(sources[mod.target_attribute_or_buff] || (sources[mod.target_attribute_or_buff] = []))
					.push({ modifier: mod, source, count: amountToAdd })
			}
		}
	}

	//TODO(Rennorb) @cleanup: move this out?
	switch(mode) {
		case CollectMode.IgnoreGlobal: targetContext.character.statSources = sources; break
		case CollectMode.Append: {
			for(const [k, values] of Object.entries(sources)) {
				((targetContext.character.statSources as any)[k] || ((targetContext.character.statSources as any)[k] = []))
					.push(...values);
			}
		} break;

		case CollectMode.PrioritizeGlobal: {
			if(window.GW2TooltipsContext instanceof Array) {
				targetContext.character.statSources = Object.assign(sources, window.GW2TooltipsContext[contextIndex].character?.statSources);
			}
			else if(window.GW2TooltipsContext) {
				targetContext.character.statSources = Object.assign(sources, window.GW2TooltipsContext.character?.statSources);
			}
			else {
				targetContext.character.statSources = sources;
			}
		} break

		case CollectMode.OverwriteGlobal: {
			if(window.GW2TooltipsContext instanceof Array) {
				targetContext.character.statSources = Object.assign({}, window.GW2TooltipsContext[contextIndex].character?.statSources, sources);
			}
			else if(window.GW2TooltipsContext) {
				targetContext.character.statSources = Object.assign({}, window.GW2TooltipsContext.character?.statSources, sources);
			}
			else {
				targetContext.character.statSources = sources;
			}
		} break
	}
}

function _legacy_getInfusionCount(element : Element) : number | undefined {
	//NOTE(Rennorb): unfortunately this is a bit complicated as the count is next to the actual object, but within a stacked wrapper. so its
	// <gw2obj />
	// ... repeated for multiple infusions
	// <div.gw2-build-equipment-info>
	//   <span.item-name.noembed><strong.amount>{amount}x</strong>{name}</span>
	//   ... repeated for multiple infusions
	const ownIndex = Array.prototype.indexOf.call(element.parentElement!.children, element);
	const amountEl = element.parentElement!.getElementsByClassName('amount')[ownIndex];
	if(!amountEl){
		console.warn("[gw2-tooltips] [collect] `legacyCompatibility` is active, but no amount element for infusion ", element, " could be found. Will not assume anything and just ignore the stack.");
		return;
	}
	const amountToAdd = +String(amountEl.textContent?.match(/\d+/)?.[0]);
	if(!amountToAdd) {
		console.warn("[gw2-tooltips] [collect] [legacyCompatibility] Amount element ", amountEl, " for infusion element ", element, " did not contain any readable amount. Will not assume anything and just ignore the stack.");
		return;
	}
	if(amountToAdd < 1 || amountToAdd > 20) {
		console.warn("[gw2-tooltips] [collect] [legacyCompatibility] Amount element ", amountEl, " for infusion element ", element, " did got interpreted as x", amountToAdd, " which is outside of the range of sensible values (amount in [1...20]). Will not assume anything and just ignore the stack.");
		return;
	}

	return amountToAdd;
}

export function allTraits(scope : ScopeElement, mode : CollectMode = CollectMode.Append) {
	const elements = scope.querySelectorAll('gw2object[type=specialization]:not(.gw2objectembed)');
	for(const pair of contexts.entries()) {
		const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) == pair[0]);
		if(elsInCorrectCtx.length)
			_traits(...pair, elsInCorrectCtx, mode);
	}
	const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) >= contexts.length);
	if(elsWithWrongCtx.length) {
		console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
	}
}
export function specificTraits(contextIndex : number, targetContext : Context, scope : ScopeElement, mode : CollectMode = CollectMode.Append) {
	_traits(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
}
function _traits(contextIndex : number, targetContext : Context, elements : Iterable<Element>, mode : CollectMode) {
	const traits : number[] = [];
	for(const specialization of elements) {
		const selectedPositions = String(specialization.getAttribute('selected_traits')).split(',').map(i => +i).filter(i => !isNaN(i) && 0 <= i && i <= 2);
		if(selectedPositions.length != 3) {
			console.warn("[gw2-tooltips] [collect] Specialization object ", specialization, " does not have its 'selected_traits' (properly) set. Add the attribute as `selected_traits=\"0,2,1\"` where the numbers are 0-2 indicating top, middle or bottom selection. Will not assume anything and just ignore the element.");
			continue;
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
			{
				const traitEl = specialization.children[1 + x * 2].children[y];
				let id;
				if(!traitEl || !(id = +String(traitEl.getAttribute('objid')))) {
					console.warn("[gw2-tooltips] [collect] Trait object ", traitEl, " is selected but does not exist or does not have an objid set. Add the attribute as `objid=\"1234\"`. Will not assume anything and just ignore the element.");
					continue;
				}
				traits.push(id);
			}
			
			//now abuse the iterator to also add minors
			{
				const traitEl = specialization.children[x * 2];
				let id;
				if(!(id = +String(traitEl.getAttribute('objid')))) {
					console.warn("[gw2-tooltips] [collect] Minor trait object ", traitEl, " does not have an objid set. Add the attribute as `objid=\"1234\"`. Will not assume anything and just ignore the element.");
					continue;
				}
				traits.push(id);
			}
		}
	}

	//TODO(Rennorb) @cleanup: move this out?
	switch(mode) {
		case CollectMode.IgnoreGlobal:
			// It doest actually make sense to 'overwrite' here, so its just the same as IgnoreGlobal.
		case CollectMode.OverwriteGlobal: targetContext.character.traits = traits; break

		// It doest actually make sense to 'append' here, so its just the same as PrioritizeGlobal.
		case CollectMode.Append:
		case CollectMode.PrioritizeGlobal: {
			if(window.GW2TooltipsContext instanceof Array) {
				const set = new Set(window.GW2TooltipsContext[contextIndex].character?.traits);
				traits.forEach(t => set.add(t));
				targetContext.character.traits = Array.from(set);
			}
			else if(window.GW2TooltipsContext) {
				const set = new Set(window.GW2TooltipsContext.character?.traits);
				traits.forEach(t => set.add(t));
				targetContext.character.traits = Array.from(set);
			}
			else {
				targetContext.character.traits = traits;
			}
		} break
	}
}

export function traitEffects(contexts : Context[]) {
	for(const context of contexts) {
		for(const traitId of context.character.traits) {
			const trait = APICache.storage.traits.get(traitId);
			if(!trait) {
				console.error(`[gw2-tooltips] [collect] Trait #${traitId} is apparently missing in the cache.`);
				continue;
			}

			const addModifiers = (modifiers : API.Modifier[]) => {
				for(const mod of modifiers) {
					if(!mod.target_attribute_or_buff || (mod.mode && mod.mode !== context.gameMode) || (mod.trait_req && !context.character.traits.includes(mod.trait_req))) continue; //TODO(Rennorb): probably extract this into a fn similar to the other resolver

					(context.character.statSources[mod.target_attribute_or_buff] || (context.character.statSources[mod.target_attribute_or_buff] = []))
						.push({source: `trait '<span class="gw2-color-traited-fact">${trait.name}</span>'`, modifier: mod, count: 1});
				}
			};
			if(trait.modifiers) addModifiers(trait.modifiers);

			const contextBoundInfo = resolveTraitsAndOverrides(trait, context);
			if(contextBoundInfo.blocks) for(const block of contextBoundInfo.blocks) if(block.facts) for(const fact of block.facts) {
				if(!('buff' in fact)) continue;
				
				const buff = APICache.storage.skills.get(fact.buff);
				if(!buff) {
					console.error(`[gw2-tooltips] [collect] Buff #${fact.buff} required for trait effect collection is apparently missing in the cache.`);
					continue;
				}

				if(buff.modifiers && !['Boon', 'Condition'].includes(buff.buff_type!)) {
					console.info(`[gw2-tooltips] [collect] [trait-effects] ${trait.name} applies ${buff.buff_type} ${buff.name}: ${buff.modifiers.length} mods`);
					addModifiers(buff.modifiers);
				}
			}
		}
	}
}

const enum CollectMode {
	IgnoreGlobal,
	PrioritizeGlobal,
	OverwriteGlobal,
	Append,
}

import APICache from "./APICache";
import { resolveTraitsAndOverrides, config, formatItemName, contexts } from './TooltipsV2';
