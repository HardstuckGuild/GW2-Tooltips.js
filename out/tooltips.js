"use strict";
class FakeAPI {
    async bulkRequest(endpoint, ids) {
        if (['specializations', 'pvp/amulets', 'itemstats'].includes(endpoint)) {
            const response = await fetch(`https://api.guildwars2.com/v2/${endpoint}?ids=${ids.join(',')}`).then(r => r.json());
            if (endpoint == 'pvp/amulets') {
                for (const obj of response) {
                    obj.facts = [];
                    for (const [attribute, adjustment] of Object.entries(obj.attributes)) {
                        obj.facts.push({
                            type: 'AttributeAdjust',
                            icon: '',
                            order: -1,
                            target: attribute,
                            value: adjustment,
                            attribute_multiplier: 0,
                            level_exponent: 0,
                            hit_count: 0,
                            level_multiplier: 0,
                        });
                    }
                }
            }
            return response;
        }
        else {
            return new Promise((resolve, reject) => {
                const allSkills = window['DUMP_output_' + endpoint];
                if (allSkills) {
                    resolve(allSkills.filter(data => Array.prototype.includes.call(ids, data.id)));
                }
                else {
                    console.info(`'${endpoint}' doesn't exist in mock data, synthesizing`);
                    if (endpoint == 'pets') {
                        resolve(ids.map(id => ({
                            id,
                            name: 'pet #' + id,
                            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAABJCAIAAAD+EZyLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAFqSURBVGhD7dkxcoJAFMbxtzmLpMjkBHgCrHIKLLXJPbAMR7BKI54gnCBV5C5kFxYEmdHMwCPzMd+vcUCc8e8+lkJTlqUs1JN/XSK2YWIbJrZhYhsmtmFiGya2YWIbJrZhmqjtvDV960Ph3/o/E65bmFxKL4vzfWC2Z//OHe5H0foddGYy+shikfTzD3GKtO634CUU+f5pF6Q7tH49i8PamE0q4ta4c346fopGcsvUmcn6hMTZ8OCS2OjrpYMPTkilrfr+7XF11GRavWPNtglnshktY4K92K/7tVu508XpmEv8FlXXOKvn1964qtHZJ5uuVrrx2Y67x+agtZfc6Ixk7TZeg37bbCM4MMO6Re9JaO/F6w5vnwft49o9K/LjSafcz8hID7e76jHg9S+sN1VnMLgj8f83TGzDxDZMbMPENkxsw8Q2TGzDxDZMbMPENkxsw8Q2TGzDxDZMbMPENkxsw8Q2TGzDtNw2kV87CKi1eKVduQAAAABJRU5ErkJggg==',
                        })));
                    }
                    else {
                        reject(`'${endpoint}' doesn't exist in mock data, and i don't know how to synthesize it`);
                    }
                }
            });
        }
    }
}
class HSAPI {
    bulkRequest(endpoint, ids) {
        throw new Error("Method not implemented.");
    }
}
class APICache {
    static async ensureExistence(endpoint, initialIds) {
        if (!this.apiImpl) {
            this.apiImpl = new HSAPI();
        }
        let additionalIds = Object.assign({
            skills: new Set(),
            items: new Set(),
            traits: new Set(),
            pets: new Set(),
            'pvp/amulets': new Set(),
            specializations: new Set(),
            itemstats: new Set(),
        }, { [endpoint]: new Set(initialIds) });
        const findNextRelevantEndpoint = () => {
            for (const [endpoint, ids] of Object.entries(additionalIds))
                if (ids.size > 0)
                    return endpoint;
            return undefined;
        };
        let currentEndpoint = endpoint;
        let i = 0;
        do {
            const storageSet = this.storage[currentEndpoint];
            const request = Array.from(additionalIds[currentEndpoint].values());
            additionalIds[currentEndpoint].clear();
            console.info(`[gw2-tooltips API cache] round #${i++} for a ${endpoint} request, currently fetching ${currentEndpoint}. Ids: `, request);
            try {
                const response = await this.apiImpl.bulkRequest(currentEndpoint, request);
                const unobtainable = request.filter(id => !response.some(obj => obj.id == id));
                if (unobtainable.length)
                    console.warn(`Did not receive all requested ${currentEndpoint} ids. missing: `, unobtainable);
                for (const datum of response) {
                    if (storageSet.has(datum.id))
                        continue;
                    storageSet.set(datum.id, datum);
                    this.collectConnectedIds({ endpoint: currentEndpoint, datum }, additionalIds);
                }
            }
            catch (ex) {
                console.error(ex);
            }
        } while ((currentEndpoint = findNextRelevantEndpoint()) && i < 100);
    }
    static collectConnectedIds({ endpoint, datum }, connectedIdsStorage) {
        const addFacts = (facts) => {
            for (const fact of facts) {
                if (fact.type == 'Buff' || fact.type == 'BuffBrief') {
                    if (!this.storage.skills.has(fact.buff))
                        connectedIdsStorage.skills.add(fact.buff);
                }
                if (fact.type === 'PrefixedBuffBrief' || fact.type === 'PrefixedBuff') {
                    if (!this.storage.skills.has(fact.prefix))
                        connectedIdsStorage.skills.add(fact.prefix);
                    if (!this.storage.skills.has(fact.buff))
                        connectedIdsStorage.skills.add(fact.buff);
                }
            }
        };
        if ('palettes' in datum) {
            for (const palette of datum.palettes) {
                for (const slot of palette.slots) {
                    if (slot.profession !== 'None' && slot.next_chain && !this.storage.items.has(slot.next_chain)) {
                        connectedIdsStorage.skills.add(slot.next_chain);
                    }
                }
            }
        }
        if ('sub_skills' in datum) {
            if (datum.sub_skills) {
                for (const subSkill of datum.sub_skills)
                    if (!this.storage.skills.has(subSkill))
                        connectedIdsStorage.skills.add(subSkill);
            }
        }
        if ('facts' in datum) {
            addFacts(datum.facts);
        }
        if ('facts_override' in datum && datum.facts_override) {
            for (const { facts } of datum.facts_override)
                addFacts(facts);
        }
    }
}
APICache.storage = {
    skills: new Map(),
    items: new Map(),
    traits: new Map(),
    pets: new Map(),
    'pvp/amulets': new Map(),
    specializations: new Map(),
    itemstats: new Map(),
};
class FactsProcessor {
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
            Speargun: 1000,
            Trident: 1000,
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
    static generateFacts(apiObject, context, additional_facts) {
        let totalDefianceBreak = 0;
        const processFactData = (fact) => {
            if (fact.type === 'Recharge') {
                return null;
            }
            if (fact.requires_trait && (!context.traits || !fact.requires_trait.some(reqTrait => context.traits.includes(reqTrait)))) {
                return null;
            }
            let iconSlug = fact.icon;
            if (fact.defiance_break) {
                totalDefianceBreak += fact.defiance_break;
            }
            const factInflators = {
                Time: ({ fact }) => `<tem> ${fact.text}: ${TUtilsV2.DurationToSeconds(fact.duration)}s </tem>`,
                Distance: ({ fact }) => `<tem> ${fact.text}: ${fact.distance} </tem>`,
                Number: ({ fact }) => `<tem> ${fact.text}: ${fact.value} </tem>`,
                ComboField: ({ fact }) => `<tem> ${fact.text}: ${fact.field_type} </tem>`,
                ComboFinisher: ({ fact }) => `<tem> ${fact.text}: ${fact.finisher_type} </tem>`,
                NoData: ({ fact }) => `<tem> ${fact.text} </tem>`,
                Percent: ({ fact }) => `<tem> ${TUtilsV2.GW2Text2HTML(fact.text)}: ${fact.percent}% </tem>`,
                Radius: ({ fact }) => `<tem> ${fact.text} </tem>`,
                Range: ({ fact }) => `<tem> ${fact.text} </tem>`,
                HealingAdjust: ({ fact }) => `<tem> ${fact.text} </tem>`,
                Heal: () => `<tem> !!Heal </tem>`,
                Duration: () => `<tem> !!Duration </tem>`,
                StunBreak: () => `<tem> Breaks Stun </tem>`,
                Unblockable: () => `<tem> Unblockable </tem>`,
                PrefixedBuff: ({ fact }) => {
                    let prefix = APICache.storage.skills.get(fact.prefix);
                    if (!prefix) {
                        console.error('prefix #', fact.prefix, ' is apparently missing in the cache');
                        prefix = this.MissingBuff;
                    }
                    iconSlug = prefix.icon || iconSlug;
                    let buff = APICache.storage.skills.get(fact.buff);
                    if (!buff) {
                        console.error('buff #', fact.buff, ' is apparently missing in the cache');
                        buff = this.MissingBuff;
                    }
                    return `<tem> ${TUtilsV2.newImg(buff.icon, 'iconmed').outerHTML} ${buff.name_brief || buff.name} </tem>`;
                },
                PrefixedBuffBrief: ({ fact }) => {
                    let prefix = APICache.storage.skills.get(fact.prefix);
                    if (!prefix) {
                        console.error('prefix #', fact.prefix, ' is apparently missing in the cache');
                        prefix = this.MissingBuff;
                    }
                    iconSlug = prefix.icon || iconSlug;
                    let buff = APICache.storage.skills.get(fact.buff);
                    if (!buff) {
                        console.error('buff #', fact.buff, ' is apparently missing in the cache');
                        buff = this.MissingBuff;
                    }
                    return `<tem> ${TUtilsV2.newImg(buff.icon, 'iconmed').outerHTML} ${buff.name_brief || buff.name} </tem>`;
                },
                Buff: ({ fact, buff }) => {
                    if (!buff)
                        console.error('buff #', fact.buff, ' is apparently missing in the cache');
                    buff = buff || this.MissingBuff;
                    let modifiers = '';
                    iconSlug = buff.icon;
                    if (buff.modifiers) {
                        for (const modifier of buff.modifiers) {
                            if ((modifier.trait_req && !context.traits.includes(modifier.trait_req)) ||
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
                    const description = TUtilsV2.GW2Text2HTML(buff.description_brief || buff.description || modifiers);
                    const seconds = TUtilsV2.DurationToSeconds(fact.duration);
                    const durationText = seconds ? `(${seconds}s)` : '';
                    let htmlContent = `<tem> ${buff.name_brief || buff.name} ${durationText} ${description} </tem>`;
                    if (fact.apply_count && fact.apply_count > 1) {
                        htmlContent += TUtilsV2.newElm('div.buffcount', fact.apply_count.toString()).outerHTML;
                    }
                    return htmlContent;
                },
                BuffBrief: ({ fact, buff }) => {
                    if (!buff)
                        console.error('buff #', fact.buff, ' is apparently missing in the cache');
                    buff = buff || this.MissingBuff;
                    iconSlug = buff.icon;
                    let text = TUtilsV2.GW2Text2HTML(fact.text).replace("%str1%", buff.name);
                    return `<tem> ${text} </tem> `;
                },
                Damage: ({ fact, skill }) => {
                    var _a;
                    let weaponStrength = 690.5;
                    if ((_a = skill.palettes) === null || _a === void 0 ? void 0 : _a.length) {
                        const relevantPalette = skill.palettes.find(palette => palette.slots.some(slot => slot.profession !== 'None'));
                        if (relevantPalette) {
                            weaponStrength = this.getWeaponStrength(relevantPalette);
                        }
                    }
                    let hitCountLabel = '';
                    let damage = weaponStrength * fact.hit_count * fact.dmg_multiplier * context.stats.power / context.targetArmor;
                    if (!fact.hit_count)
                        console.warn("0 hit count: ", fact);
                    if (fact.hit_count > 1) {
                        damage *= fact.hit_count;
                        hitCountLabel = `(${fact.hit_count}x)`;
                    }
                    return `<tem> ${fact.text}: ${hitCountLabel} ${Math.round(damage)} </tem>`;
                },
                AttributeAdjust: ({ fact }) => {
                    const attribute = apiObject.attribute_adjustment || context.stats[TUtilsV2.Uncapitalize(fact.target)] || 0;
                    const value = Math.round(fact.value + attribute * fact.attribute_multiplier + context.stats.level ** fact.level_exponent * fact.level_multiplier);
                    return `<tem> ${value > 0 ? '+' + value : value} ${fact.text || fact.target} </tem>`;
                },
                BuffConversion: ({ fact }) => {
                    const attribute = context.stats[TUtilsV2.Uncapitalize(fact.source)] || 0;
                    const value = Math.round(attribute * fact.percent / 100);
                    return `<tem> ${fact.text}: Converting ${fact.percent}% of ${fact.source} to +${value} ${fact.target} </tem>`;
                }
            };
            const buff = APICache.storage.skills.get(fact.buff || 0);
            const data = { fact, buff, skill: apiObject };
            const wrapper = TUtilsV2.newElm('te');
            const text = TUtilsV2.fromHTML(factInflators[fact.type](data));
            if (iconSlug)
                wrapper.append(TUtilsV2.newImg(iconSlug, 'iconmed'));
            wrapper.append(text);
            return wrapper;
        };
        const factWraps = apiObject.facts
            .sort((a, b) => a.order - b.order)
            .map(processFactData)
            .filter(d => d);
        if (additional_facts) {
            for (const fact of additional_facts.map(processFactData)) {
                if (fact)
                    factWraps.push(fact);
            }
        }
        if ((apiObject.facts.length == 0 || context.gameMode !== 'Pve') && apiObject.facts_override) {
            for (const override of apiObject.facts_override) {
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
            const defianceWrap = TUtilsV2.newElm('te.defiance', TUtilsV2.newImg('1938788.png', 'iconmed'), TUtilsV2.newElm('tem', `Defiance Break: ${totalDefianceBreak}`));
            factWraps.push(defianceWrap);
        }
        if ('range' in apiObject && apiObject.range) {
            const rangeWrap = TUtilsV2.newElm('te', TUtilsV2.newImg('156666.png', 'iconmed'), TUtilsV2.newElm('tem', `Range: ${apiObject.range}`));
            factWraps.push(rangeWrap);
        }
        return factWraps;
    }
}
FactsProcessor.MissingBuff = {
    id: 0,
    name: 'Missing Buff',
    description: 'This Buff failed to load',
    facts: [],
    categories: [],
    palettes: [],
    modifiers: [],
};
class TUtilsV2 {
    static newElm(spec, ...inner) {
        const [tag, ...classes] = spec.split('.');
        const el = document.createElement(tag);
        if (classes.length)
            el.classList.add(...classes);
        if (inner.length)
            el.append(...inner);
        return el;
    }
    static newImg(src, className, alt) {
        const img = document.createElement('img');
        img.src = src ? (src.includes(':') ? src : this.iconSource + src) : this.missingImage;
        if (className)
            img.classList.add(className);
        img.alt = alt ? alt + ' icon' : 'icon';
        return img;
    }
    static fromHTML(html) {
        this.dummy.innerHTML = html;
        return this.dummy.content;
    }
}
TUtilsV2.iconSource = 'https://assets.gw2dat.com/';
TUtilsV2.missingImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHEAAABuCAIAAACfnGvJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAMCSURBVHhe7ZjpkeowEAaJywERD9GQDMGwumyPLj+2XssH+/UPyjMjjVBjUWXf3oJGTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSU51inr8d0u02PVwp/xf/MHQvt9Hm/Be7PlMgIHhyzCjn9hNlpc7ebxe9hhNPp8QifpTdfuz9Oe3thjHH6Cndkfv7DWb0/syNbnN8QJuzkZr5q5K+Xk2C6BtbCTDEAZJDTuIfKi0tUKuZgHhBx89P1Zj5rtK4YQzspL43z6RnltFBR5DMVKVhGFPTy3UYBO6vo0GuIMcxpvs1O2gbhei0tbOazRusvmCe+x6nddDtbBA4/LmEFNfN1o57TOD0F5ZIDGOh0CbL91SrqDYZ07iiQ5etGdrxNpGkz9XowQ53GG2Sa7H5rFc095n1W1nzdqOPUXzbXGMVYp1FqlqlVxMCNXEd9kG806t2n87cw2KE4g53mO/fUKrJgxkzp5Ou5Paf//E4wtNPzUelupki+32k8+cZgMDpQ6V9w6ij+UAeee8/fcLovcsojpzxyyiOnPHLKI6c8csqDOx39MH0B5JRHTnmGO00v2uKLi0B8e7E8ghf+7aP5RimyDrC1ga9HPmIXp2ajy95tvEhwUaHJlpaouUandgD7OF3MpHijbrAlf13MmsOwoulQxruzu9NfGLClvtO6QTF2d87mNISWuWT7ZGtUMwJy2nLVKK2YBcqGx3Mmp+XUomQqGUcf9YpT3afZ2BBUoWFpElqYnm7ooY5P9n8a9QRcDz83lfylFdVcJnGoUAfudAjlD+FopM7CNZy27/aTKr2KU4c93Y6jD/gG13F6HeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklOb9/gEv6oxxwmIw6QAAAABJRU5ErkJggg==';
TUtilsV2.dummy = document.createElement('template');
TUtilsV2.GW2Text2HTML = (text, tag = 'span', itemStackSize = 1) => text
    ? text
        .replace(/<c=@(.*?)>(.*?)<\/c>/g, `<${tag} class="color-$1">$2</${tag}>`)
        .replace(/%%/g, '%')
        .replace(/\[(.+?)\]/g, itemStackSize > 1 ? '$1' : '')
    : '';
TUtilsV2.DurationToSeconds = (dur) => dur.secs + dur.nanos / 10e8;
TUtilsV2.Uncapitalize = (str) => str.charAt(0).toLowerCase() + str.slice(1);
class GW2TooltipsV2 {
    static createCompleteContext(partialContext) {
        const stats = Object.assign({}, this.defaultContext.stats, partialContext.stats);
        return Object.assign({}, this.defaultContext, partialContext, { stats });
    }
    constructor() {
        this.cycling = false;
        this.context = [];
        this.inflators = (function () {
            const genericIconInflater = () => (gw2Object, data) => {
                const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(data.icon, undefined, data.name));
                wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + data.name;
                wikiLink.target = '_blank';
                if (gw2Object.classList.contains('gw2objectembed'))
                    wikiLink.append(data.name);
                gw2Object.append(wikiLink);
            };
            return {
                skills: genericIconInflater(),
                traits: genericIconInflater(),
                items: genericIconInflater(),
                specializations: function (gw2Object, spec) {
                    gw2Object.style.backgroundImage = `url(${spec.background})`;
                    gw2Object.dataset.label = spec.name;
                },
                pets: genericIconInflater(),
                "pvp/amulets": genericIconInflater(),
            };
        })();
        if (window.GW2TooltipsContext instanceof Array) {
            for (const partialContext of window.GW2TooltipsContext)
                this.context.push(GW2TooltipsV2.createCompleteContext(partialContext));
        }
        else if (window.GW2TooltipsContext) {
            this.context.push(GW2TooltipsV2.createCompleteContext(window.GW2TooltipsContext));
        }
        else {
            this.context.push(GW2TooltipsV2.createCompleteContext({}));
        }
        this.config = Object.assign({}, GW2TooltipsV2.defaultConfig, window.GW2TooltipsConfig);
        this.tooltip = TUtilsV2.newElm('div.tooltipWrapper');
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
        document.addEventListener('mousemove', event => {
            gw2tooltips.lastMouseX = event.pageX;
            gw2tooltips.lastMouseY = event.pageY;
            if (this.tooltip.style.display != 'none')
                gw2tooltips.positionTooltip();
        });
        document.addEventListener('contextmenu', event => {
            if (!this.cycleTooltipsHandler)
                return;
            event.preventDefault();
            this.cycleTooltipsHandler();
        });
    }
    displayCorrectChainTooltip(tooltips, tooltipIndex) {
        for (let index = 0; index < tooltips.length; index++) {
            tooltips[index].classList.toggle('active', index === tooltipIndex);
        }
    }
    cycleTooltips() {
        if (!this.cycling)
            return;
        this.cycling = true;
        const chainTooltips = Array.from(this.tooltip.children);
        this.cyclePos = chainTooltips.length - this.baseTooltip;
        const totalTooltips = chainTooltips.length - this.baseTooltip;
        this.cyclePos = (this.cyclePos - 1 + totalTooltips) % totalTooltips;
        this.displayCorrectChainTooltip(chainTooltips, this.cyclePos);
        this.positionTooltip();
    }
    positionTooltip() {
        const tooltip = this.tooltip;
        const wpadminbar = document.getElementById('wpadminbar');
        const additionaloffset = wpadminbar ? wpadminbar.offsetHeight : 0;
        let tooltipXpos = this.lastMouseX + 16;
        if (this.lastMouseX + tooltip.offsetWidth + 22 > window.innerWidth) {
            tooltipXpos = window.innerWidth - 22 - tooltip.offsetWidth;
        }
        let tooltipYpos = this.lastMouseY - 6 - tooltip.offsetHeight;
        if (this.lastMouseY - tooltip.offsetHeight - 13 - document.documentElement.scrollTop < 0) {
            tooltipYpos = additionaloffset + 6 + document.documentElement.scrollTop;
        }
        tooltip.style.transform = `translate(${tooltipXpos}px, ${tooltipYpos}px)`;
    }
    hookDocument(scope, _unused) {
        const objectsToGet = {
            skills: new Map(),
            traits: new Map(),
            items: new Map(),
            specializations: new Map(),
            pets: new Map(),
            'pvp/amulets': new Map(),
        };
        const statsToGet = new Set();
        for (const gw2Object of scope.getElementsByTagName('gw2object')) {
            const stats = +String(gw2Object.getAttribute('stats'));
            if (!isNaN(stats))
                statsToGet.add(stats);
            const objId = +String(gw2Object.getAttribute('objId'));
            const type = (gw2Object.getAttribute('type') || 'skill') + 's';
            if (isNaN(objId) || !(type in objectsToGet))
                continue;
            const elementsWithThisId = objectsToGet[type].get(objId);
            if (elementsWithThisId)
                elementsWithThisId.push(gw2Object);
            else
                objectsToGet[type].set(objId, [gw2Object]);
            gw2Object.addEventListener('mouseenter', (e) => {
                const gw2Object = e.target;
                const type = (gw2Object.getAttribute('type') || 'skill') + 's';
                const objId = +String(gw2Object.getAttribute('objId'));
                if (type != 'skills' && type != 'traits' && type != 'pvp/amulets' && type != "items")
                    return;
                const data = APICache.storage[type].get(objId);
                if (data) {
                    this.tooltip.replaceChildren(...this.generateToolTipList(data, gw2Object));
                    this.tooltip.style.display = '';
                }
            });
            gw2Object.addEventListener('mouseleave', () => {
                this.tooltip.style.display = 'none';
                this.cycleTooltipsHandler = undefined;
            });
        }
        if (statsToGet.size > 0)
            APICache.ensureExistence('itemstats', statsToGet.values());
        Object.entries(objectsToGet).forEach(async ([key, values]) => {
            if (values.size == 0)
                return;
            const inflator = this.inflators[key];
            const cache = APICache.storage[key];
            await APICache.ensureExistence(key, values.keys());
            for (const [id, objects] of values) {
                const data = cache.get(id);
                if (!objects || !data)
                    continue;
                for (const gw2Object of objects)
                    inflator(gw2Object, data);
            }
        });
    }
    getSlotName(skill) {
        let skillSlot;
        for (const palette of skill.palettes) {
            for (const slot of palette.slots) {
                switch (palette.type) {
                    case 'Equipment':
                        if (palette.weapon_type !== 'None') {
                            const replaceFn = (_, __, digit) => {
                                if (['Greatsword', 'Hammer', 'BowLong', 'Rifle', 'BowShort', 'Staff'].includes(palette.weapon_type) &&
                                    ['Offhand1', 'Offhand2'].includes(slot.slot)) {
                                    digit = digit === '1' ? '4' : '5';
                                }
                                return `${palette.weapon_type} ${digit}`;
                            };
                            skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, replaceFn);
                        }
                        break;
                    case 'Standard':
                        if (slot.slot === 'Standard') {
                            skillSlot = 'Utility';
                        }
                        break;
                    case 'Heal':
                        skillSlot = 'Heal';
                        break;
                    case 'Bundle':
                        skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, (_, __, digit) => `Weapon ${digit}`);
                        break;
                    case 'Toolbelt':
                        skillSlot = 'Toolbelt';
                        break;
                    case 'Elite':
                        skillSlot = 'Elite';
                        break;
                    case 'Profession':
                        skillSlot = slot.slot;
                        break;
                    case 'Monster':
                        break;
                    default:
                        console.error(`unknown palette type '${palette.type}' for skill '${skill.name}'`);
                }
            }
        }
        return skillSlot;
    }
    getRecharge(apiObject, gameMode) {
        var _a, _b, _c;
        let recharge = apiObject.facts.find(f => f.type === 'Recharge');
        let override = (_b = (_a = apiObject.facts_override) === null || _a === void 0 ? void 0 : _a.find(f => f.mode === gameMode)) === null || _b === void 0 ? void 0 : _b.facts.find(f => f.type === 'Recharge');
        return (_c = (override || recharge)) === null || _c === void 0 ? void 0 : _c.duration;
    }
    generateToolTip(apiObject, context, stats, additionalFacts) {
        let recharge = '';
        if ('facts' in apiObject) {
            const _recharge = this.getRecharge(apiObject, context.gameMode);
            if (_recharge) {
                recharge = TUtilsV2.newElm('ter', TUtilsV2.DurationToSeconds(_recharge) + 's', TUtilsV2.newImg('156651.png', 'iconsmall'));
            }
        }
        const namePrefix = stats ? stats.name + ' ' : '';
        const headerElements = [TUtilsV2.newElm('teb', namePrefix + TUtilsV2.GW2Text2HTML(apiObject.name))];
        if ('palettes' in apiObject)
            headerElements.push(TUtilsV2.newElm('tes', `( ${this.getSlotName(apiObject)} )`));
        else if ('slot' in apiObject)
            headerElements.push(TUtilsV2.newElm('tes', `( ${apiObject.slot} )`));
        if ('facts_override' in apiObject && apiObject.facts_override) {
            const remainder = new Set(['Pve', 'Pvp', 'Wvw']);
            const allModes = ['Pve', 'Pvp', 'Wvw'];
            for (const mode of allModes) {
                for (const override of apiObject.facts_override) {
                    if (mode == override.mode) {
                        remainder.delete(mode);
                    }
                }
            }
            const splits = [];
            let pushedRemainder = false;
            for (const mode of allModes) {
                if (remainder.has(mode)) {
                    if (pushedRemainder)
                        continue;
                    const text = Array.from(remainder).join('/');
                    if (remainder.has(context.gameMode))
                        splits.push(`<span style="color: var(--gw2-tt-color-text-accent) !important;">${text}</span>`);
                    else
                        splits.push(text);
                    pushedRemainder = true;
                }
                else {
                    if (mode == context.gameMode)
                        splits.push(`<span style="color: var(--gw2-tt-color-text-accent) !important;">${mode}</span>`);
                    else
                        splits.push(mode);
                }
            }
            headerElements.push(TUtilsV2.newElm('tes', '( ', TUtilsV2.fromHTML(splits.join(' | ')), ' )'));
        }
        const parts = [
            TUtilsV2.newElm('tet', ...headerElements, TUtilsV2.newElm('div.flexbox-fill'), recharge)
        ];
        if ('description' in apiObject && apiObject.description) {
            const description = document.createElement('ted');
            description.innerHTML = `<teh>${TUtilsV2.GW2Text2HTML(apiObject.description)}</teh>`;
            parts.push(description);
        }
        if ('facts' in apiObject) {
            parts.push(...FactsProcessor.generateFacts(apiObject, context, additionalFacts));
        }
        const tooltip = TUtilsV2.newElm('div.tooltip', ...parts);
        tooltip.dataset.id = String(apiObject.id);
        tooltip.style.marginTop = '5px';
        return tooltip;
    }
    generateToolTipList(initialAPIObject, gw2Object) {
        const objectChain = [];
        const validPaletteTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard'];
        const addObjectsToChain = (currentSkill) => {
            objectChain.push(currentSkill);
            if ('palettes' in currentSkill) {
                for (const palette of currentSkill.palettes) {
                    for (const slot of palette.slots) {
                        if (slot.next_chain && slot.profession !== 'None') {
                            const nextSkillInChain = APICache.storage.skills.get(slot.next_chain);
                            if (nextSkillInChain) {
                                addObjectsToChain(nextSkillInChain);
                            }
                        }
                    }
                }
                if (currentSkill.sub_skills) {
                    for (const subSkillId of currentSkill.sub_skills) {
                        const subSkillInChain = APICache.storage.skills.get(subSkillId);
                        if (subSkillInChain && subSkillInChain.palettes.some(palette => validPaletteTypes.includes(palette.type))) {
                            addObjectsToChain(subSkillInChain);
                        }
                    }
                }
            }
        };
        addObjectsToChain(initialAPIObject);
        const additionalFacts = [];
        const statSetId = +String(gw2Object.getAttribute('stats'));
        let statSet = undefined;
        if (!isNaN(statSetId)) {
            statSet = APICache.storage.itemstats.get(statSetId);
            if (!statSet)
                console.error(`itemstats #${statSetId} is missing in the cache`);
            else {
                for (const { attribute, value, multiplier } of statSet.attributes) {
                    additionalFacts.push({
                        type: 'AttributeAdjust',
                        icon: '',
                        order: -1,
                        target: attribute,
                        value,
                        attribute_multiplier: multiplier,
                        level_exponent: 0,
                        hit_count: 0,
                        level_multiplier: 0,
                    });
                }
            }
        }
        const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
        const tooltipChain = objectChain.map(obj => this.generateToolTip(obj, context, statSet, additionalFacts));
        this.tooltip.append(...tooltipChain);
        if (tooltipChain.length > 1) {
            gw2Object.classList.add('cycler');
            gw2Object.title = 'Right-click to cycle through tooltips';
            let currentTooltipIndex = 0;
            this.displayCorrectChainTooltip(tooltipChain, currentTooltipIndex);
            this.cycleTooltipsHandler = () => {
                gw2tooltips.cycleTooltips();
                currentTooltipIndex = (currentTooltipIndex + 1) % tooltipChain.length;
                gw2tooltips.displayCorrectChainTooltip(tooltipChain, currentTooltipIndex);
                this.positionTooltip();
            };
        }
        else {
            tooltipChain[0].classList.add('active');
        }
        return tooltipChain;
    }
}
GW2TooltipsV2.defaultContext = {
    traits: [],
    gameMode: 'Pve',
    targetArmor: 2597,
    stats: {
        level: 80,
        power: 1000,
        toughness: 1000,
        vitality: 1000,
        precision: 1000,
        ferocity: 1000,
        conditionDamage: 0,
        expertise: 0,
        concentration: 0,
        healing: 0,
        critDamage: 0,
    },
};
GW2TooltipsV2.defaultConfig = {
    autoInitialize: true,
};
const gw2tooltips = new GW2TooltipsV2();
if (gw2tooltips.config.autoInitialize)
    gw2tooltips.hookDocument(document);
