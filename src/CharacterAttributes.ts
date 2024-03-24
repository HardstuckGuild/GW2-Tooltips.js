export function recomputeAttributesFromMods(context : Context, weaponSet : number) : void {
	//nothing fancy, just base attributes first
	const attributeOrder : (BaseAttribute | ComputedAttribute)[] = [
		'Power', 'Toughness', 'Vitality', 'Precision', 'Ferocity', 'ConditionDamage', 'Expertise', 'Concentration', 'HealingPower', 'AgonyResistance',
		'Health', 'Armor', 'ConditionDuration', 'BoonDuration', 'CritChance', 'CritDamage',
	];

	const stats = context.character.statsWithWeapons[weaponSet ?? context.character.selectedWeaponSet];

	const allParts : { [k in BaseAttribute | ComputedAttribute]: { parts : HTMLElement[], sources : StatSource[] } } = { } as any;
	const stage1Attributes : { [k in BaseAttribute | ComputedAttribute]: number } = { } as any;
	const stage2Attributes : { [k in BaseAttribute | ComputedAttribute]: number } = { } as any;
	let fakeAttributes = stage1Attributes;

	for(const attribute of attributeOrder) {
		const { baseAttribute, suffix, base, div } = getAttributeInformation(attribute, context.character);
		let value = base, text;
		const displayMul = suffix ? 100 : 1;

		const parts : HTMLElement[] = [];
		const sources = stats.sources[attribute];
		allParts[attribute] = { parts, sources };

		{
			text = `${n3(base * displayMul) + suffix} base value`;
			if(base) { text += ' from lvl 80'; }
			parts.push(newElm('div.detail', text));

			if(baseAttribute) {
				const baseAttrValue = stage1Attributes[baseAttribute];
				let attrValue = baseAttrValue;
				//NOTE(Rennorb): precision is processed really wired, so we just hard code this case
				//TODO(Rennorb) @scaling
				if(attribute == 'CritChance') attrValue -= 1000;
				const statBonus = attrValue / div;
				value += statBonus;

				if(statBonus) {
					text = ` +${n3(statBonus * displayMul) + suffix} from ${n3(baseAttrValue)} ${localizeInternalName(baseAttribute)}`
					if(div != 1) text += ` / ${div / displayMul} (attrib. specific conv. factor)`
					parts.push(newElm('div.detail', text!));
				}
			}
		}

		//additive mods
		let modValue = 0;
		for(const source of sources.filter(s => !s.modifier.flags.includes('FormatPercent'))) {
			const mod = calculateModifier(source.modifier, context.character.level, fakeAttributes) * source.count;
			modValue += mod;
		
			text = ` +${n3(mod)} from `;
			if(source.count > 1) text += `${source.count} `;
			text += source.source;
			parts.push(newElm('div.detail', fromHTML(resolveInflections(text, source.count, context.character))));
		}
		value += modValue;

		stage1Attributes[attribute] = value;
	}

	for(const attribute of attributeOrder) {
		const { parts, sources } = allParts[attribute];

		let modValue = 0;
		//conversion mods
		for(const source of sources.filter(s => s.modifier.flags.includes('FormatPercent') && s.modifier.source_attribute)) {
			const mod = calculateModifier(source.modifier, context.character.level, fakeAttributes) * source.count;
			modValue += Math.round(mod);
			
			let text = ` +${n3(mod)} (${n3(source.modifier.base_amount)}% of ${source.modifier.source_attribute}) from `;
			if(source.count > 1) text += `${source.count} `;
			text += source.source;
			parts.push(newElm('div.detail', fromHTML(resolveInflections(text, source.count, context.character))));
		}
		stage2Attributes[attribute] = stage1Attributes[attribute] + modValue;
	}

	fakeAttributes = stage2Attributes;

	for(const attribute of attributeOrder) {
		const { suffix, cap } = getAttributeInformation(attribute, context.character);;

		let value = stage2Attributes[attribute], text;
		
		//percent mods
		const { parts, sources } = allParts[attribute];
		const displayMul = suffix ? 100 : 1;
		for(const source of sources.filter(s => s.modifier.flags.includes('FormatPercent') && !s.modifier.source_attribute)) {
			const mod = calculateModifier(source.modifier, context.character.level, fakeAttributes) * source.count / 100; //TODO(Rennorb) @cleanup
			//NOTE(Rennorb): Having a suffix means the percentage based values should be additive, as this only applies for condition/boon duration, and crit chance/damage.
			const toAdd = suffix ? mod : value * mod; 
			value += toAdd;
			
			text = ` +${n3(toAdd * displayMul)}${suffix}`;
			if(!suffix) text += ` (${n3(mod * 100)}%)`;
			text += ' from ';
			if(source.count > 1) text += `${source.count} `;
			text += source.source;
			parts.push(newElm('div.detail', fromHTML(resolveInflections(text, source.count, context.character))));
		}


		const uncappedValue = value;
		//NOTE(Rennorb): -1 because the cap is 200% for duration, but the displayed value is the _additional_ duration, so its a max of +100%.
		stage2Attributes[attribute] = value = Math.min(uncappedValue, cap - 1);

		if(uncappedValue != value)
			parts.push(newElm('span.detail.capped', `(Capped to ${n3(value * displayMul)}${suffix}! Uncapped value would be ${n3(uncappedValue * displayMul)}${suffix})`));
		parts.unshift(newElm('h4.title', newElm('span.title-text', ' +' + n3(value * displayMul) + suffix + ' ' + localizeInternalName(attribute))));
	}

	for(const attribute of attributeOrder) {
		stats.values[attribute] = stage2Attributes[attribute];
		stats.htmlParts[attribute] = allParts[attribute].parts;
	}
}

type AttributeInfo = {
	baseAttribute?     : BaseAttribute
	computedAttribute? : ComputedAttribute
	img?               : number
	suffix             : string
	base               : number
	div                : number
	cap                : number
}

const ATTRIBUTE_INFO_LUT = {
	Power            : [undefined      , undefined          ,  66722, '' , 1000,    1, Number.MAX_SAFE_INTEGER],
	Toughness        : [undefined      , 'Armor'            , 104162, '' , 1000,    1, Number.MAX_SAFE_INTEGER],
	Vitality         : [undefined      , 'Health'           , 104163, '' , 1000,    1, Number.MAX_SAFE_INTEGER],
	Precision        : [undefined      , 'CritChance'       , 156609, '' , 1000,    1, Number.MAX_SAFE_INTEGER],
	Ferocity         : [undefined      , 'CritDamage'       , 156602, '' ,    0,    1, Number.MAX_SAFE_INTEGER],
	ConditionDamage  : [undefined      , undefined          , 156600, '' ,    0,    1, Number.MAX_SAFE_INTEGER],
	Expertise        : [undefined      , 'ConditionDuration', 156601, '' ,    0,    1, Number.MAX_SAFE_INTEGER],
	Concentration    : [undefined      , 'BoonDuration'     , 156599, '' ,    0,    1, Number.MAX_SAFE_INTEGER],
	HealingPower     : [undefined      , undefined          , 156606, '' ,    0,    1, Number.MAX_SAFE_INTEGER],
	AgonyResistance  : [undefined      , undefined          , 536049, '' ,    0,    1, Number.MAX_SAFE_INTEGER],
	Health           : ['Vitality'     , undefined          , 536052, '' ,    0,  0.1, Number.MAX_SAFE_INTEGER],
	Armor            : ['Toughness'    , undefined          , 536048, '' ,    0,    1, Number.MAX_SAFE_INTEGER],
	ConditionDuration: ['Expertise'    , undefined          , 156601, '%',    0, 1500,                       2],
	BoonDuration     : ['Concentration', undefined          , 156599, '%',    0, 1500,                       2],
	CritChance       : ['Precision'    , undefined          , 536051, '%', 0.05, 2100, Number.MAX_SAFE_INTEGER],
	CritDamage       : ['Ferocity'     , undefined          , 784327, '%',  1.5, 1500, Number.MAX_SAFE_INTEGER],
} as { [k in BaseAttribute | ComputedAttribute]? : [BaseAttribute | undefined, ComputedAttribute | undefined, number, string, number, number, number]};

export function getAttributeInformation<R>(attribute : BaseAttribute | ComputedAttribute | R, character : Character) : AttributeInfo {
	const _p2 = ATTRIBUTE_INFO_LUT[attribute as Exclude<typeof attribute, R>];
	let baseAttribute, computedAttribute, img, suffix = '', base = 0, div = 1, cap = Number.MAX_SAFE_INTEGER;
	if(_p2) [baseAttribute, computedAttribute, img, suffix, base, div, cap] = _p2;
	if(attribute == 'Health') base = getBaseHealth(character);
	return { baseAttribute, computedAttribute, img, suffix, base, div, cap };
}

export function getBaseHealth(character : Character) : number {
	//TODO(Rennorb): level scaling
	return !character.profession
		? 1000 //TODO(Rennorb): none?
		: ({
				Guardian     : 1645,
				Thief        : 1645,
				Elementalist : 1645,
				Engineer     : 5922,
				Ranger       : 5922,
				Mesmer       : 5922,
				Revenant     : 5922,
				Necromancer  : 9212,
				Warrior      : 9212,
			} as { [k in ProfessionId] : number })[character.profession];
}

function calculateConditionDuration(level : number, expertise : number) {
	return expertise / (LUT_CRITICAL_DEFENSE[level] * (15 / LUT_CRITICAL_DEFENSE[80]));
}

function calculateBoonDuration(level : number, concentration : number) {
	return concentration / (LUT_CRITICAL_DEFENSE[level] * (15 / LUT_CRITICAL_DEFENSE[80]));
}

export const LUT_CRITICAL_DEFENSE = [
	1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.2, 3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0, 5.2, 5.4, 5.6, 5.8, 6.0, 6.2, 6.4, 6.6, 6.8, 7.0, 7.3, 7.6, 7.9, 8.2, 8.5, 8.8, 9.1, 9.4, 9.7, 10.0, 10.3, 10.6, 10.9, 11.2, 11.5, 11.8, 12.1, 12.4, 12.7, 13.0, 13.4, 13.8, 14.2, 14.6, 15.0, 15.4, 15.8, 16.2, 16.6, 17.0, 17.4, 17.8, 18.2, 18.6, 19.0, 19.4, 19.8, 20.2, 20.6, 21.0, 21.5, 22.0, 22.5, 23.0, 23.5, 24.0, 24.5, 25.0, 25.5, 26.0, 26.5, 27.0, 27.5, 28.0, 28.5, 29.0, 29.5, 30.0, 30.5, 31.0,
];

export const LUT_DEFENSE = [
	115, 120, 125, 129, 133, 137, 142, 146, 150, 154, 162, 168, 175, 182, 189, 196, 202, 209, 216, 223, 232, 240, 248, 257, 265, 274, 282, 290, 299, 307, 319, 330, 341, 352, 363, 374, 385, 396, 407, 418, 431, 443, 456, 469, 481, 494, 506, 519, 532, 544, 560, 575, 590, 606, 621, 636, 651, 666, 682, 697, 714, 731, 748, 764, 781, 798, 815, 832, 848, 865, 885, 905, 924, 943, 963, 982, 1002, 1021, 1040, 1060, 1081, 1102, 1123, 1144, 1165, 1186, 1207, 1228, 1249, 1270, 1291, 1312, 1333, 1354, 1375, 1396, 1417, 1438, 1459, 1480, 1501,
];

export const LUT_POWER_PLAYER = [
	170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 202, 207, 212, 217, 222, 227, 232, 237, 242, 247, 253, 259, 265, 271, 277, 283, 289, 295, 301, 307, 315, 323, 331, 339, 347, 355, 363, 371, 379, 387, 396, 405, 414, 423, 432, 441, 450, 459, 468, 477, 488, 499, 510, 521, 532, 543, 554, 565, 576, 587, 599, 611, 623, 635, 647, 659, 671, 683, 695, 707, 721, 735, 749, 763, 777, 791, 805, 819, 833, 847, 862, 877, 892, 907, 922, 937, 952, 967, 982, 997, 1012, 1027, 1042, 1057, 1072, 1087, 1102, 1117, 1132, 1147, 1162,
];

export const LUT_POWER_MONSTER = [
	162, 179, 197, 214, 231, 249, 267, 286, 303, 322, 344, 367, 389, 394, 402, 412, 439, 454, 469, 483, 500, 517, 556, 575, 593, 612, 622, 632, 672, 684, 728, 744, 761, 778, 820, 839, 885, 905, 924, 943, 991, 1016, 1067, 1093, 1119, 1145, 1193, 1220, 1275, 1304, 1337, 1372, 1427, 1461, 1525, 1562, 1599, 1637, 1692, 1731, 1802, 1848, 1891, 1936, 1999, 2045, 2153, 2201, 2249, 2298, 2368, 2424, 2545, 2604, 2662, 2723, 2792, 2854, 2985, 3047, 3191, 3269, 3348, 3427, 3508, 3589, 3671, 3754, 3838, 3922, 4007, 4093, 4180, 4267, 4356, 4445, 4535, 4625, 4717, 4809, 4902,
];

import { calculateModifier } from "./FactsProcessor";
import { fromHTML, localizeInternalName, n3, newElm, resolveInflections } from "./Utils";
