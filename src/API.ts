//NOTE(Rennorb): The different API implementations exist to easily swap out the data source for a local one, or even the official api in theory.
// If the API is not set on APICache it will set it to HSAPI on the first request to the cache.
// This is only possible to do if you manually set up the GW2TooltipsV2 window-scoped object.

class FakeAPI implements APIImplementation {
	bulkRequest<T extends keyof APIResponseTypeMap>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]> {
		if(['specializations', 'pvp/amulets'].includes(endpoint)) {
			return fetch(`https://api.guildwars2.com/v2/${endpoint}?ids=${ids.join(',')}`).then(r => r.json());
		}
		else {
			return new Promise((resolve, reject) => {
				//NOTE(Rennorb): must be set up through other externally included files
				const allSkills = (window as any)['DUMP_output_'+endpoint] as APIResponseTypeMap[T][];
				if(allSkills) {
					resolve(allSkills.filter(data => Array.prototype.includes.call(ids, data.id)));
				}
				else {
					console.info(`'${endpoint}' doesn't exist in mock data, synthesizing`);
					if(endpoint == 'items') {
						resolve(ids.map(id => ({
							id,
							name: 'item #'+id,
							icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAABJCAIAAAD+EZyLAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAFhSURBVGhD7ZoxkoIwFIYfexa0cDwBnkArT4ElNnuDPQC2dtvaqyeQE1gt3CWSEAOoszuzJoy/838N/CSZ4Zu8FxoipZS8KR/2+o7QDRO6YUI3TOiGCd0woRsmdMOEbpjQDRO6YUI3TOiGCd0eUG1mUTTbVDa+Iv727bh6NVfW5B+Y+lxsRYr1KNKsjnZEb+YV99DtsVnX0Ay66X4KQP2TMk9Ekry0UalD2s/NE0kP5r4/3Yy0g9fYy/b+CcK5mQmdF+zm25c3ubPYj1ywfqv2u0LS5dxGkXg8FTn/PKy10aT2no5jG5v8NGHPku3C9o9GN+SghHW7K6tT5vYmPMHcfivBgfDnpnuk2O2dzPwzT+pvQnvy1wf8sN92f25x9m1kdGsZoTg71Qde23Jfk3LQkhT+g4EJ3TChGyZ0w4RumNANE7phQjdM6IYJ3TChGyZ0w4RumNANE7phQjdM6IaIyAXGxL3ck02bowAAAABJRU5ErkJggg==',
						})) as APIResponseTypeMap[typeof endpoint][]);
					}
					else if(endpoint == 'pets') {
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
