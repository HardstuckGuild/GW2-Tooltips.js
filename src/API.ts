//NOTE(Rennorb): The different API implementations exist to easily swap out the data source for a local one, or even the official api in theory.
// If the API is not set on APICache it will set it to HSAPI on the first request to the cache.
// This can be done by specifying the apiImpl config option.
//TODO(Rennorb): readme

export class FakeAPI implements APIImplementation {
	hsApi    = new HSAPI('http://127.0.0.1:3000');
	fallback = new HSAPI(); // since we now have a public api running we can jsut fall back to that

	async bulkRequest<T extends keyof APIResponseTypeMap>(endpoint: T, ids: number[]): Promise<APIResponseTypeMap[T][]> {
		try {
			return await this.hsApi.bulkRequest(endpoint, ids);
		}
		catch(ex) {
			console.warn(`[gw2-tooltips] [FakeAPI] error trying to get ep '${endpoint}' from localhost, will try to use the fallback API.\n${ex}`);
			return await this.fallback.bulkRequest(endpoint, ids);
		}
	}
}

export class HSAPI implements APIImplementation {
	baseUrl : string;

	public constructor(baseUrl : string = 'https://api-v0.hardstuck.gg') {
		this.baseUrl = baseUrl;
	}

	async bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]> {
		if(['pvp/amulets', 'pets'].includes(endpoint)) {
			const response = await fetch(`https://api.guildwars2.com/v2/${endpoint}?ids=${ids.join(',')}`).then(r => r.json());
			if (endpoint == 'pvp/amulets') {
				const modifierTranslation = {
					BoonDuration     : "Concentration",
					ConditionDamage  : "ConditionDmg",
					ConditionDuration: "Expertise", 
					CritDamage       : "Ferocity",
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
						flags         : ['Pvp', 'NoSalvage'],
						flags_ex      : [],
						tiers         : [tier],
						rarity        : "Exotic",
						level         : 82,
						required_level: 0,
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
