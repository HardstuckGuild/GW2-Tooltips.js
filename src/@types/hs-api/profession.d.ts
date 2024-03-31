namespace API {
	type Profession =  {
		id                : 'Guardian' | 'Warrior' | 'Engineer' | 'Ranger' | 'Thief' | 'Elementalist' | 'Mesmer' | 'Necromancer' | 'Revenant'
		name              : string
		icon              : number
		icon_big          : number
		specializations   : number[]
		skills_by_palette : [number, number][]
		weapons           : { [k in Items.ItemWeapon['subtype']]? : ProfessionWeaponData }
	}

	type ProfessionWeaponData = {
		flags           : ('Mainhand' | 'Offhand' | 'TwoHand' | 'Aquatic')[]
		specialization? : number
		skills          : {
			id         : number
			slot       : SkillSlot
			offhand?   : Weapons1H
			// class the skills was stolen from
			source?    : Profession['id']
			attunement :  'Fire' | 'Earth' | 'Water' | 'Air'
		}[]
	}
}