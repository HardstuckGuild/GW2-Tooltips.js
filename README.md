# [VIP] Tooltips.js V2

This is the second iteration of the js library used by [Hardstuck](https://hardstuck.gg) to render GW2 Item, Skill, Trait and Boon Icons, as well as tooltips as detailed as in game (or even better).

Some special features include:
- Proper skill splitting between game-modes
- Proper value calculations for skills and traits taking into account
	- character level
	- character stats
	- trait interactions
	- usable with multiple contexts with separate values for all of the above
- Cycleable skill-chains

To archive all of the functionality we use our own proprietary API as opposed to the official GW2 API.

## Normal usage

### (legacy)
1. Define `<gw2object objId='{id}' type='{skill|trait|effect|...}' />` in your html.

	Tags can take the following attributes for customization:
	- `objid='{id}'`: Mandatory numeric id of the object. Closely related to `type`.
	- `type='{item|skill|trait|pvp/amulet|effect}'`: Type of id to look up, usually corresponding to the api endpoint with the same name. The following options are available:
		- `item`: `objid` refers to an item id.
		- `skill`: `objid` refers to a skill or buff id. This is used as a default if no value is provided.
		- `trait`: `objid` refers to a trait id.
		- `pvp/amulet`: `objid` refers to a pvp stat id.
		- `effect`: `objid` is a string containing the name of an effect. This only exists for backwards compatibility and available hard coded values can be found in `Inflators.ts`.
	- `stats='{id}'`: Id of the stat set that is selected on the item. Only processed if the type is `item`.
	- `count='{amount}'`: Stack size. Only processed if type is `item`.
	- `with-traits='{id1[,id2[,...]]}'`: List of traits to apply specifically to this skill. Only processed if type is `skill`.
	- `class='{...}'`: Several options are available here:
		- `auto-transform`: Automatically replace this skill with a traited version if the trait in question is active.
		- `gw2objectembed`: Embed this object into text. This will result in the object being inflated into an icon and its name, aswell as its stack size in the shape of '[n x ]icon name'. Can have further specification:
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
	If you want to have typings for this context structure you can use `src/Context.d.ts`.
3. Optionally define config structures <span style="color: red">//TODO(Rennorb)</span>
3. Include the script and style
	```html
	<head>
		<script type="text/javascript" script="path/to/tooltips.js" defer></script>
		<link rel="stylesheet" type="text/css" href="path/to/your/tooltips.css" />
	</head>
	```

By including the script it wil automatically hook the whole document of the current page.

## Compiling form TypeScript
1. Download [Node.js](https://nodejs.org/en)
2. Get the [typescript compiler](https://www.typescriptlang.org/) (probably obtained and installed globally using node by running `npm install -g typescript`)
3. Clone this repository (`git clone git@github.com:HardstuckGuild/Tooltips.js.git`) or download it
4. The `tsconfig.json` in the project root defines all parameters. You only need to run `tsc build` next to it.
5. The `out/` directory now holds your compiled `tooltips.js` file
