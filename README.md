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
1. Define `<gw2object objId='{id}' type={skill|trait|boon|...} />` in your html
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
				critDamage     : 0,
			},
			statSources: {
				power         : StatSource[] = [] // StatSource : {
				toughness     : StatSource[] = [] // 	amount : number
				vitality      : StatSource[] = [] // 	type   : 'Flat' | 'Percent'
				precision     : StatSource[] = [] // 	source : string
				ferocity      : StatSource[] = [] // }
				conditionDmg  : StatSource[] = []
				expertise     : StatSource[] = []
				concentration : StatSource[] = []
				healing       : StatSource[] = []
				critDamage    : StatSource[] = []
			},
			runeCounts : { [item_id : number] : number } = {},
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
