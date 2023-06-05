class GW2Tooltipsv2 {
  tooltip: HTMLElement
  fetchedSkills: Skill[] = []
  traits: any[] = []
  gameMode: 'Pve' | 'Pvp' | 'Wvw' = 'Pve'
  stats = {
    level: 80,
    power: 1000,
    toughness: 1000,
    vitality: 1000,
    precision: 1000,
    ferocity: 1000,
    conditionDamage: 0,
    expertise: 0,
    concentration: 0,
    healing: 0,
    critDamage: 0,
  }
  cycling = false
  cyclePos!: number
  baseTooltip!: number
  lastMouseX!: number
  lastMouseY!: number
  constructor() {
    this.tooltip = tUtilsv2.newElement('div', 'tooltipWrapper')

    document.body.appendChild(this.tooltip)
  }

  async fetchAPIObjects(key: string, value: number[]) {
    try {
      const result = await api.getAPIObjects(key, value)

      this.fetchedSkills = result
    } catch (error) {
      console.error(error)
    }
  }
  displayTooltip = (tooltips: HTMLElement[], tooltipIndex: number) => {
    tooltips.forEach((tooltip, index) => {
      if (index === tooltipIndex) {
        tooltip.style.display = 'block'
      } else {
        tooltip.style.display = 'none'
      }
    })
  }
  cycleTooltips() {
    if (!this.cycling) return
    this.cycling = true
    const tooltips: HTMLElement[] = Array.from(
      this.tooltip.getElementsByClassName('tooltip')
    ) as HTMLElement[]
    this.cyclePos = tooltips.length - this.baseTooltip
    const totalTooltips = tooltips.length - this.baseTooltip
    this.cyclePos = (this.cyclePos - 1 + totalTooltips) % totalTooltips
    tooltips.forEach((tooltip, index) => {
      tooltip.style.display = index === this.cyclePos ? '' : 'none'
    })

    this.positionTooltip()
  }

  positionTooltip() {
    const tooltip = this.tooltip
    const wpadminbar = document.getElementById('wpadminbar')
    const additionaloffset = wpadminbar ? wpadminbar.offsetHeight : 0

    let tooltipXpos = this.lastMouseX + 16
    if (this.lastMouseX + tooltip.offsetWidth + 22 > window.innerWidth) {
      tooltipXpos = window.innerWidth - 22 - tooltip.offsetWidth
    }
    let tooltipYpos = this.lastMouseY - 6 - tooltip.offsetHeight
    if (
      this.lastMouseY -
        tooltip.offsetHeight -
        13 -
        document.documentElement.scrollTop <
      0
    ) {
      tooltipYpos = additionaloffset + 6 + document.documentElement.scrollTop
    }

    tooltip.style.transform = `translate(${tooltipXpos}px, ${tooltipYpos}px)`
  }

  hookDocument = (doc: Document, dom: boolean): void => {
    const objectsToGet: IObjectsToGet = {
      skills: [],
      traits: [],
      items: [],
      specializations: [],
      pets: [],
      pvp_amulets: [],
    }

    const gw2Objects: HTMLCollectionOf<Element> =
      doc.getElementsByTagName('gw2object')
    const globalObject = doc.querySelector('globalobject')
    if (globalObject?.getAttribute('gameMode')) {
      let mode = tUtilsv2.capitalizeFirstLetter(
        globalObject?.getAttribute('gameMode')!
      )
      if (mode === 'Pve' || mode === 'Pvp' || mode === 'Wvw') {
        this.gameMode = mode
      }
    }

    let elementsNeedingWikiLinks = new Map<string, Element>()

    for (const gw2Object of Array.from(gw2Objects)) {
      const type = gw2Object.getAttribute('type')?.replace('/', '_') + 's' //may change when we get more data
      const objId = gw2Object.getAttribute('objId') || ''
      if (tUtilsv2.isNumeric(objId)) {
        const id = parseInt(objId)
        const key = type as keyof IObjectsToGet
        objectsToGet[key].push(id)
      }
      elementsNeedingWikiLinks.set(objId, gw2Object)

      gw2Object.addEventListener('mouseenter', () => {
        this.tooltip.innerHTML = ''
        if (this.fetchedSkills.length) {
          for (const fetchedObject of this.fetchedSkills) {
            if (parseInt(objId) === fetchedObject.id) {
              this.generateToolTip(fetchedObject, gw2Object as HTMLElement)
            }
          }
        }
      })
      gw2Object.addEventListener('mouseleave', () => {
        this.tooltip.innerHTML = ''
      })
    }

    Object.entries(objectsToGet).forEach(async ([key, values]) => {
      if (values.length) {
        await this.fetchAPIObjects(key, values)
        this.fetchedSkills.forEach((obj) => {
          const gw2Object = elementsNeedingWikiLinks.get(obj.id.toString())
          if (gw2Object) {
            let wikiLink = document.createElement('a')
            wikiLink.setAttribute(
              'href',
              'https://wiki-en.guildwars2.com/wiki/Special:Search/' + obj.name
            )
            wikiLink.setAttribute('target', '_blank')
            wikiLink.innerHTML = tUtilsv2.newImg(
              `https://assets.gw2dat.com//${obj.icon}`,
              'iconlarge',
              obj.name
            )
            gw2Object.append(wikiLink)
          }
        })
      }
    })
  }

  processSkillSlot(skill: Skill): string | undefined {
    let skillSlot
    skill.palettes.forEach((palette) => {
      for (const slot of palette.slots) {
        switch (palette.type) {
          case 'Equipment':
            if (palette.weapon_type !== 'None') {
              const replaceFn = (_: string, __: string, digit: string) => {
                if (
                  [
                    'Greatsword',
                    'Hammer',
                    'BowLong',
                    'Rifle',
                    'BowShort',
                    'Staff',
                  ].includes(palette.weapon_type) &&
                  ['Offhand1', 'Offhand2'].includes(slot.slot)
                ) {
                  digit = digit === '1' ? '4' : '5'
                }
                return `${palette.weapon_type} ${digit}`
              }
              skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, replaceFn)
            }
            break
          case 'Standard':
            if (slot.slot === 'Standard') {
              skillSlot = 'Utility'
            }
            break
          case 'Heal':
            skillSlot = 'Heal'
            break
          case 'Bundle':
            skillSlot = slot.slot.replace(
              /(Offhand|Main)(\d)/,
              (_, __, digit: string) => `Weapon ${digit}`
            )
            break
          case 'Toolbelt':
            skillSlot = 'Toolbelt'
            break
          case 'Elite':
            skillSlot = 'Elite'
            break
          case 'Profession':
            skillSlot = slot.slot
        }
      }
    })
    return skillSlot
  }

  processToolTipInfo(
    apiObject: any,
    stats: any,
    gameMode?: 'Pve' | 'Pvp' | 'Wvw',
    traits?: number[]
  ) {
    if (!gameMode) {
      gameMode = 'Pve'
    }
    const basic = document.createElement('tet')
    const name = `<teb> ${apiObject.name} </teb>`
    const slot = `<tes>( ${this.processSkillSlot(
      apiObject
    )} )</tes><div class="flexbox-fill"></div>`

    let recharge
    if (gameMode !== 'Pve' && apiObject.recharge_override.length) {
      apiObject.recharge_override.forEach((recharge_mode: RechargeOverride) => {
        if (recharge_mode.mode === gameMode) {
          recharge = `${
            recharge_mode.recharge.secs
              ? `<ter>
              ${recharge_mode.recharge.secs}
              ${tUtilsv2.newImg(
                'https://assets.gw2dat.com//156651.png',
                'iconsmall'
              )}</ter>`
              : ''
          } `
        }
      })
    } else {
      recharge = `${
        apiObject.recharge.secs
          ? `<ter>
      ${apiObject.recharge.secs}
      ${tUtilsv2.newImg(
        'https://assets.gw2dat.com//156651.png',
        'iconsmall'
      )}</ter>`
          : ''
      } `
    }

    basic.innerHTML = `
     ${name}   
     ${slot}
     ${recharge}
`

    const description = document.createElement('ted')
    description.innerHTML =
      apiObject.description == undefined
        ? ''
        : apiObject.description.replace(/<c=@.*?>(.*?)<\/c>/g, '<teh>$1</teh>')
    const tooltip = tUtilsv2.newElement('div', 'tooltip')
    tooltip.setAttribute('data-id', apiObject.id)
    tooltip.style.marginTop = '5px'
    tooltip.append(basic)
    tooltip.append(description)
    const factsElements = processFacts.processFact(
      apiObject,
      gameMode,
      this.fetchedSkills,
      traits,
      stats
    )
    factsElements?.forEach((factElement) => tooltip.append(factElement))
    this.tooltip.append(tooltip)

    document.body.appendChild(this.tooltip)
  }

  generateToolTip = (initialSkill: Skill, gw2Object: HTMLElement): Skill[] => {
    const skillChain: Skill[] = []
    const validTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard']

    const addSkillToChain = (currentSkill: Skill) => {
      skillChain.push(currentSkill)

      currentSkill.palettes.forEach((palette) => {
        palette.slots.forEach((slot) => {
          if (slot.next_chain && slot.profession !== 'None') {
            const nextSkillInChain = this.fetchedSkills.find(
              (fetchedObject) => fetchedObject.id === slot.next_chain
            )
            if (nextSkillInChain) {
              addSkillToChain(nextSkillInChain)
            }
          }
        })
      })

      if (currentSkill.sub_skills) {
        currentSkill.sub_skills.forEach((subSkillId) => {
          const subSkillInChain: Skill | undefined = this.fetchedSkills.find(
            (fetchedObject) => fetchedObject.id === subSkillId
          )
          if (
            subSkillInChain &&
            subSkillInChain.palettes.some((palette) =>
              validTypes.includes(palette.type)
            )
          ) {
            addSkillToChain(subSkillInChain)
          }
        })
      }
    }

    addSkillToChain(initialSkill)

    skillChain.forEach((skill) => {
      this.processToolTipInfo(skill, this.stats, this.gameMode, this.traits)
    })
    const tooltipContainer = document.querySelector(
      '.tooltipWrapper'
    ) as HTMLElement
    const tooltips = this.tooltip.querySelectorAll('.tooltip')

    if (
      tooltipContainer &&
      tooltipContainer.offsetHeight > window.innerHeight / 2 &&
      tooltips.length > 1
    ) {
      gw2Object.classList.add('cycler')
      gw2Object.setAttribute('title', 'Right-click to cycle through tooltips')
      let currentTooltipIndex = 0
      this.displayTooltip(
        Array.from(tooltips) as HTMLElement[],
        currentTooltipIndex
      )
      gw2Object.addEventListener('contextmenu', function (event) {
        event?.preventDefault()
        gw2tooltips.cycleTooltips()
        currentTooltipIndex++
        if (currentTooltipIndex >= tooltips.length) {
          currentTooltipIndex = 0
        }
        gw2tooltips.displayTooltip(
          Array.from(tooltips) as HTMLElement[],
          currentTooltipIndex
        )
      })
    }
    gw2Object.addEventListener('mousemove', function (event) {
      gw2tooltips.lastMouseX = event.pageX
      gw2tooltips.lastMouseY = event.pageY
      gw2tooltips.positionTooltip()
    })
    return skillChain
  }
}

const gw2tooltips = new GW2Tooltipsv2()

gw2tooltips.hookDocument(document, true)
