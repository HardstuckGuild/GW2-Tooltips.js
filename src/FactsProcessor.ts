export function calculateModifier(
	{ formula, base_amount, formula_param1: level_scaling, formula_param2, source_attribute } : API.Modifier,
	level : number, stats : Character['stats']['values'],
) : number {
	let { Power, ConditionDamage, HealingPower } = stats;
	if(source_attribute) {
		//conversion mod
		return stats[source_attribute] * base_amount / 100;
	}

	//TODO(Rennorb): this is **screaming** tabledrive me
	switch (formula) {
		case 'BuffLevelLinear':
			return         level * level_scaling + base_amount
		case 'ConditionDamage':
			return         level * level_scaling + base_amount + ConditionDamage * formula_param2
		case 'ConditionDamageSquared':
			return level * level * level_scaling + base_amount + ConditionDamage * formula_param2
		case 'NoScaling':
			return                                 base_amount
		case 'Regeneration':
			return         level * level_scaling + base_amount + HealingPower * formula_param2
		case 'RegenerationSquared':
			return level * level * level_scaling + base_amount + HealingPower * formula_param2
		case 'SpawnScaleLinear':
		case 'TargetLevelLinear':
			return         level * level_scaling + base_amount
		case 'BuffFormulaType11':
			return         level * level_scaling + base_amount - formula_param2
		case 'Power':
			return         level * level_scaling + base_amount + Power * formula_param2
		case 'PowerSquared':
			return level * level * level_scaling + base_amount + Power * formula_param2
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
			if(wrapper) wrapper.dataset.order = String(fact.order); //used later on to insert a potential synthetic defiance break fact in the right place
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

	if(totalDefianceBreak > 0) {
		const defianceWrap = newElm('div.fact',
			newImg(ICONS.DEFIANCE_BREAK, 'iconmed'),
			newElm('div.gw2-color-defiance-fact', `Total Defiance Break: ${withUpToNDigits(totalDefianceBreak, 2)}`)
		);

		let i = 0;
		for(; i < elements.length; i++) {
			const s = elements[i].dataset.order;
			if(s && parseInt(s) > 1003) break;
		}
		elements.splice(i, 0, defianceWrap);
	}

	return elements
}

/** @param fact should already be context resolved */
export function generateFact(fact : API.Fact, weapon_strength : number, context : Context, itemMode : boolean = false) : { wrapper? : HTMLElement, defiance_break : number } {
	let iconSlug = fact.icon;
	let buffStackSize = 1;
	let buffDuration = (fact as API.BuffFact).duration;
	let defiance_break_per_s = fact.defiance_break;
	let activeStats = getActiveAttributes(context.character);

	const generateBuffDescription = (buff : API.Skill, fact : API.BuffFact | API.PrefixedBuffFact, duration : Milliseconds, valueMod : number  /* TODO(Rennorb): kindof a weird hack for now. maybe merge the two export functions? */) => {
		let modsArray: string[] = []
		if(buff.modifiers && !buff.description_brief && !itemMode) { // early bail to not have to do the work if we use the description anyways
			//TODO(Rennorb) @consistency: gamemode splitting for mods (?)
			const relevantModifiers = buff.modifiers.filter(modifier => (
				   (!modifier.source_trait_req || context.character.traits.has(modifier.source_trait_req))
				//NOTE(Rennorb): We ignore this on purpose. See https://github.com/HardstuckGuild/Tooltips.js/issues/81 for context
				//&& (!modifier.target_trait_req || context.character.traits.includes(modifier.target_trait_req))
				&& (!modifier.mode || modifier.mode === context.gameMode)
			));

			//NOTE(Rennorb): Modifiers can 'stack'. For that reason we need to first collect the values and then create text from that, otherwise we get duplicates.
			let modsMap = new Map<number, { modifier : API.Modifier, value : number }>();
			for (let i = 0; i < relevantModifiers.length; i++) {
				const modifier = relevantModifiers[i];

				let entry = modsMap.get(modifier.id);
				if(!entry) modsMap.set(modifier.id, entry = { modifier: modifier, value: 0 });

				let value = calculateModifier(modifier, context.character.level, activeStats);
				if (modifier.source_attribute) { //TODO(Rennorb) @cleanup 'force of will'
					value *= activeStats[modifier.source_attribute];
				}

				entry.value += value;

				if(modifier.flags.includes('SkipNextEntry')) {
					i++;
				}
			}

			for(let { value, modifier } of modsMap.values()) {
				if(modifier.flags.includes('Subtract')) {
					value -= 100;
				}

				if(modifier.flags.includes('MulByDuration')) {
					let this_duration = duration / 1000;
					if(modifier.flags.includes('DivDurationBy3')) {
						this_duration /= 3;
					}
					if(modifier.flags.includes('DivDurationBy10')) {
						this_duration /= 10;
					}

					value *= this_duration || 1;
				}

				if(!modifier.flags.includes('NonStacking')) {
					value *= fact.apply_count;
				}

				if(modifier.formula.includes('Regeneration'))
					value *= valueMod;

				let strValue = modifier.flags.includes('FormatFraction')
					? formatFraction(value, config)
					: Math.floor(Math.fround(value)).toString();

				if(modifier.flags.includes('FormatPercent')) {
					if(value > 0 ) {
						strValue = '+ ' + strValue;
					}
					strValue += '%'
				}
				strValue += ' ' + modifier.description;

				if(typeof modifier.target_attribute_or_skill === 'string') {
					const { computedAttribute } = getAttributeInformation(modifier.target_attribute_or_skill, context.character);
					if(computedAttribute) {
						const { div, suffix } = getAttributeInformation(computedAttribute, context.character);
						const displayMul = suffix ? 100 : 1;
						strValue += ` <span class="detail">(converts to ${n3(value / div * displayMul)}${suffix} ${localizeInternalName(computedAttribute)})</span>`;
					}
				}

				modsArray.push(strValue);
			}
		}

		return GW2Text2HTML(buff.description_brief || modsArray.join(', ') || buff.description)
	}

	const applyMods = (baseDuration : Milliseconds, buff : API.Skill, detailStack : (string | Node)[]) : [Milliseconds, number] => {
		let durMod = 1, valueMod = 1, cap = Number.MAX_SAFE_INTEGER;
		const durationAttr : ComputedAttribute | false = (buff.buff_type == 'Boon' && 'BoonDuration') || (buff.buff_type == 'Condition' && 'ConditionDuration');
		if(durationAttr) {
			const { baseAttribute, div, cap: cap_ } = getAttributeInformation(durationAttr, context.character); cap = cap_;
			const attribVal = getAttributeValue(context.character, baseAttribute!);
			// every 15 points add 1%
			durMod += attribVal / div;
			if(attribVal > 0 && config.showFactComputationDetail) {
				detailStack.push(`base duration: ${n3(baseDuration / 1000)}s`);
				detailStack.push(`+ ${n3(baseDuration / 1000 * attribVal / div)}s (${n3(attribVal / div * 100)}%) from ${n3(attribVal)} ${baseAttribute}`);
			}

			for(const source of getAttributeSources(context.character, durationAttr)) {
				let mod = calculateModifier(source.modifier, context.character.level, activeStats) * source.count;
				const innerSuffix = source.modifier.flags.includes('FormatPercent') ? '%' : '';
				const displayMul = innerSuffix ? 100 : 1;
				mod /= displayMul; //TODO(Rennorb) @cleanup
				durMod += mod;
				const toAdd = innerSuffix ? mod * baseDuration : mod;
				
				if(config.showFactComputationDetail) {
					let text = `+ ${n3(toAdd / 1000)}s`;
					if(innerSuffix) text += ` (${n3(mod * displayMul)}%)`;
					text += ' from ';
					if(source.count > 1) text += `${source.count} `;
					text += source.source;
					detailStack.push(newElm('div.detail', fromHTML(resolveInflections(text, source.count, context.character))));
				}
			}
		}

		//TODO(Rennorb) @correctness: this is probably not quite stable, but its good enough for now
		let durModStack = getAttributeSources(context.character, buff.id);
		if(durModStack.length) {
			//NOTE(Rennorb): Just in case we didn't have a stat duration increase. Im aware that this is jank, but i cant think of a better way rn.
			if(durMod === 1 && config.showFactComputationDetail)
				detailStack.push(`base duration: ${n3(baseDuration / 1000)}s`);
			let percentMod = 0;
			for(const { source, modifier, count } of durModStack) {
				const mod = calculateModifier(modifier, context.character.level, activeStats);
				if(config.showFactComputationDetail)
					detailStack.push(newElm('span.detail', `${n3ss(baseDuration / 1000 * mod / 100)}s (${n3(mod)}%) from ${count > 1 ? `${count} ` : ''}`, fromHTML(resolveInflections(source, count, context.character)))); //TODO(Rennorb) @cleanup: im not really happy with how this works right now. Storing html in the text is not what i like to do but it works for now. Multiple of this.
				percentMod += mod;
			}
			durMod += percentMod / 100;
		}

		const uncappedMod = durMod;
		durMod = Math.min(uncappedMod, cap);
		if(durMod != uncappedMod && config.showFactComputationDetail) {
			detailStack.push(newElm('span.detail', `(Capped to ${n3(baseDuration / 1000 * cap)}s! Uncapped duration would be ${n3(baseDuration / 1000 * uncappedMod)}s)`));
		}

		baseDuration *= durMod;

		if(buff.name.includes('Regeneration')) {
			let valueModStack = getAttributeSources(context.character, 'HealEffectiveness');
			if(valueModStack.length) {
				if(config.showFactComputationDetail)
					detailStack.push('regeneration value mods:');
				let percentMod = 0;
				for(const { source, modifier, count } of valueModStack) {
					let mod = calculateModifier(modifier, context.character.level, activeStats);
					if(modifier.source_attribute) mod *= 100; //TODO(Rennorb) @cleanup

					if(config.showFactComputationDetail) {
						const conversion = modifier.source_attribute
							? `${n3ss(mod)}% from ${n3(modifier.base_amount)} * ${n3(activeStats[modifier.source_attribute])} ${localizeInternalName(modifier.source_attribute)}`
							: `${n3ss(mod)}%`;
						// TODO(Rennorb): @completeness: Show the amount this percent mod results in.
						detailStack.push(newElm('span.detail', `${conversion} from ${count > 1 ? `${count} ` : ''}`, fromHTML(resolveInflections(source, count, context.character))));
					}
					percentMod += mod;
				}
				valueMod += percentMod / 100;
			}
		}


		return [baseDuration, valueMod];
	}

	const factInflators : { [k in typeof fact.type] : (params : HandlerParams<API.FactMap[k]>) => (string|Node)[] } = {
		AdjustByAttributeAndLevel : ({fact}) =>  {
			let value = (fact.value + context.character.level ** fact.level_exponent * fact.level_multiplier) * fact.hit_count;

			let attributeVal = 0;
			if(fact.attribute) {
				attributeVal = getAttributeValue(context.character, fact.attribute);
				value += attributeVal * fact.attribute_multiplier * fact.hit_count;
			}

			const lines = [];

			if(config.showFactComputationDetail) {
				lines.push(`${n3(fact.value)} base value`);
				if(fact.level_multiplier) lines.push(`+ ${n3(context.character.level ** fact.level_exponent * fact.level_multiplier)} from lvl ${context.character.level} ^ ${n3(fact.level_exponent)} lvl exp. * ${n3(fact.level_multiplier)} lvl mul.`);
				if(fact.attribute) lines.push(`+ ${n3(attributeVal * fact.attribute_multiplier)} from ${n3(attributeVal)} ${localizeInternalName(fact.attribute)} * ${n3(fact.attribute_multiplier)} attrib. mod.`);
				if(fact.hit_count != 1) lines.push(` * ${fact.hit_count} hits`);
			}

			if(fact.text?.includes('Heal')) { //TODO(Rennorb) @cleanup @correctness
				let percentMod = 100;
				for(const { source, modifier, count } of getAttributeSources(context.character, 'HealEffectiveness')) {
					let mod = calculateModifier(modifier, context.character.level, activeStats);
					if(modifier.source_attribute) mod *= 100; // @cleanup

					if(config.showFactComputationDetail) {
						const conversion = modifier.source_attribute
							? `${n3(mod)}% from ${n3(modifier.base_amount)} * ${n3(activeStats[modifier.source_attribute])} ${localizeInternalName(modifier.source_attribute)}`
							: `${n3(mod)}%`;
						lines.push(newElm('span.detail', `${n3ss(mod / 100 * value)} (${conversion}) from ${count > 1 ? `${count} `: ''}`, fromHTML(resolveInflections(source, count, context.character))));
					}
					percentMod += mod;
				}
				value *= percentMod / 100;
			}

			lines.unshift(`${GW2Text2HTML(fact.text) || localizeInternalName(fact.attribute)}: ${Math.round(value)}`);

			return lines;
		},
		AttributeAdjust : ({fact}) => {
			const value = Math.round((fact.range[1] - fact.range[0]) / (context.character.level / 80) + fact.range[0]);
			const parts = [`${GW2Text2HTML(fact.text) || localizeInternalName(fact.target)}: ${n3s(value)}`];
			
			const { computedAttribute } = getAttributeInformation(fact.target, context.character);
			if(computedAttribute) {
				const { div, suffix } = getAttributeInformation(computedAttribute, context.character);
				const displayMul = suffix ? 100 : 1;
				parts.push(`(converts to ${n3(value / div * displayMul)}${suffix} ${localizeInternalName(computedAttribute)})`);
			}
			
			return parts;
		},
		Buff : ({fact, buff}) =>  {
			if(!buff) {
				console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = MISSING_BUFF;
			}
			iconSlug = buff.icon || iconSlug;

			const parts : (string | Node)[] = [];
			let valueMod;
			[buffDuration, valueMod] = applyMods(fact.duration, buff, parts);

			let buffDescription = generateBuffDescription(buff, fact, buffDuration, valueMod);
			if(buffDescription) {
				if(itemMode) buffDescription = `:<div style="margin-left: 0.5em;">${buffDescription}</div>`;
				else buffDescription = `: ${buffDescription}`;
			}

			const seconds = buffDuration > 0 ? ` (${formatDuration(buffDuration, config)})`: '';
			//NOTE(Rennorb): Relics have buffs with the same name as the relic, that also has the plural [s] so we need to resolve that here
			parts.unshift(`${GW2Text2HTML(resolveInflections(fact.text || buff.name_brief || buff.name, -1, context.character))}${seconds}${buffDescription}`);

			buffStackSize = fact.apply_count;
			return parts;
		},
		BuffBrief : ({fact, buff}) =>  {
			if(!buff) {
				console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = MISSING_BUFF;
			}
			iconSlug = buff.icon || iconSlug;

			return [`${GW2Text2HTML(fact.text, buff.name)}`];
		},
		Distance : ({fact}) => {
			return [`${GW2Text2HTML(fact.text)}: ${Math.round(fact.distance)}`];
		},
		Number : ({fact: { text, value }}) => {
			const lines : (string|Node)[] = [];

			if(defiance_break_per_s && text && text.includes('Defiance')) {
				const modifiers = getAttributeSources(context.character, 'Stun');
				if(modifiers.length) {
					if(config.showFactComputationDetail)
						lines.push(`${n3(value)} base value`);
					let percentMod = 100;
					for(const { source, modifier, count } of modifiers) {
						const mod = calculateModifier(modifier, context.character.level, activeStats);
						if(config.showFactComputationDetail)
							lines.push(newElm('span.detail', `${n3ss(mod)}% from ${count > 1 ? `${count} ` : ''}`, fromHTML(resolveInflections(source, count, context.character))));
						percentMod += mod;
					}
					const mod = percentMod / 100;
					value *= mod;
					defiance_break_per_s *= mod;
				}
			}

			lines.unshift(`${GW2Text2HTML(text)}: ${formatFraction(value, config)}`);
			return lines;
		},
		Percent : ({fact}) => {
			return [`${GW2Text2HTML(fact.text)}: ${formatFraction(fact.percent, config)}%`];
		},
		PercentHpSelfDamage : ({fact}) => {
			const hpPool = getAttributeValue(context.character, 'Health'); //NOTE(Rennorb): Does not include barrier.
			return [`${GW2Text2HTML(fact.text)}: ${Math.floor(hpPool * fact.percent / 100)} (${formatFraction(fact.percent, config)}% HP pool)`];
		},
		PercentLifeForceCost : ({fact: {percent, text}}) => {
			const hpPool = getBaseHealth(context.character);

			const lines = [];
			//NOTE(Rennorb): LifeForce cost is calculated from the base _hp_ pool, without any vitality added.
			lines.push(`${GW2Text2HTML(text)}: ${n3(Math.round(hpPool * percent * 0.01))}`);

			if(config.showFactComputationDetail)
				lines.push(`from ${n3(percent)}% * ${n3(hpPool)} HP base pool`);

			return lines;
		},
		PercentHealth : ({fact: {percent, text}}) => {
			const raw = Math.round(getAttributeValue(context.character, 'Health') * percent * 0.01);
			return [`${GW2Text2HTML(text)}: ${formatFraction(percent, config)}% (${raw} HP)`];
		},
		PercentLifeForceGain : ({fact: {percent, text}}) => {
			const hpPool = getAttributeValue(context.character, 'Health');

			const lines = [];
			if(config.showFactComputationDetail) {
				lines.push(`${n3(percent * 0.01 * hpPool * 0.69)} from ${n3(percent)}% * (${n3(hpPool)} HP * 0.69) pool (${n3(getBaseHealth(context.character))} base pool modified by ${n3(getAttributeValue(context.character, 'Vitality'))} Vitality)`);
			}

			const modifiers = getAttributeSources(context.character, 'LifeForce');
			if(modifiers.length) {
				let percentMod = 100;
				for(const { source, modifier, count } of modifiers) {
					const mod = calculateModifier(modifier, context.character.level, activeStats);
					if(config.showFactComputationDetail)
						lines.push(newElm('span.detail', `${n3ss(mod)}% from ${count > 1 ? `${count} ` : ''}`, fromHTML(resolveInflections(source, count, context.character))));
					percentMod += mod;
				}
				percent *= percentMod / 100;
			}

			//NOTE(Rennorb): The LifeForce pool is 69% of the hp pool.
			lines.unshift(`${GW2Text2HTML(text)}: ${formatFraction(percent, config)}% (${Math.round(hpPool * 0.69 * percent * 0.01)})`);
			
			return lines;
		},
		Damage : ({fact: {dmg_multiplier, hit_count, text}, weaponStrength}) => {
			const lines = [];

			const power = getAttributeValue(context.character, 'Power');
			let damage = dmg_multiplier * hit_count * weaponStrength * power / context.targetArmor;
			if(config.showFactComputationDetail) {
				lines.push(`${n3(damage)} from ${n3(dmg_multiplier)} internal mod. * ${n3(power)} power * ${weaponStrength} avg. weapon str. / ${context.targetArmor} target armor`);
				if(hit_count != 1) lines.push(`* ${hit_count} hits`);
			}

			const precision = getAttributeValue(context.character, 'Precision');
			const ferocity  = getAttributeValue(context.character, 'Ferocity');
			//TODO(Rennorb): level scaling attributes. these are for lvl 80
			const critChance = Math.min(0.05 + (precision - 1000) / 21 * 0.01, 1);
			//TODO(Rennorb): crit damage mods
			const critDamage = 1.5 + ferocity / 15 * 0.01;
			const moreDmgFromCrit = damage * critChance * (critDamage - 1);
			damage += moreDmgFromCrit;
			if(config.showFactComputationDetail) {
				lines.push(`+ ${n3(moreDmgFromCrit)} (${n3(critChance * (critDamage - 1) * 100)}%) from ${n3(critChance * 100)}% crit chance and ${n3(critDamage * 100)}% damage on crit (${n3(precision)} precision and ${n3(ferocity)} ferocity)`);
			}

			const modifiers = getAttributeSources(context.character, 'Damage');
			if(modifiers.length) {
				let percentMod = 100;
				for(const { source, modifier, count } of modifiers) {
					const mod = calculateModifier(modifier, context.character.level, activeStats);
					if(config.showFactComputationDetail)
						lines.push(newElm('span.detail', `${n3ss(mod)}% from ${count > 1 ? `${count} ` : ''}`, fromHTML(resolveInflections(source, count, context.character))));
					percentMod += mod;
				}
				damage *= percentMod / 100;
			}

			const times = hit_count > 1 ? `(${hit_count}x)` : '';
			lines.unshift(`${GW2Text2HTML(text)}${times}: ${Math.round(damage)}`);

			return lines;
		},
		Time : ({fact: { text }}) => {
			const lines : (string|Node)[] = [];

			//TODO(Rennorb) @cleanup
			if(defiance_break_per_s && text && (text.includes('Stun') || text.includes('Daze') 
				//NOTE(Rennorb): This filters for '{Bonus|Additional} Defiance {Damage|Break}' which apparently is also affected by stun mods like paralyzation sigil.
				// This will not modify the 'total defiance break' synthetic fact as that one gets generated after all others are done.
				|| text.includes('Defiance'))
			) {
				const modifiers = getAttributeSources(context.character, 'Stun');
				if(modifiers.length) {
					if(config.showFactComputationDetail)
						lines.push(`${n3(buffDuration / 1000)}s base duration`);
					let percentMod = 100;
					for(const { source, modifier, count } of modifiers) {
						const mod = calculateModifier(modifier, context.character.level, activeStats);
						if(config.showFactComputationDetail)
							lines.push(newElm('span.detail', `${n3ss(mod)}% from ${count > 1 ? `${count} ` : ''}`, fromHTML(resolveInflections(source, count, context.character))));
						percentMod += mod;
					}
					buffDuration *= percentMod / 100;
				}
			}

			//NOTE(Rennorb): No need to modify the defiance damage since we already modify the duration wich gets multiplied with the DDPS.

			const time = buffDuration != 1000 ? 'seconds' : 'second';
			lines.unshift(`${GW2Text2HTML(text)}: ${formatFraction(buffDuration / 1000, config)} ${time}`);
			return lines;
		},
		ComboField : ({fact}) =>  {
			return [`${GW2Text2HTML(fact.text)}: ${localizeInternalName(fact.field_type)}`];
		},
		ComboFinisher : ({fact}) => {
			return [`${GW2Text2HTML(fact.text)}: ${localizeInternalName(fact.finisher_type)}`];
		},
		AttributeConversion : ({fact}) => {
			return [`Gain ${localizeInternalName(fact.target)} Based on a Percentage of ${localizeInternalName(fact.source)}: ${fact.percent}%`];
		},
		NoData : ({fact}) => {
			return [GW2Text2HTML(fact.text)];
		},
		PrefixedBuff : ({fact, buff}) => {
			let prefix = APICache.storage.skills.get(fact.prefix);
			if(!prefix) {
				console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
				prefix = MISSING_BUFF;
			}
			iconSlug = prefix.icon || iconSlug;

			if(!buff) {
				console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = MISSING_BUFF;
			}

			let {duration, apply_count, text} = fact;

			const parts : (string | Node)[] = [];
			let valueMod;
			[buffDuration, valueMod] = applyMods(duration, buff, parts);

			let buffDescription = generateBuffDescription(buff, fact, buffDuration, valueMod);
			if(buffDescription) {
				buffDescription = `: ${buffDescription}`;
			}

			const seconds = buffDuration > 0 ? ` (${formatDuration(buffDuration, config)})`: '';

			parts.unshift(newElm('div.fact', // class is just for styling
				generateBuffIcon(buff.icon, apply_count),
					newElm('span', fromHTML(`${GW2Text2HTML(text) || buff.name_brief || buff.name}${seconds}${buffDescription}`))
				)
			);

			return parts;
		},
		PrefixedBuffBrief : ({fact, buff}) => {
			let prefix = APICache.storage.skills.get(fact.prefix)
			if(!prefix) {
				console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
				prefix = MISSING_BUFF;
			}
			iconSlug = prefix.icon || iconSlug

			if(!buff) {
				console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
				buff = MISSING_BUFF;
			}

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
	if(defiance_break_per_s) {
		let effectiveBuffDuration = buffDuration || 1000;
		let breakDetail = '';
		//TODO(Rennorb) @perf @cleanup
		if(buffDuration < 1000 && fact.text && (fact.text.includes('Stun') || fact.text.includes('Daze') || fact.text.includes('Float') || fact.text.includes('Knockdown'))) {
			effectiveBuffDuration = 1000;
			breakDetail = ' (hard CC -> min = 100)';
		}
		else if(effectiveBuffDuration != 1000) {
			breakDetail = ` (${fact.defiance_break}/s)`;
		}
		defianceBreak = defiance_break_per_s * effectiveBuffDuration / 1000;
		remainingDetail.push(newElm('span.detail.gw2-color-defiance-fact', `Defiance Break: ${withUpToNDigits(defianceBreak, 2)}${breakDetail}`))
	}

	if(fact.requires_trait) {
		const trait_names = joinWordList(fact.requires_trait.map(id => `'<span class="gw2-color-traited-fact">${APICache.storage.traits.get(id)?.name || id}</span>'`))
		remainingDetail.unshift(fromHTML(`<span class="detail">${(fact.skip_next && (fact.skip_next > 1 || !fact.__gamemode_override_marker)) ? 'overridden' : 'exists'} because of trait${fact.requires_trait.length == 1 ? '' : 's'} ${trait_names}</span>`));
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
	categories : [], palettes   : [], modifiers  : [], flags: [],
}
export const MISSING_SKILL : API.Skill = {
	id         : 0,
	name       : 'Missing Skill',
	description: '<c=@warning>This Skill failed to load</c>',
	categories : [], palettes   : [], modifiers  : [], flags: [],
}

import { newElm, newImg, formatFraction, GW2Text2HTML, withUpToNDigits, localizeInternalName, joinWordList, fromHTML, n3, resolveInflections, formatDuration, n3s, n3ss } from './TUtilsV2';
import APICache from './APICache';
import { ICONS, config } from './TooltipsV2';
import { getActiveAttributes, getAttributeInformation, getAttributeValue, getBaseHealth, getAttributeSources } from './CharacterAttributes';
