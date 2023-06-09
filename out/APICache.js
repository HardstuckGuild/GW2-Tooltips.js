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
            "pvp/amulets": new Set(),
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
            console.info(`[gw2-tooltips API cache] round #${i++} for a ${endpoint} request, currently fetching ${currentEndpoint}`);
            const storageSet = this.storage[currentEndpoint];
            const request = Array.from(additionalIds[endpoint].values());
            additionalIds[endpoint].clear();
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
                        datum.sub_skills.forEach(Set.prototype.add.bind(connectedIdsStorage.skills));
                    }
                    for (const fact of datum.facts) {
                        if (fact.type == 'Buff' || fact.type == 'BuffBrief') {
                            connectedIdsStorage.skills.add(fact.buff);
                        }
                    }
                    if (datum.facts_override) {
                        for (const { facts } of datum.facts_override) {
                            for (const fact of facts) {
                                if (fact.type == 'Buff' || fact.type == 'BuffBrief') {
                                    connectedIdsStorage.skills.add(fact.buff);
                                }
                            }
                        }
                    }
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
    "pvp/amulets": new Map(),
    specializations: new Map(),
};
