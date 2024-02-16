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


namespace API {
	type Skill = ContextInformation & {
		id                 : number
		name               : string
		name_brief?        : string
		description?       : string
		description_brief? : string
		icon?              : number
		categories         : any[]
		palettes           : number[]
		related_skills?    : number[]
		ambush_skills?     : { id: number, spec? : number }[]
		bundle_skills?     : number[]
		bundle_item?       : number
		modifiers?         : Modifier[]
		buff_type?         : 'Boon' | 'Buff' | 'Condition' | 'Finisher' | 'Food' | 'Guild' | 'Item' | 'Persistent' | 'Purchased' | 'Species' | 'Training' | 'Trait' | 'Transformation' | 'Utility' | 'Wvw' | 'BuffType16' | 'BuffType17' | 'Realtime'
		flags              : ('AimIkEnabled' | 'AllowPlayerControl' | 'AnimateUpperBody' | 'AutoFollow' | 'BasicAttack' | 'BreakStun' | 'ClientCancelable' | 'ControlsTurret' | 'DecalAnchored' | 'DoNotReplaceEffect' | 'GroundFastCast' | 'GroundIgnoreLos' | 'GroundTargeted' | 'HideLeftHandWeapon' | 'HideRightHandWeapon' | 'IgnoreEvasionTypeExtreme' | 'IgnoreEvasionTypeFly' | 'IgnoreEvasionTypeHop' | 'IgnoreEvasionTypeSidestep' | 'Instant' | 'MultiHit' | 'NonCombat' | 'NotClientCancelable' | 'SkillFlag24' | 'RequiresTarget' | 'UsableAir' | 'UsableLand' | 'UsableOutOfCombat' | 'UsableUnderWater' | 'UsableWaterSurface' | 'NoTarget' | 'SkillFlag32')[] //TODO(Rennorb) @cleanup: filter out flags that are unknown on the server.
	}

	type Fact = FactMap[keyof FactMap];

	type ArmorType      = 'HelmAquatic' | 'Helm' | 'Shoulders' | 'Coat' | 'Gloves' | 'Leggings' | 'Boots';
	type TrinketType    = 'Amulet' | 'Ring' | 'Accessory' | 'Backpiece';
	type Weapons1H      = 'Focus' | 'Shield' | 'Torch' | 'Warhorn' | 'BowShort' | 'Axe' | 'Sword' | 'Dagger' | 'Pistol' | 'Scepter' | 'Mace';
	type Weapons2H      = 'Greatsword' | 'Hammer' | 'Staff' | 'BowLong' | 'Rifle';
	type WeaponsAquatic = 'Spear' | 'Trident' | 'Speargun';

	type SkillSlot = `Weapon_${1|2|3|4|5}` | 'Heal' | 'Utility' | 'Elite' | 'Pet' | `Profession_${1|2|3|4|5}` | `Transformation_${1|2|3|4|5|6|7|8|9}` | 'Gathering' | 'MountSummon' | 'Reaction'

	type Palette = {
		id          : number
		type        : 'Standard' | 'Toolbelt' | 'Bundle' | 'Equipment' | 'Heal' | 'Elite' | 'Profession' | 'Monster' | 'Transformation' | 'Pet'
		weapon_type?: 'Standard' | 'BundleLarge' | Weapons1H | Weapons2H | WeaponsAquatic
		groups      : SlotGroup[]
	}

	type SlotGroup = {
		profession? : ProfessionId
		slot        : SkillSlot
		candidates  : SkillInfo[]
	}

	type SkillInfo = {
		skill               : number
		min_level?          : number
		usability           : ('UsableAir' | 'UsableLand' | 'UsableUnderWater' | 'UsableWaterSurface')[]
		weapon_mainhand?    : 'Standard' | 'BundleLarge' | Weapons1H | Weapons2H | WeaponsAquatic
		weapon_offhand?     : 'Standard' | 'BundleLarge' | Weapons1H
		profession_state?   : ProfessionState
		profession_state_2? : ProfessionState
		specialization?     : number
		trait?              : number
		buff?               : number
		previous_chain_skill_index? : number
	}

	type ProfessionState = 'None'
		| 'ElementalistAttunementFire' | 'ElementalistAttunementWater' | 'ElementalistAttunementAir' | 'ElementalistAttunementEarth'
		| 'EngineerPhotonForge'
		| 'NecromancerShroud'
		| 'WarriorAdrenalineStage1' | 'WarriorAdrenalineStage2' | 'WarriorAdrenalineStage3'
		| 'RangerDruid' | 'RangerDruidCelestialAvatar' | 'RangerSoulbeast'
		| 'RevenantLegendDragon' | 'RevenantLegendAssassin' | 'RevenantLegendDwarf' | 'RevenantLegendDemon' | 'RevenantLegendRenegade' | 'RevenantLegendCentaur' | 'RevenantLegendAlliance'

	type ModifierDescriptionOverride = {
		profession  : Profession
		description : string
	}

	type Modifier = {
		id                         : number
		base_amount                : number
		formula_param1             : number
		formula_param2             : number
		formula                    : 'BuffLevelLinear' | 'ConditionDamage' | 'ConditionDamageSquared' | 'Ferocity' | 'FerocitySquared' | 'BuffFormulaType5' | 'NoScaling' | 'HealingPower' | 'HealingPowerSquared' | 'SpawnScaleLinear' | 'TargetLevelLinear' | 'BuffFormulaType11' | 'InfiniteDungeonScale' | 'Power' | 'PowerSquared' | 'BuffFormulaType15'
		target_attribute_or_skill? : BaseAttribute | number | 'Armor' | 'Damage' | 'LifeForce' | 'Health' | 'HealEffectiveness' | `${'Boon'|'Condition'}Duration`
		source_attribute?          : BaseAttribute
		description                : string
		description_override?      : ModifierDescriptionOverride[]
		flags                      : ('FormatFraction' | 'FormatPercent' | 'SkipNextEntry' | 'MulByDuration' | 'DivDurationBy3' | 'DivDurationBy10' | 'NonStacking' | 'Subtract')[]
		source_trait_req?          : number
		//NOTE(Rennorb): We currently use this for filtering, assuming the target is also the character, just as the source.
		// This isn't quite correct, but good enough for us.
		target_trait_req?          : number
		mode?                      : GameMode
	}


	type BasicFact<Type extends keyof FactMap> = {
		type            : Type
		icon            : number
		text?           : string
		order           : number
		requires_trait? : number[]
		defiance_break? : number
		insert_before?  : number
		skip_next?      : number
		__gamemode_override_marker? : true
	}

	type AdjustByAttributeAndLevelFact = BasicFact<'AdjustByAttributeAndLevel'> & {
		value                : number
		level_exponent       : number
		level_multiplier     : number
		hit_count            : number
	} & (AttributeScaling | Undefined<AttributeScaling>)

	type AttributeScaling = {
		attribute            : BaseAttribute,
		attribute_multiplier : number
	}

	type AttributeAdjustFact = BasicFact<'AttributeAdjust'> & {
		range  : number[]
		target : BaseAttribute
	}

	type BuffFact = BasicFact<'Buff'> & {
		buff        : number
		apply_count : number
		duration    : Milliseconds
	}

	type BuffBriefFact = BasicFact<'BuffBrief'> & {
		buff  : number
	}

	type DistanceFact = BasicFact<'Distance'> & {
		distance : number
	}

	type NumberFact = BasicFact<'Number'> & {
		value : number
	}

	type PercentFact = BasicFact<'Percent' | 'PercentHpSelfDamage' | 'PercentHealth' | 'PercentLifeForceCost' | 'PercentLifeForceGain'> & {
		percent : number
	}

	type DamageFact = BasicFact<'Damage'> & {
		hit_count      : number
		dmg_multiplier : number
	}

	type TimeFact = BasicFact<'Time'> & {
		duration : Milliseconds;
	}

	type ComboFieldType =
		'Air' | 'Dark' | 'Fire' | 'Ice' | 'Light' |
		'Lightning' | 'Poison' | 'Smoke' | 'Ethereal' | 'Water'

	type ComboFieldFact = BasicFact<'ComboField'> & {
		field_type : ComboFieldType
	}

	type ComboFinisherType = 'Blast' | 'Leap'  | 'Projectile' | 'Projectile20' | 'Whirl'

	type ComboFinisherFact = BasicFact<'ComboFinisher'> & {
		finisher_type : ComboFinisherType
	}

	type AttributeConversionFact = BasicFact<'AttributeConversion'> & {
		source  : BaseAttribute
		target  : BaseAttribute
		percent : number
	}

	type NoDataFact = BasicFact<'NoData'> & {
		text : never
	}

	type PrefixedBuffFact = BasicFact<'PrefixedBuff'> & {
		apply_count : number
		buff        : number
		prefix      : number
		duration    : Milliseconds
	}

	type PrefixedBuffBriefFact = BasicFact<'PrefixedBuffBrief'> & {
		buff   : number
		prefix : number
	}

	// Custom facts
	type RangeFact = BasicFact<'Range'> & {
		min?  : number
		max   : number
	}

	type StunBreakFact = BasicFact<'StunBreak'> & {
		text : never
	}

	type FactMap = {
		AdjustByAttributeAndLevel                 : AdjustByAttributeAndLevelFact
		AttributeAdjust                  : AttributeAdjustFact
		Buff                             : BuffFact
		BuffBrief                        : BuffBriefFact
		Distance                         : DistanceFact
		Number                           : NumberFact
		Percent                          : PercentFact
		PercentHpSelfDamage              : PercentFact
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
		icon               : number
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

	type Item = ItemArmor | ItemTrinket | ItemWeapon | ItemTraitGuide | ItemAmulet | ItemUpgradeComponent | ItemConsumable | ItemRelic

	type ItemBase = {
		id             : number
		name           : string
		icon?          : number
		rarity         : 'Junk' | 'Basic' | 'Common' | 'Uncommon' | 'Rare' | 'Exotic' | 'Ascended' | 'Legendary'
		flags          : ItemFlag[]
		access_restrictions : RestrictionFlag[]
		level          : number
		required_level : number
		description?   : string
		vendor_value?  : number
	}

	type ItemStatSource = {
		attribute_base : number
		attribute_set? : number
		slots          : ('Upgrade' | 'Infusion' | 'Enrichment')[]
	}

	type RestrictionFlag = 'Female' | 'Male' | 'Asura' | 'Charr' | 'Human' | 'Norn' | 'Sylvari' | 'Engineer' | 'Elementalist' | 'Guardian' | 'Mesmer' | 'Necromancer' | 'Ranger' | 'Thief' | 'Warrior' | 'Revenant';

	type ItemFlag = 'AccountBound' | 'Activity' | 'Dungeon' | 'Pve' | 'Pvp' | 'PvpLobby' | 'WvwLobby' | 'Wvw' | 'GemStore' | 'HideSuffix' | 'MonsterOnly' | 'NoExport' | 'NoMysticForge' | 'NoSalvage' | 'NoSell' | 'NotUpgradeable' | 'SoulBindOnAcquire' | 'SoulBindOnUse' | 'Unique' | 'DisallowTrader' | 'DisallowUnderwater' | 'ItemFlag22' | 'AccountBindOnUse' | 'ItemFlag24' | 'ItemFlag25' | 'BulkConsume' | 'ItemFlag27' | 'BoosterEquipment' | 'Indestructible' | 'ItemFlag30' | 'ItemFlag31' | 'ItemFlag32' | 'ItemFlagEx1' | 'SalvageResearch' | 'ItemFlagEx3' | 'ItemFlagEx4' | 'ItemFlagEx5';

	type WeaponDetailType = Weapons1H | Weapons2H | 'Polearm' | 'BundleSmall' | 'BundleLarge' | WeaponsAquatic | 'Toy' | 'ToyTwoHanded';

	type ItemArmor = ItemBase & ItemStatSource & {
		type    : 'Armor'
		defense : ValueOrLutOffset
		subtype : ArmorType
		weight  : 'Clothes' | 'Light' | 'Medium' | 'Heavy'
		default_skin : number
	}

	type ItemTrinket = ItemBase & ItemStatSource & {
		type    : 'Trinket'
		subtype : TrinketType
		default_skin? : number
	}

	type DamageType = 'Choking' | 'Falling' | 'Fire' | 'Ice' | 'Lightning' | 'Physical' | 'SiegeAntiDoor' | 'SiegeAntiSiege' | 'SiegeAntiWall';

	type ItemWeapon = ItemBase & ItemStatSource & {
		type     : 'Weapon'
		power    : [number, number] | {
			//if unset its itemlevel scaling
			scaling? : 'PlayerLevel' | 'PlayerLevelScaleRarity' | 'ItemScale4'
			mul      : number
			spread   : number
		}
		defense? : ValueOrLutOffset
		subtype  : WeaponDetailType
		damage_type? : DamageType,
		default_skin : number
	}

	type ItemTraitGuide = ItemBase & {
		type               : 'TraitGuide'
		trait              : number
		cost_gold?         : number
		const_hero_points? : number
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
		type             : 'Relic'
		facts_from_skill : number
		related_skills   : number[]
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

	type AttributeSet = {
		id         : number
		name       : string
		attributes : {
			attribute  : BaseAttribute
			base_value : number
			scaling    : number
		}[]
		similar_sets? : {
			[attribute in (ItemWeapon | ItemTrinket | ItemArmor)['subtype']]?: number
		}
	}

	type Pet = {
		id               : number
		name             : string
		icon             : number
		description      : string
		skills           : number[]
		skills_ai        : number[]
		skills_soulbeast : number[]
	}

	type Specialization = {
		id         : number
		name       : string
		icon       : number
		background : number
	}

	type Profession =  {
		id                : ProfessionId
		name              : string
		icon              : number
		icon_big          : number
		specializations   : number[]
		skills_by_palette : [number, number][]
		weapons           : { [k in WeaponDetailType]? : ProfessionWeaponData }
	}

	type ProfessionWeaponData = {
		flags           : ('Mainhand' | 'Offhand' | 'TwoHand' | 'Aquatic')[]
		specialization? : number
		skills          : {
			id         : number
			slot       : SkillSlot
			offhand?   : Weapons1H
			// class the skills was stolen from
			source?    : ProfessionId
			attunement :  'Fire' | 'Earth' | 'Water' | 'Air'
		}[]
	}

	type Skin = SkinArmor | SkinBack | SkinGatheringTool | SkinWeapon;

	type SkinBase = {
		id                  : number
		name?               : string
		description?        : string
		icon?               : number
		icon_china?         : number
		rarity              : ItemBase['rarity']
		flags               : ('HidePrefix' | 'todo')[]
		access_restrictions : RestrictionFlag[]
	}

	type SkinArmor = SkinBase & {
		type         : 'Armor'
		subtype      : ItemArmor['subtype']
		weight       : ItemArmor['weight']
		dye_channels : [number | null, number | null, number | null, number | null]
	}

	type SkinBack = SkinBase & {
		type         : 'Back'
		subtype      : 'Default' | 'Glider' | 'Cape' | 'Special'
		dye_channels : [number | null, number | null, number | null, number | null]
	}

	type SkinGatheringTool = SkinBase & {
		type     : 'GatheringTool'
		subtype  : 'Foraging' | 'Logging' | 'Mining' | 'Fishing' | 'Bait' | 'Lure'
		skills   : number[] // restrictions on skills not implemented
		speed    : Milliseconds
		duration : Milliseconds
	}

	type SkinWeapon = SkinBase & {
		type    : 'Weapon'
		subtype : ItemWeapon['subtype'] | null
		damage_type : DamageType
		flags_ex : ('HasEmblem' | 'InstanceOwnerOnly' | 'OwnerOnly' | 'OwnerFriendsOnly')[] //TODO(Rennorb) @rename @cleanup
	}
}



type Milliseconds = number;

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
