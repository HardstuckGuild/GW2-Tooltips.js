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
	const context = contexts[contextIndex];
	const sources : BaseStats['sources'] = structuredClone(DEFAULT_CONTEXT.character.stats.sources);
	const weaponSetSources : BaseAndComputedStats['sources'][] = [];

	//NOTE(Rennorb): Cant really use the existing upgrade counts since we want to add tiers individually.
	//TODO(Rennorb) @cleanup: Get rid of the count functions and just put them in here.
	let upgrades = {} as { [k : number] : number };

	//NOTE(Rennorb): its common to specify both weapon sets of infusions. The issue becomes that those are too many and therefore we need to be able to reduce them in a sensible way.
	const actualInfusionCounts = contexts.map(ctx => {
		let total = 0;
		const counts : { [k : string] : number } = {};
		for(let [id, c] of Object.entries(ctx.character.upgradeCounts)) {
			let item;
			if((item = APICache.storage.items.get(+id)) && 'subtype' in item && item.subtype == 'Infusion') {
				c = Math.min(c, 18); // A max of 18 infusions of one kind, more doesn't make sense.
				counts[id] = c;
				total += c;
			}
		}

		let tooMany = Math.max(0, total - 18);

		for(let stop = 100; tooMany > 0 && stop > 0; stop--) {
			for(const [id, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
				if(c > 2) {
					const toRemove = (c & 1) ? 1 : 2;
					counts[id] -= toRemove;
					tooMany -= toRemove;
					if(tooMany <= 0) break;
				}
			}
		}

		return counts;
	});

	for(const element of elements) {
		let id, type = element.getAttribute('type');
		if(!(id = +String(element.getAttribute('objid')))) continue;

		let amountToAdd = 1;
		let tiersToProcess : { modifiers? : API.Modifier[] }[] | undefined, item : API.Item | undefined, tierNumber, sourceRuneSuffix;
		if(type == 'item') {
			item = APICache.storage.items.get(id);
			if(!item || !('subtype' in item)) continue;

			if(item.type === 'UpgradeComponent' || item.type === 'Consumable') {
				let tiersToAdd = 1;
				if(item.subtype === 'Rune' && item.flags.includes('Pvp')) {
					// Since pvp builds only have one rune we need to add all tiers from just one item.
					// We still want to increase the upgrade count to do the warnings if we find more than expected.
					tiersToAdd = 6;
				}

				//NOTE(Rennorb): We count additional runes, but ignore those over the sensible amount.
				//NOTE(Rennorb): For pvp runes we get the wrong tier number here, it doesn't matter tho because we need to treat it differently anyways.
				tierNumber = upgrades[item.id] = (upgrades[item.id] || 0) + tiersToAdd;

				if(item.subtype === 'Rune') {
					sourceRuneSuffix = true;

					if(tierNumber > 6) {
						//NOTE(Rennorb): Only complain if we are manually counting runes.
						//TODO(Rennorb) @correctness: Is this the right way to do it? should we just complain when runes are specified but we find one that isn't?
						if(!context.character.upgradeCounts[item.id])
							console.warn("[gw2-tooltips] [collect] Found more than 6 runes of the same type. Here is the 7th rune element: ", element);
						continue;
					}

					//NOTE(Rennorb): Since pvp builds only have one rune we need to add all tiers from just one item.
					if(item.flags.includes('Pvp'))
						tiersToProcess = item.tiers;
					else
						tiersToProcess = [item.tiers[tierNumber - 1]];
				}
				else if('applies_buff' in item) {
					const buff = APICache.storage.skills.get(item.applies_buff.buff);
					if(!buff) {
						console.warn(`[gw2-tooltips] [collect] Failed to resolve applied buff ${item.applies_buff} for `, element, ". Will not assume anything and just ignore the item.");
						continue;
					}

					tiersToProcess = [{ modifiers: buff.modifiers }];
				}
				else if('tiers' in item) {
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

		let attributeSet = item && findCorrectAttributeSet(item, +String(element.getAttribute('stats')) || undefined);

		if(attributeSet) {
			tiersToProcess = [{
				modifiers: attributeSet.attributes.map(a => ({
					target_attribute_or_skill: a.attribute,
					base_amount              : Math.round(a.base_value + (item as API.ItemStatSource).attribute_base * a.scaling),
					formula                  : "NoScaling",
					
					flags: [], id: -1, formula_param1: 0, formula_param2: 0, description: '',
				} as API.Modifier))
			}];
		}
		if(item && 'defense' in item) {
			const defense = (typeof item.defense  == "number")
				? item.defense
				: LUT_DEFENSE[Math.min(100, (item.defense![0] + context.character.level))] * item.defense![1];

			//NOTE(Rennorb): Pvp shields might have defense but no attribute set.
			if(!tiersToProcess) tiersToProcess = [{ modifiers: [] }];
			tiersToProcess[0].modifiers!.push({
				target_attribute_or_skill: 'Armor',
				base_amount              : Math.ceil(defense),
				formula                  : "NoScaling",
				
				flags: [], id: -1, formula_param1: 0, formula_param2: 0, description: '',
			} as API.Modifier)
		}

		let targetSources = sources;

		const weaponSetId = +String(element.getAttribute('weaponSet'));
		if(isNaN(weaponSetId) && item && item.type == "UpgradeComponent") {
			const override = actualInfusionCounts[contextIndex][item.id];
			if(override) {
				amountToAdd = override;
			}
			else if(amountToAdd > 18) {
				amountToAdd = 18;
			}
		}

		if(!isNaN(weaponSetId)) {
			targetSources = weaponSetSources[weaponSetId] || (weaponSetSources[weaponSetId] = structuredClone(DEFAULT_CONTEXT.character.stats.sources));
		}

		if(tiersToProcess) for(const [i, tier] of tiersToProcess.entries()) {
			if(tier.modifiers) for(const mod of tier.modifiers!) {
				if(!mod.target_attribute_or_skill || (mod.mode && mod.mode !== context.gameMode) || (mod.source_trait_req && !context.character.traits.includes(mod.source_trait_req)) || (mod.target_trait_req && !context.character.traits.includes(mod.target_trait_req))) continue; //TODO(Rennorb): probably extract this into a fn similar to the other resolver

				let source = formatItemName(item!, context, attributeSet, undefined, -1);
				if(sourceRuneSuffix) {
					source = `${source} (Tier ${tiersToProcess.length === 1 ? tierNumber : i + 1} Bonus)`;
				}

				(targetSources[mod.target_attribute_or_skill] || (targetSources[mod.target_attribute_or_skill] = []))
					.push({ modifier: mod, source, count: amountToAdd })
			}
		}
	}

	const character = context.character;
	const overwriteWeaponStatSources = () => {
		for(const [i, sources] of weaponSetSources.entries()) {
			const target = character.statsWithWeapons[i];
			if(target) target.sources = sources;
			else character.statsWithWeapons[i] = {
				sources,
				values   : Object.assign({}, DEFAULT_CONTEXT.character.statsWithWeapons[0].values),
				htmlParts: structuredClone(DEFAULT_CONTEXT.character.statsWithWeapons[0].htmlParts),
			};
		}
	}
	
	switch(mode) {
		case CollectMode.IgnoreGlobal:
			character.stats.sources = sources;
			overwriteWeaponStatSources();
			break;

		case CollectMode.Append: {
			for(const [k, values] of Object.entries(sources)) {
				((character.stats.sources as any)[k] || ((character.stats.sources as any)[k] = []))
					.push(...values);
			}
			for(const [i, sources] of weaponSetSources.entries()) {
				const target = character.statsWithWeapons[i];
				if(target) {
					for(const [k, values] of Object.entries(sources)) {
						((target.sources as any)[k] || ((target.sources as any)[k] = []))
							.push(...values);
					}			
				}
				else character.statsWithWeapons[i] = {
					sources,
					values   : Object.assign({}, DEFAULT_CONTEXT.character.statsWithWeapons[0].values),
					htmlParts: structuredClone(DEFAULT_CONTEXT.character.statsWithWeapons[0].htmlParts),
				};
			}
		} break;

		case CollectMode.PrioritizeGlobal: {
			if(window.GW2TooltipsContext instanceof Array) {
				character.stats.sources = Object.assign(sources, window.GW2TooltipsContext[contextIndex].character?.stats?.sources);
				console.assert(false && "todo weaponStats");
			}
			else if(window.GW2TooltipsContext) {
				character.stats.sources = Object.assign(sources, window.GW2TooltipsContext.character?.stats?.sources);
				console.assert(false && "todo weaponStats");
			}
			else {
				character.stats.sources = sources;
				overwriteWeaponStatSources();
			}
		} break

		case CollectMode.OverwriteGlobal: {
			if(window.GW2TooltipsContext instanceof Array) {
				character.stats.sources = Object.assign({}, window.GW2TooltipsContext[contextIndex].character?.stats?.sources, sources);
				console.assert(false && "todo weaponStats");
			}
			else if(window.GW2TooltipsContext) {
				character.stats.sources = Object.assign({}, window.GW2TooltipsContext.character?.stats?.sources, sources);
				console.assert(false && "todo weaponStats");
			}
			else {
				character.stats.sources = sources;
				overwriteWeaponStatSources();
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
	const specializations : number[] = [];
	for(const specialization of elements) {
		const specId = +String(specialization.getAttribute('objid'));
		if(!isNaN(specId)) {
			specializations.push(specId);
		}

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
		case CollectMode.OverwriteGlobal: 
			targetContext.character.traits = traits;
			targetContext.character.specializations = specializations;
			break

		// It doest actually make sense to 'append' here, so its just the same as PrioritizeGlobal.
		case CollectMode.Append:
		case CollectMode.PrioritizeGlobal: {
			if(window.GW2TooltipsContext instanceof Array) {
				const set = new Set(window.GW2TooltipsContext[contextIndex].character?.traits);
				traits.forEach(t => set.add(t));
				targetContext.character.traits = Array.from(set);

				const set2 = new Set(window.GW2TooltipsContext[contextIndex].character?.specializations);
				specializations.forEach(t => set2.add(t));
				targetContext.character.specializations = Array.from(set2);
			}
			else if(window.GW2TooltipsContext) {
				const set = new Set(window.GW2TooltipsContext.character?.traits);
				traits.forEach(t => set.add(t));
				targetContext.character.traits = Array.from(set);

				const set2 = new Set(window.GW2TooltipsContext.character?.specializations);
				specializations.forEach(t => set2.add(t));
				targetContext.character.specializations = Array.from(set2);
			}
			else {
				targetContext.character.traits = traits;
				targetContext.character.specializations = specializations;
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
					if(!mod.target_attribute_or_skill || (mod.mode && mod.mode !== context.gameMode) || (mod.source_trait_req && !context.character.traits.includes(mod.source_trait_req)) || (mod.target_trait_req && !context.character.traits.includes(mod.target_trait_req))) continue; //TODO(Rennorb): probably extract this into a fn similar to the other resolver

					(context.character.stats.sources[mod.target_attribute_or_skill] || (context.character.stats.sources[mod.target_attribute_or_skill] = []))
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

//TODO(RennorB) @cleanup: this was an idead i head, its uselsee. just get rid of it.
const enum CollectMode {
	IgnoreGlobal,
	PrioritizeGlobal,
	OverwriteGlobal,
	Append,
}

import APICache from "./APICache";
import { LUT_DEFENSE } from "./CharacterAttributes";
import { resolveTraitsAndOverrides, config, formatItemName, contexts, findCorrectAttributeSet, DEFAULT_CONTEXT } from './TooltipsV2';
