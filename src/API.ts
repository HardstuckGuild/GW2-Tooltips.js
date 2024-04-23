//NOTE(Rennorb): The different API implementations exist to easily swap out the data source for a local one, or even the official api in theory.
// If the API is not set on APICache it will set it to HSAPI on the first request to the cache.
// Setting the api can be done by specifying the apiImpl config option.

export class FakeAPI implements APIImplementation {
	localAPI    = new HSAPI('http://localhost:3000');
	fallbackAPI = new HSAPI(); // since we now have a public api running we can just fall back to that
	localApiOffline = false;

	bulkRequest<T extends keyof APIResponseTypeMap>(endpoint: T, ids: APIResponseTypeMap[T]['id'][]): Promise<APIResponseTypeMap[T][]> {
		return this.resolveRequest('bulkRequest', endpoint, ids);
	}

	requestId<T extends keyof APIResponseTypeMap>(endpoint : T, id : APIResponseTypeMap[T]['id']) : Promise<APIResponseTypeMap[T]> {
		return this.resolveRequest('requestId', endpoint, id);
	}

	requestByName<T extends keyof APIResponseTypeMap>(endpoint : T, search : string) : Promise<APIResponseTypeMap[T][]> {
		return this.resolveRequest('requestByName', endpoint, search);
	}

	//TODO(Rennorb) @cleanup: Type return type
	async resolveRequest<M extends keyof APIImplementation, T extends keyof APIResponseTypeMap>(method : M, endpoint : T, arg : any) : Promise<any> {
		try {
			return await (this.localApiOffline ? this.fallbackAPI : this.localAPI)[method](endpoint, arg);
		}
		catch(ex : any) {
			if(ex?.message.includes("NetworkError")) {
				this.localApiOffline = true;
				console.warn(`[gw2-tooltips] [FakeAPI] Local api seems to be offline, swapping to the real one.\n${ex}`);
			}
			else {
				console.warn(`[gw2-tooltips] [FakeAPI] Error trying to get ep '${endpoint}' from localhost, will try to use the fallback API.\n${ex}`);
			}
			return await this.fallbackAPI[method](endpoint, arg);
		}
	}
}

export const enum CACHE_WORKER_HEADER { VALUE = 'X-TTJS-Worker-Cached' }

export class HSAPI implements APIImplementation {
	static WORKER_CACHE_INIT = { headers: { [CACHE_WORKER_HEADER.VALUE]: '1' } };
	baseUrl : string;

	public constructor(baseUrl : string = 'https://gw2-api.hardstuck.gg') {
		this.baseUrl = baseUrl;
	}

	bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : APIResponseTypeMap[T]['id'][]) : Promise<APIResponseTypeMap[T][]> {
		return fetch(`${this.baseUrl}/${endpoint}?ids=${ids.join(',')}`, HSAPI.WORKER_CACHE_INIT).then(r => r.json());
	}
	requestId<T extends keyof APIResponseTypeMap>(endpoint : T, id : APIResponseTypeMap[T]['id']) : Promise<APIResponseTypeMap[T]> {
		return fetch(`${this.baseUrl}/${endpoint}/${id}`, HSAPI.WORKER_CACHE_INIT).then(r => r.json());
	}
	requestByName<T extends keyof APIResponseTypeMap>(endpoint : T, search : string) : Promise<APIResponseTypeMap[T][]> {
		return fetch(`${this.baseUrl}/${endpoint}/by-name/${search}`, HSAPI.WORKER_CACHE_INIT).then(r => r.json());
	}
}
