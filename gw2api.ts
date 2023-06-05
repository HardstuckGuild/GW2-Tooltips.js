class NewGW2API {
  fetchedIds = new Set<number>()

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
          !this.fetchedIds.has(slot.next_chain)
        ) {
          idSet.add(slot.next_chain)
        }
      })
    })
  }

  processSubSkills(skill: Skill, idSet: Set<number>) {
    if (skill.sub_skills) {
      skill.sub_skills.forEach((subSkillId) => {
        if (!this.fetchedIds.has(subSkillId)) {
          idSet.add(subSkillId)
        }
      })
    }
  }

  async simulateApiResponse(ids: number[], type: string): Promise<Skill[]> {
    let response = await fetch('../output.json')
    let allSkills: Skill[] = await response.json()
    let skills = allSkills.filter((skill) => ids.includes(skill.id))

    ids.forEach((id) => this.fetchedIds.add(id))

    return skills
  }

  async processApiResponse(
    type: string,
    initialIds: number[]
  ): Promise<Skill[]> {
    let idSet = new Set(initialIds)
    let result: Skill[] = []
    let skillMap = new Map<number, Skill>()

    while (idSet.size > 0) {
      let newIds = Array.from(idSet).filter((id) => !this.fetchedIds.has(id))
      idSet.clear()
      const skills = await this.simulateApiResponse(newIds, type)

      skills.forEach((skill) => {
        if (!skillMap.has(skill.id)) {
          skillMap.set(skill.id, skill)
          result.push(skill)
          this.processPalettes(skill, idSet)
          this.processSubSkills(skill, idSet)
          this.processFactsAndOverrides(skill, idSet)
        }
      })
    }
    return result
  }

  async getAPIObjects(type: string, ids: number[]): Promise<any> {
    if (ids && ids.length > 0) {
      let gatheredObjects: any[] = []

      const response = await this.processApiResponse(type, ids)
      gatheredObjects = response

      return gatheredObjects
    } else {
      return []
    }
  }
}

const api = new NewGW2API()
