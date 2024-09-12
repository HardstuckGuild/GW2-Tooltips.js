namespace API {
	type Item = Items.Armor | Items.Trinket | Items.Weapon | Items.TraitGuide | Items.Amulet | Items.UpgradeComponent | Items.Consumable | Items.Relic

	type ArmorType      = 'HelmAquatic' | 'Helm' | 'Shoulders' | 'Coat' | 'Gloves' | 'Leggings' | 'Boots';
	type TrinketType    = 'Amulet' | 'Ring' | 'Accessory' | 'Backpiece';
	type Weapons1H      = 'Focus' | 'Shield' | 'Torch' | 'Warhorn' | 'Shortbow' | 'Axe' | 'Sword' | 'Dagger' | 'Pistol' | 'Scepter' | 'Mace';
	type Weapons2H      = 'Greatsword' | 'Hammer' | 'Staff' | 'Longbow' | 'Rifle';
	type WeaponsAquatic = 'Spear' | 'Trident' | 'Speargun';



	namespace Items {
		type ValueOrLutOffset = number | [number, number] //base index, mul
		type ItemFlag = 'AccountBound' | 'Activity' | 'Dungeon' | 'Pve' | 'Pvp' | 'PvpLobby' | 'WvwLobby' | 'Wvw' | 'GemStore' | 'HideSuffix' | 'MonsterOnly' | 'NoExport' | 'NoMysticForge' | 'NoSalvage' | 'NoSell' | 'NotUpgradeable' | 'SoulBindOnAcquire' | 'SoulBindOnUse' | 'Unique' | 'DisallowTrader' | 'DisallowUnderwater' | 'ItemFlag22' | 'AccountBindOnUse' | 'ItemFlag24' | 'ItemFlag25' | 'BulkConsume' | 'ItemFlag27' | 'BoosterEquipment' | 'Indestructible' | 'ItemFlag30' | 'ItemFlag31' | 'ItemFlag32' | 'ItemFlagEx1' | 'SalvageResearch' | 'ItemFlagEx3' | 'ItemFlagEx4' | 'ItemFlagEx5';



		type ItemBase = {
			id             : number
			name           : string
			icon?          : number
			rarity         : 'Junk' | 'Basic' | 'Fine' | 'Masterwork' | 'Rare' | 'Exotic' | 'Ascended' | 'Legendary'
			flags          : ItemFlag[]
			access_restrictions : RestrictionFlag[]
			level          : number
			required_level : number
			description?   : string
			vendor_value?  : number
		}

		type StatSource = {
			attribute_base : number
			attribute_set? : number
			slots          : ('Upgrade' | 'Infusion' | 'Enrichment')[]
		}

		type Armor = ItemBase & StatSource & {
			type    : 'Armor'
			defense : ValueOrLutOffset
			subtype : ArmorType
			weight  : 'Clothes' | 'Light' | 'Medium' | 'Heavy'
			default_skin : number
		}

		type Trinket = ItemBase & StatSource & {
			type    : 'Trinket'
			subtype : TrinketType
			default_skin? : number
		}

		type DamageType = 'Choking' | 'Falling' | 'Fire' | 'Ice' | 'Lightning' | 'Physical' | 'SiegeAntiDoor' | 'SiegeAntiSiege' | 'SiegeAntiWall';

		type Weapon = ItemBase & StatSource & {
			type     : 'Weapon'
			power    : [number, number] | {
				//if unset its itemlevel scaling
				scaling? : 'PlayerLevel' | 'PlayerLevelScaleRarity' | 'ItemScale4'
				mul      : number
				spread   : number
			}
			defense? : ValueOrLutOffset
			subtype  : Weapons1H | Weapons2H | 'Polearm' | 'BundleSmall' | 'BundleLarge' | WeaponsAquatic | 'Toy' | 'ToyTwoHanded'
			damage_type? : DamageType,
			default_skin : number
		}

		type TraitGuide = ItemBase & {
			type               : 'TraitGuide'
			trait              : number
			cost_gold?         : number
			const_hero_points? : number
		}

		type Amulet = ItemBase & {
			type           : 'Trinket'
			subtype        : 'Amulet'
			attribute_base : 1000
			attribute_set  : number
		}

		type Consumable = ItemBase & ({
			type    : 'Consumable'
			subtype : 'AppearanceChange' | 'Booze' | 'ContractNpc' | 'Generic' | 'Halloween' | 'Immediate' | 'Megaphone' | 'TeleportToFriend' | 'Transmutation' | 'Unlock' | 'RandomUnlock' | 'UpgradeRemoval' |  'MountRandomUnlock' | 'Currency'
		} | {
			type         : 'Consumable'
			subtype      : 'Utility' | 'Food'
			applies_buff : BuffFact
		})

		type Relic = ItemBase & {
			type              : 'Relic'
			facts_from_skill? : number
			related_skills    : number[]
		}

		type UpgradeComponent = ItemBase & {
			type    : 'UpgradeComponent'
			subtype : 'Rune' | 'Sigil' | 'Gem' | 'Infusion' | 'Enrichment'
			tiers   : {
				description? : string
				facts?       : Fact[]
				modifiers?   : Modifier[]
			}[]
		}
	}
}