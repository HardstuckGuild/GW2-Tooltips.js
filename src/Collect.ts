class Collect {
	static allUpgradeCounts(contexts : Context[], scope : ScopeElement, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		const elements = scope.getElementsByTagName('gw2object');
		for(const pair of contexts.entries()) {
			const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) == pair[0]);
			this._upgradeCounts(...pair, elsInCorrectCtx, mode);
		}
		//TODO(Rennorb): rethink this or at least make it uniform
		const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) >= contexts.length);
		if(elsWithWrongCtx.length) {
			console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
		}
	}
	static specificUpgradeCounts(contextIndex : number, targetContext : Context, scope : ScopeElement, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		this._upgradeCounts(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
	}
	static _upgradeCounts(contextIndex : number, targetContext : Context, elements : Iterable<Element>, mode : CollectMode) {
		const counts : Character['upgradeCounts'] = {
			Rune   : {},
			Default: {},
		};

		for(const element of elements) {
			let id;
			if(element.getAttribute('type') !== 'item' || !(id = +String(element.getAttribute('objid')))) continue;

			const item = APICache.storage.items.get(id);
			if(!item || !('subtype' in item) || (item.subtype != 'Rune' && item.subtype != 'Default')) continue;

			let amountToAdd = 1;

			if(item.subtype == "Default") {
				if(!(amountToAdd = +String(element.getAttribute('count')))) { // modern version just has the item count as attribute

					if(window.gw2tooltips.config.legacyCompatibility) {
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
							continue
						}
						amountToAdd = +String(amountEl.textContent?.match(/\d+/)?.[0]);
						if(!amountToAdd) {
							console.warn("[gw2-tooltips] [collect] [legacyCompatibility] Amount element ", amountEl, " for infusion element ", element, " did not contain any readable amount. Will not assume anything and just ignore the stack.");
							continue
						}
						if(amountToAdd < 1 || amountToAdd > 20) {
							console.warn("[gw2-tooltips] [collect] [legacyCompatibility] Amount element ", amountEl, " for infusion element ", element, " did got interpreted as x", amountToAdd, " which is outside of the range of sensible values (amount in [1...20]). Will not assume anything and just ignore the stack.");
							continue
						}
					}
				}

				if(!amountToAdd) {
					console.warn("[gw2-tooltips] [collect] Could not figure how many infusions to add for sourceElement ", element, ". Will not assume anything and just ignore the stack.");
							continue
				}
			}

			counts[item.subtype][item.id] = (counts[item.subtype][item.id] || 0) + amountToAdd;
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
			const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) == pair[0]);
			this._statSources(...pair, elsInCorrectCtx, mode);
		}
		const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) >= contexts.length);
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
		};

		//NOTE(Rennorb): We use the existing rune count if given.
		let upgrades = Object.assign({
			Default: {} as Record<number, number>,
			Sigil  : {} as Record<number, number>,
			Gem    : {} as Record<number, number>,
			Rune   : {} as Record<number, number>,
		}, targetContext.character.upgradeCounts);

		for(const element of elements) {
			let id;
			if(element.getAttribute('type') !== 'item' || !(id = +String(element.getAttribute('objid')))) continue;

			const item = APICache.storage.items.get(id);
			if(!item || !('subtype' in item)) continue;
			
			if(item.type === 'UpgradeComponent') {
				//NOTE(Rennorb): We count additional runes, but ignore those over the sensible amount.
				const tierNumber = upgrades[item.subtype][item.id] = (upgrades[item.subtype][item.id] || 0) + 1;
				let tier;
				if(item.subtype === 'Rune') {
					//TODO(Rennorb) @bug: this doesn't work if the runes are already collected / manually set. its already at 6 in that case and the value isn't properly processed.
					if(tierNumber > 6) {
						//NOTE(Rennorb): Only complain if we are manually counting runes. 
						//TODO(Rennorb) @correctness: Is this the right way to do it? should we just complain when runes are specified but we find one that isn't?
						if(!targetContext.character.upgradeCounts.Rune[item.id])
							console.warn("[gw2-tooltips] [collect] Found more than 6 runes of the same type. Here is the 7th rune element: ", element);
						continue;
					}
					tier = item.tiers[tierNumber - 1];
				}
				else {
					if(item.subtype === 'Sigil' && tierNumber > 1) {
						//NOTE(Rennorb): We only process one sigil, since sigils are unique, but we start complaining at the third identical one since there might be the same sigil twice for different sets.
						//TODO(Rennorb) @correctness: how to handle asymmetric sets? Right now we would assume all unique sigils are active at once, so if you do [A, B] [B, C] then A, B, C would be considered active.
						if(tierNumber > 2)
							console.warn("[gw2-tooltips] [collect] Found more than 2 sigils of the same type. Here is the 3th sigil element: ", element);
						continue;
					}
					tier = item.tiers[0];
				}


				if(tier.modifiers) for(const mod of tier.modifiers!) {
					if(!mod.attribute) continue;

					const amount = FactsProcessor.calculateModifier(mod, targetContext.character);
					const type = mod.flags.includes('FormatPercent') ? 'Percent' : 'Flat';
					sources[TUtilsV2.Uncapitalize(mod.attribute)].push({ amount, type, source: item.name })
				}
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

			for(const [attrib, sources] of Object.entries(targetContext.character.statSources)) {
				let value = baseStats[attrib];
				for(const { amount, source } of sources.filter(s => s.type === "Flat")) {
					value += amount;
					console.log(`[gw2-tooltips] [collect] ${source}: ${attrib} + ${amount} = ${value}`)
				}
				for(const { amount, source } of sources.filter(s => s.type === "Percent")) {
					value *= amount;
					console.log(`[gw2-tooltips] [collect] ${source}: ${attrib} * ${amount} = ${value}`)
				}
				targetContext.character.stats[attrib] = value;
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