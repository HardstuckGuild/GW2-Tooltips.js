//TODO(Rennorb) @issues:
//TODO(Rennorb): Provide a clean way to construct custom tooltips. Currently with the old version we manipulate the cache before the hook function gets called, which really isn't the the best.
//TODO(Rennorb): Option to show whole skill-chain (maybe on button hold)?
//TODO(Rennorb): Stop using these jank custom tags. There is no reason to do so and its technically not legal per html spec.
//TODO(Rennorb): Link minion skills to minion summon skill. might be doable via the species def
//TODO(Rennorb): Defiance break on single effect tooltips.
//TODO(Rennorb): Change anything percent related to use fractions instead of integers (0.2 instead of 20).
// The only thing this is good for is to make drawing the facts easier. Since we do quite a few calculations this swap would reduce conversions quite a bit.
//TODO(Rennorb) @correctness: Split up incoming / outgoing effects. Mostly relevant for healing.
//TODO(Rennorb) @correctness: Change the lookup to first try to figure out the palette and then go from there. this is the way to move forward as this is the future-proof way to list skills.
//TODO(Rennorb) @correctness: implement processing for trait / skill buffs to properly show certain flip skills and chains aswell as properly do trait overrides for skills

//TODO(Rennorb): (maybe) add specific hs output command that produces files outside of the repo to preserve them inside of the parent.

let tooltip : HTMLElement
let lastTooltipTarget : HTMLElement | undefined

let cyclePos    : number = 0
let lastMouseX  : number
let lastMouseY  : number

export const contexts : Context[] = []; //@debug
export let config    : Config = null!;

//TODO(Rennorb) @cleanup: get rid of this
function _constructor() {
	//TODO(Rennorb): Validate config. there are a few places this partially happens but its hard to keep track. Should just happen in one place.
	if(window.GW2TooltipsContext instanceof Array) {
		for(const partialContext of window.GW2TooltipsContext)
			contexts.push(createCompleteContext(partialContext))
	}
	else if(window.GW2TooltipsContext) {
		contexts.push(createCompleteContext(window.GW2TooltipsContext))
	}
	else{
		contexts.push(createCompleteContext({}))
	}

	config = Object.assign({}, DEFAULT_CONFIG, window.GW2TooltipsConfig)
	if(config.apiImpl) APICache.apiImpl = config.apiImpl(APIs);

	tooltip = newElm('div.tooltipWrapper')
	tooltip.style.display = 'none';
	if(document.body)
		document.body.appendChild(tooltip);
	else
		document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tooltip));

	const isMobile = /android|webos|iphone|ipad|ipod|blackberry|bb|playbook|mobile|windows phone|kindle|silk|opera mini/.test(navigator.userAgent.toLowerCase())
	document.addEventListener('mousemove', event => {
		if(isMobile && (Math.abs(event.pageX - lastMouseX) + Math.abs(event.pageY - lastMouseY) > 20)) {
			tooltip.style.display = 'none';
		}

		lastMouseX = event.pageX
		lastMouseY = event.pageY

		if(tooltip.style.display != 'none')
			positionTooltip()
	})
	document.addEventListener('contextmenu', event => {
		const node = findSelfOrParent(event.target as Element, 'gw2object') as HTMLElement;
		if(!node) return;

		//NOTE(Rennorb): the style check is to prevent an initial cycle on mobile
		if(node.classList.contains('cycler') && tooltip.style.display != 'none') {
			event.preventDefault()

			do {
				cyclePos = (cyclePos + 1) % tooltip.childElementCount
			} while(tooltip.children[cyclePos].classList.contains('not-collapsable'))
			activateSubTooltip(cyclePos)
			scrollSubTooltipIntoView(cyclePos, true)
			positionTooltip(true)
		}
		if(isMobile && tooltip.style.display == 'none') {
			event.preventDefault()
			showTooltipFor(node);
			positionTooltip()
		}
	})

	//TODO(Rennorb): this sint very clean,  would like a better solution tbh
	let touch : Touch;
	const scrollHandler = (event : WheelEvent | TouchEvent | { detail : number, preventDefault: VoidFunction }) => {
		if(tooltip.style.display == 'none') return;
		const activeTT = tooltip.children[cyclePos];
		if(activeTT.scrollHeight == activeTT.clientHeight) return;

		event.preventDefault()
		const deltaY = (event as WheelEvent).deltaY || event.detail || (event as TouchEvent).touches[0].clientY - touch.clientY;
		activeTT.scrollBy(0, deltaY);
	}
	const passive = 'onwheel' in window ? { passive: false } : false;
	
	window.addEventListener('DOMMouseScroll', scrollHandler as any, false); // older FF
	window.addEventListener('wheel', scrollHandler, passive)
	window.addEventListener('touchstart', event => {
		touch = event.touches[0];
	})
	window.addEventListener('touchmove', scrollHandler, passive)

	//TODO(Rennorb) @ui
	window.addEventListener('keydown', e => {
		if(e.ctrlKey && e.altKey) {
			if(e.key == 'd') {
				e.preventDefault();
				config.showFactComputationDetail = !config.showFactComputationDetail;
				console.log(`[gw2-tooltips] [cfg] showFactComputationDetail is now ${config.showFactComputationDetail}`);
				if(lastTooltipTarget && tooltip.style.display != 'none') {
					showTooltipFor(lastTooltipTarget, cyclePos); // visibleIndex = cyclePos: keep the same sub-tooltip active
					positionTooltip();
				}
			}
			else if(e.key == 't') {
				e.preventDefault();
				config.showPreciseAbilityTimings = !config.showPreciseAbilityTimings;
				console.log(`[gw2-tooltips] [cfg] showPreciseAbilityTimings is now ${config.showPreciseAbilityTimings}`);
				if(lastTooltipTarget && tooltip.style.display != 'none') {
					showTooltipFor(lastTooltipTarget, cyclePos); // visibleIndex = cyclePos: keep the same sub-tooltip active
					positionTooltip();
				}
			}
		}
	});
}

function activateSubTooltip(tooltipIndex : number) {
	const tooltips = tooltip.children as HTMLCollectionOf<HTMLLegendElement>;

	for(let index = 0; index < tooltips.length; index++) {
		if(!tooltips[index].classList.contains('not-collapsable'))
			tooltips[index].classList.toggle('active', index === tooltipIndex);
	}
}

function scrollSubTooltipIntoView(tooltipIndex : number, animate = false) {
	const tooltips = (tooltip.children as HTMLCollectionOf<HTMLLegendElement>)[tooltipIndex];
	tooltip.style.transition = animate ? 'transform 0.25s' : '';
	tooltip.style.transform = `translate(0, -${tooltips.offsetTop + tooltips.offsetHeight}px)`;
}

//TODO(Rennorb); If the tooltip doesn't fit on screen its probably because we have many and they don't fit even if collapsed.
// In that case we want to fit the currently active one on screen instead of the whole list.
function positionTooltip(animate = false) {
	const wpadminbar = document.getElementById('wpadminbar'); //TODO(Rennorb) @hardcoded: this accounts for the wordpress bar that might exist.
	const topBarHeight = wpadminbar ? wpadminbar.offsetHeight : 0;

	//using actual css margins in js is pain
	const marginX = 22;
	const marginY = 13;
	//some space form the cursor
	const offsetX = 6;
	const offsetY = 6;

	const currentSubTooltip = tooltip.children[cyclePos] as HTMLElement;

	let tooltipXpos = lastMouseX + offsetX;
	if(tooltipXpos + tooltip.offsetWidth > document.documentElement.clientWidth - marginX) {
		tooltipXpos = document.documentElement.clientWidth - (tooltip.offsetWidth + marginX);
	}

	let tooltipYpos = lastMouseY - offsetY;
	if(tooltipYpos - currentSubTooltip.offsetHeight < document.documentElement.scrollTop + topBarHeight + marginY) {
		if(animate) {
			tooltip.style.transition += ', top 0.25s';
			setTimeout(() => tooltip.style.transition = '', 250);
		}
		tooltipYpos = document.documentElement.scrollTop + topBarHeight + marginY + currentSubTooltip.offsetHeight;
	}

	tooltip.style.left = `${tooltipXpos}px`;
	tooltip.style.top  = `${tooltipYpos}px`;
}

type GW2ObjectMap = {
	[k in `${Exclude<V2ObjectType, 'effect' | 'attribute'>}s`] : Map<number, HTMLElement[]>
} & {
	attributes : Map<string, HTMLElement[]>,
}

export async function hookDocument(scope : ScopeElement, _unused? : any) : Promise<GW2ObjectMap> {
	//NOTE(Rennorb): need to use an array since there might be multiple occurrences of the same id in a given scope
	const objectsToGet : GW2ObjectMap = {
		skills         : new Map<number, HTMLElement[]>(),
		traits         : new Map<number, HTMLElement[]>(),
		items          : new Map<number, HTMLElement[]>(),
		specializations: new Map<number, HTMLElement[]>(),
		pets           : new Map<number, HTMLElement[]>(),
		'pvp/amulets'  : new Map<number, HTMLElement[]>(),
		attributes     : new Map<string, HTMLElement[]>(),
	}
	const statsToGet = new Set<number>();
	const _legacy_effectErrorStore = new Set<string>();

	for(const gw2Object of scope.getElementsByTagName('gw2object') as HTMLCollectionOf<HTMLElement>) {
		const stats = +String(gw2Object.getAttribute('stats'));
		if(!isNaN(stats)) statsToGet.add(stats);

		let objId_raw = gw2Object.getAttribute('objId');
		//TODO(Rennorb) @cleanup @compat: this is literally just for naming 'convenience'.
		// Figure out if we can just get rid of the +'s' or if that poses an issue with backwards compat
		let type = (gw2Object.getAttribute('type') || 'skill') + 's' as `${V2ObjectType}s`;

		if(type === 'attributes') {
			if(typeof objId_raw === 'string') {
				const elementsWithThisId = objectsToGet.attributes.get(objId_raw);
				if(elementsWithThisId) elementsWithThisId.push(gw2Object);
				else objectsToGet.attributes.set(objId_raw, [gw2Object]);
			}
		}
		else {
			let objId = +String(objId_raw);

			if(type === 'effects') {
				//NOTE(Rennorb): weapon swaps are completely synthesized
				if(config.legacyCompatibility) {
					type = 'skills';
					objId = _legacy_transformEffectToSkillObject(gw2Object, _legacy_effectErrorStore);
				}
				else {
					continue;
				}
			}

			if(!isNaN(objId) && type in objectsToGet) {
				const elementsWithThisId = objectsToGet[type].get(objId);
				if(elementsWithThisId) elementsWithThisId.push(gw2Object);
				else objectsToGet[type].set(objId, [gw2Object]);
			}
			else {
				continue;
			}
		}

		attachMouseListeners(gw2Object);
	}

	if(_legacy_effectErrorStore.size) {
		console.error("[gw2-tooltips] [legacy-compat] Some effects could not be translated into skills: ", Array.from(_legacy_effectErrorStore));
	}

	if(statsToGet.size > 0) APICache.ensureExistence('itemstats', statsToGet.values());

	await Promise.all(
		(Object.entries(objectsToGet)
		.filter(([key, _]) => key != 'attributes') as [Exclude<keyof typeof objectsToGet, 'attributes'>, Map<number, HTMLElement[]>][])
		.map(async ([key, values]) => {
		if(values.size == 0) return;

		let inflator;
		switch(key) {
			case 'skills'         : inflator = inflateSkill;          break;
			case 'items'          : inflator = inflateItem;           break;
			case 'specializations': inflator = inflateSpecialization; break;
			default               : inflator = inflateGenericIcon;    break;
		}
		const cache = APICache.storage[key];

		await APICache.ensureExistence(key, values.keys())

		for(const [id, objects] of values) {
			const data = cache.get(id);
			if(!objects || !data) continue;

			for(const gw2Object of objects)
				inflator(gw2Object, data as any);
		}
	}));

	return objectsToGet;	
}

export function attachMouseListeners(target : HTMLElement) {
	target.addEventListener('mouseenter', (e) => showTooltipFor(e.target as HTMLElement));
	target.addEventListener('mouseleave', () => {
		tooltip.style.display   = 'none';
		tooltip.style.transform = '';
	});
}

function showTooltipFor(gw2Object : HTMLElement, visibleIndex = 0) {
	const type = ((gw2Object.getAttribute('type') || 'skill') + 's') as `${V2ObjectType}s`;
	const objId = gw2Object.getAttribute('objId')
	let   context = contexts[+String(gw2Object.getAttribute('contextSet')) || 0];
	const statSetId = +String(gw2Object.getAttribute('stats')) || undefined;
	const stackSize = +String(gw2Object.getAttribute('count')) || undefined;

	if(type == 'specializations' || type == 'effects') return; //TODO(Rennorb) @completeness: inline objs

	lastTooltipTarget = gw2Object;

	if(type == 'attributes') {
		if(objId) {
			//TODO(Rennorb): should we actually reset this every time?
			cyclePos = visibleIndex;
			tooltip.replaceChildren(generateAttributeTooltip(objId as BaseAttribute | ComputedAttribute, context));

			tooltip.style.display = ''; //empty value resets actual value to use stylesheet
			for(const tt of tooltip.children) tt.classList.add('active');
			scrollSubTooltipIntoView(cyclePos);
		}
		return;
	}

	const data = APICache.storage[type].get(+String(objId));
	if(data) {
		//TODO(Rennorb): should we actually reset this every time?
		cyclePos = visibleIndex;
		const ogContext = context;
		context = specializeContextFromInlineAttribs(context, gw2Object);
		if('palettes' in data) {
			//NOTE(Rennorb): This is here so we can look at underwater skills from a land context and vice versa.
			if(context.underwater) {
				if(!data.flags.includes('UsableUnderWater') && data.flags.includes('UsableLand')) {
					if(context == ogContext) context = Object.assign({}, context);
					context.underwater = false;
				}
			}
			else if(!context.underwater) {
				if(!data.flags.includes('UsableLand') && data.flags.includes('UsableUnderWater')) {
					if(context == ogContext) context = Object.assign({}, context);
					context.underwater = true;
				}
			}
		}
		tooltip.replaceChildren(...generateToolTipList(data, gw2Object, context, statSetId, stackSize));

		tooltip.style.display = ''; //empty value resets actual value to use stylesheet
		if(Array.from(tooltip.children).filter(tt => !tt.classList.contains('not-collapsable')).length > 1) {
			gw2Object.classList.add('cycler')
			gw2Object.title = 'Right-click to cycle through tooltips'
	
			activateSubTooltip(cyclePos)
		}
		else {
			for(const tt of tooltip.children) tt.classList.add('active');
		}
		scrollSubTooltipIntoView(cyclePos)
	}
}

// TODO(Rennorb) @cleanup: split this into the inflator system aswell. its getting to convoluted already
function generateToolTip(apiObject : SupportedTTTypes, slotName : string | undefined, notCollapsable : boolean, iconMode : IconRenderMode, context : Context, weaponSet? : number) : HTMLElement {
	const headerElements = [];

	if(iconMode == IconRenderMode.SHOW || (iconMode == IconRenderMode.FILTER_DEV_ICONS && !IsDevIcon(apiObject.icon as string | undefined)))
		headerElements.push(newImg(apiObject.icon));

	headerElements.push(
		newElm('teb', fromHTML(GW2Text2HTML(resolveInflections(apiObject.name, 1, context.character)))),
		newElm('div.flexbox-fill'), // split, now the right side
	);

	const currentContextInformation = resolveTraitsAndOverrides(apiObject, context);

	if('flags' in apiObject && (apiObject as API.Item).flags.includes('DisallowUnderwater')) {
		headerElements.push(newImg(ICONS.NO_UNDERWATER, 'iconsmall'));
	}

	if(currentContextInformation.activation) {
		const value = drawFractional(currentContextInformation.activation / 1000, config);
		if (value != '0') { //in case we rounded down a fractional value just above 0
			headerElements.push(newElm('ter',
				value,
				newImg(ICONS.ACTIVATION, 'iconsmall')
			));
		}
	}

	if(currentContextInformation.resource_cost) {
		headerElements.push(newElm('ter',
			String(currentContextInformation.resource_cost),
			//TODO(Rennorb) @correctness: see reaper shroud
			newImg(context.character.profession == 'Revenant' ? ICONS.RESOURCE_REV : ICONS.RESOURCE_THIEF, 'iconsmall')
		));
	}

	if(currentContextInformation.endurance_cost) {
		headerElements.push(newElm('ter',
			String(Math.round(currentContextInformation.endurance_cost)),
			newImg(ICONS.ENDURANCE_COST, 'iconsmall')
		));
	}

	if(currentContextInformation.upkeep_cost) {
		headerElements.push(newElm('ter',
			String(currentContextInformation.upkeep_cost),
			newImg(ICONS.UPKEEP_COST, 'iconsmall')
		));
	}

	if(currentContextInformation.recharge) {
		const value = drawFractional(currentContextInformation.recharge / 1000, config);
		if (value != '0') {
			headerElements.push(newElm('ter',
				value,
				newImg(ICONS.RECHARGE, 'iconsmall')
			));
		}
	}

	if(currentContextInformation.supply_cost) {
		headerElements.push(newElm('ter',
			String(currentContextInformation.supply_cost),
			newImg(ICONS.SUPPLY_COST, 'iconsmall')
		));
	}

	const secondHeaderRow = [];
	{
		if(slotName) secondHeaderRow.push(newElm('tes', `( ${slotName} )`));
		if(weaponSet !== undefined) secondHeaderRow.push(newElm('tes', `( Weapon Set ${weaponSet + 1} )`));
	}

	secondHeaderRow.push(newElm('div.flexbox-fill')); // split, now the right side

	if('override_groups' in apiObject && apiObject.override_groups) {
		const baseContext = new Set<GameMode>(['Pve', 'Pvp', 'Wvw']);
		for(const override of apiObject.override_groups) {
			for(const context of override.context) {
				baseContext.delete(context as GameMode);
			}
		}

		const splits = [Array.from(baseContext), ...apiObject.override_groups.map(o => o.context)]

		const splits_html : string[] = [];
		for(const mode of ['Pve', 'Pvp', 'Wvw'] as GameMode[]) { //loop to keep sorting vaguely correct
			let split;
			for(let i = 0; i < splits.length; i++) {
				if(splits[i].includes(mode)) {
					split = splits.splice(i, 1)[0];
					break;
				}
			}

			if(!split) continue;

			const text = split.join('/');
			if(split.includes(context.gameMode))
				splits_html.push(`<span style="color: var(--gw2-tt-color-text-accent) !important;">${text}</span>`);
			else
				splits_html.push(text);
		}

		secondHeaderRow.push(newElm('tes', '( ', fromHTML(splits_html.join(' | ')), ' )'));
	}

	const parts : HTMLElement[] = [newElm('tet.title', ...headerElements)];
	if(secondHeaderRow.length > 1) parts.push(newElm('tet.detail', ...secondHeaderRow));

	if('description' in apiObject && apiObject.description) {
		parts.push(newElm('p.description', fromHTML(GW2Text2HTML(apiObject.description))))
	}

	if(currentContextInformation.blocks) {
		//NOTE(Rennorb): 690.5 is the midpoint weapon strength for slot skills (except bundles).
		//TODO(Rennorb) @hardcoded @correctness: This value is hardcoded for usage with traits as they currently don't have any pointer that would provide weapon strength information.
		// This will probably fail in some cases where damage facts on traits reference bundle skills (e.g. kits).
		let weaponStrength = 690.5;
		if('palettes' in apiObject) for(const pid of apiObject.palettes) {
			const palette = APICache.storage.palettes.get(pid);
			if(!palette) continue;

			const criteria = context.character.profession
					? ((s : API.SlotGroup) => s.profession === context.character.profession)
					: ((s : API.SlotGroup) => s.profession);

			if(palette.groups.some(criteria)) {
				weaponStrength = getWeaponStrength(palette);
				break;
			}
		}
		parts.push(...generateFacts(currentContextInformation.blocks, weaponStrength, context))
	}

	const tooltip = newElm('div.tooltip', ...parts)
	if(notCollapsable) tooltip.classList.add('not-collapsable')
	tooltip.dataset.id = String(apiObject.id)

	return tooltip;
}

export function resolveTraitsAndOverrides(apiObject : SupportedTTTypes & { blocks? : API.ContextGroup['blocks'], override_groups? : API.ContextInformation['override_groups'] }, context : Context) : API.ContextInformation {
	let override = apiObject.override_groups?.find(g => g.context.includes(context.gameMode));
	let result = Object.assign({}, apiObject, override);
	result.blocks = structuredClone(apiObject.blocks); // always have to clone this because we later on manipulate the facts

	if(!result.blocks) return result;

	if(override?.blocks) {
		const end = Math.max(result.blocks.length, override.blocks.length);
		for(let blockId = 0; blockId < end; blockId++) {
			let baseBlock = result.blocks[blockId];
			const overrideBlock = override.blocks[blockId];
			if (overrideBlock) {
				//NOTE(Rennorb): Don't shortcut a lot of these, even if we only have an override block that may still use the insert logic.
				//TODO(Rennorb) @cleanup: We probably want to add logic on the server to do that processing in that case.
				if(!baseBlock) {
					baseBlock = result.blocks[blockId] = {
						description: overrideBlock.description,
						trait_requirements: overrideBlock.trait_requirements,
					};
				}

				if(!overrideBlock.facts) continue;
				//NOTE(Rennorb): trait restrictions only exist on the (first) base block

				//TODO(Rennorb): description and trait requirements cannot be overridden. so is this the wrong structure then?
				
				const facts = result.blocks[blockId].facts = baseBlock.facts ?? []; // No need to clone here, we already structure cloned the whole thing.
				for(const fact of overrideBlock.facts) {
					if(fact.requires_trait?.some(t => !context.character.traits.includes(t))) continue;

					if(fact.insert_before !== undefined) {
						//this marker is to later on disambiguate between trait and gamemode overrides
						if(fact.skip_next) fact.__gamemode_override_marker = true;
						facts.splice(fact.insert_before, 0, fact);
					}
					else facts.push(fact);
				}
			}
			// else (baseBlock && !overrideBlock) -> we already have the base block in the array
		}
	}

	const finalBlocks = [];
	for(const block of result.blocks) {
		if(block.trait_requirements?.some(t => !context.character.traits.includes(t))) continue;
		
		if(block.facts) {
			const finalFacts = [];
			let to_skip = 0;
			for(let i = 0; i < block.facts.length; i++) {
				const fact = block.facts[i];

				if(fact.requires_trait?.some(t => !context.character.traits.includes(t))) continue;
				if(to_skip-- > 0) continue;

				finalFacts.push(fact);
				
				to_skip = fact.skip_next || 0;
			}

			block.facts = finalFacts;
		}
		finalBlocks.push(block);
	}
	result.blocks = finalBlocks;

	return result;
}

function getWeaponStrength({ weapon_type, type : palette_type } : API.Palette) : number {
	if(!weapon_type) {
		if(palette_type === 'Bundle') {
			return 922.5
		}

		//NOTE(Rennorb): The default value. Im not 100% sure if this is correct in all cases.
		return 690.5
	}
	else {
		return {
			BundleLarge: 0,
			Standard   : 690.5,
			Focus      : 900,
			Shield     : 900,
			Torch      : 900,
			Warhorn    : 900,
			Greatsword : 1100,
			Hammer     : 1100,
			Staff      : 1100,
			BowLong    : 1050,
			Rifle      : 1150,
			BowShort   : 1000,
			Axe        : 1000,
			Sword      : 1000,
			Dagger     : 1000,
			Pistol     : 1000,
			Scepter    : 1000,
			Mace       : 1000,
			Spear      : 1000,
			Speargun   : 1000,
			Trident    : 1000,
		}[weapon_type];
	}
}

function generateToolTipList(initialAPIObject : SupportedTTTypes, gw2Object: HTMLElement, context : Context, statSetId? : number, stackSize? : number) : HTMLElement[] {
	let subiconRenderMode = IconRenderMode.SHOW;
	//NOTE(Rennorb): This is a bit sad, but we have to hide or at least filter icons for skills attached to traits and relics, as those often don't come with actual icons because they never were meant to be seen (they don't show in game).
	if((gw2Object.getAttribute('type') || 'skill') == 'trait') subiconRenderMode = IconRenderMode.FILTER_DEV_ICONS;
	//TODO(Rennorb) @cleanup @stability
	else if(initialAPIObject.name.includes('Relic[s] of')) subiconRenderMode = IconRenderMode.HIDE_ICON;

	const tooltipChain : HTMLElement[] = []
	const adjustTraitedSkillIds = gw2Object.classList.contains('auto-transform');
	let weaponSet : number | undefined = +String(gw2Object.getAttribute('weaponSet')); if(isNaN(weaponSet)) weaponSet = undefined;
	let palette, group, slot : string | undefined = undefined;

	if('palettes' in initialAPIObject) {
		//TODO(Rennorb): cleanup is this necessary? The root element already gets replaced automatically. It would be if we have skills where some skill in the chain needs to be replaced. 
		if(adjustTraitedSkillIds) {
			const replacementSkill = findTraitedOverride(initialAPIObject, context);
			if(replacementSkill) initialAPIObject = replacementSkill;
		}

		//find skillchain
		let i;
		[palette, group, i, context] = guessGroupAndContext(initialAPIObject, context);
		if(group) {
			slot = refineSlotName(palette!, group.slot);
			let candidate = group.candidates[i];

			//in case we catch a chain in the middle
			const insertAtIndex = tooltipChain.length;
			while(candidate.previous_chain_skill_index) {
				const otherCandidate = group.candidates[candidate.previous_chain_skill_index];
				if(!canBeSelected(otherCandidate, context)) break;

				let skill = APICache.storage.skills.get(otherCandidate.skill);
				if(!skill) {
					console.warn(`[gw2-tooltips] Chain skill #${otherCandidate.skill} is missing from the cache. The query was caused by `, gw2Object);
					skill = MISSING_SKILL;
				}

				tooltipChain.splice(insertAtIndex, 0, generateToolTip(skill, slot, false, IconRenderMode.SHOW, context, weaponSet));

				candidate = otherCandidate;
			}
		}

		//now ourself
		tooltipChain.push(generateToolTip(initialAPIObject, slot, false, IconRenderMode.SHOW, context, weaponSet));

		//remaining chain
		for(let j = 0; j < i; j++) {
			const otherCandidate = group!.candidates[j];
			if(otherCandidate.previous_chain_skill_index != i) continue;
			if(!canBeSelected(otherCandidate, context)) continue;

			let skill = APICache.storage.skills.get(otherCandidate.skill);
			if(!skill) {
				console.warn(`[gw2-tooltips] Chain skill #${otherCandidate.skill} is missing from the cache. The query was caused by `, gw2Object);
				skill = MISSING_SKILL;
			}

			tooltipChain.push(generateToolTip(skill, slot, false, IconRenderMode.SHOW, context, weaponSet));

			i = j;
			j = -1;
		}
	}
	else {
		if('type' in initialAPIObject) {
			tooltipChain.push(generateItemTooltip(initialAPIObject, context, gw2Object, statSetId, stackSize));
		}
		else {
			let slotName = undefined;
			if('slot' in initialAPIObject) {
				slotName = initialAPIObject.slot
				if('specialization' in initialAPIObject) (APICache.storage.specializations.get(initialAPIObject.specialization!)?.name || initialAPIObject.specialization!) + ' - ' + slotName;
			}
			tooltipChain.push(generateToolTip(initialAPIObject, slotName, false, IconRenderMode.SHOW, context, weaponSet));
		}
	}

	if('bundle_skills' in initialAPIObject) {
		for(const subSkillId of initialAPIObject.bundle_skills!) {
			const subSkillInChain = APICache.storage.skills.get(subSkillId);
			if(subSkillInChain && canBeUsedOnCurrentTerrain(subSkillInChain, context)) {
				const [palette, group] = guessGroupAndContext(subSkillInChain, context); //@perf
				tooltipChain.push(generateToolTip(subSkillInChain, refineSlotName(palette!, group?.slot), false, IconRenderMode.SHOW, context, weaponSet));
			}
		}
	}
	if('related_skills' in initialAPIObject) {
		const type = gw2Object.getAttribute('type') || 'skill';
		for(const subSkillId of initialAPIObject.related_skills!) {
			const subSkillInChain = APICache.storage.skills.get(subSkillId);
			if(subSkillInChain && canBeUsedOnCurrentTerrain(subSkillInChain, context) && ((type != 'skill') || subSkillInChain.palettes.some(pid => {
				const palette = APICache.storage.palettes.get(pid);
				return palette && VALID_CHAIN_PALETTES.includes(palette.type);
			}))) {
				const [palette, group] = guessGroupAndContext(subSkillInChain, context); //@perf
				tooltipChain.push(generateToolTip(subSkillInChain, refineSlotName(palette!, group?.slot), false, subiconRenderMode, context, weaponSet));
			}
		}
	}
	if('ambush_skills' in initialAPIObject) {
		for(const { id: subSkillId, spec } of initialAPIObject.ambush_skills!) {
			const subSkillInChain = APICache.storage.skills.get(subSkillId);
			if(subSkillInChain && canBeUsedOnCurrentTerrain(subSkillInChain, context) && (!spec || context.character.specializations.includes(spec))) {
				if(!slot) {
					[palette, group] = guessGroupAndContext(subSkillInChain, context);
					slot = refineSlotName(palette!, group?.slot);
				}
				tooltipChain.push(generateToolTip(subSkillInChain, slot, false, subiconRenderMode, context, weaponSet));
				break; // only one ambush skill
			}
		}
	}

	//pet skills
	if('skills' in initialAPIObject) for(const petSkillId of initialAPIObject.skills) {
		let petSkill = APICache.storage.skills.get(petSkillId);
		if(!petSkill) {
			console.warn(`[gw2-tooltips] pet skill #${petSkillId} is missing from the cache. The query was caused by `, gw2Object);
			petSkill = MISSING_SKILL;
		}
		const [palette, group] = guessGroupAndContext(petSkill, context);
		tooltipChain.push(generateToolTip(petSkill, refineSlotName(palette!, group?.slot), true, subiconRenderMode, context, weaponSet));
	}

	tooltip.append(...tooltipChain);
	return tooltipChain
}

function refineSlotName(palette : API.Palette, slot : string | undefined) : string | undefined {
	if(!slot) return undefined;

	if(palette.type == 'Bundle' && slot.includes('_')) {
		return 'Bundle ' + slot.substring(slot.lastIndexOf('_') + 1);
	}

	if(slot.startsWith('Weapon') && palette.weapon_type) {
		return mapLocale(palette.weapon_type) + ' ' + slot.substring(slot.lastIndexOf('_') + 1);
	}

	return slot.replace(/(\S+?)_(\d)/, "$1 $2");
}

function guessGroupAndContext(skill : API.Skill, context : Context) : [API.Palette, API.SlotGroup, number, Context] | [undefined, undefined, -1, Context] {
	let fallback : [API.Palette, API.SlotGroup, number, Context] | undefined = undefined;

	for(const pid of skill.palettes) {
		const palette = APICache.storage.palettes.get(pid);
		if(!palette) {
			console.warn(`[gw2-tooltips] Palette #${pid} is missing from the cache. The query was caused by `, skill);
			continue;
		}
		if(!VALID_CHAIN_PALETTES.includes(palette.type)) continue;

		for(const group of palette.groups) {
			if(context.character.profession && group.profession && group.profession != context.character.profession) continue;

			for(const [i, candidate] of group.candidates.entries()) {
				if(candidate.skill != skill.id) continue;
				// track the first match as a fallback
				if(!fallback) fallback = [palette, group, i, context];
				
				if(canBeSelected(candidate, context)) return [palette, group, i, context];
			}
		}
	}

	if(fallback) {
		fallback[3] = transmuteContext(fallback[1].candidates[fallback[2]], context);
		return fallback;
	}

	// no profession check
	for(const pid of skill.palettes) {
		const palette = APICache.storage.palettes.get(pid);
		if(!palette) continue;
		if(!VALID_CHAIN_PALETTES.includes(palette.type)) continue;

		for(const group of palette.groups) {
			for(const [i, candidate] of group.candidates.entries()) {
				if(candidate.skill == skill.id) return [palette, group, i, transmuteContext(candidate, context)];
			}
		}
	}

	// ultra slow path in case we look at npc stuff. no pallet type filters
	for(const pid of skill.palettes) {
		const palette = APICache.storage.palettes.get(pid);
		if(!palette) continue;

		for(const group of palette.groups) {
			for(const [i, candidate] of group.candidates.entries()) {
				if(candidate.skill == skill.id) return [palette, group, i, transmuteContext(candidate, context)];
			}
		}
	}

	return [undefined, undefined, -1, context];
}

function transmuteContext(targetCandidate : API.SkillInfo, context : Context, clone = true) : Context {
	//cannot structured clone because of the custom elements
	if(clone) {
		const character = Object.assign({}, context.character, { specializations: context.character.specializations.slice(), traits: context.character.traits.slice() });
		context = Object.assign({}, context, { character });
	}
	if(targetCandidate.specialization && !context.character.specializations.includes(targetCandidate.specialization))
		context.character.specializations.push(targetCandidate.specialization);
	if(targetCandidate.trait && !context.character.traits.includes(targetCandidate.trait))
		context.character.traits.push(targetCandidate.trait);
	return context;
};

function canBeSelected(info : API.SkillInfo, context : Context) : boolean {
	return (info.specialization === undefined || context.character.specializations.includes(info.specialization)) &&
		(info.trait === undefined || context.character.traits.includes(info.trait)) &&
		(context.underwater ? info.usability.includes('UsableUnderWater') : info.usability.includes('UsableLand')) &&
		(context.character.level >= (info.min_level || 0))
}

function canBeUsedOnCurrentTerrain(skill : API.Skill, context : Context) : boolean {
	return context.underwater ? skill.flags.includes('UsableUnderWater') : skill.flags.includes('UsableLand')
}

export function findTraitedOverride(skill : API.Skill, context : Context) : API.Skill | undefined {
	for(const pid of skill.palettes) {
		const palette = APICache.storage.palettes.get(pid);
		if(!palette) {
			console.warn(`[gw2-tooltips] Palette #${pid} is missing from the cache. The query was caused by `, skill);
			continue;
		}

		for(const group of palette.groups) {
			if(context.character.profession && group.profession && group.profession != context.character.profession) continue;

			const end = group.candidates.findIndex(c => c.skill == skill.id);
			if(end == -1) continue;

			for(let i = 0; i < end; i++) {
				const candidate = group.candidates[i];
				if(candidate.trait) {
					//TODO(Rennorb): use buffs here
					if(!context.character.traits.includes(candidate.trait)) continue;

					const replacementSkill = APICache.storage.skills.get(candidate.skill);
					if(!replacementSkill) {
						console.error(`[gw2-tooltips] Corrected skill #${candidate.skill} is missing in the cache.`);
						return;
					}
					else {
						console.info(`[gw2-tooltips] Corrected skill #${skill.id} (${skill.name}) to #${replacementSkill.id} (${replacementSkill.name}) because the trait #${candidate.trait} (${APICache.storage.traits.get(candidate.trait)?.name || '<not cached>'}) is active.`);
						//TODO(Rennorb): Add indicator on the skill that its been replaced by a trait.
						return replacementSkill;
					}
				}
			}
		}
	}

	return;
}

function generateItemTooltip(item : API.Item, context : Context, target : HTMLElement, statSetId? : number, stackSize = 1) : HTMLElement {
	let statSet = findCorrectAttributeSet(item, statSetId);

	let slottedItems : API.ItemUpgradeComponent[] | undefined;
	if('slots' in item) {
		slottedItems = target.getAttribute('slotted')?.split(',')
			.map(id => APICache.storage.items.get(+String(id) || 0))
			.filter(i => i && 'subtype' in i) as API.ItemUpgradeComponent[];
	}

	const countPrefix = stackSize > 1 ? stackSize + ' ' : '';
	const upgradeNameSource = slottedItems?.find(i => !['Infusion', 'Enrichment'].includes(i.subtype)) || slottedItems?.[0];
	const name = countPrefix + formatItemName(item, context, statSet, upgradeNameSource, stackSize);
	const parts = [newElm('tet.title', newImg(item.icon),  newElm('teb.gw2-color-rarity-'+item.rarity.toLowerCase(), name), newElm('div.flexbox-fill'))];

	if('defense' in item && item.defense) {
		const defense = (typeof item.defense  == "number")
			? item.defense
			: LUT_DEFENSE[Math.min(100, (item.defense[0] + context.character.level))] * item.defense[1];

		parts.push(newElm('te', newElm('tem', 'Defense: ', newElm('span.gw2-color-stat-green', String(Math.ceil(defense))))));
	}

	if('power' in item) {
		let power;
		if('mul' in item.power) {
			let maxRarity = Rarity.Legendary;
			if(['PlayerLevelScaleRarity', 'ItemScale4'].includes(item.power.scaling!)) {
				//NOTE(Rennorb) @hardcoded: these thresholds are apparently from a config
				     if(context.character.level < 14) maxRarity = Rarity.Common;   // content:Configuration?guid=Wu52xQQYEUWiDdyKv+jf2Q==
				else if(context.character.level < 30) maxRarity = Rarity.Uncommon; // content:Configuration?guid=AX9BmdFkNkuyIpWOz58kmA==
				else if(context.character.level < 60) maxRarity = Rarity.Rare;     // content:Configuration?guid=X6vQWpTe2Ui+LPdJTv560g==
				else if(context.character.level < 80) maxRarity = Rarity.Exotic;   // content:Configuration?guid=W2O5W4HAPEy3GJFfaSt4mQ==
			}

			const rarity = Math.min(Rarity[item.rarity], maxRarity)
			let index = LUT_RARITY[rarity];
			if(!item.power.scaling) //no scaling property means ItemLevel scaling
				index += item.level;
			else { //any of the other three
				index += context.character.level;
			}

			const avg = (context.character.isPlayer ? LUT_POWER_PLAYER : LUT_POWER_MONSTER)[Math.min(100, index)] * item.power.mul * LUT_RARITY_MUL[rarity];
			const spread = avg * item.power.spread;
			power = [Math.ceil(avg - spread), Math.ceil(avg + spread)];
		}
		else {
			power = item.power;
		}

		const line = newElm('tem', 'Weapon Strength: ', newElm('span.gw2-color-stat-green', `${power[0]} - ${power[1]}`));
		if(item.damage_type) line.append(` (${item.damage_type})`);
		parts.push(newElm('te', line));
	}

	if('tiers' in item) {
		parts.push(generateUpgradeItemGroup(item, context));
	}

	if(statSet && 'attribute_base' in item) {
		parts.push(...statSet.attributes.map(({attribute, base_value, scaling}) => {
			const computedValue = Math.round(base_value + item.attribute_base! * scaling);
			return newElm('te', newElm('tem.gw2-color-stat-green', `+${computedValue} ${mapLocale(attribute)}`));
		}));
	}

	if('slots' in item) {
		parts.push(newElm('div.group.slots', ...item.slots.map(s => {
			let slottedItemIdx = -1;
			if(slottedItems) {
				switch(s) {
					case 'Upgrade'   : slottedItemIdx = slottedItems.findIndex(i => ['Rune', 'Sigil', 'Gem'].includes(i.subtype)); break;
					case 'Infusion'  : slottedItemIdx = slottedItems.findIndex(i => i.subtype == 'Infusion'); break;
					case 'Enrichment': slottedItemIdx = slottedItems.findIndex(i => i.subtype == 'Enrichment'); break;
				}
			}

			if(slottedItemIdx > -1) {
				const slottedItem = slottedItems!.splice(slottedItemIdx, 1)[0];
				const group = generateUpgradeItemGroup(slottedItem, context);
				const name = formatItemName(slottedItem, context, statSet);
				group.prepend(newElm('tet', newImg(slottedItem.icon, 'iconsmall'),  newElm('teb.gw2-color-rarity-'+slottedItem.rarity, name), newElm('div.flexbox-fill')));
				return group;
			}
			else {
				return newElm('te',
					newImg(ICONS['SLOT_'+s as keyof typeof ICONS], 'iconsmall'), `Empty ${s} Slot`
				)
			}
		})));
	}

	let descriptionAlreadyShown = false; //idk, maybe i'll change that whole thing in the future.
	if('applies_buff' in item) {
		parts.push(newElm('span', fromHTML(GW2Text2HTML(item.description))));
		parts.push(newElm('div.group', generateFact(item.applies_buff, -1, context, true).wrapper!));
		descriptionAlreadyShown = true;
	}

	const metaInfo = newElm('div.group');
	//NOTE(Rennorb): PvP amulets only show the stats, they aren't real 'items'.
	if(item.type == "Armor" || item.type == "Weapon" || (item.type == "Trinket" && !item.flags.includes('Pvp'))) {
		metaInfo.append(newElm('span.gw2-color-rarity-'+item.rarity, item.rarity));
		if('weight' in item) metaInfo.append(newElm('span', item.weight));
		metaInfo.append(newElm('span', `${item.type}: ${item.subtype}`));
		if(item.type == "Weapon" && isTwoHanded(item.subtype)) metaInfo.append(newElm('span.gw2-color-rarity-Junk', `(Two-Handed)`));
		if(item.required_level) metaInfo.append(newElm('span', 'Required Level: '+item.required_level));
	}
	if(item.description && !descriptionAlreadyShown) metaInfo.append(newElm('span', fromHTML(GW2Text2HTML(item.description))));

	if(!item.flags.includes('Pvp')) { //NOTE(Rennorb): pvp items (runes / sigils) don't show these
		if(item.flags.includes('Unique')) metaInfo.append(newElm('span', 'Unique'));
		if(item.flags.includes('AccountBound')) metaInfo.append(newElm('span', 'Account Bound'));
		if(item.flags.includes('SoulBindOnUse')) metaInfo.append(newElm('span', 'Soulbound on Use'));
		else if(item.flags.includes('SoulBindOnAcquire')) metaInfo.append(newElm('span', 'Soulbound on Acquire'));
	}

	if(!item.flags.includes('NoSalvage')) {
		const salvageOptions = [item.type == 'Consumable' && item.subtype == 'Food'
			? 'Compost'
			: item.rarity == 'Ascended' ? 'Ascended' : 'Standard'
		];
		if(item.flags.includes('SalvageResearch')) salvageOptions.push('Research');
		if(salvageOptions.length) metaInfo.append(newElm('span', 'Salvage: '+salvageOptions.join(', ')));
	}

	if(item.vendor_value) {
		let inner = ['Vendor Value: ', formatCoins(item.vendor_value * stackSize)];
		if(stackSize > 1)
			inner.push(' (', formatCoins(item.vendor_value), ` x ${stackSize})`);
		metaInfo.append(newElm('span', ...inner));
	}

	parts.push(metaInfo);

	const tooltip = newElm('div.tooltip.item.active', ...parts);
	tooltip.dataset.id = String(item.id);
	return tooltip;
}

export function findCorrectAttributeSet(item : API.Item, statSetId? : number) : API.AttributeSet | undefined {
	let statSet : API.AttributeSet | undefined = undefined;
	if(item.type == "Armor" || item.type == "Trinket" || item.type == "Weapon") {
		statSetId = statSetId || item.attribute_set;
		if(statSetId === undefined) console.warn(`[gw2-tooltips] [tooltip engine] Hovering on item without specified or innate stats. Specify the stats by adding 'stats="<stat_set_id>" to the html element.' `);
		else {
			statSet = APICache.storage.itemstats.get(statSetId);
			if(!statSet) console.error(`[gw2-tooltips] [tooltip engine] itemstat #${statSetId} is missing in cache.`);
			else {
				//TODO(Rennorb): should this happen at injection time?
				if(config.adjustIncorrectStatIds && statSet.similar_sets) {
					const correctSetId = statSet.similar_sets[item.subtype];
					if(correctSetId !== undefined) {
						console.info(`[gw2-tooltips] [tooltip engine] Corrected itemstat #${statSetId} to #${correctSetId} because the target is of type ${item.subtype}.`);
						const newSet = APICache.storage.itemstats.get(correctSetId);
						if(!newSet) console.error(`[gw2-tooltips] [tooltip engine] Corrected itemstat #${correctSetId} is missing in the cache.`);
						else statSet = newSet;
					}
				}
			}
		}
	}

	return statSet;
}

function generateUpgradeItemGroup(item : API.ItemUpgradeComponent, context : Context) : HTMLElement {
	const group = newElm('div.group');
	for(const [i, tier] of item.tiers.entries()) {
		let tier_wrap = newElm('te');
		if(tier.description) tier_wrap.append(newElm('span', fromHTML(GW2Text2HTML(tier.description))));

		//NOTE(Rennorb): facts seem to exist, but almost universally be wrong.
		else if(tier.facts) {
			for(const fact of tier.facts) {
				const { wrapper } = generateFact(fact, null as any, context);
				if(wrapper) tier_wrap.append(wrapper);
			}
		}

		else if(tier.modifiers) {
			tier_wrap.style.flexDirection = "column";
			const activeAttributes = getActiveAttributes(context.character);
			for(const modifier of tier.modifiers) {
				//TODO(Rennorb) @cleanup: unify this wth the buf fact processing
				let modifierValue = calculateModifier(modifier, context.character.level, activeAttributes);

				let text;
				if(modifier.flags.includes('FormatPercent')) {
					text = `+${Math.round(modifierValue)}% ${mapLocale(modifier.description as any)}`;
				} else {
					text = `+${Math.round(modifierValue)} ${mapLocale(modifier.description as any)}`;
				}
				tier_wrap.append(newElm('te', text));
			}
		}
		
		const w = newElm('te', tier_wrap);
		if(item.subtype == "Rune") {
			const colorClass = i < (context.character.upgradeCounts[item.id] || 0) ? '.gw2-color-stat-green' : '';
			w.prepend(newElm('span'+colorClass, `(${i + 1})`));
		}
		group.append(w);
	}

	return group;
}

function generateAttributeTooltip(attribute : BaseAttribute | ComputedAttribute, context : Context) : HTMLElement {
	const weaponStats = context.character.statsWithWeapons[context.character.selectedWeaponSet];
	const value = weaponStats.values[attribute];
	let parts = weaponStats.htmlParts[attribute];

	if(['ConditionDuration', 'BoonDuration'].includes(attribute)) {
		parts = parts.slice(); //clone array
		const target_type = attribute === 'ConditionDuration' ? 'Condition' : 'Boon';
		const completeSources = structuredClone(context.character.stats.sources); //todo @cleanup
		for(const [key, mods] of Object.entries(weaponStats.sources)) {
			if(isNaN(+key)) continue;
			((completeSources as any)[key] || ((completeSources as any)[key] = [])).push(...mods);
		}

		//NOTE(Rennorb): -1 because the cap is 200% for duration, but the displayed value is the _additional_ duration, so its a max of +100%.
		const modCap = (getAttributeInformation(attribute, context.character).cap - 1) * 100;
		const activeAttributes = getActiveAttributes(context.character);

		for(const [effect_id, sources] of Object.entries(completeSources)) {
			//NOTE(Rennorb): For simplicity of the remaining library we just eat the performance hit of iterating over the additional props here.
			if(isNaN(+effect_id)) continue;
			const effect = APICache.storage.skills.get(+effect_id);
			if(!effect) {
				console.error(`[gw2-tooltips] [tooltip engine] effect #${effect_id} is missing in cache.`);
				continue;
			}
			if(effect.buff_type !== target_type) continue;

			let specificMod = value * 100;
			let specificParts = [];
			for(const { source, modifier, count } of sources) {
				const mod = calculateModifier(modifier, context.character.level, activeAttributes);
				specificParts.push(newElm('span.detail', `${mod > 0 ? '+' : ''}${n3(mod)}% from ${count > 1 ? `${count} ` : ''}`, fromHTML(resolveInflections(source, count, context.character)))); //TODO(Rennorb) @cleanup: im not really happy with how this works right now. Storing html in the text is not what i like to do but it works for now. Multiple of this.
				specificMod += mod;
			}

			const uncappedMod = specificMod;
			specificMod = Math.min(specificMod, modCap);
			if(uncappedMod != specificMod) {
				specificParts.push(newElm('span.detail.capped', `(Capped to +${n3(specificMod)}%! Uncapped value would be ${n3(uncappedMod)}%)`));
			}

			parts.push(newElm('div.fact',
				newImg(effect.icon),
				newElm('div', newElm('span', `${effect.name}: +${n3(specificMod)}%`), ...specificParts))
			);
		}
	}
	return newElm('div.tooltip.item.active', ...parts);
}

//TODO(Rennorb): have another look at the suffix. might still be missing in the export
/** Does not format inflections if stackSize is < 0. */
export function formatItemName(item : API.Item, context : Context, statSet? : API.AttributeSet, upgradeComponent? : any, stackSize = 1) : string {
	let name;
	if(item.type == 'TraitGuide') {
		name = item.trait;
	}
	else {
		name = item.name;
	}

	let arg1, arg2, arg3, arg4;
	arg1 = arg2 = arg3 = arg4 = '';

	if(!item.flags.includes('HidePrefix' as any)) { //TODO(Rennorb) @correctness: this flag comes from skindef and is currently not properly exported
		if(statSet && statSet.name) {
			arg1 = statSet.name;
			arg2 = " ";
		}
	}

	if(!item.flags.includes('HideSuffix')) {
		if(upgradeComponent && upgradeComponent.suffix) {
			arg4 = upgradeComponent.suffix;
			arg3 = " ";
		}
	}

	name = GW2Text2HTML(name, arg1, arg2, arg3, arg4);
	if(stackSize > -1)
		name = resolveInflections(name, stackSize, context.character);

	if(!item.flags.includes('Pve') && (item.flags.includes('Pvp') || item.flags.includes('PvpLobby')))
		name += " (PvP)";

	return name;
}

//TODO(Rennorb): @docs
export function specializeContextFromInlineAttribs(context : Context, gw2Object : HTMLElement) : Context {
	let traitOverrides = gw2Object.getAttribute('with-traits');
	if(traitOverrides) {
		//NOTE(Rennorb): Cannot use structured clone here because it will fail with the html chunks as those are invalid objects.
		//TODO(Rennorb) @cleanup: get rid of those jank custom tags.
		context = Object.assign({}, context);
		context.character = Object.assign({}, context.character);
		const invalid : string[] = [];
		context.character.traits = traitOverrides.split(',').map(t => {
			const v = +t;
			if(!v) invalid.push(t);
			return v;
		}).filter(t => t);
		if(invalid.length) console.warn("[gw2-tooltips] [tooltip engine] Inline trait-override for element ", gw2Object, " has misformed overrides: ", invalid)
	}
	return context;
}

function formatCoins(amount : number) : HTMLElement {
	const parts = [String(Math.floor(amount % 100)), newImg(ICONS.COIN_COPPER, 'iconsmall', '')];
	if(amount > 99) parts.unshift(String(Math.floor((amount / 100) % 100)), newImg(ICONS.COIN_SILVER, 'iconsmall', ''));
	if(amount > 9999) parts.unshift(String(Math.floor(amount / 1_00_00)), newImg(ICONS.COIN_GOLD, 'iconsmall', ''));
	return newElm('span', ...parts);
}

function isTwoHanded(type : API.WeaponDetailType) {
	switch(type) {
		case 'Axe'         : return false;
		case 'Dagger'      : return false;
		case 'Mace'        : return false;
		case 'Pistol'      : return false;
		case 'Scepter'     : return false;
		case 'Focus'       : return false;
		case 'Sword'       : return false;
		case 'BowShort'    : return false;
		case 'Torch'       : return false;
		case 'Shield'      : return false;
		case 'Warhorn'     : return false;
		case 'Toy'         : return false;
		case 'ToyTwoHanded': return false;
		case 'BundleSmall' : return false;

		case 'Hammer'     : return true;
		case 'BowLong'    : return true;
		case 'Greatsword' : return true;
		case 'Polearm'    : return true;
		case 'Rifle'      : return true;
		case 'Staff'      : return true;
		case 'BundleLarge': return true;
		case 'Spear'      : return true;
		case 'Speargun'   : return true;
		case 'Trident'    : return true;
	}
}

//NOTE(Rennorb): stats are going to be processed separately
export const DEFAULT_CONTEXT : Context = {
	gameMode           : 'Pve',
	underwater         : false,
	targetArmor        : 2597,
	character: {
		level            : 80,
		isPlayer         : true,
		sex              : "Male",
		traits           : [],
		specializations  : [],
		stats: {
			values:  {
				Power            : 0,
				Toughness        : 0,
				Vitality         : 0,
				Precision        : 0,
				Ferocity         : 0,
				ConditionDamage  : 0,
				Expertise        : 0,
				Concentration    : 0,
				HealingPower     : 0,
				AgonyResistance  : 0,
			},
			sources: {
				Power            : [],
				Toughness        : [],
				Vitality         : [],
				Precision        : [],
				Ferocity         : [],
				ConditionDamage  : [],
				Expertise        : [],
				Concentration    : [],
				HealingPower     : [],
				AgonyResistance  : [],
				Armor            : [],
				Damage           : [],
				LifeForce        : [],
				Health           : [],
				HealEffectiveness: [],
				Stun             : [],
				ConditionDuration: [],
				BoonDuration     : [],
				CritChance       : [],
				CritDamage       : [],
			},
		},
		statsWithWeapons: [{
			values: {
				Power            : 1000,
				Toughness        : 1000,
				Vitality         : 1000,
				Precision        : 1000,
				Ferocity         : 0,
				ConditionDamage  : 0,
				Expertise        : 0,
				Concentration    : 0,
				HealingPower     : 0,
				AgonyResistance  : 0,
				Health           : 10000,
				Armor            : 1000,
				CritChance       : 0.05,
				CritDamage       : 1.5,
				ConditionDuration: 0,
				BoonDuration     : 0,
			},
			sources: {
				Power            : [],
				Toughness        : [],
				Vitality         : [],
				Precision        : [],
				Ferocity         : [],
				ConditionDamage  : [],
				Expertise        : [],
				Concentration    : [],
				HealingPower     : [],
				AgonyResistance  : [],
				Armor            : [],
				Damage           : [],
				LifeForce        : [],
				Health           : [],
				HealEffectiveness: [],
				Stun             : [],
				ConditionDuration: [],
				BoonDuration     : [],
				CritChance       : [],
				CritDamage       : [],
			},
			htmlParts: {
				Power            : [],
				Toughness        : [],
				Vitality         : [],
				Precision        : [],
				Ferocity         : [],
				ConditionDamage  : [],
				Expertise        : [],
				Concentration    : [],
				HealingPower     : [],
				AgonyResistance  : [],
				Armor            : [],
				Health           : [],
				ConditionDuration: [],
				BoonDuration     : [],
				CritChance       : [],
				CritDamage       : [],
			},
		}],
		selectedWeaponSet: 0,
		upgradeCounts: {},
	},
}

function createCompleteContext(partialContext : PartialContext) : Context {
	if(partialContext.gameMode == "Pvp" && partialContext.character?.level && partialContext.character?.level != 80) {
		console.error('[gw2-tooltips] [init] supplied (partial) context has its gamemode set to pvp, but has a character level specified thats other than 80. In pvp you are always level 80. This will lead to unexpected results; Remove the explicit level or change the gamemode. The (partial) context in question is: ', partialContext);
	}

	const stats = createCompletedBaseStats(partialContext.character?.stats);
	const upgradeCounts = Object.assign({}, partialContext.character?.upgradeCounts);
	const statsWithWeapons = partialContext.character?.statsWithWeapons?.map(s => createCompletedStats(s)) || [createCompletedStats()];
	const character = Object.assign({}, DEFAULT_CONTEXT.character, partialContext.character, { stats, upgradeCounts, statsWithWeapons, traits: [], specializations: [] });
	return Object.assign({}, DEFAULT_CONTEXT, partialContext, { character });
}

export function createCompletedBaseStats(partialSource : PartialR<BaseStats> = {}) : BaseStats {
	const values = Object.assign({}, DEFAULT_CONTEXT.character.stats.values, partialSource.values);
	const sources = Object.assign({}, structuredClone(DEFAULT_CONTEXT.character.stats.sources), partialSource.sources);
	return { values, sources };
}
export function createCompletedStats(partialSource : PartialR<BaseAndComputedStats> = {}) : BaseAndComputedStats {
	const values = Object.assign({}, DEFAULT_CONTEXT.character.statsWithWeapons[0].values, partialSource.values);
	const sources = Object.assign({}, structuredClone(DEFAULT_CONTEXT.character.statsWithWeapons[0].sources), partialSource.sources);
	const htmlParts = Object.assign({}, structuredClone(DEFAULT_CONTEXT.character.statsWithWeapons[0].htmlParts), partialSource.htmlParts);
	return { values, sources, htmlParts };
}

const DEFAULT_CONFIG : Config = {
	autoInitialize                  : true,
	autoCollectRuneCounts           : true,
	autoCollectStatSources          : true,
	autoCollectSelectedTraits       : true,
	autoRecomputeCharacterAttributes: true,
	adjustIncorrectStatIds          : true,
	autoInferEquipmentUpgrades      : true,
	autoInferWeaponSetAssociation   : true,
	legacyCompatibility             : true,
	showPreciseAbilityTimings       : false,
	showFactComputationDetail       : false,
}

enum Rarity { Junk, Basic, Common, Uncommon, Rare, Exotic, Ascended, Legendary }
const LUT_RARITY = [ 0, 0, 1, 2, 3, 4, 4, 4 ];
const LUT_RARITY_MUL = [ 0.5, 0.65, 0.8, 0.85, 0.9, 1.0, 1.05, 1.05 ];

export const ICONS = {
	COIN_COPPER     : 156902,
	COIN_SILVER     : 156907,
	COIN_GOLD       : 156904,
	//NOTE(Rennorb): lower case to make it compatible with the enum
	SLOT_Upgrade    : 517197,
	SLOT_Infusion   : 517202,
	SLOT_Enrichment : 517204,

	RESOURCE_THIEF  : 156649,
	RESOURCE_REV    : 156647,
	UPKEEP_COST     : 156058,
	SUPPLY_COST     : 2111003,
	ENDURANCE_COST  : 156649,
	NO_UNDERWATER   : 358417,
	RECHARGE        : 156651,
	ACTIVATION      : 496252,
	RANGE           : 156666,
	DEFIANCE_BREAK  : 1938788,
	WEAPON_SWAP     : 156583,
	BARRIER         : 1770209,
	STUN_BREAK      : 156654,
	KNOCKDOWN       : 2440716,
	PULL            : 2440717,
	KNOCKBACK       : 2440715,
	LAUNCH          : 2440712,
	FLOAT           : 2440713,
	SINK            : 2440714,
}

const VALID_CHAIN_PALETTES = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard', 'Equipment'];


type SupportedTTTypes = API.Skill | API.Trait | API.ItemAmulet | API.Pet | API.Item; //TODO(Rennorb): change pet


_constructor();
if(config.autoInitialize) {
	const buildNodes = document.getElementsByClassName('gw2-build-wrapper');
	if(config.autoCollectSelectedTraits) {
		if(buildNodes.length) for(const target of buildNodes)
			Collect.allTraits(target)
		else {
			console.warn("[gw2-tooltips] [collect] `config.autoCollectSelectedTraits` is active, but no element with class `gw2-build` could be found to use as source. Build information will not be collected as there is no way to tell which objects belong to the build definition and which ones are just in some arbitrary text.");
		}
	}

	hookDocument(document)
		.then(gw2Objects => {
			if(config.autoInferWeaponSetAssociation) {
				for(const buildNode of buildNodes) {
					for(const [i, setNode] of buildNode.querySelectorAll('.weapon-set').entries()) {
						for(const objNode of setNode.getElementsByTagName('GW2OBJECT'))
							objNode.setAttribute('weaponSet', String(i));
					}
					
					const skillIdsBySet = [];
					for(const [i, setSkillsNode] of buildNode.querySelectorAll('.skills-weapon-set').entries()) {
						const skillIds : number[] = [];
						const chainIds = (skill : API.Skill, context : Context, adjustTraitedSkillIds : boolean) => {
							if(adjustTraitedSkillIds) {
								const replacementSkill = findTraitedOverride(skill, context);
								if(replacementSkill) skill = replacementSkill;
							}

							skillIds.push(skill.id);

							let palette, group, i;
							[palette, group, i, context] = guessGroupAndContext(skill, context);
							if(group) {
								let candidate = group.candidates[i];
				
								//in case we catch a chain in the middle
								while(candidate.previous_chain_skill_index) {
									const otherCandidate = group.candidates[candidate.previous_chain_skill_index];
									if(!canBeSelected(otherCandidate, context)) break;

									skillIds.push(otherCandidate.skill);

									candidate = otherCandidate;
								}
								//remaining chain
								for(let j = 0; j < i; j++) {
									const otherCandidate = group.candidates[j];
									if(otherCandidate.previous_chain_skill_index != i) continue;
									if(!canBeSelected(otherCandidate, context)) continue;
				
									skillIds.push(otherCandidate.skill);
				
									i = j;
									j = -1;
								}
							}

							if(skill.bundle_skills) for(const subSkillId of skill.bundle_skills) {
								const subSkillInChain = APICache.storage.skills.get(subSkillId);
								if(subSkillInChain)
									skillIds.push(subSkillId);
							}
							if(skill.related_skills) for(const subSkillId of skill.related_skills) {
								const subSkillInChain = APICache.storage.skills.get(subSkillId);
								if(subSkillInChain && subSkillInChain.palettes.some(pid => {
									const palette = APICache.storage.palettes.get(pid);
									return palette && VALID_CHAIN_PALETTES.includes(palette.type);
								})) {
									skillIds.push(subSkillId);
								}
							}
							if(skill.ambush_skills) for(const { id: subSkillId } of skill.ambush_skills) {
								const subSkillInChain = APICache.storage.skills.get(subSkillId);
								if(subSkillInChain)
									skillIds.push(subSkillId);
							}
						}
		
						for(const objNode of setSkillsNode.children) {
							objNode.setAttribute('weaponSet', String(i));
		
							const skill = APICache.storage.skills.get(+String(objNode.getAttribute('objid'))!);
							const context = contexts[+String(objNode.getAttribute('contextSet')) || 0];
							const adjustTraitedSkillIds = objNode.classList.contains('auto-transform');
							if(skill) chainIds(skill, context, adjustTraitedSkillIds);
							else {
								console.warn("[gw2-tooltips] [collect] failed to find skill for object ", objNode);
							}
						}
						skillIdsBySet.push(skillIds);
					}
		
					//only run do this charade if there are actually multiple different weapon sets
					if(skillIdsBySet.length > 1 && (skillIdsBySet[0][0] != skillIdsBySet[1][0] || skillIdsBySet[0][skillIdsBySet[0].length - 1] != skillIdsBySet[1][skillIdsBySet[1].length - 1])) {
						console.info("[gw2-tooltips] [collect] Will mark the following skills as belonging to weapon sets: ", skillIdsBySet);
						const descriptionNode = buildNode.parentElement!.nextElementSibling?.nextElementSibling as HTMLElement;
						if(descriptionNode) for(const skillNode of descriptionNode.querySelectorAll('gw2object[type=skill]')) {
							const id = +String(skillNode.getAttribute('objid')) || 0;
							if(id) for(const [i, skills] of skillIdsBySet.entries()) {
								if(skills.includes(id)) skillNode.setAttribute('weaponSet', String(i));
							}
						}
					}
				}
			}

			//TODO(Rennorb) @cleanup: those routines could probably be combined into one when both options are active
			if(config.autoCollectRuneCounts) {
				//TODO(Rennorb) @correctness: this might not work properly with multiple builds on one page
				if(buildNodes.length) for(const target of buildNodes)
					Collect.allUpgradeCounts(target)
				else {
					console.warn("[gw2-tooltips] [collect] `config.autoCollectRuneCounts` is active, but no element with class `gw2-build` could be found to use as source. Upgrades will not be collected as there is no way to tell which upgrades belongs to the build and which ones are just in some arbitrary text.");
				}
			}

			if(config.autoCollectStatSources) {
				if(buildNodes.length) for(const target of buildNodes)
					Collect.allStatSources(target)
				else {
					console.warn("[gw2-tooltips] [collect] `config.autoCollectStatSources` is active, but no element with class `gw2-build` could be found to use as source. Build information will not be collected as there is no way to tell which objects belong to the build definition and which ones are just in some arbitrary text.");
				}
			}

			if(config.autoCollectSelectedTraits) {
				Collect.traitEffects(contexts);
			}

			if(config.autoInferEquipmentUpgrades) {
				const targets = document.querySelectorAll('.weapon, .armor, .trinket');
				if(targets.length)
					inferItemUpgrades(targets)
				else {
					console.warn("[gw2-tooltips] [collect] `config.autoInferEquipmentUpgrades` is active, but no wrapper elements element with class `'weapon`, `armor` or `trinket` could be found to use as source. No elements will be updated");
				}
			}

			if(config.autoRecomputeCharacterAttributes) {
				for(const context of contexts) {
					for(const weaponSetId of context.character.statsWithWeapons.keys()) {
						recomputeAttributesFromMods(context, weaponSetId);
					}
				}
			}

			//TODO(Rennorb) @cleanup: this will not be triggered by hook document which is technically not correct.
			// But for this to work is has to happen after the collect logic, which is not quite as easy to do.
			// Maybe a good approach would be to slice hook document into stages that can be enabled / disabled. This would also fix some config options only working with autoInit = true.
			for(const [attribute, elements] of gw2Objects.attributes) {
				for(const element of elements) {
					inflateAttribute(element, attribute as BaseAttribute | ComputedAttribute);
				}
			}
		})
}

import { newElm, newImg, GW2Text2HTML, mapLocale, drawFractional, fromHTML, findSelfOrParent, n3, resolveInflections, IconRenderMode, IsDevIcon } from './TUtilsV2';
import * as APIs from './API';
import APICache from './APICache';
import { MISSING_SKILL, calculateModifier, generateFact, generateFacts } from './FactsProcessor';
import * as Collect from './Collect'; //TODO(Rennorb) @cleanup
import { _legacy_transformEffectToSkillObject, inferItemUpgrades, inflateAttribute, inflateGenericIcon, inflateItem, inflateSkill, inflateSpecialization } from './Inflators'
import { LUT_DEFENSE, LUT_POWER_MONSTER, LUT_POWER_PLAYER, getActiveAttributes, getAttributeInformation, recomputeAttributesFromMods } from './CharacterAttributes'

