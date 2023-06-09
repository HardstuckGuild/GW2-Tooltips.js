class APICache {
  static storage: ObjectDataStorage = {
    skills: new Map<number, API.Skill>(),
    items: new Map<number, API.Item>(),
    traits: new Map<number, API.Trait>(),
    pets: new Map<number, API.Pet>(),
    'pvp/amulets': new Map<number, API.Amulet>(),
    specializations: new Map<number, API.Specialization>(),
  }

  static apiImpl: APIImplementation

  //TODO(Rennorb): add option to api to send hybrid request to get all related information for a page
  /** This might actually fetch more data than just the ids specified and ensures that all data required to display the ids is available */
  static async ensureExistence<T extends Endpoints>(
    endpoint: T,
    initialIds: IterableIterator<number>
  ): Promise<void> {
    if (!this.apiImpl) {
      this.apiImpl = new HSAPI()
    }

    let additionalIds: { [k in Endpoints]: Set<number> } = Object.assign(
      {
        skills: new Set<number>(),
        items: new Set<number>(),
        traits: new Set<number>(),
        pets: new Set<number>(),
        'pvp/amulets': new Set<number>(),
        specializations: new Set<number>(),
      },
      { [endpoint]: new Set(initialIds) }
    )

    const findNextRelevantEndpoint = () => {
      for (const [endpoint, ids] of Object.entries(additionalIds))
        if (ids.size > 0) return endpoint
      return undefined
    }

    let currentEndpoint: Endpoints | undefined = endpoint
    let i = 0
    do {
      console.info(
        `[gw2-tooltips API cache] round #${i++} for a ${endpoint} request, currently fetching ${currentEndpoint}`
      )

      const storageSet = this.storage[currentEndpoint]
      //TODO(Rennorb): i really don't like this but it seems to be the cost sensible way for now
      const request = Array.from(additionalIds[endpoint].values())
      additionalIds[endpoint].clear()

      try {
        const response = await this.apiImpl.bulkRequest(
          currentEndpoint,
          request
        )

        for (const datum of response) {
          if (storageSet.has(datum.id)) continue

          storageSet.set(datum.id, datum as any) //TODO
          this.collectConnectedIds(
            { endpoint: currentEndpoint, datum } as any,
            additionalIds
          )
        }
      } catch (ex) {
        console.error(ex)
      }
    } while ((currentEndpoint = findNextRelevantEndpoint()) && i < 100)
  }

  static collectConnectedIds(
    { endpoint, datum }: ConnectedIdDatum,
    connectedIdsStorage: { [k in Endpoints]: Set<number> }
  ): void {
    switch (endpoint) {
      case 'skills':
        {
          for (const palette of datum.palettes) {
            for (const slot of palette.slots) {
              if (
                slot.profession !== 'None' &&
                slot.next_chain &&
                !this.storage.items.has(slot.next_chain)
              ) {
                connectedIdsStorage.skills.add(slot.next_chain)
              }
            }
          }

          if (datum.sub_skills) {
            datum.sub_skills.forEach(
              Set.prototype.add.bind(connectedIdsStorage.skills)
            )
          }

          for (const fact of datum.facts) {
            if (fact.type == 'Buff' || fact.type == 'BuffBrief') {
              connectedIdsStorage.skills.add(fact.buff) // TODO(Rennorb) @correctness: are we sure about using the skill endpoint for this?
            }
            if (fact.type === 'PrefixedBuffBrief') {
              connectedIdsStorage.skills.add(fact.prefix)
            }
          }

          if (datum.facts_override) {
            for (const { facts } of datum.facts_override) {
              for (const fact of facts) {
                if (fact.type == 'Buff' || fact.type == 'BuffBrief') {
                  connectedIdsStorage.skills.add(fact.buff) // TODO(Rennorb) @correctness: are we sure about using the skill endpoint for this?
                }
                if (fact.type === 'PrefixedBuffBrief') {
                  connectedIdsStorage.skills.add(fact.prefix)
                }
              }
            }
          }
        }
        break
    }
  }
}

//TODO(Rennorb) @cleanup: disgusting
type ConnectedIdDatum =
  | {
      endpoint: 'skills'
      datum: APIResponseTypeMap['skills']
    }
  | {
      endpoint: 'traits'
      datum: APIResponseTypeMap['traits']
    }
  | {
      endpoint: 'items'
      datum: APIResponseTypeMap['items']
    }
  | {
      endpoint: 'specializations'
      datum: APIResponseTypeMap['specializations']
    }
  | {
      endpoint: 'pets'
      datum: APIResponseTypeMap['pets']
    }
  | {
      endpoint: 'pvp/amulets'
      datum: APIResponseTypeMap['pvp/amulets']
    }
