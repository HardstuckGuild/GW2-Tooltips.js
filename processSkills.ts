class processSkills {
  calculateModifier = (
    formula: number,
    level: number,
    base_amount: number,
    formula_param1: number,
    formula_param2: number,
    condition_damage: number,
    healing_power: number,
    power: number
  ) => {
    switch (formula) {
      case 0:
        return level * formula_param1 + base_amount
      case 1:
        return (
          level * formula_param1 +
          base_amount +
          condition_damage * formula_param2
        )
      case 2:
        return (
          level * level * formula_param1 +
          base_amount +
          condition_damage * formula_param2
        )

      case 6:
        return base_amount
      case 7:
        return (
          level * formula_param1 + base_amount + healing_power * formula_param2
        )
      case 8:
        return (
          level * level * formula_param1 +
          base_amount +
          healing_power * formula_param2
        )
      case 9:
      case 10:
        return level * formula_param1 + base_amount
      case 11:
        return level * formula_param1 + base_amount - formula_param2
      case 13:
        return level * formula_param1 + base_amount + power * formula_param2
      case 14:
        return (
          level * level * formula_param1 + base_amount + power * formula_param2
        )
    }
  }

  private getWeaponStrength(relevantPalette: Palette): number {
    let weaponStrenth = 0
    const { weapon_type } = relevantPalette
    const weaponStrengthMap: { [key: string]: number } = {
      Focus: 900,
      Shield: 900,
      Torch: 900,
      Warhorn: 900,
      Greatsword: 1100,
      Hammer: 1100,
      Staff: 1100,
      BowLong: 1050,
      Rifle: 1150,
      BowShort: 1000,
      Axe: 1000,
      Sword: 1000,
      Dagger: 1000,
      Pistol: 1000,
      Scepter: 1000,
      Mace: 1000,
      Standard: 690.5,
    }

    weaponStrenth = weaponStrengthMap[weapon_type] || 0

    if (weapon_type === 'None') {
      if (
        relevantPalette.type === 'Standard' ||
        relevantPalette.type === 'Toolbelt'
      ) {
        weaponStrenth = 690.5
      } else if (relevantPalette.type === 'Bundle') {
        weaponStrenth = 922.5
      }
    }

    return weaponStrenth
  }

  processFact(
    skill: Skill,
    gameMode: 'Pve' | 'Pvp' | 'Wvw' = 'Pve',
    fetchedSkills: Skill[],
    traits?: number[],
    stats?: any
  ) {
    if (!skill.facts.length && !skill.facts_override) return null
    const factwraps: HTMLElement[] = []
    let totalDefianceBreak = 0

    const processFactData = (fact: Fact) => {
      if (
        fact.requires_trait &&
        (!traits ||
          !fact.requires_trait.some((reqTrait: number) =>
            traits.includes(reqTrait)
          ))
      ) {
        return null
      }

      const factwrap = document.createElement('te')
      const matchingSkills = fetchedSkills.filter(
        (skill: Skill) => fact.buff && skill.id === fact.buff
      )
      const buff = matchingSkills.length > 0 ? matchingSkills[0] : null

      let iconUrl = `https://assets.gw2dat.com//${fact.icon}`
      let htmlContent = ''

      if (fact.defiance_break) {
        totalDefianceBreak += fact.defiance_break
      }
      const handlers = {
        Time: ({ fact }: HandlerParams) =>
          `<tem> ${fact.text}: ${fact.duration?.secs}s </tem>`,
        Distance: ({ fact }: HandlerParams) =>
          `<tem> ${fact.text}: ${fact.distance} </tem>`,
        Buff: ({ fact, buff, gameMode, traits, stats }: HandlerParams) => {
          let modifiers = ''
          iconUrl = `https://assets.gw2dat.com//${buff?.icon}`
          if (buff?.modifiers) {
            buff.modifiers.forEach((modifier: Modifier) => {
              if (
                (modifier.trait_req &&
                  (!traits || !traits.includes(modifier.trait_req))) ||
                (modifier.mode && modifier.mode !== gameMode)
              ) {
                return
              }

              let modifierValue = this.calculateModifier(
                modifier.formula,
                stats.level,
                modifier.base_amount,
                modifier.formula_param1,
                modifier.formula_param2,
                stats.conditionDamage,
                stats.healilng,
                stats.power
              )

              if (
                modifier.flags.includes('MulByDuration') &&
                fact.duration &&
                !modifier.flags.includes('FormatPercent')
              ) {
                modifierValue! *= fact.duration.secs
              }

              if (modifier.flags.includes('FormatPercent')) {
                if (modifier.flags.includes('NonStacking')) {
                  modifiers += ` ${Math.round(modifierValue!)}% ${
                    modifier.description
                  }`
                } else {
                  modifiers += ` ${Math.round(
                    fact.apply_count! * modifierValue!
                  )}% ${modifier.description}`
                }
              } else {
                modifiers += ` ${Math.round(
                  fact.apply_count! * modifierValue!
                )} ${modifier.description}`
              }
            })
          }
          const htmlContent = `<tem> ${buff?.name} (${fact.duration?.secs}s) ${
            buff?.description
              ?.replace(/<c=@.*?>(.*?)<\/c>/g, '$1')
              .replace(/%%/g, '%') || ''
          } ${modifiers} </tem>`
          if (fact.apply_count && fact.apply_count > 1) {
            const buffCount = tUtilsv2.newElement(
              'div',
              'buffcount',
              fact.apply_count.toString()
            )
            return htmlContent + buffCount.outerHTML
          }
          return htmlContent
        },
        BuffBrief: ({ fact, buff }: HandlerParams) => {
          iconUrl = `https://assets.gw2dat.com//${buff?.icon}`
          htmlContent =
            fact?.text
              ?.replace(/<c=@.*?>(.*?)<\/c>/g, '<tem>$1</tem>')
              .replace(/%%/g, '%') || ''
          return htmlContent
        },
        Damage: ({ fact, skill, stats }: HandlerParams) => {
          let weaponStrength = 0
          if (skill.palettes.length) {
            const relevantPalette = skill.palettes.find(
              (palette) =>
                palette.slots &&
                palette.slots.some((slot) => slot.profession !== 'None')
            )

            if (relevantPalette) {
              weaponStrength = this.getWeaponStrength(relevantPalette)
            }
          }

          if (fact.hit_count && fact.hit_count > 1) {
            return `<tem> ${fact.text}: (${fact.hit_count}x) ${Math.round(
              (Math.round(weaponStrength) *
                stats.power *
                (fact.hit_count! * fact.dmg_multiplier!)) /
                2597
            )} </tem>`
          } else {
            return `<tem> ${fact.text}: ${Math.round(
              (fact.hit_count! *
                Math.round(weaponStrength) *
                stats.power *
                (fact.hit_count! * fact.dmg_multiplier!)) /
                2597
            )} </tem>`
          }
        },
        Number: ({ fact }: HandlerParams) =>
          `<tem> ${fact.text}: ${fact.value} </tem>`,
        Percent: ({ fact }: HandlerParams) =>
          `<tem>${
            fact?.text ? fact.text.replace(/<c=@.*?>(.*?)<\/c>/g, '$1') : ''
          }: ${fact?.percent}%</tem>`.replace(/%%/g, '%'),
        AttributeAdjust: ({ fact, stats }: HandlerParams) =>
          `<tem> ${fact.text} : ${Math.round(
            (fact.value! +
              stats[fact.target!.toLowerCase()] * fact.attribute_multiplier! +
              stats.level ** fact.level_exponent! * fact.level_multiplier!) *
              fact.hit_count!
          )} </tem>`,
        ComboField: ({ fact }: HandlerParams) =>
          `<tem> ${fact.text}: ${fact.field_type} </tem>`,
        ComboFinisher: ({ fact }: HandlerParams) =>
          `<tem> ${fact.text}: ${fact.finisher_type} </tem>`,
        NoData: ({ fact }: HandlerParams) => `<tem> ${fact.text}`,
      }

      if (fact.type in handlers) {
        const handler = handlers[fact.type as keyof typeof handlers]
        const params: HandlerParams = {
          fact,
          buff,
          gameMode,
          traits,
          stats,
          skill,
        }
        htmlContent = handler(params)
      }

      if (fact.text === 'pull') {
        htmlContent = `<tem> ${fact.text}: ${fact.value} </tem>`
      }

      const icon =
        iconUrl.split('//')[2] && iconUrl.split('//')[2] !== 'undefined'
          ? iconUrl
          : 'https://assets.gw2dat.com//156661.png'
      factwrap.innerHTML = `${tUtilsv2.newImg(icon, 'iconmed')} ${htmlContent}`

      return factwrap
    }

    const sortedFacts = [...skill.facts].sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    )
    sortedFacts.forEach((fact) => {
      const factwrap = processFactData(fact)
      if (factwrap) {
        factwraps.push(factwrap)
      }
    })

    if (!skill.facts.length || gameMode !== 'Pve') {
      skill.facts_override.forEach((override) => {
        if (override.mode === gameMode) {
          const sortedOverrideFacts = [...override.facts].sort(
            (a, b) => (a.order || 0) - (b.order || 0)
          )
          sortedOverrideFacts.forEach((fact) => {
            const factwrap = processFactData(fact)
            if (factwrap) {
              factwraps.push(factwrap)
            }
          })
        }
      })
    }

    if (totalDefianceBreak > 0) {
      const defianceWrap = document.createElement('te')
      defianceWrap.innerHTML = `${tUtilsv2.newImg(
        `https://assets.gw2dat.com//1938788.png`,
        'iconmed'
      )} <tem> Defiance Break: ${totalDefianceBreak} </tem>`
      defianceWrap.classList.add('defiance')
      factwraps.push(defianceWrap)
    }

    if (skill.range) {
      const rangeWrap = document.createElement('te')
      rangeWrap.innerHTML = `${tUtilsv2.newImg(
        `https://assets.gw2dat.com//156666.png`,
        'iconmed'
      )} <tem> Range: ${skill.range} </tem>`
      factwraps.push(rangeWrap)
    }

    return factwraps
  }
}

const processFacts = new processSkills()
