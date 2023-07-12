"use strict";
class FakeAPI {
    async bulkRequest(endpoint, ids) {
        if (['specializations', 'pvp/amulets'].includes(endpoint)) {
            const response = await fetch(`https://api.guildwars2.com/v2/${endpoint}?ids=${ids.join(',')}`).then(r => r.json());
            if (endpoint == 'pvp/amulets') {
                const modifierTranslation = {
                    BoonDuration: "Concentration",
                    ConditionDamage: "ConditionDmg",
                    ConditionDuration: "Expertise",
                };
                for (const obj of response) {
                    const tier = { modifiers: [] };
                    for (const [attribute_, adjustment] of Object.entries(obj.attributes)) {
                        const attribute = modifierTranslation[attribute_] || attribute_;
                        tier.modifiers.push({
                            formula: "NoScaling",
                            base_amount: adjustment,
                            id: -1,
                            formula_param1: 0,
                            formula_param2: 0,
                            target_attribute_or_buff: attribute,
                            description: attribute,
                            flags: [],
                        });
                    }
                    obj.tiers = [tier];
                    obj.flags = ["Pvp"];
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
        if ('facts' in datum && datum.facts) {
            addFacts(datum.facts);
        }
        if ('override_groups' in datum && datum.override_groups) {
            for (const { facts } of datum.override_groups)
                if (facts)
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
    static allUpgradeCounts(contexts, scope, mode = 1) {
        const elements = scope.getElementsByTagName('gw2object');
        for (const pair of contexts.entries()) {
            const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) == pair[0]);
            this._upgradeCounts(...pair, elsInCorrectCtx, mode);
        }
        const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) >= contexts.length);
        if (elsWithWrongCtx.length) {
            console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
        }
    }
    static specificUpgradeCounts(contextIndex, targetContext, scope, mode = 1) {
        this._upgradeCounts(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
    }
    static _upgradeCounts(contextIndex, targetContext, elements, mode) {
        var _a, _b, _c, _d;
        const counts = {};
        for (const element of elements) {
            let id;
            if (element.getAttribute('type') !== 'item' || !(id = +String(element.getAttribute('objid'))))
                continue;
            const item = APICache.storage.items.get(id);
            if (!item || !('subtype' in item) || (item.subtype != 'Rune' && item.subtype != 'Default'))
                continue;
            let amountToAdd = 1;
            if (item.subtype == "Default" && !item.flags.includes('Pvp')) {
                if (!(amountToAdd = +String(element.getAttribute('count')))) {
                    if (GW2TooltipsV2.config.legacyCompatibility) {
                        amountToAdd = this._legacy_getInfusionCount(element);
                        if (!amountToAdd)
                            continue;
                    }
                }
                if (!amountToAdd) {
                    console.warn("[gw2-tooltips] [collect] Could not figure how many infusions to add for sourceElement ", element, ". Will not assume anything and just ignore the stack.");
                    continue;
                }
            }
            counts[item.id] = (counts[item.id] || 0) + amountToAdd;
        }
        switch (mode) {
            case 0:
                targetContext.character.upgradeCounts = counts;
                break;
            case 3:
                targetContext.character.upgradeCounts = Object.assign(targetContext.character.upgradeCounts, counts);
                break;
            case 1:
                {
                    if (window.GW2TooltipsContext instanceof Array) {
                        targetContext.character.upgradeCounts = Object.assign(counts, (_a = window.GW2TooltipsContext[contextIndex].character) === null || _a === void 0 ? void 0 : _a.upgradeCounts);
                    }
                    else if (window.GW2TooltipsContext) {
                        targetContext.character.upgradeCounts = Object.assign(counts, (_b = window.GW2TooltipsContext.character) === null || _b === void 0 ? void 0 : _b.upgradeCounts);
                    }
                    else {
                        targetContext.character.upgradeCounts = counts;
                    }
                }
                break;
            case 2:
                {
                    if (window.GW2TooltipsContext instanceof Array) {
                        targetContext.character.upgradeCounts = Object.assign({}, (_c = window.GW2TooltipsContext[contextIndex].character) === null || _c === void 0 ? void 0 : _c.upgradeCounts, counts);
                    }
                    else if (window.GW2TooltipsContext) {
                        targetContext.character.upgradeCounts = Object.assign({}, (_d = window.GW2TooltipsContext.character) === null || _d === void 0 ? void 0 : _d.upgradeCounts, counts);
                    }
                    else {
                        targetContext.character.upgradeCounts = counts;
                    }
                }
                break;
        }
    }
    static allStatSources(contexts, scope, mode = 1) {
        const elements = scope.getElementsByTagName('gw2object');
        for (const pair of contexts.entries()) {
            const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) == pair[0]);
            this._statSources(...pair, elsInCorrectCtx, mode);
        }
        const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) >= contexts.length);
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
            agonyResistance: [],
        };
        let upgrades = Object.assign({}, targetContext.character.upgradeCounts);
        for (const element of elements) {
            let id, type = element.getAttribute('type');
            if (!(id = +String(element.getAttribute('objid'))))
                continue;
            let amountToAdd = 1;
            let tier, item;
            if (type == 'item') {
                item = APICache.storage.items.get(id);
                if (!item || !('subtype' in item))
                    continue;
                if (item.type === 'UpgradeComponent' || item.type === 'Consumable') {
                    const tierNumber = upgrades[item.id] = (upgrades[item.id] || 0) + 1;
                    if (item.subtype === 'Rune') {
                        if (tierNumber > 6) {
                            if (!targetContext.character.upgradeCounts[item.id])
                                console.warn("[gw2-tooltips] [collect] Found more than 6 runes of the same type. Here is the 7th rune element: ", element);
                            continue;
                        }
                        tier = item.tiers[tierNumber - 1];
                    }
                    else {
                        if (item.subtype == "Default" && !item.flags.includes('Pvp')) {
                            if (!(amountToAdd = +String(element.getAttribute('count')))) {
                                if (GW2TooltipsV2.config.legacyCompatibility) {
                                    amountToAdd = this._legacy_getInfusionCount(element);
                                    if (!amountToAdd)
                                        continue;
                                }
                            }
                            if (!amountToAdd) {
                                console.warn("[gw2-tooltips] [collect] Could not figure how many infusions to add for sourceElement ", element, ". Will not assume anything and just ignore the stack.");
                                continue;
                            }
                        }
                        else if (item.subtype === 'Sigil' && tierNumber > 1) {
                            if (tierNumber > 2)
                                console.warn("[gw2-tooltips] [collect] Found more than 2 sigils of the same type. Here is the 3th sigil element: ", element);
                            continue;
                        }
                        tier = item.tiers[0];
                    }
                }
            }
            else if (type == 'pvp/amulet') {
                item = APICache.storage['pvp/amulets'].get(id);
                if (!item)
                    continue;
                tier = item.tiers[0];
            }
            if (tier && tier.modifiers)
                for (const modifier of tier.modifiers) {
                    if (!modifier.target_attribute_or_buff)
                        continue;
                    if (typeof modifier.target_attribute_or_buff !== 'number')
                        sources[TUtilsV2.Uncapitalize(modifier.target_attribute_or_buff)].push({ modifier, source: item.name, count: amountToAdd });
                    else { }
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
            targetContext.character.stats = baseStats;
            for (const [attrib, sources] of Object.entries(targetContext.character.statSources)) {
                for (const { modifier, source, count } of sources.filter(s => !s.modifier.flags.includes('FormatPercent'))) {
                    targetContext.character.stats[attrib] += FactsProcessor.calculateModifier(modifier, targetContext.character) * count;
                    console.log(`[gw2-tooltips] [collect] ${source}${count > 1 ? (' x ' + count) : ''}: Flat ${attrib} => ${targetContext.character.stats[attrib]}`);
                }
                for (const { modifier, source, count } of sources.filter(s => s.modifier.flags.includes('FormatPercent'))) {
                    const value = FactsProcessor.calculateModifier(modifier, targetContext.character);
                    targetContext.character.stats[attrib] += (modifier.formula == 'NoScaling'
                        ? targetContext.character.stats[attrib] * value
                        : value)
                        * count;
                    console.log(`[gw2-tooltips] [collect] ${source}${count > 1 ? (' x ' + count) : ''}: Percent ${attrib} => ${targetContext.character.stats[attrib]}`);
                }
            }
        }
    }
    static _legacy_getInfusionCount(element) {
        var _a, _b;
        const ownIndex = Array.prototype.indexOf.call(element.parentElement.children, element);
        const amountEl = element.parentElement.getElementsByClassName('amount')[ownIndex];
        if (!amountEl) {
            console.warn("[gw2-tooltips] [collect] `legacyCompatibility` is active, but no amount element for infusion ", element, " could be found. Will not assume anything and just ignore the stack.");
            return;
        }
        const amountToAdd = +String((_b = (_a = amountEl.textContent) === null || _a === void 0 ? void 0 : _a.match(/\d+/)) === null || _b === void 0 ? void 0 : _b[0]);
        if (!amountToAdd) {
            console.warn("[gw2-tooltips] [collect] [legacyCompatibility] Amount element ", amountEl, " for infusion element ", element, " did not contain any readable amount. Will not assume anything and just ignore the stack.");
            return;
        }
        if (amountToAdd < 1 || amountToAdd > 20) {
            console.warn("[gw2-tooltips] [collect] [legacyCompatibility] Amount element ", amountEl, " for infusion element ", element, " did got interpreted as x", amountToAdd, " which is outside of the range of sensible values (amount in [1...20]). Will not assume anything and just ignore the stack.");
            return;
        }
        return amountToAdd;
    }
    static allTraits(contexts, scope, mode = 1) {
        const elements = scope.querySelectorAll('gw2object[type=specialization]:not(.gw2objectembed)');
        for (const pair of contexts.entries()) {
            const elsInCorrectCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) == pair[0]);
            this._traits(...pair, elsInCorrectCtx, mode);
        }
        const elsWithWrongCtx = Array.from(elements).filter(e => (+String(e.getAttribute('contextSet')) || 0) >= contexts.length);
        if (elsWithWrongCtx.length) {
            console.warn("[gw2-tooltips] [collect] Some targets in scope ", scope, " have the wrong context: ", elsWithWrongCtx);
        }
    }
    static specificTraits(contextIndex, targetContext, scope, mode = 1) {
        this._traits(contextIndex, targetContext, scope.getElementsByTagName('gw2object'), mode);
    }
    static _traits(contextIndex, targetContext, elements, mode = 1) {
        var _a, _b;
        const traits = [];
        for (const specialization of elements) {
            const selectedPositions = String(specialization.getAttribute('selected_traits')).split(',').map(i => +i).filter(i => !isNaN(i) && 0 <= i && i <= 2);
            if (selectedPositions.length != 3) {
                console.warn("[gw2-tooltips] [collect] Specialization object ", specialization, " does not have its 'selected_traits' (properly) set. Add the attribute as `selected_traits=\"0,2,1\"` where the numbers are 0-2 indicating top, middle or bottom selection. Will not assume anything and just ignore the element.");
                continue;
            }
            for (const [x, y] of selectedPositions.entries()) {
                {
                    const traitEl = specialization.children[1 + x * 2].children[y];
                    let id;
                    if (!traitEl || !(id = +String(traitEl.getAttribute('objid')))) {
                        console.warn("[gw2-tooltips] [collect] Trait object ", traitEl, " is selected but does not exist or does not have an objid set. Add the attribute as `objid=\"1234\"`. Will not assume anything and just ignore the element.");
                        continue;
                    }
                    traits.push(id);
                }
                {
                    const traitEl = specialization.children[x * 2];
                    let id;
                    if (!(id = +String(traitEl.getAttribute('objid')))) {
                        console.warn("[gw2-tooltips] [collect] Minor trait object ", traitEl, " does not have an objid set. Add the attribute as `objid=\"1234\"`. Will not assume anything and just ignore the element.");
                        continue;
                    }
                    traits.push(id);
                }
            }
        }
        switch (mode) {
            case 0:
            case 2:
                targetContext.character.traits = traits;
                break;
            case 3:
            case 1:
                {
                    if (window.GW2TooltipsContext instanceof Array) {
                        const set = new Set((_a = window.GW2TooltipsContext[contextIndex].character) === null || _a === void 0 ? void 0 : _a.traits);
                        traits.forEach(t => set.add(t));
                        targetContext.character.traits = Array.from(set);
                    }
                    else if (window.GW2TooltipsContext) {
                        const set = new Set((_b = window.GW2TooltipsContext.character) === null || _b === void 0 ? void 0 : _b.traits);
                        traits.forEach(t => set.add(t));
                        targetContext.character.traits = Array.from(set);
                    }
                    else {
                        targetContext.character.traits = traits;
                    }
                }
                break;
        }
    }
    static traitEffects(contexts) {
        for (const context of contexts) {
            for (const traitId of context.character.traits) {
                const trait = APICache.storage.traits.get(traitId);
                if (!trait) {
                    console.error(`[gw2-tooltips] [collect] Trait #${traitId} is apparently missing in the cache.`);
                    continue;
                }
                const addModifiers = (modifiers) => {
                    for (const mod of modifiers) {
                        if (!mod.target_attribute_or_buff)
                            continue;
                        if (typeof mod.target_attribute_or_buff === 'number')
                            context.character.statModifier.outgoingBuffDuration[mod.target_attribute_or_buff] = (context.character.statModifier.outgoingBuffDuration[mod.target_attribute_or_buff] || 0) + mod.base_amount;
                    }
                };
                if (trait.modifiers)
                    addModifiers(trait.modifiers);
                const contextBoundInfo = GW2TooltipsV2.resolveTraitsAndOverrides(trait, context);
                if (contextBoundInfo.facts)
                    for (const fact of contextBoundInfo.facts) {
                        if (!fact.buff)
                            continue;
                        const buff = APICache.storage.skills.get(fact.buff);
                        if (!buff) {
                            console.error(`[gw2-tooltips] [collect] Trait #${fact.buff} is apparently missing in the cache.`);
                            continue;
                        }
                        if (buff.modifiers)
                            addModifiers(buff.modifiers);
                    }
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
    static generateFacts(facts, weaponStrength, context) {
        let totalDefianceBreak = 0;
        const factWraps = facts
            .sort((a, b) => a.order - b.order)
            .map(fact => {
            const { wrapper, defiance_break } = this.generateFact(fact, weaponStrength, context);
            totalDefianceBreak += defiance_break;
            return wrapper;
        })
            .filter(d => d);
        if (totalDefianceBreak > 0) {
            const defianceWrap = TUtilsV2.newElm('te.defiance', TUtilsV2.newImg(GW2TooltipsV2.ICONS.DEFIANCE_BREAK, 'iconmed'), TUtilsV2.newElm('tem.color-defiance-fact', `Defiance Break: ${totalDefianceBreak}`));
            factWraps.push(defianceWrap);
        }
        return factWraps;
    }
    static generateFact(fact, weapon_strength, context) {
        let iconSlug = fact.icon || GW2TooltipsV2.ICONS.GENERIC_FACT;
        const generateBuffDescription = (buff, fact) => {
            let modsArray = [];
            if (buff.modifiers) {
                const relevantModifiers = buff.modifiers.filter(modifier => ((!modifier.trait_req || context.character.traits.includes(modifier.trait_req))
                    && (!modifier.mode || modifier.mode === context.gameMode)));
                let modsMap = new Map();
                for (let i = 0; i < relevantModifiers.length; i++) {
                    const modifier = relevantModifiers[i];
                    let entry = modsMap.get(modifier.id) || modsMap.set(modifier.id, { modifier: modifier, value: 0 }).get(modifier.id);
                    let value = this.calculateModifier(modifier, context.character);
                    if (modifier.attribute_conversion) {
                        value *= context.character.stats[TUtilsV2.Uncapitalize(modifier.attribute_conversion)];
                    }
                    entry.value += value;
                    if (modifier.flags.includes('SkipNextEntry')) {
                        i++;
                    }
                }
                for (let { value, modifier } of modsMap.values()) {
                    if (modifier.flags.includes('Subtract')) {
                        value -= 100;
                    }
                    if (modifier.flags.includes('MulByDuration')) {
                        let duration = fact.duration / 1000;
                        if (modifier.flags.includes('DivDurationBy3')) {
                            duration /= 3;
                        }
                        if (modifier.flags.includes('DivDurationBy10')) {
                            duration /= 10;
                        }
                        value *= duration || 1;
                    }
                    if (!modifier.flags.includes('NonStacking')) {
                        value *= fact.apply_count;
                    }
                    let strValue = '';
                    if (modifier.flags.includes('FormatFraction')) {
                        strValue = TUtilsV2.drawFractional(value);
                    }
                    else {
                        strValue = Math.floor(value).toString();
                    }
                    if (modifier.flags.includes('FormatPercent')) {
                        if (value > 0) {
                            strValue = '+' + strValue;
                        }
                        strValue += '%';
                    }
                    strValue += ' ' + modifier.description;
                    modsArray.push(strValue);
                }
            }
            return TUtilsV2.GW2Text2HTML(buff.description_brief || modsArray.join(', ') || buff.description);
        };
        const factInflators = {
            AdjustByAttributeAndLevelHealing: ({ fact }) => {
                var _a;
                const attribute = context.character.stats[TUtilsV2.Uncapitalize(fact.target)] || 0;
                const value = Math.round((fact.value + attribute * fact.attribute_multiplier + context.character.level ** fact.level_exponent * fact.level_multiplier) * fact.hit_count);
                const text = TUtilsV2.GW2Text2HTML(fact.text) || TUtilsV2.mapLocale(attribute);
                const coefficent = ((_a = window.GW2TooltipsConfig) === null || _a === void 0 ? void 0 : _a.preferCorrectnessOverExtraInfo) ? '' : ` (${TUtilsV2.withUpToNDigits('toFixed', fact.attribute_multiplier, 4)})`;
                return [TUtilsV2.newElm('tem', `${text}: ${value}${coefficent}`)];
            },
            AttributeAdjust: ({ fact }) => {
                const value = Math.round((fact.range[1] - fact.range[0]) / (context.character.level / 80) + fact.range[0]);
                const sign = value > 0 ? '+' : '';
                const text = TUtilsV2.GW2Text2HTML(fact.text) || TUtilsV2.mapLocale(fact.target);
                return [TUtilsV2.newElm('tem', `${text}: ${sign}${value}`)];
            },
            Buff: ({ fact, buff }) => {
                if (!buff)
                    console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
                buff = buff || this.MissingBuff;
                iconSlug = buff.icon || iconSlug;
                let { duration, apply_count } = fact;
                duration *= ((context.character.statModifier.outgoingBuffDuration[buff.id] || 0) + 100) / 100;
                let buffDescription = generateBuffDescription(buff, fact);
                if (buffDescription) {
                    buffDescription = `: ${buffDescription}`;
                }
                const seconds = duration > 0 ? `(${TUtilsV2.drawFractional(duration / 1000)}s)` : '';
                let node = [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text) || buff.name_brief || buff.name} ${seconds}${buffDescription}`)];
                if (apply_count > 1) {
                    node.push(TUtilsV2.newElm('div.buffcount', apply_count.toString()));
                }
                return node;
            },
            BuffBrief: ({ fact, buff }) => {
                if (!buff)
                    console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
                buff = buff || this.MissingBuff;
                iconSlug = buff.icon || iconSlug;
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text).replace("%str1%", buff.name)}`)];
            },
            Distance: ({ fact }) => {
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text)}: ${Math.round(fact.distance)}`)];
            },
            HealthAdjustHealing: ({ fact }) => {
                const attribute = context.character.stats[TUtilsV2.Uncapitalize(fact.attribute)] || 0;
                const value = Math.round((fact.value + attribute * fact.multiplier) * fact.hit_count);
                const text = TUtilsV2.GW2Text2HTML(fact.text) || TUtilsV2.mapLocale(fact.attribute);
                return [TUtilsV2.newElm('tem', `${text}: ${value}`)];
            },
            Number: ({ fact }) => {
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.value)}`)];
            },
            Percent: ({ fact }) => {
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.percent)}%`)];
            },
            PercentDamage: ({ fact }) => {
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text)}: ${TUtilsV2.drawFractional(fact.percent)}%`)];
            },
            PercentLifeForceAdjust: ({ fact: { percent, text } }) => {
                const raw = Math.round(GW2TooltipsV2.getHealth(context.character) * 0.69 * percent * 0.01);
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(percent)}% (${raw})`)];
            },
            PercentHealth: ({ fact: { percent, text } }) => {
                const raw = Math.round((GW2TooltipsV2.getHealth(context.character) * percent) * 0.01);
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(percent)}% (${raw})`)];
            },
            LifeForceAdjust: ({ fact: { percent, text } }) => {
                const raw = Math.round(GW2TooltipsV2.getHealth(context.character) * 0.69 * percent * 0.01);
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(percent)}% (${raw})`)];
            },
            Damage: ({ fact, weaponStrength }) => {
                var _a;
                const { dmg_multiplier, hit_count, text } = fact;
                const times = hit_count > 1 ? `(${hit_count}x)` : '';
                const damage = hit_count * weaponStrength * dmg_multiplier * context.character.stats.power / context.targetArmor;
                const coefficent = ((_a = window.GW2TooltipsConfig) === null || _a === void 0 ? void 0 : _a.preferCorrectnessOverExtraInfo) ? '' : ` (${TUtilsV2.withUpToNDigits('toFixed', dmg_multiplier * hit_count, 4)})`;
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}${times}: ${Math.round(damage)}${coefficent}`)];
            },
            Time: ({ fact }) => {
                const { duration, text } = fact;
                const time = duration != 1000 ? 'seconds' : 'second';
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.drawFractional(duration / 1000)} ${time}`)];
            },
            ComboField: ({ fact }) => {
                const { field_type, text } = fact;
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.mapLocale(field_type)}`)];
            },
            ComboFinisher: ({ fact }) => {
                const { finisher_type, text } = fact;
                return [TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text)}: ${TUtilsV2.mapLocale(finisher_type)}`)];
            },
            BuffConversion: ({ fact }) => {
                return [TUtilsV2.newElm('tem', `Gain ${fact.target} Based on a Percentage of ${fact.source}: ${fact.percent}%`)];
            },
            NoData: ({ fact }) => {
                return [TUtilsV2.newElm('tem', TUtilsV2.GW2Text2HTML(fact.text))];
            },
            PrefixedBuff: ({ fact, buff }) => {
                let prefix = APICache.storage.skills.get(fact.prefix);
                if (!prefix)
                    console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
                prefix = prefix || this.MissingBuff;
                iconSlug = prefix.icon || iconSlug;
                if (!buff)
                    console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
                buff = buff || this.MissingBuff;
                let { duration, apply_count, text } = fact;
                duration *= ((context.character.statModifier.outgoingBuffDuration[buff.id] || 0) + 100) / 100;
                let buffDescription = generateBuffDescription(buff, fact);
                if (buffDescription) {
                    buffDescription = `: ${buffDescription}`;
                }
                const seconds = duration > 0 ? `(${TUtilsV2.drawFractional(duration / 1000)}s)` : '';
                let node = TUtilsV2.newElm('te', TUtilsV2.newImg(buff.icon, 'iconmed'), TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(text) || buff.name_brief || buff.name} ${seconds}${buffDescription}`));
                if (apply_count > 1) {
                    node.appendChild(TUtilsV2.newElm('div.buffcount', apply_count.toString()));
                }
                return [node];
            },
            PrefixedBuffBrief: ({ fact, buff }) => {
                let prefix = APICache.storage.skills.get(fact.prefix);
                if (!prefix)
                    console.error('[gw2-tooltips] [facts processor] prefix #', fact.prefix, ' is apparently missing in the cache');
                prefix = prefix || this.MissingBuff;
                iconSlug = prefix.icon || iconSlug;
                if (!buff)
                    console.error('[gw2-tooltips] [facts processor] buff #', fact.buff, ' is apparently missing in the cache');
                buff = buff || this.MissingBuff;
                let node = TUtilsV2.newElm('te', TUtilsV2.newImg(buff.icon, 'iconmed'), TUtilsV2.newElm('tem', `${TUtilsV2.GW2Text2HTML(fact.text) || buff.name_brief || buff.name}`));
                return [node];
            },
            Range: ({ fact }) => {
                var _a;
                const { min, max } = fact;
                if ((_a = window.GW2TooltipsConfig) === null || _a === void 0 ? void 0 : _a.preferCorrectnessOverExtraInfo) {
                    return [TUtilsV2.newElm('tem', `Range: ${max}`)];
                }
                const range = min ? `${min} - ${max}` : max;
                return [TUtilsV2.newElm('tem', `Range: ${range}`)];
            },
            StunBreak: ({ fact }) => {
                return [TUtilsV2.newElm('tem', "Breaks Stun")];
            },
        };
        const buff = APICache.storage.skills.get(fact.buff || 0);
        const data = { fact, buff, weaponStrength: weapon_strength };
        const text = factInflators[fact.type](data);
        const wrapper = TUtilsV2.newElm('te');
        if (fact.requires_trait) {
            wrapper.classList.add('color-traited-fact');
        }
        wrapper.append(TUtilsV2.newImg(iconSlug, 'iconmed'));
        wrapper.append(...text);
        return { wrapper, defiance_break: fact.defiance_break || 0 };
    }
}
FactsProcessor.MissingBuff = {
    id: 0,
    name: 'Missing Buff',
    description: 'This Buff failed to load',
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
    static withUpToNDigits(mode, x, digits) {
        let str = (x)[mode](digits);
        while (str.charAt(str.length - 1) === '0')
            str = str.slice(0, -1);
        if (str.charAt(str.length - 1) === '.')
            str = str.slice(0, -1);
        return str;
    }
    static drawFractional(value) {
        var _a;
        if ((_a = window.GW2TooltipsConfig) === null || _a === void 0 ? void 0 : _a.preferCorrectnessOverExtraInfo) {
            const sign = value < 0 ? '-' : '';
            value = Math.abs(value);
            const index = (Math.min(Math.round((value % 1) * 4), 4));
            let fraction = '';
            switch (index) {
                case 0:
                case 4:
                    {
                        value = Math.round(value);
                        break;
                    }
                case 1: {
                    value = Math.floor(value);
                    fraction = '¼';
                    break;
                }
                case 2: {
                    value = Math.floor(value);
                    fraction = '½';
                    break;
                }
                case 3: {
                    value = Math.floor(value);
                    fraction = '¾';
                    break;
                }
            }
            if (value == 0 && fraction == '') {
                return '0';
            }
            return `${sign}${value > 0 ? value : ''}${fraction}`;
        }
        else {
            return this.withUpToNDigits('toFixed', value, 3);
        }
    }
    static mapLocale(type) {
        switch (type) {
            case 'ConditionDmg': return 'Condition Damage';
            case 'CritDamage': return 'Ferocity';
            case 'BowLong': return 'Longbow';
            case 'BowShort': return 'Shortbow';
            case 'Projectile20': return 'Projectile (20% Chance)';
            default: return type;
        }
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
        .replaceAll('\n', '<br />')
    : '';
TUtilsV2.Uncapitalize = (str) => str.charAt(0).toLowerCase() + str.slice(1);
class GW2TooltipsV2 {
    static createCompleteContext(partialContext) {
        var _a, _b, _c, _d, _e;
        if (partialContext.gameMode == "Pvp" && ((_a = partialContext.character) === null || _a === void 0 ? void 0 : _a.level) && ((_b = partialContext.character) === null || _b === void 0 ? void 0 : _b.level) != 80) {
            console.error('[gw2-tooltips] [init] supplied (partial) context has its gamemode set to pvp, but has a character level specified thats other than 80. In pvp you are always level 80. This will lead to unexpected results; Remove the explicit level or change the gamemode. The (partial) context in question is: ', partialContext);
        }
        const stats = Object.assign({}, this.defaultContext.character.stats, (_c = partialContext.character) === null || _c === void 0 ? void 0 : _c.stats);
        const statSources = Object.assign({}, this.defaultContext.character.statSources, (_d = partialContext.character) === null || _d === void 0 ? void 0 : _d.statSources);
        const upgradeCounts = Object.assign({}, (_e = partialContext.character) === null || _e === void 0 ? void 0 : _e.upgradeCounts);
        const character = Object.assign({}, this.defaultContext.character, partialContext.character, { stats, statSources, upgradeCounts });
        return Object.assign({}, this.defaultContext, partialContext, { character });
    }
    static _constructor() {
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
    static displayCorrectChainTooltip(tooltips, tooltipIndex) {
        for (let index = 0; index < tooltips.length; index++) {
            tooltips[index].classList.toggle('active', index === tooltipIndex);
        }
    }
    static cycleTooltips() {
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
    static positionTooltip() {
        const wpadminbar = document.getElementById('wpadminbar');
        const topBarHeight = wpadminbar ? wpadminbar.offsetHeight : 0;
        const marginX = 22;
        const marginY = 13;
        const offsetX = 6;
        const offsetY = 6;
        let tooltipXpos = this.lastMouseX + offsetX;
        if (tooltipXpos + this.tooltip.offsetWidth + marginX > document.documentElement.clientWidth) {
            tooltipXpos = document.documentElement.clientWidth - (this.tooltip.offsetWidth + marginX);
        }
        let tooltipYpos = this.lastMouseY - offsetY - this.tooltip.offsetHeight;
        if (tooltipYpos - marginY < document.documentElement.scrollTop) {
            tooltipYpos = topBarHeight + marginY + document.documentElement.scrollTop;
        }
        this.tooltip.style.transform = `translate(${tooltipXpos}px, ${tooltipYpos}px)`;
    }
    static hookDocument(scope, _unused) {
        const objectsToGet = {
            skills: new Map(),
            traits: new Map(),
            items: new Map(),
            specializations: new Map(),
            pets: new Map(),
            'pvp/amulets': new Map(),
        };
        const statsToGet = new Set();
        const _legacy_effectErrorStore = new Set();
        for (const gw2Object of scope.getElementsByTagName('gw2object')) {
            const stats = +String(gw2Object.getAttribute('stats'));
            if (!isNaN(stats))
                statsToGet.add(stats);
            let objId = +String(gw2Object.getAttribute('objId'));
            let type = (gw2Object.getAttribute('type') || 'skill') + 's';
            if (this.config.legacyCompatibility) {
                if (type === 'effects') {
                    type = 'skills';
                    objId = this._legacy_transformEffectToSkillObject(gw2Object, _legacy_effectErrorStore);
                }
            }
            if (isNaN(objId) || !(type in objectsToGet))
                continue;
            const elementsWithThisId = objectsToGet[type].get(objId);
            if (elementsWithThisId)
                elementsWithThisId.push(gw2Object);
            else
                objectsToGet[type].set(objId, [gw2Object]);
            gw2Object.addEventListener('mouseenter', (e) => {
                const gw2Object = e.target;
                const type = ((gw2Object.getAttribute('type') || 'skill') + 's');
                const objId = +String(gw2Object.getAttribute('objId'));
                const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
                const stackSize = +String(gw2Object.getAttribute('count')) || undefined;
                if (type == 'specializations' || type == 'effects')
                    return;
                if (type == 'pets')
                    return;
                const data = APICache.storage[type].get(objId);
                if (data) {
                    if (type == 'items' || type == "pvp/amulets") {
                        const statId = +String(gw2Object.getAttribute('stats')) || undefined;
                        this.tooltip.replaceChildren(this.generateItemTooltip(data, context, gw2Object, statId, stackSize));
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
        if (_legacy_effectErrorStore.size) {
            console.error("[gw2-tooltips] [legacy-compat] Some effects could not be translated into skills: ", Array.from(_legacy_effectErrorStore));
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
    static inflateGenericIcon(gw2Object, data) {
        const wikiLink = TUtilsV2.newElm('a', TUtilsV2.newImg(data.icon, undefined, data.name));
        wikiLink.href = 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + TUtilsV2.GW2Text2HTML(data.name.replaceAll(/%str\d%/g, ''))
            .replaceAll(/\[.*?\]/g, '');
        wikiLink.target = '_blank';
        if (gw2Object.classList.contains('gw2objectembed'))
            wikiLink.append(data.name);
        gw2Object.append(wikiLink);
    }
    static inflateItem(gw2Object, item) {
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
    static inflateSpecialization(gw2Object, spec) {
        if (gw2Object.classList.contains('gw2objectembed')) {
        }
        else {
            gw2Object.style.backgroundImage = `url(${spec.background})`;
            gw2Object.dataset.label = spec.name;
            const selectedPositions = String(gw2Object.getAttribute('selected_traits')).split(',').map(i => +i).filter(i => !isNaN(i) && 0 <= i && i <= 2);
            if (selectedPositions.length != 3) {
                console.warn("[gw2-tooltips] [inflator] Specialization object ", gw2Object, " does not have its 'selected_traits' (properly) set. Add the attribute as `selected_traits=\"0,2,1\"` where the numbers are 0-2 indicating top, middle or bottom selection.");
                return;
            }
            for (const [x, y] of selectedPositions.entries()) {
                const column = gw2Object.children[1 + x * 2];
                if (!column) {
                    console.warn("[gw2-tooltips] [inflator] Cannot mark selected trait object in column #", x, " for specialization object ", gw2Object, " because the column doesn't seem to exist. Either mark the specialization object as inline or add the missing column.");
                    continue;
                }
                for (const [i, traitEl] of Array.prototype.entries.call(column.children)) {
                    traitEl.classList.toggle('trait_unselected', i !== y);
                }
            }
        }
    }
    static getSlotName(skill) {
        let skillSlot;
        for (const palette of skill.palettes) {
            for (const slot of palette.slots) {
                switch (palette.type) {
                    case 'Equipment':
                        if (palette.weapon_type !== 'None') {
                            skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, (_, __, digit) => {
                                if (['Greatsword', 'Hammer', 'BowLong', 'Rifle', 'BowShort', 'Staff'].includes(palette.weapon_type) &&
                                    ['Offhand1', 'Offhand2'].includes(slot.slot)) {
                                    digit = digit === '1' ? '4' : '5';
                                }
                                return `${TUtilsV2.mapLocale(palette.weapon_type)} ${digit}`;
                            });
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
                    case 'Pet':
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
    static generateToolTip(apiObject, context) {
        const headerElements = [TUtilsV2.newElm('teb', TUtilsV2.GW2Text2HTML(apiObject.name))];
        headerElements.push(TUtilsV2.newElm('div.flexbox-fill'));
        const currentContextInformation = this.resolveTraitsAndOverrides(apiObject, context);
        if (currentContextInformation.resource_cost) {
            headerElements.push(TUtilsV2.newElm('ter', String(currentContextInformation.resource_cost), TUtilsV2.newImg(this.ICONS.RESOURCE, 'iconsmall')));
        }
        if (currentContextInformation.activation) {
            const value = TUtilsV2.drawFractional(currentContextInformation.activation / 1000);
            headerElements.push(TUtilsV2.newElm('ter', value + 's', TUtilsV2.newImg(this.ICONS.ACTIVATION, 'iconsmall')));
        }
        if (currentContextInformation.recharge) {
            const value = TUtilsV2.drawFractional(currentContextInformation.recharge / 1000);
            headerElements.push(TUtilsV2.newElm('ter', value + 's', TUtilsV2.newImg(this.ICONS.RECHARGE, 'iconsmall')));
        }
        const secondHeaderRow = [];
        {
            let slotName = ('slot' in apiObject && apiObject.slot) || ('palettes' in apiObject && this.getSlotName(apiObject));
            if (slotName)
                secondHeaderRow.push(TUtilsV2.newElm('tes', `( ${slotName} )`));
        }
        secondHeaderRow.push(TUtilsV2.newElm('div.flexbox-fill'));
        if ('override_groups' in apiObject && apiObject.override_groups) {
            const baseContext = new Set(['Pve', 'Pvp', 'Wvw']);
            for (const override of apiObject.override_groups) {
                for (const context of override.context) {
                    baseContext.delete(context);
                }
            }
            const splits = [];
            let pushedBase = false;
            for (const mode of ['Pve', 'Pvp', 'Wvw']) {
                if (baseContext.has(mode)) {
                    if (pushedBase)
                        continue;
                    const text = Array.from(baseContext).join('/');
                    if (baseContext.has(context.gameMode))
                        splits.push(`<span style="color: var(--gw2-tt-color-text-accent) !important;">${text}</span>`);
                    else
                        splits.push(text);
                    pushedBase = true;
                }
                else {
                    if (mode == context.gameMode)
                        splits.push(`<span style="color: var(--gw2-tt-color-text-accent) !important;">${mode}</span>`);
                    else
                        splits.push(mode);
                }
            }
            secondHeaderRow.push(TUtilsV2.newElm('tes', '( ', TUtilsV2.fromHTML(splits.join(' | ')), ' )'));
        }
        const parts = [TUtilsV2.newElm('tet', ...headerElements)];
        if (secondHeaderRow.length > 1)
            parts.push(TUtilsV2.newElm('tet.small', ...secondHeaderRow));
        if ('description' in apiObject && apiObject.description) {
            const description = document.createElement('ted');
            description.innerHTML = `<teh>${TUtilsV2.GW2Text2HTML(apiObject.description)}</teh>`;
            parts.push(description);
        }
        if (currentContextInformation.facts) {
            let weaponStrength = 690.5;
            if ('palettes' in apiObject && apiObject.palettes.length) {
                const criteria = context.character.profession
                    ? ((s) => s.profession === context.character.profession)
                    : ((s) => s.profession !== 'None');
                const relevantPalette = apiObject.palettes.find(p => p.slots.some(criteria));
                if (relevantPalette) {
                    weaponStrength = this.getWeaponStrength(relevantPalette);
                }
            }
            parts.push(...FactsProcessor.generateFacts(currentContextInformation.facts, weaponStrength, context));
        }
        const tooltip = TUtilsV2.newElm('div.tooltip', ...parts);
        tooltip.dataset.id = String(apiObject.id);
        tooltip.style.marginTop = '5px';
        return tooltip;
    }
    static resolveTraitsAndOverrides(apiObject, context) {
        var _a, _b;
        let override = (_a = apiObject.override_groups) === null || _a === void 0 ? void 0 : _a.find(g => g.context.includes(context.gameMode));
        let result = Object.assign({}, apiObject, override);
        if (apiObject.facts && override && override.facts) {
            result.facts = apiObject.facts.slice();
            for (const fact of override.facts.reverse()) {
                if ((_b = fact.requires_trait) === null || _b === void 0 ? void 0 : _b.some(t => !context.character.traits.includes(t)))
                    continue;
                if (fact.overrides)
                    result.facts[fact.overrides] = fact;
                else
                    result.facts.push(fact);
            }
        }
        if (result.facts) {
            result.facts = result.facts.filter(f => !f.requires_trait || !f.requires_trait.some(t => !context.character.traits.includes(t)));
        }
        return result;
    }
    static getHealth(character) {
        const baseHealth = !character.profession
            ? 1000
            : {
                Guardian: 1645,
                Thief: 1645,
                Elementalist: 1645,
                Engineer: 5922,
                Ranger: 5922,
                Mesmer: 5922,
                Revenant: 5922,
                Necromancer: 9212,
                Warrior: 9212,
            }[character.profession];
        return baseHealth + character.stats.vitality * 10;
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
    static generateToolTipList(initialAPIObject, gw2Object, context) {
        const objectChain = [];
        const validPaletteTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard'];
        const addObjectsToChain = (currentSkill) => {
            objectChain.push(currentSkill);
            if ('palettes' in currentSkill) {
                let hasChain = false;
                for (const palette of currentSkill.palettes) {
                    for (const slot of palette.slots) {
                        if (slot.next_chain && slot.profession !== 'None') {
                            const nextSkillInChain = APICache.storage.skills.get(slot.next_chain);
                            if (nextSkillInChain) {
                                hasChain = true;
                                addObjectsToChain(nextSkillInChain);
                            }
                        }
                    }
                }
                if (!hasChain && currentSkill.sub_skills) {
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
        let context_ = context;
        {
            let traitOverrides;
            if (gw2Object.getAttribute('type') === 'skill' && (traitOverrides = gw2Object.getAttribute('with-traits'))) {
                context_ = structuredClone(context);
                const invalid = [];
                context_.character.traits = traitOverrides.split(',').map(t => {
                    const v = +t;
                    if (!v)
                        invalid.push(t);
                    return v;
                }).filter(t => t);
                if (invalid.length)
                    console.warn("[gw2-tooltips] [tooltip engine] Inline trait-override for element ", gw2Object, " has misformed overrides: ", invalid);
            }
        }
        const tooltipChain = objectChain.map(obj => this.generateToolTip(obj, context_));
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
    static generateItemTooltip(item, context, target, statSetId, stackSize = 1) {
        var _a;
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
        let slottedItems;
        if ('slots' in item) {
            slottedItems = (_a = target.getAttribute('slotted')) === null || _a === void 0 ? void 0 : _a.split(',').map(id => APICache.storage.items.get(+String(id) || 0)).filter(i => i && 'subtype' in i);
        }
        const countPrefix = stackSize > 1 ? stackSize + ' ' : '';
        const upgradeNameSource = (slottedItems === null || slottedItems === void 0 ? void 0 : slottedItems.find(i => i.subtype !== 'Default')) || (slottedItems === null || slottedItems === void 0 ? void 0 : slottedItems[0]);
        const name = countPrefix + this.formatItemName(item, context, statSet, upgradeNameSource, stackSize);
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
            parts.push(this.generateUpgradeItemGroup(item, context));
        }
        if (statSet && 'attribute_base' in item) {
            parts.push(...statSet.attributes.map(({ attribute, base_value, scaling }) => {
                const computedValue = Math.round(base_value + item.attribute_base * scaling);
                return TUtilsV2.newElm('te', TUtilsV2.newElm('tem.color-stat-green', `+${computedValue} ${attribute}`));
            }));
        }
        if ('slots' in item && slottedItems) {
            parts.push(TUtilsV2.newElm('div.group.slots', ...item.slots.map(s => {
                let slottedItemIdx;
                switch (s) {
                    case 'Upgrade':
                        slottedItemIdx = slottedItems.findIndex(i => ['Rune', 'Sigil', 'Gem'].includes(i.subtype) || (i.subtype == 'Default' && i.flags.includes('Pvp')));
                        break;
                    case 'Infusion':
                        slottedItemIdx = slottedItems.findIndex(i => i.subtype == 'Default');
                        break;
                    case 'Enrichment':
                        slottedItemIdx = slottedItems.findIndex(i => i.subtype == 'Default');
                        break;
                }
                if (slottedItemIdx > -1) {
                    const slottedItem = slottedItems.splice(slottedItemIdx, 1)[0];
                    const group = this.generateUpgradeItemGroup(slottedItem, context);
                    const name = this.formatItemName(slottedItem, context, statSet);
                    group.prepend(TUtilsV2.newElm('tet', TUtilsV2.newImg(slottedItem.icon, 'iconsmall'), TUtilsV2.newElm('teb.color-rarity-' + slottedItem.rarity, name), TUtilsV2.newElm('div.flexbox-fill')));
                    return group;
                }
                else {
                    return TUtilsV2.newElm('te', TUtilsV2.newImg(this.ICONS['SLOT_' + s], 'iconsmall'), `Empty ${s} Slot`);
                }
            })));
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
    static generateUpgradeItemGroup(item, context) {
        const group = TUtilsV2.newElm('div.group');
        for (const [i, tier] of item.tiers.entries()) {
            let tier_wrap = TUtilsV2.newElm('te');
            if (tier.description)
                tier_wrap.append(TUtilsV2.newElm('span', TUtilsV2.fromHTML(TUtilsV2.GW2Text2HTML(tier.description))));
            else if (tier.facts) {
                for (const fact of tier.facts) {
                    const { wrapper } = FactsProcessor.generateFact(fact, null, context);
                    if (wrapper)
                        tier_wrap.append(wrapper);
                }
            }
            else if (tier.modifiers) {
                tier_wrap.style.flexDirection = "column";
                for (const modifier of tier.modifiers) {
                    let modifierValue = FactsProcessor.calculateModifier(modifier, context.character);
                    let text;
                    if (modifier.flags.includes('FormatPercent')) {
                        text = `+${Math.round(modifierValue)}% ${TUtilsV2.mapLocale(modifier.description)}`;
                    }
                    else {
                        text = `+${Math.round(modifierValue)} ${TUtilsV2.mapLocale(modifier.description)}`;
                    }
                    tier_wrap.append(TUtilsV2.newElm('te', text));
                }
            }
            const w = TUtilsV2.newElm('te', tier_wrap);
            if (item.subtype == "Rune") {
                const colorClass = i < (context.character.upgradeCounts[item.id] || 0) ? '.color-stat-green' : '';
                w.prepend(TUtilsV2.newElm('span' + colorClass, `(${i + 1})`));
            }
            group.append(w);
        }
        return group;
    }
    static inferItemUpgrades(wrappers) {
        const remainingInfusionsByContext = this.context.map(ctx => {
            const counts = {};
            for (const [id, c] of Object.entries(ctx.character.upgradeCounts)) {
                let item;
                if ((item = APICache.storage.items.get(+id)) && 'subtype' in item && item.subtype == 'Default' && !item.flags.includes('Pvp'))
                    counts[id] = c;
            }
            return counts;
        });
        for (const wrapper of wrappers) {
            if (wrapper.childElementCount < 2)
                return;
            const [itemEl, ...upgradeEls] = wrapper.children;
            if (itemEl.getAttribute('type') !== 'item')
                return;
            const itemCtx = +String(itemEl.getAttribute('contextSet')) || 0;
            const upgradeIds = upgradeEls.filter(u => u.getAttribute('type') === 'item' && u.getAttribute('objid')
                && (+String(itemEl.getAttribute('contextSet')) || 0) === itemCtx)
                .map(u => u.getAttribute('objid'));
            {
                let id, item;
                if ((id = +String(itemEl.getAttribute('objid'))) && (item = APICache.storage.items.get(id)) && 'slots' in item) {
                    for (const slot of item.slots) {
                        if (slot == 'Infusion') {
                            const remainingInfusions = remainingInfusionsByContext[itemCtx];
                            for (const infusionId of Object.keys(remainingInfusions)) {
                                upgradeIds.push(infusionId);
                                if (--remainingInfusions[infusionId] < 1) {
                                    delete remainingInfusions[infusionId];
                                }
                                break;
                            }
                        }
                    }
                }
            }
            const attrString = upgradeIds.join(',');
            if (attrString)
                itemEl.setAttribute('slotted', attrString);
        }
    }
    static _legacy_transformEffectToSkillObject(gw2Object, error_store) {
        const name = String(gw2Object.getAttribute('objId'));
        let id = {
            blight: 62653,
            bloodstone_blessed: 34917,
            blue_pylon_power: 31317,
            chill: 722,
            quickness: 1187,
            chilled: 722,
            fear: 896,
            alacrity: 30328,
            protection: 717,
            vigor: 726,
            barrier: 0,
            fury: 725,
            stability: 1122,
            stunbreak: 0,
            aegis: 743,
            might: 740,
            champion_of_the_legions: 20845,
            compromised: 35096,
            crowd_favor: 36173,
            curse_of_frailty: 53723,
            dark_aura: 39978,
            debilitated: 0,
            debilitating_void: 0,
            defense_up: 28482,
            derangement: 34965,
            elemental_empowerment: 62733,
            empowering_auras: 62939,
            equalization_matrix: 66586,
            exposed: 28778,
            expose_weakness: 26660,
            extreme_vulnerability: 65662,
            fixated: 47434,
            growing_rage_ashym: 3362,
            ignite: 16259,
            intervention: 35061,
            invulnerability: 56227,
            necrosis: 47414,
            not_sticking_together: 54378,
            nova: 39193,
            ooze_pheromone: 21538,
            photon_saturation: 0,
            positive_flow: 66665,
            power_of_the_void: 0,
            reinforced_armor: 9283,
            relentless_fire: 62805,
            retaliation_ashym: 24646,
            sentinel_retribution: 16350,
            shattering_ice: 62909,
            shell_shocked: 33361,
            spectral_darkness: 31498,
            sticking_together: 54604,
            synchronized_vitality: 63840,
            unnatural_signet: 38224,
            use_soul_binder: 55630,
            void_empowerment: 68083,
            xeras_embrace: 34979,
        }[name];
        if (!id) {
            const hardCoded = {
                barrier: {
                    id: 1,
                    name: 'Barrier',
                    icon: this.ICONS.BARRIER,
                    description: "Creates a health barrier that takes damage prior to the health bar. Barrier disappears 5s after being applied. Applying a barrier while one is already active will add to it, but the previously-existing barrier will still disappear 5s after it was originally applied. The amount of barrier generated is based on the source's healing power, and is capped at 50% of the recipient's maximum health.",
                    description_brief: "Creates a health barrier that takes damage prior to the health bar.",
                    categories: [], palettes: [],
                },
                stunbreak: {
                    id: 2,
                    name: 'Stun Break',
                    description: 'Cancel control effects such as stuns.',
                    icon: this.ICONS.STUN_BREAK,
                    categories: [], palettes: [],
                }
            }[name];
            if (hardCoded) {
                id = hardCoded.id;
                APICache.storage.skills.set(id, hardCoded);
            }
        }
        if (id) {
            gw2Object.setAttribute('type', 'skill');
            gw2Object.setAttribute('objId', String(id));
            return id;
        }
        else {
            gw2Object.innerText = name;
            gw2Object.title = `Failed to translate effect '${name}'.`;
            gw2Object.style.cursor = "help";
            gw2Object.classList.add('error');
            error_store.add(name);
            return 0;
        }
    }
    static calculateConditionDuration(level, expertise) {
        return expertise / (this.LUT_CRITICAL_DEFENSE[level] * (15 / this.LUT_CRITICAL_DEFENSE[80]));
    }
    static calculateBoonDuration(level, concentration) {
        return concentration / (this.LUT_CRITICAL_DEFENSE[level] * (15 / this.LUT_CRITICAL_DEFENSE[80]));
    }
    static formatItemName(item, context, statSet, upgradeComponent, stackSize = 1) {
        let name;
        if (item.type == 'TraitGuide') {
            name = item.trait;
        }
        else {
            name = item.name;
        }
        let arg1, arg2, arg3, arg4;
        arg1 = arg2 = arg3 = arg4 = '';
        if (!item.flags.includes('HidePrefix')) {
            if (statSet && statSet.name) {
                arg1 = statSet.name;
                arg2 = " ";
            }
        }
        if (!item.flags.includes('HideSuffix')) {
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
    static formatCoins(amount) {
        const parts = [String(Math.floor(amount % 100)), TUtilsV2.newImg(this.ICONS.COIN_COPPER, 'iconsmall', '')];
        if (amount > 99)
            parts.unshift(String(Math.floor((amount / 100) % 100)), TUtilsV2.newImg(this.ICONS.COIN_SILVER, 'iconsmall', ''));
        if (amount > 9999)
            parts.unshift(String(Math.floor(amount / 10000)), TUtilsV2.newImg(this.ICONS.COIN_GOLD, 'iconsmall', ''));
        return TUtilsV2.newElm('span', ...parts);
    }
    static isTwoHanded(type) {
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
GW2TooltipsV2.cycling = false;
GW2TooltipsV2.context = [];
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
            agonyResistance: 0,
        },
        statModifier: {
            lifeForce: 0,
            outgoingBuffDuration: {},
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
            agonyResistance: [],
        },
        upgradeCounts: {},
    },
};
GW2TooltipsV2.defaultConfig = {
    autoInitialize: true,
    autoCollectRuneCounts: true,
    autoCollectStatSources: true,
    autoCollectSelectedTraits: true,
    adjustIncorrectStatIds: true,
    autoInferEquipmentUpgrades: true,
    legacyCompatibility: true,
    preferCorrectnessOverExtraInfo: false,
};
GW2TooltipsV2.LUT_DEFENSE = [
    115, 120, 125, 129, 133, 137, 142, 146, 150, 154, 162, 168, 175, 182, 189, 196, 202, 209, 216, 223, 232, 240, 248, 257, 265, 274, 282, 290, 299, 307, 319, 330, 341, 352, 363, 374, 385, 396, 407, 418, 431, 443, 456, 469, 481, 494, 506, 519, 532, 544, 560, 575, 590, 606, 621, 636, 651, 666, 682, 697, 714, 731, 748, 764, 781, 798, 815, 832, 848, 865, 885, 905, 924, 943, 963, 982, 1002, 1021, 1040, 1060, 1081, 1102, 1123, 1144, 1165, 1186, 1207, 1228, 1249, 1270, 1291, 1312, 1333, 1354, 1375, 1396, 1417, 1438, 1459, 1480, 1501,
];
GW2TooltipsV2.LUT_POWER_PLAYER = [
    170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 202, 207, 212, 217, 222, 227, 232, 237, 242, 247, 253, 259, 265, 271, 277, 283, 289, 295, 301, 307, 315, 323, 331, 339, 347, 355, 363, 371, 379, 387, 396, 405, 414, 423, 432, 441, 450, 459, 468, 477, 488, 499, 510, 521, 532, 543, 554, 565, 576, 587, 599, 611, 623, 635, 647, 659, 671, 683, 695, 707, 721, 735, 749, 763, 777, 791, 805, 819, 833, 847, 862, 877, 892, 907, 922, 937, 952, 967, 982, 997, 1012, 1027, 1042, 1057, 1072, 1087, 1102, 1117, 1132, 1147, 1162,
];
GW2TooltipsV2.LUT_POWER_MONSTER = [
    162, 179, 197, 214, 231, 249, 267, 286, 303, 322, 344, 367, 389, 394, 402, 412, 439, 454, 469, 483, 500, 517, 556, 575, 593, 612, 622, 632, 672, 684, 728, 744, 761, 778, 820, 839, 885, 905, 924, 943, 991, 1016, 1067, 1093, 1119, 1145, 1193, 1220, 1275, 1304, 1337, 1372, 1427, 1461, 1525, 1562, 1599, 1637, 1692, 1731, 1802, 1848, 1891, 1936, 1999, 2045, 2153, 2201, 2249, 2298, 2368, 2424, 2545, 2604, 2662, 2723, 2792, 2854, 2985, 3047, 3191, 3269, 3348, 3427, 3508, 3589, 3671, 3754, 3838, 3922, 4007, 4093, 4180, 4267, 4356, 4445, 4535, 4625, 4717, 4809, 4902,
];
GW2TooltipsV2.LUT_RARITY = {
    Junk: 0,
    Basic: 0,
    Common: 1,
    Uncommon: 2,
    Rare: 3,
    Exotic: 4,
    Ascended: 4,
    Legendary: 4,
};
GW2TooltipsV2.LUT_CRITICAL_DEFENSE = [
    1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0, 5.2, 5.4, 5.6, 5.8, 6.0, 6.2, 6.4, 6.6, 6.8, 7.0, 7.3, 7.6, 7.9, 8.2, 8.5, 8.8, 9.1, 9.4, 9.7, 10.0, 10.3, 10.6, 10.9, 11.2, 11.5, 11.8, 12.1, 12.4, 12.7, 13.0, 13.4, 13.8, 14.2, 14.6, 15.0, 15.4, 15.8, 16.2, 16.6, 17.0, 17.4, 17.8, 18.2, 18.6, 19.0, 19.4, 19.8, 20.2, 20.6, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0, 25.5, 26.0, 26.5, 27.0, 27.5, 28.0, 28.5, 29.0, 29.5, 30.0, 30.5, 31.0,
];
GW2TooltipsV2.ICONS = {
    COIN_COPPER: 156902,
    COIN_SILVER: 156907,
    COIN_GOLD: 156904,
    SLOT_Upgrade: 517197,
    SLOT_Infusion: 517202,
    SLOT_Enrichment: 517204,
    RESOURCE: 156649,
    RECHARGE: 156651,
    ACTIVATION: 496252,
    RANGE: 156666,
    DEFIANCE_BREAK: 1938788,
    GENERIC_FACT: 156661,
    WEAPON_SWAP: 156583,
    BARRIER: 1770209,
    STUN_BREAK: 156654,
};
GW2TooltipsV2._constructor();
if (GW2TooltipsV2.config.autoInitialize) {
    const buildNodes = document.getElementsByClassName('gw2-build');
    if (GW2TooltipsV2.config.autoCollectSelectedTraits) {
        if (buildNodes.length)
            for (const target of buildNodes)
                Collect.allTraits(GW2TooltipsV2.context, target);
        else {
            console.warn("[gw2-tooltips] [collect] `config.autoCollectSelectedTraits` is active, but no element with class `gw2-build` could be found to use as source. Build information will not be collected as there is no way to tell which objects belong to the build definition and which ones are just in some arbitrary text.");
        }
    }
    GW2TooltipsV2.hookDocument(document)
        .then(_ => {
        if (GW2TooltipsV2.config.autoCollectRuneCounts) {
            if (buildNodes.length)
                for (const target of buildNodes)
                    Collect.allUpgradeCounts(GW2TooltipsV2.context, target);
            else {
                console.warn("[gw2-tooltips] [collect] `config.autoCollectRuneCounts` is active, but no element with class `gw2-build` could be found to use as source. Upgrades will not be collected as there is no way to tell which upgrades belongs to the build and which ones are just in some arbitrary text.");
            }
        }
        if (GW2TooltipsV2.config.autoCollectSelectedTraits) {
            Collect.traitEffects(GW2TooltipsV2.context);
        }
        if (GW2TooltipsV2.config.autoCollectStatSources) {
            if (buildNodes.length)
                for (const target of buildNodes)
                    Collect.allStatSources(GW2TooltipsV2.context, target);
            else {
                console.warn("[gw2-tooltips] [collect] `config.autoCollectStatSources` is active, but no element with class `gw2-build` could be found to use as source. Build information will not be collected as there is no way to tell which objects belong to the build definition and which ones are just in some arbitrary text.");
            }
        }
        if (GW2TooltipsV2.config.autoInferEquipmentUpgrades) {
            const targets = document.querySelectorAll('.weapon, .armor, .trinket');
            if (targets.length)
                GW2TooltipsV2.inferItemUpgrades(targets);
            else {
                console.warn("[gw2-tooltips] [collect] `config.autoInferEquipmentUpgrades` is active, but no wrapper elements element with class `'weapon`, `armor` or `trinket` could be found to use as source. No elements will be updated");
            }
        }
    });
}
