class FactsProcessor {
	static MissingBuff : API.Skill = {
		id               : 0,
		name             : 'Missing Buff',
		description      : 'This Buff failed to load',
		categories       : [],
		palettes         : [],
		modifiers        : [],
	}

	static calculateModifier(
		{ formula, base_amount, formula_param1: level_scaling, formula_param2 } : API.Modifier,
		{ level, stats: { power, conditionDmg, healing: healing_power }} : Character,
	) {
		//TODO(Rennorb): this is **screaming** tabledrive me
		switch (formula) {
			case 'BuffLevelLinear':
				return         level * level_scaling + base_amount
			case 'ConditionDamage':
				return         level * level_scaling + base_amount + conditionDmg * formula_param2
			case 'ConditionDamageSquared':
				return level * level * level_scaling + base_amount + conditionDmg * formula_param2
			case 'NoScaling':
				return                                 base_amount
			case 'Regeneration':
				return         level * level_scaling + base_amount + healing_power * formula_param2
			case 'RegenerationSquared':
				return level * level * level_scaling + base_amount + healing_power * formula_param2
			case 'SpawnScaleLinear':
			case 'TargetLevelLinear':
				return         level * level_scaling + base_amount
			case 'BuffFormulaType11':
				return         level * level_scaling + base_amount - formula_param2
			case 'Power':
				return         level * level_scaling + base_amount + power * formula_param2
			case 'PowerSquared':
				return level * level * level_scaling + base_amount + power * formula_param2
		}

		console.warn('[gw2-tooltips] [facts processor] Could not find formula #', formula, ', using base amount for now!')
		return base_amount; //TODO(Rennorb) @correctness
	}

	/** @param facts should already be context resolved */
	static generateFacts(facts : API.Fact[], weaponStrength : number, context : Context) : HTMLElement[] {
		let totalDefianceBreak = 0

		const factWraps = facts
			.sort((a, b) => a.order - b.order)
			.map(fact => {
				const { wrapper, defiance_break } = this.generateFact(fact, weaponStrength, context);
				totalDefianceBreak += defiance_break;
				return wrapper;
			})
			.filter(d => d) as HTMLElement[] // ts doesn't understand what the predicate does

		//TODO(Rennorb): This should use order 1003
		if(totalDefianceBreak > 0) {
			const defianceWrap = TUtilsV2.newElm('te.defiance',
				TUtilsV2.newImg('1938788.png', 'iconmed'),
				TUtilsV2.newElm('tem.color-defiance-fact', `Defiance Break: ${totalDefianceBreak}`)
			)
			factWraps.push(defianceWrap)
		}

		return factWraps
	}

	/** @param fact should already be context resolved */
	static generateFact(fact : API.Fact, weapon_strength : number, context : Context) : { wrapper? : HTMLElement, defiance_break : number } {
		let iconSlug = fact.icon

		const generateBuffDescription = (buff : API.Skill, fact : API.BuffFact | API.PrefixedBuffFact) => {
			let modsArray: string[] = []
			if(buff.modifiers) {
				const relevantModifiers = buff.modifiers.filter(modifier => (
					   (!modifier.trait_req || context.character.traits.includes(modifier.trait_req))
					&& (!modifier.mode || modifier.mode === context.gameMode)
				));
					
				//NOTE(Rennorb): Modifiers can 'stack'. For that reason we need to first collect the values and then create text from that, otherwise we get duplicates.
				let modsMap = new Map<number, { modifier : API.Modifier, value : number }>();
				for (let i = 0; i < relevantModifiers.length; i++) {
					const modifier = relevantModifiers[i];

					let entry = modsMap.get(modifier.id) || modsMap.set(modifier.id, { modifier: modifier, value: 0 }).get(modifier.id);
					let value = this.calculateModifier(modifier, context.character);
					if (modifier.attribute_conversion) {
					   value *= context.character.stats[TUtilsV2.Uncapitalize(modifier.attribute_conversion)];
					}

					entry!.value += value;

					if(modifier.flags.includes('SkipNextEntry')) {
						i++;
					}
				}

				for(let { value, modifier } of modsMap.values()) {
					if(modifier.flags.includes('Subtract')) {
						value -= 100;
					}

					if(modifier.flags.includes('MulByDuration')) {
						let duration = fact.duration / 1000;
						if(modifier.flags.includes('DivDurationBy3')) {
							duration /= 3;
						}
						if(modifier.flags.includes('DivDurationBy10')) {
							duration /= 10;
						}

						value *= duration || 1;
					}

					if(!modifier.flags.includes('NonStacking')) {
						value *= fact.apply_count;
					}

					let strValue = TUtilsV2.withUpToNDigits("toFixed", value, 2);

					if(modifier.flags.includes('FormatPercent')) {
						if(value > 0 ) {
							strValue = '+' + strValue;
						}
						strValue += "%"
					}
					strValue += ' ' + modifier.description;

					modsArray.push(strValue);
				}
			}

			return TUtilsV2.GW2Text2HTML(buff.description_brief || modsArray.join(', ') || buff.description)
		}

		//TODO(Rennorb) @cleanup: remove the jank spaces in the generated html
		const factInflators : { [k in typeof fact.type] : (params : HandlerParams<API.FactMap[k]>) => string } = {
			Time         : ({ fact }) => `<tem> ${fact.text}: ${fact.duration / 1000}s </tem>`,
			Distance     : ({ fact }) => `<tem> ${fact.text}: ${fact.distance} </tem>`,
			Number       : ({ fact }) => `<tem> ${fact.text}: ${fact.value} </tem>`,
			ComboField   : ({ fact }) => `<tem> ${fact.text}: ${fact.field_type} </tem>`,
			ComboFinisher: ({ fact }) => `<tem> ${fact.text}: ${fact.finisher_type} </tem>`,
			NoData       : ({ fact }) => `<tem> ${fact.text} </tem>`,
			Percent      : ({ fact }) => `<tem> ${TUtilsV2.GW2Text2HTML(fact.text)}: ${fact.percent}% </tem>`,
			Radius       : ({ fact }) => `<tem> ${fact.value} ${fact.text} </tem>`, //TODO(Rennorb) @completeness
			Range        : ({ fact }) => `<tem> ${fact.min ? fact.min + ' - ' : ''}${fact.max} ${fact.text || 'Range'} </tem>`,
			HealingAdjust: ({ fact }) => `<tem> ${fact.text || '<HA text undefined>'} </tem>`, //TODO(Rennorb) @completeness
			Heal         : () => `<tem> !!Heal </tem>`, //TODO(Rennorb) @completeness
			Duration     : () => `<tem> !!Duration </tem>`, //TODO(Rennorb) @completeness
			StunBreak    : () => `<tem> Breaks Stun </tem>`,
			Unblockable  : () => `<tem> Unblockable </tem>`,
			//now for the more complex ones
			PrefixedBuff : ({ fact, buff }) => {
				let prefix = APICache.storage.skills.get(fact.prefix)
				if(!prefix) {
					console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
					prefix = this.MissingBuff
				}
				iconSlug = prefix.icon || iconSlug
				if(!buff) {
					console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
					buff = this.MissingBuff
				}

				const seconds = fact.duration / 1000
				const durationText =  seconds ? `(${seconds}s)` : ''

				let htmlContent = `<te>${TUtilsV2.newImg(buff.icon, 'iconmed').outerHTML}<tem> ${buff.name_brief || buff.name} ${durationText}: ${generateBuffDescription(buff, fact)} </tem></te>`

				if(fact.apply_count && fact.apply_count > 1) {
					htmlContent += TUtilsV2.newElm('div.buffcount', fact.apply_count.toString()).outerHTML
				}
				return htmlContent
			},
			PrefixedBuffBrief: ({ fact, buff }) => {
				let prefix = APICache.storage.skills.get(fact.prefix)
				if(!prefix) {
					console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
					prefix = this.MissingBuff
				}
				iconSlug = prefix.icon || iconSlug
				if(!buff) {
					console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
					buff = this.MissingBuff
				}
				return `<te>${TUtilsV2.newImg(buff.icon, 'iconmed').outerHTML}<tem> ${buff.name_brief || buff.name} </tem></te>`
			},
			Buff: ({ fact, buff }) => {
				if(!buff) {
					console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
					buff = this.MissingBuff
				}
				iconSlug = buff.icon

				const seconds = fact.duration / 1000
				const durationText =  seconds ? `(${seconds}s)` : ''

				let htmlContent = `<tem> ${TUtilsV2.GW2Text2HTML(fact.text) || buff.name_brief || buff.name} ${durationText}: ${generateBuffDescription(buff, fact)} </tem>`

				if(fact.apply_count && fact.apply_count > 1) {
					htmlContent += TUtilsV2.newElm('div.buffcount', fact.apply_count.toString()).outerHTML
				}
				return htmlContent
			},
			BuffBrief: ({ fact, buff }) => {
				if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = buff || this.MissingBuff // in case we didn't get the buff we wanted from the api

				iconSlug = buff.icon
				let text = TUtilsV2.GW2Text2HTML(fact.text).replace("%str1%", buff.name);
				return `<tem> ${text} </tem> `
			},
			Damage: ({ fact, weaponStrength }) => {
				let hitCountLabel = '';
				//NOTE(Rennorb) The default formula is: weapon_strength * factor * power / target_armor.
				let damage = weaponStrength * fact.hit_count * fact.dmg_multiplier * context.character.stats.power / context.targetArmor;
				if(!fact.hit_count) console.warn("[gw2-tooltips] [facts processor] 0 hit count: ", fact); //TODO(Rennorb) @debug
				if(fact.hit_count > 1) {
					damage *= fact.hit_count;
					hitCountLabel = `(${fact.hit_count}x)`;
				}
				return `<tem> ${fact.text}: ${hitCountLabel} ${Math.round(damage)} </tem>`
			},
			AttributeAdjust: ({ fact }) =>{
				//TODO(Rennorb) @cleanup
				const attribute = (context.character.stats as any)[TUtilsV2.Uncapitalize(fact.target)] || 0
				const value = Math.round(fact.value + attribute * fact.attribute_multiplier + context.character.level ** fact.level_exponent * fact.level_multiplier)
				return `<tem> ${value > 0 ? '+'+value : value} ${fact.text || fact.target} </tem>`
			},
			BuffConversion : ({ fact }) =>{
				//TODO(Rennorb) @cleanup
				const attribute = (context.character.stats as any)[TUtilsV2.Uncapitalize(fact.source)] || 0
				const value = Math.round(attribute * fact.percent / 100)
				return `<tem> ${fact.text}: Converting ${fact.percent}% of ${fact.source} to +${value} ${fact.target} </tem>`
			}
		}

		const buff = APICache.storage.skills.get(fact.buff || 0)
		const data : HandlerParams = { fact, buff, weaponStrength: weapon_strength }
		const text = TUtilsV2.fromHTML(factInflators[fact.type](data as any))
		const wrapper = TUtilsV2.newElm('te')
		if(fact.requires_trait) wrapper.classList.add('color-traited-fact')
		if(iconSlug) wrapper.append(TUtilsV2.newImg(iconSlug, 'iconmed'))
		wrapper.append(text)

		return { wrapper, defiance_break: fact.defiance_break || 0 }
	}
}
