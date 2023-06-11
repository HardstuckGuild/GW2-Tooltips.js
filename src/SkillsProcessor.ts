class SkillsProcessor {
	static MissingBuff : API.Skill = {
		id               : 0,
		name             : 'Missing Buff',
		description      : 'This Buff failed to load',
		chat_link        : '',
		facts            : [],
		categories       : [],
		range            : 0,
		recharge         : { secs: 0, nanos: 0 },
		recharge_override: [],
		activation       : { secs: 0, nanos: 0 },
		palettes         : [],
		modifiers        : [],
	}

	static calculateModifier(
		{ formula, base_amount, formula_param1: level_scaling, formula_param2 } : API.Modifier,
		{ level, power, conditionDamage: condition_damage, healing: healing_power } : Stats,
	) {
		//TODO(Rennorb): this is **screaming** tabledrive me
		switch (formula) {
			case 0:
				return         level * level_scaling + base_amount
			case 1:
				return         level * level_scaling + base_amount + condition_damage * formula_param2
			case 2:
				return level * level * level_scaling + base_amount + condition_damage * formula_param2
			case 6:
				return                                 base_amount
			case 7:
				return         level * level_scaling + base_amount + healing_power * formula_param2
			case 8:
				return level * level * level_scaling + base_amount + healing_power * formula_param2
			case 9:
			case 10:
				return         level * level_scaling + base_amount
			case 11:
				return         level * level_scaling + base_amount - formula_param2
			case 13:
				return         level * level_scaling + base_amount + power * formula_param2
			case 14:
				return level * level * level_scaling + base_amount + power * formula_param2
		}

		console.warn('Could not find formula #', formula, ', using base amount for now!')
		return base_amount; //TODO(Rennorb) @correctness
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

	static generateFacts(skill : API.Skill | API.Trait, context : Context) : HTMLElement[] {
		if(!skill.facts.length && !skill.facts_override) return []

		let totalDefianceBreak = 0

		const processFactData = (fact : API.Fact) => {
			if(fact.requires_trait && (!context.traits || !fact.requires_trait.some(reqTrait => context.traits.includes(reqTrait)))) {
				return null
			}

			let iconSlug = fact.icon

			if(fact.defiance_break) {
				totalDefianceBreak += fact.defiance_break
			}

			const factInflators : FactInflatorMap = {
				Time         : ({ fact }) => `<tem> ${fact.text}: ${TUtilsV2.DurationToSeconds(fact.duration)}s </tem>`,
				Distance     : ({ fact }) => `<tem> ${fact.text}: ${fact.distance} </tem>`,
				Number       : ({ fact }) => `<tem> ${fact.text}: ${fact.value} </tem>`,
				ComboField   : ({ fact }) => `<tem> ${fact.text}: ${fact.field_type} </tem>`,
				ComboFinisher: ({ fact }) => `<tem> ${fact.text}: ${fact.finisher_type} </tem>`,
				NoData       : ({ fact }) => `<tem> ${fact.text} </tem>`,
				Percent      : ({ fact }) => `<tem> ${TUtilsV2.GW2Text2HTML(fact.text)}: ${fact.percent}% </tem>`,
				Radius       : ({ fact }) => `<tem> ${fact.text} </tem>`, //TODO(Rennorb) @completeness
				Range        : ({ fact }) => `<tem> ${fact.text} </tem>`, //TODO(Rennorb) @completeness
				Recharge     : ({ fact }) => `<tem> ${fact.text} </tem>`, //TODO(Rennorb) @completeness
				HealingAdjust: ({ fact }) => `<tem> ${fact.text} </tem>`, //TODO(Rennorb) @completeness
				Heal         : () => `<tem> !!Heal </tem>`, //TODO(Rennorb) @completeness
				Duration     : () => `<tem> !!Duration </tem>`, //TODO(Rennorb) @completeness
				StunBreak    : () => `<tem> Breaks Stun </tem>`,
				Unblockable  : () => `<tem> Unblockable </tem>`,
				//now for the more complex ones
				PrefixedBuff : ({ fact }) => {
					let prefix = APICache.storage.skills.get(fact.prefix)
					if(!prefix) {
						console.error('prefix #', fact.prefix, ' is apparently missing in the cache');
						prefix = this.MissingBuff
					}
					iconSlug = prefix.icon || iconSlug
					let buff = APICache.storage.skills.get(fact.buff)
					if(!buff) {
						console.error('buff #', fact.buff, ' is apparently missing in the cache');
						buff = this.MissingBuff
					}
					return `<tem> ${TUtilsV2.newImg(buff.icon, 'iconmed').outerHTML} ${buff.name_brief || buff.name} </tem>`
				},
				PrefixedBuffBrief: ({ fact }) => {
					let prefix = APICache.storage.skills.get(fact.prefix)
					if(!prefix) {
						console.error('prefix #', fact.prefix, ' is apparently missing in the cache');
						prefix = this.MissingBuff
					}
					iconSlug = prefix.icon || iconSlug
					let buff = APICache.storage.skills.get(fact.buff)
					if(!buff) {
						console.error('buff #', fact.buff, ' is apparently missing in the cache');
						buff = this.MissingBuff
					}
					return `<tem> ${TUtilsV2.newImg(buff.icon, 'iconmed').outerHTML} ${buff.name_brief || buff.name} </tem>`
				},
				Buff: ({ fact, buff }) => {
					if(!buff) console.error('buff #', fact.buff, ' is apparently missing in the cache');
					buff = buff || this.MissingBuff // in case we didn't get the buff we wanted from the api

					let modifiers = ''
					iconSlug = buff.icon
					if(buff.modifiers) {
						for(const modifier of buff.modifiers) {
							if(
								(modifier.trait_req && !context.traits.includes(modifier.trait_req)) ||
								(modifier.mode && modifier.mode !== context.gameMode)
							) {
								continue
							}

							let modifierValue = this.calculateModifier(modifier, context.stats)

							if(
								modifier.flags.includes('MulByDuration') &&
								!modifier.flags.includes('FormatPercent') //TODO(Rennorb) @cleanup: move to api side
							) {
								modifierValue *= TUtilsV2.DurationToSeconds(fact.duration)
							}

							if(modifier.flags.includes('FormatPercent')) {
								if(modifier.flags.includes('NonStacking')) {
									modifiers += ` ${Math.round(modifierValue)}% ${modifier.description}`
								} else {
									modifiers += ` ${Math.round(fact.apply_count * modifierValue)}% ${modifier.description}`
								}
							} else {
								modifiers += ` ${Math.round(fact.apply_count * modifierValue)} ${modifier.description}`
							}
						}
					}

					//TORO(Rennorb) @cleanup @correctness: look at this again
					const description = TUtilsV2.GW2Text2HTML(buff.description_brief || buff.description || modifiers)
					const seconds = TUtilsV2.DurationToSeconds(fact.duration)
					const durationText =  seconds ? `(${seconds}s)` : ''

					let htmlContent = `<tem> ${buff.name_brief || buff.name} ${durationText} ${description} </tem>`

					if(fact.apply_count && fact.apply_count > 1) {
						htmlContent += TUtilsV2.newElm('div.buffcount', fact.apply_count.toString()).outerHTML
					}
					return htmlContent
				},
				BuffBrief: ({ fact, buff }) => {
					if(!buff) console.error('buff #', fact.buff, ' is apparently missing in the cache');
					buff = buff || this.MissingBuff // in case we didn't get the buff we wanted from the api

					iconSlug = buff.icon
					let text = TUtilsV2.GW2Text2HTML(fact.text).replace("%str1%", buff.name);
					return `<tem> ${text} </tem> `
				},
				Damage: ({ fact, skill }) => {
					//NOTE(Rennorb) The default formula is: weapon_strength * factor * power / target_armor.
					// 690.5 is the midpoint weapon strength for slot skills (except bundles).
					//TODO(Rennorb) @hardcoded @correctness: This value is hardcoded for usage with traits as they currently don't have any pointer that would provide weapon strength information.
					// This will probably fail in some cases where damage facts on traits reference bundle skills (e.g. kits).
					let weaponStrength = 690.5;
					if(skill.palettes?.length) {
						const relevantPalette = skill.palettes.find(palette => palette.slots.some(slot => slot.profession !== 'None'))

						if(relevantPalette) {
							weaponStrength = this.getWeaponStrength(relevantPalette)
						}
					}

					let hitCountLabel = '';
					let damage = weaponStrength * fact.hit_count * fact.dmg_multiplier * context.stats.power / context.targetArmor;
					if(!fact.hit_count) console.warn("0 hit count: ", fact); //TODO(Rennorb) @debug
					if(fact.hit_count > 1) {
						damage *= fact.hit_count;
						hitCountLabel = `(${fact.hit_count}x)`;
					}
					return `<tem> ${fact.text}: ${hitCountLabel} ${Math.round(damage)} </tem>`
				},
				AttributeAdjust: ({ fact }) =>{
					//TODO(Rennorb) @cleanup
					const attribute = (context.stats as any)[TUtilsV2.Uncapitalize(fact.target)] || 0
					const value = Math.round(fact.value + attribute * fact.attribute_multiplier + context.stats.level ** fact.level_exponent * fact.level_multiplier)
					return `<tem> ${fact.text || fact.target} : ${value > 0 ? '+'+value : value} </tem>`
				},
				BuffConversion : ({ fact }) =>{
					//TODO(Rennorb) @cleanup
					const attribute = (context.stats as any)[TUtilsV2.Uncapitalize(fact.source)] || 0
					const value = Math.round(attribute * fact.percent / 100)
					return `<tem> ${fact.text}: Converting ${fact.percent}% of ${fact.source} to +${value} ${fact.target} </tem>`
				}
			}

			const buff = APICache.storage.skills.get(fact.buff || 0)
			const data : HandlerParams = { fact, buff, skill } as any //TODO(Rennorb) @hammer
			const htmlContent = factInflators[fact.type](data as any) //TODO(Rennorb) @hammer

			return TUtilsV2.newElm('te', TUtilsV2.newImg(iconSlug, 'iconmed'), TUtilsV2.fromHTML(htmlContent))
		}

		const factWraps = 
			skill.facts
				.sort((a, b) => a.order - b.order)
				.map(processFactData)
				.filter(d => d) as HTMLElement[] // ts doesn't understand what the predicate does

		if((skill.facts.length == 0 || context.gameMode !== 'Pve') && skill.facts_override) {
			for(const override of skill.facts_override) {
				if(override.mode === context.gameMode) {
					const sortedOverrideFacts = [...override.facts].sort((a, b) => a.order - b.order)
					sortedOverrideFacts.forEach(fact => {
						const factWrap = processFactData(fact)
						if(factWrap) {
							factWraps.push(factWrap)
						}
					})
				}
			}
		}

		if(totalDefianceBreak > 0) {
			const defianceWrap = TUtilsV2.newElm('te.defiance',
				TUtilsV2.newImg('1938788.png', 'iconmed'),
				TUtilsV2.newElm('tem', `Defiance Break: ${totalDefianceBreak}`)
			)
			factWraps.push(defianceWrap)
		}

		if('range' in skill && skill.range) {
			const rangeWrap = TUtilsV2.newElm('te',
				TUtilsV2.newImg('156666.png', 'iconmed'),
				TUtilsV2.newElm('tem', `Range: ${skill.range}`)
			)
			factWraps.push(rangeWrap)
		}

		return factWraps
	}
}

type FactInflatorMap = {
	[k in API.FactType] : (params : HandlerParams<API.FactMap[k]>) => string
}
