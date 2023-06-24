// This file is meant for anyone who want to have typings for the tooltips.js context structure 
// Defaults for these structures can be found in TooltipsV2.ts

//NOTE(Rennorb): these are separate window objects to allow using just either or.
// Most of the time the only interesting thing will be to set up the context.
declare interface Window {
	GW2TooltipsContext : PartialContext[] | PartialContext | undefined;
	GW2TooltipsConfig  : Config | undefined;
}

type PartialContext = Omit<Partial<Context>, 'stats'>  & { stats?: Partial<Stats> }

interface Context {
	traits      : any[] //TODO(Rennorb): specify further. this should be number[] or maybe the traitline ids and up/mid/down choices
	gameMode    : GameMode
	targetArmor : number
	stats       : Stats
}

type GameMode = 'Pve' | 'Pvp' | 'Wvw';

interface Stats {
	level          : number
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