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
}

const enum CollectMode {
	IgnoreGlobal,
	PrioritizeGlobal,
	OverwriteGlobal,
	Append,
}