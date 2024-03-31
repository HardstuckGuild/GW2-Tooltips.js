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
		flags              : ('AimIkEnabled' | 'AllowPlayerControl' | 'AnimateUpperBody' | 'AutoFollow' | 'BasicAttack' | 'BreakStun' | 'ClientCancelable' | 'ControlsTurret' | 'DecalAnchored' | 'DoNotReplaceEffect' | 'GroundFastCast' | 'GroundIgnoreLos' | 'GroundTargeted' | 'HideLeftHandWeapon' | 'HideRightHandWeapon' | 'IgnoreEvasionTypeExtreme' | 'IgnoreEvasionTypeFly' | 'IgnoreEvasionTypeHop' | 'IgnoreEvasionTypeSidestep' | 'Instant' | 'MultiHit' | 'NonCombat' | 'NotClientCancelable' | 'NotCancelledByMovement' | 'RequiresTarget' | 'UsableAir' | 'UsableLand' | 'UsableOutOfCombat' | 'UsableUnderWater' | 'UsableWaterSurface' | 'NoTarget' | 'SkillFlag32')[] //TODO(Rennorb) @cleanup: filter out flags that are unknown on the server.
	}
}