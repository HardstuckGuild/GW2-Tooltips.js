//TODO(Rennorb) @issues:
// The way that affecting traits are captures also seems wrong, but i haven't looked into that yet. 
// The user needs to specify what traits should be used or we may provide a capture function for them that can be called on a trait object, but we should never to it automagically.
//TODO(Rennorb): Provide a clean way to construct custom tooltips. Currently with the old version we manipulate the cache before the hook function gets called, which really isn't the the best.
//TODO(Rennorb): This should also compile to a single file for ease of use, either we want to actually put everything back in one file or get tsc to merge the files in a simple way. Another option would be to bundle everything with something like rollup. That way we can also easily produce minified versions, although we will have to introduce node-modules for that which i strongly dislike.
//TODO(Rennorb): Multi skill tooltips (multiple boxes)
//TODO(Rennorb): Option to show whole skill-chain (maybe on button hold)?
//TODO(Rennorb): Stop using these jank custom tags. There is no reason to do so and its technically not legal per html spec.
//TODO(Rennorb): The positioning code seems a bit wired, it tends to 'stick' to the borders more than it should.
//TODO(Rennorb) @fixme: impale: the impale buff doesn't have a name, only shows duration
//TODO(Rennorb): Figure out how to handle boon descriptions. Have a toggle between 'realistic as in game' and 'full information'
//TODO(Rennorb) @correctness: Some of the code uses very aggressive rounding resulting in wrong numbers in some places. Look over this again.
// In general only round right before displaying a number, calculations always happen with non rounded values.
//TODO(Rennorb): Trait game-mode splits


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

		for(const gw2Object of scope.getElementsByTagName('gw2object') as HTMLCollectionOf<HTMLElement>) {
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
				const type = (gw2Object.getAttribute('type') || 'skill') + 's' as ObjectDataStorageKeys;
				const objId = +String(gw2Object.getAttribute('objId'))

				if(type != 'skills' && type != 'traits') return; //TODO(Rennorb): others disabled for now

				const data = APICache.storage[type].get(objId)
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

	inflators : InflatorMap = (function() {
		//TODO(Rennorb): can be changed once the icon url resolution is figured for types other than skills
		const genericIconInflater = (clazz : string = '', icon? : string) => (gw2Object : HTMLElement, data : { name : string, icon? : string }) => {
			const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(icon || data.icon, clazz, data.name));
			wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + data.name;
			wikiLink.target = '_blank';
			gw2Object.append(wikiLink);
		}

		return {
			skills: genericIconInflater('iconlarge'),
			traits: genericIconInflater(),
			items: genericIconInflater('', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAABJCAIAAAD+EZyLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAFhSURBVGhD7ZoxkoIwFIYfexa0cDwBnkArT4ElNnuDPQC2dtvaqyeQE1gt3CWSEAOoszuzJoy/838N/CSZ4Zu8FxoipZS8KR/2+o7QDRO6YUI3TOiGCd0woRsmdMOEbpjQDRO6YUI3TOiGCd0eUG1mUTTbVDa+Iv727bh6NVfW5B+Y+lxsRYr1KNKsjnZEb+YV99DtsVnX0Ay66X4KQP2TMk9Ekry0UalD2s/NE0kP5r4/3Yy0g9fYy/b+CcK5mQmdF+zm25c3ubPYj1ywfqv2u0LS5dxGkXg8FTn/PKy10aT2no5jG5v8NGHPku3C9o9GN+SghHW7K6tT5vYmPMHcfivBgfDnpnuk2O2dzPwzT+pvQnvy1wf8sN92f25x9m1kdGsZoTg71Qde23Jfk3LQkhT+g4EJ3TChGyZ0w4RumNANE7phQjdM6IYJ3TChGyZ0w4RumNANE7phQjdM6IaIyAXGxL3ck02bowAAAABJRU5ErkJggg=='),
			specializations: function (gw2Object: HTMLElement, spec: API.Specialization): void {
				gw2Object.style.backgroundImage = `url(${spec.background})`;
				gw2Object.dataset.label = spec.name;
			},
			pets: genericIconInflater('', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAABJCAIAAAD+EZyLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAFqSURBVGhD7dkxcoJAFMbxtzmLpMjkBHgCrHIKLLXJPbAMR7BKI54gnCBV5C5kFxYEmdHMwCPzMd+vcUCc8e8+lkJTlqUs1JN/XSK2YWIbJrZhYhsmtmFiGya2YWIbJrZhmqjtvDV960Ph3/o/E65bmFxKL4vzfWC2Z//OHe5H0foddGYy+shikfTzD3GKtO634CUU+f5pF6Q7tH49i8PamE0q4ta4c346fopGcsvUmcn6hMTZ8OCS2OjrpYMPTkilrfr+7XF11GRavWPNtglnshktY4K92K/7tVu508XpmEv8FlXXOKvn1964qtHZJ5uuVrrx2Y67x+agtZfc6Ixk7TZeg37bbCM4MMO6Re9JaO/F6w5vnwft49o9K/LjSafcz8hID7e76jHg9S+sN1VnMLgj8f83TGzDxDZMbMPENkxsw8Q2TGzDxDZMbMPENkxsw8Q2TGzDxDZMbMPENkxsw8Q2TGzDtNw2kV87CKi1eKVduQAAAABJRU5ErkJggg=='),
			"pvp/amulets": genericIconInflater('iconlarge', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAABJCAIAAAD+EZyLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAILSURBVGhD7Zo7csIwEEDlnMWmYDiBOQHQUHEEU0KTjpKOBsq4o6WiAZ8An4BJAb6LI602tvzBv2ESltnXoI/1efJKcoEVx7F4Uz7w9x1hN5qwG03YjSbsRhN2owm70YTdaMJuNGE3mrAbTdiNJuxGE3ajyYu4RbuhZQ13EWafQyO3YG4p5gHmidDELTj6wnVd4R//X04tc9P328BNqXmr/ew15NoQ13DfukJ4ZyORcvaEcLd3qNHoelUOyEp4UAGFZntsDWnoovA0go2MYTTZyRSpczOMCuMnE8BBkvmY+WQC2ZxEFZS7mY/mRjUb1VETk9HpEApvOlJpeyLDMjyccsEu5/AF9WI0VXOSI5v59nEc7dZyE5yxE3ux37rhctNhN1S7gZrbd3TO7g1EiVyK05drPOjZmNX5tpjLCcCw11v7+6HSTavNJr+ThRdRJfc0/DHcOpqxj6UtqXIDNREuHRwDR/kLOXNfApdFEg2NqXDTby23b9XW7iaXD9DodsVUls4hWOCxW7BZyrhf5dZLHyhdtja09Nf63pXfWI7svpTRpzo8nPQrSN7XyXWtVqjp2j50Uzd2ZksjMMVOtzieeBDhzvdKn+5l2IuLPOvTLbfu35OQNDup+wbk/87QhN1owm40YTeasBtN2I0m7EYTdqMJu9GE3WjCbjRhN5qwG03YjSbsRhN2o4gQPxqF5ksm6ZNyAAAAAElFTkSuQmCC'),
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

	// TODO(Rennorb): expand apiObject type
	generateToolTip(apiObject : API.Skill | API.Trait, context : Context) : HTMLElement {
		let recharge : HTMLElement | '' = ''
		if('recharge_override' in apiObject && apiObject.recharge_override.length) {
			const override = apiObject.recharge_override.find(override =>  override.mode === context.gameMode && TUtilsV2.DurationToSeconds(override.recharge));
			if(override && override.mode === context.gameMode && TUtilsV2.DurationToSeconds(override.recharge)) {
				recharge = TUtilsV2.newElm('ter', 
					TUtilsV2.DurationToSeconds(override.recharge)+'s', 
					TUtilsV2.newImg('156651.png', 'iconsmall')
				);
			}
		} else if('recharge' in apiObject && apiObject.recharge && TUtilsV2.DurationToSeconds(apiObject.recharge)) {
			recharge = TUtilsV2.newElm('ter', 
				TUtilsV2.DurationToSeconds(apiObject.recharge)+'s', 
				TUtilsV2.newImg('156651.png', 'iconsmall')
			);
		}

		const isSkill = 'recharge_override' in apiObject; //TODO(Rennorb): do the slot stuff serverside
		const basic = TUtilsV2.newElm('tet',
			TUtilsV2.newElm('teb', apiObject.name),
			TUtilsV2.newElm('tes', `( ${isSkill ? this.getSlotName(apiObject) : apiObject.slot} )`), TUtilsV2.newElm('div.flexbox-fill'),
			recharge
		)

		const description = document.createElement('ted')
		if(apiObject.description) description.innerHTML = `<teh>${TUtilsV2.GW2Text2HTML(apiObject.description)}</teh>`

		const tooltip = TUtilsV2.newElm('div.tooltip', 
			basic, description,
			...SkillsProcessor.generateFacts(apiObject, context)
		)
		tooltip.dataset.id = String(apiObject.id)
		tooltip.style.marginTop = '5px'

		return tooltip;
	}

	generateToolTipList(initialSkill: API.Skill | API.Trait, gw2Object: HTMLElement) : HTMLElement[] {
		const skillChain : (typeof initialSkill)[] = []
		const validTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard']

		const addSkillToChain = (currentSkill : API.Skill | API.Trait) => {
			skillChain.push(currentSkill)

			if('palettes' in currentSkill) {
				for(const palette of currentSkill.palettes) {
					for(const slot of palette.slots) {
						if(slot.next_chain && slot.profession !== 'None') {
							const nextSkillInChain = APICache.storage.skills.get(slot.next_chain);
							if(nextSkillInChain) {
								addSkillToChain(nextSkillInChain)
							}
						}
					}
				}

				if(currentSkill.sub_skills) {
					for(const subSkillId of currentSkill.sub_skills) {
						const subSkillInChain = APICache.storage.skills.get(subSkillId);
						if(subSkillInChain && subSkillInChain.palettes.some(palette => validTypes.includes(palette.type))) {
							addSkillToChain(subSkillInChain)
						}
					}
				}
			}
		}

		addSkillToChain(initialSkill)

		const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
		const chainTooltips = skillChain.map(skill => this.generateToolTip(skill, context));
		chainTooltips.forEach(tooltip => this.tooltip.append(tooltip))

		if(chainTooltips.length > 1) {
			gw2Object.classList.add('cycler')
			gw2Object.title = 'Right-click to cycle through tooltips'

			let currentTooltipIndex = 0
			this.displayCorrectChainTooltip(chainTooltips, currentTooltipIndex)

			this.cycleTooltipsHandler = () => {
				gw2tooltips.cycleTooltips() //TODO(Rennorb) @cleanup: why are there two functions with basically the same name
				currentTooltipIndex = (currentTooltipIndex + 1) % chainTooltips.length
				gw2tooltips.displayCorrectChainTooltip(chainTooltips, currentTooltipIndex)
				this.positionTooltip()
			};
		}
		return chainTooltips
	}
}


const gw2tooltips = new GW2TooltipsV2()
if(gw2tooltips.config.autoInitialize) gw2tooltips.hookDocument(document)
