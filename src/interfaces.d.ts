namespace LegacyCompat {
	type ObjectType = 'skill' | 'trait' | 'item' | 'specialization' | 'pet' | 'pvp/amulet' | 'specialization' | 'effect';
}

namespace API {
	type Skill = ContextInformation & {
		id                 : number
		name               : string
		name_brief?        : string
		description?       : string
		description_brief? : string
		icon?              : string
		categories         : any[]
		palettes           : Palette[]
		sub_skills?        : number[]
		modifiers?         : Modifier[]
	}

	type Fact = FactMap[keyof FactMap];

	//TODO(Rennorb) @cleanup: ho over the flag types and decide whether or not the 'none' entry should be included or excluded by default, then stick with one of the two.
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
		profession  : 'None' | Profession
		slot        : `${'Main'|'Offhand'}${1|2|3|4|5}` | `Offhand${1|2}`
			| 'Heal' | 'Standard' | 'Elite'
			| 'Pet' | `Transformation${1|2|3|4|5}`
		prev_chain? : number
		next_chain? : number
	}

	interface ModifierDescriptionOverride {
		profession  : 'None' | Profession
		description : string
	}

	interface Modifier {
		id                    : number
		base_amount           : number
		formula_param1        : number
		formula_param2        : number
		formula               : 'BuffLevelLinear' | 'ConditionDamage' | 'ConditionDamageSquared' | 'CritDamage' | 'CritDamageSquared' | 'BuffFormulaType5' | 'NoScaling' | 'Regeneration' | 'RegenerationSquared' | 'SpawnScaleLinear' | 'TargetLevelLinear' | 'BuffFormulaType11' | 'InfiniteDungeonScale' | 'Power' | 'PowerSquared' | 'BuffFormulaType15'
		attribute?            : Exclude<Attributes, 'None'>
		attribute_conversion? : Exclude<Attributes, 'None'>
		description           : string
		description_override? : ModifierDescriptionOverride[]
		flags                 : ('FormatFraction' | 'FormatPercent' | 'SkipNextEntry' | 'MulByDuration' | 'DivDurationBy3' | 'DivDurationBy10' | 'NonStacking' | 'Subtract')[]
		trait_req?            : number
		mode?                 : GameMode
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

	interface AdjustByAttributeAndLevelHealingFact extends BasicFact<'AdjustByAttributeAndLevelHealing'> {
		text?                : string
		icon?                : string
		value                : number
		target               : Attributes,
		attribute_multiplier : number
		level_exponent       : number
		level_multiplier     : number
		hit_count            : number
	}

	interface AttributeAdjustFact extends BasicFact<'AttributeAdjust'> {
		text?  : string
		icon?  : string
		range  : number[]
		target : Attributes
	}

	interface BuffFact extends BasicFact<'Buff'> {
		text?       : string
		icon?       : string
		buff        : number
		apply_count : number
		duration    : Milliseconds
	}

	interface BuffBriefFact extends BasicFact<'BuffBrief'> {
		text? : string
		buff  : number
	}

	interface DistanceFact extends BasicFact<'Distance'> {
		text?    : string
		icon?    : string
		distance : number
	}

	interface HealthAdjustHealingFact extends BasicFact<'HealthAdjustHealing'> {
		text?      : string
		icon?      : string
		value      : number
		attribute  : Attributes
		multiplier : number
		hit_count  : number
	}

	interface NumberFact extends BasicFact<'Number'> {
		text? : string
		icon? : string
		value : number
	}

	interface PercentFact extends BasicFact<'Percent'> {
		text?   : string
		icon?   : string
		percent : number
	}

	interface PercentDamageFact extends BasicFact<'PercentDamage'> {
		text?   : string
		icon?   : string
		percent : number
	}

	interface PercentLifeForceAdjustFact extends BasicFact<'PercentLifeForceAdjust'> {
		text?   : string
		icon?   : string
		percent : number
	}

	interface PercentHealthFact extends BasicFact<'PercentHealth'> {
		text?   : string
		icon?   : string
		percent : number
	}

	interface LifeForceAdjustFact extends BasicFact<'LifeForceAdjust'> {
		text?   : string
		icon?   : string
		percent : number
	}

	interface DamageFact extends BasicFact<'Damage'> {
		text?          : string
		icon?          : string
		hit_count      : number
		dmg_multiplier : number
	}

	interface TimeFact extends BasicFact<'Time'> {
		text?    : string
		icon?    : string
		duration : Milliseconds;
	}

	type ComboFieldType =
		'Air' | 'Dark' | 'Fire' | 'Ice' | 'Light' |
		'Lightning' | 'Poison' | 'Smoke' | 'Ethereal' | 'Water'

	interface ComboFieldFact extends BasicFact<'ComboField'> {
		text?      : string
		icon?      : string
		field_type : ComboFieldType
	}

	type ComboFinisherType = 'Blast' | 'Leap'  | 'Projectile' | 'Whirl'

	interface ComboFinisherFact extends BasicFact<'ComboFinisher'> {
		text?         : string
		icon?         : string
		finisher_type : ComboFinisherType
	}

	interface BuffConversionFact extends BasicFact<'BuffConversion'> {
		text?   : string
		icon?   : string
		source  : Attributes
		target  : Attributes
		percent : number
	}

	interface NoDataFact extends BasicFact<'NoData'> {
		text?: string
		icon?: string
	}

	interface PrefixedBuffFact extends BasicFact<'PrefixedBuff'>{
		text?       : string
		icon?       : string
		apply_count : number
		buff        : number
		prefix      : number
		duration    : Milliseconds
	}

	interface PrefixedBuffBriefFact extends BasicFact<'PrefixedBuffBrief'>{
		text?  : string
		icon?  : string
		buff   : number
		prefix : number
	}

    // Custom facts
	interface RechargeFact extends BasicFact<'Recharge'> {
		text?    : string
		icon?    : string
		duration : Milliseconds
	}

	interface RangeFact extends BasicFact<'Range'> {
		text? : string
		icon? : string
		min?  : number
		max   : number
	}

	interface StunBreakFact extends BasicFact<'StunBreak'> {
		icon? : string
	}

	type FactMap = {
		AdjustByAttributeAndLevelHealing : AdjustByAttributeAndLevelHealingFact
		AttributeAdjust                  : AttributeAdjustFact
		Buff                             : BuffFact
		BuffBrief                        : BuffBriefFact
		Distance                         : DistanceFact
		HealthAdjustHealing              : HealthAdjustHealingFact
		Number                           : NumberFact
		Percent                          : PercentFact
		PercentDamage                    : PercentDamageFact
		PercentLifeForceAdjust           : PercentLifeForceAdjustFact
		PercentHealth                    : PercentHealthFact
		LifeForceAdjust                  : LifeForceAdjustFact
		Damage                           : DamageFact
		Time                             : TimeFact
		ComboField                       : ComboFieldFact
		ComboFinisher                    : ComboFinisherFact
		BuffConversion                   : BuffConversionFact
		NoData                           : NoDataFact
		PrefixedBuff                     : PrefixedBuffFact
		PrefixedBuffBrief                : PrefixedBuffBriefFact
		// Custom facts
		Recharge                         : RechargeFact
		Range                            : RangeFact
		StunBreak                        : StunBreakFact
	}

	type FactType = keyof FactMap;

	type Trait = ContextInformation & {
		id                 : number
		icon               : string
		name               : string
		name_brief?        : string
		description?       : string
		description_brief? : string
		slot               : 'Minor' | 'Major' | 'MadLib' | 'Automatic'; //TODO(Rennorb): fix this on the api side lol
		provides_weapon_access? : WeaponAccess []
	}

	type ContextInformation = ContextGroup & {
		override_groups? : ({ context : ('Pve' | 'Pvp' | 'Wvw' | 'Any')[] } & ContextGroup)[]
	}

	type ContextGroup = {
		recharge?      : number
		activation?    : number
		resource_cost? : number
		facts?         : Fact[]
	}

	type Item = ItemDetail & ItemBase

	type ItemBase = {
		id             : number
		name           : string
		icon           : string
		rarity         : 'Junk' | 'Basic' | 'Common' | 'Uncommon' | 'Rare' | 'Exotic' | 'Ascended' | 'Legendary'
		flags          : ItemFlag[]
		level          : number
		required_level : number
		description?   : string
		vendor_value   : number
	}

	type ItemFlag = 'AccountBound' | 'Activity' | 'Dungeon' | 'Pve' | 'Pvp' | 'PvpLobby' | 'ItemFlag7' | 'Wvw' | 'GemStore' | 'HideSuffix' | 'MonsterOnly' | 'NoExport' | 'NoMysticForge' | 'NoSalvage' | 'NoSell' | 'NotUpgradeable' | 'SoulbindOnAcquire' | 'ItemFlag18' | 'Unique' | 'DisallowTrader' | 'DisallowUnderwater' | 'ItemFlag22' | 'ItemFlag23' | 'ItemFlag24' | 'ItemFlag25' | 'BulkConsume' | 'ItemFlag27' | 'ItemFlag28' | 'Indestructible' | 'ItemFlag30' | 'ItemFlag31' | 'ItemFlag32';

	type WeaponDetailType = Weapons1H | Weapons2H | 'Polearm' | 'BundleSmall' | 'BundleLarge' | WeaponsAquatic | 'Toy' | 'ToyTwoHanded' | 'None';

	//TODO(Rennorb) @cleanup
	type ItemDetail = ({
		type    : 'Armor'
		defense : ValueOrLutOffset
		subtype : ArmorType
		weight  : 'Clothes' | 'Light' | 'Medium' | 'Heavy'
	} | {
		type    : 'Trinket'
		subtype : TrinketType
	} | {
		type     : 'Weapon'
		power    : [number, number] | {
			//if unset its itemlevel scaling
			scaling? : 'PlayerLevel' | 'PlayerLevelScaleRarity' | 'ItemScale4'
			mul      : number
			spread   : number
		}
		defense? : ValueOrLutOffset
		subtype  : WeaponDetailType
	}) & {
		attribute_base : number
		attribute_set? : number
		slots          : ('Upgrade' | 'Infusion' | 'Enrichment')[]
	} | {
		type  : 'TraitGuide'
		trait : 'todo'
	} | ConsumableDetail | UpgradeComponentDetail

	type ConsumableDetail = {
		type    : 'Consumable'
		subtype : 'AppearanceChange' | 'Booze' | 'ContractNpc' | 'Food' | 'Generic' | 'Halloween' | 'Immediate' | 'Megaphone' | 'TeleportToFriend' | 'Transmutation' | 'Unlock' | 'RandomUnlock' | 'UpgradeRemoval' | 'Utility' | 'MountRandomUnlock' | 'Currency'
		tiers   : {
			description? : string
			facts?       : Fact[]
			modifiers?   : Modifier[]
		}[]
	}

	type UpgradeComponentDetail = {
		type    : 'UpgradeComponent'
		subtype : 'Rune' | 'Sigil' | 'Gem' | 'Default'
		tiers   : {
			description? : string
			facts?       : Fact[]
			modifiers?   : Modifier[]
		}[]
	}

	type ValueOrLutOffset = number | [number, number] //base index, mul

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

type Milliseconds = number;

type ObjectDataStorage = {
	[k in Endpoints] : Map<number, APIResponseTypeMap[k]>
}

type ObjectsToFetch = {
	[k in `${Exclude<LegacyCompat.ObjectType, 'effect'>}s`] : Map<number, HTMLElement[] | undefined>
}

interface HandlerParams<TFact = API.Fact> {
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
	'pvp/amulets'  : API.Amulet;
	itemstats      : API.AttributeSet;
}

type Endpoints = keyof APIResponseTypeMap;

interface APIImplementation {
	bulkRequest<T extends Endpoints>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]>;
}

interface ScopeElement {
	getElementsByTagName(qualifiedName: string) : HTMLCollectionOf<Element>
}