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
	static newImg(src? : string, className? : string, alt? : string) : HTMLImageElement {
		const img = document.createElement('img')
		//NOTE(Rennorb): Full urls specify a protocol which is delilited by a colon. Not perferct but good enough for now.  https_:_ , data_:_image
		img.src = src ? (src.includes(':') ? src : this.iconSource + src) : this.missingImage;
		if(className) img.classList.add(className)
		img.alt = alt ? alt+' icon' : 'icon';
		img.width = img.height = className === 'iconlarge' ? 64 : 32;
		return img;
	}

	static dummy = document.createElement('template');
	static fromHTML(html : string) : DocumentFragment {
		this.dummy.innerHTML = html;
		return this.dummy.content
	}

	static GW2Text2HTML = (text? : string, tag = 'span') => text ? text.replace(/<c=@(.*?)>(.*?)<\/c>/g, `<${tag} class="color-$1">$2</${tag}>`).replace(/%%/g, '%') : '';

	//todo probably just spit out one value from the api
	static DurationToSeconds = (dur : API.Duration) => dur.secs + dur.nanos / 10e8;

	//TODO(Rennorb) @cleanup: we should jsut use consistent names.
	static Uncapitalize = <T extends string>(str : T) => str.charAt(0).toLowerCase() + str.slice(1) as Uncapitalize<T>;
}
