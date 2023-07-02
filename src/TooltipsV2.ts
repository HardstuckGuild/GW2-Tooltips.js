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
//TODO(Rennorb): specs, pets, and amulets endpoints.
//TODO(Rennorb): item defense / weapon power (scaling)



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
				conditionDamage: 0,
				expertise      : 0,
				concentration  : 0,
				healing        : 0,
				critDamage     : 0,
			},
		},
	}
	static createCompleteContext(partialContext : PartialContext) : Context {
		const stats = Object.assign({}, this.defaultContext.character.stats, partialContext.character?.stats);
		const character = Object.assign({}, this.defaultContext.character, partialContext.character, { stats });
		return Object.assign({}, this.defaultContext, partialContext, { character });
	}

	config : Config;
	static defaultConfig : Config = {
		autoInitialize        : true,
		adjustIncorrectStatIds: true,
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
				const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
				const stackSize = +String(gw2Object.getAttribute('count')) || undefined;

				if(type != 'skills' && type != 'traits' && type != 'pvp/amulets' && type != "items") return; //TODO(Rennorb): others disabled for now


				const data = APICache.storage[type].get(objId) //TODO(Rennorb) @cleanup: move into generateToolTipList?
				if(data) {
					if(type == 'items') {
						const statId = +String(gw2Object.getAttribute('stats')) || undefined;
						this.tooltip.replaceChildren(this.generateItemTooltip(data as API.Item, context, statId, stackSize));
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

		if(statsToGet.size > 0) APICache.ensureExistence('itemstats', statsToGet.values());

		Object.entries(objectsToGet).forEach(async ([key, values]) => {
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
		})
	}

	inflateGenericIcon(gw2Object : HTMLElement, data : { name : string, icon? : string }) {
		const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(data.icon, undefined, data.name));
		wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + TUtilsV2.GW2Text2HTML(data.name.replaceAll(/%str\d%/g, ''))
		.replaceAll(/\[.*?\]/g, '');
		wikiLink.target = '_blank';
		if(gw2Object.classList.contains('gw2objectembed')) wikiLink.append(data.name);
		gw2Object.append(wikiLink);
	}
	inflateItem(gw2Object : HTMLElement, item : API.Item) {
		const stackSize = +String(gw2Object.getAttribute('count')) || 1;
		const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];

		const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(item.icon, undefined, item.name));
		wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + TUtilsV2.GW2Text2HTML(item.name.replaceAll(/%str\d%/g, ''))
		.replaceAll(/\[.*?\]/g, '');
		wikiLink.target = '_blank';
		if(gw2Object.classList.contains('gw2objectembed')) wikiLink.append(this.formatItemName(item, context, undefined, undefined, stackSize));
		gw2Object.append(wikiLink);
	}
	inflateSpecialization(gw2Object : HTMLElement, spec: API.Specialization) {
		//TODO(Rennorb): this is probably wrong for inlines
		gw2Object.style.backgroundImage = `url(${spec.background})`;
		gw2Object.dataset.label = spec.name;
	}

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
						console.error(`[gw2-tooltips] [tooltip engine] unknown palette type '${palette.type}' for skill '${skill.name}'`)
				}
			}
		}
		return skillSlot
	}

	getRecharge(apiObject : { facts : API.Fact[], facts_override? : API.FactsOverride[] }, gameMode : GameMode) : Milliseconds | undefined {
		let recharge = apiObject.facts.find(f => f.type === 'Recharge');
		let override = apiObject.facts_override?.find(f => f.mode === gameMode)?.facts.find(f => f.type === 'Recharge');
		return (override || recharge)?.duration;
	}

	// TODO(Rennorb) @cleanup: split this into the inflator system aswell. its getting to convoluted already
	generateToolTip(apiObject : SupportedTTTypes, context : Context) : HTMLElement {
		let recharge : HTMLElement | '' = ''
		if('facts' in apiObject) {
			const _recharge = this.getRecharge(apiObject, context.gameMode);
			if(_recharge) {
				recharge = TUtilsV2.newElm('ter', 
					(_recharge / 1000)+'s', 
					TUtilsV2.newImg('156651.png', 'iconsmall')
				);
			}
		}

		const headerElements = [TUtilsV2.newElm('teb', TUtilsV2.GW2Text2HTML(apiObject.name))];
		
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
			parts.push(...FactsProcessor.generateFacts(apiObject, context))
		}

		const tooltip = TUtilsV2.newElm('div.tooltip', ...parts)
		tooltip.dataset.id = String(apiObject.id)
		tooltip.style.marginTop = '5px' //TODO(Rennorb) @cleanup

		return tooltip;
	}

	generateToolTipList(initialAPIObject : SupportedTTTypes, gw2Object: HTMLElement, context : Context) : HTMLElement[] {
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

		const tooltipChain = objectChain.map(obj => this.generateToolTip(obj, context));
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

	generateItemTooltip(item : API.Item, context : Context, statSetId? : number, stackSize = 1) : HTMLElement {
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

		const countPrefix = stackSize > 1 ? stackSize + ' ' : '';
		const name = countPrefix + this.formatItemName(item, context, statSet, undefined, stackSize);
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
			const group = TUtilsV2.newElm('div.group');
			for(const [i, tier] of item.tiers.entries()) {
				let tier_wrap = TUtilsV2.newElm('te');
				if(tier.description) tier_wrap.append(TUtilsV2.newElm('span', TUtilsV2.fromHTML(TUtilsV2.GW2Text2HTML(tier.description))));

				//NOTE(Rennorb): facts seem to exist, but almost universally be wrong.
				/*
				if(tier.facts) for(const fact of tier.facts) {
					const { wrapper } = FactsProcessor.generateFact(fact, null as any, context);
					if(wrapper) tier_wrap.append(wrapper);
				}
				*/

				/*
				if(tier.modifiers) for(const modifier of tier.modifiers) {
					//TODO(Rennorb) @cleanup: unify this wth the buf fact processing 
					let modifierValue = FactsProcessor.calculateModifier(modifier, context.character)

					let text;
					if(modifier.flags.includes('FormatPercent')) {
						text = `${Math.round(modifierValue)}% ${modifier.description}`
					} else {
						text = `${Math.round(modifierValue)} ${modifier.description}`
					}
					tier_wrap.append(TUtilsV2.newElm('te', text));
				}
				*/
				const w = TUtilsV2.newElm('te', tier_wrap);
				if(item.subtype == "Rune") w.prepend(`(${i + 1})`);
				group.append(w);
			}
			parts.push(group);
		}

		if(statSet && 'attribute_base' in item) {
			parts.push(...statSet.attributes.map(({attribute, base_value, scaling}) => {
				const computedValue = Math.round(base_value + item.attribute_base! * scaling);
				return TUtilsV2.newElm('te', TUtilsV2.newElm('tem.color-stat-green', `+${computedValue} ${attribute}`));
			}));
		}

		if('slots' in item) {
			parts.push(TUtilsV2.newElm('div.group.slots', ...item.slots.map(s => TUtilsV2.newElm('te',
				TUtilsV2.newImg(this.ICONS['SLOT_'+s as keyof typeof this.ICONS], 'iconsmall'), `Empty ${s} Slot`
			))));
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

		if(item.flags.includes('Unique')) metaInfo.append(TUtilsV2.newElm('span', 'Unique'));
		if(item.flags.includes('AccountBound')) metaInfo.append(TUtilsV2.newElm('span', 'Account Bound'));
		else if(item.flags.includes('SoulbindOnAcquire')) metaInfo.append(TUtilsV2.newElm('span', 'Soulbound on Acquire'));
		//TODO(Rennorb): soulbind on use
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

	formatItemName(item : API.Item, context : Context, statSet? : API.AttributeSet, upgradeComponent? : any, stackSize = 1) : string {
		let name;
		if(item.type == 'TraitGuide') {
			name = item.trait;
		}
		else {
			name = item.name;
		}

		let arg1, arg2, arg3, arg4;
		arg1 = arg2 = arg3 = arg4 = '';

		if(!item.flags.includes('HideSuffix')) {
			if(statSet && statSet.name) {
				arg1 = statSet.name;
				arg2 = " ";
			}

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

	formatCoins(amount : number) : HTMLElement {
		const parts = [String(Math.floor(amount % 100)), TUtilsV2.newImg(this.ICONS.COIN_COPPER, 'iconsmall', '')];
		if(amount > 99) parts.unshift(String(Math.floor((amount / 100) % 100)), TUtilsV2.newImg(this.ICONS.COIN_SILVER, 'iconsmall', ''));
		if(amount > 9999) parts.unshift(String(Math.floor(amount / 1_00_00)), TUtilsV2.newImg(this.ICONS.COIN_GOLD, 'iconsmall', ''));
		return TUtilsV2.newElm('span', ...parts);
	}

	isTwoHanded(type : API.WeaponDetailType) {
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

	LUT_DEFENSE = [
		115, 120, 125, 129, 133, 137, 142, 146, 150, 154, 162, 168, 175, 182, 189, 196, 202, 209, 216, 223, 232, 240, 248, 257, 265, 274, 282, 290, 299, 307, 319, 330, 341, 352, 363, 374, 385, 396, 407, 418, 431, 443, 456, 469, 481, 494, 506, 519, 532, 544, 560, 575, 590, 606, 621, 636, 651, 666, 682, 697, 714, 731, 748, 764, 781, 798, 815, 832, 848, 865, 885, 905, 924, 943, 963, 982, 1002, 1021, 1040, 1060, 1081, 1102, 1123, 1144, 1165, 1186, 1207, 1228, 1249, 1270, 1291, 1312, 1333, 1354, 1375, 1396, 1417, 1438, 1459, 1480, 1501,
	];

	LUT_POWER_PLAYER = [
		170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 202, 207, 212, 217, 222, 227, 232, 237, 242, 247, 253, 259, 265, 271, 277, 283, 289, 295, 301, 307, 315, 323, 331, 339, 347, 355, 363, 371, 379, 387, 396, 405, 414, 423, 432, 441, 450, 459, 468, 477, 488, 499, 510, 521, 532, 543, 554, 565, 576, 587, 599, 611, 623, 635, 647, 659, 671, 683, 695, 707, 721, 735, 749, 763, 777, 791, 805, 819, 833, 847, 862, 877, 892, 907, 922, 937, 952, 967, 982, 997, 1012, 1027, 1042, 1057, 1072, 1087, 1102, 1117, 1132, 1147, 1162,
	];

	LUT_POWER_MONSTER = [
		162, 179, 197, 214, 231, 249, 267, 286, 303, 322, 344, 367, 389, 394, 402, 412, 439, 454, 469, 483, 500, 517, 556, 575, 593, 612, 622, 632, 672, 684, 728, 744, 761, 778, 820, 839, 885, 905, 924, 943, 991, 1016, 1067, 1093, 1119, 1145, 1193, 1220, 1275, 1304, 1337, 1372, 1427, 1461, 1525, 1562, 1599, 1637, 1692, 1731, 1802, 1848, 1891, 1936, 1999, 2045, 2153, 2201, 2249, 2298, 2368, 2424, 2545, 2604, 2662, 2723, 2792, 2854, 2985, 3047, 3191, 3269, 3348, 3427, 3508, 3589, 3671, 3754, 3838, 3922, 4007, 4093, 4180, 4267, 4356, 4445, 4535, 4625, 4717, 4809, 4902,
	];

	LUT_RARITY = {
		Junk     : 0,
		Basic    : 0,
		Common   : 1,
		Uncommon : 2,
		Rare     : 3,
		Exotic   : 4,
		Ascended : 4,
		Legendary: 4,
	};

	ICONS = {
		COIN_COPPER     : 156902,
		COIN_SILVER     : 156907,
		COIN_GOLD       : 156904,
		//NOTE(Rennorb): lower case to make it compatible with the enum
		SLOT_Upgrade    : 517197,
		SLOT_Infusion   : 517202,
		SLOT_Enrichment : 517204,
	}
}

type SupportedTTTypes = API.Skill | API.Trait | API.Amulet; //TODO(Rennorb) @cleanup: once its finished


const gw2tooltips = new GW2TooltipsV2()
if(gw2tooltips.config.autoInitialize) gw2tooltips.hookDocument(document)
