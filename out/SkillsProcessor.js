"use strict";
class SkillsProcessor {
    static calculateModifier({ formula, base_amount, formula_param1: level_scaling, formula_param2, }, { level, power, conditionDamage: condition_damage, healing: healing_power, }) {
        switch (formula) {
            case 0:
                return level * level_scaling + base_amount;
            case 1:
                return (level * level_scaling +
                    base_amount +
                    condition_damage * formula_param2);
            case 2:
                return (level * level * level_scaling +
                    base_amount +
                    condition_damage * formula_param2);
            case 6:
                return base_amount;
            case 7:
                return (level * level_scaling + base_amount + healing_power * formula_param2);
            case 8:
                return (level * level * level_scaling +
                    base_amount +
                    healing_power * formula_param2);
            case 9:
            case 10:
                return level * level_scaling + base_amount;
            case 11:
                return level * level_scaling + base_amount - formula_param2;
            case 13:
                return level * level_scaling + base_amount + power * formula_param2;
            case 14:
                return (level * level * level_scaling + base_amount + power * formula_param2);
        }
        console.warn('Could not find formula #', formula, ', using base amount for now!');
        return base_amount;
    }
    static getWeaponStrength({ weapon_type, type: palette_type, }) {
        let weaponStrength = {
            None: 0,
            BundleLarge: 0,
            Standard: 690.5,
            Focus: 900,
            Shield: 900,
            Torch: 900,
            Warhorn: 900,
            Greatsword: 1100,
            Hammer: 1100,
            Staff: 1100,
            BowLong: 1050,
            Rifle: 1150,
            BowShort: 1000,
            Axe: 1000,
            Sword: 1000,
            Dagger: 1000,
            Pistol: 1000,
            Scepter: 1000,
            Mace: 1000,
            Spear: 1000,
        }[weapon_type];
        if (weapon_type === 'None') {
            if (palette_type === 'Standard' || palette_type === 'Toolbelt') {
                weaponStrength = 690.5;
            }
            else if (palette_type === 'Bundle') {
                weaponStrength = 922.5;
            }
        }
        return weaponStrength;
    }
    static processFact(skill, skillDataCache, context) {
        if (!skill.facts.length && !skill.facts_override)
            return [];
        let totalDefianceBreak = 0;
        const processFactData = (fact) => {
            if (fact.requires_trait &&
                (!context.traits ||
                    !fact.requires_trait.some((reqTrait) => context.traits.includes(reqTrait)))) {
                return null;
            }
            let iconUrl = `${this.iconSource}${fact.icon}`;
            let htmlContent = '';
            if (fact.defiance_break) {
                totalDefianceBreak += fact.defiance_break;
            }
            const handlers = {
                Time: ({ fact }) => `<tem> ${fact.text}: ${TUtilsV2.DurationToSeconds(fact.duration)}s </tem>`,
                Distance: ({ fact }) => `<tem> ${fact.text}: ${fact.distance} </tem>`,
                Number: ({ fact }) => `<tem> ${fact.text}: ${fact.value} </tem>`,
                ComboField: ({ fact }) => `<tem> ${fact.text}: ${fact.field_type} </tem>`,
                ComboFinisher: ({ fact }) => `<tem> ${fact.text}: ${fact.finisher_type} </tem>`,
                NoData: ({ fact }) => `<tem> ${fact.text} </tem>`,
                Percent: ({ fact }) => `<tem> ${TUtilsV2.GW2Text2HTML(fact.text)}: ${fact.percent}% </tem>`,
                StunBreak: ({ fact }) => `<tem>Breaks Stun</tem>`,
                PrefixedBuffBrief: ({ fact }) => {
                    const prefix = skillDataCache.get(fact.prefix);
                    const buff = skillDataCache.get(fact.buff);
                    iconUrl = `${this.iconSource}${prefix === null || prefix === void 0 ? void 0 : prefix.icon}`;
                    const buffIcon = TUtilsV2.newImg(`${this.iconSource}${buff === null || buff === void 0 ? void 0 : buff.icon}`, 'iconmed');
                    return `<tem> ${buffIcon.outerHTML} ${(buff === null || buff === void 0 ? void 0 : buff.name_brief) || (buff === null || buff === void 0 ? void 0 : buff.name)} </tem> `;
                },
                Buff: ({ fact, buff }) => {
                    if (!buff)
                        console.error('buff #', fact.buff, ' is apparently missing in the cache');
                    buff = buff || this.MissingBuff;
                    let modifiers = '';
                    iconUrl = `${this.iconSource}${buff.icon}`;
                    if (buff.modifiers) {
                        for (const modifier of buff.modifiers) {
                            if ((modifier.trait_req &&
                                !context.traits.includes(modifier.trait_req)) ||
                                (modifier.mode && modifier.mode !== context.gameMode)) {
                                continue;
                            }
                            let modifierValue = this.calculateModifier(modifier, context.stats);
                            if (modifier.flags.includes('MulByDuration') &&
                                !modifier.flags.includes('FormatPercent')) {
                                modifierValue *= TUtilsV2.DurationToSeconds(fact.duration);
                            }
                            if (modifier.flags.includes('FormatPercent')) {
                                if (modifier.flags.includes('NonStacking')) {
                                    modifiers += ` ${Math.round(modifierValue)}% ${modifier.description}`;
                                }
                                else {
                                    modifiers += ` ${Math.round(fact.apply_count * modifierValue)}% ${modifier.description}`;
                                }
                            }
                            else {
                                modifiers += ` ${Math.round(fact.apply_count * modifierValue)} ${modifier.description}`;
                            }
                        }
                    }
                    const fixDescriptionText = (description) => {
                        return ((description === null || description === void 0 ? void 0 : description.replace(/<c=@.*?>(.*?)<\/c>/g, '$1').replace(/%%/g, '%')) || '');
                    };
                    const getDurationText = (duration) => {
                        return (duration === null || duration === void 0 ? void 0 : duration.secs) && (duration === null || duration === void 0 ? void 0 : duration.secs) >= 1
                            ? `(${duration === null || duration === void 0 ? void 0 : duration.secs}s)`
                            : '';
                    };
                    const getDescriptionOrModifiers = (hasDescriptionBrief, descriptionContent, modifiers) => {
                        return hasDescriptionBrief ? descriptionContent : modifiers;
                    };
                    const hasDescriptionBrief = Boolean(buff === null || buff === void 0 ? void 0 : buff.description_brief);
                    const descriptionContent = hasDescriptionBrief
                        ? buff === null || buff === void 0 ? void 0 : buff.description_brief
                        : fixDescriptionText(buff === null || buff === void 0 ? void 0 : buff.description);
                    const durationText = getDurationText(fact.duration);
                    htmlContent = `<tem> ${(buff === null || buff === void 0 ? void 0 : buff.name_brief) || (buff === null || buff === void 0 ? void 0 : buff.name)} ${durationText} ${getDescriptionOrModifiers(hasDescriptionBrief, descriptionContent, modifiers)} </tem>`;
                    if (fact.apply_count && fact.apply_count > 1) {
                        htmlContent += TUtilsV2.newElm('div.buffcount', fact.apply_count.toString()).outerHTML;
                    }
                    return htmlContent;
                },
                BuffBrief: ({ fact, buff }) => {
                    if (!buff)
                        console.error('buff #', fact.buff, ' is apparently missing in the cache');
                    buff = buff || this.MissingBuff;
                    iconUrl = `${this.iconSource}${buff.icon}`;
                    return TUtilsV2.GW2Text2HTML(fact.text);
                },
                Damage: ({ fact, skill }) => {
                    let weaponStrength = 0;
                    if (skill.palettes.length) {
                        const relevantPalette = skill.palettes.find((palette) => palette.slots &&
                            palette.slots.some((slot) => slot.profession !== 'None'));
                        if (relevantPalette) {
                            weaponStrength = this.getWeaponStrength(relevantPalette);
                        }
                    }
                    if (fact.hit_count && fact.hit_count > 1) {
                        return `<tem> ${fact.text}: (${fact.hit_count}x) ${Math.round((Math.round(weaponStrength) *
                            context.stats.power *
                            (fact.hit_count * fact.dmg_multiplier)) /
                            2597)} </tem>`;
                    }
                    else {
                        return `<tem> ${fact.text}: ${Math.round((fact.hit_count *
                            Math.round(weaponStrength) *
                            context.stats.power *
                            (fact.hit_count * fact.dmg_multiplier)) /
                            2597)} </tem>`;
                    }
                },
                AttributeAdjust: ({ fact }) => `<tem> ${fact.text} : ${Math.round((fact.value +
                    context.stats[fact.target.toLowerCase()] *
                        fact.attribute_multiplier +
                    context.stats.level ** fact.level_exponent *
                        fact.level_multiplier) *
                    fact.hit_count)} </tem>`,
            };
            const buff = fact.buff ? skillDataCache.get(fact.buff) : undefined;
            const data = { fact, buff, skill };
            htmlContent = handlers[fact.type](data);
            return TUtilsV2.newElm('te', TUtilsV2.newImg(iconUrl, 'iconmed'), TUtilsV2.fromHTML(htmlContent));
        };
        const factWraps = skill.facts
            .sort((a, b) => a.order - b.order)
            .map(processFactData)
            .filter((d) => d);
        if ((skill.facts.length == 0 || context.gameMode !== 'Pve') &&
            skill.facts_override) {
            for (const override of skill.facts_override) {
                if (override.mode === context.gameMode) {
                    const sortedOverrideFacts = [...override.facts].sort((a, b) => a.order - b.order);
                    sortedOverrideFacts.forEach((fact) => {
                        const factWrap = processFactData(fact);
                        if (factWrap) {
                            factWraps.push(factWrap);
                        }
                    });
                }
            }
        }
        if (totalDefianceBreak > 0) {
            const defianceWrap = TUtilsV2.newElm('te.defiance', TUtilsV2.newImg(`${this.iconSource}1938788.png`, 'iconmed'), TUtilsV2.newElm('tem', `Defiance Break: ${totalDefianceBreak}`));
            factWraps.push(defianceWrap);
        }
        if ('range' in skill && skill.range) {
            const rangeWrap = TUtilsV2.newElm('te', TUtilsV2.newImg(`${this.iconSource}156666.png`, 'iconmed'), TUtilsV2.newElm('tem', `Range: ${skill.range}`));
            factWraps.push(rangeWrap);
        }
        return factWraps;
    }
}
SkillsProcessor.MissingBuff = {
    id: 0,
    name: 'Missing Buff',
    description: 'This Buff failed to load',
    icon: '0.png',
    chat_link: '',
    facts: [],
    categories: [],
    range: 0,
    recharge: { secs: 0, nanos: 0 },
    recharge_override: [],
    activation: { secs: 0, nanos: 0 },
    palettes: [],
    modifiers: [],
};
SkillsProcessor.iconSource = 'https://assets.gw2dat.com//';
