namespace API {
	type Trait = ContextInformation & {
		id                 : number
		icon               : number
		name               : string
		name_brief?        : string
		description?       : string
		description_brief? : string
		slot               : 'Minor' | 'Major' | 'MadLib' | 'Automatic'; //TODO(Rennorb): fix this on the api side lol
		provides_weapon_access? : WeaponAccess [] // todo
		modifiers?         : Modifier[]
		related_skills?    : number[]
		specialization?    : number
	}
}