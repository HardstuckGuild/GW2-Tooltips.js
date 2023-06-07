class HSAPI {
  static fetchedIds = new Set<number>()

  static processFactsAndOverrides (skill : API.Skill, idSet : Set<number>) {
    for(const fact of skill.facts) {
      if(fact.type.includes('Buff') && fact.buff !== undefined) {
        idSet.add(fact.buff)
      }
    }

    if(skill.facts_override) {
      for(const { facts } of skill.facts_override) {
        for(const fact of facts) {
          if(fact.type.includes('Buff') && fact.buff !== undefined) {
            idSet.add(fact.buff)
          }
        }
      }
    }
  }

  static processPalettes(skill : API.Skill, idSet : Set<number>) {
    for(const palette of skill.palettes) {
      for(const slot of palette.slots) {
        if(
          slot.profession !== 'None' &&
          slot.next_chain &&
          !this.fetchedIds.has(slot.next_chain)
        ) {
          idSet.add(slot.next_chain)
        }
      }
    }
  }

  static processSubSkills(skill : API.Skill, idSet : Set<number>) {
    if(!skill.sub_skills) return;
    for(const subSkillId of skill.sub_skills) {
      if(!this.fetchedIds.has(subSkillId)) {
        idSet.add(subSkillId)
      }
    }
  }

  static async simulateApiResponse(ids : number[], type : string) : Promise<API.Skill[]> { //todo(Rennorb): this shouldn't be here. Also we have interfaces, why don't we use those ? 
    //let response = await fetch('./output.json')
    //let allSkills: Skill[] = await response.json()
    let allSkills = (window as any).DUMP_output as API.Skill[]
    let skills = allSkills.filter(skill => ids.includes(skill.id))

    ids.forEach((id) => this.fetchedIds.add(id))

    return skills
  }

  static async processApiResponse(type : string, initialIds : number[]) : Promise<API.Skill[]> {
    let idSet = new Set(initialIds)
    let result : API.Skill[] = []
    let duplicateTest = new Map<number, API.Skill>()

    while(idSet.size > 0) {
      let newIds = Array.from(idSet).filter(id => !this.fetchedIds.has(id))
      idSet.clear()

      for(const skill of await this.simulateApiResponse(newIds, type)) {
        if(duplicateTest.has(skill.id)) continue;

        duplicateTest.set(skill.id, skill)

        this.processPalettes(skill, idSet)
        this.processSubSkills(skill, idSet)
        this.processFactsAndOverrides(skill, idSet)
        
        result.push(skill)
      }
    }

    return result
  }

  static async getAPIObjects(type : string, ids : number[]) : Promise<any> {
    let gatheredObjects : any[] = []
    if(ids.length) {
      gatheredObjects = await this.processApiResponse(type, ids)
    }
    return gatheredObjects
  }
}
