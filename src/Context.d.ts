// This file is meant for anyone who want to have typings for the tooltips.js context structure 

declare interface Window {
  GW2TooltipsContext : PartialContext[] | PartialContext | undefined;
}

type PartialContext = Omit<Partial<Context>, 'stats'>  & { stats?: Partial<Stats> }

interface Context {
  traits   : any[] //TODO(Rennorb): specify further. this should be number[] or maybe the traitline ids and up/mid/down choices
  gameMode : GameMode
  stats    : Stats
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