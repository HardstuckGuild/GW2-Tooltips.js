// This file is meant for anyone who want to have typings for the tooltips.js context structure
// Defaults for these structures can be found in TooltipsV2.ts

//NOTE(Rennorb): these are separate window objects to allow using just either or.
// Most of the time the only interesting thing will be to set up the context.
declare interface Window {
	GW2TooltipsContext : PartialContext[] | PartialContext | undefined;
	GW2TooltipsConfig  : Config | undefined;
	GW2TooltipsV2      : GW2TooltipsV2
}

type PartialContext = PartialR<Context>

interface Context {
	gameMode    : GameMode
	underwater  : boolean
	targetArmor : number
	character   : Character
}

interface Character {
	level             : number
	isPlayer          : boolean
	sex               : 'Male' | 'Female'
	profession?       : ProfessionId
	traits            : Set<number>
	specializations   : Set<number>
	stats             : BaseStats
	statsWithWeapons  : BaseAndComputedStats[]
	selectedWeaponSet : number
	// mainly used for highting slotted rune tiers in other items
	upgradeCounts     : { [k : number]: number }
}

type BaseStats = {
	values  : { [k in BaseAttribute] : number }
	sources : SourceMap
}
interface BaseAndComputedStats {
	values   : { [k in BaseAttribute | ComputedAttribute] : number }
	sources  : SourceMap
}
type SourceMap = SourceMapStrict & { [k in string]: StatSource[] }
type SourceMapStrict = { [k in BaseAttribute | ComputedAttribute | SyntheticAttributes]: StatSource[] }

interface StatSource {
	source   : string
	modifier : API.Modifier
	count    : number
}

type GameMode            = 'Pve' | 'Pvp' | 'Wvw';
type ProfessionId        = 'Guardian' | 'Warrior' | 'Engineer' | 'Ranger' | 'Thief' | 'Elementalist' | 'Mesmer' | 'Necromancer' | 'Revenant'
type BaseAttribute       = 'Power' | 'Toughness' | 'Vitality' | 'Precision' | 'Ferocity' | 'ConditionDamage' | 'Expertise' | 'Concentration' | 'HealingPower' | 'AgonyResistance'
type ComputedAttribute   = 'Health' | 'Armor' | 'ConditionDuration' | 'BoonDuration' | 'CritChance' | 'CritDamage'
type SyntheticAttributes = 'Damage' | 'LifeForce' | 'HealEffectiveness' | 'Stun'

interface Config {
	autoInitialize             : boolean

	// v-- these only work if auto initialize is turned on //TODO(Rennorb) @correctness
	autoCollectRuneCounts            : boolean
	autoCollectStatSources           : boolean
	autoCollectSelectedTraits        : boolean
	autoInferEquipmentUpgrades       : boolean
	autoRecomputeCharacterAttributes : boolean
	autoInferWeaponSetAssociation    : boolean
	// ^---------------------------

	adjustIncorrectStatIds     : boolean
	legacyCompatibility        : boolean
	showPreciseAbilityTimings  : boolean
	showFactComputationDetail  : boolean

	validateApiResponses       : boolean

	// for replacing the api source. Usually not relevant except for debugging
	apiImpl?                   : (apis : any) => APIImplementation
	// path where the worker script is hosted
	workerPath?                : string
}



type PartialR<T> = { [P in keyof T]?: (T[P] extends string | number | StatSource | number[] ? T[P] : PartialR<T[P]>) | undefined; }