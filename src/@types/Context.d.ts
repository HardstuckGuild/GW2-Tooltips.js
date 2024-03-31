// This file is meant for anyone who want to have typings for the tooltips.js context structure
// Defaults for these structures can be found in Constants.ts

//NOTE(Rennorb): these are separate global objects to allow using just either or.
// Most of the time the only interesting thing will be to set up the context.
var GW2TooltipsContext : PartialContext[] | PartialContext | undefined;
var GW2TooltipsConfig  : Config | undefined;
var GW2TooltipsV2      : GW2TooltipsV2

type PartialContext = PartialR<Context>

interface Context {
	gameMode    :  API.GameMode
	underwater  : boolean
	targetArmor : number
	character   : Character
}

interface Character {
	level             : number
	isPlayer          : boolean
	sex               : 'Male' | 'Female'
	profession?       : API.Profession['id']
	traits            : Set<number>
	specializations   : Set<number>
	stats             : BaseStats
	statsWithWeapons  : BaseAndComputedStats[]
	selectedWeaponSet : number
	// mainly used for highting slotted rune tiers in other items
	upgradeCounts     : { [k : number]: number }
}

type BaseStats = {
	values  : { [k in  API.BaseAttribute] : number }
	sources : SourceMap
}
interface BaseAndComputedStats {
	values   : { [k in  API.BaseAttribute |  API.ComputedAttribute] : number }
	sources  : SourceMap
}
type SourceMap = SourceMapStrict & { [k in string]?: StatSource[] }
type SourceMapStrict = { [k in  API.BaseAttribute |  API.ComputedAttribute |  API.SyntheticAttributes]: StatSource[] }

interface StatSource {
	source   : string
	modifier : API.Modifier
	count    : number
}





interface Config {
	autoInitialize             : boolean

	// v-- these only run with `hookDocument`
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
	globalKeyBinds             : boolean

	validateApiResponses       : boolean

	// for replacing the api source. Usually not relevant except for debugging
	apiImpl?                   : (apis : any) => APIImplementation
	// path where the worker script is hosted
	workerPath?                : string
}


interface GW2TooltipsV2 {
	readonly VERSION  : number,
	readonly APICache : APICache,
	readonly config   : Config,
	formatItemName : (item : API.Item | API.Skin, context : Context, skin : API.Skin = EMPTY_SKIN, statSet? : API.AttributeSet | false, upgradeComponent? : { suffix? : string }, stackSize = 1) => string,
	formatCoins    : (amount : number) => HTMLElement,
	showTooltipFor : (objId : number |  API.BaseAttribute |  API.ComputedAttribute, params : AttributeParams | TooltipParams, context : Context, visibleIndex = 0) => void,
	hideTooltip    : () => void,
	hookDocument       : (scope : ScopeElement, _unused? : any) => Promise<GW2ObjectMap>,
	hookDOMSubtreeSlim : (scope : ScopeElement) => Promise<GW2ObjectMap>,
}


type PartialR<T> = { [P in keyof T]?: (T[P] extends string | number | StatSource | number[] ? T[P] : PartialR<T[P]>) | undefined; }