type TypeBridge<T, K extends keyof T> = [K extends number ? string : K, T[K]]
declare interface ObjectConstructor {
	entries<T>(obj : T) : TypeBridge<T, keyof T>[]
}

type Undefined<T> = { [k in keyof T]?: undefined }

namespace LegacyCompat {
	type ObjectType = 'skill' | 'trait' | 'item' | 'specialization' | 'pet' | 'pvp/amulet' | 'specialization' | 'effect';
}

type V2ObjectType = LegacyCompat.ObjectType | 'attribute';

namespace OfficialAPI {
	type AmuletStats = 'AgonyResistance' | 'BoonDuration' | 'ConditionDamage' | 'ConditionDuration' | 'CritDamage' | 'Healing' | 'Power' | 'Precision' | 'Toughness' | 'Vitality';
	type Amulet = {
		id         : number
		name       : string
		icon       : string
		attributes : { [k in AmuletStats] : number }
	}

	type Specialization = {
		id         : number
		name       : string
		icon       : string
		background : string
	}

	type Pet = {
		id          : number
		name        : string
		icon        : string
		description : string
		skills      : { id : number }[]
	}
}

namespace API {
	type Skill = ContextInformation & {
		id                 : number
		name               : string
		name_brief?        : string
		description?       : string
		description_brief? : string
		icon?              : string | number // TODO: move to using numbers
		categories         : any[]
		palettes           : Palette[]
		related_skills?    : number[]
		modifiers?         : Modifier[]
		buff_type?         : 'Boon' | 'Buff' | 'Condition' | 'Finisher' | 'Food' | 'Guild' | 'Item' | 'Persistent' | 'Purchased' | 'Species' | 'Training' | 'Trait' | 'Transformation' | 'Utility' | 'Wvw' | 'BuffType16' | 'BuffType17' | 'Realtime'
	}

	type Fact = FactMap[keyof FactMap];

	type ArmorType      = 'HelmAquatic' | 'Helm' | 'Shoulders' | 'Coat' | 'Gloves' | 'Leggings' | 'Boots';
	type TrinketType    = 'Amulet' | 'Ring' | 'Accessory' | 'Backpiece';
	type Weapons1H      = 'Focus' | 'Shield' | 'Torch' | 'Warhorn' | 'BowShort' | 'Axe' | 'Sword' | 'Dagger' | 'Pistol' | 'Scepter' | 'Mace';
	type Weapons2H      = 'Greatsword' | 'Hammer' | 'Staff' | 'BowLong' | 'Rifle';
	type WeaponsAquatic = 'Spear' | 'Trident' | 'Speargun';

	interface Palette {
		id          : number
		type        : 'Standard' | 'Toolbelt' | 'Bundle' | 'Equipment' | 'Heal' | 'Elite' | 'Profession' | 'Monster' | 'Transformation' | 'Pet'
		weapon_type?: 'Standard' | 'BundleLarge' | Weapons1H | Weapons2H | WeaponsAquatic
		slots       : Slot[]
	}

	interface Slot {
		profession?           : Profession
		slot                  : `${'Main'|'Offhand'}${1|2|3|4|5}` | `Offhand${1|2}`
			| 'Heal' | 'Standard' | 'Elite'
			| 'Pet' | `Transformation${1|2|3|4|5}`
		prev_chain?           : number
		next_chain?           : number
		traited_alternatives? : [number, number][]
	}

	interface ModifierDescriptionOverride {
		profession  : Profession
		description : string
	}

	interface Modifier {
		id                         : number
		base_amount                : number
		formula_param1             : number
		formula_param2             : number
		formula                    : 'BuffLevelLinear' | 'ConditionDamage' | 'ConditionDamageSquared' | 'CritDamage' | 'CritDamageSquared' | 'BuffFormulaType5' | 'NoScaling' | 'Regeneration' | 'RegenerationSquared' | 'SpawnScaleLinear' | 'TargetLevelLinear' | 'BuffFormulaType11' | 'InfiniteDungeonScale' | 'Power' | 'PowerSquared' | 'BuffFormulaType15' //TODO(Rennorb) @rename critdamage
		target_attribute_or_skill? : BaseAttribute | number | 'Armor' | 'Damage' | 'LifeForce' | 'Health' | 'HealEffectiveness' | `${'Boon'|'Condition'}Duration`
		source_attribute?          : BaseAttribute
		description                : string
		description_override?      : ModifierDescriptionOverride[]
		flags                      : ('FormatFraction' | 'FormatPercent' | 'SkipNextEntry' | 'MulByDuration' | 'DivDurationBy3' | 'DivDurationBy10' | 'NonStacking' | 'Subtract')[]
		trait_req?                 : number
		mode?                      : GameMode
	}


	interface BasicFact<Type extends keyof FactMap> {
		type            : Type
		icon            : string
		text?           : string
		order           : number
		requires_trait? : number[]
		defiance_break? : number
		insert_before?  : number
		skip_next?      : number
		__gamemode_override_marker? : true
	}

	type HealingOrBarrierFact = BasicFact<'HealingOrBarrier'> & {
		value                : number
		level_exponent       : number
		level_multiplier     : number
		hit_count            : number
	} & (AttributeScaling | Undefined<AttributeScaling>)

	type AttributeScaling = {
		attribute            : BaseAttribute,
		attribute_multiplier : number
	}

	interface AttributeAdjustFact extends BasicFact<'AttributeAdjust'> {
		range  : number[]
		target : BaseAttribute
	}

	interface BuffFact extends BasicFact<'Buff'> {
		buff        : number
		apply_count : number
		duration    : Milliseconds
	}

	interface BuffBriefFact extends BasicFact<'BuffBrief'> {
		buff  : number
	}

	interface DistanceFact extends BasicFact<'Distance'> {
		distance : number
	}

	interface NumberFact extends BasicFact<'Number'> {
		value : number
	}

	interface PercentFact extends BasicFact<'Percent' | 'PercentDamage' | 'PercentHealth' | 'PercentLifeForceCost' | 'PercentLifeForceGain'> {
		percent : number
	}

	interface DamageFact extends BasicFact<'Damage'> {
		hit_count      : number
		dmg_multiplier : number
	}

	interface TimeFact extends BasicFact<'Time'> {
		duration : Milliseconds;
	}

	type ComboFieldType =
		'Air' | 'Dark' | 'Fire' | 'Ice' | 'Light' |
		'Lightning' | 'Poison' | 'Smoke' | 'Ethereal' | 'Water'

	interface ComboFieldFact extends BasicFact<'ComboField'> {
		field_type : ComboFieldType
	}

	type ComboFinisherType = 'Blast' | 'Leap'  | 'Projectile' | 'Projectile20' | 'Whirl'

	interface ComboFinisherFact extends BasicFact<'ComboFinisher'> {
		finisher_type : ComboFinisherType
	}

	interface AttributeConversionFact extends BasicFact<'AttributeConversion'> {
		source  : BaseAttribute
		target  : BaseAttribute
		percent : number
	}

	interface NoDataFact extends BasicFact<'NoData'> {
		text : never
	}

	interface PrefixedBuffFact extends BasicFact<'PrefixedBuff'>{
		apply_count : number
		buff        : number
		prefix      : number
		duration    : Milliseconds
	}

	interface PrefixedBuffBriefFact extends BasicFact<'PrefixedBuffBrief'>{
		buff   : number
		prefix : number
	}

	// Custom facts
	interface RangeFact extends BasicFact<'Range'> {
		min?  : number
		max   : number
	}

	interface StunBreakFact extends BasicFact<'StunBreak'> {
		text : never
	}

	type FactMap = {
		HealingOrBarrier                 : HealingOrBarrierFact
		AttributeAdjust                  : AttributeAdjustFact
		Buff                             : BuffFact
		BuffBrief                        : BuffBriefFact
		Distance                         : DistanceFact
		Number                           : NumberFact
		Percent                          : PercentFact
		PercentDamage                    : PercentFact
		PercentHealth                    : PercentFact
		PercentLifeForceCost             : PercentFact
		PercentLifeForceGain             : PercentFact
		Damage                           : DamageFact
		Time                             : TimeFact
		ComboField                       : ComboFieldFact
		ComboFinisher                    : ComboFinisherFact
		AttributeConversion                   : AttributeConversionFact
		NoData                           : NoDataFact
		PrefixedBuff                     : PrefixedBuffFact
		PrefixedBuffBrief                : PrefixedBuffBriefFact
		// Custom facts
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
		modifiers?         : Modifier[]
		related_skills?    : number[]
		specialization?    : number
	}

	type ContextInformation = ContextGroup & {
		override_groups? : ({ context : ('Pve' | 'Pvp' | 'Wvw' | 'Any')[] } & ContextGroup)[]
	}

	type ContextGroup = {
		recharge?       : number
		activation?     : number
		resource_cost?  : number
		endurance_cost? : number
		supply_cost?    : number
		upkeep_cost?    : number
		blocks?         : FactBlock[]
	}

	type FactBlock = {
		trait_requirements? : number[]
		description?        : string
		facts?              : Fact[]
	}

	type Item = (ItemBase & ItemDetail) | ItemAmulet | ItemUpgradeComponent | ItemConsumable | ItemRelic

	type ItemBase = {
		id             : number
		name           : string
		icon           : string
		rarity         : 'Junk' | 'Basic' | 'Common' | 'Uncommon' | 'Rare' | 'Exotic' | 'Ascended' | 'Legendary'
		flags          : ItemFlag[]
		level          : number
		required_level : number
		description?   : string
		vendor_value?  : number
	}

	type ItemFlag = 'AccountBound' | 'Activity' | 'Dungeon' | 'Pve' | 'Pvp' | 'PvpLobby' | 'WvwLobby' | 'Wvw' | 'GemStore' | 'HideSuffix' | 'MonsterOnly' | 'NoExport' | 'NoMysticForge' | 'NoSalvage' | 'NoSell' | 'NotUpgradeable' | 'SoulBindOnAcquire' | 'SoulBindOnUse' | 'Unique' | 'DisallowTrader' | 'DisallowUnderwater' | 'ItemFlag22' | 'AccountBindOnUse' | 'ItemFlag24' | 'ItemFlag25' | 'BulkConsume' | 'ItemFlag27' | 'BoosterEquipment' | 'Indestructible' | 'ItemFlag30' | 'ItemFlag31' | 'ItemFlag32' | 'ItemFlagEx1' | 'SalvageResearch' | 'ItemFlagEx3' | 'ItemFlagEx4' | 'ItemFlagEx5';

	type WeaponDetailType = Weapons1H | Weapons2H | 'Polearm' | 'BundleSmall' | 'BundleLarge' | WeaponsAquatic | 'Toy' | 'ToyTwoHanded';

	//TODO(Rennorb) @cleanup
	type ItemDetail = ({
		type    : 'Armor'
		defense : ValueOrLutOffset
		subtype : ArmorType
		weight  : 'Clothes' | 'Light' | 'Medium' | 'Heavy'
		skin    : number
	} | {
		type    : 'Trinket'
		subtype : TrinketType
		skin?   : number
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
		damage_type? : 'Choking' | 'Falling' | 'Fire' | 'Ice' | 'Lightning' | 'Physical' | 'SiegeAntiDoor' | 'SiegeAntiSiege' | 'SiegeAntiWall',
		skin     : number
	}) & ItemStatSource | {
		type  : 'TraitGuide'
		trait : 'todo'
	}

	type ItemStatSource = {
		attribute_base : number
		attribute_set? : number
		slots          : ('Upgrade' | 'Infusion' | 'Enrichment')[]
	}

	type ItemAmulet = ItemBase & {
		type           : 'Trinket'
		subtype        : 'Amulet'
		attribute_base : 1000
		attribute_set  : number
	}

	type ItemConsumable = ItemBase & ({
		type    : 'Consumable'
		subtype : 'AppearanceChange' | 'Booze' | 'ContractNpc' | 'Generic' | 'Halloween' | 'Immediate' | 'Megaphone' | 'TeleportToFriend' | 'Transmutation' | 'Unlock' | 'RandomUnlock' | 'UpgradeRemoval' |  'MountRandomUnlock' | 'Currency'
	} | {
		type         : 'Consumable'
		subtype      : 'Utility' | 'Food'
		applies_buff : BuffFact
	})

	type ItemRelic = ItemBase & {
		type           : 'Relic'
		related_skills : number[]
	}

	type ItemUpgradeComponent = ItemBase & {
		type    : 'UpgradeComponent'
		subtype : 'Rune' | 'Sigil' | 'Gem' | 'Infusion' | 'Enrichment'
		tiers   : {
			description? : string
			facts?       : Fact[]
			modifiers?   : Modifier[]
		}[]
	}

	type ValueOrLutOffset = number | [number, number] //base index, mul

	interface AttributeSet {
		id         : number
		name       : string
		attributes : {
			attribute  : BaseAttribute
			base_value : number
			scaling    : number
		}[]
		similar_sets? : {
			[attribute in ItemDetail['subtype']]?: number
		}
	}

	interface Pet {
		id               : number
		name             : string
		icon             : string
		description      : string
		skills           : number[]
		skills_ai        : number[] //not yet available
		skills_soulbeast : number[]
	}
}

type Milliseconds = number;

type ObjectDataStorage = {
	[k in Endpoints] : Map<number, APIResponseTypeMap[k]>
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
	specializations: OfficialAPI.Specialization;
	pets           : API.Pet;
	'pvp/amulets'  : API.ItemAmulet;
	itemstats      : API.AttributeSet;
}

type Endpoints = keyof APIResponseTypeMap;

interface APIImplementation {
	bulkRequest<T extends Endpoints>(endpoint : T, ids : number[]) : Promise<APIResponseTypeMap[T][]>;
}

interface ScopeElement {
	getElementsByTagName(qualifiedName: string) : HTMLCollectionOf<Element>
	querySelectorAll<E extends Element = Element>(selectors : string) : NodeListOf<E>
}
