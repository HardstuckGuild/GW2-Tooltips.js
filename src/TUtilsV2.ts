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

  static newImg(src : string, className? : string, alt? : string) : HTMLImageElement {
    const img = document.createElement('img')
    img.src = src;
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
  static DurationToSeconds = (dur : API.Duration) => dur.secs + dur.nanos / 1_000_000;
}
