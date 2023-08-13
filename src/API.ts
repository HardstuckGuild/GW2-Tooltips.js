//NOTE(Rennorb): The different API implementations exist to easily swap out the data source for a local one, or even the official api in theory.
// If the API is not set on APICache it will set it to HSAPI on the first request to the cache.
// This can be done by specifying the apiImpl config option.
//TODO(Rennorb): readme

export class FakeAPI implements APIImplementation {
	hsApi    = new HSAPI('http://127.0.0.1:3000/api');
	fallback = new GlobalObjectAPI();

	async bulkRequest<T extends keyof APIResponseTypeMap>(endpoint: T, ids: number[]): Promise<APIResponseTypeMap[T][]> {
		try {
			return await this.hsApi.bulkRequest(endpoint, ids);
		}
		catch(ex) {
			console.warn(`[gw2-tooltips] [FakeAPI] error trying to get ep '${endpoint}' from localhost, will try to use the GLOB API.\n${ex}`);
			return await this.fallback.bulkRequest(endpoint, ids);
		}
	}
}

export class GlobalObjectAPI implements APIImplementation {
	async bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]> {
		if(['specializations', 'pvp/amulets'].includes(endpoint)) {
			const response = await fetch(`https://api.guildwars2.com/v2/${endpoint}?ids=${ids.join(',')}`).then(r => r.json());
			if (endpoint == 'pvp/amulets') {
				const modifierTranslation = {
					BoonDuration     : "Concentration",
					ConditionDamage  : "ConditionDmg",
					ConditionDuration: "Expertise", 
				} as { [k in OfficialAPI.AmuletStats]? : Exclude<API.Attributes, 'None'> }

				for(const obj of response as OfficialAPI.Amulet[]) {
					const tier : API.ItemUpgradeComponent['tiers'][0] = { modifiers: [] }
					//hackedy hack hack
					for(const [attribute_, adjustment] of Object.entries(obj.attributes)) {
						const attribute = modifierTranslation[attribute_] || attribute_ as Exclude<API.Attributes, 'None'>;

						tier.modifiers!.push({
							formula       : "NoScaling",
							base_amount   : adjustment,
							id            : -1, //TODO unused
							formula_param1: 0,
							formula_param2: 0,
							target_attribute_or_buff: attribute,
							description   : attribute,
							flags         : [],
						})
					}
					(obj as any).tiers = [tier];
					(obj as any).flags = ["Pvp"];
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
					console.info(`[gw2-tooltips] [GLOBAPI] '${endpoint}' doesn't exist in mock data, synthesizing`);
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

export class HSAPI implements APIImplementation {
	baseUrl : string;

	public constructor(baseUrl : string = 'https://api-v0.hardstuck.gg') {
		this.baseUrl = baseUrl;
	}

	async bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]> {
		if(['specializations', 'pvp/amulets'].includes(endpoint)) {
			const response = await fetch(`https://api.guildwars2.com/v2/${endpoint}?ids=${ids.join(',')}`).then(r => r.json());
			if (endpoint == 'pvp/amulets') {
				const modifierTranslation = {
					BoonDuration     : "Concentration",
					ConditionDamage  : "ConditionDmg",
					ConditionDuration: "Expertise", 
				} as { [k in OfficialAPI.AmuletStats]? : Exclude<API.Attributes, 'None'> }

				const transformed : API.ItemAmulet[] = [];
				for(const obj of response as OfficialAPI.Amulet[]) {
					const tier : API.ItemUpgradeComponent['tiers'][0] = { modifiers: [] }
					//hackedy hack hack
					for(const [attribute_, adjustment] of Object.entries(obj.attributes)) {
						const attribute = modifierTranslation[attribute_] || attribute_ as Exclude<API.Attributes, 'None'>;

						tier.modifiers!.push({
							formula       : "NoScaling",
							base_amount   : adjustment,
							id            : -1, //TODO unused
							formula_param1: 0,
							formula_param2: 0,
							target_attribute_or_buff: attribute,
							description   : attribute,
							flags         : [],
						})
					}

					transformed.push({
						id            : obj.id,
						type          : "Trinket",
						subtype       : "Amulet",
						name          : obj.name,
						icon          : obj.icon,
						rarity        : "Ascended",
						flags         : ['Pvp'],
						flags_ex      : [],
						tiers         : [tier],
						level         : 82,
						required_level: 2,
						vendor_value  : 0,
					});
				}
				return transformed as APIResponseTypeMap[T][];
			}
			return response;
		}

		return fetch(`${this.baseUrl}/${endpoint}?ids=${ids.join(',')}`).then(r => r.json());
	}
}
