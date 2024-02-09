export default class APICache {
	static storage : ObjectDataStorage = {
		skills         : new Map<number, API.Skill>(),
		items          : new Map<number, API.Item>(),
		traits         : new Map<number, API.Trait>(),
		pets           : new Map<number, API.Pet>(),
		'pvp/amulets'  : new Map<number, API.ItemAmulet>(),
		specializations: new Map<number, API.Specialization>(),
		itemstats      : new Map<number, API.AttributeSet>(),
		palettes       : new Map<number, API.Palette>(),
		professions    : new Map<ProfessionId, API.Profession>(),
	}

	static apiImpl : APIImplementation

	//TODO(Rennorb): add option to api to send hybrid request to get all related information for a page
	/** This might actually fetch more data than just the ids specified and ensures that all data required to display the ids is available */
	static async ensureExistence<E extends APIEndpoint>(endpoint : E, initialIds : IterableIterator<APIResponseTypeMap[E]['id']>, validateResponse : boolean) : Promise<void> {
		if(!this.apiImpl) {
			this.apiImpl = new HSAPI()
		}

		let additionalIds : AdditionalIdSets = Object.assign({
			skills         : new Set<number>(),
			items          : new Set<number>(),
			traits         : new Set<number>(),
			pets           : new Set<number>(),
			'pvp/amulets'  : new Set<number>(),
			specializations: new Set<number>(),
			itemstats      : new Set<number>(),
			palettes       : new Set<number>(),
			professions    : new Set<ProfessionId>,
		}, { [endpoint]: new Set(initialIds) })

		const findNextRelevantEndpoint = () => {
			for(const [endpoint, ids] of Object.entries(additionalIds))
				if(ids.size > 0)
					return endpoint
			return undefined
		}

		let didCollectPalettes = false;
		let currentEndpoint : APIEndpoint | undefined = endpoint
		let i = 0
		do {
			if(currentEndpoint == 'palettes') didCollectPalettes = true;

			const storageSet : Map<APIResponseTypeMap[typeof currentEndpoint]['id'], any> = this.storage[currentEndpoint]
			//TODO(Rennorb): Get rid of this unnecessary copy. Only reasonably doable once Iterator.prototype.toArray is stabilized.
			const request = Array.from<APIResponseTypeMap[typeof currentEndpoint]['id']>(additionalIds[currentEndpoint].values())
			additionalIds[currentEndpoint].clear()

			console.info(`[gw2-tooltips] [API cache] round #${i++} for a ${endpoint} request, currently fetching ${currentEndpoint}. Ids: `, request)

			try {
				const response = await this.apiImpl.bulkRequest(currentEndpoint, request)
				if(validateResponse) {
					const unobtainable = request.filter(id => !response.some(obj => obj.id == id))
					if(unobtainable.length) console.warn(`[gw2-tooltips] [API cache] Did not receive all requested ${currentEndpoint} ids. missing: `, unobtainable);
				}

				for(const datum of response) {
					if(storageSet.has(datum.id)) continue

					storageSet.set(datum.id, datum)
					this.collectConnectedIds(datum, additionalIds, didCollectPalettes)
				}
			}
			catch(ex) {
				console.error(ex)
			}
		} while((currentEndpoint = findNextRelevantEndpoint()) && i < 100)
	}

	static collectConnectedIds(datum : APIResponse, connectedIdsStorage : AdditionalIdSets, didCollectPalettes : boolean) : void {
		const addFacts = (facts : API.Fact[]) => {
			for(const fact of facts) {
				if(fact.type == 'Buff' || fact.type == 'BuffBrief') {
					if(!this.storage.skills.has(fact.buff))
						connectedIdsStorage.skills.add(fact.buff)
				}
				if(fact.type === 'PrefixedBuffBrief' || fact.type === 'PrefixedBuff') {
					if(!this.storage.skills.has(fact.prefix))
						connectedIdsStorage.skills.add(fact.prefix)
					if(!this.storage.skills.has(fact.buff))
						connectedIdsStorage.skills.add(fact.buff)
				}
			}
		}

		if(!didCollectPalettes && 'palettes' in datum) for(const palette of datum.palettes) {
			if(!this.storage.palettes.has(palette))
				connectedIdsStorage.palettes.add(palette);
		}

		if('groups' in datum) for(const group of datum.groups) {
			for(const candidate of group.candidates) {
				if(!this.storage.skills.has(candidate.skill))
					connectedIdsStorage.skills.add(candidate.skill);
			}
		}

		if('related_skills' in datum) {
			for(const subSkill of datum.related_skills!)
				if(!this.storage.skills.has(subSkill))
					connectedIdsStorage.skills.add(subSkill);
		}

		if('ambush_skills' in datum) {
			for(const subSkill of datum.ambush_skills!)
				if(!this.storage.skills.has(subSkill.id))
					connectedIdsStorage.skills.add(subSkill.id);
		}

		if('bundle_skills' in datum) {
			for(const subSkill of datum.bundle_skills!)
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

		if('skills' in datum) for(const subSkillId of datum.skills) {
			if(!this.storage.skills.has(subSkillId))
				connectedIdsStorage.skills.add(subSkillId);
		}

		if('skills_ai' in datum) for(const subSkillId of datum.skills_ai) {
			if(!this.storage.skills.has(subSkillId))
				connectedIdsStorage.skills.add(subSkillId);
		}

		if('skills_soulbeast' in datum) for(const subSkillId of datum.skills_soulbeast) {
			if(!this.storage.skills.has(subSkillId))
				connectedIdsStorage.skills.add(subSkillId);
		}

		if('specialization' in datum) {
			if(!this.storage.specializations.has(datum.specialization!))
				connectedIdsStorage.specializations.add(datum.specialization!);
		}

		if('applies_buff' in datum) {
			if(!this.storage.skills.has(datum.applies_buff.buff))
				connectedIdsStorage.skills.add(datum.applies_buff.buff);
		}

		if('facts_from_skill' in datum) {
			if(!this.storage.skills.has(datum.facts_from_skill))
				connectedIdsStorage.skills.add(datum.facts_from_skill);
		}

		if('trait' in datum) {
			if(!this.storage.traits.has(datum.trait))
				connectedIdsStorage.traits.add(datum.trait);
		}
	}
}

type ObjectDataStorage = {
	[k in APIEndpoint] : Map<APIResponseTypeMap[k]['id'], APIResponseTypeMap[k]>
}

type AdditionalIdSets = {
	[k in APIEndpoint] : Set<APIResponseTypeMap[k]['id']>
}

import { HSAPI } from './API';
