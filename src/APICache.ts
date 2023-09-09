export default class APICache {
	static storage : ObjectDataStorage = {
		skills         : new Map<number, API.Skill>(),
		items          : new Map<number, API.Item>(),
		traits         : new Map<number, API.Trait>(),
		pets           : new Map<number, OfficialAPI.Pet>(),
		'pvp/amulets'  : new Map<number, API.ItemAmulet>(),
		specializations: new Map<number, OfficialAPI.Specialization>(),
		itemstats      : new Map<number, API.AttributeSet>(),
	}

	static apiImpl : APIImplementation

	//TODO(Rennorb): add option to api to send hybrid request to get all related information for a page
	/** This might actually fetch more data than just the ids specified and ensures that all data required to display the ids is available */
	static async ensureExistence<T extends Endpoints>(endpoint : T, initialIds : IterableIterator<number>) : Promise<void> {
		if(!this.apiImpl) {
			this.apiImpl = new HSAPI()
		}

		let additionalIds : { [k in Endpoints] : Set<number> } = Object.assign({
			skills         : new Set<number>(),
			items          : new Set<number>(),
			traits         : new Set<number>(),
			pets           : new Set<number>(),
			'pvp/amulets'  : new Set<number>(),
			specializations: new Set<number>(),
			itemstats      : new Set<number>(),
		}, { [endpoint]: new Set(initialIds) })

		const findNextRelevantEndpoint = () => {
			for(const [endpoint, ids] of Object.entries(additionalIds))
				if(ids.size > 0)
					return endpoint
			return undefined
		}

		let currentEndpoint : Endpoints | undefined = endpoint
		let i = 0
		do {

			const storageSet = this.storage[currentEndpoint]
			//TODO(Rennorb): i really don't like this but it seems to be the most sensible way for now
			const request = Array.from(additionalIds[currentEndpoint].values())
			additionalIds[currentEndpoint].clear()

			console.info(`[gw2-tooltips] [API cache] round #${i++} for a ${endpoint} request, currently fetching ${currentEndpoint}. Ids: `, request)

			try {
				const response = await this.apiImpl.bulkRequest(currentEndpoint, request)
				//TODO(Rennorb) @perf: provide option to disable this
				const unobtainable = request.filter(id => !response.some(obj => obj.id == id))
				if(unobtainable.length) console.warn(`[gw2-tooltips] [API cache] Did not receive all requested ${currentEndpoint} ids. missing: `, unobtainable);

				for(const datum of response) {
					if(storageSet.has(datum.id)) continue

					storageSet.set(datum.id, datum as any) //TODO
					this.collectConnectedIds({ endpoint: currentEndpoint, datum } as any, additionalIds)
				}
			}
			catch(ex) {
				console.error(ex)
			}
		} while((currentEndpoint = findNextRelevantEndpoint()) && i < 100)
	}

	static collectConnectedIds({ endpoint, datum } : ConnectedIdDatum, connectedIdsStorage : { [k in Endpoints] : Set<number> }) : void {
		const addFacts = (facts : API.Fact[]) => {
			for(const fact of facts) {
				if(fact.type == 'Buff' || fact.type == 'BuffBrief') {
					if(!this.storage.skills.has(fact.buff))
						connectedIdsStorage.skills.add(fact.buff) // TODO(Rennorb) @correctness: are we sure about using the skill endpoint for this?
				}
				if(fact.type === 'PrefixedBuffBrief' || fact.type === 'PrefixedBuff') {
					if(!this.storage.skills.has(fact.prefix))
						connectedIdsStorage.skills.add(fact.prefix)
					if(!this.storage.skills.has(fact.buff))
						connectedIdsStorage.skills.add(fact.buff)
				}
			}
		}

		if('palettes' in datum) {
			for(const palette of datum.palettes) {
				for(const slot of palette.slots) {
					if(slot.profession && slot.next_chain && !this.storage.items.has(slot.next_chain)) {
						connectedIdsStorage.skills.add(slot.next_chain)
					}
					//TODO(Rennorb) @perf: This could be improved if we knew if th corresponding class is actually set on the source object to even do the replacement that we fetch these for.
					if(slot.traited_alternatives) for(const [_, skillId] of slot.traited_alternatives) {
						if(!this.storage.skills.has(skillId))
							connectedIdsStorage.skills.add(skillId);
					}
				}
			}
		}

		if('related_skills' in datum) {
			for(const subSkill of datum.related_skills!)
				if(!this.storage.skills.has(subSkill))
					connectedIdsStorage.skills.add(subSkill);
		}

		if('blocks' in datum) for(const block of datum.blocks!) {
			if(block.facts)
				addFacts(block.facts);
		}

		if('override_groups' in datum) {
			for(const { blocks } of datum.override_groups!)
				if(blocks) for(const block of blocks!)
					if(block.facts)
						addFacts(block.facts);
		}

		if('attribute_set' in datum) {
			if(!this.storage.itemstats.has(datum.attribute_set!))
				connectedIdsStorage.itemstats.add(datum.attribute_set!);
		}

		if('skills' in datum) for(const { id: subSkillId } of datum.skills) {
			if(!this.storage.skills.has(subSkillId))
				connectedIdsStorage.skills.add(subSkillId);
		}

		if('specialization' in datum) {
			if(!this.storage.specializations.has(datum.specialization!))
				connectedIdsStorage.specializations.add(datum.specialization!);
		}
	}
}

//TODO(Rennorb) @cleanup: disgusting
type ConnectedIdDatum = {
	endpoint : 'skills'
	datum    : APIResponseTypeMap['skills']
} | {
	endpoint : 'traits'
	datum    : APIResponseTypeMap['traits']
} | {
	endpoint : 'items'
	datum    : APIResponseTypeMap['items']
} | {
	endpoint : 'specializations'
	datum    : APIResponseTypeMap['specializations']
} | {
	endpoint : 'pets'
	datum    : APIResponseTypeMap['pets']
} | {
	endpoint : 'pvp/amulets'
	datum    : APIResponseTypeMap['pvp/amulets']
} | {
	endpoint : 'itemstats'
	datum    : APIResponseTypeMap['itemstats']
}

(window as any).APICache = APICache; //@debug

import { HSAPI } from './API';
