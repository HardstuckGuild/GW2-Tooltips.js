type HTMLElementMap = HTMLElementTagNameMap & {
	[k in string] : HTMLElement // just so we can produce arbitrary tags
};

/** @param spec expected to be of shape tagname[.class1[.class2[...]]] */
export function newElm<T extends keyof HTMLElementMap>(spec : T, ...inner : (string | Node)[]) : HTMLElementMap[T] {
	const [tag, ...classes] = spec.split('.');
	const el = document.createElement(tag);
	if(classes.length) el.classList.add(...classes);
	if(inner.length) el.append(...inner);
	return el as HTMLElementMap[T]
}

export function formatImageUrl(id : number) : string {
	return `https://assets.gw2dat.com/${id}.png`;
} 

const missingImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHEAAABuCAIAAACfnGvJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAMCSURBVHhe7ZjpkeowEAaJywERD9GQDMGwumyPLj+2XssH+/UPyjMjjVBjUWXf3oJGTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSU51inr8d0u02PVwp/xf/MHQvt9Hm/Be7PlMgIHhyzCjn9hNlpc7ebxe9hhNPp8QifpTdfuz9Oe3thjHH6Cndkfv7DWb0/syNbnN8QJuzkZr5q5K+Xk2C6BtbCTDEAZJDTuIfKi0tUKuZgHhBx89P1Zj5rtK4YQzspL43z6RnltFBR5DMVKVhGFPTy3UYBO6vo0GuIMcxpvs1O2gbhei0tbOazRusvmCe+x6nddDtbBA4/LmEFNfN1o57TOD0F5ZIDGOh0CbL91SrqDYZ07iiQ5etGdrxNpGkz9XowQ53GG2Sa7H5rFc095n1W1nzdqOPUXzbXGMVYp1FqlqlVxMCNXEd9kG806t2n87cw2KE4g53mO/fUKrJgxkzp5Ou5Paf//E4wtNPzUelupki+32k8+cZgMDpQ6V9w6ij+UAeee8/fcLovcsojpzxyyiOnPHLKI6c8csqDOx39MH0B5JRHTnmGO00v2uKLi0B8e7E8ghf+7aP5RimyDrC1ga9HPmIXp2ajy95tvEhwUaHJlpaouUandgD7OF3MpHijbrAlf13MmsOwoulQxruzu9NfGLClvtO6QTF2d87mNISWuWT7ZGtUMwJy2nLVKK2YBcqGx3Mmp+XUomQqGUcf9YpT3afZ2BBUoWFpElqYnm7ooY5P9n8a9QRcDz83lfylFdVcJnGoUAfudAjlD+FopM7CNZy27/aTKr2KU4c93Y6jD/gG13F6HeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklOb9/gEv6oxxwmIw6QAAAABJRU5ErkJggg==';
export function newImg(src? : number | string, className? : string, alt? : string) : HTMLImageElement {
	const img = document.createElement('img')
	//NOTE(Rennorb): Full urls specify a protocol which is delilited by a colon. Not perferct but good enough for now.  https_:_ , data_:_image
	//TODO(Rennorb) @cleanup: This is a bit backwards, but is required for custom tooltips for now.
	img.src = src ? ((typeof src === 'string' && src.includes(':')) ? src : formatImageUrl(src as number)) : missingImage;
	if(className) img.classList.add(className)
	img.alt = alt ? alt+' icon' : 'icon';
	return img;
}

export function fromHTML(html : string) : DocumentFragment {
	const dummy = document.createElement('template');
	dummy.innerHTML = html;
	return dummy.content;
}

export const GW2Text2HTML = (text? : string, ...formatArgs : string[]) => text
	? text
		.replaceAll(/<c=(#.*?)>(.*?)<\/c>/g, `<span style="color: $1;">$2</span>`)
		.replaceAll(/<c=@(.*?)>(.*?)<\/c>/g, `<span class="gw2-color-$1">$2</span>`)
		.replaceAll('[lbracket]', '[').replaceAll('[rbracket]', ']')
		.replaceAll('[null]', '')
		.replaceAll('\n', '<br />')
		.replaceAll(/%str(\d)%/g, (_, i) => formatArgs[+i - 1] || '')
		.replaceAll('%%', '%')
	: '';

export const resolveInflections = (text : string, count : number, character: { sex : Character['sex'] }) => text
	.replaceAll('[s]', count > 1 ? 's' : '')
	.replaceAll(/(\S+)\[pl:"(.+?)"]/g, count > 1 ? '$2' : '$1')
	.replaceAll(/(\S+)\[f:"(.+?)"]/g, character.sex == "Female" ? '$2' : '$1');

export function n3(v : number) { return withUpToNDigits(v, 3); }
export function withUpToNDigits(x : number, digits : number) {
	let str = x.toFixed(digits);
	while(str.charAt(str.length - 1) === '0') str = str.slice(0, -1);
	if(str.charAt(str.length - 1) === '.') str = str.slice(0, -1);
	return str;
}

export function s(v : number) { return v >= 0 ? '+'+v : v }
export function n3s(v : number) { return v >= 0 ? '+'+n3(v) : n3(v) }
export function n3ss(v : number) { return v >= 0 ? '+ '+n3(v) : '- '+-n3(v) }

export function formatFraction(value : number, config : Config) {
	if(value === 0) return '0';

	if (!config.showPreciseAbilityTimings) {
		const sign = value < 0 ? '-' : '';
		value = Math.abs(value);
		let fraction = '';
		switch (Math.round((value % 1) * 4)) {
			case 0:
				if((value % 1) === 0) break;
			case 1: {
				value = Math.floor(value);
				fraction = '¼';
				break;
			}
			case 2: {
				value = Math.floor(value);
				fraction = '½';
				break;
			}
			case 3: {
				value = Math.floor(value);
				fraction = '¾';
				break;
			}
			case 4: {
				value = Math.ceil(value);
				break;
			}
		}
		
		return `${sign}${value > 0 ? value : ''}${fraction}`;
	} else {
		return withUpToNDigits(value, 3);
	}
}

export function formatDuration(value : number, config : Config) : string {
	value /= 1000;
	if(value >= 3600) return formatFraction(value / 3600, config) + 'h';
	else if(value > 60) return formatFraction(value / 60, config) + 'min';
	else return formatFraction(value, config) + 's';
}

export function localizeInternalName<T_ extends string>(type : API.BaseAttribute | API.ComputedAttribute | API.ComboFinisherType | API.ComboFieldType | API.Palette['weapon_type'] | T_) {
	switch (type) {
		case 'ConditionDuration': return 'Condition Duration';
		case 'ConditionDamage'  : return 'Condition Damage';
		case 'HealingPower'     : return 'Healing Power';
		case 'Projectile20'     : return 'Projectile (20% Chance)';
		case 'MagicFind'        : return 'Magic Find';
		case 'CritChance'       : return 'Critical Chance';
		case 'CritDamage'       : return 'Critical Damage';
		case 'BoonDuration'     : return 'Boon Duration';
		default: return type;
	}
}

export function findSelfOrParent(self : Element, selector : string, depth = 10) : Element | null {
	let current : Element | null = self;
	while(current && depth-- > 0 && !current.matches(selector)) current = current.parentElement;
	if(depth == 0) return null;
	return current;
}

export function joinWordList(words : string[], quoteWords = false) {
	if(quoteWords) words = words.map(w => `'${w}'`);
	switch(words.length) {
		case 0: return '';
		case 1: return words[0];
		default:
			const last = words[words.length - 1];
			return words.slice(0, -1).join(', ') + ' and ' + last;
	}
}

export const enum IconRenderMode {
	HIDE_ICON = 0,
	SHOW,
	FILTER_DEV_ICONS,
}

//NOTE(Rennorb): this does not neeed to catch all dev icons, just the ones that actually come up.
// https://github.com/HardstuckGuild/Tooltips.js/issues/55
export function IsDevIcon(ico? : number) {
	return [2141735, 2141736, 2141737].includes(ico!);
}
