type Milliseconds = number;

namespace API {
	type GameMode            = 'Pve' | 'Pvp' | 'Wvw';
	type BaseAttribute       = 'Power' | 'Toughness' | 'Vitality' | 'Precision' | 'Ferocity' | 'ConditionDamage' | 'Expertise' | 'Concentration' | 'HealingPower' | 'AgonyResistance'
	type ComputedAttribute   = 'Health' | 'Armor' | 'ConditionDuration' | 'BoonDuration' | 'CritChance' | 'CritDamage'
	type SyntheticAttributes = 'Damage' | 'LifeForce' | 'HealEffectiveness' | 'Stun'

	type ComboFieldType = 'Air' | 'Dark' | 'Fire' | 'Ice' | 'Light' | 'Lightning' | 'Poison' | 'Smoke' | 'Ethereal' | 'Water'
	type ComboFinisherType = 'Blast' | 'Leap' | 'Projectile' | 'Projectile20' | 'Whirl'

	type ProfessionState = 'None'
		| 'ElementalistAttunementFire' | 'ElementalistAttunementWater' | 'ElementalistAttunementAir' | 'ElementalistAttunementEarth'
		| 'EngineerPhotonForge'
		| 'NecromancerShroud'
		| 'WarriorAdrenalineStage1' | 'WarriorAdrenalineStage2' | 'WarriorAdrenalineStage3'
		| 'RangerDruid' | 'RangerDruidCelestialAvatar' | 'RangerSoulbeast'
		| 'RevenantLegendDragon' | 'RevenantLegendAssassin' | 'RevenantLegendDwarf' | 'RevenantLegendDemon' | 'RevenantLegendRenegade' | 'RevenantLegendCentaur' | 'RevenantLegendAlliance'

	type RestrictionFlag = 'Female' | 'Male' | 'Asura' | 'Charr' | 'Human' | 'Norn' | 'Sylvari' | 'Engineer' | 'Elementalist' | 'Guardian' | 'Mesmer' | 'Necromancer' | 'Ranger' | 'Thief' | 'Warrior' | 'Revenant';



	type Modifier = {
		id                         : number
		base_amount                : number
		formula_param1             : number
		formula_param2             : number
		formula                    : 'BuffLevelLinear' | 'ConditionDamage' | 'ConditionDamageSquared' | 'Ferocity' | 'FerocitySquared' | 'BuffFormulaType5' | 'NoScaling' | 'HealingPower' | 'HealingPowerSquared' | 'SpawnScaleLinear' | 'TargetLevelLinear' | 'BuffFormulaType11' | 'InfiniteDungeonScale' | 'Power' | 'PowerSquared' | 'BuffFormulaType15'
		target?                    : BaseAttribute | number | 'Armor' | 'Damage' | 'LifeForce' | 'Health' | 'HealEffectiveness' | `${'Boon'|'Condition'}Duration` | 'SpeciesPlaceholder' // this is not a real value, in reality this could be any string 
		source_attribute?          : BaseAttribute
		description                : string
		description_override?      : ModifierDescriptionOverride[]
		flags                      : ('FormatFraction' | 'FormatPercent' | 'SkipNextEntry' | 'MulByDuration' | 'DivDurationBy3' | 'DivDurationBy10' | 'NonStacking' | 'Subtract')[]
		source_trait_req?          : number
		//NOTE(Rennorb): We currently use this for filtering, assuming the target is also the character, just as the source.
		// This isn't quite correct, but good enough for us.
		target_trait_req?          : number
		mode?                      : GameMode
	}

	type ModifierDescriptionOverride = {
		profession  : Profession
		description : string
	}



	type ContextInformation = ContextGroup & {
		override_groups? : ({ context : ('Pve' | 'Pvp' | 'Wvw' | 'Any')[] } & ContextGroup)[]
	}

	type ContextGroup = {
		recharge?       : number
		activation?     : number
		resource_cost?  : number
		endurance_cost? : number
		supply_cost?    : number
		upkeep_cost?    : number
		blocks?         : FactBlock[]
	}

	type FactBlock = {
		trait_requirements? : number[]
		description?        : string
		facts?              : Fact[]
	}
}