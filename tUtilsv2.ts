class tUtilsv2 {
  static newElement(
    tag: string,
    className?: string,
    inner?: string,
    parentNode?: HTMLElement
  ): HTMLElement {
    const element = document.createElement(tag)

    if (className) {
      element.className = className
    }

    if (inner) {
      element.innerHTML = inner
    }

    if (parentNode) {
      parentNode.appendChild(element)
    }

    return element
  }

  static isNumeric(str: string | undefined): boolean {
    return str !== undefined && /^\d+$/.test(str)
  }

  static newImg(src: string, className = '', alt = '') {
    if (!src) return ''
    if (className === 'iconlarge') {
      return `<img width='64' height='64' src='${src}' alt='${alt} icon' class='${className}'/>`
    }
    return `<img width='32' height='32' src='${src}' alt='${alt} icon' class='${className}'/>`
  }

  static capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}
