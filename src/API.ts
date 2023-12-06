//NOTE(Rennorb): The different API implementations exist to easily swap out the data source for a local one, or even the official api in theory.
// If the API is not set on APICache it will set it to HSAPI on the first request to the cache.
// This can be done by specifying the apiImpl config option.
//TODO(Rennorb): readme

export class FakeAPI implements APIImplementation {
	hsApi    = new HSAPI('http://localhost:3000');
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

export const enum CACHE_WORKER_HEADER { VALUE = 'X-TTJS-Worker-Cached' }

export class HSAPI implements APIImplementation {
	static WORKER_CACHE_INIT = { headers: { [CACHE_WORKER_HEADER.VALUE]: '1' } };
	baseUrl : string;

	public constructor(baseUrl : string = 'https://api-v0.hardstuck.gg') {
		this.baseUrl = baseUrl;
	}

	async bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]> {
		return fetch(`${this.baseUrl}/${endpoint}?ids=${ids.join(',')}`, HSAPI.WORKER_CACHE_INIT).then(r => r.json());
	}
}
