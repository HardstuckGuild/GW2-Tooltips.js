class Collect {
	static allUpgradeCounts(contexts : Context[], scope : ScopeElement, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		const elements = scope.getElementsByTagName('gw2object');
		for(const pair of contexts.entries()) {
			const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) == pair[0]);
			this._upgradeCounts(...pair, elsInCorrectCtx, mode);
		}
		//TODO(Rennorb): rethink this or at least make it uniform
		const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) >= contexts.length);
		if(elsWithWrongCtx.length) {
			console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
		}
	}
	static specificUpgradeCounts(contextIndex : number, targetContext : Context, scope : ScopeElement, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		this._upgradeCounts(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
	}
	static _upgradeCounts(contextIndex : number, targetContext : Context, elements : Iterable<Element>, mode : CollectMode) {
		const counts : Character['upgradeCounts'] = {};

		for(const element of elements) {
			let id;
			if(element.getAttribute('type') !== 'item' || !(id = +String(element.getAttribute('objid')))) continue;

			const item = APICache.storage.items.get(id);
			if(!item || !('subtype' in item) || (item.subtype != 'Rune' && item.subtype != 'Default')) continue;

			let amountToAdd = 1;

			//NOTE(Rennorb): Pvp runes / sigils have type default; should fix this on the api side
			if(item.subtype == "Default" && !item.flags.includes('Pvp')) {
				if(!(amountToAdd = +String(element.getAttribute('count')))) { // modern version just has the item count as attribute

					if(GW2TooltipsV2.config.legacyCompatibility) {
						amountToAdd = this._legacy_getInfusionCount(element)!;
						if(!amountToAdd) continue;
					}
				}

				if(!amountToAdd) {
					console.warn("[gw2-tooltips] [collect] Could not figure how many infusions to add for sourceElement ", element, ". Will not assume anything and just ignore the stack.");
							continue
				}
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


	static allStatSources(contexts : Context[], scope : ScopeElement, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		const elements = scope.getElementsByTagName('gw2object');
		for(const pair of contexts.entries()) {
			const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) == pair[0]);
			this._statSources(...pair, elsInCorrectCtx, mode);
		}
		const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) >= contexts.length);
		if(elsWithWrongCtx.length) {
			console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
		}
	}
	static specificStatSources(contextIndex : number, targetContext : Context, scope : ScopeElement, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		this._statSources(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
	}
	static _statSources(contextIndex : number, targetContext : Context, elements : Iterable<Element>, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		const sources : Context['character']['statSources'] = {
			power          : [],
			toughness      : [],
			vitality       : [],
			precision      : [],
			ferocity       : [],
			conditionDmg   : [],
			expertise      : [],
			concentration  : [],
			healing        : [],
			critDamage     : [],
			agonyResistance: [],
		};

		//NOTE(Rennorb): We use the existing rune count if given.
		let upgrades = Object.assign({}, targetContext.character.upgradeCounts);

		for(const element of elements) {
			let id, type = element.getAttribute('type');
			if(!(id = +String(element.getAttribute('objid')))) continue;

			let amountToAdd = 1;
			let tier, item : API.Item | API.Amulet | undefined;
			if(type == 'item') {
				item = APICache.storage.items.get(id);
				if(!item || !('subtype' in item)) continue;

				if(item.type === 'UpgradeComponent' || item.type === 'Consumable') {
					//NOTE(Rennorb): We count additional runes, but ignore those over the sensible amount.
					const tierNumber = upgrades[item.id] = (upgrades[item.id] || 0) + 1;
					if(item.subtype === 'Rune') {
						//TODO(Rennorb) @bug: this doesn't work if the runes are already collected / manually set. its already at 6 in that case and the value isn't properly processed.
						if(tierNumber > 6) {
							//NOTE(Rennorb): Only complain if we are manually counting runes.
							//TODO(Rennorb) @correctness: Is this the right way to do it? should we just complain when runes are specified but we find one that isn't?
							if(!targetContext.character.upgradeCounts[item.id])
								console.warn("[gw2-tooltips] [collect] Found more than 6 runes of the same type. Here is the 7th rune element: ", element);
							continue;
						}
						tier = item.tiers[tierNumber - 1];
					}
					else {
						//NOTE(Rennorb): Pvp runes / sigils have type default; should fix this on the api side
						if(item.subtype == "Default" && !item.flags.includes('Pvp')) {
							if(!(amountToAdd = +String(element.getAttribute('count')))) { // modern version just has the item count as attribute

								if(GW2TooltipsV2.config.legacyCompatibility) {
									amountToAdd = this._legacy_getInfusionCount(element)!;
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

						tier = item.tiers[0];
					}
				}
			}
			else if(type == 'pvp/amulet') {
				item = APICache.storage['pvp/amulets'].get(id);
				if(!item) continue;
				
				tier = item.tiers[0];
			}

			if(tier && tier.modifiers) for(const modifier of tier.modifiers!) {
				if(!modifier.attribute) continue;

				sources[TUtilsV2.Uncapitalize(modifier.attribute)].push({ modifier, source: item!.name, count: amountToAdd })
			}
		}

		//TODO(Rennorb) @cleanup: move this out?
		switch(mode) {
			case CollectMode.IgnoreGlobal: targetContext.character.statSources = sources; break
			case CollectMode.Append: targetContext.character.statSources = Object.assign(targetContext.character.statSources, sources); break;

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


		// now we set the new stats
		{
			let baseStats;
			if(window.GW2TooltipsContext instanceof Array) {
				baseStats = Object.assign({}, window.GW2TooltipsContext[contextIndex].character?.stats, GW2TooltipsV2.defaultContext.character.stats);
			}
			else if(window.GW2TooltipsContext) {
				baseStats = Object.assign({}, window.GW2TooltipsContext.character?.stats, GW2TooltipsV2.defaultContext.character.stats);
			}
			else {
				baseStats = Object.assign({}, GW2TooltipsV2.defaultContext.character.stats);
			}

			targetContext.character.stats = baseStats;

			//TODO(Rennorb) @correctnes: 'for every x healing power' is not treated correctly by this approach.
			for(const [attrib, sources] of Object.entries(targetContext.character.statSources)) {
				for(const { modifier, source, count } of sources.filter(s => !s.modifier.flags.includes('FormatPercent'))) {
					targetContext.character.stats[attrib] += FactsProcessor.calculateModifier(modifier, targetContext.character) * count
					console.log(`[gw2-tooltips] [collect] ${source}${count > 1 ? (' x '+count) : ''}: Flat ${attrib} => ${targetContext.character.stats[attrib]}`)
				}
				for(const { modifier, source, count } of sources.filter(s => s.modifier.flags.includes('FormatPercent'))) {
					const value = FactsProcessor.calculateModifier(modifier, targetContext.character);
					targetContext.character.stats[attrib] += (modifier.formula == 'NoScaling'
						? targetContext.character.stats[attrib] * value
						: value)
							* count; //TODO(Rennorb) @correctness
					console.log(`[gw2-tooltips] [collect] ${source}${count > 1 ? (' x '+count) : ''}: Percent ${attrib} => ${targetContext.character.stats[attrib]}`)
				}
			}
		}
	}

	static _legacy_getInfusionCount(element : Element) : number | undefined {
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
}

const enum CollectMode {
	IgnoreGlobal,
	PrioritizeGlobal,
	OverwriteGlobal,
	Append,
}