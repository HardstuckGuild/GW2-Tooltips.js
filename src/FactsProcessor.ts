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
				TUtilsV2.newImg(GW2TooltipsV2.ICONS.DEFIANCE_BREAK, 'iconmed'),
				TUtilsV2.newElm('tem.color-defiance-fact', `Defiance Break: ${totalDefianceBreak}`)
			)
			factWraps.push(defianceWrap)
		}

		return factWraps
	}

	/** @param fact should already be context resolved */
	static generateFact(fact : API.Fact, weapon_strength : number, context : Context) : { wrapper? : HTMLElement, defiance_break : number } {
		let iconSlug = fact.icon || GW2TooltipsV2.ICONS.GENERIC_FACT; // setting the default fact icon should happen on the api side

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

					let strValue = '';
					if(modifier.flags.includes('FormatFraction')) {
						strValue = TUtilsV2.drawFractional(value);
					}else{
						strValue = Math.floor(value).toString();
					}

					if(modifier.flags.includes('FormatPercent')) {
						if(value > 0 ) {
							strValue = '+' + strValue;
						}
						strValue += '%'
					}
					strValue += ' ' + modifier.description;

					modsArray.push(strValue);
				}
			}

			return TUtilsV2.GW2Text2HTML(buff.description_brief || modsArray.join(', ') || buff.description)
		}

		const factInflators : { [k in typeof fact.type] : (params : HandlerParams<API.FactMap[k]>) => HTMLElement[] } = {
			AdjustByAttributeAndLevelHealing : ({fact}) =>  {
				//TODO(Rennorb) @cleanup
				const attribute = (context.character.stats as any)[TUtilsV2.Uncapitalize(fact.target)] || 0;
				const value = Math.round((fact.value + attribute * fact.attribute_multiplier + context.character.level ** fact.level_exponent * fact.level_multiplier) * fact.hit_count);
				const text = TUtilsV2.GW2Text2HTML(fact.text) || TUtilsV2.mapLocale(attribute);
				const coefficent = window.GW2TooltipsConfig?.preferCorrectnessOverExtraInfo ? '' : ` (${TUtilsV2.withUpToNDigits('toFixed', fact.attribute_multiplier, 4)})`;
				return [TUtilsV2.newElm('tem', `${text}: ${value}${coefficent}`)];
			},
			AttributeAdjust : ({fact}) => {
				const value = Math.round((fact.range[1] - fact.range[0]) / (context.character.level / 80) + fact.range[0]);
				const sign = value > 0 ? '+' : ''
				const text = TUtilsV2.GW2Text2HTML(fact.text) || TUtilsV2.mapLocale(fact.target);
				return [TUtilsV2.newElm('tem', `${text}: ${sign}${value}`)];
			},
			Buff : ({fact, buff}) =>  {
				if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = buff || this.MissingBuff; // in case we didn't get the buff we wanted from the api
				iconSlug = buff.icon || iconSlug;

				let {duration, apply_count} = fact;
				// TODO(mithos) factor in condi/boon duration. how to decide which stat to use? 
				duration *= ((context.character.statModifier.outgoingBuffDuration[buff.id] || 0) + 100) / 100;

				let buffDescription = generateBuffDescription(buff, fact);
				if(buffDescription) {
					buffDescription = `: ${buffDescription}`;
				}

				const seconds = duration > 0 ? `(${TUtilsV2.drawFractional(duration / 1000)}s)`: '';

				let node = [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text) || buff.name_brief || buff.name} ${seconds}${buffDescription}`)]
				if(apply_count > 1) {
					node.push(TUtilsV2.newElm('div.buffcount', apply_count.toString()));
				}
				return node;
			},
			BuffBrief : ({fact, buff}) =>  {
				if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = buff || this.MissingBuff;
				iconSlug = buff.icon || iconSlug;

				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text).replace("%str1%", buff.name)}`)];
			},
			Distance : ({fact}) => {
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text)}: ${Math.round(fact.distance)}`)];
			},
			HealthAdjustHealing: ({ fact }) => {
				//TODO(Rennorb) @cleanup
				const attribute = (context.character.stats as any)[TUtilsV2.Uncapitalize(fact.attribute)] || 0;
				const value = Math.round((fact.value + attribute * fact.multiplier) * fact.hit_count);
				const text = TUtilsV2.GW2Text2HTML(fact.text) || TUtilsV2.mapLocale(fact.attribute);

				return [TUtilsV2.newElm('tem', `${text}: ${value}`)];
			},
			Number : ({fact}) => {
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.value)}`)];
			},
			Percent : ({fact}) => {
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.percent)}%`)];
			},
			PercentDamage : ({fact}) => {
				// TODO(mithos) game shows an actual raw number here. to implement this we need to get the characters damage
				//NOTE(Rennorb): this is going to be verry difficult if not impossible
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.percent)}%`)];
			},
			PercentLifeForceAdjust : ({fact: {percent, text}}) => {
				//NOTE(Rennorb): lifeforce is 69% of the hp pool
				//TODO(Rennorb): traits
				const raw = Math.round(GW2TooltipsV2.getHealth(context.character) * 0.69 * percent * 0.01);
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(percent)}% (${raw})`)];
			},
			PercentHealth : ({fact: {percent, text}}) => {
				const raw = Math.round((GW2TooltipsV2.getHealth(context.character) * percent) * 0.01);
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(percent)}% (${raw})`)];
			},
			//TODO(Rennorb): this seems to be verry much percent based. Whats the difference to PercentLifeForceAdjust here?
			LifeForceAdjust : ({fact: {percent, text}}) => {
				//NOTE(Rennorb): lifeforce is 69% of the hp pool
				//TODO(Rennorb): traits
				const raw = Math.round(GW2TooltipsV2.getHealth(context.character) * 0.69 * percent * 0.01);
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(percent)}% (${raw})`)];
			},
			Damage : ({fact, weaponStrength}) => {
				const {dmg_multiplier, hit_count, text} = fact;
				const times = hit_count > 1 ? `(${hit_count}x)` : '';
				const damage = hit_count * weaponStrength * dmg_multiplier * context.character.stats.power / context.targetArmor;
				const coefficent = window.GW2TooltipsConfig?.preferCorrectnessOverExtraInfo ? '' : ` (${TUtilsV2.withUpToNDigits('toFixed', dmg_multiplier * hit_count, 4)})`;
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}${times}: ${Math.round(damage)}${coefficent}`)];
			},
			Time : ({fact}) => {
				const {duration, text} = fact;
				const time = duration != 1000 ? 'seconds' : 'second';
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(duration / 1000)} ${time}`)];
			},
			ComboField : ({fact}) =>  {
				const {field_type, text} = fact;
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.mapLocale(field_type)}`)];
			},
			ComboFinisher : ({fact}) => {
				const {finisher_type, text} = fact;
				return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.mapLocale(finisher_type)}`)];
			},
			BuffConversion : ({fact}) => {
				return [TUtilsV2.newElm('tem', `Gain ${fact.target} Based on a Percentage of ${fact.source}: ${fact.percent}%`)];
			},
			NoData : ({fact}) => {
				return [TUtilsV2.newElm('tem', TUtilsV2.GW2Text2HTML(fact.text))];
			},
			PrefixedBuff : ({fact, buff}) => {
				let prefix = APICache.storage.skills.get(fact.prefix);
				if(!prefix) console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
				prefix = prefix || this.MissingBuff;
				iconSlug = prefix.icon || iconSlug;

				if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = buff || this.MissingBuff; // in case we didn't get the buff we wanted from the api

				let {duration, apply_count, text} = fact;
				// TODO(mithos) factor in condi/boon duration. how to decide which stat to use? 
				duration *=  ((context.character.statModifier.outgoingBuffDuration[buff.id] || 0) + 100) / 100;

				let buffDescription = generateBuffDescription(buff, fact);
				if(buffDescription) {
					buffDescription = `: ${buffDescription}`;
				}

				const seconds = duration > 0 ? `(${TUtilsV2.drawFractional(duration / 1000)}s)`: '';

				let node = TUtilsV2.newElm('te',
					TUtilsV2.newImg(buff.icon, 'iconmed'),
					TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text) || buff.name_brief || buff.name} ${seconds}${buffDescription}`)
				);

				if(apply_count > 1) {
					node.appendChild(TUtilsV2.newElm('div.buffcount', apply_count.toString()));
				}
				return [node];
			},
			PrefixedBuffBrief : ({fact, buff}) => {
				let prefix = APICache.storage.skills.get(fact.prefix)
				if(!prefix) console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
				prefix = prefix || this.MissingBuff;
				iconSlug = prefix.icon || iconSlug

				if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = buff || this.MissingBuff; // in case we didn't get the buff we wanted from the api

				let node = TUtilsV2.newElm('te',
					TUtilsV2.newImg(buff.icon, 'iconmed'),
					TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text) || buff.name_brief || buff.name}`)
				);

				return [node]
			},
			Range : ({fact}) => {
				const {min ,max} = fact;
				if(window.GW2TooltipsConfig?.preferCorrectnessOverExtraInfo) {
					return [TUtilsV2.newElm('tem', `Range: ${max}`)];
				}
				const range = min ? `${min} - ${max}` : max;
				return [TUtilsV2.newElm('tem', `Range: ${range}`)];
			},
			StunBreak : ({fact}) => {
				return [TUtilsV2.newElm('tem', "Breaks Stun")];
			},
		}

		const buff = APICache.storage.skills.get(fact.buff || 0)
		const data : HandlerParams = { fact, buff, weaponStrength: weapon_strength }
		const text = factInflators[fact.type](data as any)
		const wrapper = TUtilsV2.newElm('te')
		if(fact.requires_trait) {
			wrapper.classList.add('color-traited-fact')
		}
		wrapper.append(TUtilsV2.newImg(iconSlug, 'iconmed'))
		wrapper.append(... text)

		return { wrapper, defiance_break: fact.defiance_break || 0 }
	}
}
