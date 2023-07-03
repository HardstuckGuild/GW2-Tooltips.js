//NOTE(Rennorb): The different API implementations exist to easily swap out the data source for a local one, or even the official api in theory.
// If the API is not set on APICache it will set it to HSAPI on the first request to the cache.
// This can be done by specifying the apiImpl config option.
//TODO(Rennorb): readme

class FakeAPI implements APIImplementation {
	async bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]> {
		if(['specializations', 'pvp/amulets'].includes(endpoint)) {
			const response = await fetch(`https://api.guildwars2.com/v2/${endpoint}?ids=${ids.join(',')}`).then(r => r.json());
			if (endpoint == 'pvp/amulets') {
				for(const obj of response) {
					obj.facts = [];
					//hackedy hack hack
					for(const [attribute, adjustment] of Object.entries(obj.attributes)) {
						obj.facts.push({
							type  : 'AttributeAdjust',
							icon  : '',
							order : -1,
							target: attribute,
							value : adjustment,
							attribute_multiplier : 0,
							level_exponent       : 0,
							hit_count            : 0,
							level_multiplier     : 0,
						} as API.AttributeAdjustFact)
					}
				}
			}
			return response;
		}
		else {
			return new Promise((resolve, reject) => {
				//NOTE(Rennorb): must be set up through other externally included files
				const allData = (window as any)['DUMP_output_'+endpoint] as APIResponseTypeMap[T][];
				if(allData) {
					const apiResult = allData.filter(data => ids.includes(data.id));
					// for itemstats the new api will return related attibutes aswell. 
					if(endpoint == 'itemstats') {
						const additionalIdsWithDuplicates = ((apiResult as APIResponseTypeMap['itemstats'][])
							.map(set => set.similar_sets)
							.filter(similars => similars) as Exclude<API.AttributeSet['similar_sets'], undefined>[]) //ts doesnt understand the filter
							.map(similars => Object.values(similars));

						for(const additionalId of new Set(Array.prototype.concat(...additionalIdsWithDuplicates))) {
							if(!apiResult.some(set => set.id == additionalId)) {
								apiResult.push(allData.find(set => set.id == additionalId) as any);
							}
						}
					}
					resolve(apiResult);
				}
				else {
					console.info(`[gw2-tooltips] [FakeAPI]'${endpoint}' doesn't exist in mock data, synthesizing`);
					if(endpoint == 'pets') {
						resolve(ids.map(id => ({
							id,
							name: 'pet #'+id,
							icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAABJCAIAAAD+EZyLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAFqSURBVGhD7dkxcoJAFMbxtzmLpMjkBHgCrHIKLLXJPbAMR7BKI54gnCBV5C5kFxYEmdHMwCPzMd+vcUCc8e8+lkJTlqUs1JN/XSK2YWIbJrZhYhsmtmFiGya2YWIbJrZhmqjtvDV960Ph3/o/E65bmFxKL4vzfWC2Z//OHe5H0foddGYy+shikfTzD3GKtO634CUU+f5pF6Q7tH49i8PamE0q4ta4c346fopGcsvUmcn6hMTZ8OCS2OjrpYMPTkilrfr+7XF11GRavWPNtglnshktY4K92K/7tVu508XpmEv8FlXXOKvn1964qtHZJ5uuVrrx2Y67x+agtZfc6Ixk7TZeg37bbCM4MMO6Re9JaO/F6w5vnwft49o9K/LjSafcz8hID7e76jHg9S+sN1VnMLgj8f83TGzDxDZMbMPENkxsw8Q2TGzDxDZMbMPENkxsw8Q2TGzDxDZMbMPENkxsw8Q2TGzDtNw2kV87CKi1eKVduQAAAABJRU5ErkJggg==',
						})) as APIResponseTypeMap[typeof endpoint][]);
					}
					else {
						reject(`'${endpoint}' doesn't exist in mock data, and i don't know how to synthesize it`);
					}
				}
			});
		}
	}
}

class HSAPI implements APIImplementation {
	bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]> {
		throw new Error("Method not implemented.")
	}
}
