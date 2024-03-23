# Tooltips.js V2

This is the second iteration of the js library used by [Hardstuck](https://hardstuck.gg) to render GW2 Item-, Skill-, Trait- and Boon-Icons, as well as their Tooltips as detailed as in game (or even better).

Some special features include:
- Proper skill splitting between game-modes
- Proper value calculations for skills and traits taking into account
	- character level
	- character stats
	- trait interactions
	- currently active weapon-set and equipment
	- boon / buff interactions (including food and utility buffs)
- Using multiple context sets on the same page with separate values for each of the above
- Cycleable skill-chains
- Optional
	- precise skill timings
	- numeric calculation details for skill facts

To achieve all of the functionality we use our own proprietary API as opposed to the official GW2 API.

## Normal usage

1. Define `<gw2object objId='{id}' type='{skill|trait|effect|...}' />` in your html.

	Tags can take the following attributes for customization:
	- `objid='{id}'`: Mandatory, usually numeric id of the object. Closely related to `type`.
	- `type='{item|skill|trait|pvp/amulet|profession|specialization}'`: Type of id to look up, usually corresponding to the api endpoint with the same name. The following options are available:
		- `item`: `objid` refers to an item id.
		- `skill`: `objid` refers to a skill or buff id. This is used as a default if no value is provided.
		- `trait`: `objid` refers to a trait id.
		- `pvp/amulet`: `objid` refers to a pvp stat id.
		- `profession`: `objid` refers to the _string id_ of the profession (e.g. `Revenant`).
		- `specialization`: `objid` refers the a specialization id.
		- `effect`: **obsolete** `objid` is a string containing the name of an effect. This only exists for backwards compatibility and available hard coded values can be found in `Inflators.ts`.
	- `stats='{id}'`: Id of the stat set that is selected on the item. Only processed if the type is `item`.
	- `count='{amount}'`: Stack size. Only processed if type is `item`.
	- `skin='{id}'`: The skin to use instead of the default one. Only processed if type is `item`.
	- `with-traits='{id1[,id2[,...]]}'`: List of traits to apply specifically to this skill. Only processed if type is `skill` or `trait`.
	- `weapon-set='{index}'`: Specify the weapon set to use for calculations. Defaults to set #0 if not specified.
	- `class='{...}'`: Several options are available here:
		- `auto-transform`: Automatically replace this skill with a traited version if the trait in question is active.
		- `gw2objectembed`: Embed this object into text. This will result in the object being inflated into an icon and its name, aswell as its stack size in the shape of '[n x ]icon name'. Can have further specifications:
			- `icononly`: Render the object inline, but only render the icon itself.
			- `big`: Render a slightly larger icon.


2. Optionally define one or more context(s) in a window-scoped object '`GW2TooltipsContext`'
	```html
	<script>
	/* may be: PartialContext[] | PartialContext | undefined */
	var GW2TooltipsContext = {
		gameMode           : 'Pve' | 'Pvp' | 'Wvw' = 'Pve',
		targetArmor        : 2597,
		character: {
			level            : 80,
			isPlayer         : true,
			sex              : 'Male' | 'Female' = 'Male',
			profession?      : 'Guardian' | 'Warrior' | 'Engineer' | 'Ranger' | 'Thief' | 'Elementalist' | 'Mesmer' | 'Necromancer' | 'Revenant' = undefined,
			traits           : number[] = [],
			stats: {
				power          : 1000,
				toughness      : 1000,
				vitality       : 1000,
				precision      : 1000,
				ferocity       : 1000,
				conditionDamage: 0,
				expertise      : 0,
				concentration  : 0,
				healing        : 0,
				agonyResistance: 0

			},
			statSources: {
				power            : StatSource[] = [], // StatSource : {
				toughness        : StatSource[] = [], // 	amount : number
				vitality         : StatSource[] = [], // 	type   : 'Flat' | 'Percent'
				precision        : StatSource[] = [], // 	source : string
				ferocity         : StatSource[] = [], // }
				conditionDmg     : StatSource[] = [],
				expertise        : StatSource[] = [],
				concentration    : StatSource[] = [],
				healing          : StatSource[] = [],
				agonyResistance  : StatSource[] = [],
				damage           : StatSource[] = [],
				lifeForce        : StatSource[] = [],
				health           : StatSource[] = [],
				healEffectiveness: StatSource[] = [],
				stun             : StatSource[] = [],
			},
			upgradeCounts : { [item_id : number] : number } = {},
		},
	}
	</script>
	```
	These may be defined partially, the defaults should be sensible.
	If you want to have typings for this context structure you can use `src/Context.d.ts`.
	Im most all scenarios you only need to specify `character.profession` and `gamemode`.
3. Optionally define config structures. This works much the same way as the context structures:
	```html
	<script>
		var GW2TooltipsConfig = {
			autoInitialize                  : true,

			//    These only run inside calls to `hookDocument`. If you don't call that function for everything,
			// v- you need to explicitly call the related functions if you want the associated effects.
			autoCollectRuneCounts           : true,
			autoCollectStatSources          : true,
			autoCollectSelectedTraits       : true,
			autoInferEquipmentUpgrades      : true,
			autoRecomputeCharacterAttributes: true,
			autoInferWeaponSetAssociation   : true,
			// ^---------------------------

			// This option 'fixes' stat ids for things like armor or amulets, as different pieces of equipment use different stat ids for the same stats.
			// There are for example multiple ids for 'berserkers' that are used for different equipment pieces.
			// If this option is turned on the script will automatically detect incorrect stat ids and replace them with the correct ones before any calculations are done.
			adjustIncorrectStatIds          : true,
			legacyCompatibility             : true,

			// Toggelable at runtime (key-binds) if `globalKeyBinds` was enabled when initializing.
			showPreciseAbilityTimings       : false, // CTRL + ALT + t
			showFactComputationDetail       : false, // CTRL + ALT + d

			globalKeyBinds                  : true,

			// Debug option to show warnings in case the api does not respond with all requested items.
			validateApiResponses            : true,

			// Discouraged / Debug options
			apiImpl                         : undefined,
			workerPath                      : undefined,
		}
	</script>
	```
	These can also just be partially defined.
	The library assumes that you don't change these during its lifetime (except the ones that can be changed using keybinds) so do it at your discretion and expect things to break.
	Typings can again be found in `src/Context.d.ts`. The api implementation spec for apiImpl is defined in `src/API.ts`. The `workerPath` option can be used to load a Web Worker script. The provided one is however unstable (missing cache flushing as of now) and is therefore not used by default. **Using the default worker is highly discouraged**.
3. Include the script and style
	```html
	<head>
		<script type="text/javascript" script="path/to/tooltips.js" defer></script>
		<link rel="stylesheet" type="text/css" href="path/to/your/tooltips.css" />
	</head>
	```
	By including the script it wil automatically hook the whole document of the current page (as long as the auto initialize config option is set to `true`). Use the `defer` keyword when loading the script to run it after the page has finished laoding, or put the script tag at the end of your html body.
	You may also call `GW2TooltipsV2.hookDocument(targetNode)` to specifically only process a target root node and its descendants.

## Manual Usage
If you need a simple example on how to manually invoke the library, have a look at `test/palette_visualizer.htm`. The page shows how to interact with the api to fetch information, and how to use that information manually as well as how to inflate objects and hook the tooltips into them.

## Keybinds
Currently there are two hard-coded keybinds available:
- `ctrl + alt + D`: toggle `showFactComputationDetail`
- `ctrl + alt + T`: toggle `showPreciseAbilityTimings`
- `ctrl + alt + W`: cycle all contexts currently selected weapon set

## Compiling form TypeScript
1. Download [Node.js](https://nodejs.org/en), make sure `npm` is in your path after you installed it.
3. Clone this repository (`git clone --depth 0 git@github.com:HardstuckGuild/Tooltips.js.git`) or download it via the github web ui.
4. The `tsconfig.json` and `rollup.config.mjs` in the project root define all parameters. You only need to run `npm run build` in that directory.
5. The `out/` directory now holds your compiled `tooltips.min.js` file, a map file and the unstable worker.
6. As a bare minimum you need `tooltips.min.js` and `tooltips.css` for this to work properly.



## Copyright
Copyright 2024 Hardstuck Ltd.  
This notice applies to all files in this repository or otherwise belonging to the project.

Licensed under AGPL 3.0, contact us ([development@hardstuck.gg](mailto:development@hardstuck.gg)) if you need differing licensing.