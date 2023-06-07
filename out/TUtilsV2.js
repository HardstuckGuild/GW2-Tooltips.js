"use strict";
class TUtilsV2 {
    static newElement(spec, inner, parentNode) {
        const [tag, ...classes] = spec.split('.');
        const el = document.createElement(tag);
        el.classList.add(...classes);
        if (inner)
            el.append(inner);
        if (parentNode)
            parentNode.appendChild(el);
        return el;
    }
    static newImg(src, className = '', alt = '') {
        if (!src)
            return '';
        if (className === 'iconlarge') {
            return `<img width='64' height='64' src='${src}' alt='${alt} icon' class='${className}'/>`;
        }
        return `<img width='32' height='32' src='${src}' alt='${alt} icon' class='${className}'/>`;
    }
}
TUtilsV2.GW2Text2HTML = (text, tag = 'span') => text ? text.replace(/<c=@(.*?)>(.*?)<\/c>/g, `<${tag} class="color-$1">$2</${tag}>`).replace(/%%/g, '%') : '';
