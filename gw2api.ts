class NewGW2API {
  constructor() {}

  processFactsAndOverrides(skill: Skill, idSet: Set<number>) {
    if (skill.facts.length) {
      skill.facts.forEach((fact: Fact) => {
        if (
          (fact.type === 'Buff' || fact.type === 'BuffBrief') &&
          fact.buff !== undefined &&
          !idSet.has(fact.buff)
        ) {
          idSet.add(fact.buff)
        }
      })
    }
    if (skill.facts_override && skill.facts_override.length) {
      skill.facts_override.forEach((facts) => {
        facts.facts.forEach((fact) => {
          if (
            (fact.type === 'Buff' || fact.type === 'BuffBrief') &&
            fact.buff !== undefined &&
            !idSet.has(fact.buff)
          ) {
            idSet.add(fact.buff)
          }
        })
      })
    }
  }

  processPalettes(skill: Skill, idSet: Set<number>) {
    skill.palettes.forEach((palette) => {
      palette.slots.forEach((slot) => {
        if (
          slot.profession !== 'None' &&
          slot.next_chain &&
          !idSet.has(slot.next_chain)
        ) {
          idSet.add(slot.next_chain)
        }
      })
    })
  }

  processSubSkills(skill: Skill, idSet: Set<number>, allObjects: Skill[]) {
    const validTypes = ['Bundle', 'Heal', 'Elite', 'Profession', 'Standard']

    if (skill.sub_skills) {
      skill.sub_skills.forEach((subSkillId) => {
        const subSkill = allObjects.find((obj) => obj.id === subSkillId)
        if (
          subSkill &&
          subSkill.palettes.some((palette) =>
            validTypes.includes(palette.type)
          ) &&
          !idSet.has(subSkillId)
        ) {
          idSet.add(subSkillId)
        }
      })
    }
  }

  async simulateAPIResponse(type: string, ids: number[]): Promise<Skill[]> {
    try {
      const response = await fetch('../output.json')
      const allObjects: Skill[] = await response.json()

      let idSet = new Set(ids)
      let result: Skill[] = []

      let skillMap = new Map<number, Skill>()
      allObjects.forEach((skill) => skillMap.set(skill.id, skill))
      while (true) {
        let newIdAdded = false

        idSet.forEach((id) => {
          const skill = skillMap.get(id)
          if (skill && !result.includes(skill)) {
            result.push(skill)
            this.processPalettes(skill, idSet)
            this.processSubSkills(skill, idSet, allObjects)
            this.processFactsAndOverrides(skill, idSet)
            newIdAdded = true
          }
        })

        if (!newIdAdded) {
          break
        }
      }
      return result
    } catch (error) {
      throw error
    }
  }

  async getAPIObjects(type: string, ids: number[]): Promise<any> {
    if (ids && ids.length > 0) {
      let gatheredObjects: any[] = []

      const response = await this.simulateAPIResponse(type, ids)
      gatheredObjects = response

      return gatheredObjects
    } else {
      return []
    }
  }
}

const api = new NewGW2API()
