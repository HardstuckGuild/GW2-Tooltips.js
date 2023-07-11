type HTMLElementMap = HTMLElementTagNameMap & {
	[k in string] : HTMLElement // just so we can produce arbitrary tags
};

class TUtilsV2 {
	/** @param spec expected to be of shape tagname[.class1[.class2[...]]] */
	static newElm<T extends keyof HTMLElementMap>(spec : T, ...inner : (string | Node)[]) : HTMLElementMap[T] {
		const [tag, ...classes] = spec.split('.');
		const el = document.createElement(tag);
		if(classes.length) el.classList.add(...classes);
		if(inner.length) el.append(...inner);
		return el as HTMLElementMap[T]
	}

	static iconSource = 'https://assets.gw2dat.com/'
	static missingImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHEAAABuCAIAAACfnGvJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAMCSURBVHhe7ZjpkeowEAaJywERD9GQDMGwumyPLj+2XssH+/UPyjMjjVBjUWXf3oJGTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSU51inr8d0u02PVwp/xf/MHQvt9Hm/Be7PlMgIHhyzCjn9hNlpc7ebxe9hhNPp8QifpTdfuz9Oe3thjHH6Cndkfv7DWb0/syNbnN8QJuzkZr5q5K+Xk2C6BtbCTDEAZJDTuIfKi0tUKuZgHhBx89P1Zj5rtK4YQzspL43z6RnltFBR5DMVKVhGFPTy3UYBO6vo0GuIMcxpvs1O2gbhei0tbOazRusvmCe+x6nddDtbBA4/LmEFNfN1o57TOD0F5ZIDGOh0CbL91SrqDYZ07iiQ5etGdrxNpGkz9XowQ53GG2Sa7H5rFc095n1W1nzdqOPUXzbXGMVYp1FqlqlVxMCNXEd9kG806t2n87cw2KE4g53mO/fUKrJgxkzp5Ou5Paf//E4wtNPzUelupki+32k8+cZgMDpQ6V9w6ij+UAeee8/fcLovcsojpzxyyiOnPHLKI6c8csqDOx39MH0B5JRHTnmGO00v2uKLi0B8e7E8ghf+7aP5RimyDrC1ga9HPmIXp2ajy95tvEhwUaHJlpaouUandgD7OF3MpHijbrAlf13MmsOwoulQxruzu9NfGLClvtO6QTF2d87mNISWuWT7ZGtUMwJy2nLVKK2YBcqGx3Mmp+XUomQqGUcf9YpT3afZ2BBUoWFpElqYnm7ooY5P9n8a9QRcDz83lfylFdVcJnGoUAfudAjlD+FopM7CNZy27/aTKr2KU4c93Y6jD/gG13F6HeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklEdOeeSUR0555JRHTnnklOb9/gEv6oxxwmIw6QAAAABJRU5ErkJggg==';
	static newImg(src? : string | number, className? : string, alt? : string) : HTMLImageElement {
		if(typeof src == 'number') src = src + '.png'
		
		const img = document.createElement('img')
		//NOTE(Rennorb): Full urls specify a protocol which is delilited by a colon. Not perferct but good enough for now.  https_:_ , data_:_image
		img.src = src ? (src.includes(':') ? src : this.iconSource + src) : this.missingImage;
		if(className) img.classList.add(className)
		img.alt = alt ? alt+' icon' : 'icon';
		return img;
	}

	static dummy = document.createElement('template');
	static fromHTML(html : string) : DocumentFragment {
		this.dummy.innerHTML = html;
		return this.dummy.content
	}

	static GW2Text2HTML = (text? : string, tag = 'span') => text
		? text
			.replace(/<c=@(.*?)>(.*?)<\/c>/g, `<${tag} class="color-$1">$2</${tag}>`)
			.replace(/%%/g, '%')
			.replaceAll('[lbracket]', '[').replaceAll('[rbracket]', ']')
			.replaceAll('[null]', '')
			.replaceAll('\n', '<br />')
		: '';

	//TODO(Rennorb) @cleanup: we should just use consistent names.
	static Uncapitalize = <T extends string>(str : T) => str.charAt(0).toLowerCase() + str.slice(1) as Uncapitalize<T>;

	static withUpToNDigits(mode : 'toPrecision' | 'toFixed', x : number, digits : number) {
		let str = (x)[mode](digits);
		while(str.charAt(str.length - 1) === '0') str = str.slice(0, -1);
		if(str.charAt(str.length - 1) === '.') str = str.slice(0, -1);
		return str;
	}

	static drawFractional(value: number) {
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
			return this.withUpToNDigits('toFixed', value, 3);
		}
	}

	static mapLocaleComboFieldType(type: API.ComboFieldType) {
		return type;
	}

	static mapLocaleComboFinisherType(type: API.ComboFinisherType) {
		return type;
	}

	static mapLocaleAttibutes(type: API.Attributes) {
		switch (type) {
			case 'ConditionDmg': return 'Condition Damage';
			case 'CritDamage': return 'Ferocity';
			default: return type;
		}
	}

	static calculateConditionDuration(level: number, expertise: number) {		
		return expertise / (this.LUT_CRITICAL_DEFENSE[level] * (15 / this.LUT_CRITICAL_DEFENSE[80]));
	}

	static calculateBoonDuration(level: number, concentration: number) {
		return concentration / (this.LUT_CRITICAL_DEFENSE[level] * (15 / this.LUT_CRITICAL_DEFENSE[80]));		 
	}

	static LUT_CRITICAL_DEFENSE = [
		1.0,
		1.1,
		1.2,
		1.3,
		1.4,
		1.5,
		1.6,
		1.7,
		1.8,
		1.9,
		2.0,
		2.1,
		2.2,
		2.3,
		2.4,
		2.5,
		2.6,
		2.7,
		2.8,
		2.9,
		3.0,
		3.2,
		3.4,
		3.6,
		3.8,
		4.0,
		4.2,
		4.4,
		4.6,
		4.8,
		5.0,
		5.2,
		5.4,
		5.6,
		5.8,
		6.0,
		6.2,
		6.4,
		6.6,
		6.8,
		7.0,
		7.3,
		7.6,
		7.9,
		8.2,
		8.5,
		8.8,
		9.1,
		9.4,
		9.7,
		10.0,
		10.3,
		10.6,
		10.9,
		11.2,
		11.5,
		11.8,
		12.1,
		12.4,
		12.7,
		13.0,
		13.4,
		13.8,
		14.2,
		14.6,
		15.0,
		15.4,
		15.8,
		16.2,
		16.6,
		17.0,
		17.4,
		17.8,
		18.2,
		18.6,
		19.0,
		19.4,
		19.8,
		20.2,
		20.6,
		21.0,
		21.5,
		22.0,
		22.5,
		23.0,
		23.5,
		24.0,
		24.5,
		25.0,
		25.5,
		26.0,
		26.5,
		27.0,
		27.5,
		28.0,
		28.5,
		29.0,
		29.5,
		30.0,
		30.5,
		31.0,
	];
}
