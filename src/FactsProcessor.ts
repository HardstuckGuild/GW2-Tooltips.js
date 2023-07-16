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
			const defianceWrap = TUtilsV2.newElm('div.fact',
				TUtilsV2.newImg(GW2TooltipsV2.ICONS.DEFIANCE_BREAK, 'iconmed'),
				TUtilsV2.newElm('div.color-defiance-fact', `Defiance Break: ${totalDefianceBreak}`)
			)
			factWraps.push(defianceWrap)
		}

		return factWraps
	}

	/** @param fact should already be context resolved */
	static generateFact(fact : API.Fact, weapon_strength : number, context : Context) : { wrapper? : HTMLElement, defiance_break : number } {
		let iconSlug : Parameters<typeof TUtilsV2.newImg>[0] = fact.icon;
		let buffStackSize = 1;
		let buffDuration = fact.duration;

		const generateBuffDescription = (buff : API.Skill, fact : API.BuffFact | API.PrefixedBuffFact) => {
			let modsArray: string[] = []
			if(buff.modifiers) {
				//TODO(Rennorb) @consistency: gamemode splitting for mods (?)
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

		const calculateBuffDuration = (duration : Milliseconds, buff : API.Skill, detailStack : string[]) : number => {
			detailStack.push(`base duration: ${TUtilsV2.drawFractional(duration / 1000)}s`);
			let durMod = 1;

			const relevantStat : keyof Stats | false = (buff.buff_type == 'Boon' && 'concentration') || (buff.buff_type == 'Condition' && 'expertise');
			if(relevantStat) {
				const rawValue = context.character.stats[relevantStat];
				// every 15 points add 1%
				durMod += rawValue / 15 * 0.01;
				if(rawValue > 0)
					detailStack.push(`+${TUtilsV2.withUpToNDigits(rawValue / 15, 2)}% from ${rawValue} ${relevantStat}`);
			}

			//TODO(Rennorb) @correctness: this is probably not quite stable, but its good enough for now
			let durModStack = context.character.statSources[buff.id];
			if(durModStack) {
				let percentMod = 0;
				for(const { source, modifier, count } of durModStack) {
					const mod = this.calculateModifier(modifier, context.character);
					detailStack.push(`${source} ${count > 1 ? `(x ${count})` : ''}: ${mod > 0 ? '+' : ''}${mod}%`);
					percentMod += mod;
				}
				durMod += percentMod / 100;
			}
			duration *= durMod;

			return duration;
		}

		const factInflators : { [k in typeof fact.type] : (params : HandlerParams<API.FactMap[k]>) => (string|HTMLElement)[] } = {
			AdjustByAttributeAndLevelHealing : ({fact}) =>  {
				const attribute = (context.character.stats as any)[TUtilsV2.Uncapitalize(fact.target)] || 0; //TODO(Rennorb) @cleanup
				const value = Math.round((fact.value + attribute * fact.attribute_multiplier + context.character.level ** fact.level_exponent * fact.level_multiplier) * fact.hit_count);

				const lines = [`${TUtilsV2.GW2Text2HTML(fact.text) || TUtilsV2.mapLocale(attribute)}: ${value}`];

				if(!GW2TooltipsV2.config.preferCorrectnessOverExtraInfo) {
					lines.push(`${fact.value} base value`);
					if(fact.level_multiplier) lines.push(`+ ${TUtilsV2.withUpToNDigits(context.character.level ** fact.level_exponent * fact.level_multiplier, 2)} from lvl ${context.character.level} ^ ${fact.level_exponent} level exp. * ${fact.level_multiplier} level mul.`);
					if(attribute) lines.push(`+ ${fact.value + attribute} from ${attribute} ${TUtilsV2.mapLocale(fact.target)} * ${fact.attribute_multiplier} attrib mod.`);
					if(fact.hit_count != 1) lines.push(` * ${fact.hit_count} hits`);
				}

				return lines;
			},
			AttributeAdjust : ({fact}) => {
				const value = Math.round((fact.range[1] - fact.range[0]) / (context.character.level / 80) + fact.range[0]);
				const sign = value > 0 ? '+' : ''
				const text = TUtilsV2.GW2Text2HTML(fact.text) || TUtilsV2.mapLocale(fact.target);
				return [`${text}: ${sign}${value}`];
			},
			Buff : ({fact, buff}) =>  {
				if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = buff || this.MissingBuff; // in case we didn't get the buff we wanted from the api
				iconSlug = buff.icon || iconSlug;

				const details : string[] = [];
				buffDuration = calculateBuffDuration(fact.duration, buff, details);

				let buffDescription = generateBuffDescription(buff, fact);
				if(buffDescription) {
					buffDescription = `: ${buffDescription}`;
				}

				const seconds = buffDuration > 0 ? `(${TUtilsV2.drawFractional(buffDuration / 1000)}s)`: '';
				const lines = [`${TUtilsV2.GW2Text2HTML(fact.text) || buff.name_brief || buff.name} ${seconds}${buffDescription}`];
				// only push if we have more than a base value
				if(details.length > 1) lines.push(...details);

				buffStackSize = fact.apply_count;
				return lines;
			},
			BuffBrief : ({fact, buff}) =>  {
				if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = buff || this.MissingBuff;
				iconSlug = buff.icon || iconSlug;

				return [`${TUtilsV2.GW2Text2HTML(fact.text).replace("%str1%", buff.name)}`];
			},
			Distance : ({fact}) => {
				return [`${TUtilsV2.GW2Text2HTML(fact.text)}: ${Math.round(fact.distance)}`];
			},
			HealthAdjustHealing: ({ fact }) => {
				//TODO(Rennorb) @cleanup
				const attribute = (context.character.stats as any)[TUtilsV2.Uncapitalize(fact.attribute)] || 0;
				const value = Math.round((fact.value + attribute * fact.multiplier) * fact.hit_count);
				const text = TUtilsV2.GW2Text2HTML(fact.text) || TUtilsV2.mapLocale(fact.attribute);

				return [`${text}: ${value}`];
			},
			Number : ({fact}) => {
				return [`${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.value)}`];
			},
			Percent : ({fact}) => {
				return [`${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.percent)}%`];
			},
			PercentDamage : ({fact}) => {
				// TODO(mithos) game shows an actual raw number here. to implement this we need to get the characters damage
				//NOTE(Rennorb): this is going to be verry difficult if not impossible
				return [`${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.percent)}%`];
			},
			PercentLifeForceAdjust : ({fact: {percent, text}}) => {
				const hpPool = GW2TooltipsV2.getHealth(context.character);

				const lines = [];
				if(!GW2TooltipsV2.config.preferCorrectnessOverExtraInfo) {
					if(context.character.statSources.lifeForce.length) {
						lines.push(`${percent * hpPool * 0.69} from ${percent}% * (${hpPool} HP * 0.69) base pool`);

						let percentMod = 100;
						for(const { source, modifier, count } of context.character.statSources.lifeForce) {
							const mod = this.calculateModifier(modifier, context.character);
							lines.push(`${source}${count > 1 ? ` (x ${count})` : ''}: ${mod > 0 ? '+' : ''}${mod}%`);
							percentMod += mod;
						}
						percent *= percentMod / 100;
					}
				}

				//NOTE(Rennorb): lifeforce is 69% of the hp pool
				let raw = Math.round(hpPool * 0.69 * percent * 0.01);
				lines.unshift(`${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(percent)}% (${raw})`);

				return lines;
			},
			PercentHealth : ({fact: {percent, text}}) => {
				const raw = Math.round((GW2TooltipsV2.getHealth(context.character) * percent) * 0.01);
				return [`${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(percent)}% (${raw})`];
			},
			//TODO(Rennorb) @correctness: this seems to be verry much percent based. Whats the difference to PercentLifeForceAdjust here?
			LifeForceAdjust : ({fact: {percent, text}}) => {
				const hpPool = GW2TooltipsV2.getHealth(context.character);

				const lines = [];
				if(!GW2TooltipsV2.config.preferCorrectnessOverExtraInfo) {
					if(context.character.statSources.lifeForce.length) {
						lines.push(`${percent * 0.01 * hpPool * 0.69} from ${percent}% * (${hpPool} HP * 0.69) base pool`);

						let percentMod = 100;
						for(const { source, modifier, count } of context.character.statSources.lifeForce) {
							const mod = this.calculateModifier(modifier, context.character);
							lines.push(`${source}${count > 1 ? ` (x ${count})` : ''}: ${mod > 0 ? '+' : ''}${mod}%`);
							percentMod += mod;
						}
						percent *= percentMod / 100;
					}
				}

				//NOTE(Rennorb): lifeforce is 69% of the hp pool
				let raw = Math.round(hpPool * 0.69 * percent * 0.01);
				lines.unshift(`${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(percent)}% (${raw})`);
				
				return lines;
			},
			Damage : ({fact: {dmg_multiplier, hit_count, text}, weaponStrength}) => {
				const times = hit_count > 1 ? `(${hit_count}x)` : '';
				let damage = dmg_multiplier * hit_count * weaponStrength * context.character.stats.power / context.targetArmor;

				const lines = [];
				if(!GW2TooltipsV2.config.preferCorrectnessOverExtraInfo) {
					lines.push(`${context.character.stats.power} power * ${weaponStrength} avg. weapon str. / ${context.targetArmor} target armor`);
					lines.push(`* ${TUtilsV2.withUpToNDigits(dmg_multiplier, 4)} internal mod.`);
					if(hit_count != 1) lines.push(`* ${hit_count} hits`);

					if(context.character.statSources.damage.length) {
						let percentMod = 100;
						for(const { source, modifier, count } of context.character.statSources.damage) {
							const mod = this.calculateModifier(modifier, context.character);
							lines.push(`${source}${count > 1 ? ` (x ${count})` : ''}: ${mod > 0 ? '+' : ''}${mod}%`);
							percentMod += mod;
						}
						damage *= percentMod / 100;
					}
				}

				lines.unshift(`${TUtilsV2.GW2Text2HTML(text)}${times}: ${Math.round(damage)}`);

				return lines;
			},
			Time : ({fact}) => {
				const time = fact.duration != 1000 ? 'seconds' : 'second';
				return [`${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.duration / 1000)} ${time}`];
			},
			ComboField : ({fact}) =>  {
				return [`${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.mapLocale(fact.field_type)}`];
			},
			ComboFinisher : ({fact}) => {
				return [`${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.mapLocale(fact.finisher_type)}`];
			},
			BuffConversion : ({fact}) => {
				return [`Gain ${TUtilsV2.mapLocale(fact.target)} Based on a Percentage of ${TUtilsV2.mapLocale(fact.source)}: ${fact.percent}%`];
			},
			NoData : ({fact}) => {
				return [TUtilsV2.GW2Text2HTML(fact.text)];
			},
			PrefixedBuff : ({fact, buff}) => {
				let prefix = APICache.storage.skills.get(fact.prefix);
				if(!prefix) console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
				prefix = prefix || this.MissingBuff;
				iconSlug = prefix.icon || iconSlug;

				if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = buff || this.MissingBuff; // in case we didn't get the buff we wanted from the api

				let {duration, apply_count, text} = fact;

				const details : string[] = [];
				buffDuration = calculateBuffDuration(duration, buff, details);

				let buffDescription = generateBuffDescription(buff, fact);
				if(buffDescription) {
					buffDescription = `: ${buffDescription}`;
				}

				const seconds = buffDuration > 0 ? `(${TUtilsV2.drawFractional(buffDuration / 1000)}s)`: '';

				const list : (string|HTMLElement)[] = [TUtilsV2.newElm('div',
					this.generateBuffIcon(buff.icon, apply_count),
					TUtilsV2.newElm('span', `${TUtilsV2.GW2Text2HTML(text) || buff.name_brief || buff.name} ${seconds}${buffDescription}`)
				)];
				// only push if we have more than a base value
				if(details.length > 1) list.push(...details);

				return list;
			},
			PrefixedBuffBrief : ({fact, buff}) => {
				let prefix = APICache.storage.skills.get(fact.prefix)
				if(!prefix) console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
				prefix = prefix || this.MissingBuff;
				iconSlug = prefix.icon || iconSlug

				if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = buff || this.MissingBuff; // in case we didn't get the buff we wanted from the api

				let node = TUtilsV2.newElm('div',
					TUtilsV2.newImg(buff.icon),
					TUtilsV2.newElm('span', `${TUtilsV2.GW2Text2HTML(fact.text) || buff.name_brief || buff.name}`)
				);

				return [node]
			},
			Range : ({fact: {min, max}}) => {
				if(GW2TooltipsV2.config.preferCorrectnessOverExtraInfo) {
					return [`Range: ${max}`];
				}
				return [`Range: ${min ? `${min} - ${max}` : max}`];
			},
			StunBreak : () => {
				return ["Breaks Stun"];
			},
		}

		const buff = APICache.storage.skills.get(fact.buff || 0)
		const data : HandlerParams = { fact, buff, weaponStrength: weapon_strength }
		const [firstLine, ...remainingDetail] = factInflators[fact.type](data as any)
		const wrapper = TUtilsV2.newElm('div.fact')
		if(fact.requires_trait) {
			wrapper.classList.add('color-traited-fact')
		}

		let defianceBreak = 0;
		if(fact.defiance_break) {
			defianceBreak = fact.defiance_break * (buffDuration || 1000) / 1000;
			const breakDetail = (buffDuration != undefined && buffDuration != 1000) ? ` (${fact.defiance_break}/s)` : '';
			remainingDetail.push(TUtilsV2.newElm('span.detail.color-defiance-fact', `Defiance Break: ${defianceBreak}${breakDetail}`))
		}

		wrapper.append(this.generateBuffIcon(iconSlug, buffStackSize))
		wrapper.append(TUtilsV2.newElm('div', firstLine, ...remainingDetail.map(d => typeof d == 'string' ? TUtilsV2.newElm('span.detail', d) : d)));

		return { wrapper, defiance_break: defianceBreak }
	}

	static generateBuffIcon(icon : Parameters<typeof TUtilsV2.newImg>[0], stackSize = 1) : HTMLElement {
		const img = TUtilsV2.newImg(icon);
		if(stackSize == 1) {
			return img;
		}
		else {
			const wrap = TUtilsV2.newElm('span.buff-ico', img);
			wrap.setAttribute('count', String(stackSize));
			return wrap;
		}
	}
}
