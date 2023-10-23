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

type PartialR<T> = { [P in keyof T]?: (T[P] extends string | number | StatSource | number[] ? T[P] : PartialR<T[P]>) | undefined; }

interface Context {
	gameMode    : GameMode
	targetArmor : number
	character   : Character
}

//TODO(Rennorb) @cleanup: move down
type GameMode      = 'Pve' | 'Pvp' | 'Wvw';
type Profession    = 'Guardian' | 'Warrior' | 'Engineer' | 'Ranger' | 'Thief' | 'Elementalist' | 'Mesmer' | 'Necromancer' | 'Revenant'
type BaseAttribute = 'Power' | 'Toughness' | 'Vitality' | 'Precision' | 'Ferocity' | 'ConditionDamage' | 'Expertise' | 'Concentration' | 'HealingPower' | 'AgonyResistance'
type ComputedAttribute = 'Health' | 'Armor' | 'ConditionDuration' | 'BoonDuration' | 'CritChance' | 'CritDamage'
type SyntheticAttributes =  'Damage' | 'LifeForce' | 'HealEffectiveness' | 'Stun'

interface Character {
	level             : number
	isPlayer          : bool
	sex               : 'Male' | 'Female'
	profession?       : Profession
	traits            : number[]
	stats             : BaseStats
	statsWithWeapons  : BaseAndComputedStats[]
	selectedWeaponSet : number
	upgradeCounts     : { [k : number]: number }
}

type BaseStats = {
	values  : { [k in BaseAttribute] : number }
	sources : { [k in BaseAttribute | ComputedAttribute | SyntheticAttributes | number]: StatSource[] }
}
type BaseAndComputedStats = {
	values   : { [k in BaseAttribute | ComputedAttribute] : number }
	sources  : { [k in BaseAttribute | ComputedAttribute | SyntheticAttributes | number]: StatSource[] }
	htmlParts: { [k in BaseAttribute | ComputedAttribute] : HTMLElement[] }
}

interface StatSource {
	source   : string
	modifier : API.Modifier
	count    : number
}



interface Config {
	autoInitialize             : bool

	// v-- these only work if auto initialize is turned on
	autoCollectRuneCounts            : bool
	autoCollectStatSources           : bool
	autoCollectSelectedTraits        : bool
	autoInferEquipmentUpgrades       : bool
	autoRecomputeCharacterAttributes : bool
	autoInferWeaponSetAssociation    : bool
	// ^---------------------------

	adjustIncorrectStatIds     : bool
	legacyCompatibility        : bool
	showPreciseAbilityTimings  : bool
	showFactComputationDetail  : bool

	// for replacing the api source. Usually not relevant except for debugging
	apiImpl?                   : (apis : any) => APIImplementation
}
