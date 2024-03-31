namespace API {
	type Skin = Skins.Armor | Skins.Back | Skins.GatheringTool | Skins.Weapon;

	namespace Skins {
		type SkinBase = {
			id                  : number
			name?               : string
			description?        : string
			icon?               : number
			icon_china?         : number
			rarity              : ItemBase['rarity']
			flags               : ('HidePrefix' | 'todo')[]
			access_restrictions : RestrictionFlag[]
		}

		type Armor = SkinBase & {
			type         : 'Armor'
			subtype      : ItemArmor['subtype']
			weight       : ItemArmor['weight']
			dye_channels : [number | null, number | null, number | null, number | null]
		}

		type Back = SkinBase & {
			type         : 'Back'
			subtype      : 'Default' | 'Glider' | 'Cape' | 'Special'
			dye_channels : [number | null, number | null, number | null, number | null]
		}

		type GatheringTool = SkinBase & {
			type     : 'GatheringTool'
			subtype  : 'Foraging' | 'Logging' | 'Mining' | 'Fishing' | 'Bait' | 'Lure'
			skills   : number[] // restrictions on skills not implemented
			speed    : Milliseconds
			duration : Milliseconds
		}

		type Weapon = SkinBase & {
			type    : 'Weapon'
			subtype : ItemWeapon['subtype'] | null
			damage_type : DamageType
			flags_ex : ('HasEmblem' | 'InstanceOwnerOnly' | 'OwnerOnly' | 'OwnerFriendsOnly')[] //TODO(Rennorb) @rename @cleanup
		}
	}
}