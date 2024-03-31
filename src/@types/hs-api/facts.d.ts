namespace API {
	type Fact = FactMap[keyof FactMap];
	type FactType = keyof FactMap;

	type FactMap = {
		AdjustByAttributeAndLevel        : Facts.AdjustByAttributeAndLevel
		AttributeAdjust                  : Facts.AttributeAdjust
		Buff                             : Facts.Buff
		BuffBrief                        : Facts.BuffBrief
		Distance                         : Facts.Distance
		Number                           : Facts.Number
		Percent                          : Facts.Percent
		PercentHpSelfDamage              : Facts.Percent
		PercentHealth                    : Facts.Percent
		PercentLifeForceCost             : Facts.Percent
		PercentLifeForceGain             : Facts.Percent
		Damage                           : Facts.Damage
		Time                             : Facts.Time
		ComboField                       : Facts.ComboField
		ComboFinisher                    : Facts.ComboFinisher
		AttributeConversion              : Facts.AttributeConversion
		NoData                           : Facts.NoData
		PrefixedBuff                     : Facts.PrefixedBuff
		PrefixedBuffBrief                : Facts.PrefixedBuffBrief
		// Custom facts
		Range                            : Facts.Range
		StunBreak                        : Facts.StunBreak
	}

	namespace Facts {
		type BasicFact<Type extends keyof FactMap> = {
			type            : Type
			icon            : number
			text?           : string
			order           : number
			requires_trait? : number[]
			defiance_break? : number
			insert_before?  : number
			skip_next?      : number
			__gamemode_override_marker? : true
		}

		type AdjustByAttributeAndLevel = BasicFact<'AdjustByAttributeAndLevel'> & {
			value                : number
			level_exponent       : number
			level_multiplier     : number
			hit_count            : number
		} & (AttributeScaling | Undefined<AttributeScaling>)

		type AttributeScaling = {
			attribute            : BaseAttribute,
			attribute_multiplier : number
		}

		type AttributeAdjust = BasicFact<'AttributeAdjust'> & {
			range  : number[]
			target : BaseAttribute
		}

		type Buff = BasicFact<'Buff'> & {
			buff        : number
			apply_count : number
			duration    : Milliseconds
		}

		type BuffBrief = BasicFact<'BuffBrief'> & {
			buff  : number
		}

		type Distance = BasicFact<'Distance'> & {
			distance : number
		}

		type Number = BasicFact<'Number'> & {
			value : number
		}

		type Percent = BasicFact<'Percent' | 'PercentHpSelfDamage' | 'PercentHealth' | 'PercentLifeForceCost' | 'PercentLifeForceGain'> & {
			percent : number
		}

		type Damage = BasicFact<'Damage'> & {
			hit_count      : number
			dmg_multiplier : number
		}

		type Time = BasicFact<'Time'> & {
			duration : Milliseconds;
		}

		type ComboField = BasicFact<'ComboField'> & {
			field_type : ComboFieldType
		}

		type ComboFinisher = BasicFact<'ComboFinisher'> & {
			finisher_type : ComboFinisherType
		}

		type AttributeConversion = BasicFact<'AttributeConversion'> & {
			source  : BaseAttribute
			target  : BaseAttribute
			percent : number
		}

		type NoData = BasicFact<'NoData'> & {
			text : never
		}

		type PrefixedBuff = BasicFact<'PrefixedBuff'> & {
			apply_count : number
			buff        : number
			prefix      : number
			duration    : Milliseconds
		}

		type PrefixedBuffBrief = BasicFact<'PrefixedBuffBrief'> & {
			buff   : number
			prefix : number
		}

		// Custom facts
		type Range = BasicFact<'Range'> & {
			min?  : number
			max   : number
		}

		type StunBreak = BasicFact<'StunBreak'> & {
			text : never
		}
	}
}