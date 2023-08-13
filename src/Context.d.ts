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

type GameMode = 'Pve' | 'Pvp' | 'Wvw';
type Profession = 'Guardian' | 'Warrior' | 'Engineer' | 'Ranger' | 'Thief' | 'Elementalist' | 'Mesmer' | 'Necromancer' | 'Revenant'

interface Character {
	level         : number
	isPlayer      : bool
	sex           : 'Male' | 'Female'
	profession?   : Profession
	traits        : number[] //TODO(Rennorb): add a collect function that can take them from existing specialization objects
	stats         : Stats
	statSources   : { [k in keyof Stats | number | 'damage' | 'lifeForce' | 'health' | 'healEffectiveness' | 'stun']: StatSource[] } //TODO(Rennorb): think about moving this into a single (or two) values per stat. just to reduce computations
	upgradeCounts : { [k : number]: number }
}

interface Stats {
	power           : number
	toughness       : number
	vitality        : number
	precision       : number
	ferocity        : number
	conditionDmg    : number
	expertise       : number
	concentration   : number
	healing         : number
	critDamage      : number
	agonyResistance : number
}

interface StatSource {
	source   : string
	modifier : API.Modifier
	count    : number
}



interface Config {
	autoInitialize                 : bool
	// only works if auto initialize is turned on
	autoCollectRuneCounts          : bool
	// only works if auto initialize is turned on
	autoCollectStatSources         : bool
	// only works if auto initialize is turned on
	autoCollectSelectedTraits      : bool
	// only works if auto initialize is turned on
	autoInferEquipmentUpgrades     : bool
	adjustIncorrectStatIds         : bool
	adjustTraitedSkillIds          : bool
	legacyCompatibility            : bool
	preferCorrectnessOverExtraInfo : bool

	apiImpl?                       : (apis : any) => APIImplementation
}