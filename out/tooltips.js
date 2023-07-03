"use strict";
class FakeAPI {
    async bulkRequest(endpoint, ids) {
        if (['specializations', 'pvp/amulets'].includes(endpoint)) {
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
                const allData = window['DUMP_output_' + endpoint];
                if (allData) {
                    const apiResult = allData.filter(data => ids.includes(data.id));
                    if (endpoint == 'itemstats') {
                        const additionalIdsWithDuplicates = apiResult
                            .map(set => set.similar_sets)
                            .filter(similars => similars)
                            .map(similars => Object.values(similars));
                        for (const additionalId of new Set(Array.prototype.concat(...additionalIdsWithDuplicates))) {
                            if (!apiResult.some(set => set.id == additionalId)) {
                                apiResult.push(allData.find(set => set.id == additionalId));
                            }
                        }
                    }
                    resolve(apiResult);
                }
                else {
                    console.info(`[gw2-tooltips] [FakeAPI]'${endpoint}' doesn't exist in mock data, synthesizing`);
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
            console.info(`[gw2-tooltips] [API cache] round #${i++} for a ${endpoint} request, currently fetching ${currentEndpoint}. Ids: `, request);
            try {
                const response = await this.apiImpl.bulkRequest(currentEndpoint, request);
                const unobtainable = request.filter(id => !response.some(obj => obj.id == id));
                if (unobtainable.length)
                    console.warn(`[gw2-tooltips] [API cache] Did not receive all requested ${currentEndpoint} ids. missing: `, unobtainable);
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
        if ('attribute_set' in datum && datum.attribute_set) {
            if (!this.storage.itemstats.has(datum.attribute_set))
                connectedIdsStorage.itemstats.add(datum.attribute_set);
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
class Collect {
    static allRuneCounts(contexts, scope, mode = 1) {
        const elements = scope.getElementsByTagName('gw2object');
        for (const pair of contexts.entries()) {
            const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) == pair[0]);
            this._runeCounts(...pair, elsInCorrectCtx, mode);
        }
        const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) >= contexts.length);
        if (elsWithWrongCtx.length) {
            console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
        }
    }
    static specificRuneCounts(contextIndex, targetContext, scope, mode = 1) {
        this._runeCounts(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
    }
    static _runeCounts(contextIndex, targetContext, elements, mode = 1) {
        var _a, _b, _c, _d;
        const counts = {};
        for (const element of elements) {
            let id;
            if (element.getAttribute('type') !== 'item' || !(id = +String(element.getAttribute('objid'))))
                continue;
            const item = APICache.storage.items.get(id);
            if (!item || !('subtype' in item) || item.subtype !== 'Rune')
                continue;
            counts[item.id] = (counts[item.id] || 0) + 1;
        }
        switch (mode) {
            case 0:
                targetContext.character.runeCounts = counts;
                break;
            case 3:
                targetContext.character.runeCounts = Object.assign(targetContext.character.runeCounts, counts);
                break;
            case 1:
                {
                    if (window.GW2TooltipsContext instanceof Array) {
                        targetContext.character.runeCounts = Object.assign(counts, (_a = window.GW2TooltipsContext[contextIndex].character) === null || _a === void 0 ? void 0 : _a.runeCounts);
                    }
                    else if (window.GW2TooltipsContext) {
                        targetContext.character.runeCounts = Object.assign(counts, (_b = window.GW2TooltipsContext.character) === null || _b === void 0 ? void 0 : _b.runeCounts);
                    }
                    else {
                        targetContext.character.runeCounts = counts;
                    }
                }
                break;
            case 2:
                {
                    if (window.GW2TooltipsContext instanceof Array) {
                        targetContext.character.runeCounts = Object.assign({}, (_c = window.GW2TooltipsContext[contextIndex].character) === null || _c === void 0 ? void 0 : _c.runeCounts, counts);
                    }
                    else if (window.GW2TooltipsContext) {
                        targetContext.character.runeCounts = Object.assign({}, (_d = window.GW2TooltipsContext.character) === null || _d === void 0 ? void 0 : _d.runeCounts, counts);
                    }
                    else {
                        targetContext.character.runeCounts = counts;
                    }
                }
                break;
        }
    }
    static allStatSources(contexts, scope, mode = 1) {
        const elements = scope.getElementsByTagName('gw2object');
        for (const pair of contexts.entries()) {
            const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) == pair[0]);
            this._statSources(...pair, elsInCorrectCtx, mode);
        }
        const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('statSet')) || 0) >= contexts.length);
        if (elsWithWrongCtx.length) {
            console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
        }
    }
    static specificStatSources(contextIndex, targetContext, scope, mode = 1) {
        this._statSources(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
    }
    static _statSources(contextIndex, targetContext, elements, mode = 1) {
        var _a, _b, _c, _d, _e, _f;
        const sources = {
            power: [],
            toughness: [],
            vitality: [],
            precision: [],
            ferocity: [],
            conditionDmg: [],
            expertise: [],
            concentration: [],
            healing: [],
            critDamage: [],
        };
        let upgrades = Object.assign({}, targetContext.character.runeCounts);
        for (const element of elements) {
            let id;
            if (element.getAttribute('type') !== 'item' || !(id = +String(element.getAttribute('objid'))))
                continue;
            const item = APICache.storage.items.get(id);
            if (!item || !('subtype' in item))
                continue;
            if (item.type === 'UpgradeComponent') {
                const tierNumber = upgrades[item.id] = (upgrades[item.id] || 0) + 1;
                let tier;
                if (item.subtype === 'Rune') {
                    if (tierNumber > 6) {
                        if (!targetContext.character.runeCounts[item.id])
                            console.warn("[gw2-tooltips] [collect] Found more than 6 runes of the same type. Here is the 7th rune element: ", element);
                        continue;
                    }
                    tier = item.tiers[tierNumber - 1];
                }
                else {
                    if (item.subtype === 'Sigil' && tierNumber > 1) {
                        if (tierNumber > 2)
                            console.warn("[gw2-tooltips] [collect] Found more than 2 sigils of the same type. Here is the 3th sigil element: ", element);
                        continue;
                    }
                    tier = item.tiers[0];
                }
                if (tier.modifiers)
                    for (const mod of tier.modifiers) {
                        if (!mod.attribute)
                            continue;
                        const amount = FactsProcessor.calculateModifier(mod, targetContext.character);
                        const type = mod.flags.includes('FormatPercent') ? 'Percent' : 'Flat';
                        sources[TUtilsV2.Uncapitalize(mod.attribute)].push({ amount, type, source: item.name });
                    }
            }
        }
        switch (mode) {
            case 0:
                targetContext.character.statSources = sources;
                break;
            case 3:
                targetContext.character.statSources = Object.assign(targetContext.character.statSources, sources);
                break;
            case 1:
                {
                    if (window.GW2TooltipsContext instanceof Array) {
                        targetContext.character.statSources = Object.assign(sources, (_a = window.GW2TooltipsContext[contextIndex].character) === null || _a === void 0 ? void 0 : _a.statSources);
                    }
                    else if (window.GW2TooltipsContext) {
                        targetContext.character.statSources = Object.assign(sources, (_b = window.GW2TooltipsContext.character) === null || _b === void 0 ? void 0 : _b.statSources);
                    }
                    else {
                        targetContext.character.statSources = sources;
                    }
                }
                break;
            case 2:
                {
                    if (window.GW2TooltipsContext instanceof Array) {
                        targetContext.character.statSources = Object.assign({}, (_c = window.GW2TooltipsContext[contextIndex].character) === null || _c === void 0 ? void 0 : _c.statSources, sources);
                    }
                    else if (window.GW2TooltipsContext) {
                        targetContext.character.statSources = Object.assign({}, (_d = window.GW2TooltipsContext.character) === null || _d === void 0 ? void 0 : _d.statSources, sources);
                    }
                    else {
                        targetContext.character.statSources = sources;
                    }
                }
                break;
        }
        {
            let baseStats;
            if (window.GW2TooltipsContext instanceof Array) {
                baseStats = Object.assign({}, (_e = window.GW2TooltipsContext[contextIndex].character) === null || _e === void 0 ? void 0 : _e.stats, GW2TooltipsV2.defaultContext.character.stats);
            }
            else if (window.GW2TooltipsContext) {
                baseStats = Object.assign({}, (_f = window.GW2TooltipsContext.character) === null || _f === void 0 ? void 0 : _f.stats, GW2TooltipsV2.defaultContext.character.stats);
            }
            else {
                baseStats = Object.assign({}, GW2TooltipsV2.defaultContext.character.stats);
            }
            for (const [attrib, sources] of Object.entries(targetContext.character.statSources)) {
                let value = baseStats[attrib];
                for (const { amount, source } of sources.filter(s => s.type === "Flat")) {
                    value += amount;
                    console.log(`[gw2-tooltips] [collect] ${source}: ${attrib} + ${amount} = ${value}`);
                }
                for (const { amount, source } of sources.filter(s => s.type === "Percent")) {
                    value *= amount;
                    console.log(`[gw2-tooltips] [collect] ${source}: ${attrib} * ${amount} = ${value}`);
                }
                targetContext.character.stats[attrib] = value;
            }
        }
    }
}
class FactsProcessor {
    static calculateModifier({ formula, base_amount, formula_param1: level_scaling, formula_param2 }, { level, stats: { power, conditionDmg, healing: healing_power } }) {
        switch (formula) {
            case 'BuffLevelLinear':
                return level * level_scaling + base_amount;
            case 'ConditionDamage':
                return level * level_scaling + base_amount + conditionDmg * formula_param2;
            case 'ConditionDamageSquared':
                return level * level * level_scaling + base_amount + conditionDmg * formula_param2;
            case 'NoScaling':
                return base_amount;
            case 'Regeneration':
                return level * level_scaling + base_amount + healing_power * formula_param2;
            case 'RegenerationSquared':
                return level * level * level_scaling + base_amount + healing_power * formula_param2;
            case 'SpawnScaleLinear':
            case 'TargetLevelLinear':
                return level * level_scaling + base_amount;
            case 'BuffFormulaType11':
                return level * level_scaling + base_amount - formula_param2;
            case 'Power':
                return level * level_scaling + base_amount + power * formula_param2;
            case 'PowerSquared':
                return level * level * level_scaling + base_amount + power * formula_param2;
        }
        console.warn('[gw2-tooltips] [facts processor] Could not find formula #', formula, ', using base amount for now!');
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
    static generateFacts(apiObject, context) {
        var _a;
        let totalDefianceBreak = 0;
        const factWraps = (apiObject.facts || [])
            .sort((a, b) => a.order - b.order)
            .map(fact => {
            const { wrapper, defiance_break } = this.generateFact(fact, apiObject, context);
            totalDefianceBreak += defiance_break;
            return wrapper;
        })
            .filter(d => d);
        if ((!((_a = apiObject.facts) === null || _a === void 0 ? void 0 : _a.length) || context.gameMode !== 'Pve') && apiObject.facts_override) {
            for (const override of apiObject.facts_override) {
                if (override.mode === context.gameMode) {
                    const sortedOverrideFacts = [...override.facts].sort((a, b) => a.order - b.order);
                    sortedOverrideFacts.forEach(fact => {
                        const { wrapper } = this.generateFact(fact, apiObject, context);
                        if (wrapper)
                            factWraps.push(wrapper);
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
    static generateFact(fact, skill, context) {
        if (fact.type === 'Recharge') {
            return { defiance_break: 0 };
        }
        if (fact.requires_trait && (!context.character.traits || !fact.requires_trait.some(reqTrait => context.character.traits.includes(reqTrait)))) {
            return { defiance_break: 0 };
        }
        let iconSlug = fact.icon;
        const factInflators = {
            Time: ({ fact }) => `<tem> ${fact.text}: ${fact.duration / 1000}s </tem>`,
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
                    console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
                    prefix = this.MissingBuff;
                }
                iconSlug = prefix.icon || iconSlug;
                let buff = APICache.storage.skills.get(fact.buff);
                if (!buff) {
                    console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
                    buff = this.MissingBuff;
                }
                return `<tem> ${TUtilsV2.newImg(buff.icon, 'iconmed').outerHTML} ${buff.name_brief || buff.name} </tem>`;
            },
            PrefixedBuffBrief: ({ fact }) => {
                let prefix = APICache.storage.skills.get(fact.prefix);
                if (!prefix) {
                    console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
                    prefix = this.MissingBuff;
                }
                iconSlug = prefix.icon || iconSlug;
                let buff = APICache.storage.skills.get(fact.buff);
                if (!buff) {
                    console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
                    buff = this.MissingBuff;
                }
                return `<tem> ${TUtilsV2.newImg(buff.icon, 'iconmed').outerHTML} ${buff.name_brief || buff.name} </tem>`;
            },
            Buff: ({ fact, buff }) => {
                if (!buff)
                    console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
                buff = buff || this.MissingBuff;
                let modifiers = '';
                iconSlug = buff.icon;
                if (buff.modifiers) {
                    for (const modifier of buff.modifiers) {
                        if ((modifier.trait_req && !context.character.traits.includes(modifier.trait_req)) ||
                            (modifier.mode && modifier.mode !== context.gameMode)) {
                            continue;
                        }
                        let modifierValue = this.calculateModifier(modifier, context.character);
                        if (modifier.flags.includes('MulByDuration') &&
                            !modifier.flags.includes('FormatPercent')) {
                            modifierValue *= fact.duration / 1000;
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
                const seconds = fact.duration / 1000;
                const durationText = seconds ? `(${seconds}s)` : '';
                let htmlContent = `<tem> ${buff.name_brief || buff.name} ${durationText} ${description} </tem>`;
                if (fact.apply_count && fact.apply_count > 1) {
                    htmlContent += TUtilsV2.newElm('div.buffcount', fact.apply_count.toString()).outerHTML;
                }
                return htmlContent;
            },
            BuffBrief: ({ fact, buff }) => {
                if (!buff)
                    console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
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
                let damage = weaponStrength * fact.hit_count * fact.dmg_multiplier * context.character.stats.power / context.targetArmor;
                if (!fact.hit_count)
                    console.warn("[gw2-tooltips] [facts processor] 0 hit count: ", fact);
                if (fact.hit_count > 1) {
                    damage *= fact.hit_count;
                    hitCountLabel = `(${fact.hit_count}x)`;
                }
                return `<tem> ${fact.text}: ${hitCountLabel} ${Math.round(damage)} </tem>`;
            },
            AttributeAdjust: ({ fact }) => {
                const attribute = context.character.stats[TUtilsV2.Uncapitalize(fact.target)] || 0;
                const value = Math.round(fact.value + attribute * fact.attribute_multiplier + context.character.level ** fact.level_exponent * fact.level_multiplier);
                return `<tem> ${value > 0 ? '+' + value : value} ${fact.text || fact.target} </tem>`;
            },
            BuffConversion: ({ fact }) => {
                const attribute = context.character.stats[TUtilsV2.Uncapitalize(fact.source)] || 0;
                const value = Math.round(attribute * fact.percent / 100);
                return `<tem> ${fact.text}: Converting ${fact.percent}% of ${fact.source} to +${value} ${fact.target} </tem>`;
            }
        };
        const buff = APICache.storage.skills.get(fact.buff || 0);
        const data = { fact, buff, skill };
        const wrapper = TUtilsV2.newElm('te');
        const text = TUtilsV2.fromHTML(factInflators[fact.type](data));
        if (iconSlug)
            wrapper.append(TUtilsV2.newImg(iconSlug, 'iconmed'));
        wrapper.append(text);
        return { wrapper, defiance_break: fact.defiance_break || 0 };
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
        if (typeof src == 'number')
            src = src + '.png';
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
TUtilsV2.GW2Text2HTML = (text, tag = 'span') => text
    ? text
        .replace(/<c=@(.*?)>(.*?)<\/c>/g, `<${tag} class="color-$1">$2</${tag}>`)
        .replace(/%%/g, '%')
        .replaceAll('[lbracket]', '[').replaceAll('[rbracket]', ']')
        .replaceAll('[null]', '')
    : '';
TUtilsV2.Uncapitalize = (str) => str.charAt(0).toLowerCase() + str.slice(1);
class GW2TooltipsV2 {
    static createCompleteContext(partialContext) {
        var _a, _b, _c;
        const stats = Object.assign({}, this.defaultContext.character.stats, (_a = partialContext.character) === null || _a === void 0 ? void 0 : _a.stats);
        const statSources = Object.assign({}, this.defaultContext.character.statSources, (_b = partialContext.character) === null || _b === void 0 ? void 0 : _b.statSources);
        const runeCounts = Object.assign({}, (_c = partialContext.character) === null || _c === void 0 ? void 0 : _c.runeCounts);
        const character = Object.assign({}, this.defaultContext.character, partialContext.character, { stats, statSources, runeCounts });
        return Object.assign({}, this.defaultContext, partialContext, { character });
    }
    constructor() {
        this.cycling = false;
        this.context = [];
        this.LUT_DEFENSE = [
            115, 120, 125, 129, 133, 137, 142, 146, 150, 154, 162, 168, 175, 182, 189, 196, 202, 209, 216, 223, 232, 240, 248, 257, 265, 274, 282, 290, 299, 307, 319, 330, 341, 352, 363, 374, 385, 396, 407, 418, 431, 443, 456, 469, 481, 494, 506, 519, 532, 544, 560, 575, 590, 606, 621, 636, 651, 666, 682, 697, 714, 731, 748, 764, 781, 798, 815, 832, 848, 865, 885, 905, 924, 943, 963, 982, 1002, 1021, 1040, 1060, 1081, 1102, 1123, 1144, 1165, 1186, 1207, 1228, 1249, 1270, 1291, 1312, 1333, 1354, 1375, 1396, 1417, 1438, 1459, 1480, 1501,
        ];
        this.LUT_POWER_PLAYER = [
            170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 202, 207, 212, 217, 222, 227, 232, 237, 242, 247, 253, 259, 265, 271, 277, 283, 289, 295, 301, 307, 315, 323, 331, 339, 347, 355, 363, 371, 379, 387, 396, 405, 414, 423, 432, 441, 450, 459, 468, 477, 488, 499, 510, 521, 532, 543, 554, 565, 576, 587, 599, 611, 623, 635, 647, 659, 671, 683, 695, 707, 721, 735, 749, 763, 777, 791, 805, 819, 833, 847, 862, 877, 892, 907, 922, 937, 952, 967, 982, 997, 1012, 1027, 1042, 1057, 1072, 1087, 1102, 1117, 1132, 1147, 1162,
        ];
        this.LUT_POWER_MONSTER = [
            162, 179, 197, 214, 231, 249, 267, 286, 303, 322, 344, 367, 389, 394, 402, 412, 439, 454, 469, 483, 500, 517, 556, 575, 593, 612, 622, 632, 672, 684, 728, 744, 761, 778, 820, 839, 885, 905, 924, 943, 991, 1016, 1067, 1093, 1119, 1145, 1193, 1220, 1275, 1304, 1337, 1372, 1427, 1461, 1525, 1562, 1599, 1637, 1692, 1731, 1802, 1848, 1891, 1936, 1999, 2045, 2153, 2201, 2249, 2298, 2368, 2424, 2545, 2604, 2662, 2723, 2792, 2854, 2985, 3047, 3191, 3269, 3348, 3427, 3508, 3589, 3671, 3754, 3838, 3922, 4007, 4093, 4180, 4267, 4356, 4445, 4535, 4625, 4717, 4809, 4902,
        ];
        this.LUT_RARITY = {
            Junk: 0,
            Basic: 0,
            Common: 1,
            Uncommon: 2,
            Rare: 3,
            Exotic: 4,
            Ascended: 4,
            Legendary: 4,
        };
        this.ICONS = {
            COIN_COPPER: 156902,
            COIN_SILVER: 156907,
            COIN_GOLD: 156904,
            SLOT_Upgrade: 517197,
            SLOT_Infusion: 517202,
            SLOT_Enrichment: 517204,
        };
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
        if (this.config.apiImpl)
            APICache.apiImpl = this.config.apiImpl();
        this.tooltip = TUtilsV2.newElm('div.tooltipWrapper');
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
        document.addEventListener('mousemove', event => {
            this.lastMouseX = event.pageX;
            this.lastMouseY = event.pageY;
            if (this.tooltip.style.display != 'none')
                this.positionTooltip();
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
                const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
                const stackSize = +String(gw2Object.getAttribute('count')) || undefined;
                if (type != 'skills' && type != 'traits' && type != 'pvp/amulets' && type != "items")
                    return;
                const data = APICache.storage[type].get(objId);
                if (data) {
                    if (type == 'items') {
                        const statId = +String(gw2Object.getAttribute('stats')) || undefined;
                        this.tooltip.replaceChildren(this.generateItemTooltip(data, context, statId, stackSize));
                    }
                    else
                        this.tooltip.replaceChildren(...this.generateToolTipList(data, gw2Object, context));
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
        return Promise.all(Object.entries(objectsToGet).map(async ([key, values]) => {
            if (values.size == 0)
                return;
            let inflator;
            switch (key) {
                case 'items':
                    inflator = this.inflateItem.bind(this);
                    break;
                case 'specializations':
                    inflator = this.inflateSpecialization.bind(this);
                    break;
                default:
                    inflator = this.inflateGenericIcon.bind(this);
                    break;
            }
            const cache = APICache.storage[key];
            await APICache.ensureExistence(key, values.keys());
            for (const [id, objects] of values) {
                const data = cache.get(id);
                if (!objects || !data)
                    continue;
                for (const gw2Object of objects)
                    inflator(gw2Object, data);
            }
        }));
    }
    inflateGenericIcon(gw2Object, data) {
        const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(data.icon, undefined, data.name));
        wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + TUtilsV2.GW2Text2HTML(data.name.replaceAll(/%str\d%/g, ''))
            .replaceAll(/\[.*?\]/g, '');
        wikiLink.target = '_blank';
        if (gw2Object.classList.contains('gw2objectembed'))
            wikiLink.append(data.name);
        gw2Object.append(wikiLink);
    }
    inflateItem(gw2Object, item) {
        const stackSize = +String(gw2Object.getAttribute('count')) || 1;
        const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
        const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(item.icon, undefined, item.name));
        wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + TUtilsV2.GW2Text2HTML(item.name.replaceAll(/%str\d%/g, ''))
            .replaceAll(/\[.*?\]/g, '');
        wikiLink.target = '_blank';
        if (gw2Object.classList.contains('gw2objectembed'))
            wikiLink.append(this.formatItemName(item, context, undefined, undefined, stackSize));
        gw2Object.append(wikiLink);
    }
    inflateSpecialization(gw2Object, spec) {
        gw2Object.style.backgroundImage = `url(${spec.background})`;
        gw2Object.dataset.label = spec.name;
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
                        console.error(`[gw2-tooltips] [tooltip engine] unknown palette type '${palette.type}' for skill '${skill.name}'`);
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
    generateToolTip(apiObject, context) {
        let recharge = '';
        if ('facts' in apiObject) {
            const _recharge = this.getRecharge(apiObject, context.gameMode);
            if (_recharge) {
                recharge = TUtilsV2.newElm('ter', (_recharge / 1000) + 's', TUtilsV2.newImg('156651.png', 'iconsmall'));
            }
        }
        const headerElements = [TUtilsV2.newElm('teb', TUtilsV2.GW2Text2HTML(apiObject.name))];
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
            parts.push(...FactsProcessor.generateFacts(apiObject, context));
        }
        const tooltip = TUtilsV2.newElm('div.tooltip', ...parts);
        tooltip.dataset.id = String(apiObject.id);
        tooltip.style.marginTop = '5px';
        return tooltip;
    }
    generateToolTipList(initialAPIObject, gw2Object, context) {
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
        const tooltipChain = objectChain.map(obj => this.generateToolTip(obj, context));
        this.tooltip.append(...tooltipChain);
        if (tooltipChain.length > 1) {
            gw2Object.classList.add('cycler');
            gw2Object.title = 'Right-click to cycle through tooltips';
            let currentTooltipIndex = 0;
            this.displayCorrectChainTooltip(tooltipChain, currentTooltipIndex);
            this.cycleTooltipsHandler = () => {
                this.cycleTooltips();
                currentTooltipIndex = (currentTooltipIndex + 1) % tooltipChain.length;
                this.displayCorrectChainTooltip(tooltipChain, currentTooltipIndex);
                this.positionTooltip();
            };
        }
        else {
            tooltipChain[0].classList.add('active');
        }
        return tooltipChain;
    }
    generateItemTooltip(item, context, statSetId, stackSize = 1) {
        let statSet = undefined;
        if (item.type == "Armor" || item.type == "Trinket" || item.type == "Weapon") {
            statSetId = statSetId || item.attribute_set;
            if (statSetId === undefined)
                console.warn(`[gw2-tooltips] [tooltip engine] Hovering on item without specified or innate stats. Specify the stats by adding 'stats="<stat_set_id>" to the html element.' `);
            else {
                statSet = APICache.storage.itemstats.get(statSetId);
                if (!statSet)
                    console.error(`[gw2-tooltips] [tooltip engine] itemstat #${statSetId} is missing in cache.`);
                else {
                    if (this.config.adjustIncorrectStatIds && statSet.similar_sets) {
                        const correctSetId = statSet.similar_sets[item.subtype];
                        if (correctSetId !== undefined) {
                            console.info(`[gw2-tooltips] [tooltip engine] Corrected itemstat #${statSetId} to #${correctSetId} because the target is of type ${item.subtype}.`);
                            const newSet = APICache.storage.itemstats.get(correctSetId);
                            if (!newSet)
                                console.error(`[gw2-tooltips] [tooltip engine] Corrected itemstat #${correctSetId} is missing in the cache.`);
                            else
                                statSet = newSet;
                        }
                    }
                }
            }
        }
        const countPrefix = stackSize > 1 ? stackSize + ' ' : '';
        const name = countPrefix + this.formatItemName(item, context, statSet, undefined, stackSize);
        const parts = [TUtilsV2.newElm('tet', TUtilsV2.newImg(item.icon), TUtilsV2.newElm('teb.color-rarity-' + item.rarity, name), TUtilsV2.newElm('div.flexbox-fill'))];
        if ('defense' in item && item.defense) {
            const defense = (typeof item.defense == "number")
                ? item.defense
                : this.LUT_DEFENSE[Math.min(100, (item.defense[0] + context.character.level))] * item.defense[1];
            parts.push(TUtilsV2.newElm('te', TUtilsV2.newElm('tem', 'Defense: ', TUtilsV2.newElm('span.color-stat-green', String(defense)))));
        }
        if ('power' in item) {
            let power;
            if ('mul' in item.power) {
                let minRarity = 'Common';
                if (['PlayerLevelScaleRarity', 'ItemScale4'].includes(item.power.scaling)) {
                    if (context.character.level >= 14)
                        minRarity = 'Uncommon';
                    else if (context.character.level >= 30)
                        minRarity = 'Rare';
                    else if (context.character.level >= 60)
                        minRarity = 'Exotic';
                    else if (context.character.level >= 80)
                        minRarity = 'Legendary';
                }
                let index = Math.max(this.LUT_RARITY[item.rarity], this.LUT_RARITY[minRarity]);
                if (!item.power.scaling)
                    index += item.level;
                else {
                    index += context.character.level;
                }
                const avg = (context.character.isPlayer ? this.LUT_POWER_PLAYER : this.LUT_POWER_MONSTER)[Math.min(100, index)] * item.power.mul;
                const spread = avg * item.power.spread;
                power = [Math.ceil(avg - spread), Math.ceil(avg + spread)];
            }
            else {
                power = item.power;
            }
            parts.push(TUtilsV2.newElm('te', TUtilsV2.newElm('tem', 'Weapon Strength: ', TUtilsV2.newElm('span.color-stat-green', `${power[0]} - ${power[1]}`))));
        }
        if ('tiers' in item) {
            const group = TUtilsV2.newElm('div.group');
            for (const [i, tier] of item.tiers.entries()) {
                let tier_wrap = TUtilsV2.newElm('te');
                if (tier.description)
                    tier_wrap.append(TUtilsV2.newElm('span', TUtilsV2.fromHTML(TUtilsV2.GW2Text2HTML(tier.description))));
                const w = TUtilsV2.newElm('te', tier_wrap);
                if (item.subtype == "Rune") {
                    const colorClass = i < (context.character.runeCounts[item.id] || 0) ? '.color-stat-green' : '';
                    w.prepend(TUtilsV2.newElm('span' + colorClass, `(${i + 1})`));
                }
                group.append(w);
            }
            parts.push(group);
        }
        if (statSet && 'attribute_base' in item) {
            parts.push(...statSet.attributes.map(({ attribute, base_value, scaling }) => {
                const computedValue = Math.round(base_value + item.attribute_base * scaling);
                return TUtilsV2.newElm('te', TUtilsV2.newElm('tem.color-stat-green', `+${computedValue} ${attribute}`));
            }));
        }
        if ('slots' in item) {
            parts.push(TUtilsV2.newElm('div.group.slots', ...item.slots.map(s => TUtilsV2.newElm('te', TUtilsV2.newImg(this.ICONS['SLOT_' + s], 'iconsmall'), `Empty ${s} Slot`))));
        }
        const metaInfo = TUtilsV2.newElm('div.group');
        if (item.type == "Armor" || item.type == "Weapon" || item.type == "Trinket") {
            metaInfo.append(TUtilsV2.newElm('span.color-rarity-' + item.rarity, item.rarity));
            if ('weight' in item)
                metaInfo.append(TUtilsV2.newElm('span', item.weight));
            metaInfo.append(TUtilsV2.newElm('span', `${item.type}: ${item.subtype}`));
            if (item.type == "Weapon" && this.isTwoHanded(item.subtype))
                metaInfo.append(TUtilsV2.newElm('span.color-rarity-Junk', `(Two-Handed)`));
            if (item.required_level)
                metaInfo.append(TUtilsV2.newElm('span', 'Required Level: ' + item.required_level));
            if (item.description)
                metaInfo.append(TUtilsV2.newElm('span', TUtilsV2.fromHTML(TUtilsV2.GW2Text2HTML(item.description))));
        }
        else {
            if (item.description)
                metaInfo.append(TUtilsV2.newElm('span', TUtilsV2.fromHTML(TUtilsV2.GW2Text2HTML(item.description))));
        }
        if (!item.flags.includes('Pvp')) {
            if (item.flags.includes('Unique'))
                metaInfo.append(TUtilsV2.newElm('span', 'Unique'));
            if (item.flags.includes('AccountBound'))
                metaInfo.append(TUtilsV2.newElm('span', 'Account Bound'));
            else if (item.flags.includes('SoulbindOnAcquire'))
                metaInfo.append(TUtilsV2.newElm('span', 'Soulbound on Acquire'));
        }
        if (item.vendor_value) {
            let inner = ['Vendor Value: ', this.formatCoins(item.vendor_value * stackSize)];
            if (stackSize > 1)
                inner.push(' (', this.formatCoins(item.vendor_value), ` x ${stackSize})`);
            metaInfo.append(TUtilsV2.newElm('span', ...inner));
        }
        parts.push(metaInfo);
        const tooltip = TUtilsV2.newElm('div.tooltip.item.active', ...parts);
        tooltip.dataset.id = String(item.id);
        return tooltip;
    }
    formatItemName(item, context, statSet, upgradeComponent, stackSize = 1) {
        let name;
        if (item.type == 'TraitGuide') {
            name = item.trait;
        }
        else {
            name = item.name;
        }
        let arg1, arg2, arg3, arg4;
        arg1 = arg2 = arg3 = arg4 = '';
        if (!item.flags.includes('HideSuffix')) {
            if (statSet && statSet.name) {
                arg1 = statSet.name;
                arg2 = " ";
            }
            if (upgradeComponent && upgradeComponent.suffix) {
                arg4 = upgradeComponent.suffix;
                arg3 = " ";
            }
        }
        name = name.replace('%str1%', arg1).replace('%str2%', arg2).replace('%str3%', arg3).replace('%str4%', arg4);
        if (item.flags.includes('Pvp') || item.flags.includes('PvpLobby'))
            name += " (PvP)";
        return name.replaceAll('[s]', stackSize > 1 ? 's' : '')
            .replaceAll(/(\S+)\[pl:"(.+?)"]/g, stackSize > 1 ? '$2' : '$1')
            .replaceAll(/(\S+)\[f:"(.+?)"]/g, context.character.sex == "Female" ? '$2' : '$1')
            .replaceAll('[lbracket]', '[').replaceAll('[rbracket]', ']')
            .replaceAll('[null]', '');
    }
    formatCoins(amount) {
        const parts = [String(Math.floor(amount % 100)), TUtilsV2.newImg(this.ICONS.COIN_COPPER, 'iconsmall', '')];
        if (amount > 99)
            parts.unshift(String(Math.floor((amount / 100) % 100)), TUtilsV2.newImg(this.ICONS.COIN_SILVER, 'iconsmall', ''));
        if (amount > 9999)
            parts.unshift(String(Math.floor(amount / 10000)), TUtilsV2.newImg(this.ICONS.COIN_GOLD, 'iconsmall', ''));
        return TUtilsV2.newElm('span', ...parts);
    }
    isTwoHanded(type) {
        switch (type) {
            case 'Axe': return false;
            case 'Dagger': return false;
            case 'Mace': return false;
            case 'Pistol': return false;
            case 'Scepter': return false;
            case 'Focus': return false;
            case 'Sword': return false;
            case 'BowShort': return false;
            case 'Torch': return false;
            case 'Shield': return false;
            case 'Warhorn': return false;
            case 'Toy': return false;
            case 'ToyTwoHanded': return false;
            case 'BundleSmall': return false;
            case 'Hammer': return true;
            case 'BowLong': return true;
            case 'Greatsword': return true;
            case 'Polearm': return true;
            case 'Rifle': return true;
            case 'Staff': return true;
            case 'BundleLarge': return true;
            case 'Spear': return true;
            case 'Speargun': return true;
            case 'Trident': return true;
        }
    }
}
GW2TooltipsV2.defaultContext = {
    gameMode: 'Pve',
    targetArmor: 2597,
    character: {
        level: 80,
        isPlayer: true,
        sex: "Male",
        traits: [],
        stats: {
            power: 1000,
            toughness: 1000,
            vitality: 1000,
            precision: 1000,
            ferocity: 1000,
            conditionDmg: 0,
            expertise: 0,
            concentration: 0,
            healing: 0,
            critDamage: 0,
        },
        statSources: {
            power: [],
            toughness: [],
            vitality: [],
            precision: [],
            ferocity: [],
            conditionDmg: [],
            expertise: [],
            concentration: [],
            healing: [],
            critDamage: [],
        },
        runeCounts: {},
    },
};
GW2TooltipsV2.defaultConfig = {
    autoInitialize: true,
    autoCollectRuneCounts: true,
    autoCollectStatSources: true,
    adjustIncorrectStatIds: true,
};
window.gw2tooltips = new GW2TooltipsV2();
if (window.gw2tooltips.config.autoInitialize) {
    window.gw2tooltips.hookDocument(document)
        .then(_ => {
        if (window.gw2tooltips.config.autoCollectRuneCounts) {
            const targets = document.getElementsByClassName('armors');
            if (targets.length)
                for (const target of targets)
                    Collect.allRuneCounts(window.gw2tooltips.context, target);
            else {
                console.warn("[gw2-tooltips] [collect] `config.autoCollectRuneCounts` is active, but no element with class `armors` could be found to use as source. Runes will not be collected as there is no way to tell which rune belongs to the build and which one is just in some arbitrary text.");
            }
        }
        if (window.gw2tooltips.config.autoCollectStatSources) {
            const targets = document.getElementsByClassName('gw2-build-wrapper');
            if (targets.length)
                for (const target of targets)
                    Collect.allStatSources(window.gw2tooltips.context, target);
            else {
                console.warn("[gw2-tooltips] [collect] `config.autoCollectStatSources` is active, but no element with class `gw2-build-wrapper` could be found to use as source. Build information will not be collected as there is no way to tell which objects belong to the build definition and which ones are just in some arbitrary text.");
            }
        }
    });
}
