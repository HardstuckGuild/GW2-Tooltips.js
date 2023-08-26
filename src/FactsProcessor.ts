export function calculateModifier(
	{ formula, base_amount, formula_param1: level_scaling, formula_param2 } : API.Modifier,
	{ level, stats: { power, conditionDmg, healing: healing_power }} : Character,
) {
	//TODO(Rennorb): this is **screaming** tabledrive me
	//TODO(Rennorb) @correctness: attribute conversion e.g. Bountiful Maintenance Oil
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
export function generateFacts(blocks : API.FactBlock[], weaponStrength : number, context : Context) : HTMLElement[] {
	const [looseBlock, ...remainingBlocks] = blocks;
	let totalDefianceBreak = 0

	const makeFactElements = (facts : API.Fact[] | undefined) => (!facts ? [] : facts
		.sort((a, b) => a.order - b.order)
		.map(fact => {
			const { wrapper, defiance_break } = generateFact(fact, weaponStrength, context);
			totalDefianceBreak += defiance_break;
			return wrapper;
		})
		.filter(d => d) as HTMLElement[] // ts doesn't understand what the predicate does
	);

	const elements = [];
	for(const block of remainingBlocks) {
		const wrapper = newElm('div.fact-block');
		if(block.trait_requirements) {
			//NOTE(Rennorb): If the trait is manually set on the object then we don't have it cached, so we just use the id if we don't have a name.
			const trait_names = joinWordList(block.trait_requirements.map(id => `'<span class="gw2-color-traited-fact">${APICache.storage.traits.get(id)?.name || id}</span>'`))
			wrapper.append(fromHTML(`<span class="detail">Block exists because of trait${block.trait_requirements.length == 1 ? '' : 's'} ${trait_names}</span>`));
		}
		if(block.description) wrapper.append(newElm('p.description', fromHTML(GW2Text2HTML(block.description))));

		const blockFacts = makeFactElements(block.facts);
		wrapper.append(...blockFacts);

		elements.push(wrapper);
	}

	if(looseBlock) elements.push(...makeFactElements(looseBlock.facts));

	//TODO(Rennorb): This should use order 1003
	if(totalDefianceBreak > 0) {
		const defianceWrap = newElm('div.fact',
			newImg(ICONS.DEFIANCE_BREAK, 'iconmed'),
			newElm('div.gw2-color-defiance-fact', `Defiance Break: ${withUpToNDigits(totalDefianceBreak, 2)}`)
		);
		elements.push(defianceWrap);
	}

	return elements
}

/** @param fact should already be context resolved */
export function generateFact(fact : API.Fact, weapon_strength : number, context : Context) : { wrapper? : HTMLElement, defiance_break : number } {
	let iconSlug : Parameters<typeof newImg>[0] = fact.icon;
	let buffStackSize = 1;
	let buffDuration = (fact as API.BuffFact).duration;

	const generateBuffDescription = (buff : API.Skill, fact : API.BuffFact | API.PrefixedBuffFact, duration : Milliseconds, valueMod : number  /* TODO(Rennorb): kindof a weird hack for now. maybe merge the two export functions? */) => {
		let modsArray: string[] = []
		if(buff.modifiers && !buff.description_brief) { // early bail to not have to do the work if we use the description anyways
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
				let value = calculateModifier(modifier, context.character);
				if (modifier.attribute_conversion) {
						value *= context.character.stats[Uncapitalize(modifier.attribute_conversion)];
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
					duration /= 1000;
					if(modifier.flags.includes('DivDurationBy3')) { //TODO(Rennorb): move to api side and remove this
						duration /= 3;
					}
					if(modifier.flags.includes('DivDurationBy10')) { //TODO(Rennorb): move to api side and remove this
						duration /= 10;
					}

					value *= duration || 1;
				}

				if(!modifier.flags.includes('NonStacking')) {
					value *= fact.apply_count;
				}

				if(modifier.formula.includes('Regeneration'))
					value *= valueMod;

				let strValue = modifier.flags.includes('FormatFraction')
					? drawFractional(value, config)
					: Math.floor(Math.fround(value)).toString();

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

		return GW2Text2HTML(buff.description_brief || modsArray.join(', ') || buff.description)
	}

	const applyMods = (duration : Milliseconds, buff : API.Skill, detailStack : (string | Node)[]) : [Milliseconds, number] => {
		let durMod = 1, valueMod = 1;
		const durationAttr : keyof Stats | false = (buff.buff_type == 'Boon' && 'concentration') || (buff.buff_type == 'Condition' && 'expertise');
		if(durationAttr) {
			const attribVal = context.character.stats[durationAttr];
			// every 15 points add 1%
			durMod += attribVal / 15 * 0.01;
			if(attribVal > 0 && config.showFactComputationDetail) {
				detailStack.push(`base duration: ${drawFractional(duration / 1000, config)}s`);
				detailStack.push(`+${withUpToNDigits(attribVal / 15, 2)}% from ${attribVal} ${durationAttr}`);
			}
		}

		//TODO(Rennorb) @correctness: this is probably not quite stable, but its good enough for now
		let durModStack = context.character.statSources[buff.id];
		if(durModStack) {
			//NOTE(Rennorb): Just in case we didn't have a stat duration increase. Im aware that this is jank, but i cant think of a better way rn.
			if(durMod === 1 && config.showFactComputationDetail) detailStack.push(`base duration: ${drawFractional(duration / 1000, config)}s`);
			let percentMod = 0;
			for(const { source, modifier, count } of durModStack) {
				const mod = calculateModifier(modifier, context.character);
				if(config.showFactComputationDetail)
					detailStack.push(newElm('span.detail', `${mod > 0 ? '+' : ''}${mod}% from `, fromHTML(source), count > 1 ? ` (x ${count})` : '')); //TODO(Rennorb) @cleanup: im not really happy with how this works right now. Storing html in the text is not what i like to do but it works for now. Multiple of this.
				percentMod += mod;
			}
			durMod += percentMod / 100;
		}
		duration *= durMod;

		if(buff.name.includes('Regeneration')) {
			let valueModStack = context.character.statSources.healEffectiveness;
			if(valueModStack.length) {
				//TODO(Rennorb)
				if(config.showFactComputationDetail)
					detailStack.push('regeneration value mods:');
				let percentMod = 0;
				for(const { source, modifier, count } of valueModStack) {
					const mod = calculateModifier(modifier, context.character);
					if(config.showFactComputationDetail)
						detailStack.push(newElm('span.detail', `${mod > 0 ? '+' : ''}${mod}% from `, fromHTML(source), count > 1 ? ` (x ${count})` : ''));
					percentMod += mod;
				}
				valueMod += percentMod / 100;
			}
		}


		return [duration, valueMod];
	}

	const factInflators : { [k in typeof fact.type] : (params : HandlerParams<API.FactMap[k]>) => (string|Node)[] } = {
		AdjustByAttributeAndLevelHealing : ({fact}) =>  {
			const attributeVal = (context.character.stats as any)[Uncapitalize(fact.target)] || 0; //TODO(Rennorb) @cleanup
			let value = (fact.value + attributeVal * fact.attribute_multiplier + context.character.level ** fact.level_exponent * fact.level_multiplier) * fact.hit_count;

			const lines = [];

			if(config.showFactComputationDetail) {
				lines.push(`${fact.value} base value`);
				if(fact.level_multiplier) lines.push(`+ ${withUpToNDigits(context.character.level ** fact.level_exponent * fact.level_multiplier, 2)} from lvl ${context.character.level} ^ ${fact.level_exponent} lvl exp. * ${fact.level_multiplier} lvl mul.`);
				if(attributeVal) lines.push(`+ ${withUpToNDigits(attributeVal * fact.attribute_multiplier, 2)} from ${attributeVal} ${mapLocale(fact.target)} * ${fact.attribute_multiplier} attrib mod.`);
				if(fact.hit_count != 1) lines.push(` * ${fact.hit_count} hits`);
			}

			if(!fact.text?.includes('Barrier')) { //TODO(Rennorb) @cleanup @correctness
				let percentMod = 100;
				for(const { source, modifier, count } of context.character.statSources.healEffectiveness) {
					const mod = calculateModifier(modifier, context.character);
					if(config.showFactComputationDetail)
						lines.push(newElm('span.detail', `${mod > 0 ? '+' : ''}${mod}% from `, fromHTML(source), count > 1 ? ` (x ${count})` : ''));
					percentMod += mod;
				}
				value *= percentMod / 100;
			}

			lines.unshift(`${GW2Text2HTML(fact.text) || mapLocale(fact.target)}: ${Math.round(value)}`);

			return lines;
		},
		AttributeAdjust : ({fact}) => {
			const value = Math.round((fact.range[1] - fact.range[0]) / (context.character.level / 80) + fact.range[0]);
			const sign = value > 0 ? '+' : ''
			const text = GW2Text2HTML(fact.text) || mapLocale(fact.target);
			return [`${text}: ${sign}${value}`];
		},
		Buff : ({fact, buff}) =>  {
			if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
			buff = buff || MISSING_BUFF; // in case we didn't get the buff we wanted from the api
			iconSlug = buff.icon || iconSlug;

			const lines : (string | Node)[] = [];
			let valueMod;
			[buffDuration, valueMod] = applyMods(fact.duration, buff, lines);

			let buffDescription = generateBuffDescription(buff, fact, buffDuration, valueMod);
			if(buffDescription) {
				buffDescription = `: ${buffDescription}`;
			}

			const seconds = buffDuration > 0 ? `(${drawFractional(buffDuration / 1000, config)}s)`: '';
			lines.unshift(`${GW2Text2HTML(fact.text) || buff.name_brief || buff.name} ${seconds}${buffDescription}`);

			buffStackSize = fact.apply_count;
			return lines;
		},
		BuffBrief : ({fact, buff}) =>  {
			if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
			buff = buff || MISSING_BUFF;
			iconSlug = buff.icon || iconSlug;

			return [`${GW2Text2HTML(fact.text, buff.name)}`];
		},
		Distance : ({fact}) => {
			return [`${GW2Text2HTML(fact.text)}: ${Math.round(fact.distance)}`];
		},
		HealthAdjustHealing: ({ fact }) => {
			//TODO(Rennorb) @cleanup @scaling
			const attribute = (context.character.stats as any)[Uncapitalize(fact.attribute)] || 0;
			const value = Math.round((fact.value + attribute * fact.multiplier) * fact.hit_count);
			const text = GW2Text2HTML(fact.text) || mapLocale(fact.attribute);

			return [`${text}: ${value}`];
		},
		Number : ({fact}) => {
			return [`${GW2Text2HTML(fact.text)}: ${drawFractional(fact.value, config)}`];
		},
		Percent : ({fact}) => {
			return [`${GW2Text2HTML(fact.text)}: ${drawFractional(fact.percent, config)}%`];
		},
		PercentDamage : ({fact}) => {
			// TODO(mithos) game shows an actual raw number here. to implement this we need to get the characters damage
			//NOTE(Rennorb): this is going to be verry difficult if not impossible
			return [`${GW2Text2HTML(fact.text)}: ${drawFractional(fact.percent, config)}%`];
		},
		PercentLifeForceAdjust : ({fact: {percent, text}}) => {
			const hpPool = getHealth(context.character);

			const lines = [];
			if(context.character.statSources.lifeForce.length) {
				if(config.showFactComputationDetail)
					lines.push(`${percent * hpPool * 0.69} from ${percent}% * (${hpPool} HP * 0.69) base pool`);

				let percentMod = 100;
				for(const { source, modifier, count } of context.character.statSources.lifeForce) {
					const mod = calculateModifier(modifier, context.character);
					if(config.showFactComputationDetail)
						lines.push(newElm('span.detail', `${mod > 0 ? '+' : ''}${mod}% from `, fromHTML(source), count > 1 ? ` (x ${count})` : ''));
					percentMod += mod;
				}
				percent *= percentMod / 100;
			}

			//NOTE(Rennorb): lifeforce is 69% of the hp pool
			let raw = Math.round(hpPool * 0.69 * percent * 0.01);
			lines.unshift(`${GW2Text2HTML(text)}: ${drawFractional(percent, config)}% (${raw})`);

			return lines;
		},
		PercentHealth : ({fact: {percent, text}}) => {
			const raw = Math.round((getHealth(context.character) * percent) * 0.01);
			return [`${GW2Text2HTML(text)}: ${drawFractional(percent, config)}% (${raw})`];
		},
		//TODO(Rennorb) @correctness: this seems to be verry much percent based. Whats the difference to PercentLifeForceAdjust here?
		LifeForceAdjust : ({fact: {percent, text}}) => {
			const hpPool = getHealth(context.character);

			const lines = [];
			if(context.character.statSources.lifeForce.length) {
				if(config.showFactComputationDetail)
					lines.push(`${withUpToNDigits(percent * 0.01 * hpPool * 0.69, 3)} from ${percent}% * (${hpPool} HP * 0.69) base pool`);

				let percentMod = 100;
				for(const { source, modifier, count } of context.character.statSources.lifeForce) {
					const mod = calculateModifier(modifier, context.character);
					if(config.showFactComputationDetail)
						lines.push(newElm('span.detail', `${mod > 0 ? '+' : ''}${mod}% from `, fromHTML(source), count > 1 ? ` (x ${count})` : ''));
					percentMod += mod;
				}
				percent *= percentMod / 100;
			}

			//NOTE(Rennorb): lifeforce is 69% of the hp pool
			let raw = Math.round(hpPool * 0.69 * percent * 0.01);
			lines.unshift(`${GW2Text2HTML(text)}: ${drawFractional(percent, config)}% (${raw})`);
			
			return lines;
		},
		Damage : ({fact: {dmg_multiplier, hit_count, text}, weaponStrength}) => {
			const lines = [];
			
			let damage = dmg_multiplier * hit_count * weaponStrength * context.character.stats.power / context.targetArmor;
			if(config.showFactComputationDetail) {
				lines.push(`${withUpToNDigits(damage, 2)} from ${withUpToNDigits(dmg_multiplier, 2)} internal mod. * ${context.character.stats.power} power * ${weaponStrength} avg. weapon str. / ${context.targetArmor} target armor`);
				if(hit_count != 1) lines.push(`* ${hit_count} hits`);
			}

			//TODO(Rennorb): level scaling attributes. these are for lvl 80
			const critChance = Math.min(0.05 + (context.character.stats.precision - 1000) / 21 * 0.01, 1);
			//TODO(Rennorb): crit damage mods
			const critDamage = 1.5 + context.character.stats.ferocity / 15 * 0.01;
			const moreDmgFromCrit = damage * critChance * (critDamage - 1);
			damage += moreDmgFromCrit;
			if(config.showFactComputationDetail) {
				lines.push(`+${withUpToNDigits(moreDmgFromCrit, 2)} (${withUpToNDigits(critChance * (critDamage - 1) * 100, 2)}%) from ${withUpToNDigits(critChance * 100, 2)}% crit chance and ${withUpToNDigits(critDamage * 100, 2)}% damage on crit (${withUpToNDigits(context.character.stats.precision, 2)} precision and ${withUpToNDigits(context.character.stats.ferocity, 2)} ferocity)`);
			}

			if(context.character.statSources.damage.length) {
				let percentMod = 100;
				for(const { source, modifier, count } of context.character.statSources.damage) {
					const mod = calculateModifier(modifier, context.character);
					if(config.showFactComputationDetail)
						lines.push(newElm('span.detail', `${mod > 0 ? '+' : ''}${mod}% from `, fromHTML(source), count > 1 ? ` (x ${count})` : ''));
					percentMod += mod;
				}
				damage *= percentMod / 100;
			}

			const times = hit_count > 1 ? `(${hit_count}x)` : '';
			lines.unshift(`${GW2Text2HTML(text)}${times}: ${Math.round(damage)}`);

			return lines;
		},
		Time : ({fact: { duration, text }}) => {
			const lines = [];
			//TODO(Rennorb) @cleanup
			if(text && (text.includes('Stun') || text.includes('Daze'))) {
				if(context.character.statSources.stun.length) {
					if(config.showFactComputationDetail)
						lines.push(`${duration / 1000}s base duration`);
					let percentMod = 100;
					for(const { source, modifier, count } of context.character.statSources.stun) {
						const mod = calculateModifier(modifier, context.character);
						if(config.showFactComputationDetail)
							lines.push(newElm('span.detail', `${mod > 0 ? '+' : ''}${mod}% from `, fromHTML(source), count > 1 ? ` (x ${count})` : ''));
						percentMod += mod;
					}
					duration *= percentMod / 100;
				}
			}
			const time = duration != 1000 ? 'seconds' : 'second';
			lines.unshift(`${GW2Text2HTML(text)}: ${drawFractional(duration / 1000, config)} ${time}`);
			return lines;
		},
		ComboField : ({fact}) =>  {
			return [`${GW2Text2HTML(fact.text)}: ${mapLocale(fact.field_type)}`];
		},
		ComboFinisher : ({fact}) => {
			return [`${GW2Text2HTML(fact.text)}: ${mapLocale(fact.finisher_type)}`];
		},
		BuffConversion : ({fact}) => {
			return [`Gain ${mapLocale(fact.target)} Based on a Percentage of ${mapLocale(fact.source)}: ${fact.percent}%`];
		},
		NoData : ({fact}) => {
			return [GW2Text2HTML(fact.text)];
		},
		PrefixedBuff : ({fact, buff}) => {
			let prefix = APICache.storage.skills.get(fact.prefix);
			if(!prefix) console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
			prefix = prefix || MISSING_BUFF;
			iconSlug = prefix.icon || iconSlug;

			if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
			buff = buff || MISSING_BUFF; // in case we didn't get the buff we wanted from the api

			let {duration, apply_count, text} = fact;

			const details : string[] = [];
			let valueMod;
			[buffDuration, valueMod] = applyMods(duration, buff, details);

			let buffDescription = generateBuffDescription(buff, fact, buffDuration, valueMod);
			if(buffDescription) {
				buffDescription = `: ${buffDescription}`;
			}

			const seconds = buffDuration > 0 ? `(${drawFractional(buffDuration / 1000, config)}s)`: '';

			const list : (string|HTMLElement)[] = [newElm('div.fact', // class is just for styling
			generateBuffIcon(buff.icon, apply_count),
				newElm('span', fromHTML(`${GW2Text2HTML(text) || buff.name_brief || buff.name} ${seconds}${buffDescription}`))
			)];
			list.push(...details);

			return list;
		},
		PrefixedBuffBrief : ({fact, buff}) => {
			let prefix = APICache.storage.skills.get(fact.prefix)
			if(!prefix) console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
			prefix = prefix || MISSING_BUFF;
			iconSlug = prefix.icon || iconSlug

			if(!buff) console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
			buff = buff || MISSING_BUFF; // in case we didn't get the buff we wanted from the api

			let node = newElm('div.fact', // class is just for styling
				newImg(buff.icon),
				newElm('span', `${GW2Text2HTML(fact.text) || buff.name_brief || buff.name}`)
			);

			return [node]
		},
		Range : ({fact: {min, max}}) => {
			return [`Range: ${min ? `${min} - ${max}` : max}`];
		},
		StunBreak : () => {
			return ["Breaks Stun"];
		},
	}

	const buff = APICache.storage.skills.get((fact as API.BuffFact).buff || 0)
	const data : HandlerParams = { fact, buff, weaponStrength: weapon_strength }
	const [firstLine, ...remainingDetail] = factInflators[fact.type](data as any)
	const wrapper = newElm('div.fact')
	if(fact.requires_trait) {
		wrapper.classList.add('gw2-color-traited-fact')
	}

	let defianceBreak = 0;
	if(fact.defiance_break) {
		defianceBreak = fact.defiance_break * (buffDuration || 1000) / 1000;
		const breakDetail = (buffDuration != undefined && buffDuration != 1000) ? ` (${fact.defiance_break}/s)` : '';
		remainingDetail.push(newElm('span.detail.gw2-color-defiance-fact', `Defiance Break: ${withUpToNDigits(defianceBreak, 2)}${breakDetail}`))
	}

	if(fact.requires_trait) {
		//NOTE(Rennorb): If the trait is manually set on the object then we don't have it cached, so we just use the id if we don't have a name.
		const trait_names = joinWordList(fact.requires_trait.map(id => `'<span class="gw2-color-traited-fact">${APICache.storage.traits.get(id)?.name || id}</span>'`))
		remainingDetail.unshift(fromHTML(`<span class="detail">${fact.skip_next ? 'overridden' : 'exists'} because of trait${fact.requires_trait.length == 1 ? '' : 's'} ${trait_names}</span>`));
	}

	wrapper.append(generateBuffIcon(iconSlug, buffStackSize))
	wrapper.append(newElm('div',
		newElm('span', typeof firstLine == 'string' && firstLine.includes('<') ? fromHTML(firstLine) : firstLine), //parsing is expensive, don't just always do it
		...remainingDetail.map(d => typeof d == 'string' ? newElm('span.detail', d) : d))
		);

	return { wrapper, defiance_break: defianceBreak }
}

export function generateBuffIcon(icon : Parameters<typeof newImg>[0], stackSize = 1) : HTMLElement {
	const img = newImg(icon);
	if(stackSize == 1) {
		return img;
	}
	else {
		const wrap = newElm('span.buff-ico', img);
		wrap.setAttribute('count', String(stackSize));
		return wrap;
	}
}

export const MISSING_BUFF : API.Skill = {
	id         : 0,
	name       : 'Missing Buff',
	description: '<c=@warning>This Buff failed to load</c>',
	categories : [], palettes   : [], modifiers  : [],
}
export const MISSING_SKILL : API.Skill = {
	id         : 0,
	name       : 'Missing Skill',
	description: '<c=@warning>This Skill failed to load</c>',
	categories : [], palettes   : [], modifiers  : [],
}

import { newElm, newImg, drawFractional, GW2Text2HTML, withUpToNDigits, mapLocale, Uncapitalize, joinWordList, fromHTML } from './TUtilsV2';
import APICache from './APICache';
import { ICONS, config, getHealth } from './TooltipsV2';
