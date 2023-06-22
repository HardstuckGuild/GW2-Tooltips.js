//TODO(Rennorb) @issues:
// The way that affecting traits are captures also seems wrong, but i haven't looked into that yet. 
// The user needs to specify what traits should be used or we may provide a capture function for them that can be called on a trait object, but we should never to it automagically.
//TODO(Rennorb): Provide a clean way to construct custom tooltips. Currently with the old version we manipulate the cache before the hook function gets called, which really isn't the the best.
//TODO(Rennorb): Think about bundling everything with something like rollup so way we can also easily produce minified versions, although we will have to introduce node-modules for that which i strongly dislike.
//TODO(Rennorb): Multi skill tooltips (multiple boxes) (kindof works nit not complete)
//TODO(Rennorb): Option to show whole skill-chain (maybe on button hold)?
//TODO(Rennorb): Stop using these jank custom tags. There is no reason to do so and its technically not legal per html spec.
//TODO(Rennorb): The positioning code seems a bit wired, it tends to 'stick' to the borders more than it should.
//TODO(Rennorb) @fixme: impale: the impale buff doesn't have a name, only shows duration
//TODO(Rennorb): Figure out how to handle boon descriptions. Have a toggle between 'realistic as in game' and 'full information'
//TODO(Rennorb) @correctness: Some of the code uses very aggressive rounding resulting in wrong numbers in some places. Look over this again.
// In general only round right before displaying a number, calculations always happen with non rounded values.
//TODO(Rennorb): Trait game-mode splits
//TODO(Rennorb): Link minion skills to minion summon skill.
//TODO(Rennorb) @cleanup: go over gamemode splitting again, currently ist a huge mess. 
//TODO(Rennorb): Add item stats to tooltips.
//TODO(Rennorb): specs, items, pets, itemstats and amulets endpoints.



type TypeBridge<T, K extends keyof T> = [K, T[K]]
declare interface ObjectConstructor {
	entries<T>(obj : T) : TypeBridge<T, keyof T>[]
}

//TODO(Rennorb) @cleanup: make static class or just turn the whole project into a module with functions only.
// Instances aren't needed for anything here.
class GW2TooltipsV2 {
	tooltip      : HTMLElement
	
	cycleTooltipsHandler? : VoidFunction;
	cycling = false
	cyclePos!    : number  
	baseTooltip! : number
	lastMouseX!  : number
	lastMouseY!  : number

	context : Context[] = [];
	static defaultContext : Context = {
		traits     : [],
		gameMode   : 'Pve',
		targetArmor: 2597,
		stats      : {
			level          : 80,
			power          : 1000,
			toughness      : 1000,
			vitality       : 1000,
			precision      : 1000,
			ferocity       : 1000,
			conditionDamage: 0,
			expertise      : 0,
			concentration  : 0,
			healing        : 0,
			critDamage     : 0,
		},
	}
	static createCompleteContext(partialContext : PartialContext) : Context {
		const stats = Object.assign({}, this.defaultContext.stats, partialContext.stats)
		return Object.assign({}, this.defaultContext, partialContext, { stats });
	}

	config : Config;
	static defaultConfig : Config = {
		autoInitialize: true,
	}

	constructor() {
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

		this.tooltip = TUtilsV2.newElm('div.tooltipWrapper')
		this.tooltip.style.display = 'none';
		document.body.appendChild(this.tooltip)

		document.addEventListener('mousemove', event => {
			gw2tooltips.lastMouseX = event.pageX
			gw2tooltips.lastMouseY = event.pageY
			if(this.tooltip.style.display != 'none')
				gw2tooltips.positionTooltip()
		})
		document.addEventListener('contextmenu', event => {
			if(!this.cycleTooltipsHandler) return;
			event.preventDefault()
			this.cycleTooltipsHandler();
		})
	}

	displayCorrectChainTooltip(tooltips: HTMLElement[], tooltipIndex: number) {
		for(let index = 0; index < tooltips.length; index++) {
			tooltips[index].classList.toggle('active', index === tooltipIndex);
		}
	}
	cycleTooltips() {
		if(!this.cycling) return
		this.cycling = true

		const chainTooltips = Array.from(this.tooltip.children) as HTMLElement[]
		this.cyclePos = chainTooltips.length - this.baseTooltip
		const totalTooltips = chainTooltips.length - this.baseTooltip
		this.cyclePos = (this.cyclePos - 1 + totalTooltips) % totalTooltips
		this.displayCorrectChainTooltip(chainTooltips, this.cyclePos);

		this.positionTooltip()
	}

	positionTooltip() {
		const tooltip = this.tooltip
		const wpadminbar = document.getElementById('wpadminbar') //TODO(Rennorb) @hardcoded: this accounts for the wordpress bar that might exist.
		const additionaloffset = wpadminbar ? wpadminbar.offsetHeight : 0

		let tooltipXpos = this.lastMouseX + 16
		if(this.lastMouseX + tooltip.offsetWidth + 22 > window.innerWidth) {
			tooltipXpos = window.innerWidth - 22 - tooltip.offsetWidth
		}
		let tooltipYpos = this.lastMouseY - 6 - tooltip.offsetHeight
		if(this.lastMouseY - tooltip.offsetHeight - 13 - document.documentElement.scrollTop < 0) {
			tooltipYpos = additionaloffset + 6 + document.documentElement.scrollTop
		}

		tooltip.style.transform = `translate(${tooltipXpos}px, ${tooltipYpos}px)`
	}

	hookDocument(scope: { getElementsByTagName(qualifiedName: string): HTMLCollectionOf<Element> }, _unused? : any) : void {
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

		for(const gw2Object of scope.getElementsByTagName('gw2object') as HTMLCollectionOf<HTMLElement>) {
			const stats = +String(gw2Object.getAttribute('stats'))
			if(!isNaN(stats)) statsToGet.add(stats);

			const objId = +String(gw2Object.getAttribute('objId'))
			//TODO(Rennorb) @cleanup @compat: this is literally just for naming convenience.
			// Figure out if we can just get rid of the +'s' or if that poses an issue with backwards compat
			const type = (gw2Object.getAttribute('type') || 'skill') + 's'
			if(isNaN(objId) || !(type in objectsToGet)) continue;

			const elementsWithThisId = objectsToGet[type as keyof typeof objectsToGet].get(objId);
			if(elementsWithThisId) elementsWithThisId.push(gw2Object)
			else objectsToGet[type as keyof typeof objectsToGet].set(objId, [gw2Object])

			gw2Object.addEventListener('mouseenter', (e) => {
				const gw2Object = e.target as HTMLElement;
				const type = (gw2Object.getAttribute('type') || 'skill') as LegacyCompat.ObjectType + 's';
				const objId = +String(gw2Object.getAttribute('objId'))

				if(type != 'skills' && type != 'traits' && type != 'pvp/amulets' && type != "items") return; //TODO(Rennorb): others disabled for now

				const data = APICache.storage[type].get(objId) //TODO(Rennorb) @cleanup: move into generateToolTipList?
				if(data) {
					this.tooltip.replaceChildren(...this.generateToolTipList(data, gw2Object));
					this.tooltip.style.display = ''; //empty value resets actual value to use stylesheet
				}
			})
			gw2Object.addEventListener('mouseleave', () => {
				this.tooltip.style.display = 'none';
				this.cycleTooltipsHandler = undefined;
			})
		}

		if(statsToGet.size > 0) APICache.ensureExistence('itemstats', statsToGet.values());

		Object.entries(objectsToGet).forEach(async ([key, values]) => {
			if(values.size == 0) return;

			const inflator = this.inflators[key];
			const cache = APICache.storage[key];

			await APICache.ensureExistence(key, values.keys())

			for(const [id, objects] of values) {
				const data = cache.get(id);
				if(!objects || !data) continue;

				for(const gw2Object of objects)
					inflator(gw2Object, data as any); //TODO
			}
		})
	}

	//TODO(Rennorb) @cleanup: as it turns out they cal all be treated the same if you do the styling in the css. so this can probably be reduced to 
	// if(spec) special tereatment
	// else generic
	inflators : InflatorMap = (function() {
		const genericIconInflater = () => (gw2Object : HTMLElement, data : { name : string, icon? : string }) => {
			const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(data.icon, undefined, data.name));
			wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + data.name;
			wikiLink.target = '_blank';
			if(gw2Object.classList.contains('gw2objectembed')) wikiLink.append(data.name);
			gw2Object.append(wikiLink);
		}

		return {
			skills: genericIconInflater(),
			traits: genericIconInflater(),
			items: genericIconInflater(),
			specializations: function (gw2Object: HTMLElement, spec: API.Specialization): void {
				gw2Object.style.backgroundImage = `url(${spec.background})`;
				gw2Object.dataset.label = spec.name;
			},
			pets: genericIconInflater(),
			"pvp/amulets": genericIconInflater(),
		}
	})()

	//TODO(Rennorb): this is neither complete, nor reliable 
	getSlotName(skill: API.Skill) : string | undefined {
		let skillSlot
		for(const palette of skill.palettes) {
			for(const slot of palette.slots) {
				switch (palette.type) {
					case 'Equipment':
						if(palette.weapon_type !== 'None') {
							//TODO(Rennorb) @cleanup: move this to the api side
							const replaceFn = (_: string, __: string, digit: string) => {
								if(
									['Greatsword', 'Hammer', 'BowLong', 'Rifle', 'BowShort', 'Staff'].includes(palette.weapon_type) &&
									['Offhand1', 'Offhand2'].includes(slot.slot)
								) {
									digit = digit === '1' ? '4' : '5'
								}
								return `${palette.weapon_type} ${digit}`
							}
							skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, replaceFn)
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
					case 'Profession':
						skillSlot = slot.slot
						break;
					case 'Monster':
						break;
					default:
						console.error(`unknown palette type '${palette.type}' for skill '${skill.name}'`)
				}
			}
		}
		return skillSlot
	}

	getRecharge(apiObject : { facts : API.Fact[], facts_override? : API.FactsOverride[] }, gameMode : GameMode) : API.Duration | undefined {
		let recharge = apiObject.facts.find(f => f.type === 'Recharge');
		let override = apiObject.facts_override?.find(f => f.mode === gameMode)?.facts.find(f => f.type === 'Recharge');
		return (override || recharge)?.duration;
	}

	// TODO(Rennorb) @cleanup: split this into the inflator system aswell. its getting to convoluted already
	generateToolTip(apiObject : SupportedTTTypes, context : Context, stats? : API.ItemStat, additionalFacts? : API.Fact[]) : HTMLElement {
		let recharge : HTMLElement | '' = ''
		if('facts' in apiObject) {
			const _recharge = this.getRecharge(apiObject, context.gameMode);
			if(_recharge) {
				recharge = TUtilsV2.newElm('ter', 
					TUtilsV2.DurationToSeconds(_recharge)+'s', 
					TUtilsV2.newImg('156651.png', 'iconsmall')
				);
			}
		}

		const namePrefix = stats ? stats.name + ' ' : '';
		const headerElements = [TUtilsV2.newElm('teb', namePrefix + TUtilsV2.GW2Text2HTML(apiObject.name))];
		
		//TODO(Rennorb): slots stuff might not be doable serverside since the server is missing context. this is at least a case of @cleanup
		if('palettes' in apiObject) headerElements.push(TUtilsV2.newElm('tes', `( ${this.getSlotName(apiObject)} )`));
		else if('slot' in apiObject) headerElements.push(TUtilsV2.newElm('tes', `( ${apiObject.slot} )`));

		if('facts_override' in apiObject && apiObject.facts_override) {
			//TODO(Rennorb) @cleanup: this section
			const remainder = new Set<GameMode>(['Pve', 'Pvp', 'Wvw']);
			const allModes = ['Pve', 'Pvp', 'Wvw'] as GameMode[];
			for(const mode of allModes) { //better not iterate the set here while removing elements
				for(const override of apiObject.facts_override) {
					if(mode == override.mode) {
						remainder.delete(mode);
					}
				}
			}

			const splits : string[] = [];
			let pushedRemainder = false;
			for(const mode of allModes) { //loop to keep sorting vaguely correct
				if(remainder.has(mode)) {
					if(pushedRemainder) continue;

					const text = Array.from(remainder).join('/');
					if(remainder.has(context.gameMode))
						splits.push(`<span style="color: var(--gw2-tt-color-text-accent) !important;">${text}</span>`);
					else
						splits.push(text);
					pushedRemainder = true;
				}
				else {
					if(mode == context.gameMode)
						splits.push(`<span style="color: var(--gw2-tt-color-text-accent) !important;">${mode}</span>`);
					else
						splits.push(mode);
				}
			}

			headerElements.push(TUtilsV2.newElm('tes', '( ', TUtilsV2.fromHTML(splits.join(' | ')), ' )'));
		}
		
		const parts : HTMLElement[] = [
			TUtilsV2.newElm('tet',
				...headerElements,
				TUtilsV2.newElm('div.flexbox-fill'),
				recharge
			)
		];
		
		if('description' in apiObject && apiObject.description) {
			const description = document.createElement('ted')
			description.innerHTML = `<teh>${TUtilsV2.GW2Text2HTML(apiObject.description)}</teh>`
			parts.push(description)
		}

		if('facts' in apiObject) {
			parts.push(...FactsProcessor.generateFacts(apiObject, context, additionalFacts))
		}

		const tooltip = TUtilsV2.newElm('div.tooltip', ...parts)
		tooltip.dataset.id = String(apiObject.id)
		tooltip.style.marginTop = '5px' //TODO(Rennorb) @cleanup

		return tooltip;
	}

	generateToolTipList(initialAPIObject : SupportedTTTypes, gw2Object: HTMLElement) : HTMLElement[] {
		const objectChain : SupportedTTTypes[] = []
		const validPaletteTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard']

		const addObjectsToChain = (currentSkill : SupportedTTTypes) => {
			objectChain.push(currentSkill)

			if('palettes' in currentSkill) {
				for(const palette of currentSkill.palettes) {
					for(const slot of palette.slots) {
						if(slot.next_chain && slot.profession !== 'None') {
							const nextSkillInChain = APICache.storage.skills.get(slot.next_chain);
							if(nextSkillInChain) {
								addObjectsToChain(nextSkillInChain)
							}
						}
					}
				}

				if(currentSkill.sub_skills) {
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

		const additionalFacts : API.Fact[] = [];
		const statSetId = +String(gw2Object.getAttribute('stats'));
		let statSet : API.ItemStat | undefined = undefined;
		if(!isNaN(statSetId)) {
			statSet = APICache.storage.itemstats.get(statSetId);
			if(!statSet) console.error(`itemstats #${statSetId} is missing in the cache`);
			else {
				for(const {attribute, value, multiplier} of statSet.attributes) {
					additionalFacts.push({
						type  : 'AttributeAdjust',
						icon  : '',
						order : -1,
						target: attribute,
						value,
						attribute_multiplier : multiplier,
						level_exponent       : 0,
						hit_count            : 0,
						level_multiplier     : 0,
					} as API.AttributeAdjustFact);
				}
			}
		}

		const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
		const tooltipChain = objectChain.map(obj => this.generateToolTip(obj, context, statSet, additionalFacts));
		this.tooltip.append(...tooltipChain)

		if(tooltipChain.length > 1) {
			gw2Object.classList.add('cycler')
			gw2Object.title = 'Right-click to cycle through tooltips'

			let currentTooltipIndex = 0
			this.displayCorrectChainTooltip(tooltipChain, currentTooltipIndex)

			this.cycleTooltipsHandler = () => {
				gw2tooltips.cycleTooltips() //TODO(Rennorb) @cleanup: why are there two functions with basically the same name
				currentTooltipIndex = (currentTooltipIndex + 1) % tooltipChain.length
				gw2tooltips.displayCorrectChainTooltip(tooltipChain, currentTooltipIndex)
				this.positionTooltip()
			};
		}
		else {
			tooltipChain[0].classList.add('active'); // single tooltip is always expanded
		}

		return tooltipChain
	}
}

type SupportedTTTypes = API.Skill | API.Trait | API.Amulet | API.Item; //TODO(Rennorb) @cleanup: once its finished


const gw2tooltips = new GW2TooltipsV2()
if(gw2tooltips.config.autoInitialize) gw2tooltips.hookDocument(document)
