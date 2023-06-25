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
		facts              : Fact[]
		facts_override?    : FactsOverride[]
		categories         : any[]
		palettes           : Palette[]
		sub_skills?        : number[]
		modifiers?         : Modifier[]
	}

	type Fact = FactMap[keyof FactMap];

	interface FactsOverride {
		mode  : string
		facts : Fact[]
	}

	type Attributes = 'None' | Capitalize<Exclude<keyof Stats, 'level'>>;
	type ArmorType  = 'HelmAquatic' | 'Helm' | 'Shoulders' | 'Coat' | 'Gloves' | 'Leggings' | 'Boots';
	type TrinketType = 'Amulet' | 'Ring' | 'Accessory' | 'Backpiece';
	type Weapons1H = 'Focus' | 'Shield' | 'Torch' | 'Warhorn' | 'BowShort' | 'Axe' | 'Sword' | 'Dagger' | 'Pistol' | 'Scepter' | 'Mace';
	type Weapons2H = 'Greatsword' | 'Hammer' | 'Staff' | 'BowLong' | 'Rifle';
	type WeaponsAquatic = 'Spear' | 'Trident' | 'Speargun';

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


	interface BasicFact<Type extends keyof FactMap> {
		type            : Type
		order           : number
		requires_trait? : number[]
		defiance_break? : number
		overrides?      : number
	
		//NOTE(Rennorb): This is here so we can just use `Fact.buff` and similar. Otherwise ts wont like us calling that on the `Fact` union because the prop doesn't exist on some of the constituents.
		[k : string] : undefined 
	}
	
	interface BuffFact extends BasicFact<'Buff'> {
		icon?       : string
		buff        : number
		apply_count : number
		duration    : Duration
	}
	interface BuffBriefFact extends BasicFact<'BuffBrief'> {
		text : string
		buff : number
	}
	interface BuffConversionFact extends BasicFact<'BuffConversion'> {
		text?   : string
    icon?   : string
    source  : Attributes
    target  : Attributes
    percent : number
	}
	interface PrefixedBuffFact extends BasicFact<'PrefixedBuff'>{
    text?       : string
    icon?       : string
    apply_count : number
    buff        : number
    prefix      : number
    duration    : Duration
	}
	interface PrefixedBuffBriefFact extends BasicFact<'PrefixedBuffBrief'>{
		text?  : string
		icon?  : string
		buff   : number
		prefix : number
	}
	interface RadiusFact extends BasicFact<'Radius'> {
		text  : string
		icon? : string
		value : number
	}
	interface RangeFact extends BasicFact<'Range'> {
		text  : string
		icon? : string
		value : number
	}
	interface RechargeFact extends BasicFact<'Recharge'> {
		text  : string
		icon? : string
		value : Duration
	}
	interface TimeFact extends BasicFact<'Time'> {
		text     : string
		icon?    : string
		duration : Duration;
	}
	interface DistanceFact extends BasicFact<'Distance'> {
		text     : string
		icon?    : string
		distance : number
	}
	interface DurationFact extends BasicFact<'Duration'> {
		text?    : string
		icon?    : string
		duration : Duration
	}
	interface NumberFact extends BasicFact<'Number'> {
		text  : string
		icon? : string
		value : number
	}
	type ComboFieldType = 'Water' | 'Fire' // incomplete
	interface ComboFieldFact extends BasicFact<'ComboField'> {
		text       : string
		icon?      : string
		field_type : ComboFieldType
	}
	type ComboFinisherType = "Blast" | "Projectile" // incomplete
	interface ComboFinisherFact extends BasicFact<'ComboFinisher'> {
		text          : string
		icon?         : string
		finisher_type : ComboFinisherType
	}
	interface HealingAdjustFact extends BasicFact<'HealingAdjust'> {
    text?      : string
    icon?      : string
    value      : number
    attribute  : Attributes
    multiplier : number
    hit_count  : number
	}
	interface NoDataFact extends BasicFact<'NoData'> {
		text : string
		icon?: string
	}
	interface DamageFact extends BasicFact<'Damage'> {
		text           : string
		icon?          : string
		hit_count      : number
		dmg_multiplier : number
	}
	interface PercentFact extends BasicFact<'Percent'> {
		text    : string
		icon?   : string
		percent : number
	}
	interface AttributeAdjustFact extends BasicFact<'AttributeAdjust'> {
		text?                : string
		icon?                : string
		value                : number
		target               : Attributes,
		attribute_multiplier : number
		level_exponent       : number
		level_multiplier     : number
		hit_count            : number
	}
	interface StunBreakFact extends BasicFact<'StunBreak'> {
		icon? : string
		value : true
	}
	
	type FactMap = {
		AttributeAdjust   : AttributeAdjustFact
		Buff              : BuffFact
		BuffBrief         : BuffBriefFact
		BuffConversion    : BuffConversionFact
		ComboField        : ComboFieldFact
		ComboFinisher     : ComboFinisherFact
		Damage            : DamageFact
		Distance          : DistanceFact
		Duration          : DurationFact
		Heal              : BasicFact<'Heal'>
		HealingAdjust     : HealingAdjustFact
		NoData            : NoDataFact
		Number            : NumberFact
		Percent           : PercentFact
		PrefixedBuff      : PrefixedBuffFact
		PrefixedBuffBrief : PrefixedBuffBriefFact
		Radius            : RadiusFact
		Range             : RangeFact
		Recharge          : RechargeFact
		StunBreak         : StunBreakFact
		Time              : TimeFact
		Unblockable       : BasicFact<'Unblockable'>
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
		provides_weapon_access? : WeaponAccess []
	}

	type Item = ItemDetail & {
		id             : number
		name           : string
		icon           : string
		rarity         : 'Junk' | 'Basic' | 'Common' | 'Uncommon' | 'Rare' | 'Exotic' | 'Ascended' | 'Legendary'
		flags          : ItemFlag[]
		required_level : number
		description?   : string
		vendor_value   : number
	}

	type ItemFlag = 'AccountBound' | 'Activity' | 'Dungeon' | 'Pve' | 'Pvp' | 'PvpLobby' | 'ItemFlag7' | 'Wvw' | 'GemStore' | 'HideSuffix' | 'MonsterOnly' | 'NoExport' | 'NoMysticForge' | 'NoSalvage' | 'NoSell' | 'NotUpgradeable' | 'SoulbindOnAcquire' | 'ItemFlag18' | 'Unique' | 'DisallowTrader' | 'DisallowUnderwater' | 'ItemFlag22' | 'ItemFlag23' | 'ItemFlag24' | 'ItemFlag25' | 'BulkConsume' | 'ItemFlag27' | 'ItemFlag28' | 'Indestructible' | 'ItemFlag30' | 'ItemFlag31' | 'ItemFlag32';

	type WeaponDetailType = Weapons1H | Weapons2H | 'Polearm' | 'BundleSmall' | 'BundleLarge' | WeaponsAquatic | 'Toy' | 'ToyTwoHanded' | 'None';

	type ItemDetail = ({
		type    : 'Armor'
		defense : number
		subtype : ArmorType
		weight  : 'Clothes' | 'Light' | 'Medium' | 'Heavy'
	} | {
		type    : 'Trinket'
		subtype : TrinketType
	} | {
		type    : 'Weapon'
		power   : [number, number]
		subtype : WeaponDetailType
	}) & ItemStatData | {
		type  : 'TraitGuide'
		trait : 'todo'
	}

	type ItemStatData = {
		attribute_base? : number
		attribute_set?  : number
	}

	interface Specialization {
		id         : number
		name       : string
		icon       : string
		background : string
		//TODO
	}

	interface Pet {
		id : number
		icon : string
		name : string
		//TODO
	}

	interface Amulet {
		id    : number
		icon  : string
		name  : string
		facts : AttributeAdjustFact[]
	}

	interface AttributeSet {
		id         : number
		name       : string
		attributes : { 
			attribute  : Exclude<Attributes, 'None'>
			base_value : number
			scaling    : number
		}[]
		similar_sets? : {
			[attribute in ItemDetail['subtype']]?: number
		}
	}
}

type ObjectDataStorage = {
	[k in Endpoints] : Map<number, APIResponseTypeMap[k]>
}

type ObjectsToFetch = {
	[k in `${LegacyCompat.ObjectType}s`] : Map<number, HTMLElement[] | undefined>
}

interface HandlerParams<TFact = API.Fact> {
	fact    : TFact
	buff    : (TFact extends { buff : number } ? API.Skill : undefined) | undefined
	skill   : API.Skill | API.Trait & { [k : string] : undefined  } //to allow for conditional chaining for unknown props. 
}

type APIResponseTypeMap = {
	skills         : API.Skill;
	traits         : API.Trait;
	items          : API.Item;
	specializations: API.Specialization;
	pets           : API.Pet;
	'pvp/amulets'  : API.Amulet;
	itemstats      : API.AttributeSet;
}

type Endpoints = keyof APIResponseTypeMap;

interface APIImplementation {
	bulkRequest<T extends Endpoints>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]>;
}