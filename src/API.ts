//NOTE(Rennorb): The different API implementations exist to easily swap out the data source for a local one, or even the official api in theory.
// If the API is not set on APICache it will set it to HSAPI on the first request to the cache.
// This is only possible to do if you manually set up the GW2TooltipsV2 window-scoped object.

class FakeAPI implements APIImplementation {
	bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]> {
		return new Promise((resolve, reject) => {
			//let response = await fetch('./output.json')
			//let allSkills: Skill[] = await response.json()
			const allSkills = (window as any)['DUMP_output_'+endpoint] as APIResponseTypeMap[T][];
			if(!allSkills) reject(`'${endpoint}' doesn't exist in mock data`);
			else resolve(allSkills.filter(data => Array.prototype.includes.call(ids, data.id)));
		});
	}
}

class HSAPI implements APIImplementation {
	bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]> {
		throw new Error("Method not implemented.")
	}
}
