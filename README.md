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
	<span style="color: red">//TODO(Rennorb) @incomplete: definition not complete </span>
2. Optionally define one or more context(s) in a window-scoped object '`GW2TooltipsContext`'
	```html
	<script>
	/* may be: PartialContext[] | PartialContext | undefined */
	var GW2TooltipsContext = {
		traits   : [] //TODO(Rennorb) @incomplete
		gameMode : 'Pve' | 'Pvp' | 'Wvw';
		stats    : {
			level          : 80,
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
		}
	}
	</script>
	```
	<span style="color: red">//TODO(Rennorb): provide separate d.ts file for the Context global</span>
3. Include the script and style <span style="color: red">//TODO(Rennorb) @prio:low : style does not actually exist in this form </span>
	```html
	<head>
		<script type="text/javascript" script="path/to/tooltips.js" defer></script>
		<link rel="stylesheet" type="text/css" href="path/to/your/tooltips.css" />
	</head>
	```

By including the script it wil automatically hook the whole document of the current page.
<span style="color: red">//TODO(Rennorb) @hardcoded </span>

## Compiling form TypeScript
1. Download [Node.js](https://nodejs.org/en)
2. Get the [typescript compiler](https://www.typescriptlang.org/) (probably obtained and installed globally using node by running `npm install -g typescript`)
3. Clone this repository (`git clone git@github.com:HardstuckGuild/Tooltips.js.git`) or download it 
4. The `tsconfig.json` in the project root defines all parameters. You only need to run `tsc build` next to it.
5. The `out/` directory now holds your compiled `tooltips.js` file
