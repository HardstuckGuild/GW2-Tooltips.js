type TypeBridge<T, K extends keyof T> = [K extends number ? string : K, Extract<T[K], {}>]
declare interface ObjectConstructor {
	entries<T>(obj : T) : TypeBridge<T, keyof T>[]
}

interface Array<T> {
	includes<T2>(searchElement : T | T2, fromIndex? : number) : searchElement is T;
}
interface ReadonlyArray<T> {
	includes<T2>(searchElement : T | T2, fromIndex? : number) : searchElement is T;
}

type Undefined<T> = { [k in keyof T]?: undefined }

namespace LegacyCompat {
	type ObjectType = 'skill' | 'trait' | 'item' | 'specialization' | 'pet' | 'pvp/amulet' | 'specialization' | 'effect' | 'profession';
}

type V2ObjectType = 'skill' | 'trait' | 'item' | 'specialization' | 'pet' | 'pvp/amulet' | 'specialization' | 'profession' | 'attribute' | 'skin';


type HandlerParams<TFact = API.Fact> = {
	fact           : TFact
	buff           : (TFact extends { buff : number } ? API.Skill : undefined) | undefined
	weaponStrength : TFact extends API.DamageFact ? number : undefined
}

type APIResponseTypeMap = {
	skills         : API.Skill;
	traits         : API.Trait;
	items          : API.Item;
	specializations: API.Specialization;
	pets           : API.Pet;
	'pvp/amulets'  : API.ItemAmulet;
	itemstats      : API.AttributeSet;
	palettes       : API.Palette;
	skins          : API.Skin;
	professions    : API.Profession;
}

type APIEndpoint = keyof APIResponseTypeMap;
type APIResponse = APIResponseTypeMap[keyof APIResponseTypeMap];
type APIObjectId = APIResponse['id'];

interface APIImplementation {
	bulkRequest<E extends APIEndpoint>(endpoint : E, ids : APIResponseTypeMap[E]['id'][]) : Promise<APIResponseTypeMap[E][]>;
	requestId<T extends keyof APIResponseTypeMap>(endpoint : T, id : APIResponseTypeMap[T]['id']) : Promise<APIResponseTypeMap[T]>;
	requestByName<T extends keyof APIResponseTypeMap>(endpoint : T, search : string) : Promise<APIResponseTypeMap[T][]>;
}

interface ScopeElement {
	getElementsByTagName(qualifiedName: string) : HTMLCollectionOf<Element>
	querySelectorAll<E extends Element = Element>(selectors : string) : NodeListOf<E>
}
