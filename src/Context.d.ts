// This file is meant for anyone who want to have typings for the tooltips.js context structure 
// Defaults for these structures can be found in TooltipsV2.ts

//NOTE(Rennorb): these are separate window objects to allow using just either or.
// Most of the time the only interesting thing will be to set up the context.
declare interface Window {
	GW2TooltipsContext : PartialContext[] | PartialContext | undefined;
	GW2TooltipsConfig  : Config | undefined;
	gw2tooltips        : GW2TooltipsV2
}

type PartialContext = PartialR<Context>

type PartialR<T> = { [P in keyof T]?: (T[P] extends string | number | StatSource ? T[P] : PartialR<T[P]>) | undefined; }

interface Context {
	gameMode    : GameMode
	targetArmor : number
	character   : Character
}

type GameMode = 'Pve' | 'Pvp' | 'Wvw';

interface Character {
	level         : number
	isPlayer      : bool
	sex           : 'Male' | 'Female'
	traits        : number[] //TODO(Rennorb): add a collect function that can take them from existing specialization objects
	stats         : Stats
	statSources   : { [k in keyof Stats]: StatSource[] }
	upgradeCounts : UpgradeCounts
}

interface Stats {
	power         : number
	toughness     : number
	vitality      : number
	precision     : number
	ferocity      : number
	conditionDmg  : number
	expertise     : number
	concentration : number
	healing       : number
	critDamage    : number
}

//TODO(Rennorb) @cleanup: is splitting this really necessary?
interface UpgradeCounts {
	// Capitalized to match enum names
	Rune     : { [k : number]: number }
	Default : { [k : number]: number }
}

interface StatSource {
	amount : number
	type   : 'Flat' | 'Percent'
	source : string
}



interface Config {
	 autoInitialize         : bool
	 // only works if auto initialize is turned on
	 autoCollectRuneCounts  : bool
	 // only works if auto initialize is turned on
	 autoCollectStatSources : bool
	 // only works if auto initialize is turned on
	 autoInferEquipmentUpgrades : bool
	 adjustIncorrectStatIds : bool
	 legacyCompatibility    : bool

	 apiImpl?               : () => APIImplementation
}