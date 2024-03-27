//TODO(Rennorb): Provide a clean way to construct custom tooltips. Currently with the old version we manipulate the cache before the hook function gets called, which really isn't the the best.
//TODO(Rennorb): Defiance break on single effect tooltips.
//TODO(Rennorb): Change anything percent related to use fractions instead of integers (0.2 instead of 20).
// The only thing this is good for is to make drawing the facts easier. Since we do quite a few calculations this swap would reduce conversions quite a bit.
//TODO(Rennorb) @correctness: Split up incoming / outgoing effects. Mostly relevant for healing.
//TODO(Rennorb) @correctness: implement processing for trait / skill buffs to properly show certain flip skills and chains aswell as properly do trait overrides for skills

export const VERSION = 0;

let tooltip : HTMLElement
let lastTooltipTarget : HTMLElement | undefined

let cyclePos    : number = 0
let lastMouseX  : number
let lastMouseY  : number

export const contexts : Context[] = []; //@debug
export let config    : Config = null!;


function activateSubTooltip(tooltipIndex : number) {
	const tooltips = tooltip.children as HTMLCollectionOf<HTMLLegendElement>;

	for(let index = 0; index < tooltips.length; index++) {
		tooltips[index].classList.toggle('active', index === tooltipIndex);
	}
}

function scrollSubTooltipIntoView(tooltipIndex : number, animate = false) {
	const tooltips = (tooltip.children as HTMLCollectionOf<HTMLLegendElement>)[tooltipIndex];
	tooltip.style.transition = animate ? 'transform 0.25s' : '';
	tooltip.style.transform = `translate(0, -${tooltips.offsetTop + tooltips.offsetHeight}px)`;
}

//NOTE(Rennorb): If the tooltip doesn't fit on screen its probably because we have many and they don't fit even if collapsed.
// In that case we fit the currently active one on screen instead of the whole list.
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
	[k in `${Exclude<V2ObjectType, 'attribute'>}s`] : Map<APIResponseTypeMap[k]['id'], HTMLElement[]>
} & {
	attributes : Map<string, HTMLElement[]>,
}

export async function hookDocument(scope : ScopeElement, _unused? : any) : Promise<GW2ObjectMap> {
	const buildNodes = document.getElementsByClassName('gw2-build-wrapper');
	if(config.autoCollectSelectedTraits) {
		if(buildNodes.length) for(const target of buildNodes)
			Collect.allTraits(target)
		else {
			console.warn("[gw2-tooltips] [collect] `config.autoCollectSelectedTraits` is active, but no element with class `gw2-build` could be found to use as source. Build information will not be collected as there is no way to tell which objects belong to the build definition and which ones are just in some arbitrary text.");
		}
	}

	const gw2Objects = await hookDOMSubtreeSlim(scope);

	if(config.autoInferWeaponSetAssociation) {
		for(const buildNode of buildNodes) {
			for(const [i, setNode] of buildNode.querySelectorAll('.weapon-set').entries()) {
				for(const objNode of setNode.getElementsByTagName('GW2OBJECT'))
					objNode.setAttribute('weapon-set', String(i));
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
					objNode.setAttribute('weapon-set', String(i));

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
						if(skills.includes(id)) skillNode.setAttribute('weapon-set', String(i));
					}
				}
			}
		}
	}

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

	for(const { character } of contexts) {
		Collect.hoistGeneralSources(character);
	}

	if(config.autoRecomputeCharacterAttributes) {
		for(const context of contexts) {
			for(const weaponSetId of context.character.statsWithWeapons.keys()) {
				recomputeAttributesFromMods(context, weaponSetId);
			}
		}
	}

	for(const [attribute, elements] of gw2Objects.attributes) {
		for(const element of elements) {
			inflateAttribute(element, attribute as BaseAttribute | ComputedAttribute);
		}
	}

	return gw2Objects;
}

/**
 * Does **NOT** run any auto-processing functions. Also does not inflate attribute elements, as those might depend on attribute recalculation.
 * Use `hookDocument` if you want a convenient way to hook large trees and apply all auto-procs, or run the procs you want yourself. 
 */
export async function hookDOMSubtreeSlim(scope : ScopeElement) : Promise<GW2ObjectMap> {
	//NOTE(Rennorb): need to use an array since there might be multiple occurrences of the same id in a given scope
	const objectsToGet : GW2ObjectMap = {
		skills         : new Map<number, HTMLElement[]>(),
		traits         : new Map<number, HTMLElement[]>(),
		items          : new Map<number, HTMLElement[]>(),
		specializations: new Map<number, HTMLElement[]>(),
		pets           : new Map<number, HTMLElement[]>(),
		'pvp/amulets'  : new Map<number, HTMLElement[]>(),
		skins          : new Map<number, HTMLElement[]>(),
		attributes     : new Map<string, HTMLElement[]>(),
		professions    : new Map<ProfessionId, HTMLElement[]>(),
	}
	const statsToGet = new Set<number>();
	const _legacy_effectErrorStore = new Set<string>();

	for(const gw2Object of scope.getElementsByTagName('gw2object') as HTMLCollectionOf<HTMLElement>) {
		const stats = +String(gw2Object.getAttribute('stats'));
		if(!isNaN(stats)) statsToGet.add(stats);

		let objIdRaw = gw2Object.getAttribute('objId');
		if(objIdRaw == null) continue;

		//TODO(Rennorb) @cleanup: this is literally just for naming 'convenience'. 
		// Unfortunately i don't think we can get rid of this as the api eps use plural forms. allow singular forms on the api side to get rid of this? 
		let type = (gw2Object.getAttribute('type') || 'skill') + 's' as `${V2ObjectType | LegacyCompat.ObjectType}s`;


		if(type === 'attributes') {
			if(objIdRaw != null) {
				const elementsWithThisId = objectsToGet.attributes.get(objIdRaw);
				if(elementsWithThisId) elementsWithThisId.push(gw2Object);
				else objectsToGet.attributes.set(objIdRaw, [gw2Object]);
			}
		}
		else {
			let objId : number | string = +objIdRaw;

			if(type === 'effects') {
				//NOTE(Rennorb): weapon swaps are completely synthesized
				if(config.legacyCompatibility) {
					type = 'skills';
					objId = transformEffectToSkillObject(gw2Object, _legacy_effectErrorStore);
				}
				else {
					continue;
				}
			}

			if((!isNaN(objId) && type in objectsToGet) || (type == 'professions' && (objId = objIdRaw[0].toUpperCase() + objIdRaw.slice(1) /* TODO @cleanup */), PROFESSIONS.includes(objId))) {
				const map : Map<APIObjectId, HTMLElement[]> = objectsToGet[type];
				const elementsWithThisId = map.get(objId);
				if(elementsWithThisId) elementsWithThisId.push(gw2Object);
				else map.set(objId, [gw2Object]);

				const inlineTraits = gw2Object.getAttribute('with-traits');
				if(inlineTraits) {
					for(const traitStr of inlineTraits.split(',')) {
						const traitId = +traitStr;
						if(!traitId) continue;

						//NOTE(Rennorb): Don't add the element for inflating, just create the key so it gets cached.
						if(!objectsToGet.traits.has(traitId)) objectsToGet.traits.set(traitId, []);
					}
				}

				let inlineSkinId;
				if(type == 'items' && !isNaN(inlineSkinId = +String(gw2Object.getAttribute('skin')))) {
					//NOTE(Rennorb): Don't add the element for inflating, just create the key so it gets cached.
					if(!objectsToGet.skins.has(inlineSkinId)) objectsToGet.skins.set(inlineSkinId, []);
				}
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

	if(statsToGet.size > 0) APICache.ensureExistence('itemstats', statsToGet.values(), config.validateApiResponses);

	await Promise.all(Object.entries(objectsToGet as Omit<typeof objectsToGet, 'attributes'>).map(async ([key, values]) => {
		if(values.size === 0 || key as any === 'attributes') return;

		let inflator;
		switch(key) {
			case 'skills'         : inflator = inflateSkill;          break;
			case 'items'          : inflator = inflateItem;           break;
			case 'specializations': inflator = inflateSpecialization; break;
			case 'professions'    : inflator = inflateProfession;     break;
			default               : inflator = inflateGenericIcon;    break;
		}
		const cache : Map<APIObjectId, APIResponse> = APICache.storage[key];

		await APICache.ensureExistence(key, values.keys(), config.validateApiResponses)

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
	target.addEventListener('mouseenter', (e) => showTooltipOn(e.target as HTMLElement));
	target.addEventListener('mouseleave', hideTooltip);
}

export function hideTooltip() {
	tooltip.style.display   = 'none';
	tooltip.style.transform = '';
}

function showTooltipOn(element : HTMLElement, visibleIndex = 0) {
	const type = (element.getAttribute('type') || 'skill') as V2ObjectType | LegacyCompat.ObjectType;
	if(type == 'specialization' || type == 'effect' || type == 'profession') return;

	let objId  : number | BaseAttribute | ComputedAttribute;
	let params : AttributeParams | TooltipParams;
	
	const objIdRaw = String(element.getAttribute('objId'));
	let context = contexts[+String(element.getAttribute('contextSet')) || 0];
	if(type === 'attribute') {
		objId = objIdRaw as BaseAttribute | ComputedAttribute;
		params = { type };
	}
	else {
		context = specializeContextFromInlineAttribs(context, element);
		objId = +objIdRaw;
		let weaponSet : number | undefined = +String(element.getAttribute('weapon-set')); if(isNaN(weaponSet)) weaponSet = undefined;

		if(type === 'item' || type === 'skin') {
			params = { type, weaponSet, element,
				statSetId   : +String(element.getAttribute('stats')) || undefined,
				stackSize   : +String(element.getAttribute('count')) || undefined,
				slottedItems: element.getAttribute('slotted')?.split(',')
					.map(id => APICache.storage.items.get(+String(id) || 0))
					.filter(i => i && 'subtype' in i) as API.ItemUpgradeComponent[] | undefined,
			};
		}
		else {
			params = { type, weaponSet,
				adjustTraitedSkillIds: element.classList.contains('auto-transform'),
			};
		}
	}

	lastTooltipTarget = element;

	showTooltipFor(objId as any, params as any, context, visibleIndex);
	if(tooltip.childElementCount > 1) {
		element.classList.add('cycler')
		element.title = 'Right-click to cycle through tooltips'
	}
}

type TooltipParams = SkillParams | ItemParams
type AttributeParams = { type : 'attribute' }
type ItemParams = {
	type          : 'item' | 'skin',
	weaponSet?    : number,
	statSetId?    : number,
	stackSize?    : number,
	slottedItems? : API.ItemUpgradeComponent[],
	element       : Element | { getAttribute : (attr : 'skin') => string | undefined }
}
type SkillParams = {
	type                   : Exclude<V2ObjectType, 'attribute' | 'specialization' | 'profession' | 'item' | 'skin'>,
	weaponSet?             : number,
	adjustTraitedSkillIds? : boolean,
}

export function showTooltipFor(objId : BaseAttribute | ComputedAttribute, params : AttributeParams, context : Context, visibleIndex? : number) : void;
export function showTooltipFor(objId : number, params : TooltipParams, context : Context, visibleIndex? : number) : void;


export function showTooltipFor(objId : number | BaseAttribute | ComputedAttribute, params : AttributeParams | TooltipParams, context : Context, visibleIndex = 0) : void {
	if(params.type == 'attribute') {
		//TODO(Rennorb): should we actually reset this every time?
		cyclePos = visibleIndex;
		tooltip.replaceChildren(generateAttributeTooltip(objId as BaseAttribute | ComputedAttribute, context));

		tooltip.style.display = ''; //empty value resets actual value to use stylesheet
		for(const tt of tooltip.children) tt.classList.add('active');
		scrollSubTooltipIntoView(cyclePos);
		return;
	}

	const data = APICache.storage[(params.type + 's') as `${typeof params.type}s`].get(objId as number);
	if(!data) return;

	if('palettes' in data) {
		//NOTE(Rennorb): This is here so we can look at underwater skills from a land context and vice versa.
		if(context.underwater) {
			if(!data.flags.includes('UsableUnderWater') && data.flags.includes('UsableLand')) {
				if(!context.cloned) context = Object.assign({}, context);
				context.underwater = false;
			}
		}
		else if(!context.underwater) {
			if(!data.flags.includes('UsableLand') && data.flags.includes('UsableUnderWater')) {
				if(!context.cloned) context = Object.assign({}, context);
				context.underwater = true;
			}
		}
	}
	const [innerTooltips, initialActiveIndex] = generateToolTipList(data, params, context);
	//TODO(Rennorb): should we actually reset this every time?
	cyclePos = visibleIndex > 0 ? visibleIndex : initialActiveIndex;
	tooltip.replaceChildren(...innerTooltips);

	tooltip.style.display = ''; //empty value resets actual value to use stylesheet
	if(tooltip.childElementCount > 1) {
		activateSubTooltip(cyclePos)
	}
	else if(tooltip.firstElementChild) {
		tooltip.firstElementChild.classList.add('active');
	}
	scrollSubTooltipIntoView(cyclePos)
}

// TODO(Rennorb) @cleanup: split this into the inflator system aswell. its getting to convoluted already
function generateToolTip(apiObject : SupportedTTTypes, slotName : string | undefined, iconMode : IconRenderMode, context : Context, weaponSet? : number) : HTMLElement {
	const headerElements = [];

	if(iconMode == IconRenderMode.SHOW || (iconMode == IconRenderMode.FILTER_DEV_ICONS && !IsDevIcon(apiObject.icon)))
		headerElements.push(newImg(apiObject.icon));

	headerElements.push(
		newElm('span.title-text', apiObject.name ? fromHTML(GW2Text2HTML(resolveInflections(apiObject.name, 1, context.character))) : `<#${apiObject.id}>`),
		newElm('div.flexbox-fill'), // split, now the right side
	);

	const currentContextInformation = resolveTraitsAndOverrides(apiObject, context);

	pushCostAndRestrictionLabels(headerElements, apiObject, currentContextInformation, context);

	const secondHeaderRow = [];
	if(slotName) secondHeaderRow.push(newElm('tes', `( ${slotName} )`));
	if(weaponSet !== undefined) secondHeaderRow.push(newElm('tes', `( Weapon Set ${weaponSet + 1} )`));

	secondHeaderRow.push(newElm('div.flexbox-fill')); // split, now the right side

	pushGamemodeSplitLabels(secondHeaderRow, apiObject, context);

	const parts : HTMLElement[] = [newElm('h4.title', ...headerElements)];
	if(secondHeaderRow.length > 1) parts.push(newElm('h4.detail', ...secondHeaderRow));

	if('description' in apiObject && apiObject.description) {
		parts.push(newElm('p.description', fromHTML(GW2Text2HTML(apiObject.description))))
	}

	pushFacts(parts, apiObject, currentContextInformation, context, weaponSet === undefined ? context.character.selectedWeaponSet : weaponSet);

	const tooltip = newElm('div.tooltip', ...parts)
	tooltip.dataset.id = String(apiObject.id)

	return tooltip;
}

function pushCostAndRestrictionLabels(destinationArray : Node[], sourceObject : SupportedTTTypes, specializedContextInformation : API.ContextInformation, context : Context) {
	if('flags' in sourceObject && sourceObject.flags!.includes('DisallowUnderwater')) {
		destinationArray.push(newImg(ICONS.NoUnderwater, 'iconsmall'));
	}

	if(specializedContextInformation.activation) {
		const value = formatFraction(specializedContextInformation.activation / 1000, config);
		if (value != '0') { //in case we rounded down a fractional value just above 0
			destinationArray.push(newElm('span.property',
				value,
				newImg(ICONS.Activation, 'iconsmall')
			));
		}
	}

	if(specializedContextInformation.resource_cost) {
		destinationArray.push(newElm('span.property',
			String(specializedContextInformation.resource_cost),
			//TODO(Rennorb) @correctness: see reaper shroud
			newImg(ICONS['Resource'+context.character.profession as keyof typeof ICONS] || ICONS.ResourceThief, 'iconsmall')
		));
	}

	if(specializedContextInformation.endurance_cost) {
		destinationArray.push(newElm('span.property',
			String(Math.round(specializedContextInformation.endurance_cost)),
			newImg(ICONS.CostEndurance, 'iconsmall')
		));
	}

	if(specializedContextInformation.upkeep_cost) {
		destinationArray.push(newElm('span.property',
			String(specializedContextInformation.upkeep_cost),
			newImg(ICONS.CostUpkeep, 'iconsmall')
		));
	}

	if(specializedContextInformation.recharge) {
		const value = formatFraction(specializedContextInformation.recharge / 1000, config);
		if (value != '0') {
			destinationArray.push(newElm('span.property',
				value,
				newImg(ICONS.Recharge, 'iconsmall')
			));
		}
	}

	if(specializedContextInformation.supply_cost) {
		destinationArray.push(newElm('span.property',
			String(specializedContextInformation.supply_cost),
			newImg(ICONS.CostSupply, 'iconsmall')
		));
	}
}

function pushGamemodeSplitLabels(destinationArray : Node[], SourceObject : SupportedTTTypes, context : Context) {
	if('override_groups' in SourceObject && SourceObject.override_groups) {
		const baseContext = new Set<GameMode>(['Pve', 'Pvp', 'Wvw']);
		for(const override of SourceObject.override_groups) {
			for(const context of override.context) {
				baseContext.delete(context as GameMode);
			}
		}

		const splits = [Array.from(baseContext), ...SourceObject.override_groups.map(o => o.context)]

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

		destinationArray.push(newElm('tes', '( ', fromHTML(splits_html.join(' | ')), ' )'));
	}
}

function pushFacts(destinationArray : Node[], sourceObject : SupportedTTTypes, specializedContextInformation : API.ContextInformation, context : Context, weaponSet : number) {
	if(specializedContextInformation.blocks) {
		//NOTE(Rennorb): 690.5 is the midpoint weapon strength for slot skills (except bundles).
		//TODO(Rennorb) @hardcoded @correctness: This value is hardcoded for usage with traits as they currently don't have any pointer that would provide weapon strength information.
		// This will probably fail in some cases where damage facts on traits reference bundle skills (e.g. kits).
		//TODO(Rennorb) @correctness: is this even correct for relics?
		let weaponStrength = 690.5;
		if('palettes' in sourceObject) for(const pid of sourceObject.palettes) {
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
		destinationArray.push(...generateFacts(specializedContextInformation.blocks, weaponStrength, context, weaponSet))
	}
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
					if(fact.requires_trait?.some(t => !context.character.traits.has(t))) continue;

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
		if(block.trait_requirements?.some(t => !context.character.traits.has(t))) continue;
		
		if(block.facts) {
			const finalFacts = [];
			let to_skip = 0;
			for(let i = 0; i < block.facts.length; i++) {
				const fact = block.facts[i];

				if(fact.requires_trait?.some(t => !context.character.traits.has(t))) continue;
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
		return LUT_WEAPON_STRENGTH[weapon_type];
	}
}

function generateToolTipList<T extends keyof SupportedTTTypeMap>(initialAPIObject : SupportedTTTypeMap[T], params : TooltipParams, context : Context) : [HTMLElement[], number] {
	let subiconRenderMode = IconRenderMode.SHOW;
	//NOTE(Rennorb): This is a bit sad, but we have to hide or at least filter icons for skills attached to traits and relics, as those often don't come with actual icons because they never were meant to be seen (they don't show in game).
	if(params.type === 'trait') subiconRenderMode = IconRenderMode.FILTER_DEV_ICONS;
	else if((initialAPIObject as API.Item).type === 'Relic') subiconRenderMode = IconRenderMode.HIDE_ICON;

	let initialActiveIndex = 0;
	const tooltipChain : HTMLElement[] = []
	let palette, group, slot : string | undefined = undefined;

	if(params.type === 'skill') {
		//TODO(Rennorb): cleanup is this necessary? The root element already gets replaced automatically. It would be if we have skills where some skill in the chain needs to be replaced. 
		if(params.adjustTraitedSkillIds) {
			const replacementSkill = findTraitedOverride(initialAPIObject as API.Skill, context);
			if(replacementSkill) (initialAPIObject as API.Skill) = replacementSkill;
		}

		//find skillchain
		let i;
		[palette, group, i, context] = guessGroupAndContext(initialAPIObject as API.Skill, context);
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
					console.warn(`[gw2-tooltips] Chain skill #${otherCandidate.skill} is missing from the cache. The query was caused by `, lastTooltipTarget);
					skill = MISSING_SKILL;
				}

				tooltipChain.splice(insertAtIndex, 0, generateToolTip(skill, slot, IconRenderMode.SHOW, context, params.weaponSet));

				candidate = otherCandidate;
			}
		}

		//now ourself
		tooltipChain.push(generateToolTip(initialAPIObject, slot, IconRenderMode.SHOW, context, params.weaponSet));

		//remaining chain
		for(let j = 0; j < i; j++) {
			const otherCandidate = group!.candidates[j];
			if(otherCandidate.previous_chain_skill_index != i) continue;
			if(!canBeSelected(otherCandidate, context)) continue;

			let skill = APICache.storage.skills.get(otherCandidate.skill);
			if(!skill) {
				console.warn(`[gw2-tooltips] Chain skill #${otherCandidate.skill} is missing from the cache. The query was caused by `, lastTooltipTarget);
				skill = MISSING_SKILL;
			}

			tooltipChain.push(generateToolTip(skill, slot, IconRenderMode.SHOW, context, params.weaponSet));

			i = j;
			j = -1;
		}
	}
	else {
		if(params.type === 'skin' || params.type === 'item') {
			const skin = getActiveSkin(initialAPIObject as API.ItemArmor, params.element);
			tooltipChain.push(generateItemTooltip(initialAPIObject as API.Item | API.Skin, context, params.weaponSet === undefined ? context.character.selectedWeaponSet : params.weaponSet, skin, params.statSetId, params.slottedItems, params.stackSize));
		}
		else {
			let slotName = undefined;
			if('slot' in initialAPIObject) {
				slotName = initialAPIObject.slot
				if('specialization' in initialAPIObject) (APICache.storage.specializations.get(initialAPIObject.specialization!)?.name || initialAPIObject.specialization!) + ' - ' + slotName;
			}
			tooltipChain.push(generateToolTip(initialAPIObject, slotName, IconRenderMode.SHOW, context, params.weaponSet));
		}
	}

	if('bundle_skills' in initialAPIObject) {
		for(const subSkillId of initialAPIObject.bundle_skills!) {
			const subSkillInChain = APICache.storage.skills.get(subSkillId);
			if(subSkillInChain && canBeUsedOnCurrentTerrain(subSkillInChain, context)) {
				const [palette, group] = guessGroupAndContext(subSkillInChain, context); //@perf
				tooltipChain.push(generateToolTip(subSkillInChain, refineSlotName(palette!, group?.slot), IconRenderMode.SHOW, context, params.weaponSet));
			}
		}
	}
	if('related_skills' in initialAPIObject) {
		for(const subSkillId of initialAPIObject.related_skills!) {
			const subSkillInChain = APICache.storage.skills.get(subSkillId);
			if(subSkillInChain && canBeUsedOnCurrentTerrain(subSkillInChain, context) && ((params.type != 'skill') || subSkillInChain.palettes.some(pid => {
				const palette = APICache.storage.palettes.get(pid);
				return palette && VALID_CHAIN_PALETTES.includes(palette.type);
			}))) {
				const [palette, group] = guessGroupAndContext(subSkillInChain, context); //@perf
				tooltipChain.push(generateToolTip(subSkillInChain, refineSlotName(palette!, group?.slot), subiconRenderMode, context, params.weaponSet));
			}
		}
	}
	if('ambush_skills' in initialAPIObject) {
		for(const { id: subSkillId, spec } of initialAPIObject.ambush_skills!) {
			const subSkillInChain = APICache.storage.skills.get(subSkillId);
			if(subSkillInChain && canBeUsedOnCurrentTerrain(subSkillInChain, context) && (!spec || context.character.specializations.has(spec))) {
				if(!slot) {
					[palette, group] = guessGroupAndContext(subSkillInChain, context);
					slot = refineSlotName(palette!, group?.slot);
				}
				tooltipChain.push(generateToolTip(subSkillInChain, slot, subiconRenderMode, context, params.weaponSet));
				break; // only one ambush skill
			}
		}
	}

	//pet skills
	if('skills' in initialAPIObject) for(const petSkillId of initialAPIObject.skills) {
		initialActiveIndex = 1;
		let petSkill = APICache.storage.skills.get(petSkillId);
		if(!petSkill) {
			console.warn(`[gw2-tooltips] pet skill #${petSkillId} is missing from the cache. The query was caused by `, lastTooltipTarget);
			petSkill = MISSING_SKILL;
		}
		const [palette, group] = guessGroupAndContext(petSkill, context);
		tooltipChain.push(generateToolTip(petSkill, refineSlotName(palette!, group?.slot), subiconRenderMode, context, params.weaponSet));
	}
	if('skills_ai' in initialAPIObject) for(const petSkillId of initialAPIObject.skills_ai) {
		let petSkill = APICache.storage.skills.get(petSkillId);
		if(!petSkill) {
			console.warn(`[gw2-tooltips] pet skill #${petSkillId} is missing from the cache. The query was caused by `, lastTooltipTarget);
			petSkill = MISSING_SKILL;
		}
		const [palette, group] = guessGroupAndContext(petSkill, context);
		let slotName = refineSlotName(palette!, group?.slot);
		if(slotName) slotName = 'AI '+slotName;
		tooltipChain.push(generateToolTip(petSkill, slotName, subiconRenderMode, context, params.weaponSet));
	}
	if(context.character.specializations.has(SPECIALIZATIONS.Soulbeast) && 'skills_soulbeast' in initialAPIObject) for(const petSkillId of initialAPIObject.skills_soulbeast) {
		let petSkill = APICache.storage.skills.get(petSkillId);
		if(!petSkill) {
			console.warn(`[gw2-tooltips] pet skill #${petSkillId} is missing from the cache. The query was caused by `, lastTooltipTarget);
			petSkill = MISSING_SKILL;
		}
		const [palette, group] = guessGroupAndContext(petSkill, context);
		tooltipChain.push(generateToolTip(petSkill, refineSlotName(palette!, group?.slot), subiconRenderMode, context, params.weaponSet));
	}

	tooltip.append(...tooltipChain);
	return [tooltipChain, initialActiveIndex]
}

function refineSlotName(palette : API.Palette, slot : string | undefined) : string | undefined {
	if(!slot) return undefined;

	if(palette.type == 'Bundle' && slot.includes('_')) {
		return 'Bundle ' + slot.substring(slot.lastIndexOf('_') + 1);
	}

	if(slot.startsWith('Weapon') && palette.weapon_type) {
		return localizeInternalName(palette.weapon_type) + ' ' + slot.substring(slot.lastIndexOf('_') + 1);
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
		const character = Object.assign({}, context.character, { specializations: structuredClone(context.character.specializations), traits: structuredClone(context.character.traits) });
		context = Object.assign({}, context, { character });
	}
	if(targetCandidate.specialization) context.character.specializations.add(targetCandidate.specialization);
	if(targetCandidate.trait) context.character.traits.add(targetCandidate.trait);
	return context;
};

function canBeSelected(info : API.SkillInfo, context : Context) : boolean {
	return (info.specialization === undefined || context.character.specializations.has(info.specialization)) &&
		(info.trait === undefined || context.character.traits.has(info.trait)) &&
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
					if(!context.character.traits.has(candidate.trait)) continue;

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

function generateItemTooltip(item : API.Item | API.Skin, context : Context, weaponSet : number, skin? : API.Skin, statSetId? : number, slottedItems? : API.ItemUpgradeComponent[], stackSize = 1) : HTMLElement {
	let statSet = ('attribute_base' in item && (context.gameMode !== 'Pvp' || (item.type === 'Trinket' && item.subtype === 'Amulet'))) && findCorrectAttributeSet(item, statSetId); // pvp builds use an amulet for stats, equipment itself doesn't provide any

	const countPrefix = stackSize > 1 ? stackSize + ' ' : '';
	const upgradeNameSource = slottedItems?.find(i => !['Infusion', 'Enrichment'].includes(i.subtype)) || slottedItems?.[0];
	const name = countPrefix + formatItemName(item, context, skin, statSet, upgradeNameSource, stackSize);
	const parts = [newElm('h4.title', newImg(skin?.icon || item.icon),  newElm('span.title-text.gw2-color-rarity-'+item.rarity, name), newElm('div.flexbox-fill'))];

	if('defense' in item && item.defense) {
		const defense = (typeof item.defense  == "number")
			? item.defense
			: LUT_DEFENSE[Math.min(100, (item.defense[0] + context.character.level))] * item.defense[1];

		parts.push(newElm('span.line', newElm('tem', 'Defense: ', newElm('span.gw2-color-stat-green', String(Math.ceil(defense))))));
	}

	if('power' in item) {
		let power;
		if('mul' in item.power) {
			let maxRarity = RARITY.Legendary;
			if(['PlayerLevelScaleRarity', 'ItemScale4'].includes(item.power.scaling!)) {
				//NOTE(Rennorb) @hardcoded: these thresholds are apparently from a config
				     if(context.character.level < 14) maxRarity = RARITY.Common;   // Wu52xQQYEUWiDdyKv+jf2Q==
				else if(context.character.level < 30) maxRarity = RARITY.Uncommon; // AX9BmdFkNkuyIpWOz58kmA==
				else if(context.character.level < 60) maxRarity = RARITY.Rare;     // X6vQWpTe2Ui+LPdJTv560g==
				else if(context.character.level < 80) maxRarity = RARITY.Exotic;   // W2O5W4HAPEy3GJFfaSt4mQ==
			}

			const rarity = Math.min(RARITY[item.rarity], maxRarity)
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
		parts.push(newElm('span.line', line));
	}

	if('tiers' in item) {
		parts.push(generateUpgradeItemGroup(item, context, weaponSet));
	}

	if(statSet && 'attribute_base' in item) {
		parts.push(...statSet.attributes.map(({attribute, base_value, scaling}) => {
			const computedValue = Math.round(base_value + item.attribute_base! * scaling);
			return newElm('span.line', newElm('tem.gw2-color-stat-green', `+${computedValue} ${localizeInternalName(attribute)}`));
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
				const group = generateUpgradeItemGroup(slottedItem, context, weaponSet);
				const name = formatItemName(slottedItem, context);
				group.prepend(newElm('h4', newImg(slottedItem.icon, 'iconsmall'),  newElm('span.title-text.gw2-color-rarity-'+slottedItem.rarity, name), newElm('div.flexbox-fill')));
				return group;
			}
			else {
				return newElm('span.line',
					newImg(ICONS['Slot'+s as keyof typeof ICONS], 'iconsmall'), `Empty ${s} Slot`
				)
			}
		})));
	}

	let descriptionAlreadyShown = false; //idk, maybe i'll change that whole thing in the future.
	if('applies_buff' in item) {
		parts.push(newElm('span', fromHTML(GW2Text2HTML(item.description))));
		parts.push(newElm('div.group', generateFact(item.applies_buff, -1, context, weaponSet, true).wrapper!));
		descriptionAlreadyShown = true;
	}

	if('facts_from_skill' in item) {
		let factsSkill = APICache.storage.skills.get(item.facts_from_skill!);
		if(!factsSkill) {
			console.warn(`[gw2-tooltips] Relic facts skill #${item.facts_from_skill} is missing from the cache. The query was caused by `, item, lastTooltipTarget);
			factsSkill = MISSING_SKILL;
		}
		const contextInfo = resolveTraitsAndOverrides(factsSkill, context);

		const headerElements : Node[] = [];
		pushGamemodeSplitLabels(headerElements, factsSkill, context);

		headerElements.push(newElm('div.flexbox-fill')); // now push elements to the right
		
		pushCostAndRestrictionLabels(headerElements, factsSkill, contextInfo, context);
		const innerParts = [newElm('h4.title', ...headerElements)];

		pushFacts(innerParts, factsSkill, contextInfo, context, weaponSet);

		parts.push(newElm('span', fromHTML(GW2Text2HTML(item.description))));
		parts.push(newElm('div.group', ...innerParts));
		descriptionAlreadyShown = true;
	}

	const metaInfo = newElm('div.group');
	//NOTE(Rennorb): PvP amulets only show the stats, they aren't real 'items'.
	if(item.type == "Armor" || item.type == "Weapon" || (item.type == "Trinket" && !item.flags.includes('Pvp'))) {
		if(skin && skin.id != (item as API.ItemArmor).default_skin) {
			parts.push(newElm('div.group', newElm('span', newElm('span.gw2-color-rarity-Junk', 'Transmuted, originally: '), formatItemName(item, context))));
		}

		metaInfo.append(newElm('span.gw2-color-rarity-'+item.rarity, item.rarity));
		if('weight' in item) metaInfo.append(newElm('span', item.weight));
		metaInfo.append(newElm('span', `${item.type}: ${item.subtype}`));
		if(item.type == "Weapon" && item.subtype && isTwoHanded(item.subtype)) metaInfo.append(newElm('span.gw2-color-rarity-Junk', `(Two-Handed)`));
		if('required_level' in item) metaInfo.append(newElm('span', 'Required Level: '+item.required_level));
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

	if((item as API.ItemBase).vendor_value) {
		let inner = ['Vendor Value: ', formatCoins((item as API.ItemBase).vendor_value! * stackSize)];
		if(stackSize > 1)
			inner.push(' (', formatCoins((item as API.ItemBase).vendor_value!), ` x ${stackSize})`);
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
		if(statSetId === undefined) console.warn(`[gw2-tooltips] [tooltip engine] Resolving stats for item without specified or innate attributes. Specify the stats by adding 'stats="<stat_set_id>" to the html element.' `);
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

function generateUpgradeItemGroup(item : API.ItemUpgradeComponent, context : Context, weaponSet : number) : HTMLElement {
	const group = newElm('div.group');
	for(const [i, tier] of item.tiers.entries()) {
		let tier_wrap = newElm('span.line');
		if(tier.description) tier_wrap.append(newElm('span', fromHTML(GW2Text2HTML(tier.description))));

		//NOTE(Rennorb): facts seem to exist, but almost universally be wrong.
		else if(tier.facts) {
			for(const fact of tier.facts) {
				const { wrapper } = generateFact(fact, null as any, context, weaponSet);
				if(wrapper) tier_wrap.append(wrapper);
			}
		}

		else if(tier.modifiers) {
			tier_wrap.style.flexDirection = "column";
			const activeAttributes = context.character.statsWithWeapons[weaponSet].values;
			for(const modifier of tier.modifiers) {
				//TODO(Rennorb) @cleanup: unify this wth the buf fact processing
				let modifierValue = calculateModifier(modifier, context.character.level, activeAttributes);

				let text;
				if(modifier.flags.includes('FormatPercent')) {
					text = `+${Math.round(modifierValue)}% ${localizeInternalName(modifier.description as any)}`;
				} else {
					text = `+${Math.round(modifierValue)} ${localizeInternalName(modifier.description as any)}`;
				}
				tier_wrap.append(newElm('span.line', text));
			}
		}
		
		const w = newElm('span.line', tier_wrap);
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
		const targetType = attribute === 'ConditionDuration' ? 'Condition' : 'Boon';

		//NOTE(Rennorb): -1 because the cap is 200% for duration, but the displayed value is the _additional_ duration, so its a max of +100%.
		const modCap = (getAttributeInformation(attribute, context.character).cap - 1) * 100;
		const activeAttributes = context.character.statsWithWeapons[context.character.selectedWeaponSet].values;

		for(const [effectId, sources] of Object.entries(weaponStats.sources)) {
			//NOTE(Rennorb): For simplicity of the remaining library we just eat the performance hit of iterating over the additional props here.
			if(isNaN(+effectId)) continue;
			const effect = APICache.storage.skills.get(+effectId);
			if(!effect) {
				console.error(`[gw2-tooltips] [tooltip engine] effect #${effectId} is missing in cache.`);
				continue;
			}
			if(effect.buff_type !== targetType) continue;

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

/** Does not format inflections if stackSize is < 0. */
export function formatItemName(item : API.Item | API.Skin, context : Context, skin : API.Skin = EMPTY_SKIN, statSet? : API.AttributeSet | false, upgradeComponent? : any, stackSize = 1) : string {
	let name;
	if(item.type == 'TraitGuide') {
		const trait = APICache.storage.traits.get(item.trait);
		if(trait) name = trait.name;
		else {
			console.warn(`[gw2-tooltips] [item-name-formatter] Cache is missing trait #${item.trait} for trait guide `, item);
			name = `Trait #${item.trait}`;
		}
	}
	else {
		name = skin.name || item.name;
	}

	let arg1, arg2, arg3, arg4;
	arg1 = arg2 = arg3 = arg4 = '';

	if(!skin.flags.includes('HidePrefix')) {
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

export function specializeContextFromInlineAttribs(context : Context, gw2Object : HTMLElement) : Context {
	let traitOverrides = gw2Object.getAttribute('with-traits');
	if(traitOverrides) {
		//NOTE(Rennorb): Cannot use structured clone here because it will fail with the html chunks as those are invalid objects.
		//TODO(Rennorb) @cleanup: get rid of those jank custom tags.
		context = Object.assign({}, context);
		context.cloned = true; //NOTE(Rennorb) @correctness: might be dangerous, since its not fully cloned. but not more dangerous than before
		context.character = Object.assign({}, context.character);
		const invalid : string[] = [];
		context.character.traits = new Set(traitOverrides.split(',').map(t => {
			const v = +t;
			if(!v) invalid.push(t);
			return v;
		}).filter(t => t));
		if(invalid.length) console.warn("[gw2-tooltips] [tooltip engine] Inline trait-override for element ", gw2Object, " has misformed overrides: ", invalid)
	}
	return context;
}

export function formatCoins(amount : number) : HTMLElement {
	const parts = [String(Math.floor(amount % 100)), newImg(ICONS.CoinCopper, 'iconsmall', '')];
	if(amount > 99) parts.unshift(String(Math.floor((amount / 100) % 100)), newImg(ICONS.CoinSilver, 'iconsmall', ''));
	if(amount > 9999) parts.unshift(String(Math.floor(amount / 1_00_00)), newImg(ICONS.CoinGold, 'iconsmall', ''));
	return newElm('span', ...parts);
}

export function getActiveSkin(item : { default_skin? : number, subtype? : any }, element : Element | { getAttribute : (attr : 'skin') => string | undefined }) : API.Skin | undefined {
	const overrideId = +String(element.getAttribute('skin'));
	const id = overrideId || item.default_skin;
	if(!id) return;

	const skin = APICache.storage.skins.get(id);
	if(!skin) {
		console.warn(`[gw2-tooltips] Cache is missing skin #${id} for item `, item, '. Query was caused by ', element);
		return item.default_skin != overrideId ? APICache.storage.skins.get(item.default_skin!) : undefined;
	}

	if(skin.subtype !== item.subtype && (skin.type !== 'Back' || item.subtype !== 'Backpiece')) {
		console.warn('[gw2-tooltips] Skin ', skin, ' cannot be applied to ', item, ", the subtype doesn't match. Query was caused by ", element);
		return item.default_skin != overrideId ? APICache.storage.skins.get(item.default_skin!) : undefined;
	}

	return skin;
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

function createCompleteContext(partialContext : PartialContext) : Context {
	if(partialContext.gameMode == "Pvp" && partialContext.character?.level && partialContext.character?.level != 80) {
		console.error('[gw2-tooltips] [init] supplied (partial) context has its gamemode set to pvp, but has a character level specified thats other than 80. In pvp you are always level 80. This will lead to unexpected results; Remove the explicit level or change the gamemode. The (partial) context in question is: ', partialContext);
	}

	const stats = createCompletedBaseStats(partialContext.character?.stats);
	const upgradeCounts = Object.assign({}, partialContext.character?.upgradeCounts);
	const statsWithWeapons = partialContext.character?.statsWithWeapons?.map(s => createCompletedStats(s)) || [createCompletedStats()];
	const character = Object.assign({}, DEFAULT_CONTEXT.character, { traits: new Set(), specializations: new Set() }, partialContext.character, { stats, upgradeCounts, statsWithWeapons });
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

type SupportedTTTypeMap = {
	skill         : API.Skill;
	trait         : API.Trait;
	item          : API.Item;
	pet           : API.Pet;
	'pvp/amulet'  : API.ItemAmulet;
	skin          : API.Skin;
};
type SupportedTTTypes = SupportedTTTypeMap[keyof SupportedTTTypeMap];


// "constructor"
{
	//TODO(Rennorb): Validate config. there are a few places this partially happens but its hard to keep track. Should just happen in one place.
	if(globalThis.GW2TooltipsContext instanceof Array) {
		for(const partialContext of globalThis.GW2TooltipsContext)
			contexts.push(createCompleteContext(partialContext))
	}
	else if(globalThis.GW2TooltipsContext) {
		contexts.push(createCompleteContext(globalThis.GW2TooltipsContext))
	}
	else{
		contexts.push(createCompleteContext({}))
	}

	config = Object.assign({}, DEFAULT_CONFIG, globalThis.GW2TooltipsConfig)
	if(config.apiImpl) APICache.apiImpl = config.apiImpl(APIs);

	
	if(globalThis.navigator && "serviceWorker" in navigator && config.workerPath) {
		//NOTE(Rennorb): options, apparently server needs to set header for broader scope. `Service-Worker-Allowed : /`
		// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register
		// https://w3c.github.io/ServiceWorker/#service-worker-allowed
		navigator.serviceWorker.register(config.workerPath, { scope: '/' }).then(
			(s) => console.log('[gw2-tooltips] [worker] APICache ServiceWorker registered.', s),
			(e) => console.error(`[gw2-tooltips] [worker] Failed to register APICache ServiceWorker: ${e}`)
		);
	}

	tooltip = newElm('div.tooltipWrapper')
	tooltip.style.display = 'none';
	if(document.body)
		document.body.appendChild(tooltip);
	else
		document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tooltip));

	const isMobile = globalThis.navigator && /android|webos|iphone|ipad|ipod|blackberry|bb|playbook|mobile|windows phone|kindle|silk|opera mini/.test(navigator.userAgent.toLowerCase())
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

			cyclePos = (cyclePos + 1) % tooltip.childElementCount
			activateSubTooltip(cyclePos)
			scrollSubTooltipIntoView(cyclePos, true)
			positionTooltip(true)
		}
		if(isMobile && tooltip.style.display == 'none') {
			event.preventDefault()
			showTooltipOn(node);
			positionTooltip()
		}
	})

	if(globalThis.window) {
		//TODO(Rennorb): This isn't very clean, I would like a better solution tbh
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
		if(config.globalKeyBinds) window.addEventListener('keydown', e => {
			if(e.ctrlKey && e.altKey) {
				if(e.key == 'd') {
					e.preventDefault();
					config.showFactComputationDetail = !config.showFactComputationDetail;
					console.log(`[gw2-tooltips] [cfg] showFactComputationDetail is now ${config.showFactComputationDetail}.`);
					if(lastTooltipTarget && tooltip.style.display != 'none') {
						showTooltipOn(lastTooltipTarget, cyclePos); // visibleIndex = cyclePos: keep the same sub-tooltip active
						positionTooltip();
					}
				}
				else if(e.key == 't') {
					e.preventDefault();
					config.showPreciseAbilityTimings = !config.showPreciseAbilityTimings;
					console.log(`[gw2-tooltips] [cfg] showPreciseAbilityTimings is now ${config.showPreciseAbilityTimings}.`);
					if(lastTooltipTarget && tooltip.style.display != 'none') {
						showTooltipOn(lastTooltipTarget, cyclePos); // visibleIndex = cyclePos: keep the same sub-tooltip active
						positionTooltip();
					}
				}
				else if(e.key == 'w') {
					e.preventDefault();
					for(const [i, context] of contexts.entries()) {
						//TODO(Rennorb) @stability: This will fail for sparse weapon sets, but thats wrong / brittle in other ways aswell.
						const mod = context.character.statsWithWeapons.length;
						context.character.selectedWeaponSet = (context.character.selectedWeaponSet + 1) % mod;
						console.log(`[gw2-tooltips] [cfg] Context #${i} is now on weapon set ${context.character.selectedWeaponSet + 1} / ${mod}.`);
					}
					if(lastTooltipTarget && tooltip.style.display != 'none') {
						showTooltipOn(lastTooltipTarget, cyclePos); // visibleIndex = cyclePos: keep the same sub-tooltip active
						positionTooltip();
					}
				}
			}
		});
	}
}

if(config.autoInitialize) {
	hookDocument(document);
}


import { newElm, newImg, GW2Text2HTML, localizeInternalName, formatFraction, fromHTML, findSelfOrParent, n3, resolveInflections, IconRenderMode, IsDevIcon } from './Utils';
import * as APIs from './API';
import APICache from './APICache';
export { APICache }
import { calculateModifier, generateFact, generateFacts } from './FactsProcessor';
import * as Collect from './Collect';
import { inferItemUpgrades, inflateAttribute, inflateGenericIcon, inflateItem, inflateProfession, inflateSkill, inflateSpecialization } from './Inflators'
import { transformEffectToSkillObject as transformEffectToSkillObject } from './EffectsShim'
import { LUT_DEFENSE, LUT_POWER_MONSTER, LUT_POWER_PLAYER, getAttributeInformation, recomputeAttributesFromMods } from './CharacterAttributes'
import { DEFAULT_CONFIG, DEFAULT_CONTEXT, ICONS, LUT_RARITY, LUT_RARITY_MUL, LUT_WEAPON_STRENGTH, PROFESSIONS, RARITY, SPECIALIZATIONS, VALID_CHAIN_PALETTES, EMPTY_SKIN, MISSING_SKILL } from './Constants'




/*@TEST_ONLY_START*/
export { DEFAULT_CONTEXT, generateFact, generateItemTooltip, createCompleteContext }
/*@TEST_ONLY_END*/
