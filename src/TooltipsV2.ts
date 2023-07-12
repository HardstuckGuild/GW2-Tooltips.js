//TODO(Rennorb) @issues:
//TODO(Rennorb): Provide a clean way to construct custom tooltips. Currently with the old version we manipulate the cache before the hook function gets called, which really isn't the the best.
//TODO(Rennorb): Think about bundling everything with something like rollup so way we can also easily produce minified versions, although we will have to introduce node-modules for that which i strongly dislike.
//TODO(Rennorb): Multi skill tooltips (multiple boxes) (kindof works nit not complete)
//TODO(Rennorb): Option to show whole skill-chain (maybe on button hold)?
//TODO(Rennorb): Stop using these jank custom tags. There is no reason to do so and its technically not legal per html spec.
//TODO(Rennorb) @fixme: impale: the impale buff doesn't have a name, only shows duration
//TODO(Rennorb): Figure out how to handle boon descriptions. Have a toggle between 'realistic as in game' and 'full information'
//TODO(Rennorb): Link minion skills to minion summon skill.
//TODO(Rennorb): specs, pets, and amulets endpoints.
//TODO(Rennorb): translation for attributes into 'human readable' (in game) names
//TODO(Rennorb): Something with the traits is funky, the facts are clearly incomplete for some of them. The linked/trigger skills are missing afaict.
//TODO(Rennorb): Amulet enrichment slot is not there.
//TODO(Rennorb): Defiance break on single effect tooltips.

/// <reference path="Collect.ts" />

type TypeBridge<T, K extends keyof T> = [K, T[K]]
declare interface ObjectConstructor {
	entries<T>(obj : T) : TypeBridge<T, keyof T>[]
}

//TODO(Rennorb) @cleanup: make static class or just turn the whole project into a module with functions only.
// Instances aren't needed for anything here.
class GW2TooltipsV2 {
	static tooltip      : HTMLElement

	static cycleTooltipsHandler? : VoidFunction;
	static cycling = false
	static cyclePos    : number
	static baseTooltip : number
	static lastMouseX  : number
	static lastMouseY  : number

	static context : Context[] = [];
	static defaultContext : Context = {
		gameMode           : 'Pve',
		targetArmor        : 2597,
		character: {
			level            : 80,
			isPlayer         : true,
			sex              : "Male",
			traits           : [],
			stats: {
				power          : 1000,
				toughness      : 1000,
				vitality       : 1000,
				precision      : 1000,
				ferocity       : 1000,
				conditionDmg   : 0,
				expertise      : 0,
				concentration  : 0,
				healing        : 0,
				critDamage     : 0,
				agonyResistance: 0,
			},
			statSources: {
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
			},
			upgradeCounts: {},
		},
	}
	static createCompleteContext(partialContext : PartialContext) : Context {
		if(partialContext.gameMode == "Pvp" && partialContext.character?.level && partialContext.character?.level != 80) {
			console.error('[gw2-tooltips] [init] supplied (partial) context has its gamemode set to pvp, but has a character level specified thats other than 80. In pvp you are always level 80. This will lead to unexpected results; Remove the explicit level or change the gamemode. The (partial) context in question is: ', partialContext);
		}

		const stats = Object.assign({}, this.defaultContext.character.stats, partialContext.character?.stats);
		const statSources = Object.assign({}, this.defaultContext.character.statSources, partialContext.character?.statSources);
		const upgradeCounts = Object.assign({}, partialContext.character?.upgradeCounts);
		const character = Object.assign({}, this.defaultContext.character, partialContext.character, { stats, statSources, upgradeCounts });
		return Object.assign({}, this.defaultContext, partialContext, { character });
	}

	static config : Config;
	static defaultConfig : Config = {
		autoInitialize                : true,
		autoCollectRuneCounts         : true,
		autoCollectStatSources        : true,
		adjustIncorrectStatIds        : true,
		autoInferEquipmentUpgrades    : true,
		legacyCompatibility           : true,
		preferCorrectnessOverExtraInfo: false,
	}

	static _constructor() {
		if(window.GW2TooltipsContext instanceof Array) {
			for(const partialContext of window.GW2TooltipsContext)
				this.context.push(GW2TooltipsV2.createCompleteContext(partialContext))
		}
		else if(window.GW2TooltipsContext) {
			this.context.push(GW2TooltipsV2.createCompleteContext(window.GW2TooltipsContext))
		}
		else{
			this.context.push(GW2TooltipsV2.createCompleteContext({}))
		}

		this.config = Object.assign({}, GW2TooltipsV2.defaultConfig, window.GW2TooltipsConfig)
		if(this.config.apiImpl) APICache.apiImpl = this.config.apiImpl();

		this.tooltip = TUtilsV2.newElm('div.tooltipWrapper')
		this.tooltip.style.display = 'none';
		document.body.appendChild(this.tooltip)

		document.addEventListener('mousemove', event => {
			this.lastMouseX = event.pageX
			this.lastMouseY = event.pageY
			if(this.tooltip.style.display != 'none')
				this.positionTooltip()
		})
		document.addEventListener('contextmenu', event => {
			if(!this.cycleTooltipsHandler) return;
			event.preventDefault()
			this.cycleTooltipsHandler();
		})
	}

	static displayCorrectChainTooltip(tooltips: HTMLElement[], tooltipIndex: number) {
		for(let index = 0; index < tooltips.length; index++) {
			tooltips[index].classList.toggle('active', index === tooltipIndex);
		}
	}
	static cycleTooltips() {
		if(!this.cycling) return
		this.cycling = true

		const chainTooltips = Array.from(this.tooltip.children) as HTMLElement[]
		this.cyclePos = chainTooltips.length - this.baseTooltip
		const totalTooltips = chainTooltips.length - this.baseTooltip
		this.cyclePos = (this.cyclePos - 1 + totalTooltips) % totalTooltips
		this.displayCorrectChainTooltip(chainTooltips, this.cyclePos);

		this.positionTooltip()
	}

	static positionTooltip() {
		const wpadminbar = document.getElementById('wpadminbar'); //TODO(Rennorb) @hardcoded: this accounts for the wordpress bar that might exist.
		const topBarHeight = wpadminbar ? wpadminbar.offsetHeight : 0;

		//using actual css margins in css is pain
		const marginX = 22;
		const marginY = 13;
		//some space form the cursor
		const offsetX = 6;
		const offsetY = 6;

		let tooltipXpos = this.lastMouseX + offsetX;
		if(tooltipXpos + this.tooltip.offsetWidth + marginX > document.documentElement.clientWidth) {
			tooltipXpos = document.documentElement.clientWidth - (this.tooltip.offsetWidth + marginX);
		}
		let tooltipYpos = this.lastMouseY - offsetY - this.tooltip.offsetHeight;
		if(tooltipYpos - marginY < document.documentElement.scrollTop) {
			tooltipYpos = topBarHeight + marginY + document.documentElement.scrollTop;
		}

		this.tooltip.style.transform = `translate(${tooltipXpos}px, ${tooltipYpos}px)`;
	}

	static hookDocument(scope : ScopeElement, _unused? : any) : Promise<void[]> {
		//NOTE(Rennorb): need to use an array since there might be multiple occurrences of the same id in a given scope
		const objectsToGet : ObjectsToFetch = {
			skills         : new Map<number, HTMLElement[] | undefined>(),
			traits         : new Map<number, HTMLElement[] | undefined>(),
			items          : new Map<number, HTMLElement[] | undefined>(),
			specializations: new Map<number, HTMLElement[] | undefined>(),
			pets           : new Map<number, HTMLElement[] | undefined>(),
			'pvp/amulets'  : new Map<number, HTMLElement[] | undefined>(),
		}
		const statsToGet = new Set<number>();
		const _legacy_effectErrorStore = new Set<string>();

		for(const gw2Object of scope.getElementsByTagName('gw2object') as HTMLCollectionOf<HTMLElement>) {
			const stats = +String(gw2Object.getAttribute('stats'))
			if(!isNaN(stats)) statsToGet.add(stats);

			let objId = +String(gw2Object.getAttribute('objId'))
			//TODO(Rennorb) @cleanup @compat: this is literally just for naming 'convenience'.
			// Figure out if we can just get rid of the +'s' or if that poses an issue with backwards compat
			let type = (gw2Object.getAttribute('type') || 'skill') + 's'

			if(this.config.legacyCompatibility) {
				//NOTE(Rennorb): weapon swaps are completely synthesized
				if(type === 'effects') {
					type = 'skills';
					objId = this._legacy_transformEffectToSkillObject(gw2Object, _legacy_effectErrorStore);
				}
			}

			if(isNaN(objId) || !(type in objectsToGet)) continue;

			const elementsWithThisId = objectsToGet[type as keyof typeof objectsToGet].get(objId);
			if(elementsWithThisId) elementsWithThisId.push(gw2Object)
			else objectsToGet[type as keyof typeof objectsToGet].set(objId, [gw2Object])

			gw2Object.addEventListener('mouseenter', (e) => {
				const gw2Object = e.target as HTMLElement;
				const type = ((gw2Object.getAttribute('type') || 'skill') + 's') as `${LegacyCompat.ObjectType}s`;
				const objId = +String(gw2Object.getAttribute('objId'))
				const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
				const stackSize = +String(gw2Object.getAttribute('count')) || undefined;

				if(type == 'specializations' || type == 'effects') return; //TODO(Rennorb) @completeness: inline objs
				if(type == 'pets') return; //TODO(Rennorb) @completeness

				const data = APICache.storage[type].get(objId);
				if(data) {
					if(type == 'items' || type == "pvp/amulets") {
						const statId = +String(gw2Object.getAttribute('stats')) || undefined;
						this.tooltip.replaceChildren(this.generateItemTooltip(data as API.Item, context, gw2Object, statId, stackSize));
					}
					else
						this.tooltip.replaceChildren(...this.generateToolTipList(data as Exclude<typeof data, API.Item>, gw2Object, context));
					this.tooltip.style.display = ''; //empty value resets actual value to use stylesheet
				}
			})
			gw2Object.addEventListener('mouseleave', () => {
				this.tooltip.style.display = 'none';
				this.cycleTooltipsHandler = undefined;
			})
		}

		if(_legacy_effectErrorStore.size) {
			console.error("[gw2-tooltips] [legacy-compat] Some effects could not be translated into skills: ", Array.from(_legacy_effectErrorStore));
		}

		if(statsToGet.size > 0) APICache.ensureExistence('itemstats', statsToGet.values());

		return Promise.all(Object.entries(objectsToGet).map(async ([key, values]) => {
			if(values.size == 0) return;

			let inflator;
			switch(key) {
				case 'items'          : inflator = this.inflateItem.bind(this); break;
				case 'specializations': inflator = this.inflateSpecialization.bind(this); break;
				default               : inflator = this.inflateGenericIcon.bind(this); break;
			}
			const cache = APICache.storage[key];

			await APICache.ensureExistence(key, values.keys())

			for(const [id, objects] of values) {
				const data = cache.get(id);
				if(!objects || !data) continue;

				for(const gw2Object of objects)
					inflator(gw2Object, data as any);
			}
		}))
	}

	static inflateGenericIcon(gw2Object : HTMLElement, data : { name : string, icon? : string }) {
		const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(data.icon, undefined, data.name));
		wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + TUtilsV2.GW2Text2HTML(data.name.replaceAll(/%str\d%/g, ''))
		.replaceAll(/\[.*?\]/g, '');
		wikiLink.target = '_blank';
		if(gw2Object.classList.contains('gw2objectembed')) wikiLink.append(data.name);
		gw2Object.append(wikiLink);
	}
	static inflateItem(gw2Object : HTMLElement, item : API.Item) {
		const stackSize = +String(gw2Object.getAttribute('count')) || 1;
		const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];

		const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(item.icon, undefined, item.name));
		wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + TUtilsV2.GW2Text2HTML(item.name.replaceAll(/%str\d%/g, ''))
		.replaceAll(/\[.*?\]/g, '');
		wikiLink.target = '_blank';
		if(gw2Object.classList.contains('gw2objectembed')) wikiLink.append(this.formatItemName(item, context, undefined, undefined, stackSize));
		gw2Object.append(wikiLink);
	}
	static inflateSpecialization(gw2Object : HTMLElement, spec: API.Specialization) {
		//TODO(Rennorb): this is probably wrong for inlines
		gw2Object.style.backgroundImage = `url(${spec.background})`;
		gw2Object.dataset.label = spec.name;
	}

	//TODO(Rennorb): this is neither complete, nor reliable
	static getSlotName(skill: API.Skill) : string | undefined {
		let skillSlot
		for(const palette of skill.palettes) {
			for(const slot of palette.slots) {
				switch (palette.type) {
					case 'Equipment':
						//NOTE(Rennorb): mech skills are part pet part equipment skills...
						//TODO(Rennorb): Figure out a good way to get the actual slot name for that. Also look at actual pets.
						if(palette.weapon_type !== 'None') {
							//TODO(Rennorb) @cleanup: move this to the api side
							skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, (_, __, digit) => {
								if(
									['Greatsword', 'Hammer', 'BowLong', 'Rifle', 'BowShort', 'Staff'].includes(palette.weapon_type) &&
									['Offhand1', 'Offhand2'].includes(slot.slot)
								) {
									digit = digit === '1' ? '4' : '5'
								}
								return `${TUtilsV2.mapLocale(palette.weapon_type)} ${digit}`
							});
						}
						break
					case 'Standard':
						if(slot.slot === 'Standard') {
							skillSlot = 'Utility'
						}
						break
					case 'Heal':
						skillSlot = 'Heal'
						break
					case 'Bundle':
						skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, (_, __, digit: string) => `Weapon ${digit}`)
						break
					case 'Toolbelt':
						skillSlot = 'Toolbelt'
						break
					case 'Elite':
						skillSlot = 'Elite'
						break
					case 'Pet':
					case 'Profession':
						skillSlot = slot.slot
						break;
					case 'Monster':
						break;
					default:
						console.error(`[gw2-tooltips] [tooltip engine] unknown palette type '${palette.type}' for skill '${skill.name}'`)
				}
			}
		}
		return skillSlot
	}

	// TODO(Rennorb) @cleanup: split this into the inflator system aswell. its getting to convoluted already
	static generateToolTip(apiObject : SupportedTTTypes, context : Context) : HTMLElement {
		const headerElements = [TUtilsV2.newElm('teb', TUtilsV2.GW2Text2HTML(apiObject.name))];
		headerElements.push(TUtilsV2.newElm('div.flexbox-fill')); // split, now the right side

		const currentContextInformation = this.resolveTraitsAndOverrides(apiObject, context);

		if(currentContextInformation.resource_cost) {
			headerElements.push(TUtilsV2.newElm('ter',
				String(currentContextInformation.resource_cost),
				TUtilsV2.newImg(this.ICONS.RESOURCE, 'iconsmall')
			));
		}

		if(currentContextInformation.activation) {
			const value = TUtilsV2.drawFractional(currentContextInformation.activation / 1000)
			headerElements.push(TUtilsV2.newElm('ter',
				value+'s',
				TUtilsV2.newImg(this.ICONS.ACTIVATION, 'iconsmall')
			));
		}

		if(currentContextInformation.recharge) {
			const value = TUtilsV2.drawFractional(currentContextInformation.recharge / 1000)
			headerElements.push(TUtilsV2.newElm('ter',
				value+'s',
				TUtilsV2.newImg(this.ICONS.RECHARGE, 'iconsmall')
			));
		}

		const secondHeaderRow = [];
		{
			//TODO(Rennorb): slots stuff might not be doable serverside since the server is missing context. this is at least a case of @cleanup
			let slotName = ('slot' in apiObject && apiObject.slot) || ('palettes' in apiObject && this.getSlotName(apiObject));
			if(slotName) secondHeaderRow.push(TUtilsV2.newElm('tes', `( ${slotName} )`));
		}

		secondHeaderRow.push(TUtilsV2.newElm('div.flexbox-fill')); // split, now the right side

		if('override_groups' in apiObject && apiObject.override_groups) {
			const baseContext = new Set<GameMode>(['Pve', 'Pvp', 'Wvw']);
			for(const override of apiObject.override_groups) {
				for(const context of override.context) {
					baseContext.delete(context as GameMode);
				}
			}

			const splits : string[] = [];
			let pushedBase = false;
			for(const mode of ['Pve', 'Pvp', 'Wvw'] as GameMode[]) { //loop to keep sorting vaguely correct
				if(baseContext.has(mode)) {
					if(pushedBase) continue;

					const text = Array.from(baseContext).join('/');
					if(baseContext.has(context.gameMode))
						splits.push(`<span style="color: var(--gw2-tt-color-text-accent) !important;">${text}</span>`);
					else
						splits.push(text);
					pushedBase = true;
				}
				else {
					if(mode == context.gameMode)
						splits.push(`<span style="color: var(--gw2-tt-color-text-accent) !important;">${mode}</span>`);
					else
						splits.push(mode);
				}
			}

			secondHeaderRow.push(TUtilsV2.newElm('tes', '( ', TUtilsV2.fromHTML(splits.join(' | ')), ' )'));
		}

		const parts : HTMLElement[] = [TUtilsV2.newElm('tet', ...headerElements)];
		if(secondHeaderRow.length > 1) parts.push(TUtilsV2.newElm('tet.small', ...secondHeaderRow));

		if('description' in apiObject && apiObject.description) {
			const description = document.createElement('ted')
			description.innerHTML = `<teh>${TUtilsV2.GW2Text2HTML(apiObject.description)}</teh>`
			parts.push(description)
		}

		if(currentContextInformation.facts) {
			//NOTE(Rennorb): 690.5 is the midpoint weapon strength for slot skills (except bundles).
			//TODO(Rennorb) @hardcoded @correctness: This value is hardcoded for usage with traits as they currently don't have any pointer that would provide weapon strength information.
			// This will probably fail in some cases where damage facts on traits reference bundle skills (e.g. kits).
			let weaponStrength = 690.5;
			if('palettes' in apiObject && apiObject.palettes.length) {
				const criteria = context.character.profession
					? ((s : API.Slot) => s.profession === context.character.profession)
					: ((s : API.Slot) => s.profession !== 'None');
				const relevantPalette = apiObject.palettes.find(p => p.slots.some(criteria));

				if(relevantPalette) {
					weaponStrength = this.getWeaponStrength(relevantPalette)
				}
			}
			parts.push(...FactsProcessor.generateFacts(currentContextInformation.facts, weaponStrength, context))
		}

		const tooltip = TUtilsV2.newElm('div.tooltip', ...parts)
		tooltip.dataset.id = String(apiObject.id)
		tooltip.style.marginTop = '5px' //TODO(Rennorb) @cleanup

		return tooltip;
	}

	static resolveTraitsAndOverrides(apiObject : SupportedTTTypes & { facts? : API.Fact[], override_groups? : API.ContextInformation['override_groups'] }, context : Context) : API.ContextInformation {
		let override = apiObject.override_groups?.find(g => g.context.includes(context.gameMode));
		let result = Object.assign({}, apiObject, override);
		if(apiObject.facts && override && override.facts) {
			result.facts = apiObject.facts.slice(); //clone the array
			//NOTE(Rennorb): need to reverse here to be able to insert and override facts without shifting earlier indices
			for(const fact of override.facts.reverse()) {
				if(fact.requires_trait?.some(t => !context.character.traits.includes(t))) continue;

				if(fact.overrides) result.facts[fact.overrides] = fact;
				else result.facts.push(fact);
			}
		}
		if(result.facts) {
			result.facts = result.facts.filter(f => !f.requires_trait || !f.requires_trait.some(t => !context.character.traits.includes(t)));
		}
		return result;
	}

	//TODO(Rennorb) @correctness: this does not take traits into consideration
	static getHealth(character : Character) : number {
		//TODO(Rennorb): level scaling
		const baseHealth = !character.profession
			? 1000 //TODO(Rennorb): none?
			: ({
					Guardian     : 1645,
					Thief        : 1645,
					Elementalist : 1645,
					Engineer     : 5922,
					Ranger       : 5922,
					Mesmer       : 5922,
					Revenant     : 5922,
					Necromancer  : 9212,
					Warrior      : 9212,
				} as { [k in Profession] : number })[character.profession];

		return baseHealth + character.stats.vitality * 10;
	}

	static getWeaponStrength({ weapon_type, type : palette_type } : API.Palette) : number {
		let weaponStrength = {
			None       : 0,
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
		}[weapon_type]

		if(weapon_type === 'None') {
			if(palette_type === 'Standard' || palette_type === 'Toolbelt') {
				weaponStrength = 690.5
			} else if(palette_type === 'Bundle') {
				weaponStrength = 922.5
			}
		}

		return weaponStrength
	}

	static generateToolTipList(initialAPIObject : SupportedTTTypes, gw2Object: HTMLElement, context : Context) : HTMLElement[] {
		const objectChain : SupportedTTTypes[] = []
		const validPaletteTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard']

		const addObjectsToChain = (currentSkill : SupportedTTTypes) => {
			objectChain.push(currentSkill)

			if('palettes' in currentSkill) {
				let hasChain = false;
				for(const palette of currentSkill.palettes) {
					for(const slot of palette.slots) {
						if(slot.next_chain && slot.profession !== 'None') {
							const nextSkillInChain = APICache.storage.skills.get(slot.next_chain);
							if(nextSkillInChain) {
								hasChain = true;
								addObjectsToChain(nextSkillInChain)
							}
						}
					}
				}

				//TODO(Rennorb): Apparently sub_skills is of very questionable correctness and seems to only be used internally.
				// Using it in this way might produce unexpected results.
				//NOTE(Rennorb): Checking for the skill chain here since it usually produces duplicated entries if one is present and the skill chain is more authoritative.
				if(!hasChain && currentSkill.sub_skills) {
					for(const subSkillId of currentSkill.sub_skills) {
						const subSkillInChain = APICache.storage.skills.get(subSkillId);
						if(subSkillInChain && subSkillInChain.palettes.some(palette => validPaletteTypes.includes(palette.type))) {
							addObjectsToChain(subSkillInChain)
						}
					}
				}
			}
		}

		addObjectsToChain(initialAPIObject)

		let context_ = context;
		// Inline overrides. Might get expanded in the future.
		//TODO(Rennorb): @docs
		{
			let traitOverrides;
			if(gw2Object.getAttribute('type') === 'skill' && (traitOverrides = gw2Object.getAttribute('with-traits'))) {
				context_ = structuredClone(context);
				const invalid : string[] = [];
				context_.character.traits = traitOverrides.split(',').map(t => {
					const v = +t;
					if(!v) invalid.push(t);
					return v;
				}).filter(t => t);
				if(invalid.length) console.warn("[gw2-tooltips] [tooltip engine] Inline trait-override for element ", gw2Object, " has misformed overrides: ", invalid)
			}
		}

		const tooltipChain = objectChain.map(obj => this.generateToolTip(obj, context_));
		this.tooltip.append(...tooltipChain)

		if(tooltipChain.length > 1) {
			gw2Object.classList.add('cycler')
			gw2Object.title = 'Right-click to cycle through tooltips'

			let currentTooltipIndex = 0
			this.displayCorrectChainTooltip(tooltipChain, currentTooltipIndex)

			this.cycleTooltipsHandler = () => {
				this.cycleTooltips() //TODO(Rennorb) @cleanup: why are there two functions with basically the same name
				currentTooltipIndex = (currentTooltipIndex + 1) % tooltipChain.length
				this.displayCorrectChainTooltip(tooltipChain, currentTooltipIndex)
				this.positionTooltip()
			};
		}
		else {
			tooltipChain[0].classList.add('active'); // single tooltip is always expanded
		}

		return tooltipChain
	}

	static generateItemTooltip(item : API.Item, context : Context, target : HTMLElement, statSetId? : number, stackSize = 1) : HTMLElement {
		let statSet : API.AttributeSet | undefined = undefined;
		if(item.type == "Armor" || item.type == "Trinket" || item.type == "Weapon") {
			statSetId = statSetId || item.attribute_set;
			if(statSetId === undefined) console.warn(`[gw2-tooltips] [tooltip engine] Hovering on item without specified or innate stats. Specify the stats by adding 'stats="<stat_set_id>" to the html element.' `);
			else {
				statSet = APICache.storage.itemstats.get(statSetId);
				if(!statSet) console.error(`[gw2-tooltips] [tooltip engine] itemstat #${statSetId} is missing in cache.`);
				else {
					//TODO(Rennorb): should this happen at injection time?
					if(this.config.adjustIncorrectStatIds && statSet.similar_sets) {
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

		let slottedItems : (API.ItemBase & API.UpgradeComponentDetail)[] | undefined;
		if('slots' in item) {
			slottedItems = target.getAttribute('slotted')?.split(',')
				.map(id => APICache.storage.items.get(+String(id) || 0))
				.filter(i => i && 'subtype' in i) as (API.ItemBase & API.UpgradeComponentDetail)[];
		}

		const countPrefix = stackSize > 1 ? stackSize + ' ' : '';
		const upgradeNameSource = slottedItems?.find(i => i.subtype !== 'Default') || slottedItems?.[0];
		const name = countPrefix + this.formatItemName(item, context, statSet, upgradeNameSource, stackSize);
		const parts = [TUtilsV2.newElm('tet', TUtilsV2.newImg(item.icon),  TUtilsV2.newElm('teb.color-rarity-'+item.rarity, name), TUtilsV2.newElm('div.flexbox-fill'))];

		if('defense' in item && item.defense) {
			const defense = (typeof item.defense  == "number")
				? item.defense
				: this.LUT_DEFENSE[Math.min(100, (item.defense[0] + context.character.level))] * item.defense[1];

			parts.push(TUtilsV2.newElm('te', TUtilsV2.newElm('tem', 'Defense: ', TUtilsV2.newElm('span.color-stat-green', String(defense)))));
		}

		if('power' in item) {
			let power;
			if('mul' in item.power) {
				let minRarity : keyof typeof this.LUT_RARITY = 'Common';
				if(['PlayerLevelScaleRarity', 'ItemScale4'].includes(item.power.scaling!)) {
					//NOTE(Rennorb) @hardcoded: these thresholds are apparently from a config
					if(context.character.level >= 14) minRarity = 'Uncommon'; // content:Configuration?guid=Wu52xQQYEUWiDdyKv+jf2Q==
					else if(context.character.level >= 30) minRarity = 'Rare'; // content:Configuration?guid=AX9BmdFkNkuyIpWOz58kmA==
					else if(context.character.level >= 60) minRarity = 'Exotic'; // content:Configuration?guid=X6vQWpTe2Ui+LPdJTv560g==
					else if(context.character.level >= 80) minRarity = 'Legendary'; // content:Configuration?guid=W2O5W4HAPEy3GJFfaSt4mQ==
				}
				let index = Math.max(this.LUT_RARITY[item.rarity], this.LUT_RARITY[minRarity]);
				if(!item.power.scaling) //no scaling means ItemLevel scaling
					index += item.level;
				else { //any of the other three
					index += context.character.level;
				}

				const avg = (context.character.isPlayer ? this.LUT_POWER_PLAYER : this.LUT_POWER_MONSTER)[Math.min(100, index)] * item.power.mul;
				const spread = avg * item.power.spread;
				power = [Math.ceil(avg - spread), Math.ceil(avg + spread)];
			}
			else {
				power = item.power;
			}

			parts.push(TUtilsV2.newElm('te', TUtilsV2.newElm('tem', 'Weapon Strength: ', TUtilsV2.newElm('span.color-stat-green', `${power[0]} - ${power[1]}`))));
		}

		if('tiers' in item) {
			parts.push(this.generateUpgradeItemGroup(item, context));
		}

		if(statSet && 'attribute_base' in item) {
			parts.push(...statSet.attributes.map(({attribute, base_value, scaling}) => {
				const computedValue = Math.round(base_value + item.attribute_base! * scaling);
				return TUtilsV2.newElm('te', TUtilsV2.newElm('tem.color-stat-green', `+${computedValue} ${attribute}`));
			}));
		}

		if('slots' in item && slottedItems) {
			parts.push(TUtilsV2.newElm('div.group.slots', ...item.slots.map(s => {
				let slottedItemIdx;
				//TODO(Rennorb) @correctness @cleanup: this should use UpgradeComponent Flags
				switch(s) {
					case 'Upgrade'   : slottedItemIdx = slottedItems!.findIndex(i => ['Rune', 'Sigil', 'Gem'].includes(i.subtype) || (i.subtype == 'Default' && i.flags.includes('Pvp'))); break;
					case 'Infusion'  : slottedItemIdx = slottedItems!.findIndex(i => i.subtype == 'Default'); break;
					case 'Enrichment': slottedItemIdx = slottedItems!.findIndex(i => i.subtype == 'Default'); break;
				}

				if(slottedItemIdx > -1) {
					const slottedItem = slottedItems!.splice(slottedItemIdx, 1)[0];
					const group = this.generateUpgradeItemGroup(slottedItem, context);
					const name = this.formatItemName(slottedItem, context, statSet);
					group.prepend(TUtilsV2.newElm('tet', TUtilsV2.newImg(slottedItem.icon, 'iconsmall'),  TUtilsV2.newElm('teb.color-rarity-'+slottedItem.rarity, name), TUtilsV2.newElm('div.flexbox-fill')));
					return group;
				}
				else {
					return TUtilsV2.newElm('te',
						TUtilsV2.newImg(this.ICONS['SLOT_'+s as keyof typeof this.ICONS], 'iconsmall'), `Empty ${s} Slot`
					)
				}
			})));
		}

		const metaInfo = TUtilsV2.newElm('div.group');
		if(item.type == "Armor" || item.type == "Weapon" || item.type == "Trinket") {
			metaInfo.append(TUtilsV2.newElm('span.color-rarity-'+item.rarity, item.rarity));
			if('weight' in item) metaInfo.append(TUtilsV2.newElm('span', item.weight));
			metaInfo.append(TUtilsV2.newElm('span', `${item.type}: ${item.subtype}`));
			if(item.type == "Weapon" && this.isTwoHanded(item.subtype)) metaInfo.append(TUtilsV2.newElm('span.color-rarity-Junk', `(Two-Handed)`));
			if(item.required_level) metaInfo.append(TUtilsV2.newElm('span', 'Required Level: '+item.required_level));
			if(item.description) metaInfo.append(TUtilsV2.newElm('span', TUtilsV2.fromHTML(TUtilsV2.GW2Text2HTML(item.description))));
		}
		else {
			if(item.description) metaInfo.append(TUtilsV2.newElm('span', TUtilsV2.fromHTML(TUtilsV2.GW2Text2HTML(item.description))));
		}

		if(!item.flags.includes('Pvp')) { //NOTE(Rennorb): pvp items (runes / sigils) don't show these
			if(item.flags.includes('Unique')) metaInfo.append(TUtilsV2.newElm('span', 'Unique'));
			if(item.flags.includes('AccountBound')) metaInfo.append(TUtilsV2.newElm('span', 'Account Bound'));
			else if(item.flags.includes('SoulbindOnAcquire')) metaInfo.append(TUtilsV2.newElm('span', 'Soulbound on Acquire'));
			//TODO(Rennorb): soulbind on use
		}
		//TODO(Rennorb): salvage

		if(item.vendor_value) {
			let inner = ['Vendor Value: ', this.formatCoins(item.vendor_value * stackSize)];
			if(stackSize > 1)
				inner.push(' (', this.formatCoins(item.vendor_value), ` x ${stackSize})`);
			metaInfo.append(TUtilsV2.newElm('span', ...inner));
		}

		parts.push(metaInfo);

		const tooltip = TUtilsV2.newElm('div.tooltip.item.active', ...parts);
		tooltip.dataset.id = String(item.id);
		return tooltip;
	}

	static generateUpgradeItemGroup(item : API.ItemBase & (API.UpgradeComponentDetail | API.ConsumableDetail), context : Context) : HTMLElement {
		const group = TUtilsV2.newElm('div.group');
		for(const [i, tier] of item.tiers.entries()) {
			let tier_wrap = TUtilsV2.newElm('te');
			if(tier.description) tier_wrap.append(TUtilsV2.newElm('span', TUtilsV2.fromHTML(TUtilsV2.GW2Text2HTML(tier.description))));

			//NOTE(Rennorb): facts seem to exist, but almost universally be wrong.
			else if(tier.facts) {
				for(const fact of tier.facts) {
					const { wrapper } = FactsProcessor.generateFact(fact, null as any, context);
					if(wrapper) tier_wrap.append(wrapper);
				}
			}

			else if(tier.modifiers) {
				tier_wrap.style.flexDirection = "column";
				for(const modifier of tier.modifiers) {
					//TODO(Rennorb) @cleanup: unify this wth the buf fact processing
					let modifierValue = FactsProcessor.calculateModifier(modifier, context.character);

					let text;
					if(modifier.flags.includes('FormatPercent')) {
						text = `+${Math.round(modifierValue)}% ${TUtilsV2.mapLocale(modifier.description as any)}`;
					} else {
						text = `+${Math.round(modifierValue)} ${TUtilsV2.mapLocale(modifier.description as any)}`;
					}
					tier_wrap.append(TUtilsV2.newElm('te', text));
				}
			}
			
			const w = TUtilsV2.newElm('te', tier_wrap);
			if(item.subtype == "Rune") {
				const colorClass = i < (context.character.upgradeCounts[item.id] || 0) ? '.color-stat-green' : '';
				w.prepend(TUtilsV2.newElm('span'+colorClass, `(${i + 1})`));
			}
			group.append(w);
		}

		return group;
	}

	//TODO(Rennorb) @cleanup: probably move this
	static inferItemUpgrades(wrappers : Iterable<Element>) {
		const remainingInfusionsByContext = this.context.map(ctx => {
			const counts : Character['upgradeCounts'] = {};
			for(const [id, c] of Object.entries(ctx.character.upgradeCounts)) {
				let item;
				//NOTE(Rennorb): Pvp runes / sigils have type default; should fix this on the api side
				if((item = APICache.storage.items.get(+id)) && 'subtype' in item && item.subtype == 'Default' && !item.flags.includes('Pvp'))
					counts[id] = c;
			}
			return counts;
		});

		for(const wrapper of wrappers) {
		if(wrapper.childElementCount < 2) return;
			const [itemEl, ...upgradeEls] = wrapper.children;
			if(itemEl.getAttribute('type') !== 'item') return;

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
						//TODO(Rennorb): properly do enrichments
					}
				}
			}

			const attrString = upgradeIds.join(',');
			if(attrString) itemEl.setAttribute('slotted', attrString);
		}
	}

	//TODO(Rennorb) @cleanup: move
	static _legacy_transformEffectToSkillObject(gw2Object : HTMLElement, error_store : Set<string>) : number {
		const name = String(gw2Object.getAttribute('objId'));
		let id = ({
			blight                  : 62653,
			bloodstone_blessed      : 34917,
			blue_pylon_power        : 31317, //maybe wrong (vale guardian)
			chill                   : 722,
			quickness               : 1187,
			chilled                 : 722,
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
			champion_of_the_legions : 20845, //maybe wrong (rock fest thing?)
			compromised             : 35096,
			crowd_favor             : 36173, //maybe wrong (marionette)
			curse_of_frailty        : 53723, //maybe wrong (pirate fractal)
			dark_aura               : 39978,
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
			//q                       : ,
			reinforced_armor        : 9283,
			relentless_fire         : 62805,
			retaliation_ashym       : 24646, //maybe wrong
			sentinel_retribution    : 16350,
			shattering_ice          : 62909,
			shell_shocked           : 33361,
			spectral_darkness       : 31498,
			sticking_together       : 54604,
			synchronized_vitality   : 63840, //maybe wrong(ko)
			unnatural_signet        : 38224,
			use_soul_binder         : 55630,
			void_empowerment        : 68083,
			xeras_embrace           : 34979,
		} as any)[name]

		if(!id) {
			//NOTE(Rennorb): these don't actually exist and need to be synthesized.
			const hardCoded = ({
				barrier: {
					id: 1,
					name: 'Barrier',
					icon: this.ICONS.BARRIER,
					description: "Creates a health barrier that takes damage prior to the health bar. Barrier disappears 5s after being applied. Applying a barrier while one is already active will add to it, but the previously-existing barrier will still disappear 5s after it was originally applied. The amount of barrier generated is based on the source's healing power, and is capped at 50% of the recipient's maximum health.",
					description_brief: "Creates a health barrier that takes damage prior to the health bar.",
					categories: [], palettes: [],
				},
				stunbreak: {
					id: 2,
					name: 'Stun Break',
					description: 'Cancel control effects such as stuns.',
					icon: this.ICONS.STUN_BREAK,
					categories: [], palettes: [],
				}
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

	static calculateConditionDuration(level : number, expertise : number) {
		return expertise / (this.LUT_CRITICAL_DEFENSE[level] * (15 / this.LUT_CRITICAL_DEFENSE[80]));
	}

	static calculateBoonDuration(level : number, concentration : number) {
		return concentration / (this.LUT_CRITICAL_DEFENSE[level] * (15 / this.LUT_CRITICAL_DEFENSE[80]));
	}

	//TODO(Rennorb): have another look at the suffix. might still be missing in the export
	static formatItemName(item : API.Item, context : Context, statSet? : API.AttributeSet, upgradeComponent? : any, stackSize = 1) : string {
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

		name = name.replace('%str1%', arg1).replace('%str2%', arg2).replace('%str3%', arg3).replace('%str4%', arg4);

		if(item.flags.includes('Pvp') || item.flags.includes('PvpLobby'))
			name += " (PvP)";

		return name.replaceAll('[s]', stackSize > 1 ? 's' : '')
			.replaceAll(/(\S+)\[pl:"(.+?)"]/g, stackSize > 1 ? '$2' : '$1')
			.replaceAll(/(\S+)\[f:"(.+?)"]/g, context.character.sex == "Female" ? '$2' : '$1')
			.replaceAll('[lbracket]', '[').replaceAll('[rbracket]', ']')
			.replaceAll('[null]', '')
	}

	static formatCoins(amount : number) : HTMLElement {
		const parts = [String(Math.floor(amount % 100)), TUtilsV2.newImg(this.ICONS.COIN_COPPER, 'iconsmall', '')];
		if(amount > 99) parts.unshift(String(Math.floor((amount / 100) % 100)), TUtilsV2.newImg(this.ICONS.COIN_SILVER, 'iconsmall', ''));
		if(amount > 9999) parts.unshift(String(Math.floor(amount / 1_00_00)), TUtilsV2.newImg(this.ICONS.COIN_GOLD, 'iconsmall', ''));
		return TUtilsV2.newElm('span', ...parts);
	}

	static isTwoHanded(type : API.WeaponDetailType) {
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

	static LUT_DEFENSE = [
		115, 120, 125, 129, 133, 137, 142, 146, 150, 154, 162, 168, 175, 182, 189, 196, 202, 209, 216, 223, 232, 240, 248, 257, 265, 274, 282, 290, 299, 307, 319, 330, 341, 352, 363, 374, 385, 396, 407, 418, 431, 443, 456, 469, 481, 494, 506, 519, 532, 544, 560, 575, 590, 606, 621, 636, 651, 666, 682, 697, 714, 731, 748, 764, 781, 798, 815, 832, 848, 865, 885, 905, 924, 943, 963, 982, 1002, 1021, 1040, 1060, 1081, 1102, 1123, 1144, 1165, 1186, 1207, 1228, 1249, 1270, 1291, 1312, 1333, 1354, 1375, 1396, 1417, 1438, 1459, 1480, 1501,
	];

	static LUT_POWER_PLAYER = [
		170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 202, 207, 212, 217, 222, 227, 232, 237, 242, 247, 253, 259, 265, 271, 277, 283, 289, 295, 301, 307, 315, 323, 331, 339, 347, 355, 363, 371, 379, 387, 396, 405, 414, 423, 432, 441, 450, 459, 468, 477, 488, 499, 510, 521, 532, 543, 554, 565, 576, 587, 599, 611, 623, 635, 647, 659, 671, 683, 695, 707, 721, 735, 749, 763, 777, 791, 805, 819, 833, 847, 862, 877, 892, 907, 922, 937, 952, 967, 982, 997, 1012, 1027, 1042, 1057, 1072, 1087, 1102, 1117, 1132, 1147, 1162,
	];

	static LUT_POWER_MONSTER = [
		162, 179, 197, 214, 231, 249, 267, 286, 303, 322, 344, 367, 389, 394, 402, 412, 439, 454, 469, 483, 500, 517, 556, 575, 593, 612, 622, 632, 672, 684, 728, 744, 761, 778, 820, 839, 885, 905, 924, 943, 991, 1016, 1067, 1093, 1119, 1145, 1193, 1220, 1275, 1304, 1337, 1372, 1427, 1461, 1525, 1562, 1599, 1637, 1692, 1731, 1802, 1848, 1891, 1936, 1999, 2045, 2153, 2201, 2249, 2298, 2368, 2424, 2545, 2604, 2662, 2723, 2792, 2854, 2985, 3047, 3191, 3269, 3348, 3427, 3508, 3589, 3671, 3754, 3838, 3922, 4007, 4093, 4180, 4267, 4356, 4445, 4535, 4625, 4717, 4809, 4902,
	];

	static LUT_RARITY = {
		Junk     : 0,
		Basic    : 0,
		Common   : 1,
		Uncommon : 2,
		Rare     : 3,
		Exotic   : 4,
		Ascended : 4,
		Legendary: 4,
	};

	static LUT_CRITICAL_DEFENSE = [
		1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0, 5.2, 5.4, 5.6, 5.8, 6.0, 6.2, 6.4, 6.6, 6.8, 7.0, 7.3, 7.6, 7.9, 8.2, 8.5, 8.8, 9.1, 9.4, 9.7, 10.0, 10.3, 10.6, 10.9, 11.2, 11.5, 11.8, 12.1, 12.4, 12.7, 13.0, 13.4, 13.8, 14.2, 14.6, 15.0, 15.4, 15.8, 16.2, 16.6, 17.0, 17.4, 17.8, 18.2, 18.6, 19.0, 19.4, 19.8, 20.2, 20.6, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0, 25.5, 26.0, 26.5, 27.0, 27.5, 28.0, 28.5, 29.0, 29.5, 30.0, 30.5, 31.0,
	];

	static ICONS = {
		COIN_COPPER     : 156902,
		COIN_SILVER     : 156907,
		COIN_GOLD       : 156904,
		//NOTE(Rennorb): lower case to make it compatible with the enum
		SLOT_Upgrade    : 517197,
		SLOT_Infusion   : 517202,
		SLOT_Enrichment : 517204,

		RESOURCE        : 156649,
		RECHARGE        : 156651,
		ACTIVATION      : 496252,
		RANGE           : 156666,
		DEFIANCE_BREAK  : 1938788,
		GENERIC_FACT    : 156661,
		WEAPON_SWAP     : 156583,
		BARRIER         : 1770209,
		STUN_BREAK      : 156654,
	}
}

type SupportedTTTypes = API.Skill | API.Trait | API.Amulet; //TODO(Rennorb) @cleanup: once its finished


GW2TooltipsV2._constructor();
if(GW2TooltipsV2.config.autoInitialize) {
	GW2TooltipsV2.hookDocument(document)
		.then(_ => {
			//TODO(Rennorb) @cleanup: those routines could probably be combined into one when both options are active
			if(GW2TooltipsV2.config.autoCollectRuneCounts) {
				//TODO(Rennorb) @correctness: this might not work properly with multiple builds on one page
				const targets = document.getElementsByClassName('gw2-build');
				if(targets.length) for(const target of targets)
					Collect.allUpgradeCounts(GW2TooltipsV2.context, target)
				else {
					console.warn("[gw2-tooltips] [collect] `config.autoCollectRuneCounts` is active, but no element with class `gw2-build` could be found to use as source. Upgrades will not be collected as there is no way to tell which upgrades belongs to the build and which ones are just in some arbitrary text.");
				}
			}

			if(GW2TooltipsV2.config.autoCollectStatSources) {
				const targets = document.getElementsByClassName('gw2-build');
				if(targets.length) for(const target of targets)
					Collect.allStatSources(GW2TooltipsV2.context, target)
				else {
					console.warn("[gw2-tooltips] [collect] `config.autoCollectStatSources` is active, but no element with class `gw2-build` could be found to use as source. Build information will not be collected as there is no way to tell which objects belong to the build definition and which ones are just in some arbitrary text.");
				}
			}

			if(GW2TooltipsV2.config.autoInferEquipmentUpgrades) {
				const targets = document.querySelectorAll('.weapon, .armor, .trinket');
				if(targets.length)
					GW2TooltipsV2.inferItemUpgrades(targets)
				else {
					console.warn("[gw2-tooltips] [collect] `config.autoInferEquipmentUpgrades` is active, but no wrapper elements element with class `'weapon`, `armor` or `trinket` could be found to use as source. No elements will be updated");
				}
			}
		})
}
