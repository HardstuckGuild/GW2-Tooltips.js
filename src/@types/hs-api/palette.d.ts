namespace API {
	type SkillSlot = `Weapon_${1|2|3|4|5}` | 'Heal' | 'Utility' | 'Elite' | 'Pet' | `Profession_${1|2|3|4|5}` | `Transformation_${1|2|3|4|5|6|7|8|9}` | 'Gathering' | 'MountSummon' | 'Reaction'



	type Palette = {
		id          : number
		type        : 'Standard' | 'Toolbelt' | 'Bundle' | 'Equipment' | 'Heal' | 'Elite' | 'Profession' | 'Monster' | 'Transformation' | 'Pet'
		weapon_type?: 'Standard' | 'BundleLarge' | Weapons1H | Weapons2H | WeaponsAquatic
		groups      : SlotGroup[]
	}

	type SlotGroup = {
		profession? : Profession['id']
		slot        : SkillSlot
		candidates  : SkillInfo[]
	}

	type SkillInfo = {
		skill               : number
		min_level?          : number
		usability           : ('UsableAir' | 'UsableLand' | 'UsableUnderWater' | 'UsableWaterSurface')[]
		weapon_mainhand?    : 'Standard' | 'BundleLarge' | Weapons1H | Weapons2H | WeaponsAquatic
		weapon_offhand?     : 'Standard' | 'BundleLarge' | Weapons1H
		profession_state?   : ProfessionState
		profession_state_2? : ProfessionState
		specialization?     : number
		trait?              : number
		buff?               : number
		previous_chain_skill_index? : number
	}
}