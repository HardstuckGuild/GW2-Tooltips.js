// This file is meant for anyone who want to have typings for the tooltips.js context structure 
// Defaults for these structures can be found in TooltipsV2.ts

//NOTE(Rennorb): these are separate window objects to allow using just either or.
// Most of the time the only interesting thing will be to set up the context.
declare interface Window {
	GW2TooltipsContext : PartialContext[] | PartialContext | undefined;
	GW2TooltipsConfig  : Config | undefined;
}

type PartialContext = PartialR<Context>

type PartialR<T> = { [P in keyof T]?: (T[P] extends string | number ? T[P] : PartialR<T[P]>) | undefined; }

interface Context {
	gameMode    : GameMode
	targetArmor : number
	character   : Character
}

type GameMode = 'Pve' | 'Pvp' | 'Wvw';

interface Character {
	level    : number
	isPlayer : bool
	sex      : 'Male' | 'Female'
	traits   : number[] //TODO(Rennorb): add a collect function that can take them from existing specialization objects
	stats    : Stats
}

interface Stats {
	power          : number
	toughness      : number
	vitality       : number
	precision      : number
	ferocity       : number
	conditionDamage: number
	expertise      : number
	concentration  : number
	healing        : number
	critDamage     : number
}

interface Config {
	 autoInitialize         : bool
	 adjustIncorrectStatIds : bool
}