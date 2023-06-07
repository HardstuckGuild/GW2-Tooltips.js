class TUtilsV2 {
  /** @param spec expected to be of shape tagname[.class1[.class2[...]]] */
  static newElement(
    spec: string,
    inner?: string | Node,
    parentNode?: HTMLElement
  ): HTMLElement {
    const [tag, ...classes] = spec.split('.');
    const el = document.createElement(tag);
    el.classList.add(...classes);
    if(inner) el.append(inner);
    //huh ? 
    if(parentNode) parentNode.appendChild(el)
    return el
  }

  static newImg(src: string, className = '', alt = '') {
    if(!src) return ''
    if(className === 'iconlarge') {
      return `<img width='64' height='64' src='${src}' alt='${alt} icon' class='${className}'/>`
    }
    return `<img width='32' height='32' src='${src}' alt='${alt} icon' class='${className}'/>`
  }

  static GW2Text2HTML = (text? : string, tag = 'span') => text ? text.replace(/<c=@(.*?)>(.*?)<\/c>/g, `<${tag} class="color-$1">$2</${tag}>`).replace(/%%/g, '%') : '';
}
