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

    for (const gw2Object of Array.from(gw2Objects)) {
      const type = gw2Object.getAttribute('type')?.replace('/', '_') + 's' //may change when we get more data
      const objId = gw2Object.getAttribute('objId') || ''
      if (tUtilsv2.isNumeric(objId)) {
        const id = parseInt(objId)
        const key = type as keyof IObjectsToGet
        objectsToGet[key].push(id)
      }
      gw2Object.addEventListener('mouseenter', () => {
        this.tooltip.innerHTML = ''
        if (this.fetchedSkills.length) {
          for (const fetchedObject of this.fetchedSkills) {
            if (parseInt(objId) === fetchedObject.id) {
              this.generateToolTip(fetchedObject)
            }
          }
        }
      })
    }
    Object.entries(objectsToGet).forEach(async ([key, values]) => {
      if (values.length) {
        await this.fetchAPIObjects(key, values)
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
                    'Longbow',
                    'Rifle',
                    'Shortbow',
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
    gameMode?: string | null | undefined,
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

  generateToolTip = (initialSkill: Skill): Skill[] => {
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

    return skillChain
  }
}

const tooltips = new GW2Tooltipsv2()

tooltips.hookDocument(document, true)
