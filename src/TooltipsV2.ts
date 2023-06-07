//TODO(Rennorb) @issues:
// traits are still very messed up and some effects seem to have issues aswell - might just be a issue with the dataset tho.
// The way that affecting traits are captures also seems wrong, but i haven't looked into that yet. 
// The user needs to specify what traits should be used or we may provide a capture function for them that can be called on a trait object, but we should never to it automagically.
// Instantly hooking the whole document also doesn't sit right with me, we should provide an option to disable it.
// It is however unfortunately require for backwards compat. 
//TODO(Rennorb): Provide a clean way to construct custom tooltips. Currently with the old version we manipulate the cache before the hook function gets called, which really isn't the the best.
//TODO(Rennorb): This should also compile to a single file for ease of use, either we want to actually put everything back in one file or get tsc to merge the files in a simple way. Another option would be to bundle everything with something like rollup. That way we can also easily produce minified versions, although we will have to introduce node-modules for that which i strongly dislike.


type PartialContext = Omit<Partial<Context>, 'stats'>  & { stats?: Partial<Stats> }

declare interface Window {
  GW2TooltipsContext : PartialContext[] | PartialContext | undefined;
}
type TypeBridge<T, K extends keyof T> = [K, T[K]]
declare interface ObjectConstructor {
  entries<T>(obj : T) : TypeBridge<T, keyof T>[]
}

//TODO(Rennorb) @cleanup: make static class or just turn the whole project into a module with functions only.
// Instances aren't needed for anything here.
class GW2TooltipsV2 {
  tooltip       : HTMLElement
  objectData    : ObjectDataStorage<Map<number, Skill>> = { //TODO(Rennorb) @hammer: don't use skill for each type
    skills         : new Map<number, Skill>(),
    items          : new Map<number, Skill>(),
    traits         : new Map<number, Skill>(),
    pets           : new Map<number, Skill>(),
    "pvp/amulets"  : new Map<number, Skill>(),
    specializations: new Map<number, Skill>(),
  }
  
  cycling = false
  cyclePos!    : number
  baseTooltip! : number
  lastMouseX!  : number
  lastMouseY!  : number

  context : Context[] = [];

  static defaultContext : Context = {
    traits   : [],
    gameMode : 'Pve',
    stats    : {
      level          : 80,
      power          : 1000,
      toughness      : 1000,
      vitality       : 1000,
      precision      : 1000,
      ferocity       : 1000,
      conditionDamage: 0,
      expertise      : 0,
      concentration  : 0,
      healing        : 0,
      critDamage     : 0,
    },
  }
  static createCompleteContext(partialContext : PartialContext) : Context {
    const stats = Object.assign({}, this.defaultContext.stats, partialContext.stats)
    return Object.assign({}, this.defaultContext, partialContext, { stats });
  }

  constructor() {
    if(window.GW2TooltipsContext instanceof Array) {
      for(const partialContext of window.GW2TooltipsContext)
        this.context.push(GW2TooltipsV2.createCompleteContext(partialContext))
    }
    else if(window.GW2TooltipsContext) {
      this.context.push(GW2TooltipsV2.createCompleteContext(window.GW2TooltipsContext))
    }
    else{
      this.context.push(GW2TooltipsV2.createCompleteContext({}))
    }
    

    this.tooltip = TUtilsV2.newElement('div.tooltipWrapper')
    this.tooltip.style.display = 'none';
    document.body.appendChild(this.tooltip)
  }

  async fetchAPIObjects<T>(key: string, value: number[]) : Promise<T[]> {
    let result : T[] = [];
    try {
      result = await HSAPI.getAPIObjects(key, value)
    } catch (error) {
      console.error(error)
    }
    return result;
  }
  displayCorrectChainTooltip(tooltips: HTMLElement[], tooltipIndex: number) {
    for(let index = 0; index < tooltips.length; index++) {
      tooltips[index].style.display = index === tooltipIndex ? '' : 'none'
    }
  }
  cycleTooltips() {
    if(!this.cycling) return
    this.cycling = true

    const chainTooltips = Array.from(this.tooltip.children) as HTMLElement[]
    this.cyclePos = chainTooltips.length - this.baseTooltip
    const totalTooltips = chainTooltips.length - this.baseTooltip
    this.cyclePos = (this.cyclePos - 1 + totalTooltips) % totalTooltips
    this.displayCorrectChainTooltip(chainTooltips, this.cyclePos);

    this.positionTooltip()
  }

  positionTooltip() {
    const tooltip = this.tooltip
    const wpadminbar = document.getElementById('wpadminbar')
    const additionaloffset = wpadminbar ? wpadminbar.offsetHeight : 0

    let tooltipXpos = this.lastMouseX + 16
    if(this.lastMouseX + tooltip.offsetWidth + 22 > window.innerWidth) {
      tooltipXpos = window.innerWidth - 22 - tooltip.offsetWidth
    }
    let tooltipYpos = this.lastMouseY - 6 - tooltip.offsetHeight
    if(
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

  hookDocument(scope: { getElementsByTagName(qualifiedName: string): HTMLCollectionOf<Element> }, _unused? : any) : void {
    const objectsToGet : ObjectDataStorage<number[]> = {
      skills         : [],
      traits         : [],
      items          : [],
      specializations: [],
      pets           : [],
      'pvp/amulets'  : [],
    }

    let elementsNeedingWikiLinks = new Map<number, Element>()

    for(const gw2Object of scope.getElementsByTagName('gw2object') as HTMLCollectionOf<HTMLElement>) {
      const objId = +String(gw2Object.getAttribute('objId'))
      const type = (gw2Object.getAttribute('type') || 'skill') + 's'
      if(isNaN(objId) || !(type in objectsToGet)) continue;

      objectsToGet[type as keyof typeof objectsToGet].push(objId)
      elementsNeedingWikiLinks.set(objId, gw2Object)

      gw2Object.addEventListener('mouseenter', (e) => {
        const element = e.target as HTMLElement;
        const type = (element.getAttribute('type') || 'skill') + 's';
        const objId = +String(element.getAttribute('objId'))

        this.tooltip.replaceChildren();
        const data = this.objectData[type as keyof typeof this.objectData].get(objId)
        if(data) {
          this.generateToolTip(data, element) //TODO(Rennorb) @fixme: this add another set of handlers on each mouseenter. 
          this.tooltip.style.display = ''; //empty value resets actual value to use stylesheet
        }
      })
      gw2Object.addEventListener('mouseleave', () => {
        this.tooltip.style.display = 'none';
      })
    }

    Object.entries(objectsToGet).forEach(async ([key, values]) => {
      if(values.length == 0) return;

      const storage = this.objectData[key];

      for(const skill of await this.fetchAPIObjects<Skill>(key, values))
        storage.set(skill.id, skill)

      for(const obj of storage.values()) {
        const gw2Object = elementsNeedingWikiLinks.get(obj.id)
        if(gw2Object) {
          let wikiLink = document.createElement('a')
          wikiLink.setAttribute('href', 'https://wiki-en.guildwars2.com/wiki/Special:Search/' + obj.name)
          wikiLink.setAttribute('target', '_blank')
          wikiLink.innerHTML = TUtilsV2.newImg(`https://assets.gw2dat.com/${obj.icon}`, 'iconlarge', obj.name)
          gw2Object.append(wikiLink)
        }
      }
    })
  }

  processSkillSlot(skill: Skill): string | undefined {
    let skillSlot
    skill.palettes.forEach((palette) => {
      for(const slot of palette.slots) {
        switch (palette.type) {
          case 'Equipment':
            if(palette.weapon_type !== 'None') {
              const replaceFn = (_: string, __: string, digit: string) => {
                if(
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
            if(slot.slot === 'Standard') {
              skillSlot = 'Utility'
            }
            break
          case 'Heal':
            skillSlot = 'Heal'
            break
          case 'Bundle':
            skillSlot = slot.slot.replace(/(Offhand|Main)(\d)/, (_, __, digit: string) => `Weapon ${digit}`)
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
    apiObject : Skill, // TODO(Rennorb): expand type
    context   : Context,
  ) {
    const basic = document.createElement('tet')
    const name = `<teb> ${apiObject.name} </teb>`
    const slot = `<tes>( ${this.processSkillSlot(apiObject)} )</tes><div class="flexbox-fill"></div>`

    let recharge
    if(context.gameMode !== 'Pve' && apiObject.recharge_override.length) {
      apiObject.recharge_override.forEach((recharge_mode: RechargeOverride) => {
        if(recharge_mode.mode === context.gameMode) {
          recharge = `${
            recharge_mode.recharge.secs
              ? `<ter>
              ${recharge_mode.recharge.secs}
              ${TUtilsV2.newImg('https://assets.gw2dat.com/156651.png', 'iconsmall')}</ter>`
              : ''
          } `
        }
      })
    } else {
      recharge = `${
        apiObject.recharge.secs
          ? `<ter>
      ${apiObject.recharge.secs}
      ${TUtilsV2.newImg('https://assets.gw2dat.com/156651.png', 'iconsmall')}</ter>`
          : ''
      } `
    }

    basic.innerHTML = `
     ${name}   
     ${slot}
     ${recharge}
`

    const description = document.createElement('ted')
    description.innerHTML = apiObject.description ? `<teh>${TUtilsV2.GW2Text2HTML(apiObject.description)}</teh>` : ''
    const tooltip = TUtilsV2.newElement('div.tooltip')
    tooltip.dataset.id = String(apiObject.id)
    tooltip.style.marginTop = '5px'
    tooltip.append(basic)
    tooltip.append(description)
    const factsElements = SkillsProcessor.processFact(apiObject, this.objectData['skills'], context) // TODO(Rennorb) @correctness: should this really use 'skills' ? 
    if(factsElements) tooltip.append(...factsElements)
    this.tooltip.append(tooltip)

    document.body.appendChild(this.tooltip)
  }

  generateToolTip(initialSkill: Skill, gw2Object: HTMLElement): Skill[] {
    const skillChain: Skill[] = []
    const validTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard']

    const addSkillToChain = (currentSkill: Skill) => {
      skillChain.push(currentSkill)

      currentSkill.palettes.forEach((palette) => {
        palette.slots.forEach((slot) => {
          if(slot.next_chain && slot.profession !== 'None') {
            const nextSkillInChain = this.objectData['skills'].get(slot.next_chain);
            if(nextSkillInChain) {
              addSkillToChain(nextSkillInChain)
            }
          }
        })
      })

      if(currentSkill.sub_skills) {
        currentSkill.sub_skills.forEach((subSkillId) => {
          const subSkillInChain = this.objectData['skills'].get(subSkillId);
          if(subSkillInChain && subSkillInChain.palettes.some(palette => validTypes.includes(palette.type))) {
            addSkillToChain(subSkillInChain)
          }
        })
      }
    }

    addSkillToChain(initialSkill)

    const context = this.context[+String(gw2Object.getAttribute('contextSet')) || 0];
    skillChain.forEach(skill => this.processToolTipInfo(skill, context))
    const chainTooltips = Array.from(this.tooltip.children) as HTMLElement[]

    if(chainTooltips.length > 1) {
      gw2Object.classList.add('cycler')
      gw2Object.setAttribute('title', 'Right-click to cycle through tooltips')

      let currentTooltipIndex = 0
      this.displayCorrectChainTooltip(chainTooltips, currentTooltipIndex)

      gw2Object.addEventListener('contextmenu', event => {
        event.preventDefault()
        gw2tooltips.cycleTooltips()
        currentTooltipIndex = (currentTooltipIndex + 1) % chainTooltips.length
        gw2tooltips.displayCorrectChainTooltip(chainTooltips, currentTooltipIndex)
      })
    }
    gw2Object.addEventListener('mousemove', event => {
      gw2tooltips.lastMouseX = event.pageX
      gw2tooltips.lastMouseY = event.pageY
      gw2tooltips.positionTooltip()
    })
    return skillChain
  }
}

const gw2tooltips = new GW2TooltipsV2()
gw2tooltips.hookDocument(document)
