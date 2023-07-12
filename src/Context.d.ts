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
	statModifier  : AdditionalModifiers
	statSources   : { [k in keyof Stats]: StatSource[] }
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

interface AdditionalModifiers {
	lifeForce            : number
	//TODO(Rennorb): we might need to split this in boon / condi or add another field for that as there are some modes that just generally add +10% boon duration wich don't have a target set
	outgoingBuffDuration : { [buffId : number] : number }
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
	 legacyCompatibility            : bool
	 preferCorrectnessOverExtraInfo : bool

	 apiImpl?                       : () => APIImplementation
}