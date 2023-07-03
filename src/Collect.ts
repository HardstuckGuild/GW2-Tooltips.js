class Collect {
	static allRuneCounts(contexts : Context[], scope : ScopeElement, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		const elements = scope.getElementsByTagName('gw2object');
		for(const pair of contexts.entries()) {
			const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) == pair[0]);
			this._runeCounts(...pair, elsInCorrectCtx, mode);
		}
		const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) >= contexts.length);
		if(elsWithWrongCtx.length) {
			console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
		}
	}
	static specificRuneCounts(contextIndex : number, targetContext : Context, scope : ScopeElement, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		this._runeCounts(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
	}
	static _runeCounts(contextIndex : number, targetContext : Context, elements : Iterable<Element>, mode : CollectMode = CollectMode.PrioritizeGlobal) {
		const counts : Record<number, number> = {};
		for(const element of elements) {
			let id;
			if(element.getAttribute('type') !== 'item' || !(id = +String(element.getAttribute('objid')))) continue;

			const item = APICache.storage.items.get(id);
			if(!item || !('subtype' in item) || item.subtype !== 'Rune') continue;

			counts[item.id] = (counts[item.id] || 0) + 1;
		}

		switch(mode) {
			case CollectMode.IgnoreGlobal: targetContext.character.runeCounts = counts; break
			case CollectMode.Append: targetContext.character.runeCounts = Object.assign(targetContext.character.runeCounts, counts); break;

			case CollectMode.PrioritizeGlobal: {
				if(window.GW2TooltipsContext instanceof Array) {
					targetContext.character.runeCounts = Object.assign(counts, window.GW2TooltipsContext[contextIndex].character?.runeCounts);
				}
				else if(window.GW2TooltipsContext) {
					targetContext.character.runeCounts = Object.assign(counts, window.GW2TooltipsContext.character?.runeCounts);
				}
				else {
					targetContext.character.runeCounts = counts;
				}
			} break

			case CollectMode.OverwriteGlobal: {
				if(window.GW2TooltipsContext instanceof Array) {
					targetContext.character.runeCounts = Object.assign({}, window.GW2TooltipsContext[contextIndex].character?.runeCounts, counts);
				}
				else if(window.GW2TooltipsContext) {
					targetContext.character.runeCounts = Object.assign({}, window.GW2TooltipsContext.character?.runeCounts, counts);
				}
				else {
					targetContext.character.runeCounts = counts;
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
		let upgrades : Record<number, number> = Object.assign({}, targetContext.character.runeCounts);
		for(const element of elements) {
			let id;
			if(element.getAttribute('type') !== 'item' || !(id = +String(element.getAttribute('objid')))) continue;

			const item = APICache.storage.items.get(id);
			if(!item || !('subtype' in item)) continue;
			
			if(item.type === 'UpgradeComponent') {
				//NOTE(Rennorb): We count additional runes, but ignore those over the sensible amount.
				const tierNumber = upgrades[item.id] = (upgrades[item.id] || 0) + 1;
				let tier;
				if(item.subtype === 'Rune') {
					if(tierNumber > 6) {
						//NOTE(Rennorb): Only complain if we are manually counting runes. 
						//TODO(Rennorb) @correctness: Is this the right way to do it? should we just complain when runes are specified but we find one that isn't?
						if(!targetContext.character.runeCounts[item.id])
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