let loaded = false;
let database : IDBDatabase | undefined = undefined;


const endpoints : (keyof APIResponseTypeMap)[] = ['items', 'itemstats', 'skills', 'traits', 'specializations', 'pvp/amulets', 'pets', 'palettes'];

(self as any as ServiceWorkerGlobalScope).addEventListener('install', (e) => e.waitUntil(tryOpenDb()));

(self as any as ServiceWorkerGlobalScope).addEventListener('activate', (e) => e.waitUntil(
	Promise.all([
		(self as any as ServiceWorkerGlobalScope).registration?.navigationPreload.enable(),
		(self as any as ServiceWorkerGlobalScope).clients.claim(),
	])
));

function tryOpenDb() : Promise<void> {
	return new Promise((accept, reject) => {
		const request = self.indexedDB.open("gw2api");
		request.onerror = (e) => {
			loaded = true;
			console.error(e);
			reject(e);
		};
		request.onsuccess = (e) => {
			database = (e.target as IDBOpenDBRequest).result;
			loaded = true;
			accept();
		};
		request.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			for(const ep of endpoints) {
				db.createObjectStore(ep);
			}
			console.log('stores created', db);
		}
	});
}

async function makeResponse(request : Request, preload : Promise<any>) : Promise<Response> {
	if(!loaded) { //lifetime memes - script might get awoken without context
		await tryOpenDb();
	}

	const url = new URL(request.url);
	let ids = url.searchParams.get('ids')?.split(',').map(s => parseInt(s)).filter(id => !isNaN(id)) as number[] | null;
	let endpoint : string;
	if(ids) {
		endpoint = url.pathname.slice(1);
	}
	else {
		const path = url.pathname;
		const lastSlash = path.lastIndexOf('/');
		endpoint = path.slice(1, lastSlash);
		const id = parseInt(path.slice(lastSlash + 1));
		ids = isNaN(id) ? [] : [id];
	}

	const cache = database?.transaction(endpoint, 'readwrite').objectStore(endpoint);
	if(cache) {
		const min = Math.min.apply(null, ids); //likely not even very helpful as ids are sparse and somewhat incoherent
		const max = Math.max.apply(null, ids);

		const remainingIds = new Set(ids);
		const result = [];
		
		await new Promise<void>((accept, reject) => {
			const req = cache.openCursor(IDBKeyRange.bound(min, max));
			req.onsuccess = (e) => {
				const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result; //wtf is ths ultra cursed api?
				if(cursor) { //has next entry
					if(remainingIds.delete(cursor.key as number)) { // false means the id did not exist and we din't want it 
						result.push(cursor.value);
					}

					cursor.continue();
				}
				else { //done
					accept();
				}
			};
			req.onerror = (e) => reject(e);
		});

		if(remainingIds.size > 0) {
			const response = await fetch(url.origin+'/'+endpoint+'?ids='+Array.from(remainingIds).join(','));
			const json = await response.json();
			const cache = database!.transaction(endpoint, 'readwrite').objectStore(endpoint); // dumb bs
			for(const obj of json) { //unfortunately we have to parse it once here
				const strRepr = JSON.stringify(obj);
				result.push(strRepr);
				cache.put(strRepr, obj.id);
			}
			cache.transaction.commit();
		}


		//NOTE(Rennorb): We save some re-parsing by mostly storing strings, but all of this is still very cursed.
		return new Response('['+result.join(',')+']', { "status": 200, headers: { "Content-Type": "application/json" } });
	}
	else {
		console.log("no cache", endpoint, caches);
		return await fetch(request);
	}
}

(self as any as ServiceWorkerGlobalScope).addEventListener('fetch', (e) => {
	if(!e.request.headers.has(CACHE_WORKER_HEADER.VALUE)) return;

	e.respondWith(makeResponse(e.request, e.preloadResponse));
});

import { CACHE_WORKER_HEADER } from './API'