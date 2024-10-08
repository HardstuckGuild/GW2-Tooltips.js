export enum RARITY { Junk, Basic, Fine, Masterwork, Rare, Exotic, Ascended, Legendary };
export const LUT_RARITY = [ 0, 0, 1, 2, 3, 4, 4, 4 ];
export const LUT_RARITY_MUL = [ 0.5, 0.65, 0.8, 0.85, 0.9, 1.0, 1.05, 1.05 ];

export const LUT_WEAPON_STRENGTH : Record<Exclude<API.Palette['weapon_type'], undefined>, number> = {
	BundleLarge: 0,
	Standard   : 690.5,
	Focus      : 900,
	Shield     : 900,
	Torch      : 900,
	Warhorn    : 900,
	Greatsword : 1100,
	Hammer     : 1100,
	Staff      : 1100,
	Longbow    : 1050,
	Rifle      : 1150,
	Shortbow   : 1000,
	Axe        : 1000,
	Sword      : 1000,
	Dagger     : 1000,
	Pistol     : 1000,
	Scepter    : 1000,
	Mace       : 1000,
	Spear      : 1000,
	Speargun   : 1000,
	Trident    : 1000,
};

export const ICONS = {
	CoinCopper     : 156902,
	CoinSilver     : 156907,
	CoinGold       : 156904,
	//NOTE(Rennorb): Name must be compatible with upgrade enum.
	SlotUpgrade    : 517197,
	SlotInfusion   : 517202,
	SlotEnrichment : 517204,
	//NOTE(Rennorb): Name must be compatible with profession enum.
	ResourceThief    : 156649,
	ResourceRevenant : 156647,

	CostUpkeep      : 156058,
	CostSupply      : 2111003,
	CostEndurance   : 156649,
	NoUnderwater    : 358417,
	Recharge        : 156651,
	Activation      : 496252,
	Range           : 156666,
	DefianceBreak   : 1938788,
	WeaponSwap      : 156583,
	Barrier         : 1770209,
	StunBreak       : 156654,
	Knockdown       : 2440716,
	Pull            : 2440717,
	Knockback       : 2440715,
	Launch          : 2440712,
	Float           : 2440713,
	Sink            : 2440714,
};

export const PROFESSIONS : API.Profession['id'][] = ['Guardian', 'Warrior', 'Engineer', 'Ranger', 'Thief', 'Elementalist', 'Mesmer', 'Necromancer', 'Revenant'];
export const enum SPECIALIZATIONS { Soulbeast = 55 };

export const WIKI_SEARCH_URL = 'https://wiki-en.guildwars2.com/wiki/Special:Search/';

export const VALID_CHAIN_PALETTES = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard', 'Equipment']; //TODO(Rennorb) @cleanup rename

//
// Defaults
//

export const DEFAULT_CONFIG : Config = {
	autoInitialize                  : true,
	autoCollectRuneCounts           : false,
	autoCollectStatSources          : false,
	autoCollectSelectedTraits       : false,
	autoRecomputeCharacterAttributes: false,
	adjustIncorrectStatIds          : false,
	adjustWikiLinks                 : true,
	autoInferEquipmentUpgrades      : false,
	autoInferWeaponSetAssociation   : false,
	legacyCompatibility             : true,
	showPreciseAbilityTimings       : false,
	showFactComputationDetail       : false,
	globalKeyBinds                  : true,
	validateApiResponses            : true,
};

//NOTE(Rennorb): stats are going to be processed separately
export const DEFAULT_CONTEXT : Context = {
	gameMode           : 'Pve',
	underwater         : false,
	targetArmor        : 2597,
	character: {
		level            : 80,
		isPlayer         : true,
		sex              : "Male",
		traits           : new Set(),
		specializations  : new Set(),
		stats: {
			values:  {
				Power            : 0,
				Toughness        : 0,
				Vitality         : 0,
				Precision        : 0,
				Ferocity         : 0,
				ConditionDamage  : 0,
				Expertise        : 0,
				Concentration    : 0,
				HealingPower     : 0,
				AgonyResistance  : 0,
			},
			sources: {
				Power            : [],
				Toughness        : [],
				Vitality         : [],
				Precision        : [],
				Ferocity         : [],
				ConditionDamage  : [],
				Expertise        : [],
				Concentration    : [],
				HealingPower     : [],
				AgonyResistance  : [],
				Armor            : [],
				Damage           : [],
				LifeForce        : [],
				Health           : [],
				HealEffectiveness: [],
				Stun             : [],
				ConditionDuration: [],
				BoonDuration     : [],
				CritChance       : [],
				CritDamage       : [],
			},
		},
		statsWithWeapons: [{
			values: {
				Power            : 1000,
				Toughness        : 1000,
				Vitality         : 1000,
				Precision        : 1000,
				Ferocity         : 0,
				ConditionDamage  : 0,
				Expertise        : 0,
				Concentration    : 0,
				HealingPower     : 0,
				AgonyResistance  : 0,
				Health           : 10000,
				Armor            : 1000,
				CritChance       : 0.05,
				CritDamage       : 1.5,
				ConditionDuration: 0,
				BoonDuration     : 0,
			},
			sources: {
				Power            : [],
				Toughness        : [],
				Vitality         : [],
				Precision        : [],
				Ferocity         : [],
				ConditionDamage  : [],
				Expertise        : [],
				Concentration    : [],
				HealingPower     : [],
				AgonyResistance  : [],
				Armor            : [],
				Damage           : [],
				LifeForce        : [],
				Health           : [],
				HealEffectiveness: [],
				Stun             : [],
				ConditionDuration: [],
				BoonDuration     : [],
				CritChance       : [],
				CritDamage       : [],
			},
			htmlParts: {
				Power            : [],
				Toughness        : [],
				Vitality         : [],
				Precision        : [],
				Ferocity         : [],
				ConditionDamage  : [],
				Expertise        : [],
				Concentration    : [],
				HealingPower     : [],
				AgonyResistance  : [],
				Armor            : [],
				Health           : [],
				ConditionDuration: [],
				BoonDuration     : [],
				CritChance       : [],
				CritDamage       : [],
			},
		}],
		selectedWeaponSet: 0,
		upgradeCounts: {},
	},
};

export const MISSING_ITEM : API.Item = {
	id         : 0,
	name       : 'Missing Item',
	description: '<c=@warning>This Item failed to load</c>',
	rarity     : "Fine",
	type       : "UpgradeComponent", subtype: "Gem",
	flags: [], level: 0, required_level: 0, access_restrictions: [], tiers: [{
		description: '<c=@warning>This Item failed to load</c>',
	}],
}
export const MISSING_BUFF : API.Skill = {
	id         : 0,
	name       : 'Missing Buff',
	description: '<c=@warning>This Buff failed to load</c>',
	categories : [], palettes   : [], modifiers  : [], flags: [],
}
export const MISSING_SKILL : API.Skill = {
	id         : 0,
	name       : 'Missing Skill',
	description: '<c=@warning>This Skill failed to load</c>',
	categories : [], palettes   : [], modifiers  : [], flags: [],
}
export const EMPTY_SKIN : API.Skin = {
	id         : 0,
	type       : 'Back',
	subtype    : 'Default',
	rarity     : 'Basic',
	flags      : ['HidePrefix'],
	access_restrictions: [], dye_channels: [null, null, null, null]
}