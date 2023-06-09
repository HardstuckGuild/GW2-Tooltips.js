namespace LegacyCompat {
	type ObjectType = 'skill' | 'trait' | 'item' | 'specialization' | 'pet' | 'pvp/amulet' | 'specialization';
}

namespace API {
	interface Skill {
		id                 : number
		name               : string
		name_brief?        : string
		description?       : string
		description_brief? : string
		icon?              : string
		chat_link          : string //TODO(Rennorb) who cares
		facts              : Fact[]
		facts_override?    : FactsOverride[]
		categories         : any[]
		range              : number
		recharge           : Duration
		recharge_override  : RechargeOverride[]
		activation?        : Duration
		evade_duration?    : Duration
		palettes           : Palette[]
		cost?              : number
		sub_skills?        : number[]
		modifiers?         : Modifier[]
	}

	type Fact = FactMap[keyof FactMap];

	interface FactsOverride {
		mode  : string
		facts : Fact[]
	}

	type Weapons1H = 'Focus' | 'Shield' | 'Torch' | 'Warhorn' | 'BowShort' | 'Axe' | 'Sword' | 'Dagger' | 'Pistol' | 'Scepter' | 'Mace';
	type Weapons2H = 'Greatsword' | 'Hammer' | 'Staff' | 'BowLong' | 'Rifle';
	type WeaponsAquatic = 'Spear';

	interface Palette {
		id          : number
		type        : 'Standard' | 'Toolbelt' | 'Bundle' | 'Equipment' | 'Heal' | 'Elite' | 'Profession' | 'Monster' | 'Transformation' | 'Pet'
		weapon_type : 'None' | 'Standard' | 'BundleLarge' | Weapons1H | Weapons2H | WeaponsAquatic
		slots       : Slot[]
	}

	interface Slot {
		profession  : 'None' | string // todo
		slot        : `${'Main'|'Offhand'|'Main'}${1|2|3|4|5}` | `Offhand${1|2}` 
			| 'Heal' | 'Standard' | 'Elite'
			| 'Pet' | `Transformation${1|2|3|4|5}`
		prev_chain? : number
		next_chain? : number
	}

	interface Modifier {
		id             : number
		base_amount    : number
		formula_param1 : number
		formula_param2 : number
		formula        : number
		description    : string
		flags          : ('FormatDuration' | 'FormatPercent' | 'SkipNextEntry' | 'MulByDuration' | 'DivDurationBy3' | 'DivDurationBy10' | 'NonStacking')[]
		trait_req?     : number
		mode?          : GameMode
	}

	
	interface BasicFact<Type> {
		type            : Type
		order           : number
		requires_trait? : number[]
		defiance_break? : number
		overrides?      : number
	
		//NOTE(Rennorb): This is here so we can just use `Fact.buff` and similar. Otherwise ts wont like us calling that on the `Fact` union because the prop doesn't exist on some of the constituents.
		[k : string] : undefined 
	}
	
	interface BuffFact extends BasicFact<'Buff'> {
		icon        : string
		buff        : number
		apply_count : number
		duration    : Duration
	}
	interface BuffBriefFact extends BasicFact<'BuffBrief'> {
		text : string
		buff : number
	}
	interface PrefixedBuffBriefFact extends BasicFact<'PrefixedBuffBrief'>{
		icon   : string
		buff   : number
		prefix : number
	}
	interface TimeFact extends BasicFact<'Time'> {
		text     : string
		icon     : string
		duration : Duration;
	}
	interface DistanceFact extends BasicFact<'Distance'> {
		text     : string
		icon     : string
		distance : number
	}
	interface NumberFact extends BasicFact<'Number'> {
		text  : string
		icon  : string
		value : number
	}
	type ComboFieldType = 'Water' | 'Fire' // incomplete
	interface ComboFieldFact extends BasicFact<'ComboField'> {
		text       : string
		icon       : string
		field_type : ComboFieldType
	}
	type ComboFinisherType = "Blast" | "Projectile" // incomplete
	interface ComboFinisherFact extends BasicFact<'ComboFinisher'> {
		text          : string
		icon          : string
		finisher_type : ComboFinisherType
	}
	interface NoDataFact extends BasicFact<'NoData'> {
		text : string
		icon : string
	}
	interface DamageFact extends BasicFact<'Damage'> {
		text           : string
		icon           : string
		hit_count      : number
		dmg_multiplier : number
	}
	interface PercentFact extends BasicFact<'Percent'> {
		text    : string
		icon    : string
		percent : number
	}
	interface AttributeAdjustFact extends BasicFact<'AttributeAdjust'> {
		text                 : string
		icon                 : string
		value                : number
		target               : Capitalize<keyof Stats>,
		attribute_multiplier : number
		level_exponent       : number
		level_multiplier     : number
		hit_count            : number
	}
	interface StunBreakFact extends BasicFact<'StunBreak'> {
		icon  : string
		value : true
	}
	
	type FactMap = {
		Buff              : BuffFact 
		BuffBrief         : BuffBriefFact 
		PrefixedBuffBrief : PrefixedBuffBriefFact
		Time              : TimeFact 
		Distance          : DistanceFact 
		Number            : NumberFact 
		ComboField        : ComboFieldFact 
		ComboFinisher     : ComboFinisherFact 
		NoData            : NoDataFact 
		Damage            : DamageFact 
		Percent           : PercentFact 
		AttributeAdjust   : AttributeAdjustFact 
		StunBreak         : StunBreakFact;
	}

	type FactType = keyof FactMap;
	
	interface RechargeOverride {
		mode     : string
		recharge : Duration
	}

	interface Duration {
		secs  : number
		nanos : number
	}

	interface Trait {
		id                 : number
		icon?              : string
		name               : string
		name_brief?        : string
		description?       : string
		description_brief? : string
		facts              : Fact[]
		slot               : 'Minor' | 'Major' | 'MadLib' | 'Automatic'; //TODO(Rennorb): fix this on the api side lol
		facts_override     : undefined //TODO(Rennorb): not exported yet
	}

	interface Item {
		id : number
		icon : string
		name : string
		//TODO
	}

	interface Specialization {
		id : number
		//TODO
	}

	interface Pet {
		id : number
		icon : string
		name : string
		//TODO
	}

	interface Amulet {
		id : number
		icon : string
		name : string
		//TODO
	}
}

type ObjectDataStorageKeys = `${LegacyCompat.ObjectType}s`

type ObjectDataStorage = {
	[k in ObjectDataStorageKeys] : Map<number, APIResponseTypeMap[k]>
}

type ObjectsToFetch = {
	[k in ObjectDataStorageKeys] : Map<number, HTMLElement[] | undefined>
}

interface HandlerParams<TFact = API.Fact> {
	fact    : TFact
	buff    : (TFact extends { buff : number } ? API.Skill : undefined) | undefined
	skill   : API.Skill
}

//TODO(Rennorb): some of these don't exist yet
type APIResponseTypeMap = {
	skills         : API.Skill;
	traits         : API.Trait;
	items          : API.Item;
	specializations: API.Specialization;
	pets           : API.Pet;
	'pvp/amulets'  : API.Amulet;
}

type Endpoints = keyof APIResponseTypeMap;

type InflatorMap = {
	[k in ObjectDataStorageKeys] : (gw2Object : HTMLElement, data : APIResponseTypeMap[k]) => void
}

interface APIImplementation {
	bulkRequest<T extends Endpoints>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]>;
}