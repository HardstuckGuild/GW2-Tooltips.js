"use strict";
class SkillsProcessor {
    static calculateModifier({ formula, base_amount, formula_param1: level_scaling, formula_param2 }, { level, power, conditionDamage: condition_damage, healing: healing_power }) {
        switch (formula) {
            case 0:
                return level * level_scaling + base_amount;
            case 1:
                return level * level_scaling + base_amount + condition_damage * formula_param2;
            case 2:
                return level * level * level_scaling + base_amount + condition_damage * formula_param2;
            case 6:
                return base_amount;
            case 7:
                return level * level_scaling + base_amount + healing_power * formula_param2;
            case 8:
                return level * level * level_scaling + base_amount + healing_power * formula_param2;
            case 9:
            case 10:
                return level * level_scaling + base_amount;
            case 11:
                return level * level_scaling + base_amount - formula_param2;
            case 13:
                return level * level_scaling + base_amount + power * formula_param2;
            case 14:
                return level * level * level_scaling + base_amount + power * formula_param2;
        }
        console.warn('Could not find formula #', formula, ', using base amount for now!');
        return base_amount;
    }
    static getWeaponStrength({ weapon_type, type: palette_type }) {
        let weaponStrength = {
            None: 0,
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
            Standard: 690.5,
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
            return null;
        const factWraps = [];
        let totalDefianceBreak = 0;
        const processFactData = (fact) => {
            if (fact.requires_trait && (!context.traits || !fact.requires_trait.some(reqTrait => context.traits.includes(reqTrait)))) {
                return null;
            }
            let iconUrl = `https://assets.gw2dat.com/${fact.icon}`;
            let htmlContent = '';
            if (fact.defiance_break) {
                totalDefianceBreak += fact.defiance_break;
            }
            const handlers = {
                Time: ({ fact }) => { var _a; return `<tem> ${fact.text}: ${(_a = fact.duration) === null || _a === void 0 ? void 0 : _a.secs}s </tem>`; },
                Distance: ({ fact }) => `<tem> ${fact.text}: ${fact.distance} </tem>`,
                Number: ({ fact }) => `<tem> ${fact.text}: ${fact.value} </tem>`,
                ComboField: ({ fact }) => `<tem> ${fact.text}: ${fact.field_type} </tem>`,
                ComboFinisher: ({ fact }) => `<tem> ${fact.text}: ${fact.finisher_type} </tem>`,
                NoData: ({ fact }) => `<tem> ${fact.text} </tem>`,
                Percent: ({ fact }) => `<tem> ${TUtilsV2.GW2Text2HTML(fact.text)}: ${fact.percent}% </tem>`,
                StunBreak: (params) => '',
                PrefixedBuffBrief: (params) => '',
                Buff: ({ fact, buff }) => {
                    var _a;
                    if (!buff)
                        console.error('buff #', fact.buff, ' is apparently missing in the cache');
                    buff = buff || this.MissingBuff;
                    let modifiers = '';
                    iconUrl = `https://assets.gw2dat.com/${buff.icon}`;
                    if (buff.modifiers) {
                        for (const modifier of buff.modifiers) {
                            if ((modifier.trait_req && !context.traits.includes(modifier.trait_req)) ||
                                (modifier.mode && modifier.mode !== context.gameMode)) {
                                continue;
                            }
                            let modifierValue = this.calculateModifier(modifier, context.stats);
                            if (modifier.flags.includes('MulByDuration') &&
                                !modifier.flags.includes('FormatPercent')) {
                                modifierValue *= fact.duration.secs;
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
                    let htmlContent = `<tem> ${buff.name} (${(_a = fact.duration) === null || _a === void 0 ? void 0 : _a.secs}s) ${TUtilsV2.GW2Text2HTML(buff.description)} ${modifiers} </tem>`;
                    if (fact.apply_count && fact.apply_count > 1) {
                        htmlContent += TUtilsV2.newElement('div.buffcount', fact.apply_count.toString()).outerHTML;
                    }
                    return htmlContent;
                },
                BuffBrief: ({ fact, buff }) => {
                    if (!buff)
                        console.error('buff #', fact.buff, ' is apparently missing in the cache');
                    buff = buff || this.MissingBuff;
                    iconUrl = `https://assets.gw2dat.com/${buff.icon}`;
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
                    context.stats[fact.target.toLowerCase()] * fact.attribute_multiplier +
                    context.stats.level ** fact.level_exponent * fact.level_multiplier) *
                    fact.hit_count)} </tem>`,
            };
            const buff = fact.buff ? skillDataCache.get(fact.buff) : undefined;
            const data = { fact, buff, skill };
            htmlContent = handlers[fact.type](data);
            if (fact.text === 'pull') {
                htmlContent = `<tem> ${fact.text}: ${fact.value} </tem>`;
            }
            const factWrap = document.createElement('te');
            factWrap.innerHTML = `${TUtilsV2.newImg(iconUrl, 'iconmed')} ${htmlContent}`;
            return factWrap;
        };
        const sortedFacts = [...skill.facts].sort((a, b) => a.order - b.order);
        for (const fact of sortedFacts) {
            const factWrap = processFactData(fact);
            if (factWrap) {
                factWraps.push(factWrap);
            }
        }
        if ((skill.facts.length == 0 || context.gameMode !== 'Pve') && skill.facts_override) {
            for (const override of skill.facts_override) {
                if (override.mode === context.gameMode) {
                    const sortedOverrideFacts = [...override.facts].sort((a, b) => a.order - b.order);
                    sortedOverrideFacts.forEach(fact => {
                        const factWrap = processFactData(fact);
                        if (factWrap) {
                            factWraps.push(factWrap);
                        }
                    });
                }
            }
        }
        if (totalDefianceBreak > 0) {
            const defianceWrap = TUtilsV2.newElement('te.defiance');
            defianceWrap.innerHTML = `${TUtilsV2.newImg('https://assets.gw2dat.com/1938788.png', 'iconmed')} <tem> Defiance Break: ${totalDefianceBreak} </tem>`;
            factWraps.push(defianceWrap);
        }
        if (skill.range) {
            const rangeWrap = document.createElement('te');
            rangeWrap.innerHTML = `${TUtilsV2.newImg(`https://assets.gw2dat.com/156666.png`, 'iconmed')} <tem> Range: ${skill.range} </tem>`;
            factWraps.push(rangeWrap);
        }
        return factWraps;
    }
}
SkillsProcessor.MissingBuff = {
    id: 0,
    name: "Missing Buff",
    description: "This Buff failed to load",
    icon: "0.png",
    chat_link: "",
    facts: [],
    categories: [],
    range: 0,
    recharge: { secs: 0, nanos: 0 },
    recharge_override: [],
    activation: { secs: 0, nanos: 0 },
    palettes: [],
    modifiers: []
};
