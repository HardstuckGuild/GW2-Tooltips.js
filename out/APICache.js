"use strict";
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
        switch (endpoint) {
            case 'skills':
                {
                    for (const palette of datum.palettes) {
                        for (const slot of palette.slots) {
                            if (slot.profession !== 'None' && slot.next_chain && !this.storage.items.has(slot.next_chain)) {
                                connectedIdsStorage.skills.add(slot.next_chain);
                            }
                        }
                    }
                    if (datum.sub_skills) {
                        for (const subSkill of datum.sub_skills)
                            if (!this.storage.skills.has(subSkill))
                                connectedIdsStorage.skills.add(subSkill);
                    }
                    addFacts(datum.facts);
                    if (datum.facts_override) {
                        for (const { facts } of datum.facts_override)
                            addFacts(facts);
                    }
                }
                break;
            case 'traits':
                {
                    addFacts(datum.facts);
                }
                break;
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
};
