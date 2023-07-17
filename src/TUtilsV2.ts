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

const iconSource = 'https://assets.gw2dat.com/'
const missingImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHEAAABuCAIAAACfnGvJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAMCSURBVHhe7ZjpkeowEAaJywERD9GQDMGwumyPLj+2XssH+/UPyjMjjVBjUWXf3oJGTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSU51inr8d0u02PVwp/xf/MHQvt9Hm/Be7PlMgIHhyzCjn9hNlpc7ebxe9hhNPp8QifpTdfuz9Oe3thjHH6Cndkfv7DWb0/syNbnN8QJuzkZr5q5K+Xk2C6BtbCTDEAZJDTuIfKi0tUKuZgHhBx89P1Zj5rtK4YQzspL43z6RnltFBR5DMVKVhGFPTy3UYBO6vo0GuIMcxpvs1O2gbhei0tbOazRusvmCe+x6nddDtbBA4/LmEFNfN1o57TOD0F5ZIDGOh0CbL91SrqDYZ07iiQ5etGdrxNpGkz9XowQ53GG2Sa7H5rFc095n1W1nzdqOPUXzbXGMVYp1FqlqlVxMCNXEd9kG806t2n87cw2KE4g53mO/fUKrJgxkzp5Ou5Paf//E4wtNPzUelupki+32k8+cZgMDpQ6V9w6ij+UAeee8/fcLovcsojpzxyyiOnPHLKI6c8csqDOx39MH0B5JRHTnmGO00v2uKLi0B8e7E8ghf+7aP5RimyDrC1ga9HPmIXp2ajy95tvEhwUaHJlpaouUandgD7OF3MpHijbrAlf13MmsOwoulQxruzu9NfGLClvtO6QTF2d87mNISWuWT7ZGtUMwJy2nLVKK2YBcqGx3Mmp+XUomQqGUcf9YpT3afZ2BBUoWFpElqYnm7ooY5P9n8a9QRcDz83lfylFdVcJnGoUAfudAjlD+FopM7CNZy27/aTKr2KU4c93Y6jD/gG13F6HeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklOb9/gEv6oxxwmIw6QAAAABJRU5ErkJggg==';
export function newImg(src? : string | number, className? : string, alt? : string) : HTMLImageElement {
	if(typeof src == 'number') src = src + '.png'
	
	const img = document.createElement('img')
	//NOTE(Rennorb): Full urls specify a protocol which is delilited by a colon. Not perferct but good enough for now.  https_:_ , data_:_image
	img.src = src ? (src.includes(':') ? src : iconSource + src) : missingImage;
	if(className) img.classList.add(className)
	img.alt = alt ? alt+' icon' : 'icon';
	return img;
}

const dummy = document.createElement('template');
export function fromHTML(html : string) : DocumentFragment {
	dummy.innerHTML = html;
	return dummy.content;
}

export const GW2Text2HTML = (text? : string, tag = 'span') => text
	? text
		.replace(/<c=@(.*?)>(.*?)<\/c>/g, `<${tag} class="color-$1">$2</${tag}>`)
		.replace(/%%/g, '%')
		.replaceAll('[lbracket]', '[').replaceAll('[rbracket]', ']')
		.replaceAll('[null]', '')
		.replaceAll('\n', '<br />')
	: '';

//TODO(Rennorb) @cleanup: we should just use consistent names.
export const Uncapitalize = <T extends string>(str : T) => str.charAt(0).toLowerCase() + str.slice(1) as Uncapitalize<T>;

export function withUpToNDigits(x : number, digits : number) {
	let str = x.toFixed(digits);
	while(str.charAt(str.length - 1) === '0') str = str.slice(0, -1);
	if(str.charAt(str.length - 1) === '.') str = str.slice(0, -1);
	return str;
}

//TODO(Rennorb) @cleanup
export function drawFractional(value: number) {
	if (window.GW2TooltipsConfig?.preferCorrectnessOverExtraInfo) {
		const sign = value < 0 ? '-' : '';
		value = Math.abs(value);
		const index = (Math.min(Math.round((value % 1) * 4), 4));
		let fraction = '';
		switch (index) {
			case 0: 
			case 4:
			{
				value = Math.round(value);
				break;
			}
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
		}
		if(value == 0 && fraction == '') {
			return '0';
		}
		return `${sign}${value > 0 ? value : ''}${fraction}`;
	} else {
		return withUpToNDigits(value, 3);
	}
}

//TODO(rennorb) @cleanup: rename
export function mapLocale(type : API.Attributes | API.ComboFinisherType | API.ComboFieldType | API.Palette['weapon_type']) {
	switch (type) {
		case 'ConditionDmg': return 'Condition Damage';
		case 'CritDamage'  : return 'Ferocity';
		case 'Healing'     : return 'Healing Power';
		case 'BowLong'     : return 'Longbow';
		case 'BowShort'    : return 'Shortbow';
		case 'Projectile20': return 'Projectile (20% Chance)';
		default: return type;
	}
}
